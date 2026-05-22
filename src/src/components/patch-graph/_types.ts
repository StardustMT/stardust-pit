/**
 * Patch-graph data types.
 *
 * A Patch's contents is a directed graph of nodes connected by typed wires.
 * Five node classes (source / midi-processor / instrument / audio-effect /
 * sink, plus the auxiliary audio-router). Wires carry either MIDI or audio;
 * the types prevent connecting incompatible ports.
 *
 * Composite blocks bound a sub-region of the graph and surface promoted
 * ports — they're how we represent both user-saved "patch presets" and
 * future vendor-shipped "pre-configured complex widgets" (Launchkey 49 etc.).
 *
 * This file is the in-memory + persisted shape. Schema versioning lives at
 * the persistence boundary (per ADR-0003).
 */

// =============================================================================
// Port + wire types
// =============================================================================

export type SignalKind = "midi" | "audio"

export type PortDirection = "in" | "out"

export interface Port {
  /** Stable per-node port id (e.g. "midi-in", "out-low", "audio-l"). */
  id: string
  /** Display label in the node body + when promoted. */
  label: string
  signal: SignalKind
  direction: PortDirection
  /**
   * Optional kind-specific config carried alongside the port — e.g. a keyboard
   * source's per-zone out carries a `range` so the wire is meaningful.
   */
  config?: PortConfig
}

export type PortConfig =
  | {
      kind: "zone"
      fromNote: number
      toNote: number
      /** Optional accent hue (oklch). Used to tint the zone in the live
       *  preview keyboard, the port subtitle, and (when wireFollowsColor)
       *  wires drawn from this zone. */
      colorHue?: number
      /** When true, new wires drawn from this zone start out the zone's
       *  colour. Users who want zone-vs-wire colours to differ can flip
       *  this off and pick a wire colour independently. Default: true. */
      wireFollowsColor?: boolean
    }
  | { kind: "pad"; padIndex: number; note?: number }
  | { kind: "channel"; midiChannel: number }
  | { kind: "stereo"; channel: "L" | "R" }
  | { kind: "mono" }

// =============================================================================
// Nodes
// =============================================================================

export type NodeKind =
  // sources
  | "source.keyboard"
  | "source.pads"
  | "source.switch"
  | "source.sustain-pedal"
  | "source.expression-pedal"
  | "source.pitch-wheel"
  | "source.mod-wheel"
  | "source.knob"
  | "source.fader"
  // midi processors
  | "midi.transpose"
  | "midi.mix"
  // instruments
  | "instrument.plugin"
  | "instrument.sine" // built-in
  // audio effects
  | "audio.eq"
  | "audio.mix"
  // sinks
  | "sink.main-out"

export type NodeClass =
  | "source"
  | "midi-processor"
  | "instrument"
  | "audio-effect"
  | "audio-router"
  | "sink"

export function classOf(kind: NodeKind): NodeClass {
  if (kind.startsWith("source.")) return "source"
  if (kind.startsWith("midi.")) return "midi-processor"
  if (kind.startsWith("instrument.")) return "instrument"
  if (kind.startsWith("audio.")) return "audio-effect"
  if (kind.startsWith("router.")) return "audio-router"
  return "sink"
}

/** A placed node instance on the canvas. */
export interface GraphNode {
  /** Stable within the graph. */
  id: string
  kind: NodeKind
  /** User-editable label shown on the node header. */
  name: string
  /** Canvas position in pixels (top-left of node bounding box). */
  x: number
  y: number
  /** Port set — fixed by kind for simple nodes, dynamic for keyboards/pads/mixes. */
  ports: Port[]
  /** Free-form per-kind config bag (transpose semitones, plugin URI, etc.). */
  config?: Record<string, unknown>
}

// =============================================================================
// Wires
// =============================================================================

export interface Wire {
  id: string
  fromNode: string
  fromPort: string
  toNode: string
  toPort: string
  /**
   * Per-wire color override. When undefined the renderer uses the signal
   * default (midi vs audio palette). Users can re-colour individual cables
   * to disambiguate dense regions.
   */
  color?: string
}

// =============================================================================
// Composite blocks
// =============================================================================

export interface PromotedPort {
  id: string
  label: string
  direction: PortDirection
  signal: SignalKind
  internalNode: string
  internalPort: string
}

export interface CompositeBlock {
  id: string
  name: string
  /** Member node ids — must form a connected subgraph. */
  contains: string[]
  /** Locked = the composite drags as one unit; internals hidden until unlocked. */
  locked: boolean
  /**
   * Promoted ports surface inner ports as the composite's own outer ports.
   * `internalNode` + `internalPort` reference the actual port; `label` is
   * what shows on the composite outer frame. Wires may reference a composite
   * + promotedPort.id as one of their endpoints — the renderer treats the
   * promoted port as the wire target on the composite frame, with a
   * "wireless" visual link to the internal port it represents.
   */
  promotedPorts: PromotedPort[]
  /** Optional per-composite accent hue (oklch hue, 0-360). */
  colorHue?: number
}

// =============================================================================
// The patch graph
// =============================================================================

export interface PatchGraph {
  nodes: GraphNode[]
  wires: Wire[]
  composites: CompositeBlock[]
}

export function emptyGraph(): PatchGraph {
  return { nodes: [], wires: [], composites: [] }
}

// =============================================================================
// instrument.plugin config
//
// `GraphNode.config` is intentionally a free-form bag (per ADR-0004); these
// helpers narrow it for the one kind that the engine actually consumes today.
// The bundle path + plugin id are what `engine_start_from_patch` looks for;
// the cached name/vendor are for UI rendering so we don't have to re-scan
// `list_clap_plugins` just to show a label.
// =============================================================================

export interface PluginChoice {
  bundlePath: string
  pluginId: string
  pluginName?: string
  pluginVendor?: string
}

/**
 * Read the plugin choice off an `instrument.plugin` node. Returns
 * `undefined` for any other node kind, or when the node hasn't had a
 * plugin picked yet (empty bundle / id).
 */
export function getPluginChoice(node: GraphNode): PluginChoice | undefined {
  if (node.kind !== "instrument.plugin") return undefined
  const cfg = node.config
  if (!cfg) return undefined
  const bundlePath = cfg.bundlePath
  const pluginId = cfg.pluginId
  if (typeof bundlePath !== "string" || bundlePath === "") return undefined
  if (typeof pluginId !== "string" || pluginId === "") return undefined
  const pluginName = typeof cfg.pluginName === "string" ? cfg.pluginName : undefined
  const pluginVendor = typeof cfg.pluginVendor === "string" ? cfg.pluginVendor : undefined
  return { bundlePath, pluginId, pluginName, pluginVendor }
}

// =============================================================================
// Visual palette per class (shared between node header + wire defaults)
// =============================================================================

export const CLASS_COLORS: Record<NodeClass, { hue: number; label: string }> = {
  source: { hue: 200, label: "Source" }, // blue
  "midi-processor": { hue: 280, label: "MIDI" }, // violet
  instrument: { hue: 30, label: "Instrument" }, // warm orange
  "audio-effect": { hue: 145, label: "Audio FX" }, // green
  "audio-router": { hue: 95, label: "Router" }, // yellow-green
  sink: { hue: 350, label: "Output" }, // muted red
}

/** Default wire color per signal kind — overridable per Wire. */
export const SIGNAL_DEFAULT_COLORS: Record<SignalKind, string> = {
  midi: "oklch(0.7 0.15 280)", // matches midi-processor hue
  audio: "oklch(0.7 0.15 145)", // matches audio-effect hue
}
