import { cn } from "@/lib/utils"

export interface VuMeterProps {
  /** -inf..0 in dBFS. Pass -Infinity for silence. */
  levelDb: number
  /** Peak hold in dBFS */
  peakDb?: number
  /** Optional clipping flag */
  clipping?: boolean
  /** Vertical (default) or horizontal layout */
  orientation?: "vertical" | "horizontal"
  className?: string
}

const MIN_DB = -60

function dbToPercent(db: number) {
  if (!isFinite(db)) return 0
  const clamped = Math.max(MIN_DB, Math.min(0, db))
  return ((clamped - MIN_DB) / -MIN_DB) * 100
}

function levelColour(db: number) {
  if (db >= -3) return "var(--destructive)"
  if (db >= -12) return "rgb(245 158 11)" // amber-500
  return "rgb(16 185 129)" // emerald-500
}

export function VuMeter({
  levelDb,
  peakDb,
  clipping = false,
  orientation = "vertical",
  className,
}: VuMeterProps) {
  const pct = dbToPercent(levelDb)
  const peakPct = peakDb != null ? dbToPercent(peakDb) : null
  const colour = levelColour(levelDb)

  if (orientation === "horizontal") {
    return (
      <div
        className={cn("relative h-3 w-full overflow-hidden rounded-sm bg-muted", className)}
        role="meter"
        aria-valuenow={pct}
      >
        <div
          className="absolute left-0 top-0 h-full transition-[width] duration-75"
          style={{ width: `${pct}%`, background: colour }}
        />
        {peakPct != null && (
          <div
            className="absolute top-0 h-full w-px bg-foreground/60"
            style={{ left: `${peakPct}%` }}
          />
        )}
        {clipping && <div className="absolute inset-y-0 right-0 w-1 bg-destructive" />}
      </div>
    )
  }

  return (
    <div
      className={cn("relative h-32 w-3 overflow-hidden rounded-sm bg-muted", className)}
      role="meter"
      aria-valuenow={pct}
    >
      <div
        className="absolute bottom-0 left-0 w-full transition-[height] duration-75"
        style={{ height: `${pct}%`, background: colour }}
      />
      {peakPct != null && (
        <div
          className="absolute left-0 h-px w-full bg-foreground/70"
          style={{ bottom: `${peakPct}%` }}
        />
      )}
      {clipping && <div className="absolute inset-x-0 top-0 h-1 bg-destructive" />}
    </div>
  )
}

export interface StereoVuMeterProps {
  left: number
  right: number
  leftPeak?: number
  rightPeak?: number
  className?: string
}

export function StereoVuMeter({ left, right, leftPeak, rightPeak, className }: StereoVuMeterProps) {
  return (
    <div className={cn("flex items-end gap-1", className)}>
      <VuMeter levelDb={left} peakDb={leftPeak} />
      <VuMeter levelDb={right} peakDb={rightPeak} />
    </div>
  )
}
