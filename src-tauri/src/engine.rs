//! Engine thread — owns the live audio plan.
//!
//! Since v0.8b the engine doesn't host a single CLAP plugin directly.
//! It owns an [`engine_graph::Plan`] built from the active patch graph;
//! the plan internally holds every plugin instance, every native DSP
//! node, and the routing tables that drive them per audio block.
//!
//! ## Ownership + rebind (stardust-pit#1)
//!
//! The plan lives inside [`CallbackState`], which the cpal audio
//! callback owns through a [`StateCarrier`]. When a stream is torn down
//! (stop, or a device rebind), the carrier's `Drop` sends the state —
//! plan included — back to the engine thread over a channel, so a
//! rebind reopens the stream on the new device with the *same* plan: no
//! plugin reloads, no buffer reallocation, held voices intact. The swap
//! is lock-free from the audio thread's point of view — the callback
//! only ever sees its own state; the handoff happens between streams.
//!
//! Decision tree for device changes:
//! - **Device identity change** (different output device) → rebind:
//!   same plan, new I/O.
//! - **Sample-rate or buffer-size change** → full plan rebuild via
//!   `engine_start_from_patch` (edge buffers + plugin activations are
//!   sized to the audio config; a rebind that lands on a device
//!   negotiating a different rate keeps playing but flags
//!   `sample_rate_mismatch`, same as start).
//!
//! ## Hardware MIDI ingress (stardust-pit#122, superseding #2's model)
//!
//! The engine opens the **union of rig-bound devices, session-wide** —
//! the open set is derived from the show's rig components, never from
//! the active patch, so **patch switches never touch MIDI I/O**. A patch
//! switch reuses the open connections and their SPSC rings: only each
//! connection's route table (which source nodes of the *new* plan the
//! device feeds) is atomically swapped ([`arc_swap`], wait-free for the
//! midir callback). The MIDI open set changes only on:
//!
//! - **rig edits** ([`EngineCommand::UpdateRig`]), and
//! - **device connect / disconnect**, detected by polling the input list
//!   on the engine thread's idle tick.
//!
//! Each open connection owns one pre-allocated SPSC ring; its midir
//! callback matches every event against the resolved source filters
//! ([`engine_graph::SourceFilterSpec`]) and pushes *routed* events —
//! `(source node, message)` — so the audio thread does no matching at
//! all. Device↔component resolution happens here on the engine thread,
//! where the full device list is available.
//!
//! ## Learn mode (stardust-pit#122)
//!
//! [`EngineCommand::LearnStart`] temporarily opens **all** connected
//! inputs (closing the rig-derived performance set first — some
//! platforms refuse double-opens) and forwards every decoded event to
//! the UI as an `engine://learn` Tauri event, tagged with the device it
//! arrived on. [`EngineCommand::LearnStop`] restores the rig-derived
//! set. Learn works with the engine idle or running.
//!
//! State machine: `Idle` → `Running` → `Idle`. One plan at a time.
//! The React UI talks to the engine through a `Sender` and listens for
//! status changes on a Tauri event stream.

use arc_swap::ArcSwap;
use serde::{Deserialize, Serialize};
use stardust_core::audio::{
    AudioOutputHandle, AudioSpec, list_outputs, open_default_output, open_output,
};
use stardust_core::midi::{self, MidiInputHandle, MidiMessage, open_input};
use stardust_core::patch::PatchGraph;
use stardust_core::rt::{Consumer, Producer, RingBuffer};
use stardust_core::show::Rig;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::mpsc::{self, Receiver, RecvTimeoutError, Sender};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

use crate::engine_graph::{
    ComponentBinding, EVENT_QUEUE, EventFilter, HostedPluginStatus, NativeNodeCounts, Plan,
    PlanBuildError, SAMPLE_RATE, SourceFilterSpec, parse_rig, rig_bound_devices,
    source_event_filters,
};

const STATUS_EVENT: &str = "engine://status";
const LEARN_EVENT: &str = "engine://learn";
const DROPPED_TICK: Duration = Duration::from_secs(1);

/// Maximum simultaneously-open hardware MIDI inputs. The per-input SPSC
/// rings are all allocated at plan start so rebinding never allocates
/// anything the audio thread can observe.
pub const MAX_MIDI_INPUTS: usize = 8;

/// How long the engine thread waits for a dropped stream to hand the
/// callback state back. Stream teardown is synchronous in cpal, so this
/// only guards against pathological platform behavior.
const STATE_RETURN_TIMEOUT: Duration = Duration::from_secs(2);

/// One hardware MIDI event, already routed to a specific source node by
/// the midir callback's binding match.
#[derive(Debug, Clone, Copy)]
struct RoutedEvent {
    node: u16,
    msg: MidiMessage,
}

/// Per-connection routing table: which source nodes this device feeds,
/// with their per-event filters. Swapped atomically on patch switch and
/// rig edit; the midir callback's `load()` is wait-free.
type RouteTable = ArcSwap<Vec<(u16, EventFilter)>>;

/// Request a transition from the engine thread.
pub enum EngineCommand {
    Start(StartConfig),
    Stop,
    /// Push a MIDI message from a UI source (on-screen keyboard) into
    /// the active plan. Silently dropped if the engine isn't running.
    SendMidi(MidiMessage),
    /// Flush every held voice + reset all continuous controllers, on
    /// the next audio block. No-op when idle (nothing can be stuck).
    Panic,
    /// Swap the audio output in place — same plan, new stream. Replies
    /// synchronously on `reply`. (The `midi_inputs` half survives for
    /// integration tests; the UI never sends it — the rig owns the set.)
    Rebind {
        spec: RebindSpec,
        reply: Sender<Result<(), RebindError>>,
    },
    /// The rig changed (component added / removed / re-bound). Re-derive
    /// the desired device set + per-connection routes and rebind.
    UpdateRig {
        rig: Rig,
        reply: Sender<Result<(), RebindError>>,
    },
    /// Enter Learn mode: open every connected input and stream captures
    /// to the UI. Closes the performance set first (restored on stop).
    LearnStart,
    /// Leave Learn mode and restore the rig-derived input set.
    LearnStop,
    /// Internal: a learn-mode midir callback captured an event.
    LearnCaptured(LearnEvent),
    /// Reserved for graceful app shutdown — not sent today; the engine
    /// thread exits with the process and its `Drop` impls clean up.
    #[allow(dead_code)]
    Shutdown,
}

/// All the picks the UI hands the engine to bring a patch online.
///
/// The graph + rig are owned by the engine after this — the React side
/// has already cloned them from the show store before sending.
#[derive(Debug, Clone)]
pub struct StartConfig {
    pub graph: PatchGraph,
    /// The show's rig. MIDI inputs are derived from it: the union of
    /// rig-bound devices opens session-wide (#122).
    pub rig: Rig,
    /// `None` → use the host default output device.
    pub audio_output: Option<String>,
}

/// What `engine_rebind_routing` should change. `None` fields are left
/// untouched. `audio.device: null` = host default output.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RebindSpec {
    /// `Some` → switch audio output to `device` (`None` device = host
    /// default).
    pub audio: Option<AudioPick>,
    /// `Some` → make this the complete set of open hardware MIDI inputs.
    /// Test-only surface since #122 — the UI never sends it (the rig
    /// derives the set); it remains for the live-device integration
    /// tests.
    pub midi_inputs: Option<Vec<String>>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioPick {
    pub device: Option<String>,
}

/// Why a rebind failed. On any error the engine keeps (or restores) the
/// previously-active devices — the one exception is
/// `AudioOpenFailed { restored: false }`, where the original device
/// could not be reopened either and the engine has published an Error
/// status.
#[derive(Debug, Clone, Serialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum RebindError {
    NotRunning,
    AudioDeviceNotFound { name: String },
    AudioOpenFailed { message: String, restored: bool },
    MidiInputNotFound { name: String },
    MidiOpenFailed { name: String, message: String },
    TooManyMidiInputs { max: usize },
    Internal { message: String },
}

/// One decoded MIDI capture forwarded to the UI while Learn mode is
/// active, tagged with the device it arrived on. `channel` is 1-based to
/// match the rig component config vocabulary.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LearnEvent {
    pub device_id: String,
    pub device_name: String,
    pub msg: LearnMsg,
}

/// The event classes Learn understands. Everything else is dropped at
/// the callback.
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum LearnMsg {
    NoteOn { channel: u8, note: u8, velocity: u8 },
    NoteOff { channel: u8, note: u8 },
    ControlChange { channel: u8, cc: u8, value: u8 },
    PitchBend { channel: u8 },
}

impl LearnMsg {
    fn from_midi(msg: MidiMessage) -> Option<Self> {
        match msg {
            MidiMessage::NoteOn {
                channel,
                note,
                velocity,
            } => Some(LearnMsg::NoteOn {
                channel: channel + 1,
                note,
                velocity,
            }),
            MidiMessage::NoteOff { channel, note, .. } => Some(LearnMsg::NoteOff {
                channel: channel + 1,
                note,
            }),
            MidiMessage::ControlChange { channel, cc, value } => Some(LearnMsg::ControlChange {
                channel: channel + 1,
                cc,
                value,
            }),
            MidiMessage::PitchBend { channel, .. } => Some(LearnMsg::PitchBend {
                channel: channel + 1,
            }),
            _ => None,
        }
    }
}

/// Public snapshot of engine state, sent to the UI both via the
/// `engine_status` command (pull) and the `engine://status` Tauri event
/// (push, whenever it changes).
///
/// `rename_all` renames *variants* only; `rename_all_fields` is what
/// puts the Running payload's fields on the wire as camelCase (the TS
/// mirror reads `midiInputs`, `audioOutput`, …).
#[derive(Debug, Clone, Serialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum EngineStatus {
    Idle,
    Running {
        plugins: Vec<HostedPluginStatus>,
        native_nodes: NativeNodeCounts,
        /// Names of the open hardware MIDI inputs (the rig-derived set;
        /// empty while Learn mode holds the devices or nothing is bound).
        midi_inputs: Vec<String>,
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

/// Where engine status updates go. `AppHandle` in the app; a plain
/// channel in integration tests (Tauri handles can't be constructed
/// outside a running app).
pub trait StatusSink: Send + 'static {
    fn publish_status(&self, status: &EngineStatus);
    /// Learn-mode capture stream. Default no-op so test sinks that only
    /// care about status don't have to implement it.
    fn publish_learn(&self, _event: &LearnEvent) {}
}

impl StatusSink for AppHandle {
    fn publish_status(&self, status: &EngineStatus) {
        let _ = self.emit(STATUS_EVENT, status.clone());
    }

    fn publish_learn(&self, event: &LearnEvent) {
        let _ = self.emit(LEARN_EVENT, event.clone());
    }
}

impl StatusSink for Sender<EngineStatus> {
    fn publish_status(&self, status: &EngineStatus) {
        let _ = self.send(status.clone());
    }
}

/// Handle stored in Tauri state. Commands send through `tx`; status is
/// readable from `status` (atomic snapshot). Clone freely — all clones
/// talk to the same engine thread.
#[derive(Clone)]
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

    /// Synchronous rebind round-trip. Blocks the caller (run it on a
    /// blocking task, not the async runtime) until the engine thread
    /// has swapped devices or given up.
    pub fn rebind(&self, spec: RebindSpec) -> Result<(), RebindError> {
        let (reply, rx) = mpsc::channel();
        self.tx
            .send(EngineCommand::Rebind { spec, reply })
            .map_err(|_| RebindError::Internal {
                message: "engine thread is gone".into(),
            })?;
        rx.recv_timeout(Duration::from_secs(10))
            .map_err(|_| RebindError::Internal {
                message: "rebind timed out".into(),
            })?
    }

    /// Synchronous rig-update round-trip (same blocking caveat as
    /// [`EngineHandle::rebind`]). A no-op success when the engine is
    /// idle — the rig rides with the next Start.
    pub fn update_rig(&self, rig: Rig) -> Result<(), RebindError> {
        let (reply, rx) = mpsc::channel();
        self.tx
            .send(EngineCommand::UpdateRig { rig, reply })
            .map_err(|_| RebindError::Internal {
                message: "engine thread is gone".into(),
            })?;
        rx.recv_timeout(Duration::from_secs(10))
            .map_err(|_| RebindError::Internal {
                message: "rig update timed out".into(),
            })?
    }
}

/// Spin up the engine thread and return its handle. The thread lives
/// for the rest of the app process unless `EngineCommand::Shutdown` is
/// sent (which we don't do today).
pub fn spawn(app: AppHandle) -> EngineHandle {
    spawn_with_sink(app)
}

pub fn spawn_with_sink<S: StatusSink>(sink: S) -> EngineHandle {
    let (tx, rx) = mpsc::channel::<EngineCommand>();
    let status = Arc::new(Mutex::new(EngineStatus::idle()));
    let status_for_thread = status.clone();
    let tx_for_thread = tx.clone();

    thread::Builder::new()
        .name("stardust-engine".into())
        .spawn(move || run_engine(rx, tx_for_thread, status_for_thread, sink))
        .expect("failed to spawn engine thread");

    EngineHandle { tx, status }
}

fn run_engine<S: StatusSink>(
    rx: mpsc::Receiver<EngineCommand>,
    tx: Sender<EngineCommand>,
    status: Arc<Mutex<EngineStatus>>,
    sink: S,
) {
    let mut running: Option<Running> = None;
    // Learn mode holds every connected input open; `Some` also tells the
    // start path not to open performance connections.
    let mut learn_conns: Option<Vec<MidiInputHandle>> = None;

    loop {
        let next = match rx.recv_timeout(DROPPED_TICK) {
            Ok(cmd) => Some(cmd),
            Err(RecvTimeoutError::Timeout) => None,
            Err(RecvTimeoutError::Disconnected) => break,
        };

        match next {
            Some(EngineCommand::Start(cfg)) => {
                // Hand the previous Running into start(): its plan is
                // replaced, but its MIDI connections + rings survive a
                // patch switch (the open set is rig-derived, #122).
                let prev = running.take();
                match start(cfg, prev, learn_conns.is_some()) {
                    Ok(r) => {
                        let snapshot = r.status_snapshot(0);
                        publish(&status, &sink, snapshot);
                        running = Some(r);
                    }
                    Err(messages) => {
                        publish(&status, &sink, EngineStatus::Error { messages });
                    }
                }
            }
            Some(EngineCommand::Stop) => {
                drop(running.take());
                publish(&status, &sink, EngineStatus::Idle);
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
            Some(EngineCommand::Panic) => {
                if let Some(r) = running.as_ref() {
                    r.panic_flag.store(true, Ordering::Release);
                }
            }
            Some(EngineCommand::Rebind { spec, reply }) => {
                let result = match running.as_mut() {
                    None => Err(RebindError::NotRunning),
                    Some(r) => {
                        let result = r.rebind(&spec);
                        match &result {
                            Ok(()) => {
                                let snapshot = r.status_snapshot(r.dropped.load(Ordering::Relaxed));
                                publish(&status, &sink, snapshot);
                            }
                            Err(RebindError::AudioOpenFailed {
                                message,
                                restored: false,
                            }) => {
                                // Original device could not be restored
                                // either — the engine is effectively
                                // stopped. Reflect that.
                                let message = message.clone();
                                drop(running.take());
                                publish(
                                    &status,
                                    &sink,
                                    EngineStatus::Error {
                                        messages: vec![format!(
                                            "audio rebind failed and the previous device could \
                                             not be restored: {message}"
                                        )],
                                    },
                                );
                            }
                            Err(_) => {
                                // Original devices remain active; status
                                // unchanged.
                            }
                        }
                        result
                    }
                };
                let _ = reply.send(result);
            }
            Some(EngineCommand::UpdateRig { rig, reply }) => {
                let result = match running.as_mut() {
                    // Idle: nothing open; the rig rides with the next
                    // Start. Success, not NotRunning — the UI sends rig
                    // edits unconditionally.
                    None => Ok(()),
                    Some(r) => {
                        let result = if learn_conns.is_some() {
                            // Learn holds the devices; just re-derive
                            // state so LearnStop restores the new set.
                            r.adopt_rig(&rig);
                            Ok(())
                        } else {
                            r.update_rig(&rig)
                        };
                        if result.is_ok() {
                            let snapshot = r.status_snapshot(r.dropped.load(Ordering::Relaxed));
                            publish(&status, &sink, snapshot);
                        }
                        result
                    }
                };
                let _ = reply.send(result);
            }
            Some(EngineCommand::LearnStart) => {
                if learn_conns.is_none() {
                    // Close the performance set first — some platforms
                    // refuse a second open of the same device.
                    if let Some(r) = running.as_mut() {
                        r.close_all_midi();
                    }
                    learn_conns = Some(open_learn_conns(&tx));
                    if let Some(r) = running.as_ref() {
                        publish(
                            &status,
                            &sink,
                            r.status_snapshot(r.dropped.load(Ordering::Relaxed)),
                        );
                    }
                }
            }
            Some(EngineCommand::LearnStop) => {
                if learn_conns.take().is_some() {
                    if let Some(r) = running.as_mut() {
                        if let Err(e) = r.reopen_rig_inputs() {
                            tracing::warn!(error = ?e, "restoring rig inputs after Learn failed");
                        }
                        publish(
                            &status,
                            &sink,
                            r.status_snapshot(r.dropped.load(Ordering::Relaxed)),
                        );
                    }
                }
            }
            Some(EngineCommand::LearnCaptured(event)) => {
                if learn_conns.is_some() {
                    sink.publish_learn(&event);
                }
            }
            Some(EngineCommand::Shutdown) => {
                drop(running.take());
                break;
            }
            None => {
                // Idle tick: watch for device connect / disconnect (the
                // rig-derived set follows the connected set, #122) and
                // re-publish status if the dropped-event counter moved.
                if let Some(r) = running.as_mut() {
                    let mut publish_now = false;
                    if learn_conns.is_none() && r.poll_devices() {
                        publish_now = true;
                    }
                    let count = r.dropped.load(Ordering::Relaxed);
                    if count != r.last_published_dropped {
                        r.last_published_dropped = count;
                        publish_now = true;
                    }
                    if publish_now {
                        let snapshot = r.status_snapshot(r.dropped.load(Ordering::Relaxed));
                        publish(&status, &sink, snapshot);
                    }
                }
            }
        }
    }
}

fn publish<S: StatusSink>(status: &Arc<Mutex<EngineStatus>>, sink: &S, next: EngineStatus) {
    *status.lock().expect("engine status mutex poisoned") = next.clone();
    sink.publish_status(&next);
}

// =============================================================================
// Callback state + carriers
// =============================================================================

/// Everything the audio callback owns. Moves between streams on rebind.
struct CallbackState {
    plan: Plan,
    /// One consumer per potential hardware MIDI input slot. Slots
    /// without an open device are simply empty.
    hw: Vec<Consumer<RoutedEvent>>,
    ui: Consumer<MidiMessage>,
    panic: Arc<AtomicBool>,
}

/// Owns the [`CallbackState`] inside the audio callback closure. When
/// the closure is dropped (stream teardown — stop or rebind), `Drop`
/// hands the state back to the engine thread so the plan survives.
struct StateCarrier {
    state: Option<CallbackState>,
    tx: Sender<CallbackState>,
}

impl Drop for StateCarrier {
    fn drop(&mut self) {
        if let Some(state) = self.state.take() {
            let _ = self.tx.send(state);
        }
    }
}

/// Owns one slot's ring producer inside a midir input callback. When the
/// connection closes, `Drop` returns the producer to the engine thread's
/// free pool so a new device can reuse the slot.
struct ProducerCarrier {
    slot: usize,
    producer: Option<Producer<RoutedEvent>>,
    tx: Sender<(usize, Producer<RoutedEvent>)>,
}

impl Drop for ProducerCarrier {
    fn drop(&mut self) {
        if let Some(p) = self.producer.take() {
            let _ = self.tx.send((self.slot, p));
        }
    }
}

/// One open hardware MIDI connection. Its ring slot travels with the
/// [`ProducerCarrier`] inside the connection callback and returns to the
/// free pool when the connection drops. The route table is shared with
/// the callback and swapped atomically on patch switch / rig edit.
struct MidiConn {
    name: String,
    id: String,
    routes: Arc<RouteTable>,
    _handle: MidiInputHandle,
}

// =============================================================================
// Running state
// =============================================================================

/// Bundle of live resources kept while the engine is in the Running
/// state.
struct Running {
    /// `Option` so rebind can drop the stream, recover the callback
    /// state, and open a replacement. `None` only transiently inside
    /// `rebind_audio`.
    audio: Option<AudioOutputHandle>,
    audio_return_tx: Sender<CallbackState>,
    audio_return_rx: mpsc::Receiver<CallbackState>,

    midi_conns: Vec<MidiConn>,
    slot_return_tx: Sender<(usize, Producer<RoutedEvent>)>,
    slot_return_rx: mpsc::Receiver<(usize, Producer<RoutedEvent>)>,
    /// Ring producers for slots with no open device, indexed by slot.
    free_producers: Vec<Option<Producer<RoutedEvent>>>,

    /// Producer for the UI-originated MIDI ring (on-screen keyboard).
    ui_producer: Producer<MidiMessage>,

    panic_flag: Arc<AtomicBool>,
    dropped: Arc<AtomicUsize>,
    last_published_dropped: usize,

    /// The active patch graph — kept so rig edits can re-resolve source
    /// filters without a plan rebuild.
    graph: PatchGraph,
    /// Parsed rig component bindings (the session-wide device union
    /// derives from these).
    bindings: Vec<ComponentBinding>,
    /// Source filters resolved from (graph × bindings) — consulted
    /// whenever a MIDI device opens or routes are re-programmed.
    filters: Vec<SourceFilterSpec>,
    /// Connected-input snapshot from the last poll, for connect /
    /// disconnect detection on the idle tick.
    known_inputs: Vec<(String, String)>,

    plugins: Vec<HostedPluginStatus>,
    native_nodes: NativeNodeCounts,
    audio_output: String,
    use_default_output: bool,
    sample_rate: u32,
    channels: u16,
    sample_rate_mismatch: bool,
}

impl Running {
    fn status_snapshot(&self, dropped: usize) -> EngineStatus {
        EngineStatus::Running {
            plugins: self.plugins.clone(),
            native_nodes: self.native_nodes.clone(),
            midi_inputs: self.midi_conns.iter().map(|c| c.name.clone()).collect(),
            audio_output: self.audio_output.clone(),
            sample_rate: self.sample_rate,
            channels: self.channels,
            dropped_events: dropped,
            sample_rate_mismatch: self.sample_rate_mismatch,
        }
    }

    fn rebind(&mut self, spec: &RebindSpec) -> Result<(), RebindError> {
        // MIDI first: it can fail without touching the audio stream at
        // all, so a bad MIDI pick never interrupts sound.
        if let Some(desired) = &spec.midi_inputs {
            self.rebind_midi(desired)?;
        }
        if let Some(pick) = &spec.audio {
            self.rebind_audio(&pick.device)?;
        }
        Ok(())
    }

    // -------------------------------------------------------------
    // MIDI rebind: open additions before closing removals, so any
    // failure leaves the original set fully intact.
    // -------------------------------------------------------------
    fn rebind_midi(&mut self, desired: &[String]) -> Result<(), RebindError> {
        if desired.len() > MAX_MIDI_INPUTS {
            return Err(RebindError::TooManyMidiInputs {
                max: MAX_MIDI_INPUTS,
            });
        }
        let inputs = midi::list_inputs().map_err(|e| RebindError::Internal {
            message: format!("midi enumeration failed: {e}"),
        })?;

        let mut opened: Vec<MidiConn> = Vec::new();
        for name in desired {
            if self.midi_conns.iter().any(|c| &c.name == name)
                || opened.iter().any(|c| &c.name == name)
            {
                continue;
            }
            match open_midi_device(
                name,
                &inputs,
                &self.filters,
                &mut self.free_producers,
                &self.slot_return_tx,
                &self.dropped,
            ) {
                Ok(conn) => opened.push(conn),
                Err(e) => {
                    // Roll back anything we just opened; original set
                    // stays active.
                    let count = opened.len();
                    drop(opened);
                    self.reclaim_producers(count);
                    return Err(e);
                }
            }
        }

        let (keep, close): (Vec<MidiConn>, Vec<MidiConn>) = std::mem::take(&mut self.midi_conns)
            .into_iter()
            .partition(|c| desired.contains(&c.name));
        let closed = close.len();
        drop(close);
        self.reclaim_producers(closed);

        self.midi_conns = keep;
        self.midi_conns.extend(opened);
        Ok(())
    }

    /// Pull `expected` returned producers back into the free pool.
    /// Connection teardown is synchronous in midir, but don't hang the
    /// engine thread if a platform misbehaves.
    fn reclaim_producers(&mut self, expected: usize) {
        reclaim_into(&self.slot_return_rx, &mut self.free_producers, expected);
    }

    /// Close every open MIDI connection (Learn mode takes the devices).
    fn close_all_midi(&mut self) {
        let closed = self.midi_conns.len();
        self.midi_conns.clear();
        self.reclaim_producers(closed);
    }

    /// Re-open the rig-derived input set (returning from Learn mode).
    fn reopen_rig_inputs(&mut self) -> Result<(), RebindError> {
        let inputs = midi::list_inputs().map_err(|e| RebindError::Internal {
            message: format!("midi enumeration failed: {e}"),
        })?;
        let desired = desired_input_names(&self.bindings, &inputs);
        self.rebind_midi(&desired)
    }

    /// Adopt a new rig without touching connections (Learn mode holds
    /// the devices; `reopen_rig_inputs` applies it on LearnStop).
    fn adopt_rig(&mut self, rig: &Rig) {
        self.bindings = parse_rig(rig);
        self.filters = source_event_filters(&self.graph, &self.bindings);
    }

    /// The rig changed: re-resolve filters, re-program every surviving
    /// connection's route table, and rebind to the new device union.
    fn update_rig(&mut self, rig: &Rig) -> Result<(), RebindError> {
        self.adopt_rig(rig);
        let inputs = midi::list_inputs().map_err(|e| RebindError::Internal {
            message: format!("midi enumeration failed: {e}"),
        })?;
        self.reprogram_routes(&inputs);
        let desired = desired_input_names(&self.bindings, &inputs);
        self.rebind_midi(&desired)
    }

    /// Swap every open connection's route table against the current
    /// filters. Wait-free for the midir callbacks.
    fn reprogram_routes(&mut self, inputs: &[midi::MidiInputInfo]) {
        for conn in &self.midi_conns {
            conn.routes.store(Arc::new(routes_for_device(
                &self.filters,
                &conn.id,
                &conn.name,
                inputs,
            )));
        }
    }

    /// Idle-tick device watcher. Returns `true` when the open set (or
    /// route resolution) changed — the caller re-publishes status.
    fn poll_devices(&mut self) -> bool {
        let Ok(inputs) = midi::list_inputs() else {
            return false;
        };
        let snapshot: Vec<(String, String)> = inputs
            .iter()
            .map(|i| (i.id.clone(), i.name.clone()))
            .collect();
        if snapshot == self.known_inputs {
            return false;
        }
        self.known_inputs = snapshot;

        // Name-fallback resolution can shift when the connected set
        // changes, so re-program surviving connections too.
        self.reprogram_routes(&inputs);
        let desired = desired_input_names(&self.bindings, &inputs);
        if let Err(e) = self.rebind_midi(&desired) {
            tracing::warn!(error = ?e, "device-change rebind failed");
        }
        true
    }

    // -------------------------------------------------------------
    // Audio rebind: validate → drop old stream → recover the plan →
    // open new stream. On failure, reopen the original device.
    // -------------------------------------------------------------
    fn rebind_audio(&mut self, pick: &Option<String>) -> Result<(), RebindError> {
        let outputs = list_outputs().map_err(|e| RebindError::Internal {
            message: format!("audio enumeration failed: {e}"),
        })?;
        let (new_name, use_default) = match pick {
            None => {
                let default = outputs.iter().find(|o| o.is_default).ok_or_else(|| {
                    RebindError::AudioDeviceNotFound {
                        name: "(default)".into(),
                    }
                })?;
                (default.name.clone(), true)
            }
            Some(name) => {
                if !outputs.iter().any(|o| &o.name == name) {
                    return Err(RebindError::AudioDeviceNotFound { name: name.clone() });
                }
                (name.clone(), false)
            }
        };
        if new_name == self.audio_output && use_default == self.use_default_output {
            return Ok(());
        }

        let old_name = self.audio_output.clone();
        let old_default = self.use_default_output;

        drop(self.audio.take());
        let state = self.recover_state()?;

        match open_audio_stream(&new_name, use_default, state, &self.audio_return_tx) {
            Ok(handle) => {
                self.adopt_stream(handle, new_name, use_default);
                Ok(())
            }
            Err(message) => {
                // The failed open dropped its carrier; the state came
                // back. Restore the original device with it.
                let state = self
                    .recover_state()
                    .map_err(|_| RebindError::AudioOpenFailed {
                        message: message.clone(),
                        restored: false,
                    })?;
                match open_audio_stream(&old_name, old_default, state, &self.audio_return_tx) {
                    Ok(handle) => {
                        self.adopt_stream(handle, old_name, old_default);
                        Err(RebindError::AudioOpenFailed {
                            message,
                            restored: true,
                        })
                    }
                    Err(restore_message) => {
                        tracing::error!(
                            error = %restore_message,
                            "audio rebind rollback failed — engine stopping"
                        );
                        Err(RebindError::AudioOpenFailed {
                            message,
                            restored: false,
                        })
                    }
                }
            }
        }
    }

    fn recover_state(&mut self) -> Result<CallbackState, RebindError> {
        self.audio_return_rx
            .recv_timeout(STATE_RETURN_TIMEOUT)
            .map_err(|_| RebindError::Internal {
                message: "audio callback state was not returned on stream teardown".into(),
            })
    }

    fn adopt_stream(&mut self, handle: AudioOutputHandle, name: String, use_default: bool) {
        self.sample_rate = handle.spec.sample_rate;
        self.channels = handle.spec.channels;
        self.sample_rate_mismatch = handle.spec.sample_rate != SAMPLE_RATE as u32;
        if self.sample_rate_mismatch {
            tracing::warn!(
                negotiated_hz = handle.spec.sample_rate,
                activated_hz = SAMPLE_RATE as u32,
                "rebound device negotiated a different sample rate — pitches will be off \
                 until the plan is rebuilt"
            );
        }
        self.audio_output = name;
        self.use_default_output = use_default;
        self.audio = Some(handle);
    }
}

/// Pull `expected` returned producers back into a free pool (the
/// free-function form for the start path, before a `Running` exists).
fn reclaim_into(
    rx: &Receiver<(usize, Producer<RoutedEvent>)>,
    free_producers: &mut [Option<Producer<RoutedEvent>>],
    expected: usize,
) {
    for _ in 0..expected {
        match rx.recv_timeout(STATE_RETURN_TIMEOUT) {
            Ok((slot, p)) => free_producers[slot] = Some(p),
            Err(_) => {
                tracing::error!("midi slot producer was not returned on close");
                return;
            }
        }
    }
}

// =============================================================================
// Bring-up
// =============================================================================

/// Resolve the rig's bound-device union against the connected inputs:
/// port names to open, id match first, display-name fallback second.
/// Capped at [`MAX_MIDI_INPUTS`] (excess devices are logged + skipped).
fn desired_input_names(
    bindings: &[ComponentBinding],
    inputs: &[midi::MidiInputInfo],
) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    for (id, name) in rig_bound_devices(bindings) {
        let resolved = id
            .as_ref()
            .and_then(|id| inputs.iter().find(|i| &i.id == id))
            .or_else(|| {
                name.as_ref()
                    .and_then(|n| inputs.iter().find(|i| &i.name == n))
            });
        let Some(info) = resolved else {
            continue; // bound device not connected right now
        };
        if !out.contains(&info.name) {
            out.push(info.name.clone());
        }
    }
    if out.len() > MAX_MIDI_INPUTS {
        tracing::warn!(
            open = MAX_MIDI_INPUTS,
            bound = out.len(),
            "rig binds more devices than the engine can open — extra devices skipped"
        );
        out.truncate(MAX_MIDI_INPUTS);
    }
    out
}

/// Which source nodes a device feeds, per the resolved filters.
fn routes_for_device(
    filters: &[SourceFilterSpec],
    device_id: &str,
    device_name: &str,
    inputs: &[midi::MidiInputInfo],
) -> Vec<(u16, EventFilter)> {
    filters
        .iter()
        .filter(|s| {
            let id_present_elsewhere = s
                .binding
                .device_id
                .as_ref()
                .is_some_and(|bound| inputs.iter().any(|i| &i.id == bound));
            s.matches_device(device_id, device_name, id_present_elsewhere)
        })
        .map(|s| (s.node as u16, s.filter.clone()))
        .collect()
}

/// Bring a plan online. On success returns the live `Running` bundle.
/// On failure returns a list of human-readable messages so the UI can
/// render them all at once.
///
/// `prev` is the outgoing `Running` on a patch switch: its plan is
/// discarded, but its MIDI connections, SPSC rings, and UI ring are
/// reused so the rig-derived device set is never re-opened (#122).
/// `learn_active` suppresses performance connections entirely — Learn
/// mode holds the devices and `LearnStop` restores the set.
fn start(
    cfg: StartConfig,
    prev: Option<Running>,
    learn_active: bool,
) -> std::result::Result<Running, Vec<String>> {
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
    let plan = build_out.plan;
    let plugins = build_out.plugins;
    let native_nodes = plan.native_node_counts();

    // Soft errors (per-node failures that left a Silent placeholder)
    // get logged but don't prevent start.
    for err in &build_out.soft_errors {
        tracing::warn!(error = ?err, "plan-build soft error");
    }

    // -----------------------------------------------------------------
    // 3. MIDI ingress. The open set derives from the rig (union of
    //    bound devices); a previous Running donates its connections +
    //    rings so a patch switch only swaps route tables.
    // -----------------------------------------------------------------
    let bindings = parse_rig(&cfg.rig);
    let filters = source_event_filters(&cfg.graph, &bindings);
    let inputs = midi::list_inputs().map_err(|e| vec![format!("midi enumeration failed: {e}")])?;
    let desired = if learn_active {
        Vec::new()
    } else {
        desired_input_names(&bindings, &inputs)
    };

    // Recover reusable resources from the previous Running, if any.
    let reused = prev.and_then(|mut p| {
        drop(p.audio.take());
        match p.recover_state() {
            Ok(state) => Some((state, p)),
            Err(e) => {
                tracing::warn!(error = ?e, "previous engine state not recovered — fresh start");
                None
            }
        }
    });

    let (
        mut hw_consumers,
        ui_consumer,
        panic_flag,
        ui_producer,
        mut midi_conns,
        mut free_producers,
        slot_return_tx,
        slot_return_rx,
        dropped,
    ) = match reused {
        Some((state, p)) => {
            let CallbackState {
                plan: _old_plan,
                mut hw,
                mut ui,
                panic,
            } = state;
            // Drain events routed against the old plan's node indices.
            for c in hw.iter_mut() {
                while c.pop().is_ok() {}
            }
            while ui.pop().is_ok() {}
            let Running {
                midi_conns,
                free_producers,
                slot_return_tx,
                slot_return_rx,
                ui_producer,
                dropped,
                ..
            } = p;
            (
                hw,
                ui,
                panic,
                ui_producer,
                midi_conns,
                free_producers,
                slot_return_tx,
                slot_return_rx,
                dropped,
            )
        }
        None => {
            let mut free_producers: Vec<Option<Producer<RoutedEvent>>> = Vec::new();
            let mut hw_consumers: Vec<Consumer<RoutedEvent>> = Vec::new();
            for _ in 0..MAX_MIDI_INPUTS {
                let (p, c) = RingBuffer::<RoutedEvent>::new(EVENT_QUEUE);
                free_producers.push(Some(p));
                hw_consumers.push(c);
            }
            let (ui_producer, ui_consumer) = RingBuffer::<MidiMessage>::new(EVENT_QUEUE);
            let (slot_return_tx, slot_return_rx) = mpsc::channel();
            (
                hw_consumers,
                ui_consumer,
                Arc::new(AtomicBool::new(false)),
                ui_producer,
                Vec::new(),
                free_producers,
                slot_return_tx,
                slot_return_rx,
                Arc::new(AtomicUsize::new(0)),
            )
        }
    };
    // hw_consumers moves into CallbackState below; silence the "unused
    // mut" path when no draining happened.
    let _ = &mut hw_consumers;

    // Re-program surviving connections against the NEW plan's filters,
    // then diff the open set against the desired union.
    for conn in &midi_conns {
        conn.routes.store(Arc::new(routes_for_device(
            &filters, &conn.id, &conn.name, &inputs,
        )));
    }
    let (keep, close): (Vec<MidiConn>, Vec<MidiConn>) = midi_conns
        .into_iter()
        .partition(|c| desired.contains(&c.name));
    let closed = close.len();
    drop(close);
    reclaim_into(&slot_return_rx, &mut free_producers, closed);
    midi_conns = keep;

    for name in &desired {
        if midi_conns.iter().any(|c: &MidiConn| &c.name == name) {
            continue;
        }
        let conn = open_midi_device(
            name,
            &inputs,
            &filters,
            &mut free_producers,
            &slot_return_tx,
            &dropped,
        )
        .map_err(|e| vec![format_rebind_error(&e)])?;
        midi_conns.push(conn);
    }

    // -----------------------------------------------------------------
    // 4. Audio stream. The callback state (plan + ring consumers) rides
    //    in a StateCarrier so it outlives this stream (see module doc).
    // -----------------------------------------------------------------
    let (audio_return_tx, audio_return_rx) = mpsc::channel();
    let state = CallbackState {
        plan,
        hw: hw_consumers,
        ui: ui_consumer,
        panic: panic_flag.clone(),
    };
    let audio = open_audio_stream(&audio_name, use_default, state, &audio_return_tx)
        .map_err(|e| vec![format!("audio output '{audio_name}' failed: {e}")])?;

    let sample_rate = audio.spec.sample_rate;
    let channels = audio.spec.channels;
    let sample_rate_mismatch = sample_rate != SAMPLE_RATE as u32;
    if sample_rate_mismatch {
        tracing::warn!(
            negotiated_hz = sample_rate,
            activated_hz = SAMPLE_RATE as u32,
            "cpal negotiated a different sample rate — pitches will be off until we \
             wire dynamic re-activation"
        );
    }

    tracing::info!(
        plugin_count = plugins.len(),
        midi = ?desired,
        audio = %audio_name,
        sample_rate,
        channels,
        "engine: now hosting"
    );

    let known_inputs = inputs
        .iter()
        .map(|i| (i.id.clone(), i.name.clone()))
        .collect();

    Ok(Running {
        audio: Some(audio),
        audio_return_tx,
        audio_return_rx,
        midi_conns,
        slot_return_tx,
        slot_return_rx,
        free_producers,
        ui_producer,
        panic_flag,
        dropped,
        last_published_dropped: 0,
        graph: cfg.graph,
        bindings,
        filters,
        known_inputs,
        plugins,
        native_nodes,
        audio_output: audio_name,
        use_default_output: use_default,
        sample_rate,
        channels,
        sample_rate_mismatch,
    })
}

/// Open a cpal stream whose callback owns `state` via a [`StateCarrier`].
/// On failure the carrier is dropped inside cpal's error path, which
/// sends the state back on `return_tx` — callers recover it from the
/// matching receiver.
fn open_audio_stream(
    device_name: &str,
    use_default: bool,
    state: CallbackState,
    return_tx: &Sender<CallbackState>,
) -> Result<AudioOutputHandle, String> {
    let mut carrier = StateCarrier {
        state: Some(state),
        tx: return_tx.clone(),
    };
    let render = move |cpal_buf: &mut [f32], spec: &AudioSpec| {
        let Some(st) = carrier.state.as_mut() else {
            for s in cpal_buf.iter_mut() {
                *s = 0.0;
            }
            return;
        };
        for hw in st.hw.iter_mut() {
            while let Ok(ev) = hw.pop() {
                st.plan.inject_to(ev.node as usize, ev.msg);
            }
        }
        while let Ok(msg) = st.ui.pop() {
            st.plan.inject_ui(msg);
        }
        // Checked after the drains so a panic also flushes everything
        // queued up to the moment it was requested.
        if st.panic.swap(false, Ordering::AcqRel) {
            st.plan.request_panic();
        }
        st.plan.process(cpal_buf, spec);
    };

    if use_default {
        open_default_output(Some(SAMPLE_RATE as u32), render)
    } else {
        open_output(device_name, Some(SAMPLE_RATE as u32), render)
    }
    .map_err(|e| e.to_string())
}

/// Open one hardware MIDI input. The connection's callback matches every
/// event against its swappable route table and pushes routed events into
/// the slot's ring.
fn open_midi_device(
    name: &str,
    inputs: &[midi::MidiInputInfo],
    filters: &[SourceFilterSpec],
    free_producers: &mut [Option<Producer<RoutedEvent>>],
    slot_return_tx: &Sender<(usize, Producer<RoutedEvent>)>,
    dropped: &Arc<AtomicUsize>,
) -> Result<MidiConn, RebindError> {
    let info = inputs
        .iter()
        .find(|i| i.name == name)
        .ok_or_else(|| RebindError::MidiInputNotFound { name: name.into() })?;

    let routes = Arc::new(ArcSwap::from_pointee(routes_for_device(
        filters, &info.id, &info.name, inputs,
    )));
    let routes_cb = routes.clone();

    let slot =
        free_producers
            .iter()
            .position(|p| p.is_some())
            .ok_or(RebindError::TooManyMidiInputs {
                max: MAX_MIDI_INPUTS,
            })?;
    let producer = free_producers[slot].take().expect("slot checked above");
    let mut carrier = ProducerCarrier {
        slot,
        producer: Some(producer),
        tx: slot_return_tx.clone(),
    };
    let dropped = dropped.clone();

    let handle = open_input(name, move |_ts, msg| {
        if matches!(msg, MidiMessage::Other) {
            return;
        }
        let Some(producer) = carrier.producer.as_mut() else {
            return;
        };
        let table = routes_cb.load();
        for (node, filter) in table.iter() {
            if filter.accepts(msg) {
                let ev = RoutedEvent { node: *node, msg };
                if producer.push(ev).is_err() {
                    dropped.fetch_add(1, Ordering::Relaxed);
                }
            }
        }
    })
    .map_err(|e| RebindError::MidiOpenFailed {
        name: name.into(),
        message: e.to_string(),
    })?;

    Ok(MidiConn {
        name: name.into(),
        id: info.id.clone(),
        routes,
        _handle: handle,
    })
}

/// Open every connected input in Learn mode: decoded events flow back to
/// the engine thread as `LearnCaptured` commands (the midir callback
/// can't publish Tauri events itself).
fn open_learn_conns(tx: &Sender<EngineCommand>) -> Vec<MidiInputHandle> {
    let inputs = match midi::list_inputs() {
        Ok(i) => i,
        Err(e) => {
            tracing::warn!(error = %e, "learn: midi enumeration failed");
            return Vec::new();
        }
    };
    let mut handles = Vec::new();
    for info in inputs {
        let tx = tx.clone();
        let device_id = info.id.clone();
        let device_name = info.name.clone();
        match open_input(&info.name, move |_ts, msg| {
            if let Some(learn_msg) = LearnMsg::from_midi(msg) {
                let _ = tx.send(EngineCommand::LearnCaptured(LearnEvent {
                    device_id: device_id.clone(),
                    device_name: device_name.clone(),
                    msg: learn_msg,
                }));
            }
        }) {
            Ok(h) => handles.push(h),
            Err(e) => {
                tracing::warn!(device = %info.name, error = %e, "learn: input open failed");
            }
        }
    }
    handles
}

fn format_rebind_error(e: &RebindError) -> String {
    match e {
        RebindError::NotRunning => "engine is not running".into(),
        RebindError::AudioDeviceNotFound { name } => format!("audio output not found: {name}"),
        RebindError::AudioOpenFailed { message, .. } => format!("audio open failed: {message}"),
        RebindError::MidiInputNotFound { name } => format!("midi input not found: {name}"),
        RebindError::MidiOpenFailed { name, message } => {
            format!("midi input '{name}' failed: {message}")
        }
        RebindError::TooManyMidiInputs { max } => format!("too many MIDI inputs (max {max})"),
        RebindError::Internal { message } => message.clone(),
    }
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
