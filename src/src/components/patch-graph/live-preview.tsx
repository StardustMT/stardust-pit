import * as React from "react"
import { Eye } from "lucide-react"
import { Keyboard, type KeyboardZone } from "@/components/rig/keyboard"
import { classOf, CLASS_COLORS, type GraphNode, type PatchGraph } from "./_types"

export interface LivePreviewProps {
  graph: PatchGraph
  patchName: string
  /**
   * Called when the user drags a zone edge to resize it. Receives the
   * keyboard node id, the port id (the zone's source port), and the new
   * note range — caller updates the port config in the graph.
   */
  onResizeZone?: (
    nodeId: string,
    portId: string,
    range: { fromNote: number; toNote: number }
  ) => void
}

/**
 * Live preview surface — renders the patch's performance widgets
 * (currently: keyboards with colored zones) at performance scale. Each
 * zone is colored + labelled by following the wire chain DOWNSTREAM from
 * the zone's output port until an instrument node is found (transparently
 * passing through MIDI processors like transpose). If nothing is wired,
 * the zone shows as inactive (gray).
 *
 * Zones are user-resizable here — drag a zone's edge to extend or shrink
 * the range. The graph's source-port config updates via `onResizeZone`.
 */
export function LivePreview({
  graph,
  patchName,
  onResizeZone,
}: LivePreviewProps) {
  const keyboards = graph.nodes.filter((n) => n.kind === "source.keyboard")
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

  return (
    <div ref={containerRef} className="flex h-full flex-col gap-4 p-1">
      <div className="text-center">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Now playing
        </div>
        <div className="text-base font-semibold">{patchName}</div>
      </div>

      {keyboards.length === 0 ? (
        <div className="grid flex-1 place-items-center text-center text-xs text-muted-foreground">
          <div className="max-w-xs">
            <Eye className="mx-auto mb-2 size-6 opacity-40" />
            Add a keyboard source to the patch to preview live zones here.
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {keyboards.map((kb) => (
            <KeyboardPreview
              key={kb.id}
              graph={graph}
              keyboard={kb}
              containerWidth={containerWidth}
              onResizeZone={onResizeZone}
            />
          ))}
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
  // Fit the keyboard to the container width (minus a small margin for the
  // card padding). Minimum white key width = 8px so it stays usable on
  // narrow screens.
  const whiteKeyWidth = Math.max(8, Math.floor((containerWidth - 48) / whiteKeyCount))

  const zones = React.useMemo<KeyboardZone[]>(() => {
    const zonePorts = keyboard.ports.filter(
      (p) => p.direction === "out" && p.config?.kind === "zone"
    )
    // If no explicit zones, synthesize one full-range zone using the wired
    // instrument (so single-out keyboards still show a colored band).
    if (zonePorts.length === 0) {
      const single = keyboard.ports.find((p) => p.direction === "out")
      if (!single) return []
      const instr = findDownstreamInstrument(graph, keyboard.id, single.id)
      return [
        {
          id: single.id,
          label: instr ? instr.name : "Unwired",
          fromNote,
          toNote,
          color: instr
            ? `oklch(0.65 0.20 ${CLASS_COLORS.instrument.hue})`
            : "oklch(0.4 0.02 0)",
        },
      ]
    }
    return zonePorts.map((p) => {
      const cfg = p.config as { kind: "zone"; fromNote: number; toNote: number }
      const instr = findDownstreamInstrument(graph, keyboard.id, p.id)
      return {
        id: p.id,
        label: instr ? instr.name : p.label,
        fromNote: cfg.fromNote,
        toNote: cfg.toNote,
        color: instr
          ? `oklch(0.65 0.20 ${CLASS_COLORS.instrument.hue})`
          : "oklch(0.4 0.02 0)",
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
          onZoneChange={(zoneId, range) => {
            onResizeZone?.(keyboard.id, zoneId, range)
          }}
          labelOctaves
        />
      </div>
    </div>
  )
}

// =============================================================================
// Graph traversal — find the instrument a source port eventually reaches
// =============================================================================

/**
 * BFS from a source output port through the wire graph; return the first
 * instrument node reached. MIDI processors (transpose, mix, etc.) are
 * traversed transparently — the user cares about the eventual sound source.
 */
function findDownstreamInstrument(
  graph: PatchGraph,
  fromNode: string,
  fromPort: string
): GraphNode | null {
  const visited = new Set<string>()
  type Q = { nodeId: string; portId: string }
  const queue: Q[] = [{ nodeId: fromNode, portId: fromPort }]

  while (queue.length > 0) {
    const cur = queue.shift()!
    const key = `${cur.nodeId}:${cur.portId}`
    if (visited.has(key)) continue
    visited.add(key)

    // Wires going FROM this port
    const outgoing = graph.wires.filter(
      (w) => w.fromNode === cur.nodeId && w.fromPort === cur.portId
    )
    for (const w of outgoing) {
      const target = graph.nodes.find((n) => n.id === w.toNode)
      if (!target) continue
      if (classOf(target.kind) === "instrument") return target
      // Otherwise (MIDI processor / mix / router): continue from its outputs
      for (const out of target.ports.filter((p) => p.direction === "out")) {
        queue.push({ nodeId: target.id, portId: out.id })
      }
    }
  }
  return null
}

function countWhiteKeysInRange(fromNote: number, toNote: number): number {
  // 7 white keys per octave; quick walk through the range to be exact at edges.
  const whitePCs = new Set([0, 2, 4, 5, 7, 9, 11])
  let count = 0
  for (let n = fromNote; n <= toNote; n++) {
    if (whitePCs.has(n % 12)) count++
  }
  return count
}
