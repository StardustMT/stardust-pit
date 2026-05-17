import * as React from "react"
import { GripVertical, Plug, Settings2, Trash2, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"

export interface VstChainRowProps {
  name: string
  format: "VST3" | "CLAP" | "AU"
  active?: boolean
  cpu?: number
  /** True if hosted out-of-process */
  sandboxed?: boolean
  className?: string
}

export function VstChainRow({
  name,
  format,
  active = true,
  cpu,
  sandboxed,
  className,
}: VstChainRowProps) {
  return (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-md border bg-card px-3 py-2 transition-colors",
        active ? "border-border" : "border-border/50 opacity-60",
        className,
      )}
    >
      <GripVertical className="size-4 cursor-grab text-muted-foreground" />
      <div className="grid size-8 place-items-center rounded bg-muted">
        <Plug className="size-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{name}</span>
          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase">
            {format}
          </span>
          {sandboxed && (
            <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[10px] uppercase text-emerald-400 ring-1 ring-emerald-500/30">
              sandboxed
            </span>
          )}
        </div>
        {cpu != null && (
          <div className="font-mono text-xs text-muted-foreground">
            {(cpu * 100).toFixed(1)}% CPU
          </div>
        )}
      </div>
      <button
        className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Open plugin GUI"
      >
        <ExternalLink className="size-4" />
      </button>
      <button
        className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Plugin settings"
      >
        <Settings2 className="size-4" />
      </button>
      <button
        className="rounded p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
        aria-label="Remove plugin"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  )
}
