import * as React from "react"
import { PencilLine, Play } from "lucide-react"
import { cn } from "@/lib/utils"

export type AppMode = "edit" | "live"

export interface ModeSwitcherProps {
  mode: AppMode
  onChange?: (mode: AppMode) => void
  className?: string
}

/**
 * Edit ⇄ Live mode switcher. Two segments, one always selected. Lives in
 * the top chrome of the app. Strongly tied to Performance Lock — when
 * locked, only Live is selectable.
 */
export function ModeSwitcher({ mode, onChange, className }: ModeSwitcherProps) {
  return (
    <div
      className={cn(
        "inline-flex h-8 items-center gap-0.5 rounded-md border bg-muted p-0.5",
        className,
      )}
      role="tablist"
    >
      <Segment
        active={mode === "edit"}
        onClick={() => onChange?.("edit")}
        icon={<PencilLine className="size-3.5" />}
        label="Edit"
      />
      <Segment
        active={mode === "live"}
        onClick={() => onChange?.("live")}
        icon={<Play className="size-3.5" />}
        label="Live"
      />
    </div>
  )
}

function Segment({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="tab"
      aria-selected={active}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded px-3 text-xs font-medium transition-colors",
        active
          ? "bg-card text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  )
}
