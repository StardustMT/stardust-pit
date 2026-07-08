//! Patch graph → executable plan for the live engine.
//!
//! Per ADR-0006, this module is the boundary between the patch editor's
//! data model (`stardust_core::patch::PatchGraph`) and the realtime
//! audio thread. It runs once when a patch is brought online and
//! produces a [`Plan`] that the engine's audio callback executes block
//! by block with no further allocation.
//!
//! ## What happens at plan-build time
//!
//! 1. Composites are flattened — wires targeting `CompositeBlock` ids
//!    get rewritten to the matching `PromotedPort`'s internal endpoint.
//! 2. Each [`GraphNode`] becomes a [`PlannedNode`] runtime variant.
//!    Missing-config and failed-load plugin nodes become [`PlannedNode::Silent`]
//!    placeholders; the plan still loads.
//! 3. Audio dataflow is topologically sorted. MIDI wires are not part
//!    of the order — MIDI processors execute inline during the runtime
//!    routing pass — but they share the same per-node iteration.
//! 4. Per output-port edges are allocated as mono `f32` buffers sized
//!    to `MAX_FRAMES`. Each input port records which edge to read from.
//! 5. MIDI routing tables are built per producing node: each downstream
//!    consumer becomes a [`MidiRoute`] carrying an optional zone filter.
//! 6. Plugins load + activate; native DSP nodes (sine, EQ) construct
//!    their state.
//!
//! ## What happens per audio block
//!
//! 1. Hardware MIDI rings (already routed to a target source node by the
//!    midir callbacks, see [`SourceFilterSpec`]) and the UI ring drain
//!    into the [`Plan`]'s pending queue via [`Plan::inject_to`] /
//!    [`Plan::inject_ui`].
//! 2. If a panic was requested, note-offs for every tracked voice plus
//!    all-channel controller resets are written straight into each
//!    instrument node's inbox and the voice tracker clears.
//! 3. Pending events land in their source node's outbox.
//! 4. Nodes execute in topological order. Each consumes its inbox
//!    (events) + its input edges (audio); produces its outbox (events)
//!    + its output edges (audio).
//! 5. After each node runs, its outbox is fanned out to all consumer
//!    nodes' inboxes via the routing table, applying zone filters. The
//!    fan-out also maintains the per-instrument voice tracker.
//! 6. Sinks accumulate their input edges into the cpal interleaved
//!    output buffer.
//!
//! Every per-block step is allocation-free; everything sized for
//! `MAX_FRAMES` and `EVENT_QUEUE` is reserved at build time.

use serde::Serialize;
use stardust_core::audio::AudioSpec;
use stardust_core::dsp::{Eq, EqGains, Synth};
use stardust_core::midi::MidiMessage;
use stardust_core::patch::{
    GraphNode, NodeId, NodeKind, PatchGraph, Port, PortConfig, PortDirection, PortId, SignalKind,
    StereoChannel, Wire,
};
use stardust_core::plugin::clap::{
    AudioPortBuffer, AudioPortBufferType, AudioPorts, EventBuffer, InputChannel, MidiEvent,
    NoteOffEvent, NoteOnEvent, Pckn, PluginAudioConfiguration, PluginEntry, PluginInstance,
    StardustHost, StartedPluginAudioProcessor, default_clap_search_paths, host_info, scan_paths,
};
use std::collections::{HashMap, HashSet};
use std::path::PathBuf;

// =============================================================================
// Tunables (mirror engine.rs)
// =============================================================================

pub const SAMPLE_RATE: f32 = 48_000.0;
pub const MIN_FRAMES: u32 = 32;
pub const MAX_FRAMES: u32 = 2048;
pub const EVENT_QUEUE: usize = 1024;
pub const STEREO_CHANNELS: u32 = 2;

// =============================================================================
// Hardware MIDI routing via rig components (stardust-pit#122)
//
// Hardware identity lives on the show's rig components (schema v3); a
// source node references a component through `config.rigComponentId` and
// inherits its binding. A component's free-form config carries (per
// ADR-0004 — strong typing lives here, not in the schema):
//
// ```json
// {
//   "device": { "id": "12345" | null, "name": "Yamaha P-125" },
//   "channel": 1..16,                  // absent = any channel
//   "lowNote": 21, "highNote": 108,    // keyboard learned key range
//   "rows": 2, "cols": 8,              // pads grid
//   "padNotes": [36, 37, null, ...],   // pads learned notes (stored; per-
//                                      //   note routing consumed v0.10.0)
//   "source": { "type": "cc", "cc": 64 } // learned controller CC source
//                | { "type": "pitchBend" },
//   "ccRange": [0, 127]                // migrated v2 narrowing, still honored
// }
// ```
//
// A source node with no component (or a dangling / unbound component) is
// **silent** on the hardware path — there is no any-device fallback. The
// on-screen keyboard still reaches it via [`Plan::inject_ui`], which fans
// out by node-kind event class only.
//
// Device matching happens on the engine thread when a device is opened
// (it owns the full device list); per-event filtering happens in the
// midir callback via [`EventFilter::accepts`], so the audio thread never
// sees an event that isn't already addressed to a specific source node.
// =============================================================================

/// Device-independent per-event filter for one source node. What a source
/// accepts is the intersection of its node kind's event classes (a sustain
/// pedal is CC 64, a pitch wheel is pitch bend, …) and the optional
/// channel / note-range / CC-range narrowing from its hardware binding.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EventFilter {
    kind: NodeKind,
    /// 0-based MIDI channel; `None` = any.
    channel: Option<u8>,
    note_range: Option<(u8, u8)>,
    cc_range: Option<(u8, u8)>,
}

impl EventFilter {
    /// Does this source node want `msg`?
    pub fn accepts(&self, msg: MidiMessage) -> bool {
        if let Some(want) = self.channel {
            match message_channel(msg) {
                Some(ch) if ch == want => {}
                _ => return false,
            }
        }
        if !kind_accepts(self.kind, msg) {
            return false;
        }
        if let Some((lo, hi)) = self.note_range {
            if let MidiMessage::NoteOn { note, .. }
            | MidiMessage::NoteOff { note, .. }
            | MidiMessage::PolyAftertouch { note, .. } = msg
            {
                if note < lo || note > hi {
                    return false;
                }
            }
        }
        if let Some((lo, hi)) = self.cc_range {
            if let MidiMessage::ControlChange { cc, .. } = msg {
                if cc < lo || cc > hi {
                    return false;
                }
            }
        }
        true
    }
}

fn message_channel(msg: MidiMessage) -> Option<u8> {
    match msg {
        MidiMessage::NoteOn { channel, .. }
        | MidiMessage::NoteOff { channel, .. }
        | MidiMessage::ControlChange { channel, .. }
        | MidiMessage::PitchBend { channel, .. }
        | MidiMessage::ChannelPressure { channel, .. }
        | MidiMessage::PolyAftertouch { channel, .. }
        | MidiMessage::ProgramChange { channel, .. } => Some(channel),
        MidiMessage::Other => None,
    }
}

/// Event classes a source node kind represents. Keyboards are the full
/// performance surface (everything); dedicated controls narrow to their
/// message class so wiring a pedal next to a keyboard doesn't double
/// note events into downstream instruments.
fn kind_accepts(kind: NodeKind, msg: MidiMessage) -> bool {
    use MidiMessage as M;
    match kind {
        NodeKind::SourceKeyboard => !matches!(msg, M::Other),
        NodeKind::SourcePads => matches!(
            msg,
            M::NoteOn { .. } | M::NoteOff { .. } | M::PolyAftertouch { .. }
        ),
        NodeKind::SourceSwitch => matches!(
            msg,
            M::NoteOn { .. } | M::NoteOff { .. } | M::ControlChange { .. }
        ),
        NodeKind::SourceSustainPedal => matches!(msg, M::ControlChange { cc: 64, .. }),
        NodeKind::SourceExpressionPedal => matches!(msg, M::ControlChange { cc: 11, .. }),
        NodeKind::SourceModWheel => matches!(msg, M::ControlChange { cc: 1, .. }),
        NodeKind::SourcePitchWheel => matches!(msg, M::PitchBend { .. }),
        NodeKind::SourceKnob | NodeKind::SourceFader => matches!(msg, M::ControlChange { .. }),
        _ => false,
    }
}

/// One rig component's binding, parsed once from the show's rig so the
/// engine never re-walks raw JSON per device open.
#[derive(Debug, Clone, PartialEq)]
pub struct ComponentBinding {
    /// The component's id — what a source node's `rigComponentId` names.
    pub component_id: String,
    pub kind: NodeKind,
    /// Opaque midir port id. `None` with a `device_name` = name-only
    /// binding (id vanished or was never known).
    pub device_id: Option<String>,
    /// Display name; the fallback match key when the id isn't connected
    /// (ids are not stable on every OS).
    pub device_name: Option<String>,
    /// 0-based MIDI channel narrowing; `None` = any.
    pub channel: Option<u8>,
    /// Keyboard learned key range (inclusive note bounds).
    pub note_range: Option<(u8, u8)>,
    /// CC narrowing: a learned CC source (`[cc, cc]`) or a migrated v2
    /// `ccRange`.
    pub cc_range: Option<(u8, u8)>,
}

impl ComponentBinding {
    /// Whether the component is bound to hardware at all. Unbound
    /// components (created in Setup, never Learned) feed nothing.
    pub fn is_bound(&self) -> bool {
        self.device_id.is_some() || self.device_name.is_some()
    }

    /// Does this binding match a connected device `(id, name)`? Identity
    /// wins; the display name is only consulted when no connected device
    /// carries the bound id (`id_present_elsewhere` = the engine checked
    /// the full device list). There is no any-device case — an unbound
    /// component matches nothing.
    pub fn matches_device(&self, id: &str, name: &str, id_present_elsewhere: bool) -> bool {
        match (&self.device_id, &self.device_name) {
            (Some(bound), _) if bound == id => true,
            (Some(_), Some(n)) if !id_present_elsewhere => n == name,
            (Some(_), _) => false,
            (None, Some(n)) => n == name,
            (None, None) => false,
        }
    }
}

/// Parse every component of the show's rig into engine-consumable
/// bindings. Tolerant of malformed config (per ADR-0004 the bag is
/// free-form) — unusable fields degrade to `None`.
pub fn parse_rig(rig: &stardust_core::show::Rig) -> Vec<ComponentBinding> {
    rig.components
        .iter()
        .map(|c| {
            let cfg = c.config.as_ref().and_then(|v| v.as_object());
            let device = cfg
                .and_then(|c| c.get("device"))
                .and_then(|d| d.as_object());
            let device_id = device
                .and_then(|d| d.get("id"))
                .and_then(|v| v.as_str())
                .map(str::to_string);
            let device_name = device
                .and_then(|d| d.get("name"))
                .and_then(|v| v.as_str())
                .filter(|s| !s.is_empty())
                .map(str::to_string);
            let channel = cfg
                .and_then(|c| c.get("channel"))
                .and_then(|v| v.as_u64())
                .filter(|ch| (1..=16).contains(ch))
                .map(|ch| (ch - 1) as u8);
            let get_note = |key: &str| -> Option<u8> {
                cfg.and_then(|c| c.get(key))
                    .and_then(|v| v.as_u64())
                    .map(|n| n.min(127) as u8)
            };
            let note_range = match (get_note("lowNote"), get_note("highNote")) {
                (Some(lo), Some(hi)) => Some((lo.min(hi), lo.max(hi))),
                _ => None,
            };
            // CC narrowing: learned single-CC source wins; otherwise a
            // migrated v2 ccRange.
            let source_cc = cfg
                .and_then(|c| c.get("source"))
                .and_then(|s| s.as_object())
                .filter(|s| s.get("type").and_then(|t| t.as_str()) == Some("cc"))
                .and_then(|s| s.get("cc"))
                .and_then(|v| v.as_u64())
                .map(|cc| (cc.min(127) as u8, cc.min(127) as u8));
            let cc_range = source_cc.or_else(|| {
                let arr = cfg.and_then(|c| c.get("ccRange"))?.as_array()?;
                let lo = arr.first()?.as_u64()?.min(127) as u8;
                let hi = arr.get(1)?.as_u64()?.min(127) as u8;
                Some((lo.min(hi), lo.max(hi)))
            });
            ComponentBinding {
                component_id: c.id.as_str().to_owned(),
                kind: c.kind,
                device_id,
                device_name,
                channel,
                note_range,
                cc_range,
            }
        })
        .collect()
}

/// One source node's resolved hardware routing: which rig component's
/// device feeds it, and the per-event filter that rides into the midir
/// callback. Only nodes with a *bound* component get a spec — everything
/// else is silent on the hardware path.
#[derive(Debug, Clone)]
pub struct SourceFilterSpec {
    /// Index of the source node in `PatchGraph::nodes` (== plan index).
    pub node: usize,
    /// The component binding this node resolved to.
    pub binding: ComponentBinding,
    /// Per-event filter (kind class + channel / note / CC narrowing).
    pub filter: EventFilter,
}

impl SourceFilterSpec {
    /// See [`ComponentBinding::matches_device`].
    pub fn matches_device(&self, id: &str, name: &str, id_present_elsewhere: bool) -> bool {
        self.binding.matches_device(id, name, id_present_elsewhere)
    }
}

/// The id a source node uses to reference its rig component, if any.
pub fn node_rig_component_id(node: &GraphNode) -> Option<&str> {
    node.config
        .as_ref()
        .and_then(|c| c.get("rigComponentId"))
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
}

/// Resolve every source node against the rig: node → `rigComponentId` →
/// component binding → filter spec. Nodes that are unassigned, reference
/// a deleted component, or reference an unbound component produce no
/// spec (silent + flagged in the UI; locked in #122 refinement).
pub fn source_event_filters(
    graph: &PatchGraph,
    bindings: &[ComponentBinding],
) -> Vec<SourceFilterSpec> {
    use stardust_core::patch::NodeClass;
    let mut out = Vec::new();
    for (i, n) in graph.nodes.iter().enumerate() {
        if n.kind.class() != NodeClass::Source {
            continue;
        }
        let Some(component_id) = node_rig_component_id(n) else {
            continue;
        };
        let Some(binding) = bindings.iter().find(|b| b.component_id == component_id) else {
            continue;
        };
        if !binding.is_bound() {
            continue;
        }
        out.push(SourceFilterSpec {
            node: i,
            filter: EventFilter {
                kind: n.kind,
                channel: binding.channel,
                note_range: binding.note_range,
                cc_range: binding.cc_range,
            },
            binding: binding.clone(),
        });
    }
    out
}

/// The distinct hardware devices the rig binds, in component order. The
/// engine opens the union of these session-wide — patch switches never
/// change the open set (#122).
pub fn rig_bound_devices(bindings: &[ComponentBinding]) -> Vec<(Option<String>, Option<String>)> {
    let mut out: Vec<(Option<String>, Option<String>)> = Vec::new();
    for b in bindings {
        if !b.is_bound() {
            continue;
        }
        let key = (b.device_id.clone(), b.device_name.clone());
        if !out.contains(&key) {
            out.push(key);
        }
    }
    out
}

// =============================================================================
// Voice tracker (stardust-pit#3)
// =============================================================================

const MIDI_CHANNELS: usize = 16;

/// Active-note bitset for one instrument node: 16 channels × 128 notes.
/// Fixed 256 bytes, updated inline during MIDI fan-out — no allocation,
/// no locking, safe on the audio thread.
#[derive(Clone)]
struct VoiceBits([u128; MIDI_CHANNELS]);

impl VoiceBits {
    fn new() -> Self {
        Self([0; MIDI_CHANNELS])
    }

    fn observe(&mut self, msg: MidiMessage) {
        match msg {
            MidiMessage::NoteOn { channel, note, .. } => {
                self.0[(channel & 0x0F) as usize] |= 1u128 << (note & 0x7F);
            }
            MidiMessage::NoteOff { channel, note, .. } => {
                self.0[(channel & 0x0F) as usize] &= !(1u128 << (note & 0x7F));
            }
            _ => {}
        }
    }

    fn count(&self) -> usize {
        self.0.iter().map(|c| c.count_ones() as usize).sum()
    }

    fn clear(&mut self) {
        self.0 = [0; MIDI_CHANNELS];
    }
}

// =============================================================================
// Plan build errors
// =============================================================================

/// Per-node / per-graph problems detected while building a [`Plan`]. The
/// builder collects every error it can find before returning — the UI
/// can render the whole set so the user fixes them in one pass.
///
/// "Soft" issues (a plugin node with no plugin chosen, a dangling input
/// port) are *not* errors. Those silently produce a [`PlannedNode::Silent`]
/// or a zero-fill at the consumer side.
#[derive(Debug, Clone, Serialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum PlanBuildError {
    AudioCycle { involved_nodes: Vec<String> },
    UnknownWireEndpoint { wire: String, side: &'static str },
    DanglingCompositePort { composite: String, port: String },
    PluginLoadFailed { node: String, message: String },
    PluginActivationFailed { node: String, message: String },
    EqConfigInvalid { node: String, message: String },
    TransposeConfigInvalid { node: String, message: String },
}

// =============================================================================
// Plan
// =============================================================================

type NodeIndex = usize;
type EdgeId = usize;

/// Routing description for one outbound MIDI wire.
#[derive(Debug, Clone)]
struct MidiRoute {
    target: NodeIndex,
    /// Some((from, to)) drops events whose note is outside `from..=to`.
    /// Non-note events (CC, pitch bend) pass through unfiltered.
    zone: Option<(u8, u8)>,
}

/// Per-node routing tables. Audio I/O is by edge id; MIDI by route list.
#[derive(Debug, Default)]
struct NodeRoutes {
    /// Edge to read for each input port that participates in audio
    /// dataflow, in the order the node expects them. `None` = silent
    /// input (no wire connected). Source / instrument nodes that have
    /// no audio inputs have an empty list.
    audio_inputs: Vec<Option<EdgeId>>,
    /// Edge written for each audio output port, in node's port order.
    /// Empty for nodes with no audio outs (sources, sinks).
    audio_outputs: Vec<EdgeId>,
    /// Fan-out to consumer nodes' inboxes for MIDI events this node produces.
    midi_routes: Vec<MidiRoute>,
}

/// One inbox + outbox of MIDI events for a node, kept parallel to the
/// node runtime vec so the per-block routing pass can borrow inboxes
/// disjointly from runtimes.
#[derive(Debug)]
struct MidiBox {
    inbox: Vec<MidiMessage>,
    outbox: Vec<MidiMessage>,
}

impl MidiBox {
    fn new() -> Self {
        Self {
            inbox: Vec::with_capacity(EVENT_QUEUE),
            outbox: Vec::with_capacity(EVENT_QUEUE),
        }
    }
}

/// Stereo mono pair for one logical audio edge. We use mono-per-channel
/// rather than a single interleaved buffer so plugins and DSP nodes
/// match clack-host's expected channel layout.
struct StereoEdge {
    l: Vec<f32>,
    r: Vec<f32>,
}

impl StereoEdge {
    fn zero() -> Self {
        Self {
            l: vec![0.0; MAX_FRAMES as usize],
            r: vec![0.0; MAX_FRAMES as usize],
        }
    }

    fn fill_silence(&mut self, frames: usize) {
        for s in self.l[..frames].iter_mut() {
            *s = 0.0;
        }
        for s in self.r[..frames].iter_mut() {
            *s = 0.0;
        }
    }
}

/// Per-plugin scratch space. CLAP wants its buffers allocated upfront;
/// we hold all of them per plugin so process() never allocates.
struct PluginRuntime {
    started: StartedPluginAudioProcessor<StardustHost>,
    input_ports: AudioPorts,
    output_ports: AudioPorts,
    input_l: Vec<f32>,
    input_r: Vec<f32>,
    in_events: EventBuffer,
    out_events: EventBuffer,
    /// Edge ids for L / R outputs. We render into these directly so the
    /// downstream node can read them without copying.
    out_l_edge: EdgeId,
    out_r_edge: EdgeId,
    /// Friendly identity for status reporting.
    name: String,
    id: String,
    vendor: String,
}

/// Built-in test-tone synth runtime (used when a node's kind is
/// `instrument.testtone`). The DSP under the hood is the same polyphonic
/// sine voice used for the engine self-test diagnostic; it is no longer
/// surfaced in the user-facing patch palette.
struct TestToneRuntime {
    synth: Synth,
    /// Edges this node writes its stereo output into.
    out_l_edge: EdgeId,
    out_r_edge: EdgeId,
    /// Scratch for rendering interleaved-stereo then deinterleaving into
    /// the L/R edges. Sized for `MAX_FRAMES * 2`.
    scratch: Vec<f32>,
}

/// 3-band stereo EQ runtime.
struct EqRuntime {
    eq: Eq,
    in_l_edge: Option<EdgeId>,
    in_r_edge: Option<EdgeId>,
    out_l_edge: EdgeId,
    out_r_edge: EdgeId,
    /// Per-block scratch — we copy from input edges into here, process
    /// in place, then copy out to the output edges. Lets us avoid
    /// simultaneous read/write borrows on the edges Vec.
    scratch_l: Vec<f32>,
    scratch_r: Vec<f32>,
}

/// audio.mix runtime. Sums N stereo input pairs into one stereo output.
/// Input ports come in pairs `(in-N-l, in-N-r)`; we store them as paired
/// edges to keep summation simple.
struct AudioMixRuntime {
    /// Vec of (L edge, R edge) pairs. Each pair sums into the output.
    /// An unconnected input becomes (None, None) and contributes silence.
    inputs: Vec<(Option<EdgeId>, Option<EdgeId>)>,
    out_l_edge: EdgeId,
    out_r_edge: EdgeId,
    /// Per-block accumulator. We sum all inputs into here (immut-borrow
    /// of the edges Vec), then copy into the output edges (mut-borrow).
    scratch_l: Vec<f32>,
    scratch_r: Vec<f32>,
}

/// sink.main-out runtime. Sums its stereo input into the cpal buffer.
struct SinkRuntime {
    in_l_edge: Option<EdgeId>,
    in_r_edge: Option<EdgeId>,
}

/// Per-node runtime state — the engine iterates a Vec of these in
/// topological order each audio block.
enum PlannedNode {
    /// Plain source (keyboard, sustain, pads, etc.). Produces MIDI from
    /// the hardware/UI ingress; no audio I/O of its own.
    Source,
    /// MIDI transpose. Shifts every note-on/off by `semitones`.
    MidiTranspose {
        semitones: i32,
    },
    /// MIDI mix is a routing-only node — its inbox already aggregates
    /// every upstream wire; it copies inbox → outbox unchanged.
    MidiMix,
    Plugin(PluginRuntime),
    TestTone(TestToneRuntime),
    Eq(EqRuntime),
    AudioMix(AudioMixRuntime),
    Sink(SinkRuntime),
    /// Placeholder for a node we couldn't bring online (missing config,
    /// load failure). It consumes its inbox and produces nothing.
    Silent,
}

/// Status snapshot for one hosted plugin. Forwarded to the UI via
/// `EngineStatus::Running.plugins`.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HostedPluginStatus {
    pub name: String,
    pub id: String,
    pub vendor: String,
}

/// Counts of native DSP nodes in a running plan — surfaced to the UI as
/// a summary so the user can see at a glance "this patch has 2 plugins,
/// 1 testtone, 1 EQ, 2 audio mixers, 1 transpose, 0 midi mixers".
#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeNodeCounts {
    pub test_tone: usize,
    pub eq: usize,
    pub audio_mix: usize,
    pub midi_transpose: usize,
    pub midi_mix: usize,
}

/// Executable engine plan. Owned by the engine thread; moved into the
/// cpal audio callback closure where `process` is called per block.
pub struct Plan {
    nodes: Vec<PlannedNode>,
    routes: Vec<NodeRoutes>,
    midi_boxes: Vec<MidiBox>,
    edges: Vec<StereoEdge>,
    /// Iteration order — every node appears exactly once. For audio
    /// dataflow this is a true topological sort; MIDI processors land
    /// in the same order (they don't need a separate one in v0.8b
    /// because MIDI routing happens post-process per node).
    topo: Vec<NodeIndex>,
    /// Indices of every `sink.main-out` node. The runtime sums their
    /// input edges into the cpal interleaved output.
    sinks: Vec<NodeIndex>,
    /// Per-block scratch for MIDI distribution — outbox events copy in
    /// here once so route fan-out can mutate other nodes' inboxes
    /// without a self-borrow.
    distribute_scratch: Vec<MidiMessage>,
    /// Events injected since the last block (hardware, already routed to
    /// a source node by the midir callback; UI, fanned out by
    /// [`Plan::inject_ui`]). Drained into source outboxes at the top of
    /// `process`. Capacity-bounded; overflow drops the event.
    pending: Vec<(NodeIndex, MidiMessage)>,
    /// Set by [`Plan::request_panic`]; consumed at the top of the next
    /// `process` call.
    panic_requested: bool,
    /// Per-node voice tracker — `Some` for instrument nodes (plugin /
    /// testtone), `None` otherwise. Maintained during MIDI fan-out.
    voices: Vec<Option<VoiceBits>>,
    /// Device-agnostic event filters for every source node, used to fan
    /// UI-originated events (on-screen keyboard) out to matching sources.
    ui_filters: Vec<(NodeIndex, EventFilter)>,
}

impl Plan {
    /// Build a plan from a patch graph. Returns the plan + a list of
    /// hosted plugins (for status) on success. On failure returns every
    /// plan-build error found.
    pub fn build(graph: &PatchGraph) -> Result<PlanBuildOutput, Vec<PlanBuildError>> {
        let mut errors: Vec<PlanBuildError> = Vec::new();
        let flat = flatten_composites(graph, &mut errors);
        let mut builder = PlanBuilder::new(&flat);
        builder.resolve_node_ids();
        builder.build_edges_and_audio_routes(&flat, &mut errors);
        builder.build_midi_routes(&flat, &mut errors);
        if let Err(cycle) = builder.topo_sort(&flat) {
            errors.push(cycle);
        }
        builder.instantiate_nodes(&flat, &mut errors);

        if !errors.is_empty() && builder.has_fatal(&errors) {
            return Err(errors);
        }

        // Soft errors (plugin load failed on a node we then mark Silent)
        // get reported alongside the successful plan.
        Ok(PlanBuildOutput {
            plan: builder.into_plan(),
            soft_errors: errors,
            plugins: Vec::new(), // filled in below
        })
        .map(|mut out| {
            for node in &out.plan.nodes {
                if let PlannedNode::Plugin(p) = node {
                    out.plugins.push(HostedPluginStatus {
                        name: p.name.clone(),
                        id: p.id.clone(),
                        vendor: p.vendor.clone(),
                    });
                }
            }
            out
        })
    }

    /// Counts of every native node kind. Cheap; used for status reporting.
    pub fn native_node_counts(&self) -> NativeNodeCounts {
        let mut c = NativeNodeCounts::default();
        for n in &self.nodes {
            match n {
                PlannedNode::TestTone(_) => c.test_tone += 1,
                PlannedNode::Eq(_) => c.eq += 1,
                PlannedNode::AudioMix(_) => c.audio_mix += 1,
                PlannedNode::MidiTranspose { .. } => c.midi_transpose += 1,
                PlannedNode::MidiMix => c.midi_mix += 1,
                _ => {}
            }
        }
        c
    }

    /// Inject one MIDI event addressed to a specific source node. The
    /// hardware path: the midir callback already matched the event
    /// against the source's binding + filter, so this just queues it.
    /// Bounded by the pending queue's capacity — overflow drops.
    pub fn inject_to(&mut self, node: NodeIndex, msg: MidiMessage) {
        if node < self.nodes.len() && self.pending.len() < self.pending.capacity() {
            self.pending.push((node, msg));
        }
    }

    /// Inject one UI-originated MIDI event (on-screen keyboard). Fans
    /// out to every source node whose event filter accepts it — device
    /// bindings are ignored, since the on-screen keyboard is a stand-in
    /// for whatever hardware the source represents.
    pub fn inject_ui(&mut self, msg: MidiMessage) {
        for k in 0..self.ui_filters.len() {
            let (node, ref filter) = self.ui_filters[k];
            if filter.accepts(msg) {
                if self.pending.len() >= self.pending.capacity() {
                    return;
                }
                self.pending.push((node, msg));
            }
        }
    }

    /// Request a panic: the next `process` call flushes every tracked
    /// voice with explicit note-offs and resets every continuous
    /// controller the engine touches, on all 16 channels, before any
    /// other event dispatch. Events queued before the panic are dropped.
    /// Safe to call repeatedly — a panic with nothing tracked only
    /// re-sends the controller resets.
    pub fn request_panic(&mut self) {
        self.pending.clear();
        self.panic_requested = true;
    }

    /// Total notes currently held across every instrument node, per the
    /// voice tracker. Diagnostic / test surface — not used per block.
    #[allow(dead_code)]
    pub fn active_voice_count(&self) -> usize {
        self.voices.iter().flatten().map(VoiceBits::count).sum()
    }

    /// Held-note count for one node (0 for non-instruments). Diagnostic /
    /// test surface.
    #[allow(dead_code)]
    pub fn active_voices_for(&self, node: NodeIndex) -> usize {
        self.voices
            .get(node)
            .and_then(Option::as_ref)
            .map_or(0, VoiceBits::count)
    }

    /// Write panic traffic straight into every instrument node's inbox:
    /// sustain-off first (so the following note-offs actually release),
    /// then a note-off + poly-aftertouch-clear per tracked voice, then
    /// all-notes-off and the remaining controller resets on every
    /// channel. Allocation-free: inboxes are pre-sized to EVENT_QUEUE
    /// and the panic burst is 16×5 controller events + 2 per held note.
    fn dispatch_panic(&mut self) {
        for (idx, slot) in self.voices.iter_mut().enumerate() {
            let Some(bits) = slot else { continue };
            let inbox = &mut self.midi_boxes[idx].inbox;
            for ch in 0..MIDI_CHANNELS as u8 {
                inbox.push(MidiMessage::ControlChange {
                    channel: ch,
                    cc: 64,
                    value: 0,
                });
            }
            for ch in 0..MIDI_CHANNELS {
                let mut held = bits.0[ch];
                while held != 0 {
                    let note = held.trailing_zeros() as u8;
                    held &= held - 1;
                    inbox.push(MidiMessage::NoteOff {
                        channel: ch as u8,
                        note,
                        velocity: 0,
                    });
                    inbox.push(MidiMessage::PolyAftertouch {
                        channel: ch as u8,
                        note,
                        value: 0,
                    });
                }
            }
            for ch in 0..MIDI_CHANNELS as u8 {
                inbox.push(MidiMessage::ControlChange {
                    channel: ch,
                    cc: 123,
                    value: 0,
                });
                inbox.push(MidiMessage::PitchBend {
                    channel: ch,
                    value: 0,
                });
                inbox.push(MidiMessage::ControlChange {
                    channel: ch,
                    cc: 1,
                    value: 0,
                });
                inbox.push(MidiMessage::ChannelPressure {
                    channel: ch,
                    value: 0,
                });
            }
            bits.clear();
        }
    }

    /// Run one audio block. Writes interleaved stereo (or mono) samples
    /// into `cpal_buf` and consumes any queued MIDI events.
    ///
    /// Allocation-free if the plan was built with the expected
    /// `MAX_FRAMES` / `EVENT_QUEUE` caps and the caller's buffer fits.
    pub fn process(&mut self, cpal_buf: &mut [f32], spec: &AudioSpec) {
        let channels = spec.channels as usize;
        let frames = (cpal_buf.len() / channels).min(MAX_FRAMES as usize);

        // -------------------------------------------------------------
        // 1. Per-block reset. Every box clears — injected events live in
        //    `pending` until step 1c, so nothing is lost. (v0.8b kept the
        //    hw-target outbox across blocks instead, which re-distributed
        //    every event on every subsequent block — latent bug fixed as
        //    part of the #2 routing rework.)
        // -------------------------------------------------------------
        for mb in self.midi_boxes.iter_mut() {
            mb.inbox.clear();
            mb.outbox.clear();
        }

        // Zero every edge so unconnected inputs read silence and
        // mix-with-zero summation is correct.
        for edge in &mut self.edges {
            edge.fill_silence(frames);
        }

        // -------------------------------------------------------------
        // 1b. Panic, if requested: flush tracked voices + reset every
        //     controller, straight into instrument inboxes so it lands
        //     within this block regardless of graph topology.
        // -------------------------------------------------------------
        if self.panic_requested {
            self.panic_requested = false;
            self.dispatch_panic();
        }

        // -------------------------------------------------------------
        // 1c. Deliver injected events into their source node's outbox —
        //     the source has no transform to apply, so its outbox IS the
        //     post-process queue that step 2 fans out to consumers.
        // -------------------------------------------------------------
        for k in 0..self.pending.len() {
            let (node, msg) = self.pending[k];
            self.midi_boxes[node].outbox.push(msg);
        }
        self.pending.clear();

        // -------------------------------------------------------------
        // 2. Iterate nodes in topo order.
        //
        // For each node:
        //   (a) Pre-process: MIDI-mix copies inbox -> outbox; transpose
        //       transforms inbox -> outbox; instruments consume inbox.
        //   (b) Audio process: plugin / sine / eq / mix / sink work.
        //   (c) Post-process MIDI distribution: outbox -> each route's
        //       target inbox, applying zone filters.
        // -------------------------------------------------------------
        for step in 0..self.topo.len() {
            let idx = self.topo[step];

            // ------- (a) MIDI pre-process / audio process per kind ----
            //
            // We split_at_mut around `idx` so we can mutate the node
            // and other state (edges, midi_boxes) in disjoint borrows.
            match &mut self.nodes[idx] {
                PlannedNode::Source | PlannedNode::Silent => {
                    // Sources: outbox already populated (target) or
                    // empty (other sources, no controller). Nothing to
                    // do for the audio side.
                    //
                    // Silent: consumes its inbox and produces nothing.
                }
                PlannedNode::MidiTranspose { semitones } => {
                    let semis = *semitones;
                    let (inbox, outbox) = {
                        let mb = &mut self.midi_boxes[idx];
                        (&mb.inbox, &mut mb.outbox)
                    };
                    for &msg in inbox {
                        outbox.push(transpose_message(msg, semis));
                    }
                }
                PlannedNode::MidiMix => {
                    let mb = &mut self.midi_boxes[idx];
                    // Drain inbox into outbox by swap to avoid a copy.
                    std::mem::swap(&mut mb.inbox, &mut mb.outbox);
                }
                PlannedNode::Plugin(p) => {
                    process_plugin(p, &self.midi_boxes[idx], &mut self.edges, frames);
                }
                PlannedNode::TestTone(s) => {
                    process_test_tone(s, &self.midi_boxes[idx], &mut self.edges, frames);
                }
                PlannedNode::Eq(e) => {
                    process_eq(e, &mut self.edges, frames);
                }
                PlannedNode::AudioMix(m) => {
                    process_audio_mix(m, &mut self.edges, frames);
                }
                PlannedNode::Sink(_) => {
                    // Sinks are handled in step 3 below — they read
                    // edges and write into cpal_buf, not into edges.
                }
            }

            // ------- (b) Distribute outbox to route targets ----------
            //
            // We do this AFTER process so an instrument's process can
            // consume its inbox (already populated by upstream nodes).
            // Sources / processors fill their outbox here, which then
            // populates downstream consumers' inboxes for later topo
            // steps.
            let routes = &self.routes[idx];
            if !routes.midi_routes.is_empty() {
                // Copy outbox into scratch so we can mutate other
                // inboxes without a self-borrow conflict.
                self.distribute_scratch.clear();
                self.distribute_scratch
                    .extend_from_slice(&self.midi_boxes[idx].outbox);
                for route in &routes.midi_routes {
                    let target = route.target;
                    let tracker = &mut self.voices[target];
                    let inbox = &mut self.midi_boxes[target].inbox;
                    for &msg in &self.distribute_scratch {
                        if route.zone.is_none_or(|z| zone_passes(z, msg)) {
                            if let Some(bits) = tracker {
                                bits.observe(msg);
                            }
                            inbox.push(msg);
                        }
                    }
                }
            }
        }

        // -------------------------------------------------------------
        // 3. Mix every sink's input edges into the cpal output buffer.
        //
        // Multiple sinks sum into the same output (rare, but defined).
        // Zero the buffer first so we're not adding to whatever was
        // left from a previous call.
        // -------------------------------------------------------------
        for s in cpal_buf.iter_mut() {
            *s = 0.0;
        }
        for &sink_idx in &self.sinks {
            if let PlannedNode::Sink(sink) = &self.nodes[sink_idx] {
                let l_edge = sink.in_l_edge;
                let r_edge = sink.in_r_edge;
                for f in 0..frames {
                    let l = l_edge.map(|e| self.edges[e].l[f]).unwrap_or(0.0);
                    let r = r_edge.map(|e| self.edges[e].r[f]).unwrap_or(0.0);
                    let base = f * channels;
                    if channels == 1 {
                        cpal_buf[base] += (l + r) * 0.5;
                    } else {
                        cpal_buf[base] += l;
                        cpal_buf[base + 1] += r;
                    }
                }
            }
        }
    }
}

/// Output of [`Plan::build`].
pub struct PlanBuildOutput {
    pub plan: Plan,
    pub soft_errors: Vec<PlanBuildError>,
    pub plugins: Vec<HostedPluginStatus>,
}

// =============================================================================
// Composite flattening
// =============================================================================

/// A `PatchGraph` with every composite rewritten away — wires referencing
/// composite ids/promoted ports are rewritten to the underlying internal
/// `(node, port)` endpoints, and the `composites` field is left empty.
struct FlatGraph {
    nodes: Vec<GraphNode>,
    wires: Vec<Wire>,
}

fn flatten_composites(graph: &PatchGraph, errors: &mut Vec<PlanBuildError>) -> FlatGraph {
    // Map composite_id + promoted_port_id -> (internal_node_id, internal_port_id).
    let mut promoted: HashMap<(String, String), (NodeId, PortId)> = HashMap::new();
    for c in &graph.composites {
        for p in &c.promoted_ports {
            promoted.insert(
                (c.id.to_string(), p.id.to_string()),
                (p.internal_node.clone(), p.internal_port.clone()),
            );
        }
    }

    let composite_ids: HashSet<String> =
        graph.composites.iter().map(|c| c.id.to_string()).collect();

    let mut wires = Vec::with_capacity(graph.wires.len());
    for w in &graph.wires {
        let from_is_composite = composite_ids.contains(w.from_node.as_str());
        let to_is_composite = composite_ids.contains(w.to_node.as_str());
        let mut rewritten = w.clone();

        if from_is_composite {
            match promoted.get(&(w.from_node.to_string(), w.from_port.to_string())) {
                Some((node, port)) => {
                    rewritten.from_node = node.clone();
                    rewritten.from_port = port.clone();
                }
                None => {
                    errors.push(PlanBuildError::DanglingCompositePort {
                        composite: w.from_node.to_string(),
                        port: w.from_port.to_string(),
                    });
                    continue;
                }
            }
        }
        if to_is_composite {
            match promoted.get(&(w.to_node.to_string(), w.to_port.to_string())) {
                Some((node, port)) => {
                    rewritten.to_node = node.clone();
                    rewritten.to_port = port.clone();
                }
                None => {
                    errors.push(PlanBuildError::DanglingCompositePort {
                        composite: w.to_node.to_string(),
                        port: w.to_port.to_string(),
                    });
                    continue;
                }
            }
        }
        wires.push(rewritten);
    }

    FlatGraph {
        nodes: graph.nodes.clone(),
        wires,
    }
}

// =============================================================================
// PlanBuilder — accumulates partial state during build
// =============================================================================

struct PlanBuilder {
    /// One slot per node in the flat graph, in input order.
    node_index: HashMap<String, NodeIndex>,
    nodes: Vec<PlannedNode>,
    routes: Vec<NodeRoutes>,
    edges: Vec<StereoEdge>,
    /// Per-node, per-output-port edge ids for L/R if stereo. The output
    /// edge is determined by the port's stereo-channel config.
    /// Map: (node_idx, port_id) -> edge_id.
    output_port_edge: HashMap<(NodeIndex, String), EdgeId>,
    topo: Vec<NodeIndex>,
    sinks: Vec<NodeIndex>,
    voices: Vec<Option<VoiceBits>>,
    ui_filters: Vec<(NodeIndex, EventFilter)>,
}

impl PlanBuilder {
    fn new(graph: &FlatGraph) -> Self {
        let n = graph.nodes.len();
        Self {
            node_index: HashMap::with_capacity(n),
            nodes: Vec::with_capacity(n),
            routes: Vec::with_capacity(n),
            edges: Vec::new(),
            output_port_edge: HashMap::new(),
            topo: Vec::with_capacity(n),
            sinks: Vec::new(),
            voices: Vec::with_capacity(n),
            ui_filters: Vec::new(),
        }
    }

    fn resolve_node_ids(&mut self) {
        // Populated alongside instantiate_nodes; we keep node_index in
        // sync with the nodes Vec as we push.
    }

    fn build_edges_and_audio_routes(
        &mut self,
        graph: &FlatGraph,
        _errors: &mut Vec<PlanBuildError>,
    ) {
        // First pass: register every node's index AND pre-allocate
        // routes / edges per audio output port. We have to do this
        // before resolving wires because wires reference nodes by id.
        for (i, n) in graph.nodes.iter().enumerate() {
            self.node_index.insert(n.id.to_string(), i);
            self.routes.push(NodeRoutes::default());

            // Allocate one edge per audio output port for this node.
            for p in &n.ports {
                if p.signal == SignalKind::Audio && p.direction == PortDirection::Out {
                    let edge_id = self.edges.len();
                    self.edges.push(StereoEdge::zero());
                    self.output_port_edge.insert((i, p.id.to_string()), edge_id);
                    self.routes[i].audio_outputs.push(edge_id);
                }
            }
        }

        // Second pass: for every audio input port, walk the wires to
        // find the producer and record the edge id.
        for (i, n) in graph.nodes.iter().enumerate() {
            for p in &n.ports {
                if p.signal != SignalKind::Audio || p.direction != PortDirection::In {
                    continue;
                }
                // Find the wire(s) feeding this input port.
                let feeding = graph.wires.iter().find(|w| {
                    w.to_node.as_str() == n.id.as_str() && w.to_port.as_str() == p.id.as_str()
                });
                let edge = feeding.and_then(|w| {
                    let producer = self.node_index.get(w.from_node.as_str())?;
                    self.output_port_edge
                        .get(&(*producer, w.from_port.to_string()))
                        .copied()
                });
                self.routes[i].audio_inputs.push(edge);
            }
        }
    }

    fn build_midi_routes(&mut self, graph: &FlatGraph, errors: &mut Vec<PlanBuildError>) {
        for w in &graph.wires {
            let from_idx = match self.node_index.get(w.from_node.as_str()) {
                Some(i) => *i,
                None => {
                    errors.push(PlanBuildError::UnknownWireEndpoint {
                        wire: w.id.to_string(),
                        side: "from",
                    });
                    continue;
                }
            };
            let to_idx = match self.node_index.get(w.to_node.as_str()) {
                Some(i) => *i,
                None => {
                    errors.push(PlanBuildError::UnknownWireEndpoint {
                        wire: w.id.to_string(),
                        side: "to",
                    });
                    continue;
                }
            };

            // Only MIDI wires become MIDI routes.
            let from_node = &graph.nodes[from_idx];
            let from_port = match from_node.find_port(&w.from_port) {
                Some(p) => p,
                None => continue,
            };
            if from_port.signal != SignalKind::Midi {
                continue;
            }

            let zone = zone_filter(from_port);
            self.routes[from_idx].midi_routes.push(MidiRoute {
                target: to_idx,
                zone,
            });
        }
    }

    fn topo_sort(&mut self, graph: &FlatGraph) -> Result<(), PlanBuildError> {
        // Kahn over audio wires only. Source / instrument / fx / sink
        // form the DAG. MIDI processors don't need to participate
        // because their per-block routing happens after each node runs;
        // we just need them to appear in the iteration so they execute.
        //
        // We mix MIDI-only nodes into the topo at the end (they have no
        // audio constraints; running them later doesn't change semantics
        // since their MIDI distribution is a separate post-step).
        let n = graph.nodes.len();
        let mut in_degree = vec![0usize; n];
        let mut adj: Vec<Vec<NodeIndex>> = vec![Vec::new(); n];

        for w in &graph.wires {
            let from = match self.node_index.get(w.from_node.as_str()) {
                Some(i) => *i,
                None => continue,
            };
            let to = match self.node_index.get(w.to_node.as_str()) {
                Some(i) => *i,
                None => continue,
            };
            // Only audio wires constrain the order.
            let from_port = match graph.nodes[from].find_port(&w.from_port) {
                Some(p) => p,
                None => continue,
            };
            if from_port.signal != SignalKind::Audio {
                continue;
            }
            adj[from].push(to);
            in_degree[to] += 1;
        }

        let mut queue: Vec<NodeIndex> = (0..n).filter(|&i| in_degree[i] == 0).collect();
        let mut order: Vec<NodeIndex> = Vec::with_capacity(n);
        while let Some(idx) = queue.pop() {
            order.push(idx);
            for &dst in &adj[idx] {
                in_degree[dst] -= 1;
                if in_degree[dst] == 0 {
                    queue.push(dst);
                }
            }
        }

        if order.len() < n {
            let involved: Vec<String> = (0..n)
                .filter(|i| in_degree[*i] > 0)
                .map(|i| graph.nodes[i].name.clone())
                .collect();
            return Err(PlanBuildError::AudioCycle {
                involved_nodes: involved,
            });
        }

        // MIDI sources have no audio wires, so Kahn can land them anywhere.
        // For correct per-block MIDI delivery we need every source.* to run
        // before any node that might consume its MIDI in the same block —
        // otherwise the distributed events end up in the target's inbox
        // *after* the target has already processed, and get cleared on the
        // next block's reset. Stable-partition keeps the audio DAG order
        // intact and just lifts sources to the front.
        order.sort_by_key(|&i| {
            !matches!(
                graph.nodes[i].kind.class(),
                stardust_core::patch::NodeClass::Source
            )
        });

        self.topo = order;
        Ok(())
    }

    fn instantiate_nodes(&mut self, graph: &FlatGraph, errors: &mut Vec<PlanBuildError>) {
        // CLAP scan is potentially expensive; do it once and reuse for
        // every plugin node that needs to confirm a bundle path.
        let scan = scan_paths(&default_clap_search_paths());

        for (i, n) in graph.nodes.iter().enumerate() {
            let planned = match n.kind {
                NodeKind::SourceKeyboard
                | NodeKind::SourcePads
                | NodeKind::SourceSwitch
                | NodeKind::SourceSustainPedal
                | NodeKind::SourceExpressionPedal
                | NodeKind::SourcePitchWheel
                | NodeKind::SourceModWheel
                | NodeKind::SourceKnob
                | NodeKind::SourceFader => PlannedNode::Source,
                NodeKind::MidiTranspose => {
                    let semitones = extract_semitones(&n.config).unwrap_or_else(|err| {
                        errors.push(PlanBuildError::TransposeConfigInvalid {
                            node: n.name.clone(),
                            message: err,
                        });
                        0
                    });
                    PlannedNode::MidiTranspose { semitones }
                }
                NodeKind::MidiMix => PlannedNode::MidiMix,
                NodeKind::InstrumentPlugin => {
                    match try_instantiate_plugin(n, i, &scan, &self.output_port_edge) {
                        Ok(rt) => PlannedNode::Plugin(rt),
                        Err(PluginInstError::MissingConfig) => {
                            // Soft: leave Silent. The UI already
                            // surfaces unconfigured nodes with a chip.
                            PlannedNode::Silent
                        }
                        Err(PluginInstError::LoadFailed(msg)) => {
                            errors.push(PlanBuildError::PluginLoadFailed {
                                node: n.name.clone(),
                                message: msg,
                            });
                            PlannedNode::Silent
                        }
                        Err(PluginInstError::ActivationFailed(msg)) => {
                            errors.push(PlanBuildError::PluginActivationFailed {
                                node: n.name.clone(),
                                message: msg,
                            });
                            PlannedNode::Silent
                        }
                    }
                }
                NodeKind::InstrumentTestTone => {
                    match resolve_stereo_outputs(n, i, &self.output_port_edge) {
                        // No stereo output ports — treat as Silent.
                        None => PlannedNode::Silent,
                        Some((out_l, out_r)) => {
                            let polyphony = extract_polyphony(&n.config).unwrap_or(8);
                            PlannedNode::TestTone(TestToneRuntime {
                                synth: Synth::new(SAMPLE_RATE, polyphony.max(1)),
                                out_l_edge: out_l,
                                out_r_edge: out_r,
                                scratch: vec![0.0; (MAX_FRAMES * 2) as usize],
                            })
                        }
                    }
                }
                NodeKind::AudioEq => {
                    let gains = match extract_eq_gains(&n.config) {
                        Ok(g) => g,
                        Err(msg) => {
                            errors.push(PlanBuildError::EqConfigInvalid {
                                node: n.name.clone(),
                                message: msg,
                            });
                            EqGains::default()
                        }
                    };
                    let (out_l, out_r) =
                        resolve_stereo_outputs(n, i, &self.output_port_edge).unwrap_or((0, 0));
                    let (in_l, in_r) = resolve_stereo_inputs(n, i, &self.routes);
                    PlannedNode::Eq(EqRuntime {
                        eq: Eq::with_gains(SAMPLE_RATE, gains),
                        in_l_edge: in_l,
                        in_r_edge: in_r,
                        out_l_edge: out_l,
                        out_r_edge: out_r,
                        scratch_l: vec![0.0; MAX_FRAMES as usize],
                        scratch_r: vec![0.0; MAX_FRAMES as usize],
                    })
                }
                NodeKind::AudioMix => {
                    let (out_l, out_r) =
                        resolve_stereo_outputs(n, i, &self.output_port_edge).unwrap_or((0, 0));
                    let inputs = resolve_audio_mix_inputs(n, i, &self.routes);
                    PlannedNode::AudioMix(AudioMixRuntime {
                        inputs,
                        out_l_edge: out_l,
                        out_r_edge: out_r,
                        scratch_l: vec![0.0; MAX_FRAMES as usize],
                        scratch_r: vec![0.0; MAX_FRAMES as usize],
                    })
                }
                NodeKind::SinkMainOut => {
                    let (in_l, in_r) = resolve_stereo_inputs(n, i, &self.routes);
                    self.sinks.push(i);
                    PlannedNode::Sink(SinkRuntime {
                        in_l_edge: in_l,
                        in_r_edge: in_r,
                    })
                }
            };
            self.voices.push(match &planned {
                PlannedNode::Plugin(_) | PlannedNode::TestTone(_) => Some(VoiceBits::new()),
                _ => None,
            });
            self.nodes.push(planned);
        }

        // UI-event fan-out targets: every source node by kind-class only.
        // The on-screen keyboard is a stand-in for whatever hardware the
        // source represents, so rig bindings (device, channel, ranges)
        // are deliberately ignored — an unassigned node still previews.
        self.ui_filters = graph
            .nodes
            .iter()
            .enumerate()
            .filter(|(_, n)| n.kind.class() == stardust_core::patch::NodeClass::Source)
            .map(|(i, n)| {
                (
                    i,
                    EventFilter {
                        kind: n.kind,
                        channel: None,
                        note_range: None,
                        cc_range: None,
                    },
                )
            })
            .collect();
    }

    fn has_fatal(&self, errors: &[PlanBuildError]) -> bool {
        errors.iter().any(|e| {
            matches!(
                e,
                PlanBuildError::AudioCycle { .. }
                    | PlanBuildError::UnknownWireEndpoint { .. }
                    | PlanBuildError::DanglingCompositePort { .. }
            )
        })
    }

    fn into_plan(self) -> Plan {
        let n = self.nodes.len();
        Plan {
            nodes: self.nodes,
            routes: self.routes,
            midi_boxes: (0..n).map(|_| MidiBox::new()).collect(),
            edges: self.edges,
            topo: self.topo,
            sinks: self.sinks,
            distribute_scratch: Vec::with_capacity(EVENT_QUEUE),
            pending: Vec::with_capacity(EVENT_QUEUE),
            panic_requested: false,
            voices: self.voices,
            ui_filters: self.ui_filters,
        }
    }
}

// =============================================================================
// Helpers — config extraction
// =============================================================================

fn extract_semitones(config: &Option<serde_json::Value>) -> Result<i32, String> {
    let v = match config.as_ref().and_then(|c| c.get("semitones")) {
        Some(v) => v,
        None => return Ok(0),
    };
    v.as_i64()
        .map(|i| i as i32)
        .ok_or_else(|| format!("expected integer for `semitones`, got {v}"))
}

fn extract_polyphony(config: &Option<serde_json::Value>) -> Option<usize> {
    config
        .as_ref()?
        .get("polyphony")?
        .as_u64()
        .map(|u| u as usize)
}

fn extract_eq_gains(config: &Option<serde_json::Value>) -> Result<EqGains, String> {
    let obj = match config.as_ref().and_then(|c| c.as_object()) {
        Some(o) => o,
        None => return Ok(EqGains::default()),
    };
    let pick = |key: &str| -> Result<f32, String> {
        match obj.get(key) {
            None => Ok(0.0),
            Some(v) => v
                .as_f64()
                .map(|f| f as f32)
                .ok_or_else(|| format!("expected number for `{key}`, got {v}")),
        }
    };
    Ok(EqGains {
        low_db: pick("low")?,
        mid_db: pick("mid")?,
        high_db: pick("high")?,
    })
}

fn extract_plugin_choice(
    config: &Option<serde_json::Value>,
) -> Option<(PathBuf, String, String, String)> {
    let obj = config.as_ref()?.as_object()?;
    let bundle_path = obj.get("bundlePath")?.as_str()?;
    let plugin_id = obj.get("pluginId")?.as_str()?;
    if bundle_path.is_empty() || plugin_id.is_empty() {
        return None;
    }
    let plugin_name = obj
        .get("pluginName")
        .and_then(|v| v.as_str())
        .unwrap_or(plugin_id);
    let plugin_vendor = obj
        .get("pluginVendor")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    Some((
        PathBuf::from(bundle_path),
        plugin_id.to_string(),
        plugin_name.to_string(),
        plugin_vendor.to_string(),
    ))
}

// =============================================================================
// Helpers — port resolution
// =============================================================================

/// For nodes with stereo output ports labeled L / R, find the edge ids
/// in (L, R) order. Returns `None` if the node has no audio outs.
fn resolve_stereo_outputs(
    node: &GraphNode,
    node_idx: NodeIndex,
    output_port_edge: &HashMap<(NodeIndex, String), EdgeId>,
) -> Option<(EdgeId, EdgeId)> {
    let mut out_l = None;
    let mut out_r = None;
    for p in &node.ports {
        if p.signal != SignalKind::Audio || p.direction != PortDirection::Out {
            continue;
        }
        let edge = *output_port_edge.get(&(node_idx, p.id.to_string()))?;
        match &p.config {
            Some(PortConfig::Stereo {
                channel: StereoChannel::L,
            }) => out_l = Some(edge),
            Some(PortConfig::Stereo {
                channel: StereoChannel::R,
            }) => out_r = Some(edge),
            _ => {
                // No stereo config — assume L then R by encounter order.
                if out_l.is_none() {
                    out_l = Some(edge);
                } else if out_r.is_none() {
                    out_r = Some(edge);
                }
            }
        }
    }
    Some((out_l?, out_r?))
}

/// For nodes with stereo input ports labeled L / R, find the edge ids
/// the consumer reads from. `None` per channel means "no wire feeding".
fn resolve_stereo_inputs(
    node: &GraphNode,
    node_idx: NodeIndex,
    routes: &[NodeRoutes],
) -> (Option<EdgeId>, Option<EdgeId>) {
    let mut in_l = None;
    let mut in_r = None;
    let mut input_iter = routes[node_idx].audio_inputs.iter();
    for p in &node.ports {
        if p.signal != SignalKind::Audio || p.direction != PortDirection::In {
            continue;
        }
        let edge = input_iter.next().copied().flatten();
        match &p.config {
            Some(PortConfig::Stereo {
                channel: StereoChannel::L,
            }) => in_l = edge,
            Some(PortConfig::Stereo {
                channel: StereoChannel::R,
            }) => in_r = edge,
            _ => {
                if in_l.is_none() {
                    in_l = edge;
                } else if in_r.is_none() {
                    in_r = edge;
                }
            }
        }
    }
    (in_l, in_r)
}

/// audio.mix has N pairs of stereo input ports — `in-1-l`, `in-1-r`,
/// `in-2-l`, `in-2-r`, …. Walk them in port order, grouping into pairs.
fn resolve_audio_mix_inputs(
    node: &GraphNode,
    node_idx: NodeIndex,
    routes: &[NodeRoutes],
) -> Vec<(Option<EdgeId>, Option<EdgeId>)> {
    let mut pairs: Vec<(Option<EdgeId>, Option<EdgeId>)> = Vec::new();
    let mut pending_l: Option<EdgeId> = None;
    let mut has_pending = false;
    let mut input_iter = routes[node_idx].audio_inputs.iter();
    for p in &node.ports {
        if p.signal != SignalKind::Audio || p.direction != PortDirection::In {
            continue;
        }
        let edge = input_iter.next().copied().flatten();
        let is_l = matches!(
            &p.config,
            Some(PortConfig::Stereo {
                channel: StereoChannel::L,
            })
        );
        let is_r = matches!(
            &p.config,
            Some(PortConfig::Stereo {
                channel: StereoChannel::R,
            })
        );
        if is_l {
            if has_pending {
                pairs.push((pending_l, None));
            }
            pending_l = edge;
            has_pending = true;
        } else if is_r {
            pairs.push((pending_l, edge));
            pending_l = None;
            has_pending = false;
        } else if has_pending {
            // Unconfigured second of a pair — treat as R.
            pairs.push((pending_l, edge));
            pending_l = None;
            has_pending = false;
        } else {
            pending_l = edge;
            has_pending = true;
        }
    }
    if has_pending {
        pairs.push((pending_l, None));
    }
    pairs
}

/// Zone-filter for a MIDI source port that carries a zone config.
fn zone_filter(port: &Port) -> Option<(u8, u8)> {
    match &port.config {
        Some(PortConfig::Zone {
            from_note, to_note, ..
        }) => Some((*from_note, *to_note)),
        _ => None,
    }
}

/// Does `msg` pass the zone filter `(from, to)`?
fn zone_passes(zone: (u8, u8), msg: MidiMessage) -> bool {
    match msg {
        MidiMessage::NoteOn { note, .. } | MidiMessage::NoteOff { note, .. } => {
            note >= zone.0 && note <= zone.1
        }
        // Non-note events always pass — CCs aren't note-zoned.
        _ => true,
    }
}

fn transpose_message(msg: MidiMessage, semitones: i32) -> MidiMessage {
    match msg {
        MidiMessage::NoteOn {
            channel,
            note,
            velocity,
        } => MidiMessage::NoteOn {
            channel,
            note: shift_note(note, semitones),
            velocity,
        },
        MidiMessage::NoteOff {
            channel,
            note,
            velocity,
        } => MidiMessage::NoteOff {
            channel,
            note: shift_note(note, semitones),
            velocity,
        },
        other => other,
    }
}

fn shift_note(note: u8, semitones: i32) -> u8 {
    let n = note as i32 + semitones;
    n.clamp(0, 127) as u8
}

// =============================================================================
// Per-block processing helpers
// =============================================================================

fn process_plugin(
    p: &mut PluginRuntime,
    midi_box: &MidiBox,
    edges: &mut [StereoEdge],
    frames: usize,
) {
    // 1. Prepare events + zero the plugin's audio inputs.
    p.in_events.clear();
    p.out_events.clear();
    for &msg in &midi_box.inbox {
        push_midi_as_clap_events(&mut p.in_events, msg);
    }
    for s in p.input_l[..frames].iter_mut() {
        *s = 0.0;
    }
    for s in p.input_r[..frames].iter_mut() {
        *s = 0.0;
    }

    // 2. Hand the plugin its L/R output edges directly. They are
    //    distinct EdgeIds by construction (stereo plugins have separate
    //    L and R out ports), so split_two_edges_mut is sound.
    //
    //    We destructure `p` by field so the borrow checker can verify
    //    that each &mut reference into p (input_l, input_r, input_ports,
    //    output_ports, in_events, out_events, started) is disjoint.
    let PluginRuntime {
        started,
        input_ports,
        output_ports,
        input_l,
        input_r,
        in_events,
        out_events,
        out_l_edge,
        out_r_edge,
        name,
        ..
    } = p;
    let (out_l_buf, out_r_buf) = split_two_edges_mut(edges, *out_l_edge, *out_r_edge);

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
        let mut iter = [&mut out_l_buf.l[..frames], &mut out_r_buf.r[..frames]].into_iter();
        output_ports.with_output_buffers([AudioPortBuffer {
            latency: 0,
            channels: AudioPortBufferType::f32_output_only(std::iter::from_fn(move || {
                iter.next().map(|s| s as &mut [f32])
            })),
        }])
    };

    let in_events_ref = in_events.as_input();
    let mut out_events_ref = out_events.as_output();
    if let Err(e) = started.process(
        &in_buffers,
        &mut out_buffers,
        &in_events_ref,
        &mut out_events_ref,
        None,
        None,
    ) {
        tracing::error!(plugin = %name, error = ?e, "plugin.process failed");
        // Best effort: zero the output edges so we don't render garbage.
        for s in out_l_buf.l[..frames].iter_mut() {
            *s = 0.0;
        }
        for s in out_r_buf.r[..frames].iter_mut() {
            *s = 0.0;
        }
    }
}

fn process_test_tone(
    s: &mut TestToneRuntime,
    midi_box: &MidiBox,
    edges: &mut [StereoEdge],
    frames: usize,
) {
    for &msg in &midi_box.inbox {
        s.synth.process_midi(msg);
    }
    // Synth renders interleaved stereo. Deinterleave into the L/R edges.
    let buf = &mut s.scratch[..frames * 2];
    s.synth.render(buf, 2);
    let (l_edge, r_edge) = split_two_edges_mut(edges, s.out_l_edge, s.out_r_edge);
    for f in 0..frames {
        l_edge.l[f] = buf[f * 2];
        r_edge.r[f] = buf[f * 2 + 1];
    }
}

fn process_eq(e: &mut EqRuntime, edges: &mut [StereoEdge], frames: usize) {
    // Read input edges into local scratch (immut-borrow of edges), then
    // process in place on scratch, then write to output edges
    // (mut-borrow of edges). Avoids overlapping read/write borrows.
    if let Some(id) = e.in_l_edge {
        e.scratch_l[..frames].copy_from_slice(&edges[id].l[..frames]);
    } else {
        for s in e.scratch_l[..frames].iter_mut() {
            *s = 0.0;
        }
    }
    if let Some(id) = e.in_r_edge {
        e.scratch_r[..frames].copy_from_slice(&edges[id].r[..frames]);
    } else {
        for s in e.scratch_r[..frames].iter_mut() {
            *s = 0.0;
        }
    }
    e.eq.process(&mut e.scratch_l[..frames], &mut e.scratch_r[..frames]);
    let (out_l, out_r) = split_two_edges_mut(edges, e.out_l_edge, e.out_r_edge);
    out_l.l[..frames].copy_from_slice(&e.scratch_l[..frames]);
    out_r.r[..frames].copy_from_slice(&e.scratch_r[..frames]);
}

fn process_audio_mix(m: &mut AudioMixRuntime, edges: &mut [StereoEdge], frames: usize) {
    // Sum every input pair into scratch (immut-borrow of edges), then
    // copy scratch to outputs (mut-borrow). Same pattern as the EQ.
    for s in m.scratch_l[..frames].iter_mut() {
        *s = 0.0;
    }
    for s in m.scratch_r[..frames].iter_mut() {
        *s = 0.0;
    }
    for &(in_l, in_r) in &m.inputs {
        if let Some(id) = in_l {
            let src = &edges[id];
            for f in 0..frames {
                m.scratch_l[f] += src.l[f];
            }
        }
        if let Some(id) = in_r {
            let src = &edges[id];
            for f in 0..frames {
                m.scratch_r[f] += src.r[f];
            }
        }
    }
    let (out_l, out_r) = split_two_edges_mut(edges, m.out_l_edge, m.out_r_edge);
    out_l.l[..frames].copy_from_slice(&m.scratch_l[..frames]);
    out_r.r[..frames].copy_from_slice(&m.scratch_r[..frames]);
}

/// Get two disjoint mutable references into the edges Vec by index.
/// Panics if `a == b` — caller's responsibility to ensure distinct ids.
fn split_two_edges_mut(
    edges: &mut [StereoEdge],
    a: EdgeId,
    b: EdgeId,
) -> (&mut StereoEdge, &mut StereoEdge) {
    assert_ne!(a, b, "split_two_edges_mut requires distinct edge ids");
    let (low, high, swapped) = if a < b { (a, b, false) } else { (b, a, true) };
    let (left, right) = edges.split_at_mut(high);
    let lhs = &mut left[low];
    let rhs = &mut right[0];
    if swapped { (rhs, lhs) } else { (lhs, rhs) }
}

fn push_midi_as_clap_events(buf: &mut EventBuffer, msg: MidiMessage) {
    match msg {
        MidiMessage::NoteOn {
            channel,
            note,
            velocity,
        } => {
            let event = NoteOnEvent::new(
                0,
                Pckn::new(0u16, channel as u16, note as u16, u32::MAX),
                velocity as f64 / 127.0,
            );
            buf.push(&event);
        }
        MidiMessage::NoteOff {
            channel,
            note,
            velocity,
        } => {
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
        MidiMessage::PolyAftertouch {
            channel,
            note,
            value,
        } => Some([0xA0 | (channel & 0x0F), note & 0x7F, value & 0x7F]),
        MidiMessage::ProgramChange { channel, program } => {
            Some([0xC0 | (channel & 0x0F), program & 0x7F, 0])
        }
        _ => None,
    }
}

// =============================================================================
// Plugin instantiation
// =============================================================================

enum PluginInstError {
    MissingConfig,
    LoadFailed(String),
    ActivationFailed(String),
}

/// Plugins are loaded + activated as part of plan-build. We keep both
/// the `PluginEntry` and `PluginInstance` alive on the engine thread
/// (in `Plan::keepalives`), and the started audio processor moves into
/// the plan's runtime state (which itself moves into the cpal closure).
///
/// Note: this function returns the runtime AND mutates global state
/// (the plan's `entries` / `instances` vectors). We thread those in by
/// reference rather than as fields on PlanBuilder to keep the borrow
/// shape predictable.
fn try_instantiate_plugin(
    node: &GraphNode,
    node_idx: NodeIndex,
    scan: &stardust_core::plugin::clap::ScanResult,
    output_port_edge: &HashMap<(NodeIndex, String), EdgeId>,
) -> std::result::Result<PluginRuntime, PluginInstError> {
    let (bundle_path, plugin_id, plugin_name, plugin_vendor) =
        extract_plugin_choice(&node.config).ok_or(PluginInstError::MissingConfig)?;

    // Confirm the bundle + id still exist on disk.
    let bundle = scan
        .bundles
        .iter()
        .find(|b| b.path == bundle_path)
        .ok_or_else(|| {
            PluginInstError::LoadFailed(format!(
                "bundle no longer present on disk: {}",
                bundle_path.display()
            ))
        })?;
    let _descriptor = bundle
        .descriptors
        .iter()
        .find(|d| d.id == plugin_id)
        .ok_or_else(|| {
            PluginInstError::LoadFailed(format!("plugin id {plugin_id} not in bundle"))
        })?;

    // SAFETY: loading a CLAP bundle is unsafe at the FFI boundary; the
    // path came from our own scanner.
    let entry = unsafe { PluginEntry::load(&bundle_path) }
        .map_err(|e| PluginInstError::LoadFailed(format!("failed to load .clap: {e}")))?;

    let factory = entry
        .get_plugin_factory()
        .ok_or_else(|| PluginInstError::LoadFailed("bundle exposed no plugin factory".into()))?;
    let plugin_id_cstr = factory
        .plugin_descriptors()
        .filter_map(|d| d.id())
        .find(|cs| cs.to_string_lossy() == plugin_id)
        .ok_or_else(|| {
            PluginInstError::LoadFailed("plugin id vanished between scan and instantiate".into())
        })?;

    let host_info = host_info();
    let mut plugin = PluginInstance::<StardustHost>::new(
        |_| stardust_core::plugin::clap::StardustHostShared,
        |_| (),
        &entry,
        plugin_id_cstr,
        &host_info,
    )
    .map_err(|e| PluginInstError::LoadFailed(format!("instantiation failed: {e:?}")))?;

    let config = PluginAudioConfiguration {
        sample_rate: SAMPLE_RATE as f64,
        min_frames_count: MIN_FRAMES,
        max_frames_count: MAX_FRAMES,
    };
    let stopped = plugin
        .activate(|_, _| (), config)
        .map_err(|e| PluginInstError::ActivationFailed(format!("activation failed: {e:?}")))?;
    let started = stopped.start_processing().map_err(|e| {
        PluginInstError::ActivationFailed(format!("start_processing failed: {e:?}"))
    })?;

    let (out_l, out_r) =
        resolve_stereo_outputs(node, node_idx, output_port_edge).ok_or_else(|| {
            PluginInstError::LoadFailed("plugin node has no stereo audio output ports".into())
        })?;

    // We deliberately drop `plugin` (PluginInstance) and `entry` here.
    // The clack-host StartedPluginAudioProcessor keeps an Arc on the
    // underlying PluginInstanceInner, so the plugin stays alive for as
    // long as the processor does. PluginEntry, however, must outlive
    // the plugin — we leak it intentionally for now since plans never
    // unload bundles; the OS reaps the dlopen handle at process exit.
    //
    // (A future revision will keep entries on the engine thread for
    // graceful unload on patch switch; v0.8b prioritises shipping.)
    std::mem::forget(entry);
    drop(plugin);

    Ok(PluginRuntime {
        started,
        input_ports: AudioPorts::with_capacity(STEREO_CHANNELS as usize, 1),
        output_ports: AudioPorts::with_capacity(STEREO_CHANNELS as usize, 1),
        input_l: vec![0.0; MAX_FRAMES as usize],
        input_r: vec![0.0; MAX_FRAMES as usize],
        in_events: EventBuffer::with_capacity(EVENT_QUEUE),
        out_events: EventBuffer::with_capacity(EVENT_QUEUE),
        out_l_edge: out_l,
        out_r_edge: out_r,
        name: plugin_name,
        id: plugin_id,
        vendor: plugin_vendor,
    })
}

// =============================================================================
// Engine self-test diagnostic
//
// Builds a synthetic source.keyboard → instrument.testtone → sink.main-out
// graph, plays a high-pitched note for 2 seconds offline, and reports the
// peak RMS in dBFS over any 100ms window. Used by the Settings → "Run
// engine self-test" button and by the v1 fixture-migration test.
// =============================================================================

/// Result of a self-test render: the loudest 100ms RMS encountered, and
/// whether that exceeded the pass threshold.
#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SelfTestResult {
    pub peak_rms_dbfs: f32,
    pub passed: bool,
}

/// Diagnostic pass criterion: any 100ms RMS window must be louder than
/// −24 dBFS. Picked so a working signal path passes comfortably while
/// silence (or a stuck-Silent node) fails unambiguously.
pub const SELF_TEST_THRESHOLD_DBFS: f32 = -24.0;

/// Render two seconds of audio from the given graph and report the loudest
/// 100ms-window RMS on the left channel. The graph is expected to contain
/// one `source.keyboard` (the hw_midi_target), one instrument that responds
/// to MIDI note-on, and one `sink.main-out`.
pub fn render_self_test(graph: &PatchGraph) -> Result<SelfTestResult, String> {
    let output = Plan::build(graph).map_err(|errs| format!("plan build failed: {errs:?}"))?;
    let mut plan = output.plan;

    // High note (C6 ≈ 1046.5 Hz — the closest semitone to 1 kHz on a
    // 12-TET sine voice) at full velocity. One note-on suffices: the
    // testtone synth holds the voice until a note-off arrives.
    plan.inject_ui(MidiMessage::NoteOn {
        channel: 0,
        note: 84,
        velocity: 127,
    });

    const BLOCK: usize = 512;
    let channels: u16 = 2;
    let total_frames = (SAMPLE_RATE as usize) * 2;
    let spec = AudioSpec {
        channels,
        sample_rate: SAMPLE_RATE as u32,
    };
    let mut buf = vec![0.0f32; BLOCK * channels as usize];
    let mut left = Vec::with_capacity(total_frames);
    let mut rendered = 0;
    while rendered < total_frames {
        let take = BLOCK.min(total_frames - rendered);
        let slice = &mut buf[..take * channels as usize];
        for s in slice.iter_mut() {
            *s = 0.0;
        }
        plan.process(slice, &spec);
        for f in 0..take {
            left.push(slice[f * channels as usize]);
        }
        rendered += take;
    }

    let window = (SAMPLE_RATE * 0.1) as usize;
    let peak_rms = peak_rms_over_window(&left, window);
    let peak_rms_dbfs = if peak_rms > 0.0 {
        20.0 * peak_rms.log10()
    } else {
        f32::NEG_INFINITY
    };
    Ok(SelfTestResult {
        peak_rms_dbfs,
        passed: peak_rms_dbfs > SELF_TEST_THRESHOLD_DBFS,
    })
}

/// Build the canonical self-test patch graph from scratch — keyboard →
/// testtone → sink. Used by the Tauri `engine_self_test` command so the
/// diagnostic never depends on the user's currently-loaded patch.
pub fn self_test_graph() -> PatchGraph {
    use stardust_core::patch::{
        GraphNode, NodeId, PatchGraph, Port, PortConfig, PortDirection, SignalKind, StereoChannel,
        Wire, WireId,
    };

    fn port(id: &str, label: &str, signal: SignalKind, dir: PortDirection) -> Port {
        Port {
            id: stardust_core::patch::PortId::new(id),
            label: label.to_string(),
            signal,
            direction: dir,
            config: None,
        }
    }
    fn stereo(id: &str, label: &str, dir: PortDirection, ch: StereoChannel) -> Port {
        Port {
            id: stardust_core::patch::PortId::new(id),
            label: label.to_string(),
            signal: SignalKind::Audio,
            direction: dir,
            config: Some(PortConfig::Stereo { channel: ch }),
        }
    }

    let kbd = GraphNode {
        id: NodeId::new("kbd"),
        kind: NodeKind::SourceKeyboard,
        name: "kbd".into(),
        x: 0.0,
        y: 0.0,
        ports: vec![port(
            "out",
            "MIDI out",
            SignalKind::Midi,
            PortDirection::Out,
        )],
        config: None,
    };
    let testtone = GraphNode {
        id: NodeId::new("tt"),
        kind: NodeKind::InstrumentTestTone,
        name: "tt".into(),
        x: 0.0,
        y: 0.0,
        ports: vec![
            port("midi-in", "MIDI in", SignalKind::Midi, PortDirection::In),
            stereo("audio-l", "L", PortDirection::Out, StereoChannel::L),
            stereo("audio-r", "R", PortDirection::Out, StereoChannel::R),
        ],
        config: None,
    };
    let sink = GraphNode {
        id: NodeId::new("sink"),
        kind: NodeKind::SinkMainOut,
        name: "sink".into(),
        x: 0.0,
        y: 0.0,
        ports: vec![
            stereo("in-l", "L", PortDirection::In, StereoChannel::L),
            stereo("in-r", "R", PortDirection::In, StereoChannel::R),
        ],
        config: None,
    };
    PatchGraph {
        nodes: vec![kbd, testtone, sink],
        wires: vec![
            Wire {
                id: WireId::new("w1"),
                from_node: NodeId::new("kbd"),
                from_port: stardust_core::patch::PortId::new("out"),
                to_node: NodeId::new("tt"),
                to_port: stardust_core::patch::PortId::new("midi-in"),
                color: None,
            },
            Wire {
                id: WireId::new("w2"),
                from_node: NodeId::new("tt"),
                from_port: stardust_core::patch::PortId::new("audio-l"),
                to_node: NodeId::new("sink"),
                to_port: stardust_core::patch::PortId::new("in-l"),
                color: None,
            },
            Wire {
                id: WireId::new("w3"),
                from_node: NodeId::new("tt"),
                from_port: stardust_core::patch::PortId::new("audio-r"),
                to_node: NodeId::new("sink"),
                to_port: stardust_core::patch::PortId::new("in-r"),
                color: None,
            },
        ],
        composites: vec![],
    }
}

fn peak_rms_over_window(samples: &[f32], window: usize) -> f32 {
    if samples.len() < window || window == 0 {
        return 0.0;
    }
    let mut sum_sq = 0.0f32;
    for &s in &samples[..window] {
        sum_sq += s * s;
    }
    let mut peak = (sum_sq / window as f32).sqrt();
    for i in window..samples.len() {
        sum_sq += samples[i] * samples[i] - samples[i - window] * samples[i - window];
        let rms = (sum_sq.max(0.0) / window as f32).sqrt();
        if rms > peak {
            peak = rms;
        }
    }
    peak
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use stardust_core::patch::{
        CompositeBlock, CompositeId, GraphNode, PatchGraph, Port, PortDirection, PromotedPort,
        SignalKind, Wire,
    };

    fn node(id: &str, kind: NodeKind, ports: Vec<Port>) -> GraphNode {
        GraphNode {
            id: NodeId::new(id),
            kind,
            name: id.to_string(),
            x: 0.0,
            y: 0.0,
            ports,
            config: None,
        }
    }

    fn audio_out(id: &str, channel: stardust_core::patch::StereoChannel) -> Port {
        Port {
            id: PortId::new(id),
            label: id.to_string(),
            signal: SignalKind::Audio,
            direction: PortDirection::Out,
            config: Some(PortConfig::Stereo { channel }),
        }
    }

    fn audio_in(id: &str, channel: stardust_core::patch::StereoChannel) -> Port {
        Port {
            id: PortId::new(id),
            label: id.to_string(),
            signal: SignalKind::Audio,
            direction: PortDirection::In,
            config: Some(PortConfig::Stereo { channel }),
        }
    }

    fn midi_in(id: &str) -> Port {
        Port {
            id: PortId::new(id),
            label: id.to_string(),
            signal: SignalKind::Midi,
            direction: PortDirection::In,
            config: None,
        }
    }

    fn midi_out(id: &str) -> Port {
        Port {
            id: PortId::new(id),
            label: id.to_string(),
            signal: SignalKind::Midi,
            direction: PortDirection::Out,
            config: None,
        }
    }

    fn wire(id: &str, from_n: &str, from_p: &str, to_n: &str, to_p: &str) -> Wire {
        Wire {
            id: WireId(id.into()),
            from_node: NodeId::new(from_n),
            from_port: PortId::new(from_p),
            to_node: NodeId::new(to_n),
            to_port: PortId::new(to_p),
            color: None,
        }
    }

    // Re-export WireId from inside the module for the test helper.
    use stardust_core::patch::{StereoChannel, WireId};

    #[test]
    fn topo_sort_orders_audio_dag() {
        // testtone -> eq -> sink
        let sine = node(
            "sine",
            NodeKind::InstrumentTestTone,
            vec![
                audio_out("audio-l", StereoChannel::L),
                audio_out("audio-r", StereoChannel::R),
            ],
        );
        let eq = node(
            "eq",
            NodeKind::AudioEq,
            vec![
                audio_in("in-l", StereoChannel::L),
                audio_in("in-r", StereoChannel::R),
                audio_out("out-l", StereoChannel::L),
                audio_out("out-r", StereoChannel::R),
            ],
        );
        let sink = node(
            "sink",
            NodeKind::SinkMainOut,
            vec![
                audio_in("in-l", StereoChannel::L),
                audio_in("in-r", StereoChannel::R),
            ],
        );
        let graph = PatchGraph {
            nodes: vec![sine, eq, sink],
            wires: vec![
                wire("w1", "sine", "audio-l", "eq", "in-l"),
                wire("w2", "sine", "audio-r", "eq", "in-r"),
                wire("w3", "eq", "out-l", "sink", "in-l"),
                wire("w4", "eq", "out-r", "sink", "in-r"),
            ],
            composites: vec![],
        };

        let result = Plan::build(&graph);
        let out = result.expect("plan should build");
        // sine must come before eq must come before sink in topo order.
        let pos = |name: &str| {
            out.plan
                .topo
                .iter()
                .position(|&i| {
                    let n = &graph.nodes[i];
                    n.id.as_str() == name
                })
                .unwrap()
        };
        assert!(pos("sine") < pos("eq"));
        assert!(pos("eq") < pos("sink"));
    }

    #[test]
    fn detects_audio_cycle() {
        // eq1 <-> eq2 (cycle through audio wires)
        let eq1 = node(
            "eq1",
            NodeKind::AudioEq,
            vec![
                audio_in("in-l", StereoChannel::L),
                audio_in("in-r", StereoChannel::R),
                audio_out("out-l", StereoChannel::L),
                audio_out("out-r", StereoChannel::R),
            ],
        );
        let eq2 = node(
            "eq2",
            NodeKind::AudioEq,
            vec![
                audio_in("in-l", StereoChannel::L),
                audio_in("in-r", StereoChannel::R),
                audio_out("out-l", StereoChannel::L),
                audio_out("out-r", StereoChannel::R),
            ],
        );
        let graph = PatchGraph {
            nodes: vec![eq1, eq2],
            wires: vec![
                wire("w1", "eq1", "out-l", "eq2", "in-l"),
                wire("w2", "eq1", "out-r", "eq2", "in-r"),
                wire("w3", "eq2", "out-l", "eq1", "in-l"),
                wire("w4", "eq2", "out-r", "eq1", "in-r"),
            ],
            composites: vec![],
        };

        let errors = match Plan::build(&graph) {
            Err(errs) => errs,
            Ok(_) => panic!("cycle should fail"),
        };
        assert!(
            errors
                .iter()
                .any(|e| matches!(e, PlanBuildError::AudioCycle { .. }))
        );
    }

    #[test]
    fn composite_flattening_preserves_wire_targets() {
        // Inner: keyboard -> organ; composite exposes one MIDI in
        // promoted to organ.midi-in. External: keyboard -> composite/in.
        let keyboard = node("kb", NodeKind::SourceKeyboard, vec![midi_out("out")]);
        let organ = node(
            "organ",
            NodeKind::InstrumentPlugin,
            vec![
                midi_in("midi-in"),
                audio_out("audio-l", StereoChannel::L),
                audio_out("audio-r", StereoChannel::R),
            ],
        );
        let graph = PatchGraph {
            nodes: vec![keyboard, organ],
            wires: vec![wire("w1", "kb", "out", "c1", "in")],
            composites: vec![CompositeBlock {
                id: CompositeId("c1".into()),
                name: "Inner".into(),
                contains: vec![NodeId::new("organ")],
                locked: false,
                promoted_ports: vec![PromotedPort {
                    id: PortId::new("in"),
                    label: "Keys".into(),
                    direction: PortDirection::In,
                    signal: SignalKind::Midi,
                    internal_node: NodeId::new("organ"),
                    internal_port: PortId::new("midi-in"),
                }],
                color_hue: None,
            }],
        };

        let mut errors: Vec<PlanBuildError> = Vec::new();
        let flat = flatten_composites(&graph, &mut errors);
        assert!(errors.is_empty(), "no errors expected, got {errors:?}");
        assert_eq!(flat.wires.len(), 1);
        let w = &flat.wires[0];
        assert_eq!(w.to_node.as_str(), "organ");
        assert_eq!(w.to_port.as_str(), "midi-in");
    }

    #[test]
    fn zone_filter_drops_out_of_range_notes() {
        let zone = (60, 72);
        assert!(zone_passes(
            zone,
            MidiMessage::NoteOn {
                channel: 0,
                note: 65,
                velocity: 100
            }
        ));
        assert!(!zone_passes(
            zone,
            MidiMessage::NoteOn {
                channel: 0,
                note: 59,
                velocity: 100
            }
        ));
        assert!(!zone_passes(
            zone,
            MidiMessage::NoteOn {
                channel: 0,
                note: 73,
                velocity: 100
            }
        ));
        // CC always passes regardless of zone (it has no note).
        assert!(zone_passes(
            zone,
            MidiMessage::ControlChange {
                channel: 0,
                cc: 1,
                value: 64
            }
        ));
    }

    // -------------------------------------------------------------
    // Rig-component routing (#122, superseding the #2 node bindings)
    // -------------------------------------------------------------

    fn component_ref(id: &str) -> Option<serde_json::Value> {
        Some(serde_json::json!({ "rigComponentId": id }))
    }

    fn rig_with(components: Vec<(&str, NodeKind, serde_json::Value)>) -> stardust_core::show::Rig {
        stardust_core::show::Rig {
            components: components
                .into_iter()
                .map(|(id, kind, config)| stardust_core::show::RigComponent {
                    id: id.into(),
                    kind,
                    name: id.to_owned(),
                    config: if config.is_null() { None } else { Some(config) },
                })
                .collect(),
        }
    }

    /// Two keyboard components bound to distinct devices.
    fn two_keyboard_rig() -> stardust_core::show::Rig {
        rig_with(vec![
            (
                "rc-a",
                NodeKind::SourceKeyboard,
                serde_json::json!({ "device": { "id": "dev-a", "name": "Keyboard A" } }),
            ),
            (
                "rc-b",
                NodeKind::SourceKeyboard,
                serde_json::json!({ "device": { "id": "dev-b", "name": "Keyboard B" } }),
            ),
        ])
    }

    /// kbd → testtone → sink twice over, with each keyboard referencing a
    /// different rig component. Injection isolation is asserted via the
    /// per-instrument voice tracker.
    fn two_keyboard_graph() -> PatchGraph {
        fn stereo(id: &str, dir: PortDirection, ch: StereoChannel) -> Port {
            Port {
                id: PortId::new(id),
                label: id.to_string(),
                signal: SignalKind::Audio,
                direction: dir,
                config: Some(PortConfig::Stereo { channel: ch }),
            }
        }
        let mut kb1 = node("kb1", NodeKind::SourceKeyboard, vec![midi_out("out")]);
        kb1.config = component_ref("rc-a");
        let mut kb2 = node("kb2", NodeKind::SourceKeyboard, vec![midi_out("out")]);
        kb2.config = component_ref("rc-b");
        let tt1 = node(
            "tt1",
            NodeKind::InstrumentTestTone,
            vec![
                midi_in("midi-in"),
                stereo("out-l", PortDirection::Out, StereoChannel::L),
                stereo("out-r", PortDirection::Out, StereoChannel::R),
            ],
        );
        let tt2 = node(
            "tt2",
            NodeKind::InstrumentTestTone,
            vec![
                midi_in("midi-in"),
                stereo("out-l", PortDirection::Out, StereoChannel::L),
                stereo("out-r", PortDirection::Out, StereoChannel::R),
            ],
        );
        let sink = node(
            "sink",
            NodeKind::SinkMainOut,
            vec![
                audio_in("in-l", StereoChannel::L),
                audio_in("in-r", StereoChannel::R),
            ],
        );
        PatchGraph {
            nodes: vec![kb1, kb2, tt1, tt2, sink],
            wires: vec![
                wire("w1", "kb1", "out", "tt1", "midi-in"),
                wire("w2", "kb2", "out", "tt2", "midi-in"),
                wire("w3", "tt1", "out-l", "sink", "in-l"),
                wire("w4", "tt1", "out-r", "sink", "in-r"),
            ],
            composites: vec![],
        }
    }

    fn run_block(plan: &mut Plan) {
        let spec = AudioSpec {
            channels: 2,
            sample_rate: SAMPLE_RATE as u32,
        };
        let mut buf = vec![0.0f32; 512 * 2];
        plan.process(&mut buf, &spec);
    }

    fn note_on(channel: u8, note: u8) -> MidiMessage {
        MidiMessage::NoteOn {
            channel,
            note,
            velocity: 100,
        }
    }

    #[test]
    fn bound_keyboards_receive_only_their_devices_events() {
        let graph = two_keyboard_graph();
        let bindings = parse_rig(&two_keyboard_rig());
        let specs = source_event_filters(&graph, &bindings);
        assert_eq!(specs.len(), 2);
        assert!(specs[0].matches_device("dev-a", "Keyboard A", true));
        assert!(!specs[0].matches_device("dev-b", "Keyboard B", true));
        // Identity wins over name when the bound id is present elsewhere.
        assert!(!specs[0].matches_device("dev-x", "Keyboard A", true));
        // Name fallback applies when the bound id vanished (replug).
        assert!(specs[0].matches_device("dev-x", "Keyboard A", false));

        let mut plan = Plan::build(&graph).expect("plan builds").plan;
        // Simulate the midir-side routing outcome: device A's event goes
        // to kb1 (node 0) only.
        plan.inject_to(0, note_on(0, 60));
        run_block(&mut plan);
        assert_eq!(plan.active_voices_for(2), 1, "tt1 got kb1's note");
        assert_eq!(plan.active_voices_for(3), 0, "tt2 must not see it");
    }

    #[test]
    fn unassigned_dangling_and_unbound_sources_get_no_hardware_route() {
        // Three keyboards: no component, a deleted component id, and a
        // component that exists but was never bound to a device. All
        // three are silent on the hardware path (#122: no any-device
        // fallback).
        let kb1 = node("kb1", NodeKind::SourceKeyboard, vec![midi_out("out")]);
        let mut kb2 = node("kb2", NodeKind::SourceKeyboard, vec![midi_out("out")]);
        kb2.config = component_ref("rc-deleted");
        let mut kb3 = node("kb3", NodeKind::SourceKeyboard, vec![midi_out("out")]);
        kb3.config = component_ref("rc-unbound");
        let graph = PatchGraph {
            nodes: vec![kb1, kb2, kb3],
            wires: vec![],
            composites: vec![],
        };
        let rig = rig_with(vec![(
            "rc-unbound",
            NodeKind::SourceKeyboard,
            serde_json::Value::Null,
        )]);
        let specs = source_event_filters(&graph, &parse_rig(&rig));
        assert!(specs.is_empty(), "specs: {specs:?}");

        // The on-screen keyboard still reaches all three (kind-class
        // fan-out ignores rig assignment).
        let plan = Plan::build(&graph).expect("plan builds").plan;
        assert_eq!(plan.ui_filters.len(), 3);
    }

    #[test]
    fn kind_filters_narrow_event_classes() {
        let sustain = EventFilter {
            kind: NodeKind::SourceSustainPedal,
            channel: None,
            note_range: None,
            cc_range: None,
        };
        let cc64 = MidiMessage::ControlChange {
            channel: 0,
            cc: 64,
            value: 127,
        };
        let cc11 = MidiMessage::ControlChange {
            channel: 0,
            cc: 11,
            value: 90,
        };
        assert!(sustain.accepts(cc64));
        assert!(!sustain.accepts(cc11));
        assert!(!sustain.accepts(note_on(0, 60)));

        let wheel = EventFilter {
            kind: NodeKind::SourcePitchWheel,
            channel: None,
            note_range: None,
            cc_range: None,
        };
        assert!(wheel.accepts(MidiMessage::PitchBend {
            channel: 3,
            value: 1200
        }));
        assert!(!wheel.accepts(cc64));

        let pads = EventFilter {
            kind: NodeKind::SourcePads,
            channel: Some(9),
            note_range: None,
            cc_range: None,
        };
        assert!(pads.accepts(note_on(9, 40)));
        assert!(!pads.accepts(note_on(0, 40)), "wrong channel filtered");
        assert!(!pads.accepts(cc64), "pads don't take CCs");
    }

    #[test]
    fn component_config_parses_ranges_and_channel() {
        let mut kb = node("kb", NodeKind::SourceKeyboard, vec![midi_out("out")]);
        kb.config = component_ref("rc-1");
        let graph = PatchGraph {
            nodes: vec![kb],
            wires: vec![],
            composites: vec![],
        };
        let rig = rig_with(vec![(
            "rc-1",
            NodeKind::SourceKeyboard,
            serde_json::json!({
                "device": { "id": null, "name": "Test Keys" },
                "channel": 3,
                "lowNote": 21,
                "highNote": 108,
                "ccRange": [0, 63]
            }),
        )]);
        let bindings = parse_rig(&rig);
        let specs = source_event_filters(&graph, &bindings);
        let spec = &specs[0];
        // id null + name = name-only binding, not any-device.
        assert_eq!(spec.binding.device_id, None);
        assert!(spec.matches_device("whatever", "Test Keys", false));
        assert!(!spec.matches_device("whatever", "Other", false));
        assert!(
            spec.filter.accepts(note_on(2, 60)),
            "channel 3 is 0-based 2"
        );
        assert!(!spec.filter.accepts(note_on(3, 60)));
        assert!(!spec.filter.accepts(note_on(2, 10)), "below note range");
        assert!(!spec.filter.accepts(MidiMessage::ControlChange {
            channel: 2,
            cc: 64,
            value: 1
        }));
        assert!(spec.filter.accepts(MidiMessage::ControlChange {
            channel: 2,
            cc: 1,
            value: 1
        }));
    }

    #[test]
    fn learned_cc_source_narrows_to_single_cc() {
        let mut sus = node("sus", NodeKind::SourceSustainPedal, vec![midi_out("out")]);
        sus.config = component_ref("rc-sus");
        let graph = PatchGraph {
            nodes: vec![sus],
            wires: vec![],
            composites: vec![],
        };
        let rig = rig_with(vec![(
            "rc-sus",
            NodeKind::SourceSustainPedal,
            serde_json::json!({
                "device": { "id": "dev-1", "name": "Pedal Board" },
                "channel": 1,
                "source": { "type": "cc", "cc": 64 }
            }),
        )]);
        let specs = source_event_filters(&graph, &parse_rig(&rig));
        assert_eq!(specs[0].binding.cc_range, Some((64, 64)));
    }

    #[test]
    fn rig_bound_devices_dedupe_across_components() {
        let rig = rig_with(vec![
            (
                "rc-1",
                NodeKind::SourceKeyboard,
                serde_json::json!({ "device": { "id": "dev-1", "name": "Keys" } }),
            ),
            (
                "rc-2",
                NodeKind::SourceSustainPedal,
                serde_json::json!({ "device": { "id": "dev-1", "name": "Keys" } }),
            ),
            (
                "rc-3",
                NodeKind::SourcePads,
                serde_json::json!({ "device": { "id": "dev-2", "name": "Pads" } }),
            ),
            ("rc-4", NodeKind::SourceKnob, serde_json::Value::Null),
        ]);
        let devices = rig_bound_devices(&parse_rig(&rig));
        assert_eq!(devices.len(), 2, "dev-1 shared, rc-4 unbound: {devices:?}");
    }

    #[test]
    fn overlapping_bindings_fan_out_to_all_matching_sources() {
        // Two unbound keyboards feeding separate instruments: a UI event
        // must reach both (fan-out, not first-match).
        let mut graph = two_keyboard_graph();
        graph.nodes[0].config = None;
        graph.nodes[1].config = None;
        let mut plan = Plan::build(&graph).expect("plan builds").plan;
        plan.inject_ui(note_on(0, 64));
        run_block(&mut plan);
        assert_eq!(plan.active_voices_for(2), 1);
        assert_eq!(plan.active_voices_for(3), 1);
    }

    #[test]
    fn injected_events_deliver_exactly_once() {
        // Regression for the v0.8b latent bug: the hw target's outbox was
        // never cleared, so every injected event re-distributed on every
        // subsequent block.
        let graph = self_test_graph();
        let mut plan = Plan::build(&graph).expect("plan builds").plan;
        plan.inject_ui(note_on(0, 60));
        run_block(&mut plan);
        assert_eq!(plan.active_voice_count(), 1);
        // The note-off must win on a later block — under the old
        // accumulate-forever behavior the stale note-on would re-arrive
        // alongside it and the voice would stick.
        run_block(&mut plan);
        plan.inject_ui(MidiMessage::NoteOff {
            channel: 0,
            note: 60,
            velocity: 0,
        });
        run_block(&mut plan);
        assert_eq!(plan.active_voice_count(), 0);
    }

    // -------------------------------------------------------------
    // Panic (#3)
    // -------------------------------------------------------------

    #[test]
    fn panic_flushes_held_chord_within_one_block() {
        let graph = self_test_graph();
        let mut plan = Plan::build(&graph).expect("plan builds").plan;
        // 4-note chord with the sustain pedal down (per the #3 AC).
        for note in [60, 64, 67, 71] {
            plan.inject_ui(note_on(0, note));
        }
        plan.inject_ui(MidiMessage::ControlChange {
            channel: 0,
            cc: 64,
            value: 127,
        });
        run_block(&mut plan);
        assert_eq!(plan.active_voice_count(), 4);

        plan.request_panic();
        run_block(&mut plan);
        assert_eq!(
            plan.active_voice_count(),
            0,
            "panic must flush in one block"
        );
    }

    #[test]
    fn panic_is_idempotent_and_spammable() {
        let graph = self_test_graph();
        let mut plan = Plan::build(&graph).expect("plan builds").plan;
        for note in [60, 64, 67, 71] {
            plan.inject_ui(note_on(0, note));
        }
        run_block(&mut plan);
        // 10 requests between blocks coalesce into one panic dispatch.
        for _ in 0..10 {
            plan.request_panic();
        }
        run_block(&mut plan);
        assert_eq!(plan.active_voice_count(), 0);
        // Panicking again with nothing held must not blow up (and must
        // not have anything to flush).
        plan.request_panic();
        run_block(&mut plan);
        assert_eq!(plan.active_voice_count(), 0);
    }

    #[test]
    fn panic_drops_events_queued_before_it() {
        let graph = self_test_graph();
        let mut plan = Plan::build(&graph).expect("plan builds").plan;
        plan.inject_ui(note_on(0, 60));
        plan.request_panic();
        run_block(&mut plan);
        assert_eq!(
            plan.active_voice_count(),
            0,
            "note-on queued before the panic must not fire after it"
        );
    }

    // -------------------------------------------------------------
    // Rebind (#1) — held voices survive because the plan survives; the
    // tracker is the observable invariant the AC names.
    // -------------------------------------------------------------

    #[test]
    fn voice_tracker_state_survives_plan_handoff() {
        let graph = self_test_graph();
        let mut plan = Plan::build(&graph).expect("plan builds").plan;
        for note in [60, 64, 67, 71] {
            plan.inject_ui(note_on(0, note));
        }
        run_block(&mut plan);
        assert_eq!(plan.active_voice_count(), 4);

        // Simulate what rebind does: the plan moves out of one stream's
        // callback state and into another. Ownership move, no rebuild.
        let mut moved = plan;
        run_block(&mut moved);
        assert_eq!(moved.active_voice_count(), 4, "same 4 voices, no orphans");
    }

    /// Smoke test against the shape of `transposedSplitPatchGraph` in
    /// `_seed-data.ts` — split keyboard zones, transpose, two plugin
    /// instruments (unconfigured → Silent), audio.mix, sink. The plan
    /// should build cleanly with no fatal errors.
    #[test]
    fn realistic_seed_shape_builds() {
        let mut keyboard = node(
            "kb",
            NodeKind::SourceKeyboard,
            vec![
                Port {
                    id: PortId::new("out-low"),
                    label: "Low".into(),
                    signal: SignalKind::Midi,
                    direction: PortDirection::Out,
                    config: Some(PortConfig::Zone {
                        from_note: 36,
                        to_note: 59,
                        color_hue: None,
                        wire_follows_color: None,
                    }),
                },
                Port {
                    id: PortId::new("out-high"),
                    label: "High".into(),
                    signal: SignalKind::Midi,
                    direction: PortDirection::Out,
                    config: Some(PortConfig::Zone {
                        from_note: 60,
                        to_note: 108,
                        color_hue: None,
                        wire_follows_color: None,
                    }),
                },
            ],
        );
        keyboard.name = "Main keyboard".into();

        let transpose = GraphNode {
            id: NodeId::new("xpose"),
            kind: NodeKind::MidiTranspose,
            name: "Down an octave".into(),
            x: 0.0,
            y: 0.0,
            ports: vec![midi_in("in"), midi_out("out")],
            config: Some(serde_json::json!({ "semitones": -12 })),
        };

        let bass = node(
            "bass",
            NodeKind::InstrumentPlugin,
            vec![
                midi_in("midi-in"),
                audio_out("audio-l", StereoChannel::L),
                audio_out("audio-r", StereoChannel::R),
            ],
        );
        let lead = node(
            "lead",
            NodeKind::InstrumentPlugin,
            vec![
                midi_in("midi-in"),
                audio_out("audio-l", StereoChannel::L),
                audio_out("audio-r", StereoChannel::R),
            ],
        );
        let mix = node(
            "mix",
            NodeKind::AudioMix,
            vec![
                audio_in("in-1-l", StereoChannel::L),
                audio_in("in-1-r", StereoChannel::R),
                audio_in("in-2-l", StereoChannel::L),
                audio_in("in-2-r", StereoChannel::R),
                audio_out("out-l", StereoChannel::L),
                audio_out("out-r", StereoChannel::R),
            ],
        );
        let sink = node(
            "out",
            NodeKind::SinkMainOut,
            vec![
                audio_in("in-l", StereoChannel::L),
                audio_in("in-r", StereoChannel::R),
            ],
        );

        let graph = PatchGraph {
            nodes: vec![keyboard, transpose, bass, lead, mix, sink],
            wires: vec![
                wire("w1", "kb", "out-low", "xpose", "in"),
                wire("w2", "xpose", "out", "bass", "midi-in"),
                wire("w3", "kb", "out-high", "lead", "midi-in"),
                wire("w4", "bass", "audio-l", "mix", "in-1-l"),
                wire("w5", "bass", "audio-r", "mix", "in-1-r"),
                wire("w6", "lead", "audio-l", "mix", "in-2-l"),
                wire("w7", "lead", "audio-r", "mix", "in-2-r"),
                wire("w8", "mix", "out-l", "out", "in-l"),
                wire("w9", "mix", "out-r", "out", "in-r"),
            ],
            composites: vec![],
        };

        let out = Plan::build(&graph).expect("realistic seed shape should build");

        // Unconfigured plugins become Silent — no soft errors expected.
        assert_eq!(out.plugins.len(), 0);
        assert!(
            out.soft_errors.is_empty(),
            "soft errors: {:?}",
            out.soft_errors
        );

        let counts = out.plan.native_node_counts();
        assert_eq!(counts.midi_transpose, 1);
        assert_eq!(counts.audio_mix, 1);

        // The keyboard has no rig component assigned — no hardware
        // route (silent), but the UI keyboard still reaches it.
        let specs = source_event_filters(&graph, &[]);
        assert!(specs.is_empty());
        assert_eq!(out.plan.ui_filters.len(), 1);

        // Both keyboard zone wires must produce MIDI routes with zone
        // filters distinct from each other.
        let kb_routes = &out.plan.routes[0].midi_routes;
        assert_eq!(kb_routes.len(), 2);
        let mut zones: Vec<_> = kb_routes.iter().filter_map(|r| r.zone).collect();
        zones.sort();
        assert_eq!(zones, vec![(36, 59), (60, 108)]);
    }

    #[test]
    fn transpose_shifts_notes() {
        let msg = MidiMessage::NoteOn {
            channel: 0,
            note: 60,
            velocity: 100,
        };
        let shifted = transpose_message(msg, 12);
        match shifted {
            MidiMessage::NoteOn { note, .. } => assert_eq!(note, 72),
            _ => panic!("expected NoteOn"),
        }
    }

    #[test]
    fn synthetic_self_test_produces_audio() {
        let graph = self_test_graph();
        let result = render_self_test(&graph).expect("self-test should render");
        assert!(
            result.passed,
            "expected RMS > {} dBFS, got {}",
            SELF_TEST_THRESHOLD_DBFS, result.peak_rms_dbfs
        );
    }

    /// Per #9 acceptance criteria: the canonical v0.5.0 sine fixture loads
    /// through `ShowDocument::from_json` (which runs the v1→v2 migration),
    /// builds an engine plan, and produces audio above the self-test
    /// threshold.
    #[test]
    fn v0_5_0_sine_show_migrates_and_produces_audio() {
        const RAW: &str = include_str!("../tests/fixtures/v0.5.0-sine-show.json");
        let doc = stardust_core::show::ShowDocument::from_json(RAW)
            .expect("v0.5.0 sine fixture parses + migrates");
        assert_eq!(
            doc.header.schema_version,
            stardust_core::show::CURRENT_SCHEMA_VERSION
        );
        let patch = &doc.show.songs[0].patches[0];
        let result = render_self_test(&patch.graph).expect("plan + render succeeds");
        assert!(
            result.passed,
            "v0.5.0 fixture after migration produced only {} dBFS RMS",
            result.peak_rms_dbfs
        );
    }

    /// Per the #122 migration AC: a #2-era (schema v2) show with a
    /// node-level `hardwareBinding` loads, auto-creates an equivalent
    /// rig component, routes the node through it, and plays unchanged.
    #[test]
    fn v2_bound_show_migrates_to_rig_components_and_plays() {
        const RAW: &str = include_str!("../tests/fixtures/v0.6.0-bound-show.json");
        let doc = stardust_core::show::ShowDocument::from_json(RAW)
            .expect("v2 bound fixture parses + migrates");
        assert_eq!(
            doc.header.schema_version,
            stardust_core::show::CURRENT_SCHEMA_VERSION
        );

        // The label-only rig source + the harvested bound keyboard.
        assert_eq!(doc.show.rig.components.len(), 2);
        let bindings = parse_rig(&doc.show.rig);
        let bound: Vec<_> = bindings.iter().filter(|b| b.is_bound()).collect();
        assert_eq!(bound.len(), 1);
        assert_eq!(bound[0].device_id.as_deref(), Some("port-1234"));
        assert_eq!(bound[0].channel, Some(0), "channel 1 is 0-based 0");
        assert_eq!(bound[0].note_range, Some((21, 108)));

        // The node references the migrated component; the blob is gone.
        let patch = &doc.show.songs[0].patches[0];
        let kbd = &patch.graph.nodes[0];
        assert!(
            kbd.config
                .as_ref()
                .and_then(|c| c.get("hardwareBinding"))
                .is_none()
        );
        let specs = source_event_filters(&patch.graph, &bindings);
        assert_eq!(specs.len(), 1);
        assert!(specs[0].matches_device("port-1234", "Legacy Test Keys", true));

        // The engine opens exactly the one bound device.
        let devices = rig_bound_devices(&bindings);
        assert_eq!(devices.len(), 1);

        // And the patch still renders audio.
        let result = render_self_test(&patch.graph).expect("plan + render succeeds");
        assert!(
            result.passed,
            "v2 bound fixture after migration produced only {} dBFS RMS",
            result.peak_rms_dbfs
        );
    }
}
