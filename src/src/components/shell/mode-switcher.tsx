import * as React from "react"
import { PencilLine, Play, Wrench } from "lucide-react"
import { cn } from "@/lib/utils"

export type AppMode = "setup" | "program" | "perform"

export interface ModeSwitcherProps {
  mode: AppMode
  onChange?: (mode: AppMode) => void
  className?: string
}

/**
 * Three top-level modes:
 *
 *   - Setup   — hardware rig + show metadata + top-level show settings.
 *               The "what" and "where" before patches exist.
 *   - Program — patches, signal chains, plugins, MIDI mappings.
 *               The show content.
 *   - Perform — layout editor (default) + "Go Live" → fullscreen.
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
        active={mode === "setup"}
        onClick={() => onChange?.("setup")}
        icon={<Wrench className="size-3.5" />}
        label="Setup"
      />
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
