import * as React from "react"
import { cn } from "@/lib/utils"

export interface ShowSongPatchLabelProps {
  show: string
  song: string
  songIndex?: number
  songTotal?: number
  patch: string
  patchIndex?: number
  patchTotal?: number
  /** Per-Show terminology overrides ("Song" → "Number", "Cue", "Piece", etc.) */
  songLabel?: string
  className?: string
}

export function ShowSongPatchLabel({
  show,
  song,
  songIndex,
  songTotal,
  patch,
  patchIndex,
  patchTotal,
  songLabel = "Song",
  className,
}: ShowSongPatchLabelProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{show}</div>
      <div className="flex items-baseline gap-3">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          {songLabel}
          {songIndex != null && songTotal != null ? ` ${songIndex} / ${songTotal}` : ""}
        </span>
        <span className="text-3xl font-semibold tracking-tight">{song}</span>
      </div>
      <div className="flex items-baseline gap-3">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          Patch{patchIndex != null && patchTotal != null ? ` ${patchIndex} / ${patchTotal}` : ""}
        </span>
        <span className="text-5xl font-semibold tracking-tight">{patch}</span>
      </div>
    </div>
  )
}
