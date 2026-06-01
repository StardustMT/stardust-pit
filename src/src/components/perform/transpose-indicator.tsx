import { ArrowDown, ArrowUp, Equal } from "lucide-react"
import { cn } from "@/lib/utils"

export interface TransposeIndicatorProps {
  /** Semitones, can be negative */
  semitones: number
  /** Optional original key for display ("Eb" → "F") */
  fromKey?: string
  toKey?: string
  className?: string
}

export function TransposeIndicator({
  semitones,
  fromKey,
  toKey,
  className,
}: TransposeIndicatorProps) {
  const up = semitones > 0
  const flat = semitones === 0
  const Icon = flat ? Equal : up ? ArrowUp : ArrowDown
  const sign = flat ? "" : up ? "+" : ""
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm",
        flat && "text-muted-foreground",
        className,
      )}
    >
      <Icon className="size-4" />
      <span className="font-mono font-semibold tabular-nums">
        {sign}
        {semitones}
      </span>
      <span className="text-xs text-muted-foreground">st</span>
      {fromKey && toKey && (
        <span className="border-l pl-2 text-xs text-muted-foreground">
          {fromKey} → <span className="font-semibold text-foreground">{toKey}</span>
        </span>
      )}
    </div>
  )
}
