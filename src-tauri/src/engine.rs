//! Engine thread — owns the live audio plan.
//!
//! Since v0.8b the engine doesn't host a single CLAP plugin directly.
//! It owns an [`engine_graph::Plan`] built from the active patch graph;
//! the plan internally holds every plugin instance, every native DSP
//! node, and the routing tables that drive them per audio block. The
//! plan is built once when [`EngineCommand::Start`] arrives and lives
//! inside the cpal audio callback closure for the duration of the
//! Running state.
//!
//! State machine: `Idle` → `Running` → `Idle`. One plan at a time.
//! The plan's plugin instances are `!Send`, so plan ownership stays on
//! this dedicated OS thread for its whole lifetime — the React UI talks
//! to it through a `Sender` and listens for status changes on a Tauri
//! event stream.

use serde::Serialize;
use stardust_core::audio::{
    AudioOutputHandle, AudioSpec, list_outputs, open_default_output, open_output,
};
use stardust_core::midi::{MidiInputHandle, MidiMessage, open_input};
use stardust_core::patch::PatchGraph;
use stardust_core::rt::{Producer, RingBuffer};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::mpsc::{self, RecvTimeoutError, Sender};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

use crate::engine_graph::{
    EVENT_QUEUE, HostedPluginStatus, MAX_FRAMES, NativeNodeCounts, Plan, PlanBuildError,
    SAMPLE_RATE,
};

const STATUS_EVENT: &str = "engine://status";
const DROPPED_TICK: Duration = Duration::from_secs(1);

/// Request a transition from the engine thread.
pub enum EngineCommand {
    Start(StartConfig),
    Stop,
    /// Push a MIDI message from a UI source (on-screen keyboard) into
    /// the active plan. Silently dropped if the engine isn't running.
    SendMidi(MidiMessage),
    /// Reserved for graceful app shutdown — not sent today; the engine
    /// thread exits with the process and its `Drop` impls clean up.
    #[allow(dead_code)]
    Shutdown,
}

/// All the picks the UI hands the engine to bring a patch online.
///
/// The graph is owned by the engine after this — the React side has
/// already cloned it from the show store before sending.
#[derive(Debug, Clone)]
pub struct StartConfig {
    pub graph: PatchGraph,
    /// `None` → no hardware MIDI input; engine runs UI-source only.
    pub midi_input: Option<String>,
    /// `None` → use the host default output device.
    pub audio_output: Option<String>,
}

/// Public snapshot of engine state, sent to the UI both via the
/// `engine_status` command (pull) and the `engine://status` Tauri event
/// (push, whenever it changes).
///
/// Since v0.8b the Running variant carries a list of hosted plugins
/// rather than a single name, plus counts of native DSP nodes.
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum EngineStatus {
    Idle,
    Running {
        plugins: Vec<HostedPluginStatus>,
        native_nodes: NativeNodeCounts,
        /// `None` when the engine is running with no hardware MIDI
        /// input; only the on-screen keyboard / UI source is feeding it.
        midi_input: Option<String>,
        audio_output: String,
        sample_rate: u32,
        channels: u16,
        dropped_events: usize,
        /// `true` when cpal negotiated a rate other than SAMPLE_RATE —
        /// pitches will be off until we wire dynamic re-activation.
        sample_rate_mismatch: bool,
    },
    /// One or more plan-build / runtime problems prevented starting.
    /// Messages are pre-formatted by the engine thread — the UI just
    /// renders them as a list.
    Error {
        messages: Vec<String>,
    },
}

impl EngineStatus {
    fn idle() -> Self {
        EngineStatus::Idle
    }
}

/// Handle stored in Tauri state. Commands send through `tx`; status is
/// readable from `status` (atomic snapshot).
pub struct EngineHandle {
    tx: Sender<EngineCommand>,
    status: Arc<Mutex<EngineStatus>>,
}

impl EngineHandle {
    pub fn send(&self, cmd: EngineCommand) -> Result<(), String> {
        self.tx
            .send(cmd)
            .map_err(|_| "engine thread is gone".to_string())
    }

    pub fn snapshot(&self) -> EngineStatus {
        self.status
            .lock()
            .expect("engine status mutex poisoned")
            .clone()
    }
}

/// Spin up the engine thread and return its handle. The thread lives
/// for the rest of the app process unless `EngineCommand::Shutdown` is
/// sent (which we don't do today).
pub fn spawn(app: AppHandle) -> EngineHandle {
    let (tx, rx) = mpsc::channel::<EngineCommand>();
    let status = Arc::new(Mutex::new(EngineStatus::idle()));
    let status_for_thread = status.clone();

    thread::Builder::new()
        .name("stardust-engine".into())
        .spawn(move || run_engine(rx, status_for_thread, app))
        .expect("failed to spawn engine thread");

    EngineHandle { tx, status }
}

fn run_engine(rx: mpsc::Receiver<EngineCommand>, status: Arc<Mutex<EngineStatus>>, app: AppHandle) {
    let mut running: Option<Running> = None;

    loop {
        let next = match rx.recv_timeout(DROPPED_TICK) {
            Ok(cmd) => Some(cmd),
            Err(RecvTimeoutError::Timeout) => None,
            Err(RecvTimeoutError::Disconnected) => break,
        };

        match next {
            Some(EngineCommand::Start(cfg)) => {
                // Tear down anything currently running before bringing
                // up the next plan — don't try to overlap two.
                drop(running.take());
                match start(cfg, &app) {
                    Ok(r) => {
                        let snapshot = r.status_snapshot(0);
                        publish(&status, &app, snapshot);
                        running = Some(r);
                    }
                    Err(messages) => {
                        publish(&status, &app, EngineStatus::Error { messages });
                    }
                }
            }
            Some(EngineCommand::Stop) => {
                drop(running.take());
                publish(&status, &app, EngineStatus::Idle);
            }
            Some(EngineCommand::SendMidi(msg)) => {
                // On-screen keyboard / UI-originated event. Push into
                // the dedicated UI ring; the audio callback drains it
                // and injects into the plan.
                if let Some(r) = running.as_mut() {
                    if r.ui_producer.push(msg).is_err() {
                        r.dropped.fetch_add(1, Ordering::Relaxed);
                    }
                }
            }
            Some(EngineCommand::Shutdown) => {
                drop(running.take());
                break;
            }
            None => {
                // Idle tick. Re-publish status if the dropped-event
                // counter has moved.
                if let Some(r) = running.as_mut() {
                    let count = r.dropped.load(Ordering::Relaxed);
                    if count != r.last_published_dropped {
                        r.last_published_dropped = count;
                        let snapshot = r.status_snapshot(count);
                        publish(&status, &app, snapshot);
                    }
                }
            }
        }
    }
}

fn publish(status: &Arc<Mutex<EngineStatus>>, app: &AppHandle, next: EngineStatus) {
    *status.lock().expect("engine status mutex poisoned") = next.clone();
    let _ = app.emit(STATUS_EVENT, next);
}

/// Bundle of live resources kept while the engine is in the Running
/// state. The cpal `AudioOutputHandle` owns the audio closure, which
/// owns the [`Plan`] — so dropping `_audio` tears down the plugin
/// processors and native DSP nodes in the right order.
struct Running {
    _audio: AudioOutputHandle,
    _midi: Option<MidiInputHandle>,

    /// Producer for the UI-originated MIDI ring (on-screen keyboard).
    /// The audio callback owns the matching consumer.
    ui_producer: Producer<MidiMessage>,

    dropped: Arc<AtomicUsize>,
    last_published_dropped: usize,

    plugins: Vec<HostedPluginStatus>,
    native_nodes: NativeNodeCounts,
    midi_input: Option<String>,
    audio_output: String,
    sample_rate: u32,
    channels: u16,
    sample_rate_mismatch: bool,
}

impl Running {
    fn status_snapshot(&self, dropped: usize) -> EngineStatus {
        EngineStatus::Running {
            plugins: self.plugins.clone(),
            native_nodes: self.native_nodes.clone(),
            midi_input: self.midi_input.clone(),
            audio_output: self.audio_output.clone(),
            sample_rate: self.sample_rate,
            channels: self.channels,
            dropped_events: dropped,
            sample_rate_mismatch: self.sample_rate_mismatch,
        }
    }
}

/// Bring a plan online. On success returns the live `Running` bundle.
/// On failure returns a list of human-readable messages so the UI can
/// render them all at once.
fn start(cfg: StartConfig, _app: &AppHandle) -> std::result::Result<Running, Vec<String>> {
    // -----------------------------------------------------------------
    // 1. Resolve the audio output device before doing anything else
    //    that might fail. cpal enumeration here is on the engine
    //    thread; the discovery lock isn't in play because we're not
    //    interleaved with CLAP scan (the engine thread is the only
    //    one touching the cpal device list at this moment).
    // -----------------------------------------------------------------
    let outputs = list_outputs().map_err(|e| vec![format!("audio enumeration failed: {e}")])?;
    let (audio_name, use_default) = match cfg.audio_output.as_ref() {
        None => {
            let default = outputs
                .iter()
                .find(|o| o.is_default)
                .ok_or_else(|| vec!["no default audio output".to_string()])?;
            (default.name.clone(), true)
        }
        Some(name) => {
            if !outputs.iter().any(|o| &o.name == name) {
                return Err(vec![format!("audio output not found: {name}")]);
            }
            (name.clone(), false)
        }
    };

    // -----------------------------------------------------------------
    // 2. Build the plan. This is where every plugin loads + activates;
    //    failures are collected and reported as a list.
    // -----------------------------------------------------------------
    let build_out = Plan::build(&cfg.graph).map_err(|errors| {
        errors
            .iter()
            .map(format_plan_build_error)
            .collect::<Vec<_>>()
    })?;
    let mut plan = build_out.plan;
    let plugins = build_out.plugins;
    let native_nodes = plan.native_node_counts();

    // Soft errors (per-node failures that left a Silent placeholder)
    // get logged but don't prevent start.
    for err in &build_out.soft_errors {
        tracing::warn!(error = ?err, "plan-build soft error");
    }

    // -----------------------------------------------------------------
    // 3. MIDI input ring (hardware) + UI ring (on-screen keyboard).
    //    Two SPSC rings — both consumers drain inside the audio
    //    callback per block.
    // -----------------------------------------------------------------
    let (mut hw_producer, mut hw_consumer) = RingBuffer::<MidiMessage>::new(EVENT_QUEUE);
    let (ui_producer, mut ui_consumer) = RingBuffer::<MidiMessage>::new(EVENT_QUEUE);
    let dropped = Arc::new(AtomicUsize::new(0));

    let midi = match cfg.midi_input.as_ref() {
        Some(name) => {
            let dropped_for_midi = dropped.clone();
            Some(
                open_input(name, move |_ts, msg| {
                    if matches!(msg, MidiMessage::Other) {
                        return;
                    }
                    if hw_producer.push(msg).is_err() {
                        dropped_for_midi.fetch_add(1, Ordering::Relaxed);
                    }
                })
                .map_err(|e| vec![format!("midi input '{name}' failed: {e}")])?,
            )
        }
        None => None,
    };

    // -----------------------------------------------------------------
    // 4. Audio callback. Moves the plan + both ring consumers in. Per
    //    block: drain both rings into the plan, then run the plan.
    // -----------------------------------------------------------------
    let render = move |cpal_buf: &mut [f32], spec: &AudioSpec| {
        while let Ok(msg) = hw_consumer.pop() {
            plan.inject_midi(msg);
        }
        while let Ok(msg) = ui_consumer.pop() {
            plan.inject_midi(msg);
        }
        plan.process(cpal_buf, spec);
    };

    let audio = if use_default {
        open_default_output(Some(SAMPLE_RATE as u32), render)
    } else {
        open_output(&audio_name, Some(SAMPLE_RATE as u32), render)
    }
    .map_err(|e| vec![format!("audio output '{audio_name}' failed: {e}")])?;

    let sample_rate = audio.spec.sample_rate;
    let channels = audio.spec.channels;
    let sample_rate_mismatch = sample_rate != SAMPLE_RATE as u32;
    if sample_rate_mismatch {
        tracing::warn!(
            negotiated_hz = sample_rate,
            activated_hz = SAMPLE_RATE as u32,
            "cpal negotiated a different sample rate — pitches will be off until \
             we wire dynamic re-activation"
        );
    }
    let _ = MAX_FRAMES; // Tunable surfaces through the plan; referenced here to keep the import alive.

    tracing::info!(
        plugin_count = plugins.len(),
        midi = ?cfg.midi_input,
        audio = %audio_name,
        sample_rate,
        channels,
        "engine: now hosting"
    );

    Ok(Running {
        _audio: audio,
        _midi: midi,
        ui_producer,
        dropped,
        last_published_dropped: 0,
        plugins,
        native_nodes,
        midi_input: cfg.midi_input,
        audio_output: audio_name,
        sample_rate,
        channels,
        sample_rate_mismatch,
    })
}

fn format_plan_build_error(err: &PlanBuildError) -> String {
    match err {
        PlanBuildError::AudioCycle { involved_nodes } => {
            format!("audio cycle through nodes: {}", involved_nodes.join(", "))
        }
        PlanBuildError::UnknownWireEndpoint { wire, side } => {
            format!("wire '{wire}' references an unknown node on the {side} side")
        }
        PlanBuildError::DanglingCompositePort { composite, port } => {
            format!("composite '{composite}' has no promoted port '{port}'")
        }
        PlanBuildError::PluginLoadFailed { node, message } => {
            format!("plugin node '{node}' failed to load: {message}")
        }
        PlanBuildError::PluginActivationFailed { node, message } => {
            format!("plugin node '{node}' failed to activate: {message}")
        }
        PlanBuildError::EqConfigInvalid { node, message } => {
            format!("EQ node '{node}' has invalid config: {message}")
        }
        PlanBuildError::TransposeConfigInvalid { node, message } => {
            format!("Transpose node '{node}' has invalid config: {message}")
        }
    }
}
