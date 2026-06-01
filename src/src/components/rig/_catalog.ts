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
// Per-instance configuration model
// =============================================================================

/**
 * A placed rig component instance — type + per-instance config.
 * The config bag carries kind-specific settings; only fields relevant to
 * the kind are meaningful (e.g. `lowNote` only applies to "keyboard").
 */
export interface RigComponentInstance {
  instanceId: string
  name: string
  kind: RigComponentKind

  // Common across most kinds
  midiInput?: string // Learn captures this — e.g. "USB MIDI Port 1"
  midiChannel?: number // 1..16; undefined = omni

  // Keyboard — keys are derived from learned [lowNote, highNote]
  lowNote?: number // MIDI note number, 0..127
  highNote?: number // MIDI note number, 0..127

  // Pads — flat row-major grid; padAssignments[row*cols + col] = learned note
  rows?: number
  cols?: number
  padAssignments?: Array<{ note?: number } | undefined>

  // Switch + Sustain pedal
  switchMode?: "momentary" | "toggle"
  switchSource?: string // Learn — "CC 64 ch 1"

  // Expression pedal
  expressionSource?: string // Learn
  polarity?: "normal" | "inverted"
  expressionMin?: number // 0..127
  expressionMax?: number // 0..127

  // Pitch wheel
  pitchSource?: string // Learn — "Pitch bend ch 1"
  pitchRangeSemitones?: number // default 2

  // Mod wheel
  modSource?: string // Learn — "CC 1 ch 1"

  // Knob / Fader
  controlSource?: string // Learn — "CC 7 ch 1"
  controlRange?: "absolute" | "relative"
}

export function defaultsForKind(kind: RigComponentKind): Partial<RigComponentInstance> {
  switch (kind) {
    case "keyboard":
      return { midiChannel: 1 }
    case "pads":
      return { rows: 4, cols: 4, midiChannel: 10, padAssignments: [] }
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
