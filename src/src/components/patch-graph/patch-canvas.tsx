import * as React from "react"
import { cn } from "@/lib/utils"
import { PatchNode, absolutePortPosition, nodeBounds } from "./patch-node"
import { PatchWire } from "./patch-wire"
import {
  CompositeBlockFrame,
  compositePortPosition,
} from "./composite-block"
import type {
  CompositeBlock,
  GraphNode,
  NodeKind,
  PatchGraph,
  SignalKind,
} from "./_types"

// =============================================================================
// Drag types
// =============================================================================

interface WireDrag {
  fromNode: string
  fromPort: string
  signal: SignalKind
  anchor: { x: number; y: number }
  cursor: { x: number; y: number }
  hovering: { nodeId: string; portId: string } | null
}

interface NodeDrag {
  primaryNodeId: string
  /** Per-node offsets for group drag (selected set). */
  offsets: Map<string, { offsetX: number; offsetY: number }>
}

interface PanDrag {
  startClientX: number
  startClientY: number
  startPanX: number
  startPanY: number
}

interface ViewTransform {
  panX: number
  panY: number
  zoom: number
}

const MIN_ZOOM = 0.4
const MAX_ZOOM = 2.0
const DEFAULT_VIEW: ViewTransform = { panX: 0, panY: 0, zoom: 1 }
const SURFACE_SIZE = 5000

// =============================================================================
// Props
// =============================================================================

export interface PatchCanvasProps {
  graph: PatchGraph
  gridSize?: number
  /** Multi-selection set. Includes the "primary" selection too. */
  selectedNodeIds?: Set<string>
  selectedWireId?: string
  selectedCompositeId?: string
  onSelectNode?: (id: string | undefined, additive?: boolean) => void
  onSelectWire?: (id: string | undefined) => void
  onMoveNodes?: (deltas: Array<{ id: string; x: number; y: number }>) => void
  /** Fired once at the start of a node drag — host should snapshot for undo. */
  onNodeDragStart?: () => void
  /** Fired once at the end of a node drag — host can commit / clear flags. */
  onNodeDragEnd?: () => void
  onCreateWire?: (params: {
    fromNode: string
    fromPort: string
    toNode: string
    toPort: string
  }) => void
  onDeleteWiresInto?: (nodeId: string, portId: string) => void
  /** Canvas blank-space menu. anchor = client coords; canvasPos = inner-canvas coords. */
  onOpenCanvasMenu?: (
    anchor: { x: number; y: number },
    canvasPos: { x: number; y: number }
  ) => void
  onOpenNodeMenu?: (nodeId: string, anchor: { x: number; y: number }) => void
  onOpenWireMenu?: (wireId: string, anchor: { x: number; y: number }) => void
  onOpenCompositeMenu?: (
    compositeId: string,
    anchor: { x: number; y: number }
  ) => void
  /** Single-click on composite title chip — opens settings panel for it. */
  onSelectComposite?: (compositeId: string) => void
  /** Library drag-to-place handler. Receives the dropped kind + canvas pos. */
  onDropFromLibrary?: (kind: NodeKind, canvasPos: { x: number; y: number }) => void
  /** Per-node validation status badges. */
  validation?: Map<string, { level: "warning" | "error"; message: string }>
  /** Per-node solo state. */
  soloed?: Set<string>
  /** Per-node mute state. */
  muted?: Set<string>
  onToggleSolo?: (nodeId: string) => void
  onToggleMute?: (nodeId: string) => void
  activeNodeIds?: Set<string>
  activeWireIds?: Set<string>
  className?: string
}

// =============================================================================
// Canvas
// =============================================================================

export function PatchCanvas({
  graph,
  gridSize = 16,
  selectedNodeIds,
  selectedWireId,
  selectedCompositeId: _selectedCompositeId,
  onSelectNode,
  onSelectWire,
  onMoveNodes,
  onNodeDragStart,
  onNodeDragEnd,
  onCreateWire,
  onDeleteWiresInto,
  onOpenCanvasMenu,
  onOpenNodeMenu,
  onOpenWireMenu,
  onOpenCompositeMenu,
  onSelectComposite,
  onDropFromLibrary,
  validation,
  soloed,
  muted,
  onToggleSolo,
  onToggleMute,
  activeNodeIds,
  activeWireIds,
  className,
}: PatchCanvasProps) {
  const surfaceRef = React.useRef<HTMLDivElement>(null)
  const innerRef = React.useRef<HTMLDivElement>(null)
  const [view, setView] = React.useState<ViewTransform>(DEFAULT_VIEW)
  const [smoothPan, setSmoothPan] = React.useState(false)

  const selectedSet = selectedNodeIds ?? new Set<string>()

  const toCanvasSpace = React.useCallback(
    (e: { clientX: number; clientY: number }): { x: number; y: number } => {
      const surface = surfaceRef.current
      if (!surface) return { x: 0, y: 0 }
      const rect = surface.getBoundingClientRect()
      return {
        x: (e.clientX - rect.left - view.panX) / view.zoom,
        y: (e.clientY - rect.top - view.panY) / view.zoom,
      }
    },
    [view.panX, view.panY, view.zoom]
  )

  const nodeMap = React.useMemo(() => {
    const m = new Map<string, GraphNode>()
    for (const n of graph.nodes) m.set(n.id, n)
    return m
  }, [graph.nodes])

  // Composite lookup + per-composite member-node list (for port positioning).
  const compositeMap = React.useMemo(() => {
    const m = new Map<string, { composite: CompositeBlock; members: GraphNode[] }>()
    for (const c of graph.composites) {
      const members = graph.nodes.filter((n) => c.contains.includes(n.id))
      m.set(c.id, { composite: c, members })
    }
    return m
  }, [graph.composites, graph.nodes])

  // Set of "internal" node ports that are surfaced via a composite promoted
  // port — these render with a dimmed/wireless visual on the node and reject
  // direct wiring (force the user to wire to the composite instead).
  const internalPromotedPortsByNode = React.useMemo(() => {
    const m = new Map<string, Record<string, boolean>>()
    for (const c of graph.composites) {
      for (const p of c.promotedPorts) {
        let row = m.get(p.internalNode)
        if (!row) {
          row = {}
          m.set(p.internalNode, row)
        }
        row[p.internalPort] = true
      }
    }
    return m
  }, [graph.composites])

  // Resolve an endpoint id to a port position. The id may be a node id OR
  // a composite id — composites first, then nodes.
  const resolveEndpoint = React.useCallback(
    (id: string, portId: string): { x: number; y: number; signal: SignalKind } | null => {
      const comp = compositeMap.get(id)
      if (comp) {
        const pos = compositePortPosition(comp.composite, comp.members, portId)
        const port = comp.composite.promotedPorts.find((p) => p.id === portId)
        if (!pos || !port) return null
        return { ...pos, signal: port.signal }
      }
      const node = nodeMap.get(id)
      if (!node) return null
      const pos = absolutePortPosition(node, portId)
      const port = node.ports.find((p) => p.id === portId)
      if (!pos || !port) return null
      return { ...pos, signal: port.signal }
    },
    [compositeMap, nodeMap]
  )

  const connectedPorts = React.useMemo(() => {
    // Tracks BOTH node and composite ports — keyed by owner id (node id or
    // composite id), value is the set of port ids on that owner.
    const m = new Map<string, Set<string>>()
    for (const w of graph.wires) {
      addPort(m, w.fromNode, w.fromPort)
      addPort(m, w.toNode, w.toPort)
    }
    return m
  }, [graph.wires])

  // -------------------------------------------------------------------------
  // Pan (handled on the INNER transformed div — empty space delivers events
  // there since the inner div fills the surface with explicit dimensions)
  // -------------------------------------------------------------------------

  const [panDrag, setPanDrag] = React.useState<PanDrag | null>(null)

  const onInnerPointerDown = (e: React.PointerEvent) => {
    // Pan only when click is on the bare canvas background.
    if (e.target !== e.currentTarget) return
    if (e.button !== 0 && e.button !== 1) return
    setSmoothPan(false)
    setPanDrag({
      startClientX: e.clientX,
      startClientY: e.clientY,
      startPanX: view.panX,
      startPanY: view.panY,
    })
    onSelectNode?.(undefined)
    onSelectWire?.(undefined)
  }

  React.useEffect(() => {
    if (!panDrag) return
    const onMove = (e: PointerEvent) => {
      const dx = e.clientX - panDrag.startClientX
      const dy = e.clientY - panDrag.startClientY
      setView((v) => ({ ...v, panX: panDrag.startPanX + dx, panY: panDrag.startPanY + dy }))
    }
    const onUp = () => setPanDrag(null)
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    return () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
    }
  }, [panDrag])

  // -------------------------------------------------------------------------
  // Zoom (wheel)
  // -------------------------------------------------------------------------

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const surface = surfaceRef.current
    if (!surface) return
    const rect = surface.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    const factor = e.deltaY > 0 ? 0.92 : 1.08
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, view.zoom * factor))
    if (newZoom === view.zoom) return

    const canvasX = (mouseX - view.panX) / view.zoom
    const canvasY = (mouseY - view.panY) / view.zoom
    const newPanX = mouseX - canvasX * newZoom
    const newPanY = mouseY - canvasY * newZoom

    setSmoothPan(false)
    setView({ zoom: newZoom, panX: newPanX, panY: newPanY })
  }

  // -------------------------------------------------------------------------
  // Auto-bring-into-view when selection changes
  // -------------------------------------------------------------------------

  // Bring the selected node into view only when it's outside the visible
  // canvas rect (or about to be occluded by the bottom panel). If the node
  // is already comfortably in frame, do not pan — the user is likely
  // looking at a logical group around it.
  const lastBroughtIntoViewRef = React.useRef<string | undefined>(undefined)
  React.useEffect(() => {
    if (!selectedSet || selectedSet.size !== 1) {
      lastBroughtIntoViewRef.current = undefined
      return
    }
    const id = Array.from(selectedSet)[0]
    if (lastBroughtIntoViewRef.current === id) return
    lastBroughtIntoViewRef.current = id
    const node = nodeMap.get(id)
    const surface = surfaceRef.current
    if (!node || !surface) return
    const rect = surface.getBoundingClientRect()
    const bounds = nodeBounds(node)
    const PADDING = 24
    // Node bounds projected to screen space.
    const screenLeft = bounds.x * view.zoom + view.panX
    const screenTop = bounds.y * view.zoom + view.panY
    const screenRight = (bounds.x + bounds.width) * view.zoom + view.panX
    const screenBottom = (bounds.y + bounds.height) * view.zoom + view.panY
    // Visible region inside the surface — leave room for the bottom panel.
    const visTop = PADDING
    const visBottom = rect.height - PADDING
    const visLeft = PADDING
    const visRight = rect.width - PADDING

    let dx = 0
    let dy = 0
    if (screenLeft < visLeft) dx = visLeft - screenLeft
    else if (screenRight > visRight) dx = visRight - screenRight
    if (screenTop < visTop) dy = visTop - screenTop
    else if (screenBottom > visBottom) dy = visBottom - screenBottom

    if (dx === 0 && dy === 0) return
    setSmoothPan(true)
    setView((v) => ({ ...v, panX: v.panX + dx, panY: v.panY + dy }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSet])

  // -------------------------------------------------------------------------
  // Drag-to-move node(s) — supports group drag
  // -------------------------------------------------------------------------

  const [nodeDrag, setNodeDrag] = React.useState<NodeDrag | null>(null)

  const onNodeBodyPointerDown = (nodeId: string) => (e: React.PointerEvent) => {
    const node = nodeMap.get(nodeId)
    if (!node) return
    setSmoothPan(false)
    const cs = toCanvasSpace(e)
    // If the dragged node is part of the selection, move the whole group.
    const dragSet = selectedSet.has(nodeId)
      ? new Set(selectedSet)
      : new Set([nodeId])
    const offsets = new Map<string, { offsetX: number; offsetY: number }>()
    for (const id of dragSet) {
      const n = nodeMap.get(id)
      if (!n) continue
      offsets.set(id, { offsetX: cs.x - n.x, offsetY: cs.y - n.y })
    }
    onNodeDragStart?.()
    setNodeDrag({ primaryNodeId: nodeId, offsets })
  }

  /** Drag the composite frame — moves every member node by the same delta. */
  const onCompositeLabelPointerDown =
    (compositeId: string) => (e: React.PointerEvent) => {
      const comp = compositeMap.get(compositeId)
      if (!comp) return
      setSmoothPan(false)
      const cs = toCanvasSpace(e)
      const offsets = new Map<string, { offsetX: number; offsetY: number }>()
      for (const n of comp.members) {
        offsets.set(n.id, { offsetX: cs.x - n.x, offsetY: cs.y - n.y })
      }
      // Use the first member as the "primary" so existing nodeDrag drains
      // the same way. Composite is just a multi-node drag in disguise.
      const primary = comp.members[0]
      if (!primary) return
      onNodeDragStart?.()
      setNodeDrag({ primaryNodeId: primary.id, offsets })
    }

  // -------------------------------------------------------------------------
  // Drag-to-connect (outputs only)
  // -------------------------------------------------------------------------

  const [wireDrag, setWireDrag] = React.useState<WireDrag | null>(null)

  /** Look up a port on either a node or a composite. */
  const lookupPort = (
    id: string,
    portId: string
  ): { direction: "in" | "out"; signal: SignalKind } | null => {
    const comp = compositeMap.get(id)
    if (comp) {
      const p = comp.composite.promotedPorts.find((p) => p.id === portId)
      return p ? { direction: p.direction, signal: p.signal } : null
    }
    const node = nodeMap.get(id)
    if (!node) return null
    const p = node.ports.find((p) => p.id === portId)
    return p ? { direction: p.direction, signal: p.signal } : null
  }

  const onPortPointerDown = (
    ownerId: string,
    portId: string,
    e: React.PointerEvent
  ) => {
    const port = lookupPort(ownerId, portId)
    if (!port) return

    if (port.direction === "in") {
      onDeleteWiresInto?.(ownerId, portId)
      return
    }

    const anchor = resolveEndpoint(ownerId, portId)
    if (!anchor) return
    const cs = toCanvasSpace(e)
    setWireDrag({
      fromNode: ownerId,
      fromPort: portId,
      signal: port.signal,
      anchor: { x: anchor.x, y: anchor.y },
      cursor: cs,
      hovering: null,
    })
  }

  const onPortPointerEnter = (ownerId: string, portId: string) => {
    if (!wireDrag) return
    const port = lookupPort(ownerId, portId)
    if (!port) return
    if (port.signal !== wireDrag.signal) return
    if (port.direction !== "in") return
    if (ownerId === wireDrag.fromNode) return
    setWireDrag({ ...wireDrag, hovering: { nodeId: ownerId, portId } })
  }

  const onPortPointerLeave = (ownerId: string, portId: string) => {
    if (!wireDrag?.hovering) return
    if (
      wireDrag.hovering.nodeId === ownerId &&
      wireDrag.hovering.portId === portId
    ) {
      setWireDrag({ ...wireDrag, hovering: null })
    }
  }

  const onPortPointerUp = (ownerId: string, portId: string) => {
    if (!wireDrag) return
    const port = lookupPort(ownerId, portId)
    if (
      port &&
      port.signal === wireDrag.signal &&
      port.direction === "in" &&
      ownerId !== wireDrag.fromNode
    ) {
      onCreateWire?.({
        fromNode: wireDrag.fromNode,
        fromPort: wireDrag.fromPort,
        toNode: ownerId,
        toPort: portId,
      })
    }
    setWireDrag(null)
  }

  const highlightedByNode = React.useMemo(() => {
    const m = new Map<string, Record<string, boolean>>()
    if (wireDrag) {
      ensureHighlight(m, wireDrag.fromNode)[wireDrag.fromPort] = true
      if (wireDrag.hovering) {
        ensureHighlight(m, wireDrag.hovering.nodeId)[wireDrag.hovering.portId] = true
      }
    }
    return m
  }, [wireDrag])

  // -------------------------------------------------------------------------
  // Global pointer handlers
  // -------------------------------------------------------------------------

  React.useEffect(() => {
    if (!nodeDrag && !wireDrag) return
    const onMove = (e: PointerEvent) => {
      const cs = toCanvasSpace(e)
      if (nodeDrag) {
        const deltas: Array<{ id: string; x: number; y: number }> = []
        for (const [id, off] of nodeDrag.offsets) {
          deltas.push({
            id,
            x: Math.max(0, cs.x - off.offsetX),
            y: Math.max(0, cs.y - off.offsetY),
          })
        }
        onMoveNodes?.(deltas)
      }
      if (wireDrag) {
        setWireDrag((d) => (d ? { ...d, cursor: cs } : d))
      }
    }
    const onUp = () => {
      if (nodeDrag) {
        setNodeDrag(null)
        onNodeDragEnd?.()
      }
      if (wireDrag) setWireDrag(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (nodeDrag) onNodeDragEnd?.()
        setNodeDrag(null)
        setWireDrag(null)
      }
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("keydown", onKey)
    }
  }, [nodeDrag, wireDrag, onMoveNodes, toCanvasSpace, onNodeDragEnd])

  // -------------------------------------------------------------------------
  // Library drag-to-place (HTML5 DnD)
  // -------------------------------------------------------------------------

  const onDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes("application/x-stardust-node-kind")) {
      e.preventDefault()
      e.dataTransfer.dropEffect = "copy"
    }
  }

  const onDrop = (e: React.DragEvent) => {
    const kind = e.dataTransfer.getData("application/x-stardust-node-kind")
    if (!kind) return
    e.preventDefault()
    const cs = toCanvasSpace(e)
    onDropFromLibrary?.(kind as NodeKind, cs)
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div
      ref={surfaceRef}
      className={cn(
        "relative h-full w-full overflow-hidden bg-background",
        className
      )}
      style={{
        backgroundImage:
          "radial-gradient(circle, var(--border) 1px, transparent 1px)",
        backgroundSize: `${gridSize}px ${gridSize}px`,
        backgroundPosition: `${view.panX % gridSize}px ${view.panY % gridSize}px`,
      }}
      onWheel={onWheel}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onPointerDown={(e) => {
        // Catch pan starts that land outside the 5000×5000 inner surface
        // (i.e. after the user has panned origin into view).
        if (e.target !== e.currentTarget) return
        if (e.button !== 0 && e.button !== 1) return
        setSmoothPan(false)
        setPanDrag({
          startClientX: e.clientX,
          startClientY: e.clientY,
          startPanX: view.panX,
          startPanY: view.panY,
        })
        onSelectNode?.(undefined)
        onSelectWire?.(undefined)
      }}
      onContextMenu={(e) => {
        // Outer-surface fallback so right-click ALWAYS gets the canvas menu
        // even past the inner surface bounds (where the browser default
        // menu would otherwise appear).
        if (!onOpenCanvasMenu) return
        const t = e.target as HTMLElement
        if (t.closest("[data-node-root]")) return
        if (t.closest("[data-composite-root]")) return
        if (t.closest("[data-wire-hit]")) return
        e.preventDefault()
        const cs = toCanvasSpace(e)
        onOpenCanvasMenu({ x: e.clientX, y: e.clientY }, cs)
      }}
    >
      {/* Inner transformed surface. Pan handler lives here so empty-space
          clicks are detected via e.target === e.currentTarget. */}
      <div
        ref={innerRef}
        className={cn(
          "absolute left-0 top-0 origin-top-left",
          panDrag && "cursor-grabbing"
        )}
        style={{
          transform: `translate(${view.panX}px, ${view.panY}px) scale(${view.zoom})`,
          willChange: "transform",
          width: SURFACE_SIZE,
          height: SURFACE_SIZE,
          transition: smoothPan && !panDrag && !nodeDrag
            ? "transform 220ms cubic-bezier(0.4, 0, 0.2, 1)"
            : undefined,
        }}
        onPointerDown={onInnerPointerDown}
        onContextMenu={(e) => {
          if (!onOpenCanvasMenu) return
          if ((e.target as HTMLElement).closest("[data-node-root]")) return
          if ((e.target as HTMLElement).closest("[data-composite-root]")) return
          e.preventDefault()
          const cs = toCanvasSpace(e)
          onOpenCanvasMenu({ x: e.clientX, y: e.clientY }, cs)
        }}
      >
        {/* Composite block frames */}
        {graph.composites.map((c) => {
          const memberNodes = graph.nodes.filter((n) =>
            c.contains.includes(n.id)
          )
          const cnxSet = connectedPorts.get(c.id)
          const connectedMap: Record<string, boolean> = {}
          if (cnxSet) for (const p of cnxSet) connectedMap[p] = true
          return (
            <div data-composite-root key={c.id}>
              <CompositeBlockFrame
                composite={c}
                nodes={memberNodes}
                connectedPorts={connectedMap}
                highlightedPorts={highlightedByNode.get(c.id)}
                onSelect={onSelectComposite ? () => onSelectComposite(c.id) : undefined}
                onLabelPointerDown={onCompositeLabelPointerDown(c.id)}
                onOpenMenu={
                  onOpenCompositeMenu
                    ? (anchor) => onOpenCompositeMenu(c.id, anchor)
                    : undefined
                }
                onPortPointerDown={(portId, e) => onPortPointerDown(c.id, portId, e)}
                onPortPointerEnter={(portId) => onPortPointerEnter(c.id, portId)}
                onPortPointerLeave={(portId) => onPortPointerLeave(c.id, portId)}
                onPortPointerUp={(portId) => onPortPointerUp(c.id, portId)}
              />
            </div>
          )
        })}

        {/* Wires (SVG) */}
        <svg
          className="pointer-events-none absolute inset-0"
          style={{ overflow: "visible", width: SURFACE_SIZE, height: SURFACE_SIZE }}
        >
          <g style={{ pointerEvents: "auto" }}>
            {graph.wires.map((w) => {
              const obstacles = computeObstacles(graph.nodes, w)
              const from = resolveEndpoint(w.fromNode, w.fromPort)
              const to = resolveEndpoint(w.toNode, w.toPort)
              if (!from || !to) return null
              return (
                <PatchWire
                  key={w.id}
                  from={{ x: from.x, y: from.y }}
                  to={{ x: to.x, y: to.y }}
                  signal={from.signal}
                  color={w.color}
                  selected={w.id === selectedWireId}
                  active={activeWireIds?.has(w.id)}
                  obstacles={obstacles}
                  onSelect={onSelectWire ? () => onSelectWire(w.id) : undefined}
                  onOpenMenu={
                    onOpenWireMenu
                      ? (anchor) => onOpenWireMenu(w.id, anchor)
                      : undefined
                  }
                />
              )
            })}
            {wireDrag && (
              <GhostWire drag={wireDrag} resolve={resolveEndpoint} />
            )}
          </g>
        </svg>

        {/* Nodes */}
        {graph.nodes.map((n) => {
          const cnxSet = connectedPorts.get(n.id)
          const connectedMap: Record<string, boolean> = {}
          if (cnxSet) for (const p of cnxSet) connectedMap[p] = true
          const v = validation?.get(n.id)
          return (
            <div
              key={n.id}
              data-node-root
              className="absolute"
              style={{ left: n.x, top: n.y }}
            >
              <PatchNode
                node={n}
                selected={selectedSet.has(n.id)}
                active={activeNodeIds?.has(n.id)}
                validation={v ? v.level : "ok"}
                validationMessage={v?.message}
                solo={soloed?.has(n.id)}
                muted={muted?.has(n.id)}
                connected={connectedMap}
                highlighted={highlightedByNode.get(n.id)}
                promotedPorts={internalPromotedPortsByNode.get(n.id)}
                onSelect={
                  onSelectNode
                    ? () => onSelectNode(n.id, false /* set via outer shift handling */)
                    : undefined
                }
                onBodyPointerDown={onNodeBodyPointerDown(n.id)}
                onOpenMenu={
                  onOpenNodeMenu
                    ? (anchor) => onOpenNodeMenu(n.id, anchor)
                    : undefined
                }
                onToggleSolo={
                  onToggleSolo ? () => onToggleSolo(n.id) : undefined
                }
                onToggleMute={
                  onToggleMute ? () => onToggleMute(n.id) : undefined
                }
                onPortPointerDown={onPortPointerDown}
                onPortPointerEnter={onPortPointerEnter}
                onPortPointerLeave={onPortPointerLeave}
                onPortPointerUp={onPortPointerUp}
              />
            </div>
          )
        })}
      </div>

      {/* Zoom indicator */}
      <div className="pointer-events-auto absolute bottom-2 right-2 flex items-center gap-1 rounded-md border bg-card/90 px-1.5 py-1 text-[10px] font-mono backdrop-blur-sm">
        <button
          type="button"
          className="grid size-5 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={() => {
            setSmoothPan(true)
            setView(DEFAULT_VIEW)
          }}
          title="Reset view"
        >
          ⌂
        </button>
        <span className="px-1 tabular-nums text-muted-foreground">
          {Math.round(view.zoom * 100)}%
        </span>
      </div>
    </div>
  )
}

// =============================================================================
// Helpers
// =============================================================================

function GhostWire({
  drag,
  resolve,
}: {
  drag: WireDrag
  resolve: (id: string, portId: string) => { x: number; y: number; signal: SignalKind } | null
}) {
  let to = drag.cursor
  if (drag.hovering) {
    const snap = resolve(drag.hovering.nodeId, drag.hovering.portId)
    if (snap) to = { x: snap.x, y: snap.y }
  }
  return (
    <PatchWire from={drag.anchor} to={to} signal={drag.signal} selected />
  )
}

function computeObstacles(
  allNodes: GraphNode[],
  wire: Wire
): ReturnType<typeof nodeBounds>[] {
  return allNodes
    .filter((n) => n.id !== wire.fromNode && n.id !== wire.toNode)
    .map((n) => nodeBounds(n))
}

function addPort(m: Map<string, Set<string>>, nodeId: string, portId: string) {
  let s = m.get(nodeId)
  if (!s) {
    s = new Set()
    m.set(nodeId, s)
  }
  s.add(portId)
}

function ensureHighlight(
  m: Map<string, Record<string, boolean>>,
  nodeId: string
): Record<string, boolean> {
  let r = m.get(nodeId)
  if (!r) {
    r = {}
    m.set(nodeId, r)
  }
  return r
}
