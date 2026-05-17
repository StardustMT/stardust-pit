import * as React from "react"
import { LayoutGrid, PencilLine, Play } from "lucide-react"
import { cn } from "@/lib/utils"

export type AppMode = "edit" | "layout" | "live"

export interface ModeSwitcherProps {
  mode: AppMode
  onChange?: (mode: AppMode) => void
  /** When true, only Live is selectable (Performance Lock active) */
  locked?: boolean
  className?: string
}

/**
 * Three-mode switcher: Edit (wire up patches + plugins + mappings),
 * Layout (design the Live canvas), Live (perform). Replaces the previous
 * Edit/Live binary which conflated wiring with visual layout — and
 * rejects MainStage's "Layout is a tab inside Edit" pattern.
 *
 * - Edit:   the data layer (patches, instruments, effects, mappings)
 * - Layout: the canvas layer (which widgets, where, sized how — cascades
 *           Show → Song → Patch, default Show-wide)
 * - Live:   the performance layer (canvas is locked, you play)
 */
export function ModeSwitcher({ mode, onChange, locked, className }: ModeSwitcherProps) {
  return (
    <div
      className={cn(
        "inline-flex h-8 items-center gap-0.5 rounded-md border bg-muted p-0.5",
        className,
      )}
      role="tablist"
      aria-label="Mode"
    >
      <Segment
        active={mode === "edit"}
        disabled={locked}
        onClick={() => onChange?.("edit")}
        icon={<PencilLine className="size-3.5" />}
        label="Edit"
      />
      <Segment
        active={mode === "layout"}
        disabled={locked}
        onClick={() => onChange?.("layout")}
        icon={<LayoutGrid className="size-3.5" />}
        label="Layout"
      />
      <Segment
        active={mode === "live"}
        onClick={() => onChange?.("live")}
        icon={<Play className="size-3.5" />}
        label="Live"
        accent
      />
    </div>
  )
}

function Segment({
  active,
  disabled,
  onClick,
  icon,
  label,
  accent,
}: {
  active: boolean
  disabled?: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  accent?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      role="tab"
      aria-selected={active}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded px-3 text-xs font-medium transition-colors",
        active
          ? accent
            ? "bg-primary text-primary-foreground shadow-sm"
            : "bg-card text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
        disabled && "cursor-not-allowed opacity-40 hover:text-muted-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  )
}
