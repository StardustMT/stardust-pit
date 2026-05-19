import * as React from "react"
import { Lock, Unlock } from "lucide-react"
import { cn } from "@/lib/utils"
import { nodeBounds } from "./patch-node"
import { SIGNAL_DEFAULT_COLORS, type CompositeBlock, type GraphNode } from "./_types"

/**
 * Padding between the tightest bounding box of contained nodes and the
 * composite frame. Small enough that the frame "hugs" the cluster while
 * leaving room for the title chip on the top edge.
 */
const PADDING_X = 16
const PADDING_TOP = 28
const PADDING_BOTTOM = 16

export interface CompositeBlockFrameProps {
  composite: CompositeBlock
  nodes: GraphNode[]
  selected?: boolean
  onToggleLock?: () => void
  onOpenMenu?: (anchor: { x: number; y: number }) => void
}

/**
 * Labelled bounding box wrapping a sub-graph.
 *
 * • Bounds derived from accurate per-node geometry (no over-padding at
 *   the bottom from a fixed APPROX_NODE_HEIGHT estimate).
 * • Title chip sits on the top border, high-contrast (card bg + accent
 *   border + foreground text). Click opens the composite menu; the lock
 *   icon inside the chip toggles edit/locked state.
 * • Promoted ports render ON the left and right borders, sitting half
 *   inside / half outside (PCB-style).
 */
export function CompositeBlockFrame({
  composite,
  nodes,
  selected,
  onToggleLock,
  onOpenMenu,
}: CompositeBlockFrameProps) {
  if (nodes.length === 0) return null

  const rect = computeBounds(nodes)
  const accent = composite.locked ? "amber" : "violet"
  const borderClass =
    accent === "amber" ? "border-amber-500/70" : "border-violet-500/70"
  const bgClass =
    accent === "amber" ? "bg-amber-500/[0.05]" : "bg-violet-500/[0.05]"
  const borderStyle = composite.locked ? "border-solid" : "border-dashed"
  const chipBorder =
    accent === "amber" ? "border-amber-400" : "border-violet-400"
  const iconColor =
    accent === "amber" ? "text-amber-400" : "text-violet-400"

  const inputs = composite.promotedPorts.filter((p) => p.direction === "in")
  const outputs = composite.promotedPorts.filter((p) => p.direction === "out")

  return (
    <div
      className={cn(
        "pointer-events-none absolute rounded-xl border-2",
        borderClass,
        bgClass,
        borderStyle,
        selected && "ring-2 ring-primary/40"
      )}
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
      }}
      onContextMenu={(e) => {
        if (!onOpenMenu) return
        e.preventDefault()
        onOpenMenu({ x: e.clientX, y: e.clientY })
      }}
    >
      {/* Title chip on top border */}
      <button
        type="button"
        className={cn(
          "pointer-events-auto absolute -top-[14px] left-3 flex items-center gap-1.5",
          "rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider shadow-sm",
          "bg-card text-foreground hover:brightness-110",
          chipBorder
        )}
        onClick={(e) => {
          e.stopPropagation()
          onOpenMenu?.({ x: e.clientX, y: e.clientY })
        }}
        title="Composite options"
      >
        <span
          onClick={(e) => {
            e.stopPropagation()
            onToggleLock?.()
          }}
          role="button"
          tabIndex={-1}
          className={cn(
            "grid size-4 place-items-center rounded hover:bg-muted",
            iconColor
          )}
          aria-label={composite.locked ? "Unlock composite" : "Lock composite"}
        >
          {composite.locked ? (
            <Lock className="size-3" />
          ) : (
            <Unlock className="size-3" />
          )}
        </span>
        <span className="normal-case">{composite.name}</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">{nodes.length} blocks</span>
      </button>

      {/* Promoted input ports on left edge — overlap the border (PCB-style) */}
      <PortColumn
        ports={inputs}
        side="left"
        height={rect.height}
      />
      {/* Promoted output ports on right edge */}
      <PortColumn
        ports={outputs}
        side="right"
        height={rect.height}
      />
    </div>
  )
}

function PortColumn({
  ports,
  side,
  height,
}: {
  ports: CompositeBlock["promotedPorts"]
  side: "left" | "right"
  height: number
}) {
  if (ports.length === 0) return null
  // Distribute ports evenly along the side, with minimum spacing.
  const minSpacing = 28
  const usable = Math.max(0, height - PADDING_TOP - PADDING_BOTTOM)
  const spacing = Math.min(usable / Math.max(1, ports.length), minSpacing * 1.5)
  const totalUsed = spacing * (ports.length - 1)
  const startY = (height - totalUsed) / 2
  return (
    <>
      {ports.map((p, i) => {
        const y = startY + i * spacing
        return (
          <PromotedPort
            key={p.id}
            label={p.label}
            signal={p.signal}
            side={side}
            top={y}
          />
        )
      })}
    </>
  )
}

function PromotedPort({
  label,
  signal,
  side,
  top,
}: {
  label: string
  signal: "midi" | "audio"
  side: "left" | "right"
  top: number
}) {
  const color = SIGNAL_DEFAULT_COLORS[signal]
  return (
    <div
      className={cn(
        "pointer-events-auto absolute flex items-center gap-1.5",
        side === "left" ? "flex-row" : "flex-row-reverse"
      )}
      style={{
        top: top - 6,
        [side === "left" ? "left" : "right"]: -7,
      }}
    >
      <span
        aria-hidden="true"
        className="block size-3 shrink-0 rounded-full border-2 border-card"
        style={{ background: color }}
      />
      <span
        className={cn(
          "rounded px-1 text-[9px] font-medium uppercase tracking-wider text-muted-foreground",
          "bg-card/80 backdrop-blur-sm"
        )}
      >
        {label}
      </span>
    </div>
  )
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
