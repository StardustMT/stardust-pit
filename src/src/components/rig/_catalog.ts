/**
 * Rig component catalog — atomic building blocks the user picks from
 * when assembling a rig.
 *
 * For POC we model components by *type*, not specific make/model: any
 * 88-key controller is just a "keyboard". A future iteration may bundle
 * pre-configured complex widgets (e.g. "Novation Launchkey 49" auto-
 * adding a keyboard + pads + 8 knobs + 9 faders + transport switches +
 * mod wheel + pitch wheel + sustain pedal jack — all the atoms below,
 * pre-wired).
 */

import type { NodeKind } from "@/components/patch-graph/_types"
import type { RigComponentConfig, RigComponentWire } from "@/lib/tauri"

export type RigComponentGroup = "instrument" | "controller"

export type RigComponentKind =
  // Instruments — things you play notes from
  | "keyboard"
  | "pads"
  // Controllers — things you modulate / trigger with
  | "switch"
  | "sustain-pedal"
  | "expression-pedal"
  | "pitch-wheel"
  | "mod-wheel"
  | "knob"
  | "fader"

export interface RigComponentSpec {
  kind: RigComponentKind
  group: RigComponentGroup
  label: string
  description: string
}

export const RIG_COMPONENT_CATALOG: RigComponentSpec[] = [
  // Instruments
  {
    kind: "keyboard",
    group: "instrument",
    label: "Keyboard",
    description: "Piano keyboard. Learn the lowest + highest keys you have.",
  },
  {
    kind: "pads",
    group: "instrument",
    label: "Pads",
    description: "Grid of velocity-sensitive pads. Configure rows × cols, Learn each pad.",
  },

  // Controllers
  {
    kind: "switch",
    group: "controller",
    label: "Switch",
    description: "Generic footswitch or button. Momentary or toggle.",
  },
  {
    kind: "sustain-pedal",
    group: "controller",
    label: "Sustain pedal",
    description: "Sustain footswitch — typically CC 64. Momentary.",
  },
  {
    kind: "expression-pedal",
    group: "controller",
    label: "Expression pedal",
    description: "Continuous foot pedal for sweep control.",
  },
  {
    kind: "pitch-wheel",
    group: "controller",
    label: "Pitch wheel",
    description: "Spring-loaded wheel sending pitch-bend with center detent.",
  },
  {
    kind: "mod-wheel",
    group: "controller",
    label: "Mod wheel",
    description: "Continuous wheel — typically CC 1, no center snap.",
  },
  {
    kind: "knob",
    group: "controller",
    label: "Knob",
    description: "Rotary control. Absolute or relative range.",
  },
  {
    kind: "fader",
    group: "controller",
    label: "Fader",
    description: "Linear control. Absolute 0–127 range.",
  },
]

export function findComponent(kind: RigComponentKind): RigComponentSpec | undefined {
  return RIG_COMPONENT_CATALOG.find((c) => c.kind === kind)
}

// =============================================================================
// Kind mapping — catalog kind ↔ source.* NodeKind
//
// The 9 catalog kinds correspond 1:1 to the 9 `source.*` node kinds: a
// source node in a patch *is* a rig component appearing in that patch
// (#122). Persisted components carry the NodeKind form.
// =============================================================================

export function nodeKindFor(kind: RigComponentKind): NodeKind {
  return `source.${kind}` as NodeKind
}

export function rigKindFor(kind: NodeKind): RigComponentKind | undefined {
  if (!kind.startsWith("source.")) return undefined
  return kind.slice("source.".length) as RigComponentKind
}

// =============================================================================
// Component construction + display helpers
//
// The persisted shape is `RigComponentWire` (`lib/tauri.ts`, mirroring
// `stardust_show::RigComponent`); the helpers here build sensible
// defaults per kind and derive display strings from the config bag.
// =============================================================================

export function defaultConfigForKind(kind: RigComponentKind): RigComponentConfig {
  switch (kind) {
    case "keyboard":
      return { channel: 1 }
    case "pads":
      return { rows: 4, cols: 4, channel: 10, padNotes: [] }
    case "switch":
      return { switchMode: "momentary" }
    case "sustain-pedal":
      return { switchMode: "momentary" }
    case "expression-pedal":
      return { polarity: "normal", expressionMin: 0, expressionMax: 127 }
    case "pitch-wheel":
      return { pitchRangeSemitones: 2 }
    case "mod-wheel":
      return {}
    case "knob":
      return { controlRange: "absolute" }
    case "fader":
      return { controlRange: "absolute" }
  }
}

/** Human string for a component's captured MIDI source, e.g. "CC 64 · ch 1". */
export function sourceLabel(config: RigComponentConfig | undefined): string | undefined {
  if (!config?.source) return undefined
  const ch = config.channel !== undefined ? ` · ch ${config.channel}` : ""
  switch (config.source.type) {
    case "cc":
      return `CC ${config.source.cc}${ch}`
    case "pitchBend":
      return `Pitch bend${ch}`
    case "note":
      return `Note ${noteLabel(config.source.note)}${ch}`
  }
}

/** Human string for a component's device binding, or undefined if unbound. */
export function deviceLabel(config: RigComponentConfig | undefined): string | undefined {
  const device = config?.device
  if (!device) return undefined
  return device.name || (device.id ?? undefined)
}

/** One-line summary for outlines / cards. */
export function summaryFor(c: RigComponentWire): string {
  const cfg = c.config
  const kind = rigKindFor(c.kind)
  switch (kind) {
    case "keyboard": {
      const kc = keyCount(cfg?.lowNote, cfg?.highNote)
      const range =
        cfg?.lowNote !== undefined && cfg?.highNote !== undefined
          ? `${noteLabel(cfg.lowNote)}–${noteLabel(cfg.highNote)}`
          : "range not learned"
      return `${kc ?? "?"} keys · ${range} · ch ${cfg?.channel ?? "—"}`
    }
    case "pads": {
      const r = cfg?.rows ?? 0
      const cols = cfg?.cols ?? 0
      const learned = (cfg?.padNotes ?? []).filter((n) => n !== null && n !== undefined).length
      return `${r}×${cols} · ${learned}/${r * cols} learned · ch ${cfg?.channel ?? "—"}`
    }
    case "switch":
      return `${cfg?.switchMode ?? "—"} · ${sourceLabel(cfg) ?? "unassigned"}`
    case "sustain-pedal":
    case "mod-wheel":
      return sourceLabel(cfg) ?? "unassigned"
    case "expression-pedal":
      return `${cfg?.polarity ?? "—"} · ${sourceLabel(cfg) ?? "unassigned"}`
    case "pitch-wheel":
      return `±${cfg?.pitchRangeSemitones ?? 2} st · ${sourceLabel(cfg) ?? "unassigned"}`
    case "knob":
    case "fader":
      return `${cfg?.controlRange ?? "—"} · ${sourceLabel(cfg) ?? "unassigned"}`
    default:
      return c.kind
  }
}

/** Whether the component has a hardware device bound (Learned). */
export function isBound(c: RigComponentWire): boolean {
  return c.config?.device !== undefined
}

// =============================================================================
// Helpers
// =============================================================================

/** Convert MIDI note number to label like "C4" or "F#3". */
export function noteLabel(midi: number): string {
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
  const octave = Math.floor(midi / 12) - 1
  return `${names[midi % 12]}${octave}`
}

/** Derived key count for a keyboard. Returns undefined if range not yet learned. */
export function keyCount(low: number | undefined, high: number | undefined): number | undefined {
  if (low === undefined || high === undefined) return undefined
  if (high < low) return undefined
  return high - low + 1
}
