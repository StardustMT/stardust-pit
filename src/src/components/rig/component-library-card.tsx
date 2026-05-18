import * as React from "react"
import {
  CircleDot,
  Footprints,
  Grid3x3,
  Move3D,
  Piano,
  Plus,
  Sliders,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { RigComponentKind, RigComponentSpec } from "./_catalog"

function iconFor(kind: RigComponentKind): React.ComponentType<{ className?: string }> {
  switch (kind) {
    case "keyboard":
      return Piano
    case "pads":
      return Grid3x3
    case "switch":
      return Footprints
    case "expression-pedal":
      return Move3D
    case "knob":
      return CircleDot
    case "fader":
      return Sliders
  }
}

export interface ComponentLibraryCardProps {
  spec: RigComponentSpec
  onAdd?: () => void
}

export function ComponentLibraryCard({ spec, onAdd }: ComponentLibraryCardProps) {
  const Icon = iconFor(spec.kind)
  return (
    <button
      type="button"
      onClick={onAdd}
      className={cn(
        "group flex w-full items-center gap-3 rounded-md border bg-card px-3 py-2.5 text-left transition-colors",
        "hover:border-primary/50 hover:bg-muted/40"
      )}
    >
      <div className="grid size-9 shrink-0 place-items-center rounded-md border bg-muted/40 text-muted-foreground group-hover:text-foreground">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold">{spec.label}</div>
        <div className="truncate text-[10px] text-muted-foreground/80">
          {spec.description}
        </div>
      </div>
      <span className="grid size-7 shrink-0 place-items-center text-muted-foreground group-hover:text-primary">
        <Plus className="size-3.5" />
      </span>
    </button>
  )
}
