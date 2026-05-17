import * as React from "react"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"

export interface ParameterFavoriteProps {
  label: string
  /** Source identifier shown muted, e.g. "Diva · Filter cutoff" */
  source?: string
  value: number
  min?: number
  max?: number
  step?: number
  unit?: string
  /** "knob" (circular) or "slider" (linear) */
  style?: "knob" | "slider"
  onChange?: (value: number) => void
  className?: string
}

export function ParameterFavorite({
  label,
  source,
  value,
  min = 0,
  max = 1,
  step = 0.01,
  unit,
  style = "slider",
  onChange,
  className,
}: ParameterFavoriteProps) {
  const pct = ((value - min) / (max - min)) * 100
  const display =
    unit === "%" ? `${Math.round(pct)}%` : value.toFixed(step >= 1 ? 0 : 2) + (unit ?? "")

  if (style === "knob") {
    return (
      <div className={cn("flex flex-col items-center gap-2 rounded-lg border bg-card p-3", className)}>
        <div className="relative size-16">
          <svg viewBox="0 0 64 64" className="size-full">
            <circle
              cx="32"
              cy="32"
              r="26"
              fill="none"
              stroke="var(--muted)"
              strokeWidth="5"
            />
            <circle
              cx="32"
              cy="32"
              r="26"
              fill="none"
              stroke="var(--primary)"
              strokeWidth="5"
              strokeDasharray={2 * Math.PI * 26}
              strokeDashoffset={2 * Math.PI * 26 * (1 - pct / 100)}
              transform="rotate(135 32 32)"
              strokeLinecap="round"
            />
            <line
              x1="32"
              y1="32"
              x2="32"
              y2="8"
              stroke="var(--foreground)"
              strokeWidth="2"
              strokeLinecap="round"
              transform={`rotate(${135 + (pct / 100) * 270} 32 32)`}
            />
          </svg>
        </div>
        <div className="text-center">
          <div className="font-mono text-sm font-semibold tabular-nums">{display}</div>
          <div className="text-xs">{label}</div>
          {source && <div className="text-[10px] text-muted-foreground">{source}</div>}
        </div>
      </div>
    )
  }

  return (
    <div className={cn("rounded-lg border bg-card p-3", className)}>
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className="font-mono text-sm tabular-nums">{display}</span>
      </div>
      {source && <div className="mb-2 text-xs text-muted-foreground">{source}</div>}
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange?.(v)}
      />
    </div>
  )
}
