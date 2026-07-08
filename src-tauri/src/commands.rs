//! Tauri command surface exposed to the React UI.
//!
//! The bridge to `stardust-core`. Commands here translate UI requests
//! into calls on the engine library and shape the responses into
//! JSON-friendly types the frontend can render directly.
//!
//! Design rules for this module:
//!
//! - **Read-only commands first.** Discovery (list plugins / MIDI / audio
//!   devices) is safe to call from anywhere — no engine state to manage.
//!   Engine-state commands (start/stop/route) land in a dedicated engine
//!   thread module so we don't try to share `!Send` plugin handles.
//! - **JSON-friendly response types live here.** We don't leak the
//!   `stardust-core` types straight through — the UI gets a stable
//!   contract that survives engine refactors.
//! - **Errors are stringly-typed at the Tauri boundary** because Tauri
//!   wants `Serialize` on error variants and we don't want to enumerate
//!   every engine failure mode in the public surface. Logs on the Rust
//!   side carry the structured details for debugging.

use std::path::PathBuf;
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc::Sender;

use arc_swap::ArcSwapOption;
use serde::{Deserialize, Serialize};
use stardust_core::audio;
use stardust_core::midi::{self, MidiMessage};
use stardust_core::plugin::{cache as plugin_cache, clap};
use stardust_core::show::{Patch, Rig, ShowDocument, ShowValidationError};
use tauri::State;
use tokio::sync::Mutex;

use crate::engine::{
    EngineCommand, EngineHandle, EngineStatus, RebindError, RebindSpec, StartConfig,
};

// =============================================================================
// Discovery serialization
//
// CLAP scanning `dlopen`s plugin bundles, which runs each plugin's C++ static
// initializers. Some plugins (e.g. Surge XT on macOS 26) touch CoreAudio
// during init; if cpal's device enumeration is running on another tokio
// worker at the same time, CoreAudio's HAL global state can race and
// segfault inside `HALDeviceList::GetData`. Observed: a null-pointer write
// at 0x4 during concurrent `list_clap_plugins` + `list_audio_outputs` at app
// startup.
//
// The fix is two-part:
//   1. A shared async mutex serializes all three discovery commands so
//      dlopen can never overlap with CoreAudio enumeration.
//   2. The actual blocking work runs inside `spawn_blocking` so we don't
//      pin a tokio worker on long-running syscalls.
// =============================================================================

/// Async mutex held during any plugin / MIDI / audio device enumeration.
/// Discovery is a rare operation; serializing it costs the user nothing
/// and keeps macOS CoreAudio + dlopen from racing. `Arc` so the
/// background rescan thread (which isn't a Tauri command) can hold the
/// same lock via `blocking_lock`.
#[derive(Clone, Default)]
pub struct DiscoveryLock(pub Arc<Mutex<()>>);

// =============================================================================
// Plugin discovery
// =============================================================================

/// One CLAP plugin advertised by a discovered bundle.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClapPluginInfo {
    /// Path to the `.clap` bundle on disk.
    pub bundle_path: String,
    /// Unique identifier (e.g. `org.surge-synth-team.surge-xt`).
    pub id: String,
    pub name: String,
    pub vendor: String,
    pub version: String,
    pub description: String,
    /// CLAP feature tags (`instrument`, `audio-effect`, `stereo`, …).
    pub features: Vec<String>,
}

/// A bundle the scanner attempted but couldn't load.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClapScanError {
    pub path: String,
    pub message: String,
}

/// Combined response: every plugin found, every scan failure, and the
/// list of directories that were walked. Letting the UI render the
/// search paths helps users see why a plugin they think they have isn't
/// turning up.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClapScanResult {
    pub plugins: Vec<ClapPluginInfo>,
    pub errors: Vec<ClapScanError>,
    pub paths_scanned: Vec<String>,
}

// -----------------------------------------------------------------------------
// Plugin scan cache (stardust-pit#4)
//
// Snapshot semantics: the frontend always reads an immutable `Arc`'d
// `ClapScanResult`; whichever thread rescans builds a fresh result and
// atomically swaps it in. No mutex-on-read, no torn reads. The on-disk
// mtime-keyed cache (`~/.stardust/plugin-cache.json`) lives in
// `stardust_core::plugin::cache`; this layer owns the in-memory snapshot,
// the background rescan thread, and the `plugins://scan` change event.
// -----------------------------------------------------------------------------

/// Where scan snapshots + rescan controls live (Tauri-managed state).
pub struct PluginCache {
    /// Latest scan snapshot; `None` until the first scan completes.
    snapshot: ArcSwapOption<ClapScanResult>,
    /// Background rescan interval in minutes (Settings-configurable,
    /// default 5, clamped 1..=60).
    interval_min: AtomicU64,
    /// Kick channel to the background thread ("Rescan now").
    kick: std::sync::Mutex<Option<Sender<()>>>,
}

impl Default for PluginCache {
    fn default() -> Self {
        Self {
            snapshot: ArcSwapOption::empty(),
            interval_min: AtomicU64::new(5),
            kick: std::sync::Mutex::new(None),
        }
    }
}

impl PluginCache {
    pub fn set_kick(&self, tx: Sender<()>) {
        *self.kick.lock().expect("kick mutex poisoned") = Some(tx);
    }

    pub fn interval(&self) -> std::time::Duration {
        std::time::Duration::from_secs(self.interval_min.load(Ordering::Relaxed) * 60)
    }

    /// Run one cached scan and swap the snapshot in. Returns the fresh
    /// snapshot. Blocking — call from `spawn_blocking` or the rescan
    /// thread, with the discovery lock held.
    pub fn scan(&self) -> Arc<ClapScanResult> {
        let paths = clap::default_clap_search_paths();
        let paths_scanned: Vec<String> = paths.iter().map(|p| p.display().to_string()).collect();
        let started = std::time::Instant::now();
        let outcome = plugin_cache::scan_paths_cached(&paths, &plugin_cache_path());
        tracing::info!(
            cache_hits = outcome.cache_hits,
            loaded = outcome.loaded,
            elapsed_ms = started.elapsed().as_millis() as u64,
            "plugin scan"
        );

        let scan = outcome.result;
        let mut plugins: Vec<ClapPluginInfo> = Vec::with_capacity(scan.bundles.len());
        for bundle in &scan.bundles {
            let bundle_path = bundle.path.display().to_string();
            for d in &bundle.descriptors {
                plugins.push(ClapPluginInfo {
                    bundle_path: bundle_path.clone(),
                    id: d.id.clone(),
                    name: d.name.clone(),
                    vendor: d.vendor.clone(),
                    version: d.version.clone(),
                    description: d.description.clone(),
                    features: d.features.clone(),
                });
            }
        }
        let errors = scan
            .errors
            .iter()
            .map(|(p, m)| ClapScanError {
                path: p.display().to_string(),
                message: m.clone(),
            })
            .collect();

        let result = Arc::new(ClapScanResult {
            plugins,
            errors,
            paths_scanned,
        });
        self.snapshot.store(Some(result.clone()));
        result
    }
}

/// `~/.stardust/plugin-cache.json` (per the #4 acceptance criteria).
fn plugin_cache_path() -> PathBuf {
    let home = std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(PathBuf::from)
        .unwrap_or_else(std::env::temp_dir);
    home.join(".stardust/plugin-cache.json")
}

/// Return the current plugin list. First call performs a (cached) scan
/// synchronously — with a warm mtime cache this is the fast cold-launch
/// path; later calls return the snapshot immediately. Background rescans
/// keep the snapshot fresh and announce changes via the `plugins://scan`
/// event.
#[tauri::command]
pub async fn list_clap_plugins(
    lock: State<'_, DiscoveryLock>,
    cache: State<'_, Arc<PluginCache>>,
) -> Result<ClapScanResult, String> {
    if let Some(snapshot) = cache.snapshot.load_full() {
        return Ok((*snapshot).clone());
    }
    let _guard = lock.0.lock().await;
    // Re-check: another caller may have scanned while we waited.
    if let Some(snapshot) = cache.snapshot.load_full() {
        return Ok((*snapshot).clone());
    }
    let cache = cache.inner().clone();
    tokio::task::spawn_blocking(move || (*cache.scan()).clone())
        .await
        .map_err(|e| format!("clap scan task panicked: {e}"))
}

/// Kick the background rescan thread ("Rescan now"). Non-blocking: the
/// UI hears about the outcome via the `plugins://scan` event.
#[tauri::command]
pub fn rescan_plugins(cache: State<'_, Arc<PluginCache>>) -> Result<(), String> {
    let kick = cache.kick.lock().expect("kick mutex poisoned");
    match kick.as_ref() {
        Some(tx) => tx.send(()).map_err(|_| "rescan thread is gone".into()),
        None => Err("rescan thread not started".into()),
    }
}

/// Set the background rescan interval (minutes, clamped 1..=60).
#[tauri::command]
pub fn set_plugin_scan_interval(
    minutes: u64,
    cache: State<'_, Arc<PluginCache>>,
) -> Result<(), String> {
    cache
        .interval_min
        .store(minutes.clamp(1, 60), Ordering::Relaxed);
    Ok(())
}

// =============================================================================
// MIDI input devices
// =============================================================================

/// A MIDI input port the OS reported. `id` is midir's opaque platform
/// port identifier — the persistence key for per-source hardware
/// bindings (#2); `name` is the display + open key.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MidiInputInfo {
    pub name: String,
    pub id: String,
}

#[tauri::command]
pub async fn list_midi_inputs(
    lock: State<'_, DiscoveryLock>,
) -> Result<Vec<MidiInputInfo>, String> {
    let _guard = lock.0.lock().await;
    tokio::task::spawn_blocking(|| {
        midi::list_inputs()
            .map(|inputs| {
                inputs
                    .into_iter()
                    .map(|i| MidiInputInfo {
                        name: i.name,
                        id: i.id,
                    })
                    .collect()
            })
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("midi enumeration task panicked: {e}"))?
}

// =============================================================================
// Audio output devices
// =============================================================================

/// An audio output device cpal reported.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioOutputInfo {
    pub name: String,
    pub is_default: bool,
}

#[tauri::command]
pub async fn list_audio_outputs(
    lock: State<'_, DiscoveryLock>,
) -> Result<Vec<AudioOutputInfo>, String> {
    let _guard = lock.0.lock().await;
    tokio::task::spawn_blocking(|| {
        audio::list_outputs()
            .map(|outs| {
                outs.into_iter()
                    .map(|o| AudioOutputInfo {
                        name: o.name,
                        is_default: o.is_default,
                    })
                    .collect()
            })
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("audio enumeration task panicked: {e}"))?
}

// =============================================================================
// Engine state
//
// The engine host runs on a dedicated OS thread (see `engine` module)
// because plugin instances are `!Send`. These commands forward intent
// to that thread; the UI hears about state changes via the
// `engine://status` Tauri event, and can pull the current snapshot via
// `engine_status`.
//
// Since v0.8b, Start takes the whole patch graph — the engine builds an
// executable plan (per ADR-0006) that walks every node, hosts every
// `instrument.plugin`, and runs the native DSP nodes (`audio.eq`,
// `audio.mix`, `instrument.testtone`, `midi.transpose`, `midi.mix`). Per-
// node failures (a plugin that won't load, a missing config) come back
// asynchronously via `EngineStatus::Error` so the UI can show them as
// a list.
// =============================================================================

/// Why `engine_start_from_patch` couldn't even queue a start. Surfacing
/// synchronously here is reserved for the engine channel being closed —
/// every other failure mode is asynchronous (plan-build, plugin load)
/// and comes back via `EngineStatus::Error`.
#[derive(Debug, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum EngineStartError {
    /// The engine command channel rejected the send.
    Engine { message: String },
}

/// Start the engine from the active patch. MIDI inputs derive from the
/// rig (union of bound devices, session-wide — #122); a rig with no
/// bound components runs with no hardware input, and the on-screen
/// keyboard still plays via `engine_send_midi`.
#[tauri::command]
pub fn engine_start_from_patch(
    patch: Patch,
    rig: Rig,
    audio_output: Option<String>,
    engine: State<'_, EngineHandle>,
) -> Result<(), EngineStartError> {
    engine
        .send(EngineCommand::Start(StartConfig {
            graph: patch.graph,
            rig,
            audio_output,
        }))
        .map_err(|message| EngineStartError::Engine { message })
}

/// Push a rig edit to the running engine: re-derives the device union +
/// per-connection routes and rebinds (never restarts). A no-op success
/// when idle — the rig rides with the next start.
#[tauri::command]
pub async fn engine_update_rig(
    rig: Rig,
    engine: State<'_, EngineHandle>,
) -> Result<(), RebindError> {
    let handle = engine.inner().clone();
    tokio::task::spawn_blocking(move || handle.update_rig(rig))
        .await
        .map_err(|e| RebindError::Internal {
            message: format!("rig update task panicked: {e}"),
        })?
}

/// Enter Learn mode: the engine opens every connected MIDI input and
/// streams decoded captures to the UI via the `engine://learn` event.
/// The rig-derived performance set is restored by `engine_learn_stop`.
#[tauri::command]
pub fn engine_learn_start(engine: State<'_, EngineHandle>) -> Result<(), String> {
    engine.send(EngineCommand::LearnStart)
}

/// Leave Learn mode and restore the rig-derived input set.
#[tauri::command]
pub fn engine_learn_stop(engine: State<'_, EngineHandle>) -> Result<(), String> {
    engine.send(EngineCommand::LearnStop)
}

/// Swap the audio output device and/or the hardware MIDI input set in
/// place — same plan, no plugin reloads, held voices intact (#1). Only
/// device *identity* changes take this path; sample-rate or buffer-size
/// changes rebuild the plan via `engine_start_from_patch`. On error the
/// previously-active devices stay (or are restored) active and the UI
/// surfaces the failure — never a silent fail, never silence.
#[tauri::command]
pub async fn engine_rebind_routing(
    spec: RebindSpec,
    engine: State<'_, EngineHandle>,
) -> Result<(), RebindError> {
    // The reply round-trip blocks on the engine thread swapping streams;
    // keep that off the async runtime.
    let handle = engine.inner().clone();
    tokio::task::spawn_blocking(move || handle.rebind(spec))
        .await
        .map_err(|e| RebindError::Internal {
            message: format!("rebind task panicked: {e}"),
        })?
}

/// Emergency reset (#3): flush every held voice and reset every
/// continuous controller on all 16 channels, within one audio block.
/// Fire-and-forget and always safe to spam — a panic with nothing stuck
/// only re-sends the controller resets. No-op when the engine is idle.
#[tauri::command]
pub fn engine_panic(engine: State<'_, EngineHandle>) -> Result<(), String> {
    engine.send(EngineCommand::Panic)
}

/// Fire-and-forget: push one MIDI message from a UI source (the on-screen
/// keyboard, today) into the running engine. Silently no-ops when the
/// engine isn't running — the UI is expected to gate its keyboard on the
/// engine's status, but a stray event isn't an error.
#[tauri::command]
pub fn engine_send_midi(msg: UiMidiMessage, engine: State<'_, EngineHandle>) -> Result<(), String> {
    engine.send(EngineCommand::SendMidi(msg.into()))
}

/// Wire shape the UI sends for a single MIDI event. Tagged on `kind` so we
/// can grow it (cc, pitch bend) without churning the Rust enum mapping.
/// Velocity-zero note-on collapses to note-off via `MidiMessage::from_bytes`
/// — here we accept what the UI sends and let the engine do its thing.
#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum UiMidiMessage {
    NoteOn { channel: u8, note: u8, velocity: u8 },
    NoteOff { channel: u8, note: u8, velocity: u8 },
}

impl From<UiMidiMessage> for MidiMessage {
    fn from(m: UiMidiMessage) -> Self {
        match m {
            UiMidiMessage::NoteOn {
                channel,
                note,
                velocity,
            } => MidiMessage::NoteOn {
                channel: channel & 0x0F,
                note: note & 0x7F,
                velocity: velocity & 0x7F,
            },
            UiMidiMessage::NoteOff {
                channel,
                note,
                velocity,
            } => MidiMessage::NoteOff {
                channel: channel & 0x0F,
                note: note & 0x7F,
                velocity: velocity & 0x7F,
            },
        }
    }
}

#[tauri::command]
pub fn engine_stop(engine: State<'_, EngineHandle>) -> Result<(), String> {
    engine.send(EngineCommand::Stop)
}

#[tauri::command]
pub fn engine_status(engine: State<'_, EngineHandle>) -> EngineStatus {
    engine.snapshot()
}

// =============================================================================
// Engine self-test (Settings → "Run engine self-test")
//
// Renders a 2-second high-pitched note through a synthetic
// source.keyboard → instrument.testtone → sink.main-out graph and reports
// the peak 100ms-RMS in dBFS. Pass threshold lives next to the renderer in
// `engine_graph::SELF_TEST_THRESHOLD_DBFS`.
//
// Runs entirely on the calling thread — no engine state is mutated, no
// cpal device is opened. Safe to invoke while the live engine is running
// because the diagnostic owns its own ephemeral Plan.
// =============================================================================

#[tauri::command]
pub async fn engine_self_test() -> Result<crate::engine_graph::SelfTestResult, String> {
    tokio::task::spawn_blocking(|| {
        let graph = crate::engine_graph::self_test_graph();
        crate::engine_graph::render_self_test(&graph)
    })
    .await
    .map_err(|e| format!("self-test join error: {e}"))?
}

// =============================================================================
// Show document load/save
//
// Same shape as the patch commands above: pure JSON <-> struct, file I/O
// owned by the UI via `tauri-plugin-fs` + `tauri-plugin-dialog`. Errors
// are structured so the UI can render parse failures (one message) and
// validation failures (a list, each carrying patch context per ADR-0005)
// differently.
// =============================================================================

/// Why a show document couldn't be loaded or saved.
#[derive(Debug, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ShowError {
    /// JSON malformed, not a stardust show, or newer schema than this build.
    Parse { message: String },
    /// Document parsed but the show (or one of its embedded patch graphs)
    /// failed structural validation. `validate` collects every error so the
    /// UI can show all problems at once.
    Validation { errors: Vec<ShowValidationError> },
}

#[tauri::command]
pub fn load_show(json: String) -> Result<ShowDocument, ShowError> {
    let doc = ShowDocument::from_json(&json).map_err(|e| ShowError::Parse {
        message: e.to_string(),
    })?;
    doc.show
        .validate()
        .map_err(|errors| ShowError::Validation { errors })?;
    Ok(doc)
}

#[tauri::command]
pub fn save_show(doc: ShowDocument) -> Result<String, ShowError> {
    doc.show
        .validate()
        .map_err(|errors| ShowError::Validation { errors })?;
    doc.to_json_pretty().map_err(|e| ShowError::Parse {
        message: e.to_string(),
    })
}
