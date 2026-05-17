import * as React from "react"
import { cn } from "@/lib/utils"

export type PatchListItem = {
  id: string
  name: string
  /** Optional short subtitle (e.g. "Strings + Bell") */
  subtitle?: string
}

export interface PatchListStripProps {
  patches: PatchListItem[]
  currentIndex: number
  onJump?: (index: number) => void
  className?: string
}

export function PatchListStrip({
  patches,
  currentIndex,
  onJump,
  className,
}: PatchListStripProps) {
  return (
    <div className={cn("relative flex gap-2 overflow-x-auto py-2", className)}>
      {patches.map((p, i) => {
        const isCurrent = i === currentIndex
        const isNext = i === currentIndex + 1
        const isPast = i < currentIndex
        return (
          <button
            key={p.id}
            onClick={() => onJump?.(i)}
            className={cn(
              "group min-w-[160px] shrink-0 rounded-lg border px-3 py-2 text-left transition-all",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isCurrent &&
                "border-primary bg-primary text-primary-foreground shadow-lg",
              isNext && "border-primary/40 bg-accent",
              !isCurrent && !isNext && isPast && "border-border bg-muted/30 opacity-60",
              !isCurrent && !isNext && !isPast && "border-border bg-card",
            )}
            data-current={isCurrent || undefined}
            data-next={isNext || undefined}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span
                className={cn(
                  "text-xs",
                  isCurrent ? "text-primary-foreground/80" : "text-muted-foreground",
                )}
              >
                {i + 1}
              </span>
              {isCurrent && (
                <span className="text-[10px] uppercase tracking-wider opacity-80">Now</span>
              )}
              {isNext && (
                <span className="text-[10px] uppercase tracking-wider text-primary">
                  Next
                </span>
              )}
            </div>
            <div className="mt-0.5 truncate font-semibold">{p.name}</div>
            {p.subtitle && (
              <div
                className={cn(
                  "truncate text-xs",
                  isCurrent ? "text-primary-foreground/70" : "text-muted-foreground",
                )}
              >
                {p.subtitle}
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}
