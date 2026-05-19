import * as React from "react"
import { cn } from "@/lib/utils"
import { PatchNode, absolutePortPosition, nodeBounds } from "./patch-node"
import { PatchWire } from "./patch-wire"
import { CompositeBlockFrame } from "./composite-block"
import type {
  GraphNode,
  PatchGraph,
  SignalKind,
  Wire,
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
  nodeId: string
  offsetX: number
  offsetY: number
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

// =============================================================================
// Props
// =============================================================================

export interface PatchCanvasProps {
  graph: PatchGraph
  gridSize?: number
  selectedNodeId?: string
  selectedWireId?: string
  onSelectNode?: (id: string | undefined) => void
  onSelectWire?: (id: string | undefined) => void
  onMoveNode?: (id: string, x: number, y: number) => void
  onCreateWire?: (params: {
    fromNode: string
    fromPort: string
    toNode: string
    toPort: string
  }) => void
  /** Click an input port → delete the wire feeding it (if any). */
  onDeleteWiresInto?: (nodeId: string, portId: string) => void
  onOpenCanvasMenu?: (anchor: { x: number; y: number }) => void
  onOpenNodeMenu?: (nodeId: string, anchor: { x: number; y: number }) => void
  onOpenWireMenu?: (wireId: string, anchor: { x: number; y: number }) => void
  onOpenCompositeMenu?: (
    compositeId: string,
    anchor: { x: number; y: number }
  ) => void
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
  selectedNodeId,
  selectedWireId,
  onSelectNode,
  onSelectWire,
  onMoveNode,
  onCreateWire,
  onDeleteWiresInto,
  onOpenCanvasMenu,
  onOpenNodeMenu,
  onOpenWireMenu,
  onOpenCompositeMenu,
  activeNodeIds,
  activeWireIds,
  className,
}: PatchCanvasProps) {
  const surfaceRef = React.useRef<HTMLDivElement>(null)
  const [view, setView] = React.useState<ViewTransform>(DEFAULT_VIEW)

  // Convert page-space pointer to canvas-space (undo pan + zoom).
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

  // Node lookup.
  const nodeMap = React.useMemo(() => {
    const m = new Map<string, GraphNode>()
    for (const n of graph.nodes) m.set(n.id, n)
    return m
  }, [graph.nodes])

  // Connected port map per node.
  const connectedPorts = React.useMemo(() => {
    const m = new Map<string, Set<string>>()
    for (const w of graph.wires) {
      addPort(m, w.fromNode, w.fromPort)
      addPort(m, w.toNode, w.toPort)
    }
    return m
  }, [graph.wires])

  // -------------------------------------------------------------------------
  // Pan
  // -------------------------------------------------------------------------

  const [panDrag, setPanDrag] = React.useState<PanDrag | null>(null)

  const onSurfacePointerDown = (e: React.PointerEvent) => {
    // Pan when the click was on bare canvas (not a node/wire/composite).
    if (e.target !== e.currentTarget) return
    // Left-click or middle-click both work to pan; right reserved for menu.
    if (e.button !== 0 && e.button !== 1) return
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
    // Always treat the wheel as zoom in this canvas — no native scroll.
    e.preventDefault()
    const surface = surfaceRef.current
    if (!surface) return
    const rect = surface.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    const factor = e.deltaY > 0 ? 0.92 : 1.08
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, view.zoom * factor))
    if (newZoom === view.zoom) return

    // Keep the point under the cursor fixed in canvas space.
    const canvasX = (mouseX - view.panX) / view.zoom
    const canvasY = (mouseY - view.panY) / view.zoom
    const newPanX = mouseX - canvasX * newZoom
    const newPanY = mouseY - canvasY * newZoom

    setView({ zoom: newZoom, panX: newPanX, panY: newPanY })
  }

  // -------------------------------------------------------------------------
  // Drag-to-move-node
  // -------------------------------------------------------------------------

  const [nodeDrag, setNodeDrag] = React.useState<NodeDrag | null>(null)

  const onNodeBodyPointerDown = (nodeId: string) => (e: React.PointerEvent) => {
    const node = nodeMap.get(nodeId)
    if (!node) return
    const cs = toCanvasSpace(e)
    setNodeDrag({
      nodeId,
      offsetX: cs.x - node.x,
      offsetY: cs.y - node.y,
    })
  }

  // -------------------------------------------------------------------------
  // Drag-to-connect-wire (OUTPUT ports only; inputs click-to-delete)
  // -------------------------------------------------------------------------

  const [wireDrag, setWireDrag] = React.useState<WireDrag | null>(null)

  const onPortPointerDown = (
    nodeId: string,
    portId: string,
    e: React.PointerEvent
  ) => {
    const node = nodeMap.get(nodeId)
    if (!node) return
    const port = node.ports.find((p) => p.id === portId)
    if (!port) return

    if (port.direction === "in") {
      // Input port: click deletes existing connection feeding this port.
      // We don't capture pointer or start a drag for inputs.
      onDeleteWiresInto?.(nodeId, portId)
      return
    }

    // Output port: start a wire drag.
    const anchor = absolutePortPosition(node, portId)
    if (!anchor) return
    const cs = toCanvasSpace(e)
    setWireDrag({
      fromNode: nodeId,
      fromPort: portId,
      signal: port.signal,
      anchor,
      cursor: cs,
      hovering: null,
    })
    // Note: NO setPointerCapture — that prevents pointerup from firing on
    // the target input port, breaking snap-to-connect. Window listeners
    // handle movement + release.
  }

  const onPortPointerEnter = (nodeId: string, portId: string) => {
    if (!wireDrag) return
    const node = nodeMap.get(nodeId)
    if (!node) return
    const port = node.ports.find((p) => p.id === portId)
    if (!port) return
    // Compatible: same signal, opposite direction (= input for output-source drag),
    // and not the same node.
    if (port.signal !== wireDrag.signal) return
    if (port.direction !== "in") return
    if (nodeId === wireDrag.fromNode) return
    setWireDrag({ ...wireDrag, hovering: { nodeId, portId } })
  }

  const onPortPointerLeave = (nodeId: string, portId: string) => {
    if (!wireDrag?.hovering) return
    if (
      wireDrag.hovering.nodeId === nodeId &&
      wireDrag.hovering.portId === portId
    ) {
      setWireDrag({ ...wireDrag, hovering: null })
    }
  }

  const onPortPointerUp = (nodeId: string, portId: string) => {
    if (!wireDrag) return
    const node = nodeMap.get(nodeId)
    const port = node?.ports.find((p) => p.id === portId)
    if (
      port &&
      port.signal === wireDrag.signal &&
      port.direction === "in" &&
      nodeId !== wireDrag.fromNode
    ) {
      onCreateWire?.({
        fromNode: wireDrag.fromNode,
        fromPort: wireDrag.fromPort,
        toNode: nodeId,
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
  // Global pointer handlers (move + up) for node + wire drags
  // -------------------------------------------------------------------------

  React.useEffect(() => {
    if (!nodeDrag && !wireDrag) return
    const onMove = (e: PointerEvent) => {
      const cs = toCanvasSpace(e)
      if (nodeDrag) {
        const nx = Math.max(0, cs.x - nodeDrag.offsetX)
        const ny = Math.max(0, cs.y - nodeDrag.offsetY)
        onMoveNode?.(nodeDrag.nodeId, nx, ny)
      }
      if (wireDrag) {
        setWireDrag((d) => (d ? { ...d, cursor: cs } : d))
      }
    }
    const onUp = () => {
      if (nodeDrag) setNodeDrag(null)
      if (wireDrag) setWireDrag(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
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
  }, [nodeDrag, wireDrag, onMoveNode, toCanvasSpace])

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div
      ref={surfaceRef}
      className={cn(
        "relative h-full w-full overflow-hidden bg-background",
        panDrag ? "cursor-grabbing" : "cursor-default",
        className
      )}
      style={{
        // Grid moves with pan, doesn't scale with zoom (avoids ant patterns).
        backgroundImage:
          "radial-gradient(circle, var(--border) 1px, transparent 1px)",
        backgroundSize: `${gridSize}px ${gridSize}px`,
        backgroundPosition: `${view.panX % gridSize}px ${view.panY % gridSize}px`,
      }}
      onContextMenu={(e) => {
        if (!onOpenCanvasMenu) return
        if ((e.target as HTMLElement).closest("[data-node-root]")) return
        e.preventDefault()
        onOpenCanvasMenu({ x: e.clientX, y: e.clientY })
      }}
      onPointerDown={onSurfacePointerDown}
      onWheel={onWheel}
    >
      {/* Inner transformed surface — pan + zoom applied here.
          MUST have explicit width/height: SVG children use inset-0 + 100%
          dimensions and would otherwise collapse to 0×0 (no wires render). */}
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{
          transform: `translate(${view.panX}px, ${view.panY}px) scale(${view.zoom})`,
          willChange: "transform",
          width: 5000,
          height: 5000,
        }}
      >
        {/* Composite block frames (behind everything) */}
        {graph.composites.map((c) => {
          const memberNodes = graph.nodes.filter((n) =>
            c.contains.includes(n.id)
          )
          return (
            <CompositeBlockFrame
              key={c.id}
              composite={c}
              nodes={memberNodes}
              onOpenMenu={
                onOpenCompositeMenu
                  ? (anchor) => onOpenCompositeMenu(c.id, anchor)
                  : undefined
              }
            />
          )
        })}

        {/* Wires (SVG) */}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          style={{ overflow: "visible" }}
        >
          <g style={{ pointerEvents: "auto" }}>
            {graph.wires.map((w) => {
              const obstacles = computeObstacles(graph.nodes, w)
              return (
                <WireRenderer
                  key={w.id}
                  wire={w}
                  nodeMap={nodeMap}
                  obstacles={obstacles}
                  selected={w.id === selectedWireId}
                  active={activeWireIds?.has(w.id)}
                  onSelect={
                    onSelectWire ? () => onSelectWire(w.id) : undefined
                  }
                  onOpenMenu={
                    onOpenWireMenu
                      ? (anchor) => onOpenWireMenu(w.id, anchor)
                      : undefined
                  }
                />
              )
            })}
            {wireDrag && <GhostWire drag={wireDrag} nodeMap={nodeMap} />}
          </g>
        </svg>

        {/* Nodes (HTML on top of wires) */}
        {graph.nodes.map((n) => {
          const cnxSet = connectedPorts.get(n.id)
          const connectedMap: Record<string, boolean> = {}
          if (cnxSet) for (const p of cnxSet) connectedMap[p] = true
          return (
            <div
              key={n.id}
              data-node-root
              className="absolute"
              style={{ left: n.x, top: n.y }}
            >
              <PatchNode
                node={n}
                selected={n.id === selectedNodeId}
                active={activeNodeIds?.has(n.id)}
                connected={connectedMap}
                highlighted={highlightedByNode.get(n.id)}
                onSelect={
                  onSelectNode ? () => onSelectNode(n.id) : undefined
                }
                onBodyPointerDown={onNodeBodyPointerDown(n.id)}
                onOpenMenu={
                  onOpenNodeMenu
                    ? (anchor) => onOpenNodeMenu(n.id, anchor)
                    : undefined
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

      {/* Zoom indicator + reset (bottom-right corner) */}
      <div className="pointer-events-auto absolute bottom-2 right-2 flex items-center gap-1 rounded-md border bg-card/90 px-1.5 py-1 text-[10px] font-mono backdrop-blur-sm">
        <button
          type="button"
          className="grid size-5 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={() => setView(DEFAULT_VIEW)}
          title="Reset view"
        >
          ⌂
        </button>
        <span className="px-1 text-muted-foreground tabular-nums">
          {Math.round(view.zoom * 100)}%
        </span>
      </div>
    </div>
  )
}

// =============================================================================
// Helpers
// =============================================================================

function WireRenderer({
  wire,
  nodeMap,
  obstacles,
  selected,
  active,
  onSelect,
  onOpenMenu,
}: {
  wire: Wire
  nodeMap: Map<string, GraphNode>
  obstacles: ReturnType<typeof computeObstacles>
  selected?: boolean
  active?: boolean
  onSelect?: () => void
  onOpenMenu?: (anchor: { x: number; y: number }) => void
}) {
  const fromNode = nodeMap.get(wire.fromNode)
  const toNode = nodeMap.get(wire.toNode)
  if (!fromNode || !toNode) return null
  const from = absolutePortPosition(fromNode, wire.fromPort)
  const to = absolutePortPosition(toNode, wire.toPort)
  if (!from || !to) return null
  const port = fromNode.ports.find((p) => p.id === wire.fromPort)
  if (!port) return null
  return (
    <PatchWire
      from={from}
      to={to}
      signal={port.signal}
      color={wire.color}
      selected={selected}
      active={active}
      obstacles={obstacles}
      onSelect={onSelect}
      onOpenMenu={onOpenMenu}
    />
  )
}

function GhostWire({
  drag,
  nodeMap,
}: {
  drag: WireDrag
  nodeMap: Map<string, GraphNode>
}) {
  let to = drag.cursor
  if (drag.hovering) {
    const targetNode = nodeMap.get(drag.hovering.nodeId)
    if (targetNode) {
      const snap = absolutePortPosition(targetNode, drag.hovering.portId)
      if (snap) to = snap
    }
  }
  return (
    <PatchWire
      from={drag.anchor}
      to={to}
      signal={drag.signal}
      selected
    />
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
