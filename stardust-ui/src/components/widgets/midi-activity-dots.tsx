import * as React from "react"
import { cn } from "@/lib/utils"

export interface MidiPort {
  name: string
  /** 0..1 — how recently the port saw activity */
  activity: number
}

export interface MidiActivityDotsProps {
  ports: MidiPort[]
  className?: string
}

export function MidiActivityDots({ ports, className }: MidiActivityDotsProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      {ports.map((p) => (
        <div key={p.name} className="flex items-center gap-1.5">
          <span
            className="block size-2 rounded-full transition-opacity"
            style={{
              background: p.activity > 0.05 ? "var(--primary)" : "var(--muted-foreground)",
              opacity: 0.3 + p.activity * 0.7,
              boxShadow: p.activity > 0.5 ? "0 0 8px var(--primary)" : undefined,
            }}
          />
          <span className="text-xs text-muted-foreground">{p.name}</span>
        </div>
      ))}
    </div>
  )
}
