import * as React from "react"
import {
  AlertTriangle,
  Box,
  ChevronRight,
  Copy,
  Lock,
  Music,
  Palette,
  Pencil,
  Plus,
  Redo2,
  RotateCcw,
  Settings,
  Settings2,
  Trash2,
  Undo2,
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
import { RightPanel, type RigSource } from "@/components/patch-graph/right-panel"
import { PatchTabRail, type PatchTabSpec } from "@/components/patch-graph/patch-tab-rail"
import { PatchTitleBar } from "@/components/patch-graph/patch-title-bar"
import { LivePreview } from "@/components/patch-graph/live-preview"
import {
  ContextMenu,
  type ContextMenuSection,
} from "@/components/patch-graph/context-menu"
import type {
  CompositeBlock,
  GraphNode,
  NodeKind,
  PatchGraph,
  Wire,
} from "@/components/patch-graph/_types"
import { CLASS_COLORS, classOf } from "@/components/patch-graph/_types"
import { cn } from "@/lib/utils"

/**
 * Patch editor — the node-graph design.
 *
 * Same component Storybook iterates on, lifted into a reusable screen
 * so both the storybook stories and the real Tauri app render the
 * same code path. State lives entirely client-side for now (undo /
 * redo, multi-select, solo/mute, validation, all graph mutations);
 * persistence + engine wiring lands once stardust-core grows the
 * patch graph type system + Tauri commands.
 */

// =============================================================================
// Zone defaults
// =============================================================================

/**
 * Suggest a sensible next zone range when adding to an existing set.
 * Tries to split the highest zone in half; falls back to a fresh octave
 * above the highest existing zone, capped at MIDI 108.
 */
function nextZoneRange(
  zones: Array<{ config?: { kind: string; fromNote?: number; toNote?: number } }>
): { fromNote: number; toNote: number } {
  if (zones.length === 0) return { fromNote: 60, toNote: 84 }
  const highest = zones
    .map((z) => z.config as { fromNote: number; toNote: number })
    .reduce((a, b) => (b.toNote > a.toNote ? b : a))
  const start = Math.min(108, highest.toNote + 1)
  const end = Math.min(108, start + 11)
  if (end <= start) {
    // Already at the top — split the highest zone in half.
    const mid = Math.floor((highest.fromNote + highest.toNote) / 2)
    return { fromNote: mid + 1, toNote: highest.toNote }
  }
  return { fromNote: start, toNote: end }
}

/** Default palette for zones — distinct, perceptually spread hues. */
const ZONE_HUES = [200, 30, 145, 290, 60, 0, 250, 95]

function pickNextZoneHue(used: Set<number>): number {
  for (const h of ZONE_HUES) if (!used.has(h)) return h
  return ZONE_HUES[0]
}

function hueToColor(hue: number): string {
  return `oklch(0.7 0.18 ${hue})`
}

// =============================================================================
// Wire color palette
// =============================================================================

const WIRE_COLORS = [
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
// Patch validation
// =============================================================================

interface ValidationIssue {
  level: "warning" | "error"
  message: string
}

function validatePatch(graph: PatchGraph): Map<string, ValidationIssue> {
  const issues = new Map<string, ValidationIssue>()

  // Pre-compute which (internalNode, internalPort) pairs are reached by
  // a wire that targets a composite's promoted port. A wire into the
  // composite's "Keys" input is semantically a wire into the contained
  // organ's MIDI in — validation has to honour that alias or it'll
  // flag properly-wired blocks as silent.
  const aliasedIncoming = new Set<string>() // key: `${nodeId}:${portId}`
  const aliasedOutgoing = new Set<string>()
  for (const w of graph.wires) {
    const toComp = graph.composites.find((c) => c.id === w.toNode)
    if (toComp) {
      const p = toComp.promotedPorts.find((pp) => pp.id === w.toPort)
      if (p) aliasedIncoming.add(`${p.internalNode}:${p.internalPort}`)
    }
    const fromComp = graph.composites.find((c) => c.id === w.fromNode)
    if (fromComp) {
      const p = fromComp.promotedPorts.find((pp) => pp.id === w.fromPort)
      if (p) aliasedOutgoing.add(`${p.internalNode}:${p.internalPort}`)
    }
  }

  for (const node of graph.nodes) {
    const cls = classOf(node.kind)
    const inputs = node.ports.filter((p) => p.direction === "in")
    const outputs = node.ports.filter((p) => p.direction === "out")
    const incomingByPort = new Set<string>()
    const outgoingByPort = new Set<string>()
    for (const w of graph.wires) {
      if (w.toNode === node.id) incomingByPort.add(w.toPort)
      if (w.fromNode === node.id) outgoingByPort.add(w.fromPort)
    }
    for (const p of node.ports) {
      const key = `${node.id}:${p.id}`
      if (p.direction === "in" && aliasedIncoming.has(key)) {
        incomingByPort.add(p.id)
      }
      if (p.direction === "out" && aliasedOutgoing.has(key)) {
        outgoingByPort.add(p.id)
      }
    }

    if (cls === "instrument") {
      const midiInputs = inputs.filter((p) => p.signal === "midi")
      const anyMidiWired = midiInputs.some((p) => incomingByPort.has(p.id))
      if (midiInputs.length > 0 && !anyMidiWired) {
        issues.set(node.id, {
          level: "warning",
          message: "No MIDI input — instrument will be silent",
        })
        continue
      }
      const anyAudioWired = outputs
        .filter((p) => p.signal === "audio")
        .some((p) => outgoingByPort.has(p.id))
      if (!anyAudioWired) {
        issues.set(node.id, {
          level: "warning",
          message: "Audio output not connected anywhere",
        })
      }
    }

    if (cls === "sink") {
      const audioInputs = inputs.filter((p) => p.signal === "audio")
      const anyAudioWired = audioInputs.some((p) => incomingByPort.has(p.id))
      if (audioInputs.length > 0 && !anyAudioWired) {
        issues.set(node.id, {
          level: "warning",
          message: "Output has no audio source — show will be silent",
        })
      }
    }

    if (cls === "midi-processor" || cls === "audio-effect") {
      const allIn = inputs.length > 0 && !inputs.some((p) => incomingByPort.has(p.id))
      const allOut = outputs.length > 0 && !outputs.some((p) => outgoingByPort.has(p.id))
      if (allIn && allOut) {
        issues.set(node.id, { level: "warning", message: "Node is disconnected" })
      }
    }
  }
  return issues
}

// =============================================================================
// Shell
// =============================================================================

interface ContextMenuState {
  anchor: { x: number; y: number }
  sections: ContextMenuSection[]
}

type BottomTabId = "settings" | "mix" | "preview"

export interface PatchEditorProps {
  /** Top-level show name shown in the app shell. */
  showName: string
  /** Songs + nested patches rendered in the left context panel. */
  songs: ShowOutlineSong[]
  /** Patch graph currently being edited. Controlled by the parent. */
  graph: PatchGraph
  /** Called with the next graph whenever a mutation lands. */
  onGraphChange: (graph: PatchGraph) => void
  /** Which patch in `songs` is highlighted as current. */
  selectedPatchId?: string
  /** Notify the parent when the user picks a different patch. */
  onSelectPatch?: (patchId: string) => void
  /** Name of the currently-loaded patch (shown in the title bar). */
  patchName: string
  /** Name of the song the patch lives under. */
  songName: string
  /** Optional actions slot in the title bar (Open / Save buttons, etc.). */
  headerActions?: React.ReactNode
  /** User-saved composite presets shown in the right-panel Blocks tab. */
  savedComposites?: Array<{ id: string; name: string; nodeCount: number }>
  /** Source kinds advertised in the right-panel Sources group. */
  rigSources?: RigSource[]
}

export function PatchEditor({
  showName,
  songs,
  graph,
  onGraphChange,
  selectedPatchId,
  onSelectPatch,
  patchName,
  songName,
  headerActions,
  savedComposites = [],
  rigSources,
}: PatchEditorProps) {
  const [mode, setMode] = React.useState<AppMode>("program")
  const [history, setHistory] = React.useState<PatchGraph[]>([])
  const [redoStack, setRedoStack] = React.useState<PatchGraph[]>([])

  const [selectedNodeIds, setSelectedNodeIds] = React.useState<Set<string>>(new Set())
  const [selectedWireId, setSelectedWireId] = React.useState<string | undefined>()
  const [selectedCompositeId, setSelectedCompositeId] = React.useState<string | undefined>()

  // Reset undo history + selections whenever the active patch changes.
  // Cross-patch undo would surprise users; history belongs to the patch
  // you're editing.
  const lastPatchIdRef = React.useRef(selectedPatchId)
  React.useEffect(() => {
    if (lastPatchIdRef.current !== selectedPatchId) {
      setHistory([])
      setRedoStack([])
      setSelectedNodeIds(new Set())
      setSelectedWireId(undefined)
      setSelectedCompositeId(undefined)
      lastPatchIdRef.current = selectedPatchId
    }
  }, [selectedPatchId])

  const [contextMenu, setContextMenu] = React.useState<ContextMenuState | null>(null)
  const [bottomTabId, setBottomTabId] = React.useState<BottomTabId | null>(null)

  const [soloed, setSoloed] = React.useState<Set<string>>(new Set())
  const [muted, setMuted] = React.useState<Set<string>>(new Set())

  const primaryNodeId =
    selectedNodeIds.size > 0 ? Array.from(selectedNodeIds)[selectedNodeIds.size - 1] : undefined
  const selectedNode = primaryNodeId ? graph.nodes.find((n) => n.id === primaryNodeId) : undefined
  const selectedWire = graph.wires.find((w) => w.id === selectedWireId)
  const selectedComposite = graph.composites.find((c) => c.id === selectedCompositeId)

  React.useEffect(() => {
    if (selectedNodeIds.size > 0 || selectedWireId || selectedCompositeId) {
      setBottomTabId("settings")
    }
  }, [selectedNodeIds, selectedWireId, selectedCompositeId])

  // -------------------------------------------------------------------
  // Undo / redo wrapper around setGraph
  //
  // PatchEditor is now controlled — the parent owns the graph. We keep
  // history local because it's per-patch UI state, not show-document
  // state (per ADR-0005, mutation history doesn't persist).
  // -------------------------------------------------------------------

  const dragInProgressRef = React.useRef(false)
  const graphRef = React.useRef(graph)
  React.useEffect(() => {
    graphRef.current = graph
  }, [graph])

  const setGraph = React.useCallback(
    (updater: (g: PatchGraph) => PatchGraph, opts?: { skipHistory?: boolean }) => {
      const prev = graphRef.current
      const next = updater(prev)
      if (next === prev) return
      if (!opts?.skipHistory && !dragInProgressRef.current) {
        setHistory((h) => [...h, prev].slice(-50))
        setRedoStack([])
      }
      onGraphChange(next)
    },
    [onGraphChange]
  )

  const onNodeDragStart = () => {
    setHistory((h) => [...h, graph].slice(-50))
    setRedoStack([])
    dragInProgressRef.current = true
  }
  const onNodeDragEnd = () => {
    dragInProgressRef.current = false
  }

  const undo = () => {
    setHistory((h) => {
      if (h.length === 0) return h
      const prev = h[h.length - 1]
      setRedoStack((r) => [...r, graph])
      onGraphChange(prev)
      return h.slice(0, -1)
    })
  }

  const redo = () => {
    setRedoStack((r) => {
      if (r.length === 0) return r
      const next = r[r.length - 1]
      setHistory((h) => [...h, graph])
      onGraphChange(next)
      return r.slice(0, -1)
    })
  }

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      if (e.key === "z" && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if ((e.key === "z" && e.shiftKey) || e.key === "y") {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, history, redoStack])

  // -------------------------------------------------------------------
  // Selection
  // -------------------------------------------------------------------

  const selectNode = (id: string | undefined, additive = false) => {
    if (!id) {
      setSelectedNodeIds(new Set())
      return
    }
    setSelectedWireId(undefined)
    setSelectedCompositeId(undefined)
    setSelectedNodeIds((prev) => {
      if (additive) {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      }
      return new Set([id])
    })
  }
  const selectWire = (id: string | undefined) => {
    setSelectedWireId(id)
    if (id) {
      setSelectedNodeIds(new Set())
      setSelectedCompositeId(undefined)
    }
  }
  const selectComposite = (id: string | undefined) => {
    setSelectedCompositeId(id)
    if (id) {
      setSelectedNodeIds(new Set())
      setSelectedWireId(undefined)
    }
  }
  const deselectAll = () => {
    setSelectedNodeIds(new Set())
    setSelectedWireId(undefined)
    setSelectedCompositeId(undefined)
  }

  const shiftDownRef = React.useRef(false)
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === "Shift") shiftDownRef.current = true }
    const up = (e: KeyboardEvent) => { if (e.key === "Shift") shiftDownRef.current = false }
    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    return () => {
      window.removeEventListener("keydown", down)
      window.removeEventListener("keyup", up)
    }
  }, [])

  const onCanvasSelectNode = (id: string | undefined) => {
    selectNode(id, shiftDownRef.current)
  }

  // -------------------------------------------------------------------
  // Mutations
  // -------------------------------------------------------------------

  const addNodeAt = (kind: NodeKind, pos: { x: number; y: number }) => {
    const node = makeNode(kind, pos)
    setGraph((g) => ({ ...g, nodes: [...g.nodes, node] }))
    selectNode(node.id)
  }
  const addNode = (kind: NodeKind) => addNodeAt(kind, { x: 120, y: 160 })

  const moveNodes = (deltas: Array<{ id: string; x: number; y: number }>) => {
    setGraph(
      (g) => ({
        ...g,
        nodes: g.nodes.map((n) => {
          const d = deltas.find((x) => x.id === n.id)
          return d ? { ...n, x: d.x, y: d.y } : n
        }),
      }),
      { skipHistory: true }
    )
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
    selectedNodeIds.has(id) && selectNode(undefined)
  }

  const deleteSelectedNodes = () => {
    for (const id of selectedNodeIds) deleteNode(id)
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

  const createWire = (p: { fromNode: string; fromPort: string; toNode: string; toPort: string }) => {
    const dup = graph.wires.find(
      (w) =>
        w.fromNode === p.fromNode &&
        w.fromPort === p.fromPort &&
        w.toNode === p.toNode &&
        w.toPort === p.toPort
    )
    if (dup) return
    const sourceNode = graph.nodes.find((n) => n.id === p.fromNode)
    const sourcePort = sourceNode?.ports.find((pp) => pp.id === p.fromPort)
    let color: string | undefined
    if (sourcePort?.config?.kind === "zone") {
      const cfg = sourcePort.config
      if (cfg.wireFollowsColor !== false && typeof cfg.colorHue === "number") {
        color = hueToColor(cfg.colorHue)
      }
    }
    const id = `w-${Date.now()}`
    setGraph((g) => ({ ...g, wires: [...g.wires, { id, ...p, color }] }))
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

  const setCompositeColor = (id: string, hue: number | undefined) => {
    setGraph((g) => ({
      ...g,
      composites: g.composites.map((c) =>
        c.id === id ? { ...c, colorHue: hue } : c
      ),
    }))
  }

  const addPromotedPort = (
    compositeId: string,
    spec: { internalNode: string; internalPort: string; label: string }
  ) => {
    setGraph((g) => ({
      ...g,
      composites: g.composites.map((c) => {
        if (c.id !== compositeId) return c
        const target = g.nodes
          .find((n) => n.id === spec.internalNode)
          ?.ports.find((p) => p.id === spec.internalPort)
        if (!target) return c
        const id = `pp-${Date.now()}`
        return {
          ...c,
          promotedPorts: [
            ...c.promotedPorts,
            {
              id,
              label: spec.label,
              direction: target.direction,
              signal: target.signal,
              internalNode: spec.internalNode,
              internalPort: spec.internalPort,
            },
          ],
        }
      }),
    }))
  }

  const removePromotedPort = (compositeId: string, portId: string) => {
    setGraph((g) => ({
      ...g,
      composites: g.composites.map((c) =>
        c.id === compositeId
          ? { ...c, promotedPorts: c.promotedPorts.filter((p) => p.id !== portId) }
          : c
      ),
      wires: g.wires.filter(
        (w) =>
          !(w.fromNode === compositeId && w.fromPort === portId) &&
          !(w.toNode === compositeId && w.toPort === portId)
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

  const addZone = (nodeId: string) => {
    setGraph((g) => {
      const node = g.nodes.find((n) => n.id === nodeId)
      if (!node) return g
      const existingZones = node.ports.filter(
        (p) => p.direction === "out" && p.config?.kind === "zone"
      )
      const usedHues = new Set(
        existingZones
          .map((p) => (p.config as { colorHue?: number }).colorHue)
          .filter((h): h is number => typeof h === "number")
      )
      const nextHue = pickNextZoneHue(usedHues)
      const newId = `zone-${Date.now()}`
      const range = nextZoneRange(existingZones)
      const newPort = {
        id: newId,
        label: "MIDI out",
        signal: "midi" as const,
        direction: "out" as const,
        config: {
          kind: "zone" as const,
          fromNote: range.fromNote,
          toNote: range.toNote,
          colorHue: nextHue,
          wireFollowsColor: true,
        },
      }
      if (existingZones.length === 0) {
        const singleOut = node.ports.find((p) => p.direction === "out")
        if (!singleOut) return g
        const firstHue = pickNextZoneHue(new Set([nextHue]))
        const lowZone = {
          id: `zone-low-${Date.now()}`,
          label: "MIDI out",
          signal: "midi" as const,
          direction: "out" as const,
          config: {
            kind: "zone" as const,
            fromNote: 36,
            toNote: 59,
            colorHue: firstHue,
            wireFollowsColor: true,
          },
        }
        const highZone = {
          ...newPort,
          config: {
            ...newPort.config,
            fromNote: 60,
            toNote: 108,
          },
        }
        return {
          ...g,
          nodes: g.nodes.map((n) =>
            n.id !== nodeId ? n : { ...n, ports: [lowZone, highZone] }
          ),
          wires: g.wires.map((w) =>
            w.fromNode === nodeId && w.fromPort === singleOut.id
              ? { ...w, fromPort: highZone.id, color: hueToColor(nextHue) }
              : w
          ),
        }
      }
      return {
        ...g,
        nodes: g.nodes.map((n) =>
          n.id !== nodeId ? n : { ...n, ports: [...n.ports, newPort] }
        ),
      }
    })
  }

  const setZoneColor = (
    nodeId: string,
    portId: string,
    hue: number | undefined
  ) => {
    setGraph((g) => {
      const node = g.nodes.find((n) => n.id === nodeId)
      const port = node?.ports.find((p) => p.id === portId)
      const cfg = port?.config?.kind === "zone" ? port.config : null
      const wireFollows = cfg?.wireFollowsColor !== false
      return {
        ...g,
        nodes: g.nodes.map((n) =>
          n.id !== nodeId
            ? n
            : {
                ...n,
                ports: n.ports.map((p) =>
                  p.id !== portId || p.config?.kind !== "zone"
                    ? p
                    : { ...p, config: { ...p.config, colorHue: hue } }
                ),
              }
        ),
        wires: wireFollows
          ? g.wires.map((w) =>
              w.fromNode === nodeId && w.fromPort === portId
                ? { ...w, color: hue === undefined ? undefined : hueToColor(hue) }
                : w
            )
          : g.wires,
      }
    })
  }

  const setZoneWireFollows = (
    nodeId: string,
    portId: string,
    follows: boolean
  ) => {
    setGraph((g) => {
      const node = g.nodes.find((n) => n.id === nodeId)
      const port = node?.ports.find((p) => p.id === portId)
      const cfg = port?.config?.kind === "zone" ? port.config : null
      const hue = cfg?.colorHue
      return {
        ...g,
        nodes: g.nodes.map((n) =>
          n.id !== nodeId
            ? n
            : {
                ...n,
                ports: n.ports.map((p) =>
                  p.id !== portId || p.config?.kind !== "zone"
                    ? p
                    : { ...p, config: { ...p.config, wireFollowsColor: follows } }
                ),
              }
        ),
        wires:
          follows && typeof hue === "number"
            ? g.wires.map((w) =>
                w.fromNode === nodeId && w.fromPort === portId
                  ? { ...w, color: hueToColor(hue) }
                  : w
              )
            : g.wires,
      }
    })
  }

  const removeZone = (nodeId: string, portId: string) => {
    setGraph((g) => ({
      ...g,
      nodes: g.nodes.map((n) =>
        n.id !== nodeId ? n : { ...n, ports: n.ports.filter((p) => p.id !== portId) }
      ),
      wires: g.wires.filter(
        (w) => !(w.fromNode === nodeId && w.fromPort === portId)
      ),
    }))
  }

  const toggleSolo = (id: string) => {
    setSoloed((s) => {
      const next = new Set(s)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  const toggleMute = (id: string) => {
    setMuted((m) => {
      const next = new Set(m)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return
      if ((e.target as HTMLElement)?.matches("input, textarea")) return
      e.preventDefault()
      if (selectedNodeIds.size > 0) deleteSelectedNodes()
      else if (selectedWireId) deleteWire(selectedWireId)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNodeIds, selectedWireId])

  // -------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------

  const validation = React.useMemo(() => validatePatch(graph), [graph])
  const warningCount = Array.from(validation.values()).filter((v) => v.level === "warning").length
  const errorCount = Array.from(validation.values()).filter((v) => v.level === "error").length

  // -------------------------------------------------------------------
  // Context menus
  // -------------------------------------------------------------------

  const openCanvasMenu = (
    anchor: { x: number; y: number },
    canvasPos: { x: number; y: number }
  ) => {
    setContextMenu({
      anchor,
      sections: [
        {
          id: "quick-add",
          items: [
            { id: "add-keyboard", label: "Add keyboard here", icon: Music, onSelect: () => addNodeAt("source.keyboard", canvasPos) },
            { id: "add-sine", label: "Add sine synth here", icon: Waves, onSelect: () => addNodeAt("instrument.sine", canvasPos) },
            { id: "add-eq", label: "Add EQ here", icon: Settings2, onSelect: () => addNodeAt("audio.eq", canvasPos) },
            { id: "add-out", label: "Add output here", icon: Volume2, onSelect: () => addNodeAt("sink.main-out", canvasPos) },
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

  // -------------------------------------------------------------------
  // Bottom tabs
  // -------------------------------------------------------------------

  const settingsBreadcrumb: BreadcrumbItem[] = (() => {
    const items: BreadcrumbItem[] = [{ id: "patch", label: patchName, onClick: deselectAll }]
    if (selectedComposite) items.push({ id: "comp", label: selectedComposite.name })
    if (selectedNodeIds.size > 1) {
      items.push({ id: "multi", label: `${selectedNodeIds.size} nodes` })
    } else if (selectedNode) {
      items.push({ id: "node", label: selectedNode.name })
    }
    if (selectedWire) items.push({ id: "wire", label: "Wire" })
    return items
  })()

  const bottomTabs: PatchTabSpec[] = [
    {
      id: "settings",
      label: warningCount + errorCount > 0
        ? `Settings (${warningCount + errorCount} ⚠)`
        : "Settings",
      content: (
        <SettingsTab
          breadcrumb={settingsBreadcrumb}
          selectedNode={selectedNode}
          selectedNodesCount={selectedNodeIds.size}
          selectedWire={selectedWire}
          selectedComposite={selectedComposite}
          warningCount={warningCount}
          errorCount={errorCount}
          validation={validation}
          graph={graph}
          patchName={patchName}
          songName={songName}
          onJumpToNode={(id) => selectNode(id)}
          onSetWireColor={(c) => selectedWire && setWireColor(selectedWire.id, c)}
          onDeleteWire={() => selectedWire && deleteWire(selectedWire.id)}
          onDeleteNode={() => selectedNode && deleteNode(selectedNode.id)}
          onToggleCompositeLock={() =>
            selectedComposite && toggleCompositeLock(selectedComposite.id)
          }
          onSetCompositeColor={(hue) =>
            selectedComposite && setCompositeColor(selectedComposite.id, hue)
          }
          onAddPromotedPort={(spec) =>
            selectedComposite && addPromotedPort(selectedComposite.id, spec)
          }
          onRemovePromotedPort={(portId) =>
            selectedComposite && removePromotedPort(selectedComposite.id, portId)
          }
          onAddZone={(nodeId) => addZone(nodeId)}
          onRemoveZone={(nodeId, portId) => removeZone(nodeId, portId)}
          onResizeZone={resizeZone}
          onSetZoneColor={setZoneColor}
          onSetZoneWireFollows={setZoneWireFollows}
        />
      ),
    },
    { id: "mix", label: "Mix", content: <MixTab nodes={graph.nodes} soloed={soloed} muted={muted} onToggleSolo={toggleSolo} onToggleMute={toggleMute} /> },
    { id: "preview", label: "Preview", content: <LivePreview graph={graph} patchName={patchName} onResizeZone={resizeZone} /> },
  ]

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------

  return (
    <>
      <AppShellFrame
        mode={mode}
        onModeChange={setMode}
        showName={showName}
        headerActions={headerActions}
        contextPanel={
          <ShowOutline
            showName={showName}
            songs={songs}
            mode="program"
            currentPatchId={selectedPatchId}
            onPickPatch={(_s, p) => onSelectPatch?.(p)}
            onAddSong={() => {}}
            onAddPatch={() => {}}
            className="h-full"
          />
        }
        inspector={
          <InspectorFrame>
            <RightPanel
              onAddNode={addNode}
              rigSources={rigSources}
              onOpenRigScreen={() => setMode("rig")}
              savedComposites={savedComposites}
            />
          </InspectorFrame>
        }
        canvas={
          <div className="flex h-full flex-col gap-2 p-2">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card">
              <PatchTitleBar
                songName={songName}
                patchName={patchName}
                meta={
                  warningCount + errorCount > 0
                    ? `${warningCount + errorCount} validation ${warningCount + errorCount === 1 ? "issue" : "issues"}`
                    : undefined
                }
              />
              <div className="flex items-center gap-1 border-b bg-card/40 px-2 py-1">
                <button
                  type="button"
                  onClick={undo}
                  disabled={history.length === 0}
                  className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground disabled:opacity-30"
                >
                  <Undo2 className="size-3" /> Undo
                </button>
                <button
                  type="button"
                  onClick={redo}
                  disabled={redoStack.length === 0}
                  className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground disabled:opacity-30"
                >
                  <Redo2 className="size-3" /> Redo
                </button>
                <div className="mx-1 h-3 w-px bg-border" />
                <span className="text-[10px] text-muted-foreground">
                  Shift-click for multi-select · Drag library cards onto canvas · Right-click to add at point
                </span>
                {warningCount + errorCount > 0 && (
                  <span className="ml-auto flex items-center gap-1 text-[10px] text-amber-500">
                    <AlertTriangle className="size-3" />
                    {warningCount + errorCount} validation {warningCount + errorCount === 1 ? "issue" : "issues"}
                  </span>
                )}
              </div>
              <div className="min-h-0 flex-1">
                <PatchCanvas
                  graph={graph}
                  selectedNodeIds={selectedNodeIds}
                  selectedWireId={selectedWireId}
                  selectedCompositeId={selectedCompositeId}
                  onSelectNode={onCanvasSelectNode}
                  onSelectWire={selectWire}
                  onMoveNodes={moveNodes}
                  onNodeDragStart={onNodeDragStart}
                  onNodeDragEnd={onNodeDragEnd}
                  onCreateWire={createWire}
                  onDeleteWiresInto={deleteWiresInto}
                  onOpenCanvasMenu={openCanvasMenu}
                  onOpenNodeMenu={openNodeMenu}
                  onOpenWireMenu={openWireMenu}
                  onOpenCompositeMenu={openCompositeMenu}
                  onSelectComposite={selectComposite}
                  onDropFromLibrary={addNodeAt}
                  validation={validation}
                  soloed={soloed}
                  muted={muted}
                  onToggleSolo={toggleSolo}
                  onToggleMute={toggleMute}
                />
              </div>
            </div>
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
            {i > 0 && <ChevronRight className="size-3 shrink-0 text-muted-foreground/60" />}
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
// Settings tab
// =============================================================================

function SettingsTab({
  breadcrumb,
  selectedNode,
  selectedNodesCount,
  selectedWire,
  selectedComposite,
  warningCount,
  errorCount,
  validation,
  graph,
  patchName,
  songName,
  onJumpToNode,
  onSetWireColor,
  onDeleteWire,
  onDeleteNode,
  onToggleCompositeLock,
  onSetCompositeColor,
  onAddPromotedPort,
  onRemovePromotedPort,
  onAddZone,
  onRemoveZone,
  onResizeZone,
  onSetZoneColor,
  onSetZoneWireFollows,
}: {
  breadcrumb: BreadcrumbItem[]
  selectedNode?: GraphNode
  selectedNodesCount: number
  selectedWire?: Wire
  selectedComposite?: CompositeBlock
  warningCount: number
  errorCount: number
  validation: Map<string, { level: string; message: string }>
  graph: PatchGraph
  patchName: string
  songName: string
  onJumpToNode: (id: string) => void
  onSetWireColor: (c: string | undefined) => void
  onDeleteWire: () => void
  onDeleteNode: () => void
  onToggleCompositeLock: () => void
  onSetCompositeColor: (hue: number | undefined) => void
  onAddPromotedPort: (spec: {
    internalNode: string
    internalPort: string
    label: string
  }) => void
  onRemovePromotedPort: (portId: string) => void
  onAddZone: (nodeId: string) => void
  onRemoveZone: (nodeId: string, portId: string) => void
  onResizeZone: (
    nodeId: string,
    portId: string,
    range: { fromNote: number; toNote: number }
  ) => void
  onSetZoneColor: (nodeId: string, portId: string, hue: number | undefined) => void
  onSetZoneWireFollows: (nodeId: string, portId: string, follows: boolean) => void
}) {
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="border-b pb-2">
        <Breadcrumb items={breadcrumb} />
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {selectedNodesCount > 1 ? (
          <MultiSelectInfo count={selectedNodesCount} />
        ) : selectedWire ? (
          <WireSettings wire={selectedWire} onSetColor={onSetWireColor} onDelete={onDeleteWire} />
        ) : selectedNode ? (
          <NodeSettings
            node={selectedNode}
            onDelete={onDeleteNode}
            onAddZone={onAddZone}
            onRemoveZone={onRemoveZone}
            onResizeZone={onResizeZone}
            onSetZoneColor={onSetZoneColor}
            onSetZoneWireFollows={onSetZoneWireFollows}
          />
        ) : selectedComposite ? (
          <CompositeSettings
            composite={selectedComposite}
            graph={graph}
            onToggleLock={onToggleCompositeLock}
            onSetColor={onSetCompositeColor}
            onAddPromotedPort={onAddPromotedPort}
            onRemovePromotedPort={onRemovePromotedPort}
          />
        ) : (
          <GlobalSettings
            warningCount={warningCount}
            errorCount={errorCount}
            validation={validation}
            graph={graph}
            patchName={patchName}
            songName={songName}
            onJumpToNode={onJumpToNode}
          />
        )}
      </div>
    </div>
  )
}

function MultiSelectInfo({ count }: { count: number }) {
  return (
    <div className="flex h-full flex-col gap-3 text-xs">
      <div>
        <div className="text-sm font-semibold text-foreground">
          {count} nodes selected
        </div>
        <div className="text-[11px] text-muted-foreground">
          Drag any selected node to move them all together.
        </div>
      </div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Bulk actions
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-md border bg-card px-2 py-1.5 text-[11px] hover:bg-muted/40"
        >
          <Box className="size-3.5" />
          Wrap as composite…
        </button>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-md border bg-card px-2 py-1.5 text-[11px] hover:bg-muted/40"
        >
          <Copy className="size-3.5" />
          Duplicate
        </button>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-md border bg-card px-2 py-1.5 text-[11px] hover:bg-muted/40"
        >
          <Palette className="size-3.5" />
          Recolor wires…
        </button>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-md border border-destructive/40 bg-card px-2 py-1.5 text-[11px] text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="size-3.5" />
          Delete all
        </button>
      </div>
    </div>
  )
}

function GlobalSettings({
  warningCount,
  errorCount,
  validation,
  graph,
  patchName,
  songName,
  onJumpToNode,
}: {
  warningCount: number
  errorCount: number
  validation: Map<string, { level: string; message: string }>
  graph: PatchGraph
  patchName: string
  songName: string
  onJumpToNode: (id: string) => void
}) {
  const issues = Array.from(validation.entries())
    .map(([nodeId, issue]) => {
      const node = graph.nodes.find((n) => n.id === nodeId)
      return node ? { node, issue } : null
    })
    .filter((x): x is { node: GraphNode; issue: { level: string; message: string } } => !!x)

  return (
    <div className="grid h-full grid-cols-[1fr_1fr] gap-4 text-xs">
      <div className="flex flex-col gap-3">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Patch settings
        </div>
        <div className="rounded-md border bg-background">
          <SettingRow label="Patch name" value={patchName} />
          <SettingRow label="Song" value={songName} />
          <SettingRow label="Master level" value="0.0 dB" slider />
          <SettingRow label="Transition" value="Crossfade · 60ms" />
          <SettingRow label="Send program change" value="None" />
          <SettingRow label="Tap tempo" value="—" />
        </div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Post-mix FX
        </div>
        <div className="rounded-md border bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground">+ Add post-mix effect</span>
          {" "}— inserts a master EQ, limiter, or reverb after the main bus.
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Validation
          </div>
          <span
            className={cn(
              "text-[10px] font-mono",
              errorCount > 0
                ? "text-destructive"
                : warningCount > 0
                  ? "text-amber-500"
                  : "text-emerald-500"
            )}
          >
            {errorCount + warningCount === 0 ? "All clear ✓" : `${warningCount} warn · ${errorCount} err`}
          </span>
        </div>
        {issues.length === 0 ? (
          <div className="grid h-full place-items-center rounded-md border bg-emerald-500/[0.04] text-[11px] text-emerald-500">
            No validation issues.
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {issues.map(({ node, issue }) => (
              <button
                key={node.id}
                type="button"
                onClick={() => onJumpToNode(node.id)}
                className={cn(
                  "flex items-start gap-2 rounded-md border px-2 py-1.5 text-left hover:bg-muted/40",
                  issue.level === "warning"
                    ? "border-amber-500/40 bg-amber-500/[0.06]"
                    : "border-destructive/40 bg-destructive/[0.06]"
                )}
              >
                <AlertTriangle
                  className={cn(
                    "size-3.5 shrink-0",
                    issue.level === "warning" ? "text-amber-500" : "text-destructive"
                  )}
                />
                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold">{node.name}</div>
                  <div className="truncate text-[10px] text-muted-foreground">
                    {issue.message}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function NodeSettings({
  node,
  onDelete,
  onAddZone,
  onRemoveZone,
  onResizeZone,
  onSetZoneColor,
  onSetZoneWireFollows,
}: {
  node: GraphNode
  onDelete: () => void
  onAddZone: (nodeId: string) => void
  onRemoveZone: (nodeId: string, portId: string) => void
  onResizeZone: (
    nodeId: string,
    portId: string,
    range: { fromNote: number; toNote: number }
  ) => void
  onSetZoneColor: (nodeId: string, portId: string, hue: number | undefined) => void
  onSetZoneWireFollows: (nodeId: string, portId: string, follows: boolean) => void
}) {
  const isPlugin = node.kind === "instrument.plugin"
  return (
    <div className="grid h-full grid-cols-[280px_1fr] gap-4 text-xs">
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
                  <span className="truncate">{portRowLabel(p)}</span>
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
      <div className="min-w-0">
        {isPlugin ? (
          <PluginUIDock node={node} />
        ) : (
          <KindConfig
            node={node}
            onAddZone={() => onAddZone(node.id)}
            onRemoveZone={(portId) => onRemoveZone(node.id, portId)}
            onResizeZone={(portId, range) => onResizeZone(node.id, portId, range)}
            onSetZoneColor={(portId, hue) => onSetZoneColor(node.id, portId, hue)}
            onSetZoneWireFollows={(portId, follows) =>
              onSetZoneWireFollows(node.id, portId, follows)
            }
          />
        )}
      </div>
    </div>
  )
}

function portRowLabel(p: GraphNode["ports"][number]): string {
  if (p.config?.kind === "zone") {
    return `${noteNameFor(p.config.fromNote)}–${noteNameFor(p.config.toNote)}`
  }
  return p.label
}

function noteNameFor(midi: number): string {
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
  return `${names[midi % 12]}${Math.floor(midi / 12) - 1}`
}

function PluginUIDock({ node }: { node: GraphNode }) {
  const uri = (node.config?.pluginUri as string | undefined) ?? "Surge XT"
  const preset = (node.config?.preset as string | undefined) ?? "Init"
  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Plugin
        </div>
        <span className="rounded-sm bg-muted/40 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">
          {uri}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <SettingRow label="Preset" value={preset} />
        <SettingRow label="Bank" value="Factory · Brass" />
        <SettingRow label="Polyphony" value="16" />
        <SettingRow label="MIDI channel" value="Omni" />
      </div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Quick params
      </div>
      <div className="flex items-stretch gap-3 rounded-md border bg-background px-3 py-2">
        <ParamKnob label="Cutoff" value={0.62} />
        <ParamKnob label="Reso" value={0.34} />
        <ParamKnob label="Drive" value={0.18} />
        <ParamKnob label="Attack" value={0.05} />
        <ParamKnob label="Release" value={0.42} />
      </div>
      <button
        type="button"
        className="mt-auto flex items-center justify-center gap-1.5 rounded-md border bg-card px-2 py-1.5 text-[11px] font-medium hover:bg-muted/40"
      >
        <Settings className="size-3" />
        Open full plugin UI
      </button>
    </div>
  )
}

function KindConfig({
  node,
  onAddZone,
  onRemoveZone,
  onResizeZone,
  onSetZoneColor,
  onSetZoneWireFollows,
}: {
  node: GraphNode
  onAddZone: () => void
  onRemoveZone: (portId: string) => void
  onResizeZone: (portId: string, range: { fromNote: number; toNote: number }) => void
  onSetZoneColor: (portId: string, hue: number | undefined) => void
  onSetZoneWireFollows: (portId: string, follows: boolean) => void
}) {
  return (
    <div className="flex h-full flex-col gap-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {node.name}
      </div>
      {node.kind === "midi.transpose" && (
        <div className="rounded-md border bg-background">
          <SettingRow label="Semitones" value={`${(node.config?.semitones as number) ?? 0}`} />
          <SettingRow label="Velocity scale" value="1.00x" />
          <SettingRow label="Channel remap" value="Pass-through" />
        </div>
      )}
      {node.kind === "audio.eq" && (
        <div className="rounded-md border bg-background">
          <SettingRow label="Low (80 Hz shelf)" value={`${(node.config?.low as number) ?? 0} dB`} slider />
          <SettingRow label="Mid (1.2 kHz peaking)" value={`${(node.config?.mid as number) ?? 0} dB`} slider />
          <SettingRow label="High (8 kHz shelf)" value={`${(node.config?.high as number) ?? 0} dB`} slider />
          <SettingRow label="Output trim" value="0.0 dB" slider />
        </div>
      )}
      {node.kind === "source.keyboard" && (
        <KeyboardZoneEditor
          node={node}
          onAddZone={onAddZone}
          onRemoveZone={onRemoveZone}
          onResizeZone={onResizeZone}
          onSetZoneColor={onSetZoneColor}
          onSetZoneWireFollows={onSetZoneWireFollows}
        />
      )}
      {node.kind === "instrument.sine" && (
        <div className="rounded-md border bg-background">
          <SettingRow label="Polyphony" value={`${(node.config?.polyphony as number) ?? 8}`} />
          <SettingRow label="Attack" value="5 ms" slider />
          <SettingRow label="Release" value="280 ms" slider />
        </div>
      )}
      {node.kind === "sink.main-out" && (
        <div className="rounded-md border bg-background">
          <SettingRow label="Output device" value="System default" />
          <SettingRow label="Output trim" value="0.0 dB" slider />
          <SettingRow label="DC blocker" value="On" />
        </div>
      )}
      {![
        "midi.transpose",
        "audio.eq",
        "source.keyboard",
        "instrument.sine",
        "sink.main-out",
      ].includes(node.kind) && (
        <div className="grid h-full place-items-center rounded-md border bg-muted/20 text-[11px] text-muted-foreground">
          <div className="max-w-md p-6 text-center">
            Kind-specific controls for {node.kind} land here.
          </div>
        </div>
      )}
    </div>
  )
}

function KeyboardZoneEditor({
  node,
  onAddZone,
  onRemoveZone,
  onResizeZone,
  onSetZoneColor,
  onSetZoneWireFollows,
}: {
  node: GraphNode
  onAddZone: () => void
  onRemoveZone: (portId: string) => void
  onResizeZone: (portId: string, range: { fromNote: number; toNote: number }) => void
  onSetZoneColor: (portId: string, hue: number | undefined) => void
  onSetZoneWireFollows: (portId: string, follows: boolean) => void
}) {
  const zonePorts = node.ports.filter(
    (p) => p.direction === "out" && p.config?.kind === "zone"
  )
  const [learning, setLearning] = React.useState<
    { portId: string; field: "low" | "high" } | null
  >(null)
  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-md border bg-background">
        <SettingRow label="Velocity curve" value="Linear" />
        <SettingRow label="Default channel" value="1" />
      </div>

      <div className="flex items-center justify-between pt-1">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Zones ({zonePorts.length || "full range"})
        </div>
        <button
          type="button"
          onClick={onAddZone}
          className="flex items-center gap-1 rounded-md border bg-card px-2 py-1 text-[10px] font-medium hover:bg-muted/40"
          title="Split the keyboard into another range"
        >
          <Plus className="size-3" />
          Add zone
        </button>
      </div>

      {zonePorts.length === 0 ? (
        <div className="rounded-md border border-dashed bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
          No zones yet — the whole keyboard sends to the single MIDI out.
          Add a zone to split the range and route different parts to
          different sounds.
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {zonePorts.map((p) => {
            const cfg = p.config as {
              kind: "zone"
              fromNote: number
              toNote: number
              colorHue?: number
              wireFollowsColor?: boolean
            }
            const isLearning = learning?.portId === p.id
            return (
              <div
                key={p.id}
                className="flex flex-col gap-1.5 rounded-md border bg-background p-2"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{
                      background:
                        typeof cfg.colorHue === "number"
                          ? hueToColor(cfg.colorHue)
                          : "oklch(0.7 0.15 280)",
                    }}
                  />
                  <span className="font-mono text-[11px]">
                    {noteNameFor(cfg.fromNote)}–{noteNameFor(cfg.toNote)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemoveZone(p.id)}
                    title="Remove zone"
                    className="ml-auto grid size-5 place-items-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-1">
                  <NoteStepperWithLearn
                    label="Low"
                    value={cfg.fromNote}
                    learning={isLearning && learning?.field === "low"}
                    onToggleLearn={() =>
                      setLearning((l) =>
                        l?.portId === p.id && l.field === "low"
                          ? null
                          : { portId: p.id, field: "low" }
                      )
                    }
                    onChange={(v) =>
                      onResizeZone(p.id, {
                        fromNote: Math.min(v, cfg.toNote),
                        toNote: cfg.toNote,
                      })
                    }
                  />
                  <NoteStepperWithLearn
                    label="High"
                    value={cfg.toNote}
                    learning={isLearning && learning?.field === "high"}
                    onToggleLearn={() =>
                      setLearning((l) =>
                        l?.portId === p.id && l.field === "high"
                          ? null
                          : { portId: p.id, field: "high" }
                      )
                    }
                    onChange={(v) =>
                      onResizeZone(p.id, {
                        fromNote: cfg.fromNote,
                        toNote: Math.max(v, cfg.fromNote),
                      })
                    }
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Colour
                  </span>
                  <div className="flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onSetZoneColor(p.id, undefined)}
                      className={cn(
                        "h-5 rounded border px-1.5 text-[9px] hover:bg-muted/40",
                        cfg.colorHue === undefined && "border-primary/40 bg-primary/5"
                      )}
                    >
                      Auto
                    </button>
                    {ZONE_HUES.map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => onSetZoneColor(p.id, h)}
                        className={cn(
                          "size-5 rounded border hover:scale-110 transition-transform",
                          cfg.colorHue === h && "ring-2 ring-primary"
                        )}
                        style={{ background: hueToColor(h) }}
                        title={`Zone hue ${h}`}
                      />
                    ))}
                  </div>
                  <label className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={cfg.wireFollowsColor !== false}
                      onChange={(e) => onSetZoneWireFollows(p.id, e.target.checked)}
                      className="size-3"
                    />
                    Wires match
                  </label>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function NoteStepperWithLearn({
  label,
  value,
  learning,
  onChange,
  onToggleLearn,
}: {
  label: string
  value: number
  learning?: boolean
  onChange: (v: number) => void
  onToggleLearn?: () => void
}) {
  const clamp = (v: number) => Math.max(0, Math.min(127, v))
  return (
    <div className="flex items-center gap-0.5 rounded border bg-card px-1">
      <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <button
        type="button"
        onClick={() => onChange(clamp(value - 1))}
        className="grid size-4 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        −
      </button>
      <span className="min-w-[28px] text-center font-mono text-[10px]">
        {noteNameFor(value)}
      </span>
      <button
        type="button"
        onClick={() => onChange(clamp(value + 1))}
        className="grid size-4 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        +
      </button>
      <button
        type="button"
        onClick={onToggleLearn}
        title={learning ? "Cancel learn — press to stop" : "Press to learn the next note from your controller"}
        className={cn(
          "ml-0.5 rounded px-1.5 text-[9px] font-semibold uppercase tracking-wider",
          learning
            ? "bg-primary text-primary-foreground animate-pulse"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        {learning ? "Learn…" : "Learn"}
      </button>
    </div>
  )
}

function SettingRow({
  label,
  value,
  slider,
}: {
  label: string
  value: string
  slider?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b px-3 py-1.5 last:border-b-0">
      <span className="truncate text-[11px] text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        {slider && (
          <span className="block h-1 w-20 rounded-full bg-muted/40">
            <span className="block h-full w-1/2 rounded-full bg-primary/60" />
          </span>
        )}
        <span className="truncate font-mono text-[11px] text-foreground">
          {value}
        </span>
      </div>
    </div>
  )
}

function ParamKnob({ label, value }: { label: string; value: number }) {
  const rotation = -135 + value * 270
  return (
    <div className="flex flex-1 flex-col items-center gap-1">
      <div
        className="relative size-9 rounded-full"
        style={{
          background:
            "radial-gradient(circle at 50% 30%, #4a4a52 0%, #232328 70%, #15151a 100%)",
          boxShadow:
            "0 2px 4px rgba(0,0,0,0.4), inset 0 -1px 0 rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)",
        }}
      >
        <div
          className="absolute left-1/2 top-1/2 origin-bottom"
          style={{
            width: 2,
            height: 13,
            marginLeft: -1,
            marginTop: -13,
            background: "oklch(0.85 0.05 0)",
            transform: `rotate(${rotation}deg)`,
            transformOrigin: "bottom",
          }}
        />
      </div>
      <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
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

const COMPOSITE_HUES: Array<{ label: string; hue: number }> = [
  { label: "Amber", hue: 60 },
  { label: "Violet", hue: 290 },
  { label: "Rose", hue: 0 },
  { label: "Cyan", hue: 200 },
  { label: "Green", hue: 145 },
  { label: "Blue", hue: 250 },
]

function CompositeSettings({
  composite,
  graph,
  onToggleLock,
  onSetColor,
  onAddPromotedPort,
  onRemovePromotedPort,
}: {
  composite: CompositeBlock
  graph: PatchGraph
  onToggleLock: () => void
  onSetColor: (hue: number | undefined) => void
  onAddPromotedPort: (spec: {
    internalNode: string
    internalPort: string
    label: string
  }) => void
  onRemovePromotedPort: (portId: string) => void
}) {
  const memberNodes = graph.nodes.filter((n) => composite.contains.includes(n.id))
  const promotedKey = (nid: string, pid: string) => `${nid}:${pid}`
  const alreadyPromoted = new Set(
    composite.promotedPorts.map((p) => promotedKey(p.internalNode, p.internalPort))
  )
  const candidates = memberNodes.flatMap((n) =>
    n.ports.map((p) => ({
      node: n,
      port: p,
      taken: alreadyPromoted.has(promotedKey(n.id, p.id)),
    }))
  )
  return (
    <div className="grid h-full grid-cols-[260px_1fr] gap-4 text-xs">
      <div className="flex flex-col gap-3 border-r pr-4">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Composite block
          </div>
          <div className="text-sm font-semibold">{composite.name}</div>
          <div className="mt-0.5 text-[10px] text-muted-foreground">
            {composite.contains.length} nodes · {composite.promotedPorts.length} promoted
          </div>
        </div>
        <button
          type="button"
          onClick={onToggleLock}
          className="flex items-center justify-center gap-2 rounded-md border px-3 py-1.5 hover:bg-muted/40"
        >
          {composite.locked ? <Unlock className="size-3.5" /> : <Lock className="size-3.5" />}
          {composite.locked ? "Unlock (edit contents)" : "Lock (drag as one)"}
        </button>
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Color
          </label>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => onSetColor(undefined)}
              className={cn(
                "flex h-7 items-center gap-1.5 rounded-md border px-2 text-[10px] hover:bg-muted/40",
                composite.colorHue === undefined && "border-primary/40 bg-primary/5"
              )}
            >
              Auto
            </button>
            {COMPOSITE_HUES.map((c) => (
              <button
                key={c.hue}
                type="button"
                onClick={() => onSetColor(c.hue)}
                className={cn(
                  "size-6 rounded-md border hover:scale-110 transition-transform",
                  composite.colorHue === c.hue && "ring-2 ring-primary"
                )}
                title={c.label}
                style={{ background: `oklch(0.7 0.18 ${c.hue})` }}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Promoted ports — wires connect to these instead of the internal nodes
        </div>

        {composite.promotedPorts.length === 0 && (
          <div className="rounded-md border border-dashed bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
            No promoted ports yet. Add one below to surface an internal port
            on the composite frame.
          </div>
        )}
        <div className="flex flex-col gap-1">
          {composite.promotedPorts.map((p) => {
            const internal = memberNodes.find((n) => n.id === p.internalNode)
            const ipt = internal?.ports.find((ip) => ip.id === p.internalPort)
            return (
              <div
                key={p.id}
                className="flex items-center gap-2 rounded-md border bg-background px-2 py-1.5"
              >
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
                  {p.direction === "in" ? "→ in" : "← out"}
                </span>
                <span className="truncate font-medium">{p.label}</span>
                <span className="ml-auto truncate text-[10px] text-muted-foreground">
                  {internal?.name ?? "?"} · {ipt?.label ?? p.internalPort}
                </span>
                <button
                  type="button"
                  onClick={() => onRemovePromotedPort(p.id)}
                  title="Remove promoted port"
                  className="grid size-5 place-items-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            )
          })}
        </div>

        <div className="mt-2 flex flex-col gap-1.5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Add a port (pick an internal port to surface)
          </div>
          <div className="grid grid-cols-2 gap-1">
            {candidates
              .filter((c) => !c.taken)
              .map((c) => (
                <button
                  key={`${c.node.id}:${c.port.id}`}
                  type="button"
                  onClick={() =>
                    onAddPromotedPort({
                      internalNode: c.node.id,
                      internalPort: c.port.id,
                      label: c.port.label,
                    })
                  }
                  className="flex items-center gap-2 rounded-md border bg-background px-2 py-1.5 text-left hover:border-primary/50 hover:bg-muted/40"
                >
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{
                      background:
                        c.port.signal === "midi"
                          ? "oklch(0.7 0.15 280)"
                          : "oklch(0.7 0.15 145)",
                    }}
                  />
                  <span className="text-[10px] text-muted-foreground">
                    {c.port.direction === "in" ? "→" : "←"}
                  </span>
                  <span className="truncate text-[11px]">{c.node.name}</span>
                  <span className="ml-auto truncate font-mono text-[10px] text-muted-foreground">
                    {c.port.label}
                  </span>
                </button>
              ))}
          </div>
          {candidates.filter((c) => !c.taken).length === 0 && (
            <div className="text-[10px] text-muted-foreground">
              All member-node ports are already promoted.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// Mix tab
// =============================================================================

function MixTab({
  nodes,
  soloed,
  muted,
  onToggleSolo,
  onToggleMute,
}: {
  nodes: GraphNode[]
  soloed: Set<string>
  muted: Set<string>
  onToggleSolo: (id: string) => void
  onToggleMute: (id: string) => void
}) {
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
    <div className="flex h-full items-stretch gap-6 px-2 py-1 text-xs">
      {instruments.length > 0 && (
        <StripGroup
          title="Instruments"
          nodes={instruments}
          soloable
          soloed={soloed}
          muted={muted}
          onToggleSolo={onToggleSolo}
          onToggleMute={onToggleMute}
        />
      )}
      {groups.length > 0 && <StripGroup title="Groups" nodes={groups} />}
      {masters.length > 0 && <StripGroup title="Master" nodes={masters} master />}
    </div>
  )
}

function StripGroup({
  title,
  nodes,
  master,
  soloable,
  soloed,
  muted,
  onToggleSolo,
  onToggleMute,
}: {
  title: string
  nodes: GraphNode[]
  master?: boolean
  soloable?: boolean
  soloed?: Set<string>
  muted?: Set<string>
  onToggleSolo?: (id: string) => void
  onToggleMute?: (id: string) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      <div className="flex flex-1 items-stretch gap-2">
        {nodes.map((n) => (
          <ChannelStrip
            key={n.id}
            node={n}
            master={master}
            soloable={soloable}
            solo={soloed?.has(n.id)}
            muted={muted?.has(n.id)}
            onToggleSolo={onToggleSolo ? () => onToggleSolo(n.id) : undefined}
            onToggleMute={onToggleMute ? () => onToggleMute(n.id) : undefined}
          />
        ))}
      </div>
    </div>
  )
}

function ChannelStrip({
  node,
  master,
  soloable,
  solo,
  muted,
  onToggleSolo,
  onToggleMute,
}: {
  node: GraphNode
  master?: boolean
  soloable?: boolean
  solo?: boolean
  muted?: boolean
  onToggleSolo?: () => void
  onToggleMute?: () => void
}) {
  const cls = CLASS_COLORS[classOf(node.kind)]
  return (
    <div
      className={cn(
        "flex w-16 flex-col items-center gap-2 rounded-md border bg-background px-2 py-2",
        muted && "opacity-50"
      )}
      style={{
        borderTopColor: `oklch(0.7 0.18 ${cls.hue})`,
        borderTopWidth: master ? 4 : 2,
      }}
    >
      <span className="line-clamp-2 w-full text-center text-[10px] font-semibold leading-tight">
        {node.name}
      </span>
      {soloable && (
        <div className="flex gap-0.5">
          <button
            type="button"
            onClick={onToggleSolo}
            className={cn(
              "grid size-5 place-items-center rounded text-[9px] font-bold",
              solo ? "bg-yellow-400 text-black" : "bg-muted/40 text-muted-foreground hover:text-foreground"
            )}
            title="Solo"
          >
            S
          </button>
          <button
            type="button"
            onClick={onToggleMute}
            className={cn(
              "grid size-5 place-items-center rounded text-[9px] font-bold",
              muted ? "bg-red-500 text-white" : "bg-muted/40 text-muted-foreground hover:text-foreground"
            )}
            title="Mute"
          >
            M
          </button>
        </div>
      )}
      <div className="relative my-1 flex w-3 flex-1 items-center rounded-full bg-muted/40" style={{ minHeight: 100 }}>
        <div
          className="absolute left-1/2 size-3.5 -translate-x-1/2 rounded-sm bg-foreground/40"
          style={{ top: "30%" }}
        />
      </div>
      <span className="w-full text-center font-mono text-[9px] text-muted-foreground">
        {master ? "0.0" : "−6.0"}
      </span>
    </div>
  )
}
