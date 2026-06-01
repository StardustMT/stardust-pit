import { cn } from "@/lib/utils"

/**
 * Visual expression pedal — a hardware-style swell pedal that rotates
 * around its heel pivot as `value` changes from 0 (heel down) to 1
 * (toe down). Designed to read at a glance from playing distance.
 */
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
  const v = Math.max(0, Math.min(1, value))
  // Rotation: 0 → 18deg (heel down, toe lifted), 1 → -10deg (toe down)
  const angle = 18 - v * 28

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      {/* Side view of an EV-5 / FC-7 style expression pedal */}
      <div className="relative h-24 w-32" style={{ perspective: "200px" }}>
        {/* Base plate (heel pivot) */}
        <div
          className="absolute bottom-0 right-0 h-3 w-8 rounded-md"
          style={{
            background: "linear-gradient(180deg, #2a2a30 0%, #15151a 100%)",
            boxShadow: "0 2px 4px rgba(0,0,0,0.4)",
          }}
        />
        {/* The pedal plate, rotating around its right edge (heel) */}
        <div
          className="absolute bottom-3 right-4 h-6 w-28 origin-bottom-right rounded-md"
          style={{
            transform: `rotate(${angle}deg)`,
            background: "linear-gradient(180deg, #5a5a62 0%, #383840 40%, #1c1c22 100%)",
            boxShadow:
              "0 4px 8px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -2px 0 rgba(0,0,0,0.3)",
            transition: "transform 80ms ease-out",
          }}
        >
          {/* Grip ridges */}
          <div className="absolute inset-x-2 top-1.5 flex gap-0.5">
            {Array.from({ length: 14 }).map((_, i) => (
              <span
                key={i}
                className="block h-2 w-px rounded-full"
                style={{ background: "rgba(0,0,0,0.3)" }}
              />
            ))}
          </div>
          {/* LED reflecting current value */}
          <div
            className="absolute right-1 top-1 size-1.5 rounded-full"
            style={{
              background: `color-mix(in oklch, var(--primary) ${20 + v * 80}%, transparent)`,
              boxShadow: v > 0.05 ? "0 0 6px var(--primary)" : undefined,
            }}
          />
        </div>
      </div>
      <div className="flex items-baseline gap-2 font-mono">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className="text-sm font-semibold tabular-nums">{Math.round(v * 100)}%</span>
      </div>
      {binding && (
        <div className="max-w-32 text-center text-xs leading-tight text-muted-foreground">
          {binding}
        </div>
      )}
    </div>
  )
}
