import * as React from "react"
import { cn } from "@/lib/utils"

export interface ExpressionPedalProps {
  /** 0..1 position */
  value: number
  label?: string
  binding?: string
  className?: string
}

export function ExpressionPedal({
  value,
  label = "EXP",
  binding,
  className,
}: ExpressionPedalProps) {
  const pct = Math.max(0, Math.min(1, value)) * 100
  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div className="relative h-32 w-12 overflow-hidden rounded-md border bg-card">
        <div
          className="absolute bottom-0 left-0 w-full bg-primary transition-[height] duration-75"
          style={{ height: `${pct}%` }}
        />
        <div className="absolute inset-0 flex items-end justify-center pb-1">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-foreground/80">
            {label}
          </span>
        </div>
      </div>
      <div className="text-center font-mono text-xs">{Math.round(pct)}%</div>
      {binding && <div className="text-center text-xs text-muted-foreground">{binding}</div>}
    </div>
  )
}
