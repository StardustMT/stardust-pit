import * as React from "react"
import { cn } from "@/lib/utils"
import { PatchNode } from "./patch-node"
import { PatchWire } from "./patch-wire"
import { absolutePortPosition } from "./patch-node"
import { CompositeBlockFrame } from "./composite-block"
import type { GraphNode, PatchGraph, Wire } from "./_types"

export interface PatchCanvasProps {
  graph: PatchGraph
  /** Grid cell size in pixels for the dotted background. */
  gridSize?: number
  selectedNodeId?: string
  selectedWireId?: string
  onSelectNode?: (id: string) => void
  onSelectWire?: (id: string) => void
  /** Ids of nodes currently "lit up" (signal flowing). */
  activeNodeIds?: Set<string>
  /** Ids of wires currently "lit up" (events in flight). */
  activeWireIds?: Set<string>
  className?: string
}

/**
 * Holds the graph visualization. Renders SVG wires beneath HTML nodes so
 * cables sit behind cards but stay anti-aliased and clickable. Pan + zoom
 * land in a later iteration; for now this is a static-position view.
 */
export function PatchCanvas({
  graph,
  gridSize = 16,
  selectedNodeId,
  selectedWireId,
  onSelectNode,
  onSelectWire,
  activeNodeIds,
  activeWireIds,
  className,
}: PatchCanvasProps) {
  const nodeMap = React.useMemo(() => {
    const m = new Map<string, GraphNode>()
    for (const n of graph.nodes) m.set(n.id, n)
    return m
  }, [graph.nodes])

  // Per-node port-connection map (highlights connected ports visually).
  const connectedPorts = React.useMemo(() => {
    const m = new Map<string, Set<string>>()
    for (const w of graph.wires) {
      addPort(m, w.fromNode, w.fromPort)
      addPort(m, w.toNode, w.toPort)
    }
    return m
  }, [graph.wires])

  return (
    <div
      className={cn(
        "relative h-full w-full overflow-auto bg-background",
        className
      )}
      style={{
        backgroundImage:
          "radial-gradient(circle, var(--border) 1px, transparent 1px)",
        backgroundSize: `${gridSize}px ${gridSize}px`,
      }}
    >
      {/* Inner large surface so the canvas can scroll past placed nodes. */}
      <div className="relative" style={{ minWidth: 2000, minHeight: 1400 }}>
        {/* Composite block frames — sit BEHIND wires + nodes */}
        {graph.composites.map((c) => {
          const memberNodes = graph.nodes.filter((n) => c.contains.includes(n.id))
          return (
            <CompositeBlockFrame
              key={c.id}
              composite={c}
              nodes={memberNodes}
            />
          )
        })}

        {/* Wires layer (SVG, sits behind nodes) */}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          style={{ overflow: "visible" }}
        >
          <g style={{ pointerEvents: "auto" }}>
            {graph.wires.map((w) => (
              <WireRenderer
                key={w.id}
                wire={w}
                nodeMap={nodeMap}
                selected={w.id === selectedWireId}
                active={activeWireIds?.has(w.id)}
                onSelect={onSelectWire ? () => onSelectWire(w.id) : undefined}
              />
            ))}
          </g>
        </svg>

        {/* Nodes layer (HTML, on top) */}
        {graph.nodes.map((n) => {
          const cnxSet = connectedPorts.get(n.id)
          const connectedMap: Record<string, boolean> = {}
          if (cnxSet) for (const p of cnxSet) connectedMap[p] = true
          return (
            <div
              key={n.id}
              className="absolute"
              style={{ left: n.x, top: n.y }}
            >
              <PatchNode
                node={n}
                selected={n.id === selectedNodeId}
                active={activeNodeIds?.has(n.id)}
                connected={connectedMap}
                onSelect={
                  onSelectNode ? () => onSelectNode(n.id) : undefined
                }
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function WireRenderer({
  wire,
  nodeMap,
  selected,
  active,
  onSelect,
}: {
  wire: Wire
  nodeMap: Map<string, GraphNode>
  selected?: boolean
  active?: boolean
  onSelect?: () => void
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
      onSelect={onSelect}
    />
  )
}

function addPort(m: Map<string, Set<string>>, nodeId: string, portId: string) {
  let s = m.get(nodeId)
  if (!s) {
    s = new Set()
    m.set(nodeId, s)
  }
  s.add(portId)
}
