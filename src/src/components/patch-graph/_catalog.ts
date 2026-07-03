/**
 * Catalog of available node kinds — the right-panel "Base" tab is built
 * directly from this list. User-saved composites live in the "My Blocks"
 * tab separately.
 *
 * Each spec carries its default port set + initial config. Per-instance
 * port lists can grow (keyboard adding zone outs, mix node adding inputs).
 */

import type { GraphNode, NodeClass, NodeKind, Port } from "./_types"
import { classOf } from "./_types"

export interface NodeSpec {
  kind: NodeKind
  class: NodeClass
  label: string
  description: string
  defaultPorts: () => Port[]
  defaultConfig?: () => Record<string, unknown>
  /**
   * When true, the node is not shown in the user-facing palette but the
   * spec is still available to `makeNode` and to render-paths that need
   * to display migrated documents. Used by `instrument.testtone`, the
   * engine self-test diagnostic.
   */
  hidden?: boolean
}

// =============================================================================
// Spec catalog
// =============================================================================

export const NODE_CATALOG: NodeSpec[] = [
  // -------------------------------------------------------------------------
  // Sources
  // -------------------------------------------------------------------------
  {
    kind: "source.keyboard",
    class: "source",
    label: "Keyboard",
    description: "Piano keyboard. Add zone outs in settings to split the range.",
    defaultPorts: () => [{ id: "out", label: "MIDI out", signal: "midi", direction: "out" }],
  },
  {
    kind: "source.pads",
    class: "source",
    label: "Pads",
    description: "Grid of pads. Add per-pad outs in settings.",
    defaultPorts: () => [{ id: "out", label: "MIDI out", signal: "midi", direction: "out" }],
  },
  {
    kind: "source.switch",
    class: "source",
    label: "Switch",
    description: "Generic footswitch or button.",
    defaultPorts: () => [{ id: "out", label: "MIDI out", signal: "midi", direction: "out" }],
  },
  {
    kind: "source.sustain-pedal",
    class: "source",
    label: "Sustain pedal",
    description: "Sustain footswitch — typically CC 64.",
    defaultPorts: () => [{ id: "out", label: "MIDI out", signal: "midi", direction: "out" }],
  },
  {
    kind: "source.expression-pedal",
    class: "source",
    label: "Expression pedal",
    description: "Continuous foot pedal.",
    defaultPorts: () => [{ id: "out", label: "MIDI out", signal: "midi", direction: "out" }],
  },
  {
    kind: "source.pitch-wheel",
    class: "source",
    label: "Pitch wheel",
    description: "Spring-loaded pitch bend wheel.",
    defaultPorts: () => [{ id: "out", label: "MIDI out", signal: "midi", direction: "out" }],
  },
  {
    kind: "source.mod-wheel",
    class: "source",
    label: "Mod wheel",
    description: "Continuous wheel — typically CC 1.",
    defaultPorts: () => [{ id: "out", label: "MIDI out", signal: "midi", direction: "out" }],
  },
  {
    kind: "source.knob",
    class: "source",
    label: "Knob",
    description: "Rotary control.",
    defaultPorts: () => [{ id: "out", label: "MIDI out", signal: "midi", direction: "out" }],
  },
  {
    kind: "source.fader",
    class: "source",
    label: "Fader",
    description: "Linear control.",
    defaultPorts: () => [{ id: "out", label: "MIDI out", signal: "midi", direction: "out" }],
  },

  // -------------------------------------------------------------------------
  // MIDI processors
  // -------------------------------------------------------------------------
  {
    kind: "midi.transpose",
    class: "midi-processor",
    label: "Transpose",
    description: "Shift incoming MIDI notes by N semitones.",
    defaultPorts: () => [
      { id: "in", label: "MIDI in", signal: "midi", direction: "in" },
      { id: "out", label: "MIDI out", signal: "midi", direction: "out" },
    ],
    defaultConfig: () => ({ semitones: 0 }),
  },
  {
    kind: "midi.mix",
    class: "midi-processor",
    label: "MIDI mix",
    description: "Sum multiple MIDI streams into one. Add inputs in settings.",
    defaultPorts: () => [
      { id: "in-1", label: "In 1", signal: "midi", direction: "in" },
      { id: "in-2", label: "In 2", signal: "midi", direction: "in" },
      { id: "out", label: "MIDI out", signal: "midi", direction: "out" },
    ],
  },

  // -------------------------------------------------------------------------
  // Instruments
  // -------------------------------------------------------------------------
  {
    kind: "instrument.plugin",
    class: "instrument",
    label: "Plugin instrument",
    description: "Load a CLAP or VST3 instrument plugin.",
    defaultPorts: () => [
      { id: "midi-in", label: "MIDI in", signal: "midi", direction: "in" },
      {
        id: "audio-l",
        label: "Audio L",
        signal: "audio",
        direction: "out",
        config: { kind: "stereo", channel: "L" },
      },
      {
        id: "audio-r",
        label: "Audio R",
        signal: "audio",
        direction: "out",
        config: { kind: "stereo", channel: "R" },
      },
    ],
    // Picker writes { bundlePath, pluginId, pluginName, pluginVendor } once
    // the user chooses a plugin. Empty default = "no plugin picked yet".
    defaultConfig: () => ({}),
  },
  {
    // Built-in test-tone generator. Hidden from the user palette — the
    // only user-facing surface is Settings → "Run engine self-test".
    // Kept in the catalog so `makeNode` and the canvas renderers still
    // resolve its defaults when loading migrated v1 documents.
    kind: "instrument.testtone",
    class: "instrument",
    label: "Test tone (diagnostic)",
    description: "Polyphonic sine voice used by the engine self-test diagnostic.",
    hidden: true,
    defaultPorts: () => [
      { id: "midi-in", label: "MIDI in", signal: "midi", direction: "in" },
      {
        id: "audio-l",
        label: "Audio L",
        signal: "audio",
        direction: "out",
        config: { kind: "stereo", channel: "L" },
      },
      {
        id: "audio-r",
        label: "Audio R",
        signal: "audio",
        direction: "out",
        config: { kind: "stereo", channel: "R" },
      },
    ],
    defaultConfig: () => ({ polyphony: 8 }),
  },

  // -------------------------------------------------------------------------
  // Audio effects
  // -------------------------------------------------------------------------
  {
    kind: "audio.eq",
    class: "audio-effect",
    label: "EQ",
    description: "3-band equalizer. Stereo in / stereo out.",
    defaultPorts: () => [
      {
        id: "in-l",
        label: "In L",
        signal: "audio",
        direction: "in",
        config: { kind: "stereo", channel: "L" },
      },
      {
        id: "in-r",
        label: "In R",
        signal: "audio",
        direction: "in",
        config: { kind: "stereo", channel: "R" },
      },
      {
        id: "out-l",
        label: "Out L",
        signal: "audio",
        direction: "out",
        config: { kind: "stereo", channel: "L" },
      },
      {
        id: "out-r",
        label: "Out R",
        signal: "audio",
        direction: "out",
        config: { kind: "stereo", channel: "R" },
      },
    ],
    defaultConfig: () => ({ low: 0, mid: 0, high: 0 }),
  },
  {
    kind: "audio.mix",
    class: "audio-effect",
    label: "Audio mix",
    description: "Sum multiple audio streams. Add input pairs in settings.",
    defaultPorts: () => [
      {
        id: "in-1-l",
        label: "1 L",
        signal: "audio",
        direction: "in",
        config: { kind: "stereo", channel: "L" },
      },
      {
        id: "in-1-r",
        label: "1 R",
        signal: "audio",
        direction: "in",
        config: { kind: "stereo", channel: "R" },
      },
      {
        id: "in-2-l",
        label: "2 L",
        signal: "audio",
        direction: "in",
        config: { kind: "stereo", channel: "L" },
      },
      {
        id: "in-2-r",
        label: "2 R",
        signal: "audio",
        direction: "in",
        config: { kind: "stereo", channel: "R" },
      },
      {
        id: "out-l",
        label: "Out L",
        signal: "audio",
        direction: "out",
        config: { kind: "stereo", channel: "L" },
      },
      {
        id: "out-r",
        label: "Out R",
        signal: "audio",
        direction: "out",
        config: { kind: "stereo", channel: "R" },
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Sinks
  // -------------------------------------------------------------------------
  {
    kind: "sink.main-out",
    class: "sink",
    label: "Main output",
    description: "Routes to the show's primary audio output.",
    defaultPorts: () => [
      {
        id: "in-l",
        label: "In L",
        signal: "audio",
        direction: "in",
        config: { kind: "stereo", channel: "L" },
      },
      {
        id: "in-r",
        label: "In R",
        signal: "audio",
        direction: "in",
        config: { kind: "stereo", channel: "R" },
      },
    ],
  },
]

export function findSpec(kind: NodeKind): NodeSpec | undefined {
  return NODE_CATALOG.find((s) => s.kind === kind)
}

/** Human label for a node *type* (e.g. "Keyboard", "Transpose", "EQ"). */
export function typeLabelFor(kind: NodeKind): string {
  return findSpec(kind)?.label ?? kind
}

let nextId = 1
/**
 * Build a fresh graph node. `overrides.name` replaces the spec's default
 * label (used when dropping a CLAP plugin from the library so the new
 * node reads "Surge XT" instead of "Plugin instrument"); `overrides.config`
 * replaces the spec's default config bag entirely (used to pre-fill the
 * plugin choice on a dropped `instrument.plugin`).
 */
export function makeNode(
  kind: NodeKind,
  position: { x: number; y: number },
  overrides?: { name?: string; config?: Record<string, unknown> },
): GraphNode {
  const spec = findSpec(kind)
  if (!spec) throw new Error(`Unknown node kind: ${kind}`)
  return {
    id: `n${nextId++}`,
    kind,
    name: overrides?.name ?? spec.label,
    x: position.x,
    y: position.y,
    ports: spec.defaultPorts(),
    config: overrides?.config ?? spec.defaultConfig?.(),
  }
}

export function nodeClass(node: GraphNode): NodeClass {
  return classOf(node.kind)
}
