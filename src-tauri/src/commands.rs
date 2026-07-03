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

use serde::{Deserialize, Serialize};
use stardust_core::audio;
use stardust_core::midi::{self, MidiMessage};
use stardust_core::plugin::clap;
use stardust_core::show::{Patch, ShowDocument, ShowValidationError};
use tauri::State;
use tokio::sync::Mutex;

use crate::engine::{EngineCommand, EngineHandle, EngineStatus, StartConfig};

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
/// Discovery is a rare, startup-time operation; serializing it costs the user
/// nothing and keeps macOS CoreAudio + dlopen from racing.
#[derive(Default)]
pub struct DiscoveryLock(pub Mutex<()>);

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

#[tauri::command]
pub async fn list_clap_plugins(lock: State<'_, DiscoveryLock>) -> Result<ClapScanResult, String> {
    let _guard = lock.0.lock().await;
    tokio::task::spawn_blocking(|| {
        let paths = clap::default_clap_search_paths();
        let paths_scanned: Vec<String> = paths.iter().map(|p| p.display().to_string()).collect();
        let scan = clap::scan_paths(&paths);

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

        ClapScanResult {
            plugins,
            errors,
            paths_scanned,
        }
    })
    .await
    .map_err(|e| format!("clap scan task panicked: {e}"))
}

// =============================================================================
// MIDI input devices
// =============================================================================

/// A MIDI input port the OS reported.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MidiInputInfo {
    pub name: String,
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
                    .map(|i| MidiInputInfo { name: i.name })
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

/// Start the engine from the active patch. `midi_input = None` runs
/// with no hardware MIDI input — the engine still hosts and audibly
/// plays whatever the on-screen keyboard injects via `engine_send_midi`.
#[tauri::command]
pub fn engine_start_from_patch(
    patch: Patch,
    midi_input: Option<String>,
    audio_output: Option<String>,
    engine: State<'_, EngineHandle>,
) -> Result<(), EngineStartError> {
    engine
        .send(EngineCommand::Start(StartConfig {
            graph: patch.graph,
            midi_input,
            audio_output,
        }))
        .map_err(|message| EngineStartError::Engine { message })
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
