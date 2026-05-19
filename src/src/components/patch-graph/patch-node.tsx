import * as React from "react"
import { cn } from "@/lib/utils"
import { NodeBody, PluginChip, hasPluginChip, pluginChipName } from "./node-body"
import { CLASS_COLORS, classOf, SIGNAL_DEFAULT_COLORS, type GraphNode, type Port } from "./_types"

export const NODE_WIDTH = 220

const HEADER_HEIGHT = 44
const BODY_TOP_PAD = 12
const PORT_ROW_HEIGHT = 22
const PORT_RADIUS = 7 // pixels — half of size-3.5 (14px) for centering

export interface PortDragHandle {
  onPortPointerDown?: (
    nodeId: string,
    portId: string,
    e: React.PointerEvent
  ) => void
  onPortPointerEnter?: (nodeId: string, portId: string) => void
  onPortPointerLeave?: (nodeId: string, portId: string) => void
  onPortPointerUp?: (nodeId: string, portId: string) => void
}

export interface PatchNodeProps extends PortDragHandle {
  node: GraphNode
  selected?: boolean
  active?: boolean
  connected?: Record<string, boolean>
  highlighted?: Record<string, boolean>
  onSelect?: () => void
  onBodyPointerDown?: (e: React.PointerEvent) => void
  onOpenMenu?: (anchor: { x: number; y: number }) => void
}

/**
 * A single graph node — header (drag handle, class color, optional plugin
 * chip) + body (kind-specific inline controls) + port handles overlapping
 * the left and right borders with their labels positioned OUTSIDE the
 * node so neighbouring widgets in the body never occlude them.
 */
export function PatchNode({
  node,
  selected,
  active,
  connected,
  highlighted,
  onSelect,
  onBodyPointerDown,
  onOpenMenu,
  onPortPointerDown,
  onPortPointerEnter,
  onPortPointerLeave,
  onPortPointerUp,
}: PatchNodeProps) {
  const cls = classOf(node.kind)
  const palette = CLASS_COLORS[cls]
  const inputs = node.ports.filter((p) => p.direction === "in")
  const outputs = node.ports.filter((p) => p.direction === "out")

  const headerBg = `oklch(0.35 0.08 ${palette.hue})`
  const headerText = `oklch(0.95 0.05 ${palette.hue})`
  const accent = `oklch(0.7 0.18 ${palette.hue})`

  const chipName = hasPluginChip(node) ? pluginChipName(node) : undefined

  return (
    <div
      style={{
        width: NODE_WIDTH,
        borderColor: selected ? accent : undefined,
        boxShadow: active
          ? `0 0 0 1px ${accent}, 0 0 16px -2px ${accent}`
          : selected
            ? `0 0 0 2px ${accent}`
            : undefined,
      }}
      className={cn(
        "relative rounded-md border bg-card text-card-foreground transition-shadow",
        "shadow-md hover:shadow-lg select-none"
      )}
      onContextMenu={(e) => {
        if (!onOpenMenu) return
        e.preventDefault()
        onOpenMenu({ x: e.clientX, y: e.clientY })
      }}
    >
      {/* Header — drag handle. Cursor-grab only here, per UX feedback. */}
      <div
        className="flex cursor-grab items-center justify-between gap-2 rounded-t-md px-2.5 py-1.5 active:cursor-grabbing"
        style={{ background: headerBg, color: headerText, height: HEADER_HEIGHT }}
        onPointerDown={(e) => {
          if (e.button !== 0) return
          onSelect?.()
          onBodyPointerDown?.(e)
        }}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[9px] font-semibold uppercase tracking-wider opacity-70">
              {palette.label}
            </span>
            {chipName && <PluginChip name={chipName} />}
          </div>
          <div className="truncate text-xs font-semibold">{node.name}</div>
        </div>
      </div>

      {/* Body — single column. Ports overlay independently. */}
      <div className="px-3 py-2">
        <NodeBody node={node} />
      </div>

      {/* Ports — absolutely positioned on the node's edges */}
      {inputs.map((port, i) => (
        <PortHandle
          key={port.id}
          port={port}
          side="left"
          top={portYForIndex(i)}
          connected={connected?.[port.id]}
          highlighted={highlighted?.[port.id]}
          onPointerDown={(e) => onPortPointerDown?.(node.id, port.id, e)}
          onPointerEnter={() => onPortPointerEnter?.(node.id, port.id)}
          onPointerLeave={() => onPortPointerLeave?.(node.id, port.id)}
          onPointerUp={() => onPortPointerUp?.(node.id, port.id)}
        />
      ))}
      {outputs.map((port, i) => (
        <PortHandle
          key={port.id}
          port={port}
          side="right"
          top={portYForIndex(i)}
          connected={connected?.[port.id]}
          highlighted={highlighted?.[port.id]}
          onPointerDown={(e) => onPortPointerDown?.(node.id, port.id, e)}
          onPointerEnter={() => onPortPointerEnter?.(node.id, port.id)}
          onPointerLeave={() => onPortPointerLeave?.(node.id, port.id)}
          onPointerUp={() => onPortPointerUp?.(node.id, port.id)}
        />
      ))}
    </div>
  )
}

function portYForIndex(i: number): number {
  return HEADER_HEIGHT + BODY_TOP_PAD + i * PORT_ROW_HEIGHT + PORT_RADIUS
}

/**
 * Single port = circle handle straddling the node border + label sitting
 * OUTSIDE the node (left of an input port, right of an output port).
 */
function PortHandle({
  port,
  side,
  top,
  connected,
  highlighted,
  onPointerDown,
  onPointerEnter,
  onPointerLeave,
  onPointerUp,
}: {
  port: Port
  side: "left" | "right"
  top: number
  connected?: boolean
  highlighted?: boolean
  onPointerDown: (e: React.PointerEvent) => void
  onPointerEnter: () => void
  onPointerLeave: () => void
  onPointerUp: () => void
}) {
  const color = SIGNAL_DEFAULT_COLORS[port.signal]
  const cursor =
    side === "right"
      ? "cursor-crosshair"
      : connected
        ? "cursor-pointer"
        : "cursor-default"
  return (
    <>
      {/* Circle — straddles the border (center on left:0 or left:100%). */}
      <button
        type="button"
        className={cn(
          "absolute size-3.5 rounded-full border-2 border-card transition-transform",
          highlighted && "scale-150 ring-2 ring-primary/50",
          cursor
        )}
        style={{
          left: side === "left" ? 0 : "100%",
          top,
          transform: "translate(-50%, -50%)",
          background: color,
        }}
        title={
          side === "right"
            ? "Drag to connect"
            : connected
              ? "Click to disconnect"
              : "Input"
        }
        onPointerDown={(e) => {
          if (e.button !== 0) return
          e.stopPropagation()
          onPointerDown(e)
        }}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        onPointerUp={onPointerUp}
      />
      {/* Label — outside the node. pointer-events-none so it doesn't block port. */}
      <span
        className={cn(
          "pointer-events-none absolute whitespace-nowrap rounded px-1 text-[9px] font-medium text-muted-foreground",
          highlighted && "text-foreground"
        )}
        style={{
          left: side === "left" ? 0 : "100%",
          top,
          transform:
            side === "left"
              ? "translate(calc(-100% - 12px), -50%)"
              : "translate(12px, -50%)",
        }}
      >
        {port.label}
      </span>
    </>
  )
}

// =============================================================================
// Geometry helpers used by the canvas to draw wires between ports.
// =============================================================================

/**
 * Port center relative to the node's top-left corner. Wire endpoints use
 * these values; they must match the visual port circle position.
 */
export function portOffset(
  node: GraphNode,
  portId: string
): { x: number; y: number } | null {
  const port = node.ports.find((p) => p.id === portId)
  if (!port) return null
  const sideList = node.ports.filter((p) => p.direction === port.direction)
  const indexInSide = sideList.findIndex((p) => p.id === portId)
  if (indexInSide < 0) return null
  return {
    x: port.direction === "in" ? 0 : NODE_WIDTH,
    y: portYForIndex(indexInSide),
  }
}

export function absolutePortPosition(
  node: GraphNode,
  portId: string
): { x: number; y: number } | null {
  const offset = portOffset(node, portId)
  if (!offset) return null
  return { x: node.x + offset.x, y: node.y + offset.y }
}

/** Conservative node bounding box for wire-routing obstacle avoidance. */
export function nodeBounds(node: GraphNode): {
  x: number
  y: number
  width: number
  height: number
} {
  const portCount = Math.max(
    node.ports.filter((p) => p.direction === "in").length,
    node.ports.filter((p) => p.direction === "out").length
  )
  const bodyHeight = Math.max(
    BODY_TOP_PAD + portCount * PORT_ROW_HEIGHT + 20,
    minBodyHeightForKind(node.kind)
  )
  return {
    x: node.x,
    y: node.y,
    width: NODE_WIDTH,
    height: HEADER_HEIGHT + bodyHeight,
  }
}

function minBodyHeightForKind(kind: GraphNode["kind"]): number {
  switch (kind) {
    case "source.keyboard":
    case "source.pads":
      return 56
    case "instrument.plugin":
    case "instrument.sine":
      return 64
    case "audio.eq":
      return 56
    case "sink.main-out":
      return 56
    default:
      return 48
  }
}
