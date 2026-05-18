import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Piano keyboard with:
 *   - Standardised key width (not stretched to container) so a 49-key
 *     Launchkey appears physically narrower than an 88-key RD-2000.
 *   - Real visual depth (gradient white keys, black-key shadow, octave
 *     boundary cues).
 *   - Interactive zone overlay above the keys — drag edges to resize,
 *     drag middle to translate. Edge handles are visible grip-dots.
 *     Overlapping zones stagger vertically so neither clips the other.
 *   - Optional pitch + mod wheels to the left of the keys (where they
 *     physically sit on most controllers).
 */

export type KeyboardNote = {
  /** MIDI note number, 21 (A0)..108 (C8) */
  note: number
  /** 0..127 */
  velocity: number
  /** Which zone this note belongs to (for colour cue) */
  zoneId?: string
}

export type KeyboardZone = {
  id: string
  /** Display label shown in the zone bar */
  label: string
  /** Lowest MIDI note */
  fromNote: number
  /** Highest MIDI note */
  toNote: number
  /** Custom colour CSS value; default = chart palette */
  color?: string
}

export interface KeyboardProps {
  active?: KeyboardNote[]
  zones?: KeyboardZone[]
  onZoneChange?: (zoneId: string, range: { fromNote: number; toNote: number }) => void
  onZoneSelect?: (zoneId: string) => void
  selectedZoneId?: string
  fromNote?: number
  toNote?: number
  labelOctaves?: boolean
  readOnly?: boolean
  /** Width per white key in pixels. Default 16. Smaller for ultra-compact. */
  whiteKeyWidth?: number
  /** Show pitch + mod wheels to the left of the keys */
  showWheels?: boolean
  /** Pitch wheel current value (-1..1). Defaults to 0. */
  pitchValue?: number
  /** Mod wheel current value (0..1). Defaults to 0. */
  modValue?: number
  /** Configured bend range in semitones (e.g. 2 for ±2). Display-only. */
  bendRangeSemitones?: number
  className?: string
}

const BLACK_NOTES_IN_OCTAVE = [1, 3, 6, 8, 10]
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const

function isBlack(midi: number) {
  return BLACK_NOTES_IN_OCTAVE.includes(midi % 12)
}
function octaveOf(midi: number) {
  return Math.floor(midi / 12) - 1
}
export function noteName(midi: number) {
  return `${NOTE_NAMES[midi % 12]}${octaveOf(midi)}`
}

const CHART_COLOURS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]
function zoneColour(zone: KeyboardZone, index: number) {
  return zone.color ?? CHART_COLOURS[index % CHART_COLOURS.length]
}

/**
 * Assign each zone a vertical row in the zone bar so overlapping zones
 * don't clip each other. Greedy interval-stacking.
 */
function stackZones(zones: KeyboardZone[]): Map<string, number> {
  const sorted = [...zones].sort((a, b) => a.fromNote - b.fromNote)
  const lanes: { lastTo: number }[] = []
  const rowFor = new Map<string, number>()
  for (const z of sorted) {
    let placed = false
    for (let i = 0; i < lanes.length; i++) {
      if (lanes[i].lastTo < z.fromNote) {
        lanes[i].lastTo = z.toNote
        rowFor.set(z.id, i)
        placed = true
        break
      }
    }
    if (!placed) {
      lanes.push({ lastTo: z.toNote })
      rowFor.set(z.id, lanes.length - 1)
    }
  }
  return rowFor
}

export function Keyboard({
  active = [],
  zones,
  onZoneChange,
  onZoneSelect,
  selectedZoneId,
  fromNote = 21,
  toNote = 108,
  labelOctaves = true,
  readOnly = false,
  whiteKeyWidth = 16,
  showWheels = false,
  pitchValue = 0,
  modValue = 0,
  bendRangeSemitones = 2,
  className,
}: KeyboardProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null)

  const whiteKeys = React.useMemo(() => {
    const out: number[] = []
    for (let n = fromNote; n <= toNote; n++) {
      if (!isBlack(n)) out.push(n)
    }
    return out
  }, [fromNote, toNote])

  const activeByNote = React.useMemo(() => {
    const m = new Map<number, KeyboardNote>()
    for (const e of active) m.set(e.note, e)
    return m
  }, [active])

  const zoneById = React.useMemo(() => {
    const m = new Map<string, { zone: KeyboardZone; color: string }>()
    zones?.forEach((z, i) => m.set(z.id, { zone: z, color: zoneColour(z, i) }))
    return m
  }, [zones])

  const zoneRows = React.useMemo(() => stackZones(zones ?? []), [zones])
  const laneCount = React.useMemo(() => {
    let max = 0
    for (const row of zoneRows.values()) max = Math.max(max, row + 1)
    return Math.max(1, max)
  }, [zoneRows])
  const zoneBarHeight = laneCount * 24 + (laneCount - 1) * 2 // 24px per row, 2px gap

  // Pixel widths
  const keysWidth = whiteKeys.length * whiteKeyWidth
  const wheelsWidth = showWheels ? 44 : 0

  // Convert pointer x → MIDI note. Anchored to the keys container.
  const xToMidi = React.useCallback(
    (clientX: number): number => {
      const el = containerRef.current
      if (!el || whiteKeys.length === 0) return fromNote
      const rect = el.getBoundingClientRect()
      const relX = clientX - rect.left
      const whiteIndex = Math.max(
        0,
        Math.min(whiteKeys.length - 1, Math.floor(relX / whiteKeyWidth)),
      )
      return whiteKeys[whiteIndex]
    },
    [whiteKeys, fromNote, whiteKeyWidth],
  )

  return (
    <div
      className={cn(
        "relative isolate inline-block select-none rounded-xl border border-border-strong bg-card-raised p-3 shadow-inner",
        className,
      )}
      role="img"
      aria-label="Keyboard"
    >
      <div className="flex items-stretch gap-2">
        {/* Wheels column (if enabled) */}
        {showWheels && (
          <WheelsColumn
            pitchValue={pitchValue}
            modValue={modValue}
            bendRangeSemitones={bendRangeSemitones}
            heightOffset={zoneBarHeight + 8}
          />
        )}

        {/* Keys + zone bar */}
        <div style={{ width: keysWidth }}>
          {zones && zones.length > 0 && (
            <ZoneBar
              zones={zones}
              zoneRows={zoneRows}
              laneCount={laneCount}
              whiteKeyWidth={whiteKeyWidth}
              whiteKeys={whiteKeys}
              selectedZoneId={selectedZoneId}
              readOnly={readOnly}
              onZoneSelect={onZoneSelect}
              onZoneChange={onZoneChange}
              xToMidi={xToMidi}
            />
          )}

          {/* Keyboard body */}
          <div ref={containerRef} className="relative" style={{ width: keysWidth }}>
            {/* White keys */}
            <div className="relative flex h-28 items-end">
              {whiteKeys.map((midi) => {
                const noteEvent = activeByNote.get(midi)
                const isActive = !!noteEvent
                const zoneColor = noteEvent?.zoneId ? zoneById.get(noteEvent.zoneId)?.color : null
                const accent = zoneColor ?? "var(--primary)"
                const isCStart = midi % 12 === 0
                const inAnyZone = zones?.some((z) => midi >= z.fromNote && midi <= z.toNote)
                return (
                  <div
                    key={midi}
                    data-note={midi}
                    data-active={isActive || undefined}
                    className="relative flex h-full shrink-0 flex-col items-center justify-end rounded-b-md border-l border-r border-b border-neutral-300 text-[10px] font-medium text-neutral-600 transition-colors first:rounded-bl-lg last:rounded-br-lg"
                    style={{
                      width: whiteKeyWidth,
                      background: isActive
                        ? `linear-gradient(180deg, color-mix(in oklch, ${accent} 35%, white) 0%, ${accent} 100%)`
                        : "linear-gradient(180deg, #fbfbf8 0%, #ebebe6 92%, #d8d8d2 100%)",
                      boxShadow: isActive
                        ? `inset 0 0 12px color-mix(in oklch, ${accent} 60%, transparent), 0 -1px 0 0 ${accent} inset`
                        : "inset 0 -3px 4px -2px rgba(0,0,0,0.18)",
                      color: isActive ? "white" : undefined,
                      borderLeftColor: isCStart ? "rgba(0,0,0,0.18)" : undefined,
                      borderLeftWidth: isCStart ? 2 : 1,
                      opacity: zones && zones.length > 0 ? (inAnyZone ? 1 : 0.55) : 1,
                    }}
                  >
                    {labelOctaves && isCStart && (
                      <span className="pb-1 font-mono">C{octaveOf(midi)}</span>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Black-key overlay */}
            <div className="pointer-events-none absolute inset-x-0 top-0">
              <div className="relative flex">
                {whiteKeys.slice(0, -1).map((midi, i) => {
                  const blackMidi = midi + 1
                  if (!isBlack(blackMidi)) return (
                    <div key={i} className="shrink-0" style={{ width: whiteKeyWidth }} />
                  )
                  const noteEvent = activeByNote.get(blackMidi)
                  const isActive = !!noteEvent
                  const zoneColor = noteEvent?.zoneId
                    ? zoneById.get(noteEvent.zoneId)?.color
                    : null
                  const accent = zoneColor ?? "var(--primary)"
                  return (
                    <div
                      key={i}
                      className="relative shrink-0"
                      style={{ width: whiteKeyWidth }}
                    >
                      <div
                        data-note={blackMidi}
                        data-active={isActive || undefined}
                        className="absolute -right-[18%] top-0 z-10 h-16 w-[36%] rounded-b-md transition-colors"
                        style={{
                          background: isActive
                            ? `linear-gradient(180deg, color-mix(in oklch, ${accent} 60%, black) 0%, ${accent} 100%)`
                            : "linear-gradient(180deg, #2a2a2a 0%, #0c0c0c 75%, #1a1a1a 100%)",
                          boxShadow: isActive
                            ? `0 4px 8px color-mix(in oklch, ${accent} 40%, transparent), inset 0 -2px 0 ${accent}`
                            : "0 3px 6px rgba(0,0,0,0.5), inset 0 -3px 0 #050505",
                          border: isActive ? `1px solid ${accent}` : "1px solid #000",
                        }}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// Pitch + mod wheel column (left of the keys, mirroring physical layout)
// =============================================================================

function WheelsColumn({
  pitchValue,
  modValue,
  bendRangeSemitones,
  heightOffset,
}: {
  pitchValue: number
  modValue: number
  bendRangeSemitones: number
  heightOffset: number
}) {
  // pitchValue: -1..1 (visual offset). modValue: 0..1.
  const pitchPct = ((pitchValue + 1) / 2) * 100
  const modPct = modValue * 100
  return (
    <div
      className="flex shrink-0 flex-col items-stretch gap-1.5 self-end"
      style={{ height: 112 + heightOffset }}
      title={`Bend range ±${bendRangeSemitones} st`}
    >
      <div className="flex flex-1 items-end gap-1.5" style={{ height: 112 }}>
        <Wheel label="P" value={pitchPct} centered />
        <Wheel label="M" value={modPct} />
      </div>
    </div>
  )
}

function Wheel({
  label,
  value,
  centered,
}: {
  label: string
  value: number
  centered?: boolean
}) {
  return (
    <div className="flex h-full w-4 flex-col items-center justify-end">
      <div className="relative h-full w-full overflow-hidden rounded-sm border border-border bg-muted">
        <div
          className="absolute left-0 right-0"
          style={{
            background: "var(--primary)",
            ...(centered
              ? {
                  top: "50%",
                  height: `${Math.abs(value - 50)}%`,
                  transform: value < 50 ? "translateY(0)" : `translateY(-${value - 50}%)`,
                }
              : {
                  bottom: 0,
                  height: `${value}%`,
                }),
          }}
        />
        {centered && (
          <span
            aria-hidden
            className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-border-strong"
          />
        )}
      </div>
      <span className="mt-1 font-mono text-[9px] text-muted-foreground">{label}</span>
    </div>
  )
}

// =============================================================================
// Zone bar above keys — draggable, multi-lane to handle overlaps
// =============================================================================

interface ZoneBarProps {
  zones: KeyboardZone[]
  zoneRows: Map<string, number>
  laneCount: number
  whiteKeyWidth: number
  whiteKeys: number[]
  selectedZoneId?: string
  readOnly: boolean
  onZoneSelect?: (id: string) => void
  onZoneChange?: (id: string, range: { fromNote: number; toNote: number }) => void
  xToMidi: (clientX: number) => number
}

const LANE_HEIGHT = 24
const LANE_GAP = 2

function ZoneBar({
  zones,
  zoneRows,
  laneCount,
  whiteKeyWidth,
  whiteKeys,
  selectedZoneId,
  readOnly,
  onZoneSelect,
  onZoneChange,
  xToMidi,
}: ZoneBarProps) {
  const [dragState, setDragState] = React.useState<{
    zoneId: string
    mode: "left" | "right" | "move"
    startRange: { fromNote: number; toNote: number }
    startMidi: number
  } | null>(null)

  React.useEffect(() => {
    if (!dragState) return

    const onMove = (e: PointerEvent) => {
      const midi = xToMidi(e.clientX)
      const delta = midi - dragState.startMidi
      const { startRange, mode } = dragState
      let next = { ...startRange }
      if (mode === "left") {
        next.fromNote = clamp(startRange.fromNote + delta, 21, startRange.toNote - 1)
      } else if (mode === "right") {
        next.toNote = clamp(startRange.toNote + delta, startRange.fromNote + 1, 108)
      } else {
        const width = startRange.toNote - startRange.fromNote
        let from = startRange.fromNote + delta
        let to = from + width
        if (from < 21) {
          from = 21
          to = from + width
        }
        if (to > 108) {
          to = 108
          from = to - width
        }
        next = { fromNote: from, toNote: to }
      }
      onZoneChange?.(dragState.zoneId, next)
    }
    const onUp = () => setDragState(null)
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    return () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
    }
  }, [dragState, xToMidi, onZoneChange])

  function startDrag(e: React.PointerEvent, zone: KeyboardZone, mode: "left" | "right" | "move") {
    if (readOnly) return
    e.preventDefault()
    e.stopPropagation()
    setDragState({
      zoneId: zone.id,
      mode,
      startRange: { fromNote: zone.fromNote, toNote: zone.toNote },
      startMidi: xToMidi(e.clientX),
    })
    onZoneSelect?.(zone.id)
  }

  // Convert MIDI note → pixel position based on the white-key it anchors to.
  function midiPx(midi: number, side: "left" | "right"): number {
    let whiteIndex = 0
    for (let i = 0; i < whiteKeys.length; i++) {
      if (whiteKeys[i] >= midi) {
        whiteIndex = i
        break
      }
      whiteIndex = i + 1
    }
    return side === "left"
      ? whiteIndex * whiteKeyWidth
      : (whiteIndex + 1) * whiteKeyWidth
  }

  const totalHeight = laneCount * LANE_HEIGHT + (laneCount - 1) * LANE_GAP

  return (
    <div className="relative mb-2" style={{ height: totalHeight }}>
      {zones.map((z, i) => {
        const color = zoneColour(z, i)
        const left = midiPx(z.fromNote, "left")
        const width = midiPx(z.toNote, "right") - left
        const row = zoneRows.get(z.id) ?? 0
        const top = row * (LANE_HEIGHT + LANE_GAP)
        const isSelected = z.id === selectedZoneId
        return (
          <div
            key={z.id}
            onPointerDown={(e) => startDrag(e, z, "move")}
            onClick={() => onZoneSelect?.(z.id)}
            className={cn(
              "group absolute flex items-center justify-between rounded-md border px-2 text-xs font-semibold text-foreground transition-shadow",
              !readOnly && "cursor-grab active:cursor-grabbing",
              isSelected && "ring-2 ring-offset-1 ring-offset-card-raised",
            )}
            style={{
              left,
              width,
              top,
              height: LANE_HEIGHT,
              background: `color-mix(in oklch, ${color} 30%, transparent)`,
              borderColor: color,
              boxShadow: `inset 0 0 0 1px color-mix(in oklch, ${color} 40%, transparent)`,
              // @ts-expect-error CSS custom property for ring colour
              "--tw-ring-color": color,
            }}
          >
            {!readOnly && (
              <button
                type="button"
                onPointerDown={(e) => startDrag(e, z, "left")}
                onClick={(e) => e.stopPropagation()}
                title="Drag to resize from left edge"
                aria-label="Resize zone from left"
                className="absolute -left-1 top-0 z-10 flex h-full w-2 cursor-ew-resize flex-col items-center justify-center gap-0.5 opacity-60 transition-opacity group-hover:opacity-100"
                aria-hidden
              >
                <span className="block h-px w-1.5" style={{ background: color }} />
                <span className="block h-px w-1.5" style={{ background: color }} />
                <span className="block h-px w-1.5" style={{ background: color }} />
              </button>
            )}

            <span className="pointer-events-none truncate">{z.label}</span>
            <span className="pointer-events-none ml-2 shrink-0 font-mono text-[10px] opacity-70">
              {noteName(z.fromNote)}–{noteName(z.toNote)}
            </span>

            {!readOnly && (
              <button
                type="button"
                onPointerDown={(e) => startDrag(e, z, "right")}
                onClick={(e) => e.stopPropagation()}
                title="Drag to resize from right edge"
                aria-label="Resize zone from right"
                className="absolute -right-1 top-0 z-10 flex h-full w-2 cursor-ew-resize flex-col items-center justify-center gap-0.5 opacity-60 transition-opacity group-hover:opacity-100"
                aria-hidden
              >
                <span className="block h-px w-1.5" style={{ background: color }} />
                <span className="block h-px w-1.5" style={{ background: color }} />
                <span className="block h-px w-1.5" style={{ background: color }} />
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n))
}

// Backwards-compat aliases
export const KeyboardVisualizer = Keyboard
/** @deprecated use KeyboardZone */
export type KeyboardPart = KeyboardZone
