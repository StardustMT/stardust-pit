import type { Meta, StoryObj } from "@storybook/react"
import * as React from "react"
import {
  AppShellFrame,
  InspectorFrame,
} from "@/components/shell/app-shell-frame"
import type { AppMode } from "@/components/shell/nav-rail"
import { PatchCanvas } from "@/components/patch-graph/patch-canvas"
import { makeNode } from "@/components/patch-graph/_catalog"
import { NodeLibraryPanel } from "@/components/patch-graph/node-library-panel"
import {
  PatchOutline,
  type OutlineSong,
} from "@/components/patch-graph/patch-outline"
import type { NodeKind, PatchGraph } from "@/components/patch-graph/_types"

const meta: Meta = {
  title: "Screens/Program/Patch Editor v5 — Node Graph",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Patch as a freeform node graph. v5 redesign — replaces the linear " +
          "sound-chain model with a drag-drop signal-flow canvas. " +
          "Iteration 2: pedal-style nodes (mini-widgets per kind), populated " +
          "left+right panels, composite block frame. Bottom inspector + top " +
          "live-preview tab + drag interaction land in iterations 3 & 4.",
      },
    },
  },
}
export default meta
type Story = StoryObj

// =============================================================================
// Seed: songs / patches for the left outline panel
// =============================================================================

const LSOH_SONGS: OutlineSong[] = [
  {
    id: "s1",
    name: "Prologue",
    patches: [
      { id: "p1.1", name: "Cold open" },
      { id: "p1.2", name: "Underscoring" },
    ],
  },
  {
    id: "s2",
    name: "Skid Row (Downtown)",
    patches: [
      { id: "p2.1", name: "Verse groove" },
      { id: "p2.2", name: "Chorus pads" },
      { id: "p2.3", name: "Final lift" },
    ],
  },
  {
    id: "s3",
    name: "Somewhere That's Green",
    patches: [
      { id: "p3.1", name: "Solo piano" },
      { id: "p3.2", name: "Strings entry" },
    ],
  },
  {
    id: "s4",
    name: "Feed Me (Git It)",
    patches: [
      { id: "p4.1", name: "Stab section" },
      { id: "p4.2", name: "Growl bass + pads" },
    ],
  },
  {
    id: "s5",
    name: "Suddenly Seymour",
    patches: [{ id: "p5.1", name: "Acoustic + strings" }],
  },
]

// =============================================================================
// Seed graphs
// =============================================================================

function casualPatchGraph(): PatchGraph {
  const keyboard = makeNode("source.keyboard", { x: 60, y: 200 })
  keyboard.name = "Main keyboard"
  const sine = makeNode("instrument.sine", { x: 400, y: 200 })
  sine.name = "Sine synth"
  const out = makeNode("sink.main-out", { x: 740, y: 200 })

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

function transposedSplitPatchGraph(): PatchGraph {
  const keyboard = makeNode("source.keyboard", { x: 60, y: 240 })
  keyboard.name = "Main keyboard"
  keyboard.ports = [
    {
      id: "out-low",
      label: "Low (C2–B3)",
      signal: "midi",
      direction: "out",
      config: { kind: "zone", fromNote: 36, toNote: 59 },
    },
    {
      id: "out-high",
      label: "High (C4–C8)",
      signal: "midi",
      direction: "out",
      config: { kind: "zone", fromNote: 60, toNote: 108 },
    },
  ]

  const transpose = makeNode("midi.transpose", { x: 380, y: 120 })
  transpose.name = "−12 semitones"
  transpose.config = { semitones: -12 }

  const bass = makeNode("instrument.plugin", { x: 660, y: 120 })
  bass.name = "Bass synth"
  bass.config = { pluginUri: "Surge XT", preset: "MS-20 Bass" }

  const lead = makeNode("instrument.plugin", { x: 660, y: 400 })
  lead.name = "Lead synth"
  lead.config = { pluginUri: "Surge XT", preset: "Modern Brass" }

  const mix = makeNode("audio.mix", { x: 1000, y: 260 })
  mix.name = "Sum"

  const out = makeNode("sink.main-out", { x: 1320, y: 260 })

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

/**
 * Piano with parallel dry + wet (reverb) sends. Demonstrates:
 *   • Multiple wires INTO one port (keyboard + sustain both feed piano.midi-in
 *     — the engine auto-merges; no explicit MIDI mix node needed)
 *   • Multiple wires OUT of one port (piano stereo outs branch to EQ + reverb)
 *   • Sum at the audio mix node
 */
function pianoWithSendsPatchGraph(): PatchGraph {
  const keyboard = makeNode("source.keyboard", { x: 60, y: 180 })
  keyboard.name = "Main keyboard"
  const sustain = makeNode("source.sustain-pedal", { x: 60, y: 400 })
  sustain.name = "Sustain"

  const piano = makeNode("instrument.plugin", { x: 420, y: 240 })
  piano.name = "Piano"
  piano.config = { pluginUri: "Surge XT", preset: "Felt Piano" }

  const eq = makeNode("audio.eq", { x: 780, y: 140 })
  eq.name = "EQ"
  eq.config = { low: 2, mid: -1, high: 3 }

  const reverb = makeNode("audio.eq", { x: 780, y: 400 })
  reverb.name = "Reverb (placeholder)"

  const mix = makeNode("audio.mix", { x: 1100, y: 260 })
  mix.name = "Dry + wet"

  const out = makeNode("sink.main-out", { x: 1420, y: 260 })

  return {
    nodes: [keyboard, sustain, piano, eq, reverb, mix, out],
    wires: [
      // Both MIDI sources directly into piano.midi-in (engine auto-merges)
      { id: "w1", fromNode: keyboard.id, fromPort: "out", toNode: piano.id, toPort: "midi-in" },
      { id: "w2", fromNode: sustain.id, fromPort: "out", toNode: piano.id, toPort: "midi-in" },
      // Piano stereo into both EQ (dry) and reverb (send)
      { id: "w3", fromNode: piano.id, fromPort: "audio-l", toNode: eq.id, toPort: "in-l" },
      { id: "w4", fromNode: piano.id, fromPort: "audio-r", toNode: eq.id, toPort: "in-r" },
      { id: "w5", fromNode: piano.id, fromPort: "audio-l", toNode: reverb.id, toPort: "in-l" },
      { id: "w6", fromNode: piano.id, fromPort: "audio-r", toNode: reverb.id, toPort: "in-r" },
      // EQ + reverb summed
      { id: "w7", fromNode: eq.id, fromPort: "out-l", toNode: mix.id, toPort: "in-1-l" },
      { id: "w8", fromNode: eq.id, fromPort: "out-r", toNode: mix.id, toPort: "in-1-r" },
      { id: "w9", fromNode: reverb.id, fromPort: "out-l", toNode: mix.id, toPort: "in-2-l" },
      { id: "w10", fromNode: reverb.id, fromPort: "out-r", toNode: mix.id, toPort: "in-2-r" },
      // Mix to out
      { id: "w11", fromNode: mix.id, fromPort: "out-l", toNode: out.id, toPort: "in-l" },
      { id: "w12", fromNode: mix.id, fromPort: "out-r", toNode: out.id, toPort: "in-r" },
    ],
    composites: [],
  }
}

/**
 * Shows a composite block ("B3 + Leslie") wrapping an instrument + EQ as a
 * locked, reusable sub-graph. In the real app this lives in the user's
 * "My Blocks" library; drag onto any patch to drop a pre-wired chain.
 */
function compositeBlockPatchGraph(): PatchGraph {
  const keyboard = makeNode("source.keyboard", { x: 60, y: 220 })
  keyboard.name = "Main keyboard"
  const expression = makeNode("source.expression-pedal", { x: 60, y: 440 })
  expression.name = "Leslie speed pedal"

  // Inside the composite:
  const organ = makeNode("instrument.plugin", { x: 460, y: 180 })
  organ.name = "B3 organ"
  organ.config = { pluginUri: "Surge XT", preset: "Tonewheel" }

  const leslie = makeNode("audio.eq", { x: 760, y: 180 })
  leslie.name = "Leslie sim"

  const out = makeNode("sink.main-out", { x: 1100, y: 220 })

  return {
    nodes: [keyboard, expression, organ, leslie, out],
    wires: [
      { id: "w1", fromNode: keyboard.id, fromPort: "out", toNode: organ.id, toPort: "midi-in" },
      { id: "w2", fromNode: expression.id, fromPort: "out", toNode: leslie.id, toPort: "in-l" },
      { id: "w3", fromNode: organ.id, fromPort: "audio-l", toNode: leslie.id, toPort: "in-l" },
      { id: "w4", fromNode: organ.id, fromPort: "audio-r", toNode: leslie.id, toPort: "in-r" },
      { id: "w5", fromNode: leslie.id, fromPort: "out-l", toNode: out.id, toPort: "in-l" },
      { id: "w6", fromNode: leslie.id, fromPort: "out-r", toNode: out.id, toPort: "in-r" },
    ],
    composites: [
      {
        id: "c1",
        name: "B3 + Leslie",
        contains: [organ.id, leslie.id],
        locked: true,
        promotedPorts: [
          {
            id: "in", label: "Keys", direction: "in", signal: "midi",
            internalNode: organ.id, internalPort: "midi-in",
          },
          {
            id: "out-l", label: "Out L", direction: "out", signal: "audio",
            internalNode: leslie.id, internalPort: "out-l",
          },
          {
            id: "out-r", label: "Out R", direction: "out", signal: "audio",
            internalNode: leslie.id, internalPort: "out-r",
          },
        ],
      },
    ],
  }
}

// =============================================================================
// Stories
// =============================================================================

export const CasualPatch: Story = {
  name: "Casual patch (Keyboard → Sine → Output)",
  render: () => (
    <PatchEditorShell
      graph={casualPatchGraph()}
      songs={LSOH_SONGS}
      selectedPatchId="p1.1"
      showName="Untitled show"
    />
  ),
}

export const SplitWithTranspose: Story = {
  name: "Split keyboard + transpose + parallel synths",
  render: () => (
    <PatchEditorShell
      graph={transposedSplitPatchGraph()}
      songs={LSOH_SONGS}
      selectedPatchId="p4.2"
      showName="Little Shop of Horrors"
    />
  ),
}

export const PianoWithSends: Story = {
  name: "Piano with EQ + reverb send (auto-merged MIDI in)",
  render: () => (
    <PatchEditorShell
      graph={pianoWithSendsPatchGraph()}
      songs={LSOH_SONGS}
      selectedPatchId="p3.1"
      showName="Little Shop of Horrors"
    />
  ),
}

export const WithCompositeBlock: Story = {
  name: "With composite block (B3 + Leslie, locked)",
  render: () => (
    <PatchEditorShell
      graph={compositeBlockPatchGraph()}
      songs={LSOH_SONGS}
      selectedPatchId="p2.2"
      showName="Little Shop of Horrors"
      savedComposites={[
        { id: "b3", name: "B3 + Leslie", nodeCount: 2 },
        { id: "rhodes", name: "Rhodes + chorus + tape", nodeCount: 3 },
        { id: "pad", name: "Lush pad layer", nodeCount: 4 },
      ]}
    />
  ),
}

// =============================================================================
// Shell
// =============================================================================

function PatchEditorShell({
  graph: initialGraph,
  songs,
  selectedPatchId: initialSelectedPatchId,
  showName,
  savedComposites = [],
}: {
  graph: PatchGraph
  songs: OutlineSong[]
  selectedPatchId?: string
  showName: string
  savedComposites?: Array<{ id: string; name: string; nodeCount: number }>
}) {
  const [mode, setMode] = React.useState<AppMode>("program")
  const [graph, setGraph] = React.useState<PatchGraph>(initialGraph)
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | undefined>()
  const [selectedPatchId, setSelectedPatchId] = React.useState<string | undefined>(
    initialSelectedPatchId
  )

  // Stub: clicking a library item drops a node in the upper-left of the canvas.
  // Real placement / drag-and-drop is iteration 4.
  const handleAddNode = (kind: NodeKind) => {
    const x = 40 + ((graph.nodes.length * 30) % 200)
    const y = 80 + ((graph.nodes.length * 50) % 300)
    const node = makeNode(kind, { x, y })
    setGraph((g) => ({ ...g, nodes: [...g.nodes, node] }))
    setSelectedNodeId(node.id)
  }

  return (
    <AppShellFrame
      mode={mode}
      onModeChange={setMode}
      showName={showName}
      contextPanel={
        <PatchOutline
          songs={songs}
          selectedPatchId={selectedPatchId}
          onSelectPatch={(_s, pid) => setSelectedPatchId(pid)}
        />
      }
      inspector={
        <InspectorFrame>
          <NodeLibraryPanel
            onAddNode={handleAddNode}
            savedComposites={savedComposites}
          />
        </InspectorFrame>
      }
      canvas={
        <PatchCanvas
          graph={graph}
          selectedNodeId={selectedNodeId}
          onSelectNode={setSelectedNodeId}
        />
      }
    />
  )
}
