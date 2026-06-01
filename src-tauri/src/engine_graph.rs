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
//! 1. Hardware MIDI + UI MIDI rings drain into the [`Plan`]'s scratch.
//! 2. Those events get pushed into the first `source.keyboard` node's
//!    outbox (if one exists in the graph).
//! 3. Nodes execute in topological order. Each consumes its inbox
//!    (events) + its input edges (audio); produces its outbox (events)
//!    + its output edges (audio).
//! 4. After each node runs, its outbox is fanned out to all consumer
//!    nodes' inboxes via the routing table, applying zone filters.
//! 5. Sinks accumulate their input edges into the cpal interleaved
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
#[serde(tag = "kind", rename_all = "camelCase")]
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

/// Built-in sine synth runtime (used when a node's kind is `instrument.sine`).
struct SineRuntime {
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
    Sine(SineRuntime),
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
/// 1 sine, 1 EQ, 2 audio mixers, 1 transpose, 0 midi mixers".
#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeNodeCounts {
    pub sine: usize,
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
    /// First `source.keyboard` node, if any. Hardware + UI MIDI gets
    /// pushed into this node's outbox at the top of every block.
    hw_midi_target: Option<NodeIndex>,
    /// Indices of every `sink.main-out` node. The runtime sums their
    /// input edges into the cpal interleaved output.
    sinks: Vec<NodeIndex>,
    /// Per-block scratch for MIDI distribution — outbox events copy in
    /// here once so route fan-out can mutate other nodes' inboxes
    /// without a self-borrow.
    distribute_scratch: Vec<MidiMessage>,
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
        builder.pick_hw_midi_target(&flat);
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
                PlannedNode::Sine(_) => c.sine += 1,
                PlannedNode::Eq(_) => c.eq += 1,
                PlannedNode::AudioMix(_) => c.audio_mix += 1,
                PlannedNode::MidiTranspose { .. } => c.midi_transpose += 1,
                PlannedNode::MidiMix => c.midi_mix += 1,
                _ => {}
            }
        }
        c
    }

    /// Inject one MIDI event into the hw-MIDI target node's outbox.
    /// Called by the engine thread for hardware MIDI events (from midir)
    /// and UI events (on-screen keyboard). No-op if the patch has no
    /// `source.keyboard` node.
    pub fn inject_midi(&mut self, msg: MidiMessage) {
        if let Some(idx) = self.hw_midi_target {
            // Use outbox: the source node has no transform to apply, so
            // its outbox IS the post-process queue. Inbox stays empty.
            self.midi_boxes[idx].outbox.push(msg);
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
        // 1. Per-block reset.
        //
        // Clear every node's inbox/outbox EXCEPT the hw_midi_target's
        // outbox — that's been populated by `inject_midi` calls since
        // the previous block and we don't want to lose those events.
        // Source nodes other than the target have empty outboxes by
        // construction (no hardware routes to them in v0.8b).
        // -------------------------------------------------------------
        for (i, mb) in self.midi_boxes.iter_mut().enumerate() {
            mb.inbox.clear();
            if Some(i) != self.hw_midi_target {
                mb.outbox.clear();
            }
        }

        // Zero every edge so unconnected inputs read silence and
        // mix-with-zero summation is correct.
        for edge in &mut self.edges {
            edge.fill_silence(frames);
        }

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
                PlannedNode::Sine(s) => {
                    process_sine(s, &self.midi_boxes[idx], &mut self.edges, frames);
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
                    let inbox = &mut self.midi_boxes[target].inbox;
                    for &msg in &self.distribute_scratch {
                        if route.zone.is_none_or(|z| zone_passes(z, msg)) {
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
    hw_midi_target: Option<NodeIndex>,
    sinks: Vec<NodeIndex>,
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
            hw_midi_target: None,
            sinks: Vec::new(),
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

        self.topo = order;
        Ok(())
    }

    fn pick_hw_midi_target(&mut self, graph: &FlatGraph) {
        for (i, n) in graph.nodes.iter().enumerate() {
            if n.kind == NodeKind::SourceKeyboard {
                self.hw_midi_target = Some(i);
                return;
            }
        }
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
                NodeKind::InstrumentSine => {
                    let (out_l, out_r) = match resolve_stereo_outputs(n, i, &self.output_port_edge)
                    {
                        Some(pair) => pair,
                        None => {
                            // No stereo output ports — treat as Silent.
                            self.nodes.push(PlannedNode::Silent);
                            continue;
                        }
                    };
                    let polyphony = extract_polyphony(&n.config).unwrap_or(8);
                    PlannedNode::Sine(SineRuntime {
                        synth: Synth::new(SAMPLE_RATE, polyphony.max(1)),
                        out_l_edge: out_l,
                        out_r_edge: out_r,
                        scratch: vec![0.0; (MAX_FRAMES * 2) as usize],
                    })
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
            self.nodes.push(planned);
        }
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
            hw_midi_target: self.hw_midi_target,
            sinks: self.sinks,
            distribute_scratch: Vec::with_capacity(EVENT_QUEUE),
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

fn process_sine(s: &mut SineRuntime, midi_box: &MidiBox, edges: &mut [StereoEdge], frames: usize) {
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
        // sine -> eq -> sink
        let sine = node(
            "sine",
            NodeKind::InstrumentSine,
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

    #[test]
    fn hw_midi_targets_first_keyboard() {
        let kb1 = node("kb1", NodeKind::SourceKeyboard, vec![midi_out("out")]);
        let kb2 = node("kb2", NodeKind::SourceKeyboard, vec![midi_out("out")]);
        let sink = node(
            "sink",
            NodeKind::SinkMainOut,
            vec![
                audio_in("in-l", StereoChannel::L),
                audio_in("in-r", StereoChannel::R),
            ],
        );
        let graph = PatchGraph {
            nodes: vec![kb1, kb2, sink],
            wires: vec![],
            composites: vec![],
        };
        let out = Plan::build(&graph).expect("plan should build");
        assert_eq!(out.plan.hw_midi_target, Some(0));
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

        // Hardware MIDI routes to the keyboard.
        assert_eq!(out.plan.hw_midi_target, Some(0));

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
}
