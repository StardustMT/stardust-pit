import * as React from "react"
import {
  Cable,
  Check,
  Drum,
  Footprints,
  Move3D,
  Piano,
  Plus,
  Settings2,
  Sliders,
  Wind,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { RigDeviceKind, RigDeviceSpec } from "./_catalog"

function iconFor(kind: RigDeviceKind): React.ComponentType<{ className?: string }> {
  switch (kind) {
    case "keyboard88":
    case "keyboard76":
    case "keyboard61":
    case "keyboard49":
    case "pad-keyboard":
      return Piano
    case "pad-controller":
      return Drum
    case "footswitch":
    case "multi-switch":
      return Footprints
    case "expression-pedal":
      return Move3D
    case "foot-controller":
      return Sliders
    case "wind-controller":
      return Wind
    case "audio-interface":
      return Cable
    default:
      return Settings2
  }
}

export interface DeviceLibraryCardProps {
  spec: RigDeviceSpec
  /** Physically plugged in right now */
  connected?: boolean
  /** Already added to the current rig */
  added?: boolean
  onAdd?: () => void
}

export function DeviceLibraryCard({
  spec,
  connected,
  added,
  onAdd,
}: DeviceLibraryCardProps) {
  const Icon = iconFor(spec.kind)
  return (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-md border bg-card px-2.5 py-2 transition-colors",
        "hover:border-primary/50 hover:bg-muted/40",
        added && "border-primary/30 bg-primary/5"
      )}
    >
      <div
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-md border",
          connected
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
            : "border-border bg-muted/40 text-muted-foreground"
        )}
      >
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
          {spec.vendor}
        </div>
        <div className="truncate text-xs font-semibold">{spec.model}</div>
        {spec.notes && (
          <div className="truncate text-[10px] text-muted-foreground/80">
            {spec.notes}
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {connected && (
          <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-500">
            Plugged in
          </span>
        )}
        {added ? (
          <span
            className="grid size-7 place-items-center text-primary"
            title="Already in your rig"
          >
            <Check className="size-3.5" />
          </span>
        ) : (
          <Button
            size="icon"
            variant="ghost"
            className="size-7"
            onClick={onAdd}
            title="Add to rig"
          >
            <Plus className="size-3.5" />
          </Button>
        )}
      </div>
    </div>
  )
}
