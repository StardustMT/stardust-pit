//! Engine thread — owns the live plugin host.
//!
//! `PluginInstance<H>` from clack-host is `!Send`, so it can't live in
//! Tauri's async command pool (which moves futures between threads).
//! Instead, one dedicated OS thread owns the plugin lifecycle for its
//! whole duration; the React UI talks to it through a `Sender` and
//! receives status updates via Tauri events.
//!
//! State machine: `Idle` → `Running` → `Idle`. One plugin at a time.
//! Mirrors `stardust-poc-host-clap` exactly — same MIDI → SPSC → audio
//! callback wiring — just wrapped behind start/stop commands and a
//! status event stream the UI subscribes to.

use anyhow::{anyhow, Result};
use serde::Serialize;
use stardust_core::audio::{
    list_outputs, open_default_output, open_output, AudioOutputHandle, AudioSpec,
};
use stardust_core::midi::{open_input, MidiInputHandle, MidiMessage};
use stardust_core::plugin::clap::{
    default_clap_search_paths, host_info, scan_paths, AudioPortBuffer, AudioPortBufferType,
    AudioPorts, EventBuffer, InputChannel, MidiEvent, NoteOffEvent, NoteOnEvent,
    Pckn, PluginAudioConfiguration, PluginEntry, PluginInstance, StardustHost,
};
use stardust_core::rt::{Producer, RingBuffer};
use std::path::PathBuf;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::mpsc::{self, RecvTimeoutError, Sender};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

// Match the POC's audio config — pulled out so the engine thread and
// the UI agree on the only sample rate we currently activate at.
const SAMPLE_RATE: f32 = 48_000.0;
const MIN_FRAMES: u32 = 32;
const MAX_FRAMES: u32 = 2048;
const EVENT_QUEUE: usize = 1024;
const STEREO_CHANNELS: u32 = 2;

const STATUS_EVENT: &str = "engine://status";
const DROPPED_TICK: Duration = Duration::from_secs(1);

/// Request a transition from the engine thread.
pub enum EngineCommand {
    Start(StartConfig),
    Stop,
    /// Push a MIDI message from a UI source (on-screen keyboard) into the
    /// active plugin. Silently dropped if the engine isn't running.
    SendMidi(MidiMessage),
    /// Reserved for graceful app shutdown — not sent today; the engine
    /// thread exits with the process and its `Drop` impls clean up.
    #[allow(dead_code)]
    Shutdown,
}

/// All the picks the UI hands the engine to bring a plugin online.
#[derive(Debug, Clone)]
pub struct StartConfig {
    pub bundle_path: PathBuf,
    pub plugin_id: String,
    /// `None` → no hardware MIDI input; engine runs UI-source only.
    pub midi_input: Option<String>,
    /// `None` → use the host default output device.
    pub audio_output: Option<String>,
}

/// Public snapshot of engine state, sent to the UI both via the
/// `engine_status` command (pull) and the `engine://status` Tauri
/// event (push, whenever it changes).
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum EngineStatus {
    Idle,
    Running {
        plugin_name: String,
        plugin_id: String,
        /// `None` when the engine is running with no hardware MIDI input;
        /// only the on-screen keyboard / UI source is feeding it.
        midi_input: Option<String>,
        audio_output: String,
        sample_rate: u32,
        channels: u16,
        dropped_events: usize,
        /// `true` when cpal negotiated a rate other than SAMPLE_RATE —
        /// pitches will be off until we wire dynamic re-activation.
        sample_rate_mismatch: bool,
    },
    Error {
        message: String,
    },
}

impl EngineStatus {
    fn idle() -> Self {
        EngineStatus::Idle
    }
}

/// Handle stored in Tauri state. Commands send through `tx`; status is
/// readable from `status` (atomic snapshot). Cloning the inner Arc is
/// cheap — Tauri commands grab a clone per invocation.
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
        self.status.lock().expect("engine status mutex poisoned").clone()
    }
}

/// Spin up the engine thread and return its handle. The thread lives
/// for the rest of the app process unless `EngineCommand::Shutdown` is
/// sent (which we don't do today — the OS reaps it on exit).
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

fn run_engine(
    rx: mpsc::Receiver<EngineCommand>,
    status: Arc<Mutex<EngineStatus>>,
    app: AppHandle,
) {
    // While running we keep the live resources here so the engine thread
    // can drop them on Stop in the right order (audio → midi → plugin →
    // entry). `started` (the audio processor) is moved into the audio
    // callback, so it implicitly dies with `audio`.
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
                // up the next plugin — don't try to overlap two.
                drop(running.take());
                match start(cfg, &app) {
                    Ok(r) => {
                        let snapshot = r.status_snapshot(0);
                        publish(&status, &app, snapshot);
                        running = Some(r);
                    }
                    Err(e) => {
                        publish(
                            &status,
                            &app,
                            EngineStatus::Error { message: e.to_string() },
                        );
                    }
                }
            }
            Some(EngineCommand::Stop) => {
                drop(running.take());
                publish(&status, &app, EngineStatus::Idle);
            }
            Some(EngineCommand::SendMidi(msg)) => {
                // On-screen keyboard / UI-originated note. Push into the
                // dedicated UI ring so the audio callback picks it up next
                // frame. Drops count against the same "events dropped"
                // counter the hardware MIDI thread uses.
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
                // Idle tick. If a plugin is running, re-publish status
                // when the dropped-event counter has moved.
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
    // Best-effort event emit. If the window is gone the snapshot is
    // still readable via the pull command, so we don't surface this.
    let _ = app.emit(STATUS_EVENT, next);
}

/// Bundle of live resources kept while the engine is in the Running
/// state. Dropping it tears the plugin down (audio first by field
/// order, then MIDI, then the plugin, then the entry).
struct Running {
    // Audio handle holds the cpal Stream + the audio processor closure
    // that captured `started`. Drop kills the stream first.
    _audio: AudioOutputHandle,
    _midi: Option<MidiInputHandle>,
    _plugin: PluginInstance<StardustHost>,
    _entry: PluginEntry,

    /// Producer for the UI-originated MIDI ring. The audio callback owns
    /// the matching consumer; the engine thread pushes here whenever a
    /// `SendMidi` command arrives. `!Sync` but only ever touched on the
    /// engine thread, so no synchronisation needed.
    ui_producer: Producer<MidiMessage>,

    dropped: Arc<AtomicUsize>,
    last_published_dropped: usize,

    plugin_name: String,
    plugin_id: String,
    midi_input: Option<String>,
    audio_output: String,
    sample_rate: u32,
    channels: u16,
    sample_rate_mismatch: bool,
}

impl Running {
    fn status_snapshot(&self, dropped: usize) -> EngineStatus {
        EngineStatus::Running {
            plugin_name: self.plugin_name.clone(),
            plugin_id: self.plugin_id.clone(),
            midi_input: self.midi_input.clone(),
            audio_output: self.audio_output.clone(),
            sample_rate: self.sample_rate,
            channels: self.channels,
            dropped_events: dropped,
            sample_rate_mismatch: self.sample_rate_mismatch,
        }
    }
}

/// Spin up audio + MIDI + plugin from a config. Returns the live
/// `Running` bundle on success; any failure here means we never
/// transitioned out of Idle.
fn start(cfg: StartConfig, _app: &AppHandle) -> Result<Running> {
    // ---------------------------------------------------------------
    // 1) Re-scan and locate the requested plugin descriptor.
    //
    // The UI hands us a bundle path + plugin id from a previous
    // `list_clap_plugins` call. We rescan and confirm the descriptor
    // still exists so we never load a stale path.
    // ---------------------------------------------------------------
    let scan = scan_paths(&default_clap_search_paths());
    let bundle = scan
        .bundles
        .iter()
        .find(|b| b.path == cfg.bundle_path)
        .ok_or_else(|| {
            anyhow!(
                "bundle no longer present on disk: {}",
                cfg.bundle_path.display()
            )
        })?;
    let descriptor = bundle
        .descriptors
        .iter()
        .find(|d| d.id == cfg.plugin_id)
        .ok_or_else(|| anyhow!("plugin id {} not in bundle", cfg.plugin_id))?;
    let plugin_name = descriptor.name.clone();
    let plugin_id = descriptor.id.clone();

    // ---------------------------------------------------------------
    // 2) Resolve audio output.
    //
    // The UI hands a device name or None (default). We look the
    // device up before loading the plugin so a missing device fails
    // fast without leaving the plugin entry open.
    // ---------------------------------------------------------------
    let outputs = list_outputs()?;
    let (audio_name, use_default) = match cfg.audio_output.as_ref() {
        None => {
            let default = outputs
                .iter()
                .find(|o| o.is_default)
                .ok_or_else(|| anyhow!("no default audio output"))?;
            (default.name.clone(), true)
        }
        Some(name) => {
            let exists = outputs.iter().any(|o| &o.name == name);
            if !exists {
                return Err(anyhow!("audio output not found: {name}"));
            }
            (name.clone(), false)
        }
    };

    // ---------------------------------------------------------------
    // 3) Load + instantiate the CLAP plugin.
    // ---------------------------------------------------------------
    let host_info = host_info();
    // SAFETY: loading any third-party CLAP dynamic library is unsafe at
    // the FFI boundary. The bundle path came from our own scanner and
    // the user picked it deliberately.
    let entry = unsafe { PluginEntry::load(&cfg.bundle_path) }
        .map_err(|e| anyhow!("failed to load .clap bundle: {e}"))?;

    let factory = entry
        .get_plugin_factory()
        .ok_or_else(|| anyhow!("bundle exposed no plugin factory"))?;
    let plugin_id_cstr = factory
        .plugin_descriptors()
        .filter_map(|d| d.id())
        .find(|cs| cs.to_string_lossy() == cfg.plugin_id)
        .ok_or_else(|| anyhow!("plugin id disappeared between scan and instantiate"))?;

    let mut plugin = PluginInstance::<StardustHost>::new(
        |_| stardust_core::plugin::clap::StardustHostShared,
        |_| (),
        &entry,
        plugin_id_cstr,
        &host_info,
    )
    .map_err(|e| anyhow!("plugin instantiation failed: {e:?}"))?;

    let config = PluginAudioConfiguration {
        sample_rate: SAMPLE_RATE as f64,
        min_frames_count: MIN_FRAMES,
        max_frames_count: MAX_FRAMES,
    };
    let stopped = plugin
        .activate(|_, _| (), config)
        .map_err(|e| anyhow!("plugin activation failed: {e:?}"))?;
    let mut started = stopped
        .start_processing()
        .map_err(|e| anyhow!("plugin failed to start processing: {e:?}"))?;

    // ---------------------------------------------------------------
    // 4) MIDI input → SPSC ring buffer (hardware + UI source).
    //
    // Two rings so the engine has two producers (midir thread for
    // hardware events, engine thread for on-screen-keyboard events)
    // without giving up rtrb's SPSC contract. Both consumers are
    // owned by the audio callback; the callback drains both each
    // frame. Hardware MIDI is optional now — the engine still runs
    // with just the UI source, useful for laptop dev / no controller.
    // ---------------------------------------------------------------
    let (mut hw_producer, mut hw_consumer) = RingBuffer::<MidiMessage>::new(EVENT_QUEUE);
    let (ui_producer, mut ui_consumer) = RingBuffer::<MidiMessage>::new(EVENT_QUEUE);
    let dropped = Arc::new(AtomicUsize::new(0));

    let midi = match cfg.midi_input.as_ref() {
        Some(name) => {
            let dropped_for_midi = dropped.clone();
            Some(open_input(name, move |_ts, msg| {
                if matches!(msg, MidiMessage::Other) {
                    return;
                }
                if hw_producer.push(msg).is_err() {
                    dropped_for_midi.fetch_add(1, Ordering::Relaxed);
                }
            })?)
        }
        None => None,
    };

    // ---------------------------------------------------------------
    // 5) Audio callback owns the plugin audio processor + buffers.
    // ---------------------------------------------------------------
    let mut input_ports = AudioPorts::with_capacity(STEREO_CHANNELS as usize, 1);
    let mut output_ports = AudioPorts::with_capacity(STEREO_CHANNELS as usize, 1);
    let mut input_l = vec![0.0f32; MAX_FRAMES as usize];
    let mut input_r = vec![0.0f32; MAX_FRAMES as usize];
    let mut output_l = vec![0.0f32; MAX_FRAMES as usize];
    let mut output_r = vec![0.0f32; MAX_FRAMES as usize];
    let mut input_events = EventBuffer::with_capacity(EVENT_QUEUE);
    let mut output_events = EventBuffer::with_capacity(EVENT_QUEUE);

    let render = move |cpal_buf: &mut [f32], spec: &AudioSpec| {
        let channels = spec.channels as usize;
        let frames = (cpal_buf.len() / channels).min(MAX_FRAMES as usize);

        input_events.clear();
        output_events.clear();
        while let Ok(msg) = hw_consumer.pop() {
            push_midi_as_clap_events(&mut input_events, msg);
        }
        while let Ok(msg) = ui_consumer.pop() {
            push_midi_as_clap_events(&mut input_events, msg);
        }

        for s in input_l[..frames].iter_mut() {
            *s = 0.0;
        }
        for s in input_r[..frames].iter_mut() {
            *s = 0.0;
        }

        let in_buffers = {
            let mut iter = [&mut input_l[..frames], &mut input_r[..frames]].into_iter();
            input_ports.with_input_buffers([AudioPortBuffer {
                latency: 0,
                channels: AudioPortBufferType::f32_input_only(std::iter::from_fn(move || {
                    iter.next().map(InputChannel::constant)
                })),
            }])
        };
        let mut out_buffers = {
            let mut iter = [&mut output_l[..frames], &mut output_r[..frames]].into_iter();
            output_ports.with_output_buffers([AudioPortBuffer {
                latency: 0,
                channels: AudioPortBufferType::f32_output_only(std::iter::from_fn(move || {
                    iter.next().map(|s| s as &mut [f32])
                })),
            }])
        };

        let in_events = input_events.as_input();
        let mut out_events = output_events.as_output();

        if let Err(e) = started.process(
            &in_buffers,
            &mut out_buffers,
            &in_events,
            &mut out_events,
            None,
            None,
        ) {
            tracing::error!(error = ?e, "plugin.process failed");
            cpal_buf.fill(0.0);
            return;
        }

        for f in 0..frames {
            let l = output_l[f];
            let r = output_r[f];
            let base = f * channels;
            if channels == 1 {
                cpal_buf[base] = (l + r) * 0.5;
            } else {
                cpal_buf[base] = l;
                cpal_buf[base + 1] = r;
                for c in 2..channels {
                    cpal_buf[base + c] = 0.0;
                }
            }
        }
        let written = frames * channels;
        if written < cpal_buf.len() {
            for s in cpal_buf[written..].iter_mut() {
                *s = 0.0;
            }
        }
    };

    let audio = if use_default {
        open_default_output(Some(SAMPLE_RATE as u32), render)?
    } else {
        open_output(&audio_name, Some(SAMPLE_RATE as u32), render)?
    };

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

    tracing::info!(
        plugin = %plugin_name,
        plugin_id = %plugin_id,
        midi = ?cfg.midi_input,
        audio = %audio_name,
        sample_rate,
        channels,
        "engine: now hosting"
    );

    Ok(Running {
        _audio: audio,
        _midi: midi,
        _plugin: plugin,
        _entry: entry,
        ui_producer,
        dropped,
        last_published_dropped: 0,
        plugin_name,
        plugin_id,
        midi_input: cfg.midi_input,
        audio_output: audio_name,
        sample_rate,
        channels,
        sample_rate_mismatch,
    })
}

fn push_midi_as_clap_events(buf: &mut EventBuffer, msg: MidiMessage) {
    match msg {
        MidiMessage::NoteOn { channel, note, velocity } => {
            let event = NoteOnEvent::new(
                0,
                Pckn::new(0u16, channel as u16, note as u16, u32::MAX),
                velocity as f64 / 127.0,
            );
            buf.push(&event);
        }
        MidiMessage::NoteOff { channel, note, velocity } => {
            let event = NoteOffEvent::new(
                0,
                Pckn::new(0u16, channel as u16, note as u16, u32::MAX),
                velocity as f64 / 127.0,
            );
            buf.push(&event);
        }
        other => {
            if let Some(bytes) = midi_message_to_bytes(other) {
                let event = MidiEvent::new(0, 0, bytes);
                buf.push(&event);
            }
        }
    }
}

fn midi_message_to_bytes(msg: MidiMessage) -> Option<[u8; 3]> {
    match msg {
        MidiMessage::ControlChange { channel, cc, value } => {
            Some([0xB0 | (channel & 0x0F), cc & 0x7F, value & 0x7F])
        }
        MidiMessage::PitchBend { channel, value } => {
            let raw = (value as i32 + 8192).clamp(0, 16383) as u16;
            let lsb = (raw & 0x7F) as u8;
            let msb = ((raw >> 7) & 0x7F) as u8;
            Some([0xE0 | (channel & 0x0F), lsb, msb])
        }
        MidiMessage::ChannelPressure { channel, value } => {
            Some([0xD0 | (channel & 0x0F), value & 0x7F, 0])
        }
        MidiMessage::PolyAftertouch { channel, note, value } => {
            Some([0xA0 | (channel & 0x0F), note & 0x7F, value & 0x7F])
        }
        MidiMessage::ProgramChange { channel, program } => {
            Some([0xC0 | (channel & 0x0F), program & 0x7F, 0])
        }
        _ => None,
    }
}

