import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Piano keyboard visualizer with real visual depth (gradient white keys,
 * shadow under black keys, visible octave boundaries) plus optional
 * compound-part "zone bar" overlay that paints each part as a coloured
 * band above the keys it covers.
 */

export type KeyboardNote = {
  /** MIDI note number, 21 (A0) .. 108 (C8) */
  note: number
  /** 0..127 */
  velocity: number
  /** Which part of a compound patch this note belongs to (for colour) */
  partId?: string
}

export type KeyboardPart = {
  id: string
  /** Display label (rendered above the zone bar) */
  label: string
  /** Lowest MIDI note this part responds to */
  fromNote: number
  /** Highest MIDI note this part responds to */
  toNote: number
  /** Custom colour CSS value; if omitted, picked from chart palette */
  color?: string
}

export interface KeyboardVisualizerProps {
  /** Notes currently held */
  active?: KeyboardNote[]
  /** Optional compound-patch parts to overlay as a zone bar */
  parts?: KeyboardPart[]
  /** Lowest MIDI note shown (default 21 = A0) */
  fromNote?: number
  /** Highest MIDI note shown (default 108 = C8) */
  toNote?: number
  /** Show octave labels under the C keys */
  labelOctaves?: boolean
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

const CHART_COLOURS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

function partColour(part: KeyboardPart, index: number) {
  return part.color ?? CHART_COLOURS[index % CHART_COLOURS.length]
}

export function KeyboardVisualizer({
  active = [],
  parts,
  fromNote = 21,
  toNote = 108,
  labelOctaves = true,
  className,
}: KeyboardVisualizerProps) {
  const activeByNote = React.useMemo(() => {
    const m = new Map<number, KeyboardNote>()
    for (const e of active) m.set(e.note, e)
    return m
  }, [active])

  const partById = React.useMemo(() => {
    const m = new Map<string, { part: KeyboardPart; color: string }>()
    parts?.forEach((p, i) => m.set(p.id, { part: p, color: partColour(p, i) }))
    return m
  }, [parts])

  // Build the list of white keys; black keys overlay on top.
  const whiteKeys: number[] = []
  for (let n = fromNote; n <= toNote; n++) {
    if (!isBlack(n)) whiteKeys.push(n)
  }
  const whiteCount = whiteKeys.length
  const whitePct = 100 / whiteCount

  // Map every MIDI note to a percentage position (left edge) for the zone bar.
  function notePctLeft(midi: number) {
    // Anchor every note to the nearest white-key index.
    // For black keys, position is between two whites.
    let whiteIndex = 0
    for (let i = 0; i < whiteKeys.length; i++) {
      if (whiteKeys[i] >= midi) {
        whiteIndex = i
        break
      }
      whiteIndex = i + 1
    }
    if (isBlack(midi)) {
      // Black key sits between two whites; use half-position
      return (whiteIndex - 0.3) * whitePct
    }
    return whiteIndex * whitePct
  }

  function notePctRight(midi: number) {
    let whiteIndex = whiteKeys.length - 1
    for (let i = whiteKeys.length - 1; i >= 0; i--) {
      if (whiteKeys[i] <= midi) {
        whiteIndex = i
        break
      }
    }
    return (whiteIndex + 1) * whitePct
  }

  return (
    <div
      className={cn(
        "relative isolate select-none rounded-xl border border-border-strong bg-card-raised p-3 shadow-inner",
        className,
      )}
      role="img"
      aria-label="Keyboard visualizer"
    >
      {/* Zone bar above keys */}
      {parts && parts.length > 0 && (
        <div className="relative mb-2 h-8">
          {parts.map((p, i) => {
            const color = partColour(p, i)
            const left = notePctLeft(p.fromNote)
            const right = notePctRight(p.toNote)
            return (
              <div
                key={p.id}
                className="absolute top-0 flex h-full items-center justify-between rounded-md border px-2 text-xs font-semibold text-foreground"
                style={{
                  left: `${left}%`,
                  width: `${right - left}%`,
                  background: `color-mix(in oklch, ${color} 30%, transparent)`,
                  borderColor: color,
                  boxShadow: `inset 0 0 0 1px color-mix(in oklch, ${color} 40%, transparent)`,
                }}
              >
                <span className="truncate">{p.label}</span>
                <span className="ml-2 shrink-0 font-mono text-[10px] opacity-70">
                  {NOTE_NAMES[p.fromNote % 12]}
                  {octaveOf(p.fromNote)}–{NOTE_NAMES[p.toNote % 12]}
                  {octaveOf(p.toNote)}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Keyboard body */}
      <div className="relative">
        {/* White keys */}
        <div className="relative flex h-28 items-end">
          {whiteKeys.map((midi) => {
            const noteEvent = activeByNote.get(midi)
            const isActive = !!noteEvent
            const partColor = noteEvent?.partId
              ? partById.get(noteEvent.partId)?.color
              : null
            const accent = partColor ?? "var(--primary)"
            const isCStart = midi % 12 === 0
            const inPartZone = parts?.some((p) => midi >= p.fromNote && midi <= p.toNote)

            return (
              <div
                key={midi}
                data-note={midi}
                data-active={isActive || undefined}
                className={cn(
                  "relative flex h-full flex-1 flex-col items-center justify-end rounded-b-md border-l border-r border-b border-neutral-300 text-[10px] font-medium text-neutral-600 transition-colors first:rounded-bl-lg last:rounded-br-lg",
                )}
                style={{
                  background: isActive
                    ? `linear-gradient(180deg, color-mix(in oklch, ${accent} 35%, white) 0%, ${accent} 100%)`
                    : "linear-gradient(180deg, #fbfbf8 0%, #ebebe6 92%, #d8d8d2 100%)",
                  boxShadow: isActive
                    ? `inset 0 0 12px color-mix(in oklch, ${accent} 60%, transparent), 0 -1px 0 0 ${accent} inset`
                    : "inset 0 -3px 4px -2px rgba(0,0,0,0.18)",
                  color: isActive ? "white" : undefined,
                  borderLeftColor: isCStart ? "rgba(0,0,0,0.18)" : undefined,
                  borderLeftWidth: isCStart ? 2 : 1,
                  opacity: parts && parts.length > 0 ? (inPartZone ? 1 : 0.55) : 1,
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
              const renderBlack = isBlack(blackMidi)
              if (!renderBlack) {
                return <div key={i} className="flex-1" />
              }
              const noteEvent = activeByNote.get(blackMidi)
              const isActive = !!noteEvent
              const partColor = noteEvent?.partId
                ? partById.get(noteEvent.partId)?.color
                : null
              const accent = partColor ?? "var(--primary)"
              return (
                <div key={i} className="relative flex-1">
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
  )
}

export function noteName(midi: number) {
  return `${NOTE_NAMES[midi % 12]}${octaveOf(midi)}`
}
