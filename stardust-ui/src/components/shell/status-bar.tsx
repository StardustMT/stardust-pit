import * as React from "react"
import { AudioLines, Cable, Cpu, Disc3, Music, Timer } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Persistent status bar at the bottom of the app shell. All the
 * always-on system info that doesn't need its own widget on the canvas:
 * audio device, sample rate / buffer / latency, tempo + transpose,
 * MIDI port count, CPU. Click any cell to deep-link to its settings.
 */

export interface StatusBarProps {
  audioDevice: string
  sampleRate: number
  bufferSize: number
  latencyMs: number
  midiPortCount: number
  bpm: number
  transposeSemitones: number
  cpu: number
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
  bpm,
  transposeSemitones,
  cpu,
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
      {showName && (
        <Cell icon={<Disc3 className="size-3" />} title="Show">
          <span className="text-foreground/85">{showName}</span>
          {songName && (
            <>
              <span className="opacity-60"> · </span>
              <span>{songName}</span>
            </>
          )}
        </Cell>
      )}
      <Separator />
      <Cell icon={<AudioLines className="size-3" />} title="Audio">
        {audioDevice}
        <span className="opacity-60"> · </span>
        {bufferSize} / {sampleRate / 1000}k
      </Cell>
      <Separator />
      <Cell icon={<Timer className="size-3" />} title="Latency">
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
      <Cell icon={<Cable className="size-3" />} title="MIDI ports">
        {midiPortCount} ports
      </Cell>
      <Separator />
      <Cell icon={<Music className="size-3" />} title="Tempo / transpose">
        {Math.round(bpm)} bpm
        <span className="opacity-60"> · </span>
        {transposeSemitones > 0 ? "+" : ""}
        {transposeSemitones} st
      </Cell>

      <div className="flex-1" />

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

function Separator() {
  return <span aria-hidden className="mx-px h-3 w-px bg-border" />
}
