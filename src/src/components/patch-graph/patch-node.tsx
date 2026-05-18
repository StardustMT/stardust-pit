import * as React from "react"
import { cn } from "@/lib/utils"
import { PatchPort } from "./patch-port"
import { NodeBody, PluginChip, hasPluginChip, pluginChipName } from "./node-body"
import { CLASS_COLORS, classOf, type GraphNode } from "./_types"

export const NODE_WIDTH = 220

/** Pixel height of a node's header band — used by the wire-layout helpers. */
const HEADER_HEIGHT = 44

export interface PatchNodeProps {
  node: GraphNode
  selected?: boolean
  /** Show signal-flow activity glow on the node frame (any-port activity). */
  active?: boolean
  /** Per-port connected map: connected[portId] === true if any wire touches it. */
  connected?: Record<string, boolean>
  /** Per-port highlighted map: highlighted[portId] === true while drawing a wire from/to it. */
  highlighted?: Record<string, boolean>
  onSelect?: () => void
}

/**
 * A single graph node, styled like a guitar pedal: bold header strip with
 * class color + name + (for plugin nodes) the plugin chip; body shows
 * kind-specific inline controls (mini keyboard, transpose stepper, EQ knobs,
 * level meter, etc.); ports line both sides.
 *
 * Geometry helpers below (portOffset, absolutePortPosition) keep the wire
 * layer in sync with port positions inside the node.
 */
export function PatchNode({
  node,
  selected,
  active,
  connected,
  highlighted,
  onSelect,
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
      role="button"
      tabIndex={0}
      onClick={onSelect}
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
        "rounded-md border bg-card text-card-foreground transition-shadow",
        "shadow-md hover:shadow-lg cursor-pointer select-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      )}
    >
      {/* Header: class label / user name / optional plugin chip */}
      <div
        className="flex items-center justify-between gap-2 rounded-t-md px-2.5 py-1.5"
        style={{ background: headerBg, color: headerText, height: HEADER_HEIGHT }}
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

      {/* Body: inputs left | pedal-style mini widget center | outputs right */}
      <div className="grid grid-cols-[auto_1fr_auto] gap-1.5 px-1.5 py-2">
        {/* Input ports */}
        <div className="flex min-w-0 flex-col gap-1.5 pr-1">
          {inputs.map((p) => (
            <PatchPort
              key={p.id}
              port={p}
              connected={connected?.[p.id]}
              highlighted={highlighted?.[p.id]}
            />
          ))}
          {inputs.length === 0 && <span className="h-2" />}
        </div>

        {/* Pedal-style body */}
        <div className="min-w-0">
          <NodeBody node={node} />
        </div>

        {/* Output ports */}
        <div className="flex min-w-0 flex-col items-end gap-1.5 pl-1">
          {outputs.map((p) => (
            <PatchPort
              key={p.id}
              port={p}
              connected={connected?.[p.id]}
              highlighted={highlighted?.[p.id]}
            />
          ))}
          {outputs.length === 0 && <span className="h-2" />}
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// Geometry helpers used by the canvas to draw wires between ports.
//
// We can't perfectly track the body's natural height without a measurement
// pass, so we assume each port row sits at PORT_ROW_HEIGHT inside the body
// region (which matches the gap-1.5 layout). For more accuracy in a future
// pass, switch to a ResizeObserver / ref-based measurement.
// =============================================================================

const BODY_TOP_PAD = 10
const PORT_ROW_HEIGHT = 20

/** Pixel-space center of a port relative to the node's top-left corner. */
export function portOffset(
  node: GraphNode,
  portId: string
): { x: number; y: number } | null {
  const port = node.ports.find((p) => p.id === portId)
  if (!port) return null
  const sideList = node.ports.filter((p) => p.direction === port.direction)
  const indexInSide = sideList.findIndex((p) => p.id === portId)
  if (indexInSide < 0) return null
  const x = port.direction === "in" ? 0 : NODE_WIDTH
  const y =
    HEADER_HEIGHT + BODY_TOP_PAD + indexInSide * PORT_ROW_HEIGHT + 5 // 5 ≈ port radius
  return { x, y }
}

/** Absolute canvas-space center of a port (node origin + offset). */
export function absolutePortPosition(
  node: GraphNode,
  portId: string
): { x: number; y: number } | null {
  const offset = portOffset(node, portId)
  if (!offset) return null
  return { x: node.x + offset.x, y: node.y + offset.y }
}
