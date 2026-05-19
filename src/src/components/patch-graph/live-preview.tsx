import * as React from "react"
import { CircleDot, Eye, Footprints, Move3D, MoveVertical, Sliders } from "lucide-react"
import { Keyboard, type KeyboardZone } from "@/components/rig/keyboard"
import { cn } from "@/lib/utils"
import { classOf, CLASS_COLORS, type CompositeBlock, type GraphNode, type PatchGraph } from "./_types"

export interface LivePreviewProps {
  graph: PatchGraph
  patchName: string
  onResizeZone?: (
    nodeId: string,
    portId: string,
    range: { fromNote: number; toNote: number }
  ) => void
}

/**
 * Live performance preview. Renders performance-scale widgets for every
 * source node in the patch (not just keyboards) so adding pads or other
 * controllers shows up immediately. Zone colours/labels follow the wire
 * chain DOWNSTREAM through MIDI processors to the eventual instrument.
 */
export function LivePreview({
  graph,
  patchName,
  onResizeZone,
}: LivePreviewProps) {
  const sources = graph.nodes.filter((n) => classOf(n.kind) === "source")
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = React.useState(800)

  React.useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width)
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  const keyboards = sources.filter((n) => n.kind === "source.keyboard")
  const others = sources.filter((n) => n.kind !== "source.keyboard")

  return (
    <div ref={containerRef} className="flex h-full flex-col gap-4 p-1">
      <div className="text-center">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Now playing
        </div>
        <div className="text-base font-semibold">{patchName}</div>
      </div>

      {sources.length === 0 ? (
        <div className="grid flex-1 place-items-center text-center text-xs text-muted-foreground">
          <div className="max-w-xs">
            <Eye className="mx-auto mb-2 size-6 opacity-40" />
            Add any source (keyboard, pads, pedal, knob…) to preview here.
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {keyboards.map((kb) => (
            <KeyboardPreview
              key={kb.id}
              graph={graph}
              keyboard={kb}
              containerWidth={containerWidth}
              onResizeZone={onResizeZone}
            />
          ))}

          {others.length > 0 && (
            <div className="rounded-md border bg-card/40 p-3">
              <div className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Other controllers
              </div>
              <div className="flex flex-wrap items-end gap-4">
                {others.map((n) => (
                  <ControllerTile key={n.id} graph={graph} node={n} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function KeyboardPreview({
  graph,
  keyboard,
  containerWidth,
  onResizeZone,
}: {
  graph: PatchGraph
  keyboard: GraphNode
  containerWidth: number
  onResizeZone?: LivePreviewProps["onResizeZone"]
}) {
  const fromNote = 21
  const toNote = 108
  const whiteKeyCount = countWhiteKeysInRange(fromNote, toNote)
  const whiteKeyWidth = Math.max(8, Math.floor((containerWidth - 60) / whiteKeyCount))

  const zones = React.useMemo<KeyboardZone[]>(() => {
    const zonePorts = keyboard.ports.filter(
      (p) => p.direction === "out" && p.config?.kind === "zone"
    )
    if (zonePorts.length === 0) {
      const single = keyboard.ports.find((p) => p.direction === "out")
      if (!single) return []
      const r = findDownstreamTarget(graph, keyboard.id, single.id)
      return [
        {
          id: single.id,
          label: r?.displayName ?? "Unwired",
          fromNote,
          toNote,
          color: zoneColor(r),
        },
      ]
    }
    return zonePorts.map((p) => {
      const cfg = p.config as {
        kind: "zone"
        fromNote: number
        toNote: number
        colorHue?: number
      }
      const r = findDownstreamTarget(graph, keyboard.id, p.id)
      // Zone's own colour wins over the downstream target's. The user
      // picked it on purpose; we respect it.
      const color =
        typeof cfg.colorHue === "number"
          ? `oklch(0.7 0.18 ${cfg.colorHue})`
          : zoneColor(r)
      return {
        id: p.id,
        label: r?.displayName ?? p.label,
        fromNote: cfg.fromNote,
        toNote: cfg.toNote,
        color,
      }
    })
  }, [graph, keyboard])

  return (
    <div className="rounded-md border bg-card/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold">{keyboard.name}</span>
        <span className="text-[10px] text-muted-foreground">
          {zones.length} zone{zones.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="flex w-full justify-center overflow-x-auto">
        <Keyboard
          fromNote={fromNote}
          toNote={toNote}
          whiteKeyWidth={whiteKeyWidth}
          zones={zones}
          onZoneChange={(zoneId, range) =>
            onResizeZone?.(keyboard.id, zoneId, range)
          }
          labelOctaves
        />
      </div>
    </div>
  )
}

function ControllerTile({ graph, node }: { graph: PatchGraph; node: GraphNode }) {
  const Icon = iconForKind(node.kind)
  // Where does this controller route to? (for label colour cue)
  const out = node.ports.find((p) => p.direction === "out")
  const target = out ? findDownstreamTarget(graph, node.id, out.id) : null
  return (
    <div
      className={cn(
        "flex w-24 flex-col items-center gap-2 rounded-md border bg-card px-3 py-3",
        target ? "border-primary/30" : "border-dashed"
      )}
    >
      <Icon className="size-6 text-muted-foreground" />
      <div className="text-center text-[10px]">
        <div className="font-semibold">{node.name}</div>
        <div className="text-muted-foreground">
          {target ? `→ ${target.displayName}` : "Unwired"}
        </div>
      </div>
    </div>
  )
}

function iconForKind(kind: GraphNode["kind"]): React.ComponentType<{ className?: string }> {
  switch (kind) {
    case "source.pads":
      return CircleDot
    case "source.switch":
    case "source.sustain-pedal":
      return Footprints
    case "source.expression-pedal":
      return Move3D
    case "source.pitch-wheel":
    case "source.mod-wheel":
      return MoveVertical
    case "source.knob":
      return CircleDot
    case "source.fader":
      return Sliders
    default:
      return CircleDot
  }
}

// =============================================================================
// Downstream-route resolution
// =============================================================================

/**
 * Result of walking downstream from a source port.
 *
 * - `instrument` is the actual sound source the route reaches (used as a
 *   fallback color cue and for technical correctness).
 * - `enteringComposite` is the FIRST composite block the route enters, if
 *   any. When set, the user is conceptually playing "into this block" —
 *   a composite the user named themselves — so the preview should show
 *   the composite's name instead of the contained instrument's.
 * - `displayName` is what the preview should show. Composite name wins
 *   over instrument name when a composite is on the route, because the
 *   user named that block for a reason.
 */
interface DownstreamTarget {
  instrument: GraphNode
  enteringComposite?: CompositeBlock
  displayName: string
}

function findDownstreamTarget(
  graph: PatchGraph,
  fromNode: string,
  fromPort: string
): DownstreamTarget | null {
  const visited = new Set<string>()
  type Q = {
    nodeId: string
    portId: string
    /** First composite seen on this path, if any. */
    enteringComposite?: CompositeBlock
  }
  const queue: Q[] = [{ nodeId: fromNode, portId: fromPort }]

  while (queue.length > 0) {
    const cur = queue.shift()!
    const key = `${cur.nodeId}:${cur.portId}`
    if (visited.has(key)) continue
    visited.add(key)

    const outgoing = graph.wires.filter(
      (w) => w.fromNode === cur.nodeId && w.fromPort === cur.portId
    )
    for (const w of outgoing) {
      const r = visitTarget(graph, w.toNode, w.toPort, cur.enteringComposite)
      if (!r) continue
      if (r.instrument) {
        const enteringComposite = r.enteringComposite
        return {
          instrument: r.instrument,
          enteringComposite,
          displayName: enteringComposite ? enteringComposite.name : r.instrument.name,
        }
      }
      for (const next of r.continueFrom) {
        queue.push({
          nodeId: next.nodeId,
          portId: next.portId,
          enteringComposite: r.enteringComposite,
        })
      }
    }
  }
  return null
}

/**
 * Resolve a wire endpoint to either an instrument hit or a list of next
 * ports to keep searching from. Composite promoted ports are aliased
 * transparently to the internal node port they map to (technical
 * correctness) but the *first* composite the route enters is remembered
 * so the preview can show the user-named block instead of the internal
 * instrument.
 */
function visitTarget(
  graph: PatchGraph,
  ownerId: string,
  portId: string,
  enteringComposite: CompositeBlock | undefined
): {
  instrument?: GraphNode
  enteringComposite?: CompositeBlock
  continueFrom: Array<{ nodeId: string; portId: string }>
} | null {
  const node = graph.nodes.find((n) => n.id === ownerId)
  if (node) {
    if (classOf(node.kind) === "instrument")
      return { instrument: node, enteringComposite, continueFrom: [] }
    return {
      enteringComposite,
      continueFrom: node.ports
        .filter((p) => p.direction === "out")
        .map((p) => ({ nodeId: node.id, portId: p.id })),
    }
  }
  const composite = graph.composites.find((c) => c.id === ownerId)
  if (!composite) return null
  const promoted = composite.promotedPorts.find((p) => p.id === portId)
  if (!promoted) return null
  // Record this composite as the entering one if we haven't seen one yet.
  const nextEntering = enteringComposite ?? composite
  return visitTarget(graph, promoted.internalNode, promoted.internalPort, nextEntering)
}

/** Zone-label color cue based on the route's target. */
function zoneColor(r: DownstreamTarget | null): string {
  if (!r) return "oklch(0.4 0.02 0)"
  if (r.enteringComposite?.colorHue !== undefined) {
    return `oklch(0.65 0.20 ${r.enteringComposite.colorHue})`
  }
  return `oklch(0.65 0.20 ${CLASS_COLORS.instrument.hue})`
}

function countWhiteKeysInRange(fromNote: number, toNote: number): number {
  const whitePCs = new Set([0, 2, 4, 5, 7, 9, 11])
  let count = 0
  for (let n = fromNote; n <= toNote; n++) {
    if (whitePCs.has(n % 12)) count++
  }
  return count
}
