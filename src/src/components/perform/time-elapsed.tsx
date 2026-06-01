import { cn } from "@/lib/utils"

export interface TimeElapsedProps {
  /** Seconds since current Song started */
  seconds: number
  /** Optional total length for showing progress */
  totalSeconds?: number
  className?: string
}

function format(sec: number) {
  const s = Math.max(0, Math.floor(sec))
  const mm = Math.floor(s / 60)
    .toString()
    .padStart(2, "0")
  const ss = (s % 60).toString().padStart(2, "0")
  return `${mm}:${ss}`
}

export function TimeElapsed({ seconds, totalSeconds, className }: TimeElapsedProps) {
  const remaining = totalSeconds != null ? totalSeconds - seconds : null
  return (
    <div className={cn("flex items-baseline gap-2 font-mono tabular-nums", className)}>
      <span className="text-2xl font-semibold">{format(seconds)}</span>
      {remaining != null && (
        <span className="text-xs text-muted-foreground">−{format(remaining)}</span>
      )}
    </div>
  )
}
