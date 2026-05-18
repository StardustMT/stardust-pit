import * as React from "react"
import { cn } from "@/lib/utils"

export interface LayoutWidget {
  id: string
  label: string
  /** Column start, 1-indexed */
  col: number
  /** Row start, 1-indexed */
  row: number
  /** Span in columns */
  colSpan: number
  /** Span in rows */
  rowSpan: number
  /** Optional preview content */
  children?: React.ReactNode
}

export interface LayoutCanvasGridProps {
  /** Number of columns in the layout grid */
  cols?: number
  /** Number of rows in the layout grid */
  rows?: number
  widgets: LayoutWidget[]
  /** Currently selected widget id */
  selectedId?: string
  onSelect?: (id: string) => void
  className?: string
}

export function LayoutCanvasGrid({
  cols = 12,
  rows = 8,
  widgets,
  selectedId,
  onSelect,
  className,
}: LayoutCanvasGridProps) {
  return (
    <div
      className={cn(
        "relative grid h-full w-full gap-2 rounded-lg border border-dashed border-border bg-muted/30 p-2",
        className,
      )}
      style={{
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        backgroundImage:
          "linear-gradient(to right, color-mix(in oklch, var(--border) 80%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklch, var(--border) 80%, transparent) 1px, transparent 1px)",
        backgroundSize: `calc(100%/${cols}) calc(100%/${rows})`,
      }}
    >
      {widgets.map((w) => {
        const selected = w.id === selectedId
        return (
          <button
            key={w.id}
            type="button"
            onClick={() => onSelect?.(w.id)}
            className={cn(
              "rounded-md border bg-card p-3 text-left text-sm transition-all",
              selected
                ? "border-primary ring-2 ring-primary/40"
                : "border-border hover:border-primary/40",
            )}
            style={{
              gridColumn: `${w.col} / span ${w.colSpan}`,
              gridRow: `${w.row} / span ${w.rowSpan}`,
            }}
          >
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {w.label}
            </div>
            {w.children}
          </button>
        )
      })}
    </div>
  )
}
