import type { SoundBlock } from "@/components/sound/sound-flow"
import type { Sound } from "@/screens/patch-editor"

// =============================================================================
// Little Shop of Horrors (1982, off-Broadway). The canonical Keys-2 book
// with weird custom synths, multi-keyboard splits, and lots of patch
// changes. Used as demo data through the app.
// =============================================================================

export const LSOH_ACT_ONE = [
  {
    id: "s1",
    number: 1,
    name: "Prologue / Little Shop of Horrors",
    patches: [
      { id: "s1.1", number: 1, name: "Narrator strings" },
      { id: "s1.2", number: 2, name: "Doo-wop trio entrance" },
      { id: "s1.3", number: 3, name: "Audrey II growl" },
    ],
  },
  {
    id: "s2",
    number: 2,
    name: "Skid Row (Downtown)",
    patches: [
      { id: "s2.1", number: 1, name: "Verse groove", compound: true },
      { id: "s2.2", number: 2, name: "Chorus tutti", compound: true },
      { id: "s2.3", number: 3, name: "Audrey II tag" },
      { id: "s2.4", number: 4, name: "Outro vamp" },
    ],
  },
  {
    id: "s3",
    number: 3,
    name: "Da-Doo",
    patches: [
      { id: "s3.1", number: 1, name: "Verse — Rhodes" },
      { id: "s3.2", number: 2, name: "Hand-claps + bass" },
    ],
  },
  {
    id: "s4",
    number: 4,
    name: "Grow For Me",
    patches: [
      { id: "s4.1", number: 1, name: "Verse — acoustic" },
      { id: "s4.2", number: 2, name: "Lift — strings", compound: true },
      { id: "s4.3", number: 3, name: "Outro chord" },
    ],
  },
  {
    id: "s5",
    number: 5,
    name: "Ya Never Know",
    patches: [
      { id: "s5.1", number: 1, name: "Vamp" },
      { id: "s5.2", number: 2, name: "Stings" },
    ],
  },
  {
    id: "s6",
    number: 6,
    name: "Somewhere That's Green",
    patches: [
      { id: "s6.1", number: 1, name: "Audrey verse — Wurli" },
      { id: "s6.2", number: 2, name: "Bridge strings", compound: true },
      { id: "s6.3", number: 3, name: "Outro reprise" },
    ],
  },
  {
    id: "s7",
    number: 7,
    name: "Closed For Renovations",
    patches: [
      { id: "s7.1", number: 1, name: "Setup vamp" },
      { id: "s7.2", number: 2, name: "Trio entrance" },
    ],
  },
  {
    id: "s8",
    number: 8,
    name: "Dentist!",
    patches: [
      { id: "s8.1", number: 1, name: "Intro organ stab" },
      { id: "s8.2", number: 2, name: "Orin verse", compound: true },
      { id: "s8.3", number: 3, name: "Bridge — sax synth" },
      { id: "s8.4", number: 4, name: "Outro vamp" },
    ],
  },
  {
    id: "s9",
    number: 9,
    name: "Mushnik and Son",
    patches: [
      { id: "s9.1", number: 1, name: "Klezmer accordion" },
      { id: "s9.2", number: 2, name: "Mushnik verse" },
    ],
  },
  {
    id: "s10",
    number: 10,
    name: "Sudden Changes",
    patches: [
      { id: "s10.1", number: 1, name: "Underscore pad" },
      { id: "s10.2", number: 2, name: "Bell motif" },
    ],
  },
  {
    id: "s11",
    number: 11,
    name: "Feed Me (Git It)",
    patches: [
      { id: "s11.1", number: 1, name: "Audrey II groove", compound: true },
      { id: "s11.2", number: 2, name: "Seymour reply" },
      { id: "s11.3", number: 3, name: "Tutti chorus", compound: true },
      { id: "s11.4", number: 4, name: "Outro stab" },
    ],
  },
]

export const LSOH_ACT_TWO = [
  {
    id: "s12",
    number: 12,
    name: "Suppertime",
    patches: [
      { id: "s12.1", number: 1, name: "Audrey II vamp" },
      { id: "s12.2", number: 2, name: "Bridge brass" },
    ],
  },
  {
    id: "s13",
    number: 13,
    name: "The Meek Shall Inherit",
    patches: [
      { id: "s13.1", number: 1, name: "Salesmen verse" },
      { id: "s13.2", number: 2, name: "Seymour decision", compound: true },
      { id: "s13.3", number: 3, name: "Outro stab" },
    ],
  },
  {
    id: "s14",
    number: 14,
    name: "Suddenly, Seymour",
    patches: [
      { id: "s14.1", number: 1, name: "Verse — Wurli soft" },
      { id: "s14.2", number: 2, name: "Chorus — strings layer", compound: true },
      { id: "s14.3", number: 3, name: "Outro pad" },
    ],
  },
  {
    id: "s15",
    number: 15,
    name: "Sominex / Suppertime (reprise)",
    patches: [
      { id: "s15.1", number: 1, name: "Tense pad" },
      { id: "s15.2", number: 2, name: "Plant reprise" },
    ],
  },
  {
    id: "s16",
    number: 16,
    name: "Don't Feed the Plants",
    patches: [
      { id: "s16.1", number: 1, name: "Finale tutti", compound: true },
      { id: "s16.2", number: 2, name: "Plant takeover" },
      { id: "s16.3", number: 3, name: "Curtain chord" },
    ],
  },
]

export const LSOH_FULL = [...LSOH_ACT_ONE, ...LSOH_ACT_TWO]

// =============================================================================
// Demo rig: typical theatre keys-2 setup — small controller on top of a
// weighted stage piano. Both are sound sources; the Launchkey also has
// pads/knobs/faders (controllers) which are not shown in the patch editor.
// =============================================================================

export type RigKeyboard = {
  id: string
  name: string
  shortName: string
  /** MIDI note number, lowest key */
  fromNote: number
  /** MIDI note number, highest key */
  toNote: number
  /** Default channel it transmits on */
  defaultChannel: number
  /** Display stacking order — 0 = top, N = bottom. Mirrors physical setup. */
  stackOrder: number
  /** Default bend wheel range in semitones (e.g. 2 = ±2 st) */
  bendRangeSemitones?: number
  /** True if this device has a mod wheel (most keyboards do) */
  hasModWheel?: boolean
  /** Compound device: drum / trigger pads on the same hardware */
  pads?: { rows: number; cols: number }
}

export const LSOH_KEYBOARDS: RigKeyboard[] = [
  {
    id: "launchkey49",
    name: "Novation Launchkey 49",
    shortName: "Launchkey",
    fromNote: 36, // C2
    toNote: 84,   // C6
    defaultChannel: 2,
    stackOrder: 0, // top
    bendRangeSemitones: 2,
    hasModWheel: true,
    pads: { rows: 2, cols: 8 },
  },
  {
    id: "rd2000",
    name: "Roland RD-2000",
    shortName: "RD-2000",
    fromNote: 21,  // A0
    toNote: 108,   // C8
    defaultChannel: 1,
    stackOrder: 1, // bottom
    bendRangeSemitones: 2,
    hasModWheel: true,
  },
]

// =============================================================================
// Demo patch: "Skid Row · Verse groove" — 3 sounds across both keyboards.
//   Launchkey ⇒ Rhodes EP across the controller range
//   RD-2000   ⇒ split: synth bass lower, B3 organ upper
// =============================================================================

const synthBassBlocks: SoundBlock[] = [
  {
    kind: "instrument",
    id: "diva-bass",
    name: "Diva",
    vendor: "u-he",
    format: "VST3",
    cpu: 0.08,
    summary: "Synth Bass · MS2",
  },
  {
    kind: "effect",
    id: "bass-eq",
    name: "EQ",
    format: "built-in",
    summary: "low boost +6 dB · HPF 40 Hz",
  },
]

const organBlocks: SoundBlock[] = [
  {
    kind: "instrument",
    id: "b3",
    name: "Vintage B3",
    vendor: "GG Audio",
    format: "VST3",
    cpu: 0.1,
    summary: "drawbars 88 8000 000",
  },
  {
    kind: "effect",
    id: "leslie",
    name: "Leslie",
    format: "built-in",
    summary: "slow → fast on mod wheel",
  },
  {
    kind: "effect",
    id: "drive",
    name: "Tube Drive",
    format: "built-in",
    summary: "+3 dB · warm",
  },
]

const rhodesBlocks: SoundBlock[] = [
  {
    kind: "instrument",
    id: "scarbee",
    name: "Scarbee Mark I",
    vendor: "Native Instruments",
    format: "VST3",
    cpu: 0.14,
    summary: "Mk I · suitcase · soft",
  },
  {
    kind: "effect",
    id: "chorus",
    name: "Chorus",
    format: "built-in",
    summary: "rate 2.4 Hz · depth 30%",
  },
  {
    kind: "effect",
    id: "ep-verb",
    name: "Valhalla VintageVerb",
    vendor: "Valhalla DSP",
    format: "VST3",
    cpu: 0.04,
    summary: "small room · wet 22%",
  },
]

export const SKID_ROW_VERSE_SOUNDS: Sound[] = [
  {
    id: "bass",
    name: "Synth bass",
    color: "var(--chart-1)",
    source: {
      deviceId: "rd2000",
      channel: 1,
      range: { fromNote: 21, toNote: 55 }, // A0 – G3
    },
    blocks: synthBassBlocks,
    level: 0.82,
  },
  {
    id: "organ",
    name: "B3 organ",
    color: "var(--chart-2)",
    source: {
      deviceId: "rd2000",
      channel: 1,
      range: { fromNote: 56, toNote: 96 }, // G#3 – C7
    },
    blocks: organBlocks,
    level: 0.7,
  },
  {
    id: "rhodes",
    name: "Rhodes EP",
    color: "var(--chart-3)",
    source: {
      deviceId: "launchkey49",
      channel: 2,
      range: { fromNote: 36, toNote: 84 }, // full Launchkey range
    },
    blocks: rhodesBlocks,
    level: 0.65,
  },
]

// Single-sound demo (for the "simple patch" story)
export const SOMEWHERE_VERSE_SOUND: Sound[] = [
  {
    id: "audrey-wurli",
    name: "Audrey verse Wurli",
    color: "var(--chart-3)",
    source: {
      deviceId: "rd2000",
      channel: 1,
      range: { fromNote: 36, toNote: 84 },
    },
    blocks: [
      {
        kind: "instrument",
        id: "diva-wurli",
        name: "Diva",
        vendor: "u-he",
        format: "VST3",
        cpu: 0.12,
        summary: "Wurli soft · slow attack",
      },
      {
        kind: "effect",
        id: "verse-verb",
        name: "Valhalla Supermassive",
        vendor: "Valhalla DSP",
        format: "VST3",
        cpu: 0.05,
        summary: "Gravitas · wet 18%",
      },
    ],
    level: 0.75,
    linkedPresetId: "preset-wurli-soft",
  },
]

// Default post-mix FX chain for the LSoH demo — global EQ + compressor +
// limiter on the patch master.
export const LSOH_POST_MIX_FX: SoundBlock[] = [
  {
    kind: "effect",
    id: "post-eq",
    name: "EQ",
    format: "built-in",
    summary: "low-cut 80 Hz · high shelf +1.5 dB",
  },
  {
    kind: "effect",
    id: "post-comp",
    name: "Compressor",
    format: "built-in",
    summary: "−18 dB · 3:1 · 8/60 ms",
  },
  {
    kind: "effect",
    id: "post-limit",
    name: "Limiter",
    format: "built-in",
    summary: "ceiling −0.3 dB",
  },
]

// Pads-triggered drum kit on the Launchkey for Audrey II rhythm hits.
// Range field is unused when padIndices is set — the kit triggers from
// specific pad positions on the controller's pad grid.
export const FEED_ME_PAD_KIT_SOUND: Sound = {
  id: "audrey-kit",
  name: "Audrey rhythm kit",
  color: "var(--chart-5)",
  source: {
    deviceId: "launchkey49",
    channel: 10, // standard MIDI drum channel
    range: { fromNote: 36, toNote: 51 }, // ignored when padIndices set
    padIndices: [0, 1, 2, 3, 4, 5, 6, 7], // top row of 8 pads
  },
  blocks: [
    {
      kind: "instrument",
      id: "kit-bfd",
      name: "BFD3",
      vendor: "inMusic",
      format: "VST3",
      cpu: 0.18,
      summary: "Studio kit · close mics only",
    },
    {
      kind: "effect",
      id: "kit-bus",
      name: "Compressor",
      format: "built-in",
      summary: "−12 dB · 4:1 · slow attack",
    },
  ],
  level: 0.7,
}

// Overlapping-range demo: Audrey II growl layered with sub-bass on the
// same keyboard. Shows the zone-bar multi-lane stacking.
export const FEED_ME_AUDREY_SOUNDS: Sound[] = [
  {
    id: "audrey-bass",
    name: "Audrey sub",
    color: "var(--chart-1)",
    source: {
      deviceId: "rd2000",
      channel: 1,
      range: { fromNote: 21, toNote: 48 }, // A0 – C3
    },
    blocks: [
      {
        kind: "instrument",
        id: "diva-sub",
        name: "Diva",
        vendor: "u-he",
        format: "VST3",
        cpu: 0.09,
        summary: "Sub sine · low-pass 200 Hz",
      },
      {
        kind: "effect",
        id: "audrey-eq",
        name: "EQ",
        format: "built-in",
        summary: "boost 40 Hz +6 dB",
      },
    ],
    level: 0.78,
  },
  {
    id: "audrey-growl",
    name: "Audrey growl (layer)",
    color: "var(--chart-4)",
    source: {
      deviceId: "rd2000",
      channel: 1,
      range: { fromNote: 36, toNote: 67 }, // C2 – G4 — overlaps the sub
    },
    blocks: [
      {
        kind: "instrument",
        id: "fm8",
        name: "FM8",
        vendor: "Native Instruments",
        format: "VST3",
        cpu: 0.16,
        summary: "Custom · 'Plant Snarl' FM patch",
      },
      {
        kind: "effect",
        id: "audrey-dist",
        name: "Tube Drive",
        format: "built-in",
        summary: "+9 dB · saturated",
      },
      {
        kind: "effect",
        id: "audrey-verb",
        name: "Valhalla Supermassive",
        vendor: "Valhalla DSP",
        format: "VST3",
        cpu: 0.05,
        summary: "huge · wet 45%",
      },
    ],
    level: 0.72,
    outputBus: "Patch mix",
  },
  {
    id: "audrey-stab",
    name: "Stab hits (Launchkey pads)",
    color: "var(--chart-3)",
    source: {
      deviceId: "launchkey49",
      channel: 2,
      range: { fromNote: 36, toNote: 84 },
    },
    blocks: [
      {
        kind: "instrument",
        id: "brass",
        name: "Spitfire BBC SO",
        vendor: "Spitfire Audio",
        format: "VST3",
        cpu: 0.22,
        summary: "Brass · stab · short",
      },
    ],
    level: 0.6,
    midiOut: { deviceId: "forscore-virtual", channel: 16 },
  },
]

// =============================================================================
// Compatibility re-exports — old stories haven't all been rewritten yet.
// These will be removed once every consumer references the LSOH_* names.
// =============================================================================
export const HAMILTON_ACT_ONE = LSOH_ACT_ONE
export const VERSE_SPLIT_CHAINS = SKID_ROW_VERSE_SOUNDS
