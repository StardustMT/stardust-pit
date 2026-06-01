import { cn } from "@/lib/utils"
import { SIGNAL_DEFAULT_COLORS, type Port } from "./_types"

export interface PatchPortProps {
  port: Port
  /** True while a wire is being drawn from/to this port — visually emphasizes it. */
  highlighted?: boolean
  /** True if this port has an existing connection. */
  connected?: boolean
  className?: string
}

/**
 * A single port handle (small circle) shown on a node edge. Color matches the
 * signal kind. Outputs sit on the right edge, inputs on the left — orientation
 * is the caller's responsibility (the node body lays them out).
 */
export function PatchPort({ port, highlighted, connected, className }: PatchPortProps) {
  const color = SIGNAL_DEFAULT_COLORS[port.signal]
  return (
    <div
      className={cn(
        "flex items-center gap-1.5",
        port.direction === "out" ? "flex-row-reverse" : "flex-row",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "block size-2.5 shrink-0 rounded-full border transition-transform",
          highlighted ? "scale-150" : "scale-100",
          connected ? "border-foreground/60" : "border-foreground/30",
        )}
        style={{ background: color }}
      />
      <span
        className={cn(
          "text-[10px] leading-none",
          highlighted ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {port.label}
      </span>
    </div>
  )
}
