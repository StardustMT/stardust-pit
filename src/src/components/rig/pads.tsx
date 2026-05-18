import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Drum / trigger pads widget. Models a grid of MIDI-note-triggered pads
 * (typical Launchkey: 16 pads in 2 rows of 8; Octapad: 8 pads in 1 row;
 * Maschine: 16 pads in 4 rows of 4 — configurable via `cols`/`rows`).
 *
 * Each pad can be assigned to a Sound (zone-style — colour matches the
 * sound), and pads with assignments are highlighted while idle pads are
 * dimmer.
 */

export type PadAssignment = {
  /** The pad index this assignment covers (0..rows*cols-1). May be a list
   *  for "this sound covers these pads" patterns. */
  padIndex: number
  /** Sound id this pad triggers */
  soundId: string
  /** Display colour (usually mirrors the sound's colour) */
  color: string
  /** Optional label (e.g. "Kick", "Snare") */
  label?: string
}

export interface PadsProps {
  /** Grid dimensions (default: 2 rows × 8 cols = 16 pads) */
  rows?: number
  cols?: number
  /** Pad assignments — each entry assigns a sound to a pad */
  assignments?: PadAssignment[]
  /** Active (currently-hit) pad indices for visual feedback */
  active?: number[]
  /** Selection callback (per pad id `pad-<index>`) */
  onSelectPad?: (padIndex: number) => void
  selectedPadIndex?: number
  /** Read-only — no click handlers */
  readOnly?: boolean
  className?: string
}

export function Pads({
  rows = 2,
  cols = 8,
  assignments = [],
  active = [],
  onSelectPad,
  selectedPadIndex,
  readOnly = false,
  className,
}: PadsProps) {
  const total = rows * cols
  const byPad = React.useMemo(() => {
    const m = new Map<number, PadAssignment>()
    for (const a of assignments) m.set(a.padIndex, a)
    return m
  }, [assignments])
  const activeSet = React.useMemo(() => new Set(active), [active])

  return (
    <div
      className={cn(
        "inline-grid gap-1.5 rounded-xl border border-border-strong bg-card-raised p-3 shadow-inner",
        className,
      )}
      style={{
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
      }}
      role="grid"
      aria-label="Drum / trigger pads"
    >
      {Array.from({ length: total }, (_, i) => {
        const assignment = byPad.get(i)
        const isActive = activeSet.has(i)
        const isSelected = selectedPadIndex === i
        const color = assignment?.color ?? "var(--muted)"
        return (
          <button
            key={i}
            type="button"
            disabled={readOnly}
            onClick={() => onSelectPad?.(i)}
            data-active={isActive || undefined}
            data-selected={isSelected || undefined}
            className={cn(
              "relative grid aspect-square w-12 place-items-center rounded-lg border text-[10px] font-mono transition-all",
              isSelected && "ring-2 ring-primary ring-offset-1 ring-offset-card-raised",
              !assignment && "border-border-strong bg-neutral-900/60 text-muted-foreground/50",
            )}
            style={
              assignment
                ? {
                    borderColor: color,
                    background: isActive
                      ? `radial-gradient(circle at 50% 35%, color-mix(in oklch, ${color} 60%, white) 0%, ${color} 90%)`
                      : `linear-gradient(180deg, color-mix(in oklch, ${color} 25%, #1a1a1a) 0%, color-mix(in oklch, ${color} 10%, #0a0a0a) 100%)`,
                    boxShadow: isActive
                      ? `0 0 12px color-mix(in oklch, ${color} 60%, transparent), inset 0 -2px 0 color-mix(in oklch, ${color} 50%, black)`
                      : `inset 0 -2px 0 rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.05)`,
                    color: isActive ? "white" : undefined,
                  }
                : undefined
            }
          >
            <span
              className={cn("truncate px-1", assignment ? "text-foreground/85" : "")}
              style={
                assignment && !isActive
                  ? { color: `color-mix(in oklch, ${color} 60%, white)` }
                  : undefined
              }
            >
              {assignment?.label ?? i + 1}
            </span>
          </button>
        )
      })}
    </div>
  )
}
