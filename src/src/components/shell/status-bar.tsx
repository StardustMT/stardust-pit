import * as React from "react"
import { AudioLines, Cable, Cpu, Disc3, MemoryStick, Timer } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Persistent status bar at the bottom of the app shell. Top-level
 * SYSTEM info only — anything song-specific (tempo, transpose, key)
 * belongs on the canvas as a widget, not here. Logical grouping:
 *
 *   [ show context ] | [ audio device + buffer + ports ] | [ system perf: latency · CPU · RAM ]
 */

export interface StatusBarProps {
  audioDevice: string
  sampleRate: number
  bufferSize: number
  latencyMs: number
  midiPortCount: number
  /** CPU load, 0..1 */
  cpu: number
  /** Used RAM in MB */
  ramMb: number
  /** Total RAM in MB (for fraction display) */
  ramTotalMb?: number
  showName?: string
  songName?: string
  className?: string
}

export function StatusBar({
  audioDevice,
  sampleRate,
  bufferSize,
  latencyMs,
  midiPortCount,
  cpu,
  ramMb,
  ramTotalMb,
  showName,
  songName,
  className,
}: StatusBarProps) {
  return (
    <div
      className={cn(
        "flex h-7 items-center gap-0 border-t bg-card-raised px-2 font-mono text-[11px] text-muted-foreground",
        className,
      )}
    >
      {/* ── Show context ──────────────────────────────────────────── */}
      {showName && (
        <>
          <Cell icon={<Disc3 className="size-3" />} title="Show">
            <span className="text-foreground/85">{showName}</span>
            {songName && (
              <>
                <span className="opacity-60"> · </span>
                <span>{songName}</span>
              </>
            )}
          </Cell>
          <GroupBreak />
        </>
      )}

      {/* ── Audio I/O ─────────────────────────────────────────────── */}
      <Cell icon={<AudioLines className="size-3" />} title="Audio device">
        {audioDevice}
        <span className="opacity-60"> · </span>
        {bufferSize} / {sampleRate / 1000}k
      </Cell>
      <Separator />
      <Cell icon={<Cable className="size-3" />} title="MIDI ports">
        {midiPortCount} ports
      </Cell>

      <GroupBreak />

      {/* ── System performance: latency + CPU + RAM ───────────────── */}
      <Cell icon={<Timer className="size-3" />} title="Audio latency">
        <span
          className={cn(
            latencyMs > 20 && "text-destructive",
            latencyMs > 12 && latencyMs <= 20 && "text-warning",
          )}
        >
          {latencyMs.toFixed(1)} ms
        </span>
      </Cell>
      <Separator />
      <Cell icon={<Cpu className="size-3" />} title="CPU">
        <span
          className={cn(
            cpu >= 0.85 && "text-destructive",
            cpu >= 0.65 && cpu < 0.85 && "text-warning",
          )}
        >
          {Math.round(cpu * 100)}%
        </span>
      </Cell>
      <Separator />
      <Cell icon={<MemoryStick className="size-3" />} title="Memory">
        {ramTotalMb ? (
          <>
            {(ramMb / 1024).toFixed(1)}
            <span className="opacity-60"> / {(ramTotalMb / 1024).toFixed(0)}</span> GB
          </>
        ) : (
          <>{(ramMb / 1024).toFixed(1)} GB</>
        )}
      </Cell>
    </div>
  )
}

function Cell({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      className="flex items-center gap-1.5 rounded px-2 py-0.5 transition-colors hover:bg-accent hover:text-foreground"
    >
      <span className="opacity-70">{icon}</span>
      {children}
    </button>
  )
}

/** Thin in-group separator between adjacent cells */
function Separator() {
  return <span aria-hidden className="mx-px h-3 w-px bg-border" />
}

/** Wider visual break between groups of related cells */
function GroupBreak() {
  return <span aria-hidden className="mx-2 h-4 w-px bg-border/60" />
}
