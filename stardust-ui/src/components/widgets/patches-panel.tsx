import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Vertical list of patches in the current Song, with current / next /
 * past states and at-a-glance metadata (split count, transition).
 * Complements the horizontal PatchListStrip — this is the persistent
 * sidebar view for whole-song context, the strip is for sweep-of-time
 * orientation.
 */

export type PatchPanelItem = {
  id: string
  number: number
  name: string
  subtitle?: string
  /** Number of compound parts (>1 → show split icon) */
  partCount?: number
  /** Short transition label, e.g. "Fade 600 ms" */
  transition?: string
}

export interface PatchesPanelProps {
  patches: PatchPanelItem[]
  currentIndex: number
  onJump?: (index: number) => void
  className?: string
}

export function PatchesPanel({
  patches,
  currentIndex,
  onJump,
  className,
}: PatchesPanelProps) {
  return (
    <div className={cn("flex h-full flex-col rounded-xl border bg-card", className)}>
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Patches
          </h3>
          <p className="font-mono text-xs">
            {currentIndex + 1} / {patches.length}
          </p>
        </div>
      </header>
      <ol className="flex-1 overflow-y-auto p-2">
        {patches.map((p, i) => {
          const isCurrent = i === currentIndex
          const isNext = i === currentIndex + 1
          const isPast = i < currentIndex
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onJump?.(i)}
                className={cn(
                  "group flex w-full items-stretch gap-3 rounded-lg px-3 py-2 text-left transition-colors",
                  isCurrent && "bg-stage/15 text-foreground ring-1 ring-stage/40",
                  isNext && "bg-card-raised text-foreground ring-1 ring-border-strong",
                  isPast && "text-foreground/55 hover:bg-muted/40",
                  !isCurrent && !isNext && !isPast && "hover:bg-muted/60",
                )}
              >
                <div className="flex w-10 shrink-0 flex-col items-center justify-center">
                  <span
                    className={cn(
                      "font-mono text-base font-semibold tabular-nums",
                      isCurrent ? "text-stage" : "text-muted-foreground",
                    )}
                  >
                    {p.number}
                  </span>
                  {isCurrent && (
                    <span className="font-mono text-[9px] uppercase tracking-wider text-stage">
                      Now
                    </span>
                  )}
                  {isNext && (
                    <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                      Next
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium leading-snug">{p.name}</div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {p.subtitle && <span className="truncate">{p.subtitle}</span>}
                    {p.partCount != null && p.partCount > 1 && (
                      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                        {p.partCount}-part split
                      </span>
                    )}
                  </div>
                  {p.transition && (
                    <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      → {p.transition}
                    </div>
                  )}
                </div>
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
