import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * 88-key piano keyboard visualizer. Renders A0..C8 with note-lighting for
 * active notes. Designed for Live Mode — readable at a glance from a
 * keyboardist's playing distance.
 */

export type KeyboardEvent = {
  /** MIDI note number, 21 (A0) .. 108 (C8) */
  note: number
  /** 0..127 */
  velocity: number
  /** Optional channel for colour grouping when layered */
  channel?: number
}

export interface KeyboardVisualizerProps {
  /** Notes currently held */
  active?: KeyboardEvent[]
  /** Lowest MIDI note shown (default 21 = A0) */
  fromNote?: number
  /** Highest MIDI note shown (default 108 = C8) */
  toNote?: number
  /** Show octave labels under the C keys */
  labelOctaves?: boolean
  className?: string
}

const WHITE_NOTES_IN_OCTAVE = [0, 2, 4, 5, 7, 9, 11]
const BLACK_NOTES_IN_OCTAVE = [1, 3, 6, 8, 10]

function isBlack(midi: number) {
  return BLACK_NOTES_IN_OCTAVE.includes(midi % 12)
}

function octave(midi: number) {
  return Math.floor(midi / 12) - 1
}

function noteName(midi: number) {
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
  return `${names[midi % 12]}${octave(midi)}`
}

const CHANNEL_COLOURS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

export function KeyboardVisualizer({
  active = [],
  fromNote = 21,
  toNote = 108,
  labelOctaves = true,
  className,
}: KeyboardVisualizerProps) {
  const activeByNote = React.useMemo(() => {
    const m = new Map<number, KeyboardEvent>()
    for (const e of active) m.set(e.note, e)
    return m
  }, [active])

  // Build the list of white keys; black keys overlay on top.
  const whiteKeys: number[] = []
  for (let n = fromNote; n <= toNote; n++) {
    if (!isBlack(n)) whiteKeys.push(n)
  }

  return (
    <div
      className={cn(
        "relative isolate select-none rounded-md bg-muted/50 p-1 ring-1 ring-border",
        className,
      )}
      role="img"
      aria-label="Keyboard visualizer"
    >
      <div className="relative flex items-end">
        {whiteKeys.map((midi) => {
          const isActive = activeByNote.has(midi)
          const ev = activeByNote.get(midi)
          const colour =
            ev?.channel != null ? CHANNEL_COLOURS[ev.channel % CHANNEL_COLOURS.length] : "var(--primary)"
          return (
            <div
              key={midi}
              className={cn(
                "relative flex h-24 flex-1 flex-col items-center justify-end rounded-b-sm border border-border bg-white text-[10px] text-neutral-700",
                "first:rounded-bl-md last:rounded-br-md",
              )}
              style={
                isActive
                  ? {
                      background: `linear-gradient(180deg, ${colour}40 0%, ${colour} 100%)`,
                      color: "white",
                    }
                  : undefined
              }
              data-note={midi}
              data-active={isActive ? "true" : undefined}
            >
              {labelOctaves && midi % 12 === 0 && <span className="pb-1">C{octave(midi)}</span>}
            </div>
          )
        })}
      </div>

      {/* Black-key overlay */}
      <div className="pointer-events-none absolute inset-y-1 left-1 right-1 top-1">
        <div className="relative flex">
          {whiteKeys.slice(0, -1).map((midi, i) => {
            // Black key sits at the boundary between this white and the next
            const blackMidi = midi + 1
            if (!isBlack(blackMidi)) return <div key={i} className="flex-1" />
            const isActive = activeByNote.has(blackMidi)
            const ev = activeByNote.get(blackMidi)
            const colour =
              ev?.channel != null ? CHANNEL_COLOURS[ev.channel % CHANNEL_COLOURS.length] : "var(--primary)"
            return (
              <div key={i} className="relative flex-1">
                <div
                  className="absolute -right-[18%] top-0 z-10 h-14 w-[36%] rounded-b border border-neutral-900 bg-neutral-900 shadow-[0_2px_0_0_rgba(0,0,0,0.6)]"
                  style={
                    isActive
                      ? {
                          background: `linear-gradient(180deg, ${colour} 0%, ${colour}80 100%)`,
                          borderColor: colour,
                        }
                      : undefined
                  }
                  data-note={blackMidi}
                  data-active={isActive ? "true" : undefined}
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export { noteName }
