import { cn } from "@/lib/utils"

export interface ClickIndicatorProps {
  /** Tempo in BPM */
  bpm: number
  /** Beats per bar */
  beatsPerBar?: number
  /** Current beat (1-indexed) — null when click is stopped */
  currentBeat?: number | null
  /** Time signature numerator/denominator for display only */
  timeSignature?: [number, number]
  className?: string
}

export function ClickIndicator({
  bpm,
  beatsPerBar = 4,
  currentBeat,
  timeSignature = [4, 4],
  className,
}: ClickIndicatorProps) {
  const beats = Array.from({ length: beatsPerBar }, (_, i) => i + 1)
  return (
    <div className={cn("inline-flex items-center gap-3", className)}>
      <div className="flex items-baseline gap-1">
        <span className="font-mono text-2xl font-semibold tabular-nums">{Math.round(bpm)}</span>
        <span className="text-xs text-muted-foreground">bpm</span>
      </div>
      <div className="text-xs text-muted-foreground">
        {timeSignature[0]}/{timeSignature[1]}
      </div>
      <div className="flex items-center gap-1">
        {beats.map((b) => {
          const active = currentBeat === b
          const isDownbeat = b === 1
          return (
            <span
              key={b}
              className={cn(
                "block size-3 rounded-full transition-all",
                active && isDownbeat && "bg-primary shadow-[0_0_12px_var(--primary)]",
                active && !isDownbeat && "bg-accent-foreground/80",
                !active && isDownbeat && "bg-primary/30",
                !active && !isDownbeat && "bg-muted",
              )}
            />
          )
        })}
      </div>
    </div>
  )
}
