import * as React from "react"
import { Activity, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface MidiLearnOverlayProps {
  /** The target parameter we're learning */
  target: string
  /** Last MIDI message detected, if any */
  lastMessage?: string
  onCancel?: () => void
  className?: string
}

export function MidiLearnOverlay({
  target,
  lastMessage,
  onCancel,
  className,
}: MidiLearnOverlayProps) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-50 grid place-items-center bg-background/80 backdrop-blur-sm",
        className,
      )}
    >
      <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-primary">MIDI Learn</div>
            <h2 className="mt-1 text-xl font-semibold">Move a control on your device</h2>
          </div>
          <button
            onClick={onCancel}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Cancel MIDI Learn"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-4 rounded-md bg-muted p-3 text-sm">
          <div className="text-xs text-muted-foreground">Target</div>
          <div className="font-semibold">{target}</div>
        </div>

        <div className="mt-3 flex items-center gap-2 rounded-md border border-dashed border-primary/40 bg-primary/5 p-4">
          <Activity className="size-5 text-primary animate-pulse" />
          <div className="flex-1 font-mono text-sm">
            {lastMessage ?? <span className="text-muted-foreground">Listening…</span>}
          </div>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          Move a knob, slider, or footswitch on any connected MIDI device. Stardust will
          capture the next discrete control change and offer a mapping.
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button disabled={!lastMessage}>Confirm mapping</Button>
        </div>
      </div>
    </div>
  )
}
