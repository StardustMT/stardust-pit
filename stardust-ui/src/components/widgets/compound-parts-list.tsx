import * as React from "react"
import { GripVertical, Volume2, VolumeX, Lock, Unlock } from "lucide-react"
import { cn } from "@/lib/utils"
import { Slider } from "@/components/ui/slider"

/**
 * Sidebar of compound-patch parts. Each row shows: colour swatch, name,
 * key range (or controller filter), level, mute, solo. Designed to live
 * alongside the keyboard visualiser so a glance shows the whole split.
 */

export type CompoundPart = {
  id: string
  name: string
  color: string
  /** Either a keyboard range, a controller filter, or both. */
  range?: {
    /** MIDI note number low */
    fromNote: number
    /** MIDI note number high */
    toNote: number
  }
  controller?: {
    /** e.g. "Octapad ch 10", "RD-2000 ch 1" */
    label: string
  }
  /** 0..1 */
  level: number
  muted?: boolean
  soloed?: boolean
  /** Set if this part is currently receiving input */
  receiving?: boolean
}

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
function noteName(midi: number) {
  return `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`
}

export interface CompoundPartsListProps {
  parts: CompoundPart[]
  className?: string
}

export function CompoundPartsList({ parts, className }: CompoundPartsListProps) {
  return (
    <div className={cn("flex flex-col gap-2 rounded-xl border bg-card p-3", className)}>
      <header className="flex items-center justify-between px-1 pb-1">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Compound parts
        </h3>
        <span className="font-mono text-xs text-muted-foreground">{parts.length}</span>
      </header>
      <ul className="space-y-1.5">
        {parts.map((p) => (
          <li
            key={p.id}
            className={cn(
              "group flex items-center gap-2 rounded-lg border px-2.5 py-2 transition-colors",
              p.muted ? "opacity-50" : "",
              p.receiving ? "border-border-strong bg-card-raised" : "border-border",
            )}
          >
            <GripVertical className="size-3.5 cursor-grab text-muted-foreground/60" />
            <span
              className="block h-9 w-1 rounded-full"
              style={{
                background: p.color,
                boxShadow: p.receiving
                  ? `0 0 8px color-mix(in oklch, ${p.color} 60%, transparent)`
                  : undefined,
              }}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{p.name}</div>
              <div className="truncate font-mono text-[11px] text-muted-foreground">
                {p.range
                  ? `${noteName(p.range.fromNote)} – ${noteName(p.range.toNote)}`
                  : p.controller?.label ?? "—"}
              </div>
            </div>
            <div className="hidden w-20 sm:block">
              <Slider value={[p.level]} max={1} step={0.01} aria-label={`${p.name} level`} />
            </div>
            <button
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={p.muted ? "Unmute" : "Mute"}
            >
              {p.muted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
            </button>
            <button
              className={cn(
                "rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground",
                p.soloed && "bg-stage/20 text-stage hover:bg-stage/30",
              )}
              aria-label={p.soloed ? "Unsolo" : "Solo"}
            >
              {p.soloed ? <Lock className="size-3.5" /> : <Unlock className="size-3.5" />}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
