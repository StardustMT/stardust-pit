import * as React from "react"
import { Music, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Setlist widget: vertical list of all songs in the current Show, with
 * current song highlighted and contextual information (patch count,
 * length, key). Designed as a persistent left-rail companion to Live
 * Mode so the player always has whole-show context.
 */

export type SetlistItem = {
  id: string
  number: number
  name: string
  patchCount: number
  /** Approximate minutes:seconds */
  length?: string
  /** Display key, e.g. "Bb" */
  key?: string
}

export interface SetlistProps {
  items: SetlistItem[]
  currentId: string
  /** Per-Show terminology override */
  unitLabel?: string
  onSelect?: (id: string) => void
  className?: string
}

export function Setlist({
  items,
  currentId,
  unitLabel = "Song",
  onSelect,
  className,
}: SetlistProps) {
  return (
    <div className={cn("flex h-full flex-col rounded-xl border bg-card", className)}>
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Setlist
          </h3>
          <p className="font-mono text-xs text-foreground">
            {items.length} {unitLabel.toLowerCase()}
            {items.length === 1 ? "" : "s"}
          </p>
        </div>
        <Music className="size-4 text-muted-foreground" />
      </header>
      <ol className="flex-1 overflow-y-auto p-2">
        {items.map((it) => {
          const isCurrent = it.id === currentId
          return (
            <li key={it.id}>
              <button
                type="button"
                onClick={() => onSelect?.(it.id)}
                className={cn(
                  "group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors",
                  isCurrent
                    ? "bg-stage/15 text-foreground ring-1 ring-stage/40"
                    : "hover:bg-muted/60 text-foreground/85",
                )}
              >
                <span
                  className={cn(
                    "w-6 shrink-0 text-right font-mono text-xs",
                    isCurrent ? "text-stage" : "text-muted-foreground",
                  )}
                >
                  {it.number}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium leading-tight">{it.name}</div>
                  <div className="flex items-center gap-2 truncate font-mono text-[11px] text-muted-foreground">
                    <span>
                      {it.patchCount} patch{it.patchCount === 1 ? "" : "es"}
                    </span>
                    {it.length && <span>· {it.length}</span>}
                    {it.key && <span>· {it.key}</span>}
                  </div>
                </div>
                {isCurrent && (
                  <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-stage">
                    Now
                  </span>
                )}
                {!isCurrent && (
                  <ChevronRight className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" />
                )}
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
