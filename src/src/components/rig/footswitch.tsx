import { cn } from "@/lib/utils"

/**
 * Visual footswitch — a hardware-style stomp button.
 * Shows pressed state with a depressed "click."
 */
export interface FootswitchProps {
  label: string
  binding?: string
  active?: boolean
  /** "stomp" (large round hardware) or "compact" (smaller pad) */
  variant?: "stomp" | "compact"
  className?: string
}

export function Footswitch({
  label,
  binding,
  active,
  variant = "stomp",
  className,
}: FootswitchProps) {
  if (variant === "compact") {
    return <CompactSwitch label={label} binding={binding} active={active} className={className} />
  }
  return <StompSwitch label={label} binding={binding} active={active} className={className} />
}

function StompSwitch({ label, binding, active, className }: FootswitchProps) {
  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div
        className="relative grid h-24 w-24 place-items-center rounded-full"
        style={{
          background: "radial-gradient(circle at 50% 30%, #4a4a52 0%, #232328 70%, #15151a 100%)",
          boxShadow:
            "0 8px 16px rgba(0,0,0,0.4), inset 0 -2px 0 0 rgba(0,0,0,0.5), inset 0 2px 0 0 rgba(255,255,255,0.05)",
        }}
      >
        <div
          className="absolute inset-1 rounded-full"
          style={{
            background: "linear-gradient(180deg, #2c2c33 0%, #18181d 100%)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
          }}
        />
        <div
          className="relative grid size-16 place-items-center rounded-full transition-transform"
          style={{
            background: active
              ? "radial-gradient(circle at 50% 35%, color-mix(in oklch, var(--primary) 60%, white) 0%, var(--primary) 90%)"
              : "radial-gradient(circle at 50% 35%, #66666e 0%, #3a3a42 60%, #232328 100%)",
            boxShadow: active
              ? "0 0 20px color-mix(in oklch, var(--primary) 60%, transparent), inset 0 -2px 0 0 color-mix(in oklch, var(--primary) 50%, black)"
              : "0 3px 0 0 rgba(0,0,0,0.4), inset 0 -2px 0 0 rgba(0,0,0,0.4)",
            transform: active ? "translateY(2px)" : "translateY(0)",
          }}
        >
          <span
            className="font-mono text-xs font-bold uppercase tracking-wider"
            style={{ color: active ? "white" : "#cdcdd2" }}
          >
            {label}
          </span>
        </div>
        <span
          className="absolute right-2 top-2 size-1.5 rounded-full transition-colors"
          style={{
            background: active ? "var(--primary)" : "#3a3a42",
            boxShadow: active ? "0 0 6px var(--primary)" : undefined,
          }}
        />
      </div>
      {binding && (
        <span className="max-w-24 text-center text-xs leading-tight text-muted-foreground">
          {binding}
        </span>
      )}
    </div>
  )
}

function CompactSwitch({ label, binding, active, className }: FootswitchProps) {
  return (
    <div className={cn("flex items-center gap-2 rounded-lg border bg-card p-2 pr-3", className)}>
      <div
        className="grid size-10 place-items-center rounded-full"
        style={{
          background: active
            ? "radial-gradient(circle at 50% 30%, color-mix(in oklch, var(--primary) 60%, white) 0%, var(--primary) 90%)"
            : "radial-gradient(circle at 50% 30%, #4a4a52 0%, #232328 100%)",
          boxShadow: active
            ? "0 0 12px color-mix(in oklch, var(--primary) 40%, transparent)"
            : "inset 0 -2px 0 0 rgba(0,0,0,0.4)",
        }}
      >
        <span
          className="font-mono text-[10px] font-bold uppercase"
          style={{ color: active ? "white" : "#cdcdd2" }}
        >
          {label}
        </span>
      </div>
      <div className="min-w-0">
        <div className="text-xs font-medium">{label}</div>
        {binding && <div className="truncate text-xs text-muted-foreground">{binding}</div>}
      </div>
    </div>
  )
}

export interface FootswitchArrayProps {
  switches: Array<{ label: string; binding?: string; active?: boolean }>
  variant?: FootswitchProps["variant"]
  className?: string
}

export function FootswitchArray({ switches, variant, className }: FootswitchArrayProps) {
  return (
    <div className={cn("flex flex-wrap items-end gap-4", className)}>
      {switches.map((s) => (
        <Footswitch key={s.label} {...s} variant={variant} />
      ))}
    </div>
  )
}
