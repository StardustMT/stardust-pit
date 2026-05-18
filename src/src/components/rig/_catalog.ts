/**
 * Rig component catalog — generic building blocks the user picks from
 * when assembling a rig.
 *
 * For POC we model components by *type*, not specific make/model: any
 * 88-key controller is a "keyboard". A future iteration may bundle
 * pre-configured complex widgets (e.g. "Novation Launchkey 49" auto-
 * adding a keyboard + pads + 8 knobs + 9 faders + transport switches).
 */

export type RigComponentGroup = "instrument" | "controller"

export type RigComponentKind =
  // Instruments — things you play
  | "keyboard"
  | "pads"
  // Controllers — things you modulate / trigger with
  | "switch"
  | "expression-pedal"
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
    description: "Piano keyboard. 25–88 keys; configure size in settings.",
  },
  {
    kind: "pads",
    group: "instrument",
    label: "Pads",
    description: "Grid of velocity-sensitive pads. Configure grid in settings.",
  },

  // Controllers
  {
    kind: "switch",
    group: "controller",
    label: "Switch",
    description: "Footswitch or hardware button. Momentary or toggle.",
  },
  {
    kind: "expression-pedal",
    group: "controller",
    label: "Expression pedal",
    description: "Continuous foot pedal for sweep control.",
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
 * the kind are meaningful (e.g. `keys` only applies to "keyboard").
 */
export interface RigComponentInstance {
  instanceId: string
  name: string
  kind: RigComponentKind

  // Common across all kinds
  midiInput?: string // captured by Learn — port name like "USB MIDI Port 1"
  midiChannel?: number // 1..16, or undefined for omni

  // Keyboard
  keys?: number // 25, 32, 49, 61, 73, 76, 88
  pitchRangeSemitones?: number // default 2
  hasPitchWheel?: boolean
  hasModWheel?: boolean
  sustainSource?: string // Learn — typically CC 64
  modWheelSource?: string // Learn — typically CC 1

  // Pads
  rows?: number
  cols?: number
  baseNote?: number // first pad MIDI note (mocked Learn: e.g. 36 for MPC)

  // Switch
  switchMode?: "momentary" | "toggle"
  switchSource?: string // Learn — "CC 64 ch 1" or "Note 60 ch 10"

  // Expression pedal
  expressionSource?: string // Learn — "CC 11 ch 1"
  polarity?: "normal" | "inverted"
  expressionMin?: number // 0..127
  expressionMax?: number // 0..127

  // Knob / Fader
  controlSource?: string // Learn — "CC 7 ch 1"
  controlRange?: "absolute" | "relative"
}

export function defaultsForKind(
  kind: RigComponentKind
): Partial<RigComponentInstance> {
  switch (kind) {
    case "keyboard":
      return {
        keys: 88,
        midiChannel: 1,
        pitchRangeSemitones: 2,
        hasPitchWheel: true,
        hasModWheel: true,
      }
    case "pads":
      return { rows: 4, cols: 4, midiChannel: 10, baseNote: 36 }
    case "switch":
      return { switchMode: "momentary", midiChannel: 1 }
    case "expression-pedal":
      return {
        polarity: "normal",
        expressionMin: 0,
        expressionMax: 127,
        midiChannel: 1,
      }
    case "knob":
      return { controlRange: "absolute", midiChannel: 1 }
    case "fader":
      return { controlRange: "absolute", midiChannel: 1 }
  }
}
