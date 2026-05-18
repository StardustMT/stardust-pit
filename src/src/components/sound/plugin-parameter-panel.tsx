import * as React from "react"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"
import { Sparkles } from "lucide-react"

export interface PluginParameter {
  id: string
  name: string
  value: number
  min?: number
  max?: number
  step?: number
  unit?: string
  /** Indicates a MIDI mapping exists for this param */
  mapped?: boolean
  /** Marks this param as a "favorite" surfaced to Live Mode */
  favorited?: boolean
}

export interface PluginParameterPanelProps {
  pluginName: string
  parameters: PluginParameter[]
  className?: string
}

export function PluginParameterPanel({
  pluginName,
  parameters,
  className,
}: PluginParameterPanelProps) {
  return (
    <div className={cn("rounded-lg border bg-card p-4", className)}>
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="font-semibold">{pluginName}</h3>
        <span className="text-xs text-muted-foreground">{parameters.length} params</span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        {parameters.map((p) => (
          <div key={p.id} className="space-y-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="flex items-center gap-1.5 text-sm">
                {p.favorited && (
                  <Sparkles className="size-3 text-amber-400" aria-label="Favorite" />
                )}
                {p.name}
                {p.mapped && (
                  <span className="rounded bg-primary/15 px-1 py-0.5 font-mono text-[10px] text-primary">
                    MIDI
                  </span>
                )}
              </span>
              <span className="font-mono text-xs tabular-nums">
                {p.value.toFixed(2)}
                {p.unit ?? ""}
              </span>
            </div>
            <Slider value={[p.value]} min={p.min ?? 0} max={p.max ?? 1} step={p.step ?? 0.01} />
          </div>
        ))}
      </div>
    </div>
  )
}
