/**
 * Fixture data shared between Storybook (which exercises the patch
 * editor with several pre-built scenarios) and the real Tauri app
 * (which seeds an initial show + patch until persistence lands).
 *
 * Once stardust-core grows a patch graph type system + persistence
 * (ADR-0003), these factories migrate to the backend and the UI
 * loads serialised data instead. For now they're the source of
 * truth for "what does Stardust look like before anyone has saved
 * anything?".
 */

import { makeNode } from "@/components/patch-graph/_catalog"
import type { PatchGraph } from "@/components/patch-graph/_types"
import type { RigSource } from "@/components/patch-graph/right-panel"
import type { OutlineSong as ShowOutlineSong } from "@/components/show/show-outline"

// =============================================================================
// Show outline — Little Shop of Horrors
// =============================================================================

export const LSOH_SONGS: ShowOutlineSong[] = [
  {
    id: "s1",
    number: 1,
    name: "Prologue",
    patches: [
      { id: "p1.1", number: 1, name: "Cold open" },
      { id: "p1.2", number: 2, name: "Underscoring" },
    ],
  },
  {
    id: "s2",
    number: 2,
    name: "Skid Row (Downtown)",
    patches: [
      { id: "p2.1", number: 1, name: "Verse groove" },
      { id: "p2.2", number: 2, name: "Chorus pads" },
      { id: "p2.3", number: 3, name: "Final lift" },
    ],
  },
  {
    id: "s3",
    number: 3,
    name: "Somewhere That's Green",
    patches: [
      { id: "p3.1", number: 1, name: "Solo piano" },
      { id: "p3.2", number: 2, name: "Strings entry" },
    ],
  },
  {
    id: "s4",
    number: 4,
    name: "Feed Me (Git It)",
    patches: [
      { id: "p4.1", number: 1, name: "Stab section" },
      { id: "p4.2", number: 2, name: "Growl bass + pads" },
    ],
  },
  {
    id: "s5",
    number: 5,
    name: "Suddenly Seymour",
    patches: [{ id: "p5.1", number: 1, name: "Acoustic + strings" }],
  },
]

// =============================================================================
// Patch graph factories
// =============================================================================

export function casualPatchGraph(): PatchGraph {
  const keyboard = makeNode("source.keyboard", { x: 80, y: 220 })
  keyboard.name = "Main keyboard"
  const sine = makeNode("instrument.testtone", { x: 420, y: 220 })
  sine.name = "Test tone"
  const out = makeNode("sink.main-out", { x: 760, y: 220 })
  return {
    nodes: [keyboard, sine, out],
    wires: [
      { id: "w1", fromNode: keyboard.id, fromPort: "out", toNode: sine.id, toPort: "midi-in" },
      { id: "w2", fromNode: sine.id, fromPort: "audio-l", toNode: out.id, toPort: "in-l" },
      { id: "w3", fromNode: sine.id, fromPort: "audio-r", toNode: out.id, toPort: "in-r" },
    ],
    composites: [],
  }
}

export function transposedSplitPatchGraph(): PatchGraph {
  const keyboard = makeNode("source.keyboard", { x: 80, y: 240 })
  keyboard.name = "Main keyboard"
  keyboard.ports = [
    {
      id: "out-low",
      label: "Low",
      signal: "midi",
      direction: "out",
      config: { kind: "zone", fromNote: 36, toNote: 59 },
    },
    {
      id: "out-high",
      label: "High",
      signal: "midi",
      direction: "out",
      config: { kind: "zone", fromNote: 60, toNote: 108 },
    },
  ]
  const transpose = makeNode("midi.transpose", { x: 420, y: 100 })
  transpose.name = "Down an octave"
  transpose.config = { semitones: -12 }
  const bass = makeNode("instrument.plugin", { x: 720, y: 100 })
  bass.name = "Bass synth"
  const lead = makeNode("instrument.plugin", { x: 720, y: 400 })
  lead.name = "Lead synth"
  const mix = makeNode("audio.mix", { x: 1060, y: 260 })
  mix.name = "Sum"
  const out = makeNode("sink.main-out", { x: 1400, y: 260 })
  return {
    nodes: [keyboard, transpose, bass, lead, mix, out],
    wires: [
      { id: "w1", fromNode: keyboard.id, fromPort: "out-low", toNode: transpose.id, toPort: "in" },
      { id: "w2", fromNode: transpose.id, fromPort: "out", toNode: bass.id, toPort: "midi-in" },
      { id: "w3", fromNode: keyboard.id, fromPort: "out-high", toNode: lead.id, toPort: "midi-in" },
      { id: "w4", fromNode: bass.id, fromPort: "audio-l", toNode: mix.id, toPort: "in-1-l" },
      { id: "w5", fromNode: bass.id, fromPort: "audio-r", toNode: mix.id, toPort: "in-1-r" },
      { id: "w6", fromNode: lead.id, fromPort: "audio-l", toNode: mix.id, toPort: "in-2-l" },
      { id: "w7", fromNode: lead.id, fromPort: "audio-r", toNode: mix.id, toPort: "in-2-r" },
      { id: "w8", fromNode: mix.id, fromPort: "out-l", toNode: out.id, toPort: "in-l" },
      { id: "w9", fromNode: mix.id, fromPort: "out-r", toNode: out.id, toPort: "in-r" },
    ],
    composites: [],
  }
}

export function pianoWithSendsPatchGraph(): PatchGraph {
  const keyboard = makeNode("source.keyboard", { x: 80, y: 200 })
  keyboard.name = "Main keyboard"
  const sustain = makeNode("source.sustain-pedal", { x: 80, y: 460 })
  sustain.name = "Sustain"
  const piano = makeNode("instrument.plugin", { x: 460, y: 260 })
  piano.name = "Piano"
  const eq = makeNode("audio.eq", { x: 820, y: 140 })
  eq.name = "EQ"
  eq.config = { low: 2, mid: -1, high: 3 }
  const reverb = makeNode("audio.eq", { x: 820, y: 440 })
  reverb.name = "Reverb"
  const mix = makeNode("audio.mix", { x: 1140, y: 280 })
  mix.name = "Dry + wet"
  const out = makeNode("sink.main-out", { x: 1480, y: 280 })
  return {
    nodes: [keyboard, sustain, piano, eq, reverb, mix, out],
    wires: [
      { id: "w1", fromNode: keyboard.id, fromPort: "out", toNode: piano.id, toPort: "midi-in" },
      { id: "w2", fromNode: sustain.id, fromPort: "out", toNode: piano.id, toPort: "midi-in" },
      { id: "w3", fromNode: piano.id, fromPort: "audio-l", toNode: eq.id, toPort: "in-l" },
      { id: "w4", fromNode: piano.id, fromPort: "audio-r", toNode: eq.id, toPort: "in-r" },
      { id: "w5", fromNode: piano.id, fromPort: "audio-l", toNode: reverb.id, toPort: "in-l" },
      { id: "w6", fromNode: piano.id, fromPort: "audio-r", toNode: reverb.id, toPort: "in-r" },
      { id: "w7", fromNode: eq.id, fromPort: "out-l", toNode: mix.id, toPort: "in-1-l" },
      { id: "w8", fromNode: eq.id, fromPort: "out-r", toNode: mix.id, toPort: "in-1-r" },
      { id: "w9", fromNode: reverb.id, fromPort: "out-l", toNode: mix.id, toPort: "in-2-l" },
      { id: "w10", fromNode: reverb.id, fromPort: "out-r", toNode: mix.id, toPort: "in-2-r" },
      { id: "w11", fromNode: mix.id, fromPort: "out-l", toNode: out.id, toPort: "in-l" },
      { id: "w12", fromNode: mix.id, fromPort: "out-r", toNode: out.id, toPort: "in-r" },
    ],
    composites: [],
  }
}

export function compositeBlockPatchGraph(): PatchGraph {
  const keyboard = makeNode("source.keyboard", { x: 80, y: 220 })
  keyboard.name = "Main keyboard"
  const expression = makeNode("source.expression-pedal", { x: 80, y: 540 })
  expression.name = "Leslie speed pedal"
  const organ = makeNode("instrument.plugin", { x: 520, y: 220 })
  organ.name = "B3 organ"
  // Leslie sim has BOTH an audio chain and a MIDI control input (for the
  // expression pedal driving rotation speed).
  const leslie = makeNode("audio.eq", { x: 840, y: 220 })
  leslie.name = "Leslie sim"
  leslie.ports = [
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
    { id: "midi-speed", label: "Speed CC", signal: "midi", direction: "in" },
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
  ]
  const out = makeNode("sink.main-out", { x: 1200, y: 300 })
  const compositeId = "c1"
  return {
    nodes: [keyboard, expression, organ, leslie, out],
    wires: [
      // External wires target the composite's promoted ports — internal
      // ports show as "wireless" (dashed) on the organ/leslie nodes.
      { id: "w1", fromNode: keyboard.id, fromPort: "out", toNode: compositeId, toPort: "in" },
      { id: "w2", fromNode: expression.id, fromPort: "out", toNode: compositeId, toPort: "speed" },
      { id: "w5", fromNode: compositeId, fromPort: "out-l", toNode: out.id, toPort: "in-l" },
      { id: "w6", fromNode: compositeId, fromPort: "out-r", toNode: out.id, toPort: "in-r" },
      // Internal wires stay node-to-node inside the composite.
      { id: "w3", fromNode: organ.id, fromPort: "audio-l", toNode: leslie.id, toPort: "in-l" },
      { id: "w4", fromNode: organ.id, fromPort: "audio-r", toNode: leslie.id, toPort: "in-r" },
    ],
    composites: [
      {
        id: compositeId,
        name: "B3 + Leslie",
        contains: [organ.id, leslie.id],
        locked: true,
        colorHue: 60, // amber by default — picker can change
        promotedPorts: [
          {
            id: "in",
            label: "Keys",
            direction: "in",
            signal: "midi",
            internalNode: organ.id,
            internalPort: "midi-in",
          },
          {
            id: "speed",
            label: "Speed",
            direction: "in",
            signal: "midi",
            internalNode: leslie.id,
            internalPort: "midi-speed",
          },
          {
            id: "out-l",
            label: "Out L",
            direction: "out",
            signal: "audio",
            internalNode: leslie.id,
            internalPort: "out-l",
          },
          {
            id: "out-r",
            label: "Out R",
            direction: "out",
            signal: "audio",
            internalNode: leslie.id,
            internalPort: "out-r",
          },
        ],
      },
    ],
  }
}

// =============================================================================
// Rig sources
// =============================================================================

export const DEFAULT_RIG: RigSource[] = [
  { kind: "source.keyboard", label: "Nord Stage 3 keys" },
  { kind: "source.sustain-pedal", label: "Sustain pedal" },
  { kind: "source.expression-pedal", label: "Expression pedal" },
  { kind: "source.mod-wheel", label: "Mod wheel" },
  { kind: "source.pitch-wheel", label: "Pitch bend" },
]

export const FULL_RIG: RigSource[] = [
  ...DEFAULT_RIG,
  { kind: "source.pads", label: "Akai LPD-8 pads" },
  { kind: "source.switch", label: "Page-turn switch" },
  { kind: "source.knob", label: "Mod knob A" },
  { kind: "source.fader", label: "Volume fader" },
]
