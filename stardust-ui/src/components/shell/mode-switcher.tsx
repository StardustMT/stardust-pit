import * as React from "react"
import { PencilLine, Play } from "lucide-react"
import { cn } from "@/lib/utils"

export type AppMode = "program" | "perform"

export interface ModeSwitcherProps {
  mode: AppMode
  onChange?: (mode: AppMode) => void
  className?: string
}

/**
 * Two-mode switcher. Two mental states, no more.
 *
 *   - Program — preparation: setlists, patches, signal chains, plugins,
 *     mappings. Everything done before the show.
 *   - Perform — the show: contains the Live canvas editor and the
 *     "Go Live" toggle. Going Live = fullscreen takeover.
 */
export function ModeSwitcher({ mode, onChange, className }: ModeSwitcherProps) {
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
        active={mode === "program"}
        onClick={() => onChange?.("program")}
        icon={<PencilLine className="size-3.5" />}
        label="Program"
      />
      <Segment
        active={mode === "perform"}
        onClick={() => onChange?.("perform")}
        icon={<Play className="size-3.5" />}
        label="Perform"
        accent
      />
    </div>
  )
}

function Segment({
  active,
  onClick,
  icon,
  label,
  accent,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  accent?: boolean
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
          ? accent
            ? "bg-primary text-primary-foreground shadow-sm"
            : "bg-card text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  )
}
