import * as React from "react"
import { cn } from "@/lib/utils"

export interface FootswitchProps {
  /** Display label, e.g. "FS1" or "Advance" */
  label: string
  /** True if depressed */
  active?: boolean
  /** Optional binding hint, e.g. "→ Patch +1" */
  binding?: string
  className?: string
}

export function Footswitch({ label, active, binding, className }: FootswitchProps) {
  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div
        className={cn(
          "relative grid h-20 w-20 place-items-center rounded-full border-4 transition-all",
          active
            ? "border-primary bg-primary text-primary-foreground shadow-[0_0_24px_var(--primary)]"
            : "border-border bg-card text-foreground",
        )}
        data-active={active || undefined}
      >
        <span className="font-mono text-sm font-semibold uppercase">{label}</span>
      </div>
      {binding && (
        <span className="text-center text-xs text-muted-foreground">{binding}</span>
      )}
    </div>
  )
}

export interface FootswitchArrayProps {
  switches: Array<{ label: string; active?: boolean; binding?: string }>
  className?: string
}

export function FootswitchArray({ switches, className }: FootswitchArrayProps) {
  return (
    <div className={cn("flex gap-4", className)}>
      {switches.map((s) => (
        <Footswitch key={s.label} {...s} />
      ))}
    </div>
  )
}
