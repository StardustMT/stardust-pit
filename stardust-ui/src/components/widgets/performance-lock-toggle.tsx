import * as React from "react"
import { Lock, Play, Square } from "lucide-react"
import { cn } from "@/lib/utils"

export interface PerformanceLockToggleProps {
  locked: boolean
  onChange?: (locked: boolean) => void
  className?: string
}

export function PerformanceLockToggle({
  locked,
  onChange,
  className,
}: PerformanceLockToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onChange?.(!locked)}
      className={cn(
        "inline-flex items-center gap-3 rounded-md px-5 py-3 text-base font-semibold uppercase tracking-wider transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        locked
          ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-600/90"
          : "bg-muted text-foreground hover:bg-muted/80",
        className,
      )}
      data-locked={locked || undefined}
    >
      {locked ? (
        <>
          <Lock className="size-4" />
          <span className="flex items-center gap-2">
            Live
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-white" />
            </span>
          </span>
        </>
      ) : (
        <>
          <Play className="size-4" />
          Go Live
        </>
      )}
    </button>
  )
}

export function EndShowButton({ onClick, className }: { onClick?: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground transition-colors hover:bg-destructive/90",
        className,
      )}
    >
      <Square className="size-4" />
      End Show
    </button>
  )
}
