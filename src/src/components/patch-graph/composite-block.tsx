import * as React from "react"
import { Lock, Unlock } from "lucide-react"
import { cn } from "@/lib/utils"
import { nodeBounds } from "./patch-node"
import {
  SIGNAL_DEFAULT_COLORS,
  type CompositeBlock,
  type GraphNode,
  type PromotedPort,
} from "./_types"

/**
 * Padding around the contained nodes. Larger on left/right than top/bottom
 * to give the promoted-port labels room to live INSIDE the frame without
 * occluding internal nodes or colliding with external wires.
 */
const PADDING_X = 72
const PADDING_TOP = 28
const PADDING_BOTTOM = 18

export interface CompositeBlockFrameProps {
  composite: CompositeBlock
  nodes: GraphNode[]
  selected?: boolean
  /** Highlight specific promoted ports (drag preview, hover). */
  highlightedPorts?: Record<string, boolean>
  /** Connected promoted ports (any wire touches them). */
  connectedPorts?: Record<string, boolean>
  onToggleLock?: () => void
  onOpenMenu?: (anchor: { x: number; y: number }) => void
  /** Single-click on the title chip — selects the composite (opens settings). */
  onSelect?: () => void
  /** Left pointer-down on the title chip — begins a drag of the whole block. */
  onLabelPointerDown?: (e: React.PointerEvent) => void
  onPortPointerDown?: (portId: string, e: React.PointerEvent) => void
  onPortPointerEnter?: (portId: string) => void
  onPortPointerLeave?: (portId: string) => void
  onPortPointerUp?: (portId: string) => void
}

/**
 * Labelled bounding box wrapping a sub-graph.
 *
 * Promoted port labels render INSIDE the composite (just inboard of the
 * border), backed by a translucent chip so they stay readable against any
 * internal-node fill. The left/right padding reserves enough horizontal
 * space for label widths so they don't overlap content.
 *
 * Composite border is high-contrast (amber locked, violet unlocked).
 * Title chip on the top edge is the menu-open click target.
 */
export function CompositeBlockFrame({
  composite,
  nodes,
  selected,
  highlightedPorts,
  connectedPorts,
  onToggleLock,
  onOpenMenu,
  onSelect,
  onLabelPointerDown,
  onPortPointerDown,
  onPortPointerEnter,
  onPortPointerLeave,
  onPortPointerUp,
}: CompositeBlockFrameProps) {
  if (nodes.length === 0) return null

  const rect = computeBounds(nodes)
  const hue = composite.colorHue
  const hasCustomHue = typeof hue === "number"
  const borderColor = hasCustomHue
    ? `oklch(0.7 0.18 ${hue})`
    : composite.locked
      ? "oklch(0.75 0.18 60)" // amber
      : "oklch(0.7 0.18 290)" // violet
  const bgColor = hasCustomHue
    ? `oklch(0.7 0.18 ${hue} / 0.05)`
    : composite.locked
      ? "oklch(0.75 0.18 60 / 0.05)"
      : "oklch(0.7 0.18 290 / 0.05)"
  const borderStyle = composite.locked ? "solid" : "dashed"

  const inputs = composite.promotedPorts.filter((p) => p.direction === "in")
  const outputs = composite.promotedPorts.filter((p) => p.direction === "out")

  return (
    <div
      className={cn(
        "pointer-events-none absolute rounded-xl border-2",
        selected && "ring-2 ring-primary/40",
      )}
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
        borderColor,
        background: bgColor,
        borderStyle,
      }}
      onContextMenu={(e) => {
        if (!onOpenMenu) return
        e.preventDefault()
        onOpenMenu({ x: e.clientX, y: e.clientY })
      }}
    >
      {/* Title chip on top edge.
          - Left pointer-down on the chip body → start drag of whole block.
          - Plain click (no movement) → select composite (opens settings).
          - Right click → context menu.
          - Lock icon → toggle lock only.
          The chip is a <div> (not a button) so it can be a pointer-down
          drag handle without firing browser default click semantics. */}
      <div
        className={cn(
          "pointer-events-auto absolute -top-[14px] left-3 flex items-center gap-1.5",
          "rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider shadow-sm",
          "bg-card text-foreground cursor-grab hover:brightness-110 active:cursor-grabbing select-none",
        )}
        style={{ borderColor }}
        onPointerDown={(e) => {
          if (e.button !== 0) return
          // Lock icon owns its own handler — bail if the press landed there.
          if ((e.target as HTMLElement).closest("[data-composite-lock]")) return
          e.stopPropagation()
          onSelect?.()
          onLabelPointerDown?.(e)
        }}
        onContextMenu={(e) => {
          if (!onOpenMenu) return
          e.preventDefault()
          e.stopPropagation()
          onOpenMenu({ x: e.clientX, y: e.clientY })
        }}
        title="Drag to move · right-click for options"
      >
        <span
          data-composite-lock
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            onToggleLock?.()
          }}
          role="button"
          tabIndex={-1}
          className="grid size-4 place-items-center rounded hover:bg-muted"
          style={{ color: borderColor }}
          aria-label={composite.locked ? "Unlock composite" : "Lock composite"}
        >
          {composite.locked ? <Lock className="size-3" /> : <Unlock className="size-3" />}
        </span>
        <span className="normal-case">{composite.name}</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">{nodes.length} blocks</span>
      </div>

      <PortColumn
        ports={inputs}
        side="left"
        height={rect.height}
        highlightedPorts={highlightedPorts}
        connectedPorts={connectedPorts}
        onPortPointerDown={onPortPointerDown}
        onPortPointerEnter={onPortPointerEnter}
        onPortPointerLeave={onPortPointerLeave}
        onPortPointerUp={onPortPointerUp}
      />
      <PortColumn
        ports={outputs}
        side="right"
        height={rect.height}
        highlightedPorts={highlightedPorts}
        connectedPorts={connectedPorts}
        onPortPointerDown={onPortPointerDown}
        onPortPointerEnter={onPortPointerEnter}
        onPortPointerLeave={onPortPointerLeave}
        onPortPointerUp={onPortPointerUp}
      />
    </div>
  )
}

function PortColumn({
  ports,
  side,
  height,
  highlightedPorts,
  connectedPorts,
  onPortPointerDown,
  onPortPointerEnter,
  onPortPointerLeave,
  onPortPointerUp,
}: {
  ports: PromotedPort[]
  side: "left" | "right"
  height: number
  highlightedPorts?: Record<string, boolean>
  connectedPorts?: Record<string, boolean>
  onPortPointerDown?: (portId: string, e: React.PointerEvent) => void
  onPortPointerEnter?: (portId: string) => void
  onPortPointerLeave?: (portId: string) => void
  onPortPointerUp?: (portId: string) => void
}) {
  if (ports.length === 0) return null
  const layout = promotedPortYs(ports.length, height)
  return (
    <>
      {ports.map((p, i) => {
        const y = layout[i]
        return (
          <PromotedPortHandle
            key={p.id}
            port={p}
            side={side}
            top={y}
            highlighted={highlightedPorts?.[p.id]}
            connected={connectedPorts?.[p.id]}
            onPointerDown={onPortPointerDown}
            onPointerEnter={onPortPointerEnter}
            onPortPointerLeave={onPortPointerLeave}
            onPortPointerUp={onPortPointerUp}
          />
        )
      })}
    </>
  )
}

function PromotedPortHandle({
  port,
  side,
  top,
  highlighted,
  connected,
  onPointerDown,
  onPointerEnter,
  onPortPointerLeave,
  onPortPointerUp,
}: {
  port: PromotedPort
  side: "left" | "right"
  top: number
  highlighted?: boolean
  connected?: boolean
  onPointerDown?: (portId: string, e: React.PointerEvent) => void
  onPointerEnter?: (portId: string) => void
  onPortPointerLeave?: (portId: string) => void
  onPortPointerUp?: (portId: string) => void
}) {
  const color = SIGNAL_DEFAULT_COLORS[port.signal]
  const cursor =
    port.direction === "out" ? "cursor-crosshair" : connected ? "cursor-pointer" : "cursor-default"
  return (
    <>
      {/* Interactive circle: straddles the border */}
      <button
        type="button"
        className={cn(
          "pointer-events-auto absolute z-10 block size-3.5 rounded-full border-2 border-card transition-transform",
          highlighted && "scale-150 ring-2 ring-primary/50",
          cursor,
        )}
        style={{
          [side === "left" ? "left" : "right"]: -7,
          top: top - 7,
          background: color,
        }}
        title={`${port.label} — ${port.direction === "out" ? "drag to connect" : "drop wire here"}`}
        onPointerDown={(e) => {
          if (e.button !== 0) return
          e.stopPropagation()
          onPointerDown?.(port.id, e)
        }}
        onPointerEnter={() => onPointerEnter?.(port.id)}
        onPointerLeave={() => onPortPointerLeave?.(port.id)}
        onPointerUp={() => onPortPointerUp?.(port.id)}
      />
      {/* Label: INSIDE the composite */}
      <span
        className="pointer-events-none absolute whitespace-nowrap rounded bg-card/85 px-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground backdrop-blur-sm"
        style={{
          [side === "left" ? "left" : "right"]: 12,
          top: top - 8,
        }}
      >
        {port.label}
      </span>
    </>
  )
}

/** Y-positions for N promoted ports in a column of the given height. */
function promotedPortYs(count: number, height: number): number[] {
  const usable = Math.max(0, height - PADDING_TOP - PADDING_BOTTOM)
  const minSpacing = 32
  const spacing = Math.min(usable / Math.max(1, count), minSpacing * 1.5)
  const totalUsed = spacing * (count - 1)
  const startY = (height - totalUsed) / 2
  return Array.from({ length: count }, (_, i) => startY + i * spacing)
}

function computeBounds(nodes: GraphNode[]): {
  x: number
  y: number
  width: number
  height: number
} {
  const minX = Math.min(...nodes.map((n) => n.x))
  const minY = Math.min(...nodes.map((n) => n.y))
  const maxX = Math.max(...nodes.map((n) => nodeBounds(n).x + nodeBounds(n).width))
  const maxY = Math.max(...nodes.map((n) => nodeBounds(n).y + nodeBounds(n).height))
  return {
    x: minX - PADDING_X,
    y: minY - PADDING_TOP,
    width: maxX - minX + PADDING_X * 2,
    height: maxY - minY + PADDING_TOP + PADDING_BOTTOM,
  }
}

/**
 * Absolute position of a composite's promoted port on the canvas. Returns
 * null if the composite has no members or the port isn't found.
 */
export function compositePortPosition(
  composite: CompositeBlock,
  memberNodes: GraphNode[],
  portId: string,
): { x: number; y: number } | null {
  if (memberNodes.length === 0) return null
  const port = composite.promotedPorts.find((p) => p.id === portId)
  if (!port) return null
  const sideList = composite.promotedPorts.filter((p) => p.direction === port.direction)
  const idx = sideList.findIndex((p) => p.id === portId)
  if (idx < 0) return null
  const rect = computeBounds(memberNodes)
  const ys = promotedPortYs(sideList.length, rect.height)
  return {
    x: rect.x + (port.direction === "in" ? 0 : rect.width),
    y: rect.y + ys[idx],
  }
}

export function compositeBounds(memberNodes: GraphNode[]) {
  if (memberNodes.length === 0) return null
  return computeBounds(memberNodes)
}
