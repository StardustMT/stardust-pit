import * as React from "react"
import { Lock, Unlock } from "lucide-react"
import { cn } from "@/lib/utils"
import { NODE_WIDTH } from "./patch-node"
import type { CompositeBlock, GraphNode } from "./_types"

const PADDING = 18
/** Approximate visible height per node (header + ports). Conservative — the
 *  bounding box can be slightly oversized rather than clip a node. */
const APPROX_NODE_HEIGHT = 160

export interface CompositeBlockFrameProps {
  composite: CompositeBlock
  nodes: GraphNode[] // contained nodes (already filtered by composite.contains)
  onToggleLock?: () => void
}

/**
 * Visual frame for a composite block — a labelled bounding box wrapping a
 * sub-graph. Title sits in the top-left corner; lock icon next to it.
 *
 * Layout: positioned at the bounding rect of contained nodes (plus padding).
 * Renders BEHIND nodes (z-index 0) so the frame appears as a backdrop.
 *
 * Interaction (lock/unlock, drag, edit-internals) lands later.
 */
export function CompositeBlockFrame({
  composite,
  nodes,
  onToggleLock,
}: CompositeBlockFrameProps) {
  if (nodes.length === 0) return null

  const rect = computeBounds(nodes)

  return (
    <div
      className={cn(
        "pointer-events-none absolute rounded-lg border-2",
        composite.locked
          ? "border-solid border-amber-500/50 bg-amber-500/[0.04]"
          : "border-dashed border-violet-500/50 bg-violet-500/[0.04]"
      )}
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
      }}
    >
      {/* Title bar (top-left, sits on the border) */}
      <div
        className={cn(
          "pointer-events-auto absolute -top-[14px] left-3 flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider shadow-sm",
          composite.locked
            ? "border-amber-500/40 bg-amber-500/[0.12] text-amber-500"
            : "border-violet-500/40 bg-violet-500/[0.12] text-violet-400"
        )}
      >
        <button
          type="button"
          onClick={onToggleLock}
          className="grid size-4 place-items-center rounded hover:bg-white/10"
          aria-label={composite.locked ? "Unlock composite" : "Lock composite"}
        >
          {composite.locked ? (
            <Lock className="size-3" />
          ) : (
            <Unlock className="size-3" />
          )}
        </button>
        <span className="normal-case">{composite.name}</span>
        {composite.locked && (
          <span className="opacity-60">· {nodes.length} blocks</span>
        )}
      </div>
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
  const maxX = Math.max(...nodes.map((n) => n.x + NODE_WIDTH))
  const maxY = Math.max(...nodes.map((n) => n.y + APPROX_NODE_HEIGHT))
  return {
    x: minX - PADDING,
    y: minY - PADDING,
    width: maxX - minX + PADDING * 2,
    height: maxY - minY + PADDING * 2,
  }
}
