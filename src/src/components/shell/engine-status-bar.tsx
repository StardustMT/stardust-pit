import * as React from "react"
import { Activity, AlertTriangle, AudioLines, Cable } from "lucide-react"
import { cn } from "@/lib/utils"
import { useEngineStatus } from "@/lib/use-engine-status"
import { type EngineSyncState, describeRebindError } from "@/lib/use-engine-sync"
import { enginePanic } from "@/lib/tauri"

/**
 * Real engine status footer (#121, replacing both the EnginePanel strip
 * and the mock StatusBar data): engine state, hosted-plugin summary,
 * audio device + sample rate, open MIDI inputs, dropped-event and
 * sample-rate-mismatch warnings, and the Panic button (Shift+Esc keeps
 * working app-wide; the shortcut listener lives in App).
 */
export function EngineStatusBar({ sync }: { sync?: EngineSyncState }) {
  const status = useEngineStatus()

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Engine status"
      className="flex h-7 items-center gap-0 border-t bg-card-raised px-2 font-mono text-[11px] text-muted-foreground"
    >
      <Cell icon={<Activity className="size-3" />} title="Engine state">
        {sync?.syncError ? (
          <span className="text-destructive">Engine: {sync.syncError.message}</span>
        ) : status.kind === "idle" ? (
          <span>Idle</span>
        ) : status.kind === "error" ? (
          <span className="text-destructive" title={status.messages.join("\n")}>
            Error: {status.messages[0]}
            {status.messages.length > 1 && ` (+${status.messages.length - 1} more)`}
          </span>
        ) : (
          <span className="text-foreground/85">
            Running
            <span className="opacity-60"> · </span>
            <PluginSummary status={status} />
          </span>
        )}
      </Cell>

      {status.kind === "running" && (
        <>
          <GroupBreak />
          <Cell icon={<AudioLines className="size-3" />} title="Audio device">
            {status.audioOutput}
            <span className="opacity-60"> · </span>
            {status.sampleRate / 1000}k / {status.channels}ch
          </Cell>
          <Separator />
          <Cell icon={<Cable className="size-3" />} title="Open MIDI inputs">
            {status.midiInputs.length === 0 ? (
              "no MIDI inputs"
            ) : (
              <span title={status.midiInputs.join("\n")}>
                {status.midiInputs.length === 1
                  ? status.midiInputs[0]
                  : `${status.midiInputs.length} MIDI inputs`}
              </span>
            )}
          </Cell>
          {status.droppedEvents > 0 && (
            <>
              <Separator />
              <Cell icon={<AlertTriangle className="size-3" />} title="Dropped MIDI events">
                <span className="text-warning">{status.droppedEvents} dropped</span>
              </Cell>
            </>
          )}
          {status.sampleRateMismatch && (
            <>
              <Separator />
              <Cell icon={<AlertTriangle className="size-3" />} title="Sample-rate mismatch">
                <span className="text-warning">sample-rate mismatch</span>
              </Cell>
            </>
          )}
        </>
      )}

      {sync?.rebindError && (
        <>
          <GroupBreak />
          <span role="alert" className="truncate text-destructive">
            {describeRebindError(sync.rebindError)}
          </span>
        </>
      )}

      <button
        type="button"
        onClick={() => void enginePanic()}
        title="Flush all held notes + reset controllers (Shift+Esc)"
        className={cn(
          "ml-auto inline-flex h-5 items-center gap-1 rounded bg-destructive px-2 text-[10px] font-bold uppercase tracking-wider text-destructive-foreground",
          "hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive",
        )}
      >
        <AlertTriangle className="size-3" />
        Panic
      </button>
    </div>
  )
}

function PluginSummary({
  status,
}: {
  status: Extract<ReturnType<typeof useEngineStatus>, { kind: "running" }>
}) {
  const parts: string[] = []
  if (status.plugins.length === 1) parts.push(status.plugins[0].name)
  else if (status.plugins.length > 1) parts.push(`${status.plugins.length} plugins`)
  const n = status.nativeNodes
  const native =
    (n.testTone ?? 0) + (n.eq ?? 0) + (n.audioMix ?? 0) + (n.midiTranspose ?? 0) + (n.midiMix ?? 0)
  if (native > 0) parts.push(`${native} native`)
  if (parts.length === 0) return <span className="italic">no instruments</span>
  return (
    <span title={status.plugins.map((p) => `${p.name} (${p.vendor})`).join("\n")}>
      {parts.join(" · ")}
    </span>
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
    <span title={title} className="flex items-center gap-1.5 rounded px-2 py-0.5">
      <span className="opacity-70">{icon}</span>
      {children}
    </span>
  )
}

function Separator() {
  return <span aria-hidden className="mx-px h-3 w-px bg-border" />
}

function GroupBreak() {
  return <span aria-hidden className="mx-2 h-4 w-px bg-border/60" />
}
