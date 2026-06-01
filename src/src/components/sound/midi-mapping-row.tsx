import { ArrowRight, Trash2, Pencil } from "lucide-react"
import { cn } from "@/lib/utils"

export interface MidiMappingRowProps {
  /** Source — e.g. "EV-5 (CC 11, ch 1)" */
  source: string
  /** Target — e.g. "Diva · Filter cutoff" */
  target: string
  /** Where this mapping is defined */
  inheritedFrom?: "Show" | "Song" | "Patch"
  /** True if overridden at the current level */
  overridden?: boolean
  /** Range / curve summary */
  range?: string
  className?: string
}

export function MidiMappingRow({
  source,
  target,
  inheritedFrom,
  overridden,
  range,
  className,
}: MidiMappingRowProps) {
  return (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-md border bg-card px-3 py-2 text-sm",
        overridden && "border-primary/40 bg-primary/5",
        className,
      )}
    >
      <span className="min-w-0 flex-1 truncate font-mono text-xs">{source}</span>
      <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate">{target}</span>
      {range && (
        <span className="hidden font-mono text-xs text-muted-foreground sm:inline">{range}</span>
      )}
      {inheritedFrom && (
        <span
          className={cn(
            "rounded px-1.5 py-0.5 font-mono text-[10px] uppercase",
            overridden ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
          )}
          title={overridden ? `Overrides ${inheritedFrom}` : `Inherited from ${inheritedFrom}`}
        >
          {overridden ? `● ${inheritedFrom}` : inheritedFrom}
        </span>
      )}
      <button
        className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Edit mapping"
      >
        <Pencil className="size-3.5" />
      </button>
      <button
        className="rounded p-1.5 text-muted-foreground opacity-0 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
        aria-label="Delete mapping"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  )
}
