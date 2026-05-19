import * as React from "react"
import { ChevronDown, ChevronRight, Pencil, Settings } from "lucide-react"
import { cn } from "@/lib/utils"

export interface PatchTitleBarProps {
  songName: string
  patchName: string
  /** Optional secondary metadata (e.g. "Patch 2 of 5", transition time). */
  meta?: string
  onRename?: () => void
  onOpenSettings?: () => void
  className?: string
}

/**
 * Compact title strip rendered above the canvas. Shows where you are in
 * the show outline (song → patch) plus quick actions. Mirrors the old v4
 * patch editor's header but without the noise.
 */
export function PatchTitleBar({
  songName,
  patchName,
  meta,
  onRename,
  onOpenSettings,
  className,
}: PatchTitleBarProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 border-b bg-card/60 px-3 py-1.5",
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
          {songName}
        </span>
        <ChevronRight className="size-3 shrink-0 text-muted-foreground/60" />
        <button
          type="button"
          onClick={onRename}
          className="group flex min-w-0 items-center gap-1.5 rounded px-1 py-0.5 hover:bg-muted/40"
          title="Click to rename patch"
        >
          <span className="truncate text-sm font-semibold">{patchName}</span>
          <Pencil className="size-3 opacity-0 transition-opacity group-hover:opacity-60" />
        </button>
        {meta && (
          <span className="ml-1 truncate text-[10px] text-muted-foreground">
            {meta}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onOpenSettings}
          className="grid size-7 place-items-center rounded text-muted-foreground hover:bg-muted/40 hover:text-foreground"
          title="Patch settings"
          aria-label="Patch settings"
        >
          <Settings className="size-3.5" />
        </button>
      </div>
    </div>
  )
}
