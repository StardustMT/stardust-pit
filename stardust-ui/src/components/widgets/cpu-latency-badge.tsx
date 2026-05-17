import * as React from "react"
import { Activity, Cpu, Timer } from "lucide-react"
import { cn } from "@/lib/utils"

export interface CpuLatencyBadgeProps {
  /** CPU usage 0..1 */
  cpu: number
  /** Round-trip audio latency in ms */
  latencyMs: number
  /** Dropouts in last 60 s */
  dropouts?: number
  className?: string
}

function cpuTone(cpu: number) {
  if (cpu >= 0.85) return "text-destructive"
  if (cpu >= 0.65) return "text-amber-400"
  return "text-emerald-400"
}

function latencyTone(ms: number) {
  if (ms >= 20) return "text-destructive"
  if (ms >= 12) return "text-amber-400"
  return "text-emerald-400"
}

export function CpuLatencyBadge({
  cpu,
  latencyMs,
  dropouts = 0,
  className,
}: CpuLatencyBadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-4 rounded-md border bg-card px-3 py-2 font-mono text-xs",
        className,
      )}
    >
      <span className="flex items-center gap-1.5">
        <Cpu className="size-3.5 text-muted-foreground" />
        <span className={cpuTone(cpu)}>{Math.round(cpu * 100)}%</span>
      </span>
      <span className="flex items-center gap-1.5">
        <Timer className="size-3.5 text-muted-foreground" />
        <span className={latencyTone(latencyMs)}>{latencyMs.toFixed(1)} ms</span>
      </span>
      {dropouts > 0 && (
        <span className="flex items-center gap-1.5 text-destructive">
          <Activity className="size-3.5" />
          {dropouts}
        </span>
      )}
    </div>
  )
}
