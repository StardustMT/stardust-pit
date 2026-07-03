import * as React from "react"
import { cn } from "@/lib/utils"
import { NodeBody } from "./node-body"
import { typeLabelFor } from "./_catalog"
import {
  CLASS_COLORS,
  classOf,
  getPluginChoice,
  SIGNAL_DEFAULT_COLORS,
  type GraphNode,
  type Port,
} from "./_types"

/** Base / minimum width. Nodes grow to fit a wider type-label or wider body. */
export const NODE_MIN_WIDTH = 220
const NODE_MAX_WIDTH = 360
const HEADER_HEIGHT = 48
const BODY_TOP_PAD = 10
const BODY_BOTTOM_PAD = 10
const PORT_ROW_HEIGHT = 22
const PORT_RADIUS = 7

/** Backwards compat: legacy NODE_WIDTH alias used by older callers. */
export const NODE_WIDTH = NODE_MIN_WIDTH

export interface PortDragHandle {
  onPortPointerDown?: (nodeId: string, portId: string, e: React.PointerEvent) => void
  onPortPointerEnter?: (nodeId: string, portId: string) => void
  onPortPointerLeave?: (nodeId: string, portId: string) => void
  onPortPointerUp?: (nodeId: string, portId: string) => void
}

export interface PatchNodeProps extends PortDragHandle {
  node: GraphNode
  selected?: boolean
  active?: boolean
  /** Per-node validation status. */
  validation?: "ok" | "warning" | "error"
  /** Tooltip text for the validation badge. */
  validationMessage?: string
  /** Solo (instrument nodes only) — header badge. */
  solo?: boolean
  /** Mute (instrument nodes only) — header badge. */
  muted?: boolean
  connected?: Record<string, boolean>
  highlighted?: Record<string, boolean>
  /** Port ids that are "wirelessly" represented by a composite promoted port. */
  promotedPorts?: Record<string, boolean>
  onSelect?: () => void
  onBodyPointerDown?: (e: React.PointerEvent) => void
  onOpenMenu?: (anchor: { x: number; y: number }) => void
  onToggleSolo?: () => void
  onToggleMute?: () => void
}

/**
 * A single graph node — header (drag handle, category · type, optional plugin
 * chip, name) + 3-column body (input port labels | inline body widget |
 * output port labels). Port circles overlap the border. Variable height so
 * a node with N ports doesn't truncate them.
 */
export function PatchNode({
  node,
  selected,
  active,
  validation,
  validationMessage,
  solo,
  muted,
  connected,
  highlighted,
  promotedPorts,
  onSelect,
  onBodyPointerDown,
  onOpenMenu,
  onToggleSolo,
  onToggleMute,
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

  // Header text: for instrument plugins, prefer the plugin URI/name as the
  // type label (and drop the redundant plugin chip). For everything else,
  // use the catalog label.
  const typeLabel = headerTypeLabel(node)

  // Variable body height: tall enough to fit ALL port rows.
  const maxPortCount = Math.max(inputs.length, outputs.length)
  const portsBlockHeight = maxPortCount * PORT_ROW_HEIGHT
  const widgetBlockHeight = minBodyHeightForKind(node.kind)
  const bodyContentHeight = Math.max(portsBlockHeight, widgetBlockHeight)
  const isInstrument = cls === "instrument"

  // Variable width: scale to fit longest label among the type-label, the
  // user name, and the longest port-row left+right combo.
  const width = computeNodeWidth({
    typeLabel,
    name: node.name,
    isInstrument,
    inputs,
    outputs,
  })

  return (
    <div
      style={{
        width,
        borderColor: selected ? accent : undefined,
        boxShadow: active
          ? `0 0 0 1px ${accent}, 0 0 16px -2px ${accent}`
          : selected
            ? `0 0 0 2px ${accent}`
            : undefined,
        opacity: muted ? 0.55 : 1,
      }}
      className={cn(
        "relative rounded-md border bg-card text-card-foreground transition-shadow",
        "shadow-md hover:shadow-lg select-none",
      )}
      onContextMenu={(e) => {
        if (!onOpenMenu) return
        e.preventDefault()
        onOpenMenu({ x: e.clientX, y: e.clientY })
      }}
    >
      {/* Header — drag handle. cursor-grab applies here only. */}
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
          <span className="block truncate text-[9px] font-semibold uppercase tracking-wider opacity-70">
            {palette.label} · {typeLabel}
          </span>
          <div className="truncate text-xs font-semibold">{node.name}</div>
        </div>
        {/* Header badges: validation + solo/mute (instruments) */}
        <div className="flex shrink-0 items-center gap-1">
          {validation && validation !== "ok" && (
            <span
              title={validationMessage}
              className={cn(
                "grid size-4 place-items-center rounded-full text-[9px] font-bold",
                validation === "warning"
                  ? "bg-amber-500 text-black"
                  : "bg-destructive text-destructive-foreground",
              )}
            >
              !
            </span>
          )}
          {isInstrument && (
            <>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleSolo?.()
                }}
                title="Solo"
                className={cn(
                  "grid size-5 place-items-center rounded text-[9px] font-bold",
                  solo ? "bg-yellow-400 text-black" : "bg-black/30 text-white/60 hover:text-white",
                )}
              >
                S
              </button>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleMute?.()
                }}
                title="Mute"
                className={cn(
                  "grid size-5 place-items-center rounded text-[9px] font-bold",
                  muted ? "bg-red-500 text-white" : "bg-black/30 text-white/60 hover:text-white",
                )}
              >
                M
              </button>
            </>
          )}
        </div>
      </div>

      {/* Body: 3-column grid [input labels | widget | output labels] */}
      <div
        className="grid items-stretch gap-2 px-3"
        style={{
          gridTemplateColumns: "auto 1fr auto",
          paddingTop: BODY_TOP_PAD,
          paddingBottom: BODY_BOTTOM_PAD,
          minHeight: bodyContentHeight + BODY_TOP_PAD + BODY_BOTTOM_PAD,
        }}
      >
        {/* Input port labels (left column) */}
        <div className="flex flex-col justify-start gap-0" style={{ paddingTop: 0 }}>
          {inputs.map((p) => (
            <span
              key={p.id}
              className={cn(
                "flex items-center text-[10px] leading-none text-muted-foreground",
                highlighted?.[p.id] && "text-foreground font-medium",
              )}
              style={{ height: PORT_ROW_HEIGHT }}
            >
              {p.label}
            </span>
          ))}
        </div>

        {/* Inline body widget — centered */}
        <div className="flex min-w-0 items-center justify-center">
          <NodeBody node={node} />
        </div>

        {/* Output port labels (right column) */}
        <div className="flex flex-col items-end justify-start gap-0">
          {outputs.map((p) => {
            const subtitle = portSubtitle(p, outputs.length)
            const zoneHue = p.config?.kind === "zone" ? p.config.colorHue : undefined
            const subtitleColor =
              typeof zoneHue === "number" ? `oklch(0.75 0.18 ${zoneHue})` : undefined
            return (
              <div
                key={p.id}
                className={cn(
                  "flex flex-col items-end justify-center text-[10px] leading-tight text-muted-foreground",
                  highlighted?.[p.id] && "text-foreground font-medium",
                )}
                style={{ height: PORT_ROW_HEIGHT }}
              >
                <span>{p.label}</span>
                {subtitle && (
                  <span
                    className="font-mono text-[9px] opacity-90"
                    style={{ color: subtitleColor }}
                  >
                    {subtitle}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Port circles — absolutely positioned ON the node border */}
      {inputs.map((port, i) => (
        <PortCircle
          key={port.id}
          port={port}
          side="left"
          top={portYForIndex(i)}
          width={width}
          highlighted={highlighted?.[port.id]}
          connected={connected?.[port.id]}
          promoted={promotedPorts?.[port.id]}
          onPointerDown={(e) => onPortPointerDown?.(node.id, port.id, e)}
          onPointerEnter={() => onPortPointerEnter?.(node.id, port.id)}
          onPointerLeave={() => onPortPointerLeave?.(node.id, port.id)}
          onPointerUp={() => onPortPointerUp?.(node.id, port.id)}
        />
      ))}
      {outputs.map((port, i) => (
        <PortCircle
          key={port.id}
          port={port}
          side="right"
          top={portYForIndex(i)}
          width={width}
          highlighted={highlighted?.[port.id]}
          connected={connected?.[port.id]}
          promoted={promotedPorts?.[port.id]}
          onPointerDown={(e) => onPortPointerDown?.(node.id, port.id, e)}
          onPointerEnter={() => onPortPointerEnter?.(node.id, port.id)}
          onPointerLeave={() => onPortPointerLeave?.(node.id, port.id)}
          onPointerUp={() => onPortPointerUp?.(node.id, port.id)}
        />
      ))}
    </div>
  )
}

function headerTypeLabel(node: GraphNode): string {
  if (node.kind === "instrument.plugin") {
    const choice = getPluginChoice(node)
    if (choice?.pluginName) return choice.pluginName
  }
  return typeLabelFor(node.kind)
}

// Estimate width based on character counts at the rendered font sizes.
// The Tailwind text-[9px] header type, text-xs name, text-[10px] port labels.
function computeNodeWidth({
  typeLabel,
  name,
  isInstrument,
  inputs,
  outputs,
}: {
  typeLabel: string
  name: string
  isInstrument: boolean
  inputs: Port[]
  outputs: Port[]
}): number {
  // Approximate em widths (px-per-char) for each text size:
  const TYPE_PX = 5.6 // uppercase 9px tracking-wider
  const NAME_PX = 7.0 // 12px semibold
  const PORT_PX = 5.6 // 10px

  const headerBadgesWidth = isInstrument ? 60 : 24
  const headerTextWidth =
    Math.max(typeLabel.length * TYPE_PX, name.length * NAME_PX) +
    headerBadgesWidth +
    32 /* padding + chevron room */

  // Worst port row: longest input label + longest output label + body widget min.
  const longestIn = inputs.reduce((m, p) => Math.max(m, p.label.length), 0)
  const longestOut = outputs.reduce((m, p) => Math.max(m, p.label.length), 0)
  const bodyMinPx = 90 // body widget breathing room
  const portRowWidth = longestIn * PORT_PX + longestOut * PORT_PX + bodyMinPx + 32 /* gaps */

  const candidate = Math.max(headerTextWidth, portRowWidth, NODE_MIN_WIDTH)
  return Math.min(NODE_MAX_WIDTH, Math.ceil(candidate))
}

function portYForIndex(i: number): number {
  return HEADER_HEIGHT + BODY_TOP_PAD + i * PORT_ROW_HEIGHT + PORT_RADIUS + 2
}

function PortCircle({
  port,
  side,
  top,
  width,
  connected,
  highlighted,
  promoted,
  onPointerDown,
  onPointerEnter,
  onPointerLeave,
  onPointerUp,
}: {
  port: Port
  side: "left" | "right"
  top: number
  width: number
  connected?: boolean
  highlighted?: boolean
  promoted?: boolean
  onPointerDown: (e: React.PointerEvent) => void
  onPointerEnter: () => void
  onPointerLeave: () => void
  onPointerUp: () => void
}) {
  const color =
    port.config?.kind === "zone" && typeof port.config.colorHue === "number"
      ? `oklch(0.7 0.18 ${port.config.colorHue})`
      : SIGNAL_DEFAULT_COLORS[port.signal]
  const cursor = promoted
    ? "cursor-not-allowed"
    : side === "right"
      ? "cursor-crosshair"
      : connected
        ? "cursor-pointer"
        : "cursor-default"
  const promotedTitle = promoted ? `${port.label} — routed via composite outer port` : null
  return (
    <button
      type="button"
      disabled={promoted}
      className={cn(
        "absolute z-10 size-3.5 rounded-full border-2 border-card transition-transform",
        highlighted && "scale-150 ring-2 ring-primary/50",
        promoted && "opacity-50",
        cursor,
      )}
      style={{
        left: side === "left" ? 0 : width,
        top,
        transform: "translate(-50%, -50%)",
        background: promoted ? "transparent" : color,
        borderColor: promoted ? color : undefined,
        borderStyle: promoted ? "dashed" : undefined,
      }}
      title={
        promotedTitle
          ? promotedTitle
          : side === "right"
            ? `${port.label} — drag to connect`
            : connected
              ? `${port.label} — click to disconnect`
              : port.label
      }
      onPointerDown={(e) => {
        if (e.button !== 0) return
        e.stopPropagation()
        if (promoted) return
        onPointerDown(e)
      }}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onPointerUp={onPointerUp}
    />
  )
}

// =============================================================================
// Geometry helpers used by the canvas to draw wires + measure node bounds.
// =============================================================================

export function nodeWidth(node: GraphNode): number {
  return computeNodeWidth({
    typeLabel: headerTypeLabel(node),
    name: node.name,
    isInstrument: classOf(node.kind) === "instrument",
    inputs: node.ports.filter((p) => p.direction === "in"),
    outputs: node.ports.filter((p) => p.direction === "out"),
  })
}

export function portOffset(node: GraphNode, portId: string): { x: number; y: number } | null {
  const port = node.ports.find((p) => p.id === portId)
  if (!port) return null
  const sideList = node.ports.filter((p) => p.direction === port.direction)
  const indexInSide = sideList.findIndex((p) => p.id === portId)
  if (indexInSide < 0) return null
  return {
    x: port.direction === "in" ? 0 : nodeWidth(node),
    y: portYForIndex(indexInSide),
  }
}

export function absolutePortPosition(
  node: GraphNode,
  portId: string,
): { x: number; y: number } | null {
  const offset = portOffset(node, portId)
  if (!offset) return null
  return { x: node.x + offset.x, y: node.y + offset.y }
}

export function nodeBounds(node: GraphNode): {
  x: number
  y: number
  width: number
  height: number
} {
  const maxPorts = Math.max(
    node.ports.filter((p) => p.direction === "in").length,
    node.ports.filter((p) => p.direction === "out").length,
  )
  const portsHeight = maxPorts * PORT_ROW_HEIGHT
  const widgetHeight = minBodyHeightForKind(node.kind)
  const bodyHeight = Math.max(portsHeight, widgetHeight) + BODY_TOP_PAD + BODY_BOTTOM_PAD
  return {
    x: node.x,
    y: node.y,
    width: nodeWidth(node),
    height: HEADER_HEIGHT + bodyHeight,
  }
}

/**
 * Optional second line under a port label. For zone outputs, returns the
 * note range (e.g. "C2–B3"). Hidden when the keyboard has a single zone
 * that covers the full playable range — in that case the range is
 * implicit and showing it just clutters the node.
 */
function portSubtitle(p: Port, totalSiblings: number): string | undefined {
  if (p.config?.kind === "zone") {
    const fullKeyboard = p.config.fromNote <= 21 && p.config.toNote >= 108
    if (totalSiblings === 1 && fullKeyboard) return undefined
    return `${noteName(p.config.fromNote)}–${noteName(p.config.toNote)}`
  }
  return undefined
}

function noteName(midi: number): string {
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
  return `${names[midi % 12]}${Math.floor(midi / 12) - 1}`
}

function minBodyHeightForKind(kind: GraphNode["kind"]): number {
  switch (kind) {
    case "source.keyboard":
    case "source.pads":
      return 40
    case "instrument.plugin":
    case "instrument.testtone":
      return 72
    case "audio.eq":
      return 64
    case "sink.main-out":
      return 56
    case "midi.transpose":
      return 50
    default:
      return 48
  }
}
