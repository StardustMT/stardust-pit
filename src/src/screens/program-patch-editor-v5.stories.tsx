import type { Meta, StoryObj } from "@storybook/react"
import * as React from "react"
import {
  Box,
  ChevronRight,
  Copy,
  Lock,
  Music,
  Palette,
  Pencil,
  Plus,
  RotateCcw,
  Settings,
  Settings2,
  Trash2,
  Unlock,
  Volume2,
  Waves,
} from "lucide-react"
import {
  AppShellFrame,
  InspectorFrame,
} from "@/components/shell/app-shell-frame"
import type { AppMode } from "@/components/shell/nav-rail"
import { ShowOutline } from "@/components/show/show-outline"
import type { OutlineSong as ShowOutlineSong } from "@/components/show/show-outline"
import { PatchCanvas } from "@/components/patch-graph/patch-canvas"
import { makeNode } from "@/components/patch-graph/_catalog"
import { RightPanel } from "@/components/patch-graph/right-panel"
import { PatchTabRail, type PatchTabSpec } from "@/components/patch-graph/patch-tab-rail"
import { PatchTitleBar } from "@/components/patch-graph/patch-title-bar"
import { LivePreview } from "@/components/patch-graph/live-preview"
import {
  ContextMenu,
  type ContextMenuSection,
} from "@/components/patch-graph/context-menu"
import type {
  GraphNode,
  NodeKind,
  PatchGraph,
  Wire,
} from "@/components/patch-graph/_types"
import { CLASS_COLORS, classOf } from "@/components/patch-graph/_types"
import { cn } from "@/lib/utils"

const meta: Meta = {
  title: "Screens/Program/Patch Editor v5 — Node Graph",
  parameters: { layout: "fullscreen" },
}
export default meta
type Story = StoryObj

// =============================================================================
// Seed: songs / patches
// =============================================================================

const LSOH_SONGS: ShowOutlineSong[] = [
  { id: "s1", number: 1, name: "Prologue", patches: [
    { id: "p1.1", number: 1, name: "Cold open" },
    { id: "p1.2", number: 2, name: "Underscoring" },
  ] },
  { id: "s2", number: 2, name: "Skid Row (Downtown)", patches: [
    { id: "p2.1", number: 1, name: "Verse groove" },
    { id: "p2.2", number: 2, name: "Chorus pads" },
    { id: "p2.3", number: 3, name: "Final lift" },
  ] },
  { id: "s3", number: 3, name: "Somewhere That's Green", patches: [
    { id: "p3.1", number: 1, name: "Solo piano" },
    { id: "p3.2", number: 2, name: "Strings entry" },
  ] },
  { id: "s4", number: 4, name: "Feed Me (Git It)", patches: [
    { id: "p4.1", number: 1, name: "Stab section" },
    { id: "p4.2", number: 2, name: "Growl bass + pads" },
  ] },
  { id: "s5", number: 5, name: "Suddenly Seymour", patches: [
    { id: "p5.1", number: 1, name: "Acoustic + strings" },
  ] },
]

// =============================================================================
// Seed graphs
// =============================================================================

function casualPatchGraph(): PatchGraph {
  const keyboard = makeNode("source.keyboard", { x: 80, y: 200 })
  keyboard.name = "Main keyboard"
  const sine = makeNode("instrument.sine", { x: 420, y: 200 })
  sine.name = "Sine synth"
  const out = makeNode("sink.main-out", { x: 760, y: 200 })

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
  const keyboard = makeNode("source.keyboard", { x: 80, y: 240 })
  keyboard.name = "Main keyboard"
  keyboard.ports = [
    { id: "out-low", label: "Low (C2–B3)", signal: "midi", direction: "out", config: { kind: "zone", fromNote: 36, toNote: 59 } },
    { id: "out-high", label: "High (C4–C8)", signal: "midi", direction: "out", config: { kind: "zone", fromNote: 60, toNote: 108 } },
  ]
  const transpose = makeNode("midi.transpose", { x: 400, y: 100 })
  transpose.name = "−12 semitones"
  transpose.config = { semitones: -12 }
  const bass = makeNode("instrument.plugin", { x: 700, y: 100 })
  bass.name = "Bass synth"
  bass.config = { pluginUri: "Surge XT", preset: "MS-20 Bass" }
  const lead = makeNode("instrument.plugin", { x: 700, y: 400 })
  lead.name = "Lead synth"
  lead.config = { pluginUri: "Surge XT", preset: "Modern Brass" }
  const mix = makeNode("audio.mix", { x: 1040, y: 260 })
  mix.name = "Sum"
  const out = makeNode("sink.main-out", { x: 1380, y: 260 })

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

function pianoWithSendsPatchGraph(): PatchGraph {
  const keyboard = makeNode("source.keyboard", { x: 80, y: 180 })
  keyboard.name = "Main keyboard"
  const sustain = makeNode("source.sustain-pedal", { x: 80, y: 440 })
  sustain.name = "Sustain"
  const piano = makeNode("instrument.plugin", { x: 460, y: 240 })
  piano.name = "Piano"
  piano.config = { pluginUri: "Surge XT", preset: "Felt Piano" }
  const eq = makeNode("audio.eq", { x: 820, y: 140 })
  eq.name = "EQ"
  eq.config = { low: 2, mid: -1, high: 3 }
  const reverb = makeNode("audio.eq", { x: 820, y: 420 })
  reverb.name = "Reverb"
  const mix = makeNode("audio.mix", { x: 1140, y: 260 })
  mix.name = "Dry + wet"
  const out = makeNode("sink.main-out", { x: 1460, y: 260 })

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

function compositeBlockPatchGraph(): PatchGraph {
  const keyboard = makeNode("source.keyboard", { x: 80, y: 220 })
  keyboard.name = "Main keyboard"
  const expression = makeNode("source.expression-pedal", { x: 80, y: 480 })
  expression.name = "Leslie speed pedal"
  const organ = makeNode("instrument.plugin", { x: 500, y: 220 })
  organ.name = "B3 organ"
  organ.config = { pluginUri: "Surge XT", preset: "Tonewheel" }
  const leslie = makeNode("audio.eq", { x: 820, y: 220 })
  leslie.name = "Leslie sim"
  const out = makeNode("sink.main-out", { x: 1180, y: 300 })

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
          { id: "in", label: "Keys", direction: "in", signal: "midi", internalNode: organ.id, internalPort: "midi-in" },
          { id: "out-l", label: "Out L", direction: "out", signal: "audio", internalNode: leslie.id, internalPort: "out-l" },
          { id: "out-r", label: "Out R", direction: "out", signal: "audio", internalNode: leslie.id, internalPort: "out-r" },
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
      selectedPatchId="p1.1"
      patchName="Cold open"
      songName="Prologue"
    />
  ),
}

export const SplitWithTranspose: Story = {
  name: "Split keyboard + transpose + parallel synths",
  render: () => (
    <PatchEditorShell
      graph={transposedSplitPatchGraph()}
      selectedPatchId="p4.2"
      patchName="Growl bass + pads"
      songName="Feed Me (Git It)"
    />
  ),
}

export const PianoWithSends: Story = {
  name: "Piano with EQ + reverb send",
  render: () => (
    <PatchEditorShell
      graph={pianoWithSendsPatchGraph()}
      selectedPatchId="p3.1"
      patchName="Solo piano"
      songName="Somewhere That's Green"
    />
  ),
}

export const WithCompositeBlock: Story = {
  name: "With composite block (B3 + Leslie, locked)",
  render: () => (
    <PatchEditorShell
      graph={compositeBlockPatchGraph()}
      selectedPatchId="p2.2"
      patchName="Chorus pads"
      songName="Skid Row (Downtown)"
      savedComposites={[
        { id: "b3", name: "B3 + Leslie", nodeCount: 2 },
        { id: "rhodes", name: "Rhodes + chorus + tape", nodeCount: 3 },
        { id: "pad", name: "Lush pad layer", nodeCount: 4 },
      ]}
    />
  ),
}

// =============================================================================
// Wire color palette
// =============================================================================

const WIRE_COLORS: Array<{ id: string; label: string; color: string }> = [
  { id: "red", label: "Red", color: "oklch(0.7 0.20 25)" },
  { id: "orange", label: "Orange", color: "oklch(0.75 0.18 55)" },
  { id: "yellow", label: "Yellow", color: "oklch(0.85 0.18 95)" },
  { id: "green", label: "Green", color: "oklch(0.7 0.18 145)" },
  { id: "cyan", label: "Cyan", color: "oklch(0.75 0.15 200)" },
  { id: "blue", label: "Blue", color: "oklch(0.65 0.2 250)" },
  { id: "violet", label: "Violet", color: "oklch(0.65 0.2 290)" },
  { id: "pink", label: "Pink", color: "oklch(0.75 0.2 0)" },
  { id: "gray", label: "Gray", color: "oklch(0.6 0.02 0)" },
]

function colorDot(color: string): React.ComponentType<{ className?: string }> {
  const C = ({ className }: { className?: string }) => (
    <span
      className={cn("inline-block aspect-square rounded-full", className)}
      style={{ background: color }}
    />
  )
  C.displayName = `ColorDot(${color})`
  return C
}

// =============================================================================
// Shell
// =============================================================================

interface ContextMenuState {
  anchor: { x: number; y: number }
  sections: ContextMenuSection[]
}

type BottomTabId = "settings" | "mix" | "preview"

function PatchEditorShell({
  graph: initialGraph,
  selectedPatchId: initialSelectedPatchId,
  patchName,
  songName,
  savedComposites = [],
}: {
  graph: PatchGraph
  selectedPatchId?: string
  patchName: string
  songName: string
  savedComposites?: Array<{ id: string; name: string; nodeCount: number }>
}) {
  const [mode, setMode] = React.useState<AppMode>("program")
  const [graph, setGraph] = React.useState<PatchGraph>(initialGraph)
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | undefined>()
  const [selectedWireId, setSelectedWireId] = React.useState<string | undefined>()
  const [selectedCompositeId, setSelectedCompositeId] = React.useState<string | undefined>()
  const [selectedPatchId, setSelectedPatchId] = React.useState<string | undefined>(
    initialSelectedPatchId
  )
  const [contextMenu, setContextMenu] = React.useState<ContextMenuState | null>(null)
  const [bottomTabId, setBottomTabId] = React.useState<BottomTabId | null>(null)

  const selectedNode = graph.nodes.find((n) => n.id === selectedNodeId)
  const selectedWire = graph.wires.find((w) => w.id === selectedWireId)
  const selectedComposite = graph.composites.find((c) => c.id === selectedCompositeId)

  // Auto-open Settings tab when something gets selected.
  React.useEffect(() => {
    if (selectedNodeId || selectedWireId || selectedCompositeId) {
      setBottomTabId("settings")
    }
  }, [selectedNodeId, selectedWireId, selectedCompositeId])

  // Selecting a node clears wire/composite selection (and vice versa).
  const selectNode = (id: string | undefined) => {
    setSelectedNodeId(id)
    if (id) {
      setSelectedWireId(undefined)
      setSelectedCompositeId(undefined)
    }
  }
  const selectWire = (id: string | undefined) => {
    setSelectedWireId(id)
    if (id) {
      setSelectedNodeId(undefined)
      setSelectedCompositeId(undefined)
    }
  }
  const selectComposite = (id: string | undefined) => {
    setSelectedCompositeId(id)
    if (id) {
      setSelectedNodeId(undefined)
      setSelectedWireId(undefined)
    }
  }
  const deselectAll = () => {
    setSelectedNodeId(undefined)
    setSelectedWireId(undefined)
    setSelectedCompositeId(undefined)
  }

  // -----------------------------------------------------------------
  // Mutations
  // -----------------------------------------------------------------

  const addNode = (kind: NodeKind) => {
    const x = 80 + ((graph.nodes.length * 32) % 240)
    const y = 100 + ((graph.nodes.length * 56) % 300)
    const node = makeNode(kind, { x, y })
    setGraph((g) => ({ ...g, nodes: [...g.nodes, node] }))
    selectNode(node.id)
  }

  const moveNode = (id: string, x: number, y: number) => {
    setGraph((g) => ({
      ...g,
      nodes: g.nodes.map((n) => (n.id === id ? { ...n, x, y } : n)),
    }))
  }

  const deleteNode = (id: string) => {
    setGraph((g) => ({
      ...g,
      nodes: g.nodes.filter((n) => n.id !== id),
      wires: g.wires.filter((w) => w.fromNode !== id && w.toNode !== id),
      composites: g.composites
        .map((c) => ({ ...c, contains: c.contains.filter((c2) => c2 !== id) }))
        .filter((c) => c.contains.length > 0),
    }))
    if (selectedNodeId === id) selectNode(undefined)
  }

  const deleteWire = (id: string) => {
    setGraph((g) => ({ ...g, wires: g.wires.filter((w) => w.id !== id) }))
    if (selectedWireId === id) selectWire(undefined)
  }

  const deleteWiresInto = (nodeId: string, portId: string) => {
    setGraph((g) => ({
      ...g,
      wires: g.wires.filter((w) => !(w.toNode === nodeId && w.toPort === portId)),
    }))
  }

  const createWire = (p: {
    fromNode: string
    fromPort: string
    toNode: string
    toPort: string
  }) => {
    const dup = graph.wires.find(
      (w) =>
        w.fromNode === p.fromNode &&
        w.fromPort === p.fromPort &&
        w.toNode === p.toNode &&
        w.toPort === p.toPort
    )
    if (dup) return
    const id = `w-${Date.now()}`
    setGraph((g) => ({ ...g, wires: [...g.wires, { id, ...p }] }))
  }

  const setWireColor = (wireId: string, color: string | undefined) => {
    setGraph((g) => ({
      ...g,
      wires: g.wires.map((w) => (w.id === wireId ? { ...w, color } : w)),
    }))
  }

  const toggleCompositeLock = (id: string) => {
    setGraph((g) => ({
      ...g,
      composites: g.composites.map((c) =>
        c.id === id ? { ...c, locked: !c.locked } : c
      ),
    }))
  }

  const resizeZone = (
    nodeId: string,
    portId: string,
    range: { fromNote: number; toNote: number }
  ) => {
    setGraph((g) => ({
      ...g,
      nodes: g.nodes.map((n) => {
        if (n.id !== nodeId) return n
        return {
          ...n,
          ports: n.ports.map((p) => {
            if (p.id !== portId) return p
            const cfg = p.config?.kind === "zone" ? p.config : { kind: "zone" as const, fromNote: 0, toNote: 0 }
            return { ...p, config: { ...cfg, fromNote: range.fromNote, toNote: range.toNote } }
          }),
        }
      }),
    }))
  }

  // -----------------------------------------------------------------
  // Context menus
  // -----------------------------------------------------------------

  const openCanvasMenu = (anchor: { x: number; y: number }) => {
    setContextMenu({
      anchor,
      sections: [
        {
          id: "quick-add",
          items: [
            { id: "add-keyboard", label: "Add keyboard", icon: Music, onSelect: () => addNode("source.keyboard") },
            { id: "add-sine", label: "Add sine synth", icon: Waves, onSelect: () => addNode("instrument.sine") },
            { id: "add-eq", label: "Add EQ", icon: Settings2, onSelect: () => addNode("audio.eq") },
            { id: "add-out", label: "Add output", icon: Volume2, onSelect: () => addNode("sink.main-out") },
          ],
        },
      ],
    })
  }

  const openNodeMenu = (nodeId: string, anchor: { x: number; y: number }) => {
    selectNode(nodeId)
    setContextMenu({
      anchor,
      sections: [
        {
          id: "edit",
          items: [
            { id: "rename", label: "Rename", icon: Pencil, disabled: true },
            { id: "duplicate", label: "Duplicate", icon: Copy, disabled: true },
            { id: "wrap", label: "Wrap as composite…", icon: Box, disabled: true },
          ],
        },
        {
          id: "destroy",
          items: [{ id: "delete", label: "Delete node", icon: Trash2, variant: "danger", onSelect: () => deleteNode(nodeId) }],
        },
      ],
    })
  }

  const openWireMenu = (wireId: string, anchor: { x: number; y: number }) => {
    selectWire(wireId)
    setContextMenu({
      anchor,
      sections: [
        {
          id: "color",
          items: [
            { id: "color-default", label: "Default (signal color)", icon: RotateCcw, onSelect: () => setWireColor(wireId, undefined) },
            ...WIRE_COLORS.map((c) => ({
              id: `color-${c.id}`,
              label: c.label,
              icon: colorDot(c.color),
              onSelect: () => setWireColor(wireId, c.color),
            })),
          ],
        },
        {
          id: "destroy",
          items: [{ id: "delete", label: "Delete wire", icon: Trash2, variant: "danger", onSelect: () => deleteWire(wireId) }],
        },
      ],
    })
  }

  const openCompositeMenu = (id: string, anchor: { x: number; y: number }) => {
    selectComposite(id)
    const c = graph.composites.find((x) => x.id === id)
    if (!c) return
    setContextMenu({
      anchor,
      sections: [
        {
          id: "state",
          items: [
            { id: "lock", label: c.locked ? "Unlock (edit contents)" : "Lock (drag as one)", icon: c.locked ? Unlock : Lock, onSelect: () => toggleCompositeLock(id) },
            { id: "rename", label: "Rename composite", icon: Pencil, disabled: true },
            { id: "save", label: "Save to My Blocks…", icon: Plus, disabled: true },
          ],
        },
        {
          id: "destroy",
          items: [
            { id: "unwrap", label: "Unwrap (keep nodes)", icon: Box, disabled: true },
            { id: "delete", label: "Delete (and contained nodes)", icon: Trash2, variant: "danger", disabled: true },
          ],
        },
      ],
    })
  }

  // -----------------------------------------------------------------
  // Bottom tab content (Settings / Mix / Preview)
  // -----------------------------------------------------------------

  const settingsBreadcrumb: BreadcrumbItem[] = (() => {
    const items: BreadcrumbItem[] = [{ id: "patch", label: patchName, onClick: deselectAll }]
    if (selectedComposite) items.push({ id: "comp", label: selectedComposite.name })
    if (selectedNode) items.push({ id: "node", label: selectedNode.name })
    if (selectedWire) items.push({ id: "wire", label: "Wire" })
    return items
  })()

  const bottomTabs: PatchTabSpec[] = [
    {
      id: "settings",
      label: "Settings",
      content: (
        <SettingsTab
          breadcrumb={settingsBreadcrumb}
          selectedNode={selectedNode}
          selectedWire={selectedWire}
          selectedComposite={selectedComposite}
          onSetWireColor={(c) => selectedWire && setWireColor(selectedWire.id, c)}
          onDeleteWire={() => selectedWire && deleteWire(selectedWire.id)}
          onDeleteNode={() => selectedNode && deleteNode(selectedNode.id)}
          onToggleCompositeLock={() => selectedComposite && toggleCompositeLock(selectedComposite.id)}
        />
      ),
    },
    {
      id: "mix",
      label: "Mix",
      content: <MixTab nodes={graph.nodes} />,
    },
    {
      id: "preview",
      label: "Preview",
      content: (
        <LivePreview
          graph={graph}
          patchName={patchName}
          onResizeZone={resizeZone}
        />
      ),
    },
  ]

  // -----------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------

  return (
    <>
      <AppShellFrame
        mode={mode}
        onModeChange={setMode}
        showName="Little Shop of Horrors"
        contextPanel={
          <ShowOutline
            showName="Little Shop of Horrors"
            songs={LSOH_SONGS}
            mode="program"
            currentPatchId={selectedPatchId}
            onPickPatch={(_s, p) => setSelectedPatchId(p)}
            className="h-full"
          />
        }
        inspector={
          <InspectorFrame>
            <RightPanel
              onAddNode={addNode}
              savedComposites={savedComposites}
            />
          </InspectorFrame>
        }
        canvas={
          <div className="flex h-full flex-col gap-2 p-2">
            {/* Canvas island */}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card">
              <PatchTitleBar songName={songName} patchName={patchName} />
              <div className="min-h-0 flex-1">
                <PatchCanvas
                  graph={graph}
                  selectedNodeId={selectedNodeId}
                  selectedWireId={selectedWireId}
                  onSelectNode={selectNode}
                  onSelectWire={selectWire}
                  onMoveNode={moveNode}
                  onCreateWire={createWire}
                  onDeleteWiresInto={deleteWiresInto}
                  onOpenCanvasMenu={openCanvasMenu}
                  onOpenNodeMenu={openNodeMenu}
                  onOpenWireMenu={openWireMenu}
                  onOpenCompositeMenu={openCompositeMenu}
                />
              </div>
            </div>
            {/* Bottom tab rail (own island) */}
            <div className="overflow-hidden rounded-xl border bg-card">
              <PatchTabRail
                tabs={bottomTabs}
                side="bottom"
                expandedHeight={320}
                openTabId={bottomTabId}
                onOpenTabIdChange={(id) => setBottomTabId(id as BottomTabId | null)}
              />
            </div>
          </div>
        }
      />

      {contextMenu && (
        <ContextMenu
          anchor={contextMenu.anchor}
          sections={contextMenu.sections}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  )
}

// =============================================================================
// Breadcrumb
// =============================================================================

interface BreadcrumbItem {
  id: string
  label: string
  onClick?: () => void
}

function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav className="flex items-center gap-1 text-[11px]" aria-label="Selection path">
      {items.map((item, i) => {
        const isLast = i === items.length - 1
        return (
          <React.Fragment key={item.id}>
            {i > 0 && (
              <ChevronRight className="size-3 shrink-0 text-muted-foreground/60" />
            )}
            <button
              type="button"
              onClick={item.onClick}
              disabled={!item.onClick}
              className={cn(
                "truncate rounded px-1.5 py-0.5",
                isLast
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                !item.onClick && "cursor-default"
              )}
            >
              {item.label}
            </button>
          </React.Fragment>
        )
      })}
    </nav>
  )
}

// =============================================================================
// Settings tab — context-aware
// =============================================================================

function SettingsTab({
  breadcrumb,
  selectedNode,
  selectedWire,
  selectedComposite,
  onSetWireColor,
  onDeleteWire,
  onDeleteNode,
  onToggleCompositeLock,
}: {
  breadcrumb: BreadcrumbItem[]
  selectedNode?: GraphNode
  selectedWire?: Wire
  selectedComposite?: { id: string; name: string; locked: boolean }
  onSetWireColor: (c: string | undefined) => void
  onDeleteWire: () => void
  onDeleteNode: () => void
  onToggleCompositeLock: () => void
}) {
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="border-b pb-2">
        <Breadcrumb items={breadcrumb} />
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {selectedWire ? (
          <WireSettings wire={selectedWire} onSetColor={onSetWireColor} onDelete={onDeleteWire} />
        ) : selectedNode ? (
          <NodeSettings node={selectedNode} onDelete={onDeleteNode} />
        ) : selectedComposite ? (
          <CompositeSettings composite={selectedComposite} onToggleLock={onToggleCompositeLock} />
        ) : (
          <GlobalSettings />
        )}
      </div>
    </div>
  )
}

function GlobalSettings() {
  return (
    <div className="grid h-full place-items-center text-center text-xs text-muted-foreground">
      <div className="max-w-md">
        <Settings className="mx-auto mb-2 size-6 opacity-40" />
        <div className="text-foreground">Global patch settings</div>
        <div className="mt-1">
          Patch-level transition, master level, post-mix FX, and routing
          defaults will land here. Select a node, wire, or composite block to
          see its context-specific settings.
        </div>
      </div>
    </div>
  )
}

function NodeSettings({
  node,
  onDelete,
}: {
  node: GraphNode
  onDelete: () => void
}) {
  const isPlugin = node.kind === "instrument.plugin"
  return (
    <div className="grid h-full grid-cols-[280px_1fr] gap-4 text-xs">
      {/* Left: identity + ports */}
      <div className="flex flex-col gap-3 border-r pr-4">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Name
          </label>
          <input
            defaultValue={node.name}
            className="h-8 rounded-md border bg-background px-2 text-xs"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Ports ({node.ports.length})
          </label>
          <div className="rounded-md border bg-background">
            {node.ports.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between border-b px-2.5 py-1.5 last:border-b-0"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{
                      background:
                        p.signal === "midi"
                          ? "oklch(0.7 0.15 280)"
                          : "oklch(0.7 0.15 145)",
                    }}
                  />
                  <span className="text-[10px] text-muted-foreground">
                    {p.direction === "in" ? "←" : "→"}
                  </span>
                  <span className="truncate">{p.label}</span>
                </div>
                <span className="ml-2 shrink-0 font-mono text-[10px] text-muted-foreground">
                  {p.signal}
                </span>
              </div>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="mt-auto flex items-center justify-center gap-2 rounded-md border border-destructive/40 px-2 py-1.5 text-xs text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="size-3.5" />
          Delete node
        </button>
      </div>

      {/* Right: plugin UI dock or kind-specific config */}
      <div className="min-w-0">
        {isPlugin ? <PluginUIDock node={node} /> : <KindConfig node={node} />}
      </div>
    </div>
  )
}

function PluginUIDock({ node }: { node: GraphNode }) {
  const uri = node.config?.pluginUri as string | undefined
  return (
    <div className="flex h-full flex-col gap-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Plugin UI
      </div>
      <div className="grid min-h-[180px] flex-1 place-items-center rounded-md border-2 border-dashed text-xs text-muted-foreground">
        <div className="max-w-md p-6 text-center">
          <Box className="mx-auto mb-2 size-6 opacity-40" />
          <div className="font-medium text-foreground">
            {uri ?? "(no plugin loaded)"} UI docks here
          </div>
          <div className="mt-1">
            CLAP / VST3 plugin GUIs embed in this region at native size.
            Float-out option available from the tab rail header.
          </div>
        </div>
      </div>
    </div>
  )
}

function KindConfig({ node }: { node: GraphNode }) {
  return (
    <div className="flex h-full flex-col gap-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Configuration
      </div>
      <div className="grid h-full place-items-center rounded-md border bg-muted/20 text-[11px] text-muted-foreground">
        <div className="max-w-md p-6 text-center">
          Kind-specific controls for {node.kind} land here in the next
          iteration. The in-node body covers quick edits today.
        </div>
      </div>
    </div>
  )
}

function WireSettings({
  wire,
  onSetColor,
  onDelete,
}: {
  wire: Wire
  onSetColor: (c: string | undefined) => void
  onDelete: () => void
}) {
  return (
    <div className="flex h-full flex-col gap-4 text-xs">
      <div className="flex flex-col gap-2">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Cable color
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onSetColor(undefined)}
            className={cn(
              "flex h-8 items-center gap-1.5 rounded-md border px-2 text-xs hover:bg-muted/40",
              !wire.color && "border-primary/40 bg-primary/5"
            )}
            title="Use the signal's default color"
          >
            <RotateCcw className="size-3" />
            Default
          </button>
          {WIRE_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onSetColor(c.color)}
              className={cn(
                "grid size-7 place-items-center rounded-md border hover:scale-110",
                wire.color === c.color && "ring-2 ring-primary"
              )}
              title={c.label}
              style={{ background: c.color }}
            />
          ))}
        </div>
      </div>
      <div className="rounded-md border bg-muted/20 px-3 py-2 text-[10px] text-muted-foreground">
        Connects <span className="font-mono text-foreground">{wire.fromNode}:{wire.fromPort}</span>{" "}
        → <span className="font-mono text-foreground">{wire.toNode}:{wire.toPort}</span>
      </div>
      <button
        type="button"
        onClick={onDelete}
        className="mt-auto flex w-fit items-center gap-2 rounded-md border border-destructive/40 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10"
      >
        <Trash2 className="size-3.5" />
        Delete wire
      </button>
    </div>
  )
}

function CompositeSettings({
  composite,
  onToggleLock,
}: {
  composite: { id: string; name: string; locked: boolean }
  onToggleLock: () => void
}) {
  return (
    <div className="flex flex-col gap-3 text-xs">
      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Composite block
        </div>
        <div className="text-sm font-semibold">{composite.name}</div>
      </div>
      <button
        type="button"
        onClick={onToggleLock}
        className="flex w-fit items-center gap-2 rounded-md border px-3 py-1.5 hover:bg-muted/40"
      >
        {composite.locked ? <Unlock className="size-3.5" /> : <Lock className="size-3.5" />}
        {composite.locked ? "Unlock (edit contents)" : "Lock (drag as one)"}
      </button>
    </div>
  )
}

// =============================================================================
// Mix tab — strips per audio-producing node
// =============================================================================

function MixTab({ nodes }: { nodes: GraphNode[] }) {
  const instruments = nodes.filter((n) => classOf(n.kind) === "instrument")
  const groups = nodes.filter((n) => n.kind === "audio.mix")
  const masters = nodes.filter((n) => n.kind === "sink.main-out")

  if (instruments.length === 0 && groups.length === 0 && masters.length === 0) {
    return (
      <div className="grid h-full place-items-center text-center text-xs text-muted-foreground">
        Add an instrument or output to see channel strips here.
      </div>
    )
  }

  return (
    <div className="flex h-full items-stretch gap-6 text-xs">
      {instruments.length > 0 && <StripGroup title="Instruments" nodes={instruments} />}
      {groups.length > 0 && <StripGroup title="Groups" nodes={groups} />}
      {masters.length > 0 && <StripGroup title="Master" nodes={masters} master />}
    </div>
  )
}

function StripGroup({
  title,
  nodes,
  master,
}: {
  title: string
  nodes: GraphNode[]
  master?: boolean
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      <div className="flex flex-1 items-end gap-2">
        {nodes.map((n) => (
          <ChannelStrip key={n.id} node={n} master={master} />
        ))}
      </div>
    </div>
  )
}

function ChannelStrip({ node, master }: { node: GraphNode; master?: boolean }) {
  const cls = CLASS_COLORS[classOf(node.kind)]
  return (
    <div
      className="flex h-full w-16 flex-col items-center gap-1.5 rounded-md border bg-background px-2 py-2"
      style={{
        borderTopColor: `oklch(0.7 0.18 ${cls.hue})`,
        borderTopWidth: master ? 4 : 2,
      }}
    >
      <span className="line-clamp-2 text-center text-[9px] font-medium leading-tight">
        {node.name}
      </span>
      <div className="relative my-2 h-full min-h-[80px] w-3 rounded-full bg-muted/40">
        <div
          className="absolute left-1/2 size-3.5 -translate-x-1/2 rounded-sm bg-foreground/40"
          style={{ top: "30%" }}
        />
      </div>
      <span className="font-mono text-[9px] text-muted-foreground">
        {master ? "0.0" : "−6.0"}
      </span>
    </div>
  )
}
