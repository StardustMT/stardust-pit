import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { getPluginChoice } from "@/components/patch-graph/_types"
import { usePluginScan } from "@/lib/use-plugin-scan"
import { useShowStore } from "@/state/show-store"
import {
  type AudioOutputInfo,
  type EngineStartError,
  type EngineStatus,
  type HostedPluginStatus,
  type MidiInputInfo,
  type NativeNodeCounts,
  type PatchWire,
  asEngineStartError,
  engineStartFromPatch,
  engineStatus,
  engineStop,
  isTauri,
  listAudioOutputs,
  listMidiInputs,
  onEngineStatus,
} from "@/lib/tauri"

/**
 * Diagnostic engine routing panel. The engine is always-on: it hosts
 * whatever the currently-selected patch points at and stops itself when
 * the patch has no instruments at all. Since v0.8b the engine consumes
 * the whole patch graph (multi-plugin chains + native DSP), not just
 * the first instrument node. The status line lists every hosted plugin
 * and a count of native nodes.
 *
 * Hidden when not running inside Tauri (Storybook / web dev).
 */
export function EnginePanel() {
  const inTauri = useMemo(() => isTauri(), [])
  if (!inTauri) return null
  return <EnginePanelInner />
}

function EnginePanelInner() {
  const [midiInputs, setMidiInputs] = useState<MidiInputInfo[]>([])
  const [audioOutputs, setAudioOutputs] = useState<AudioOutputInfo[]>([])
  // "__none__" sentinel = run without a hardware MIDI input. The on-screen
  // keyboard in the Preview tab still drives the plugin via engine_send_midi.
  const [midiInput, setMidiInput] = useState<string>("__none__")
  const [audioOutput, setAudioOutput] = useState<string>("__default__")
  const [status, setStatus] = useState<EngineStatus>({ kind: "idle" })
  const [syncError, setSyncError] = useState<EngineStartError | undefined>()

  const { refresh: refreshPluginScan } = usePluginScan()

  // Pull the raw fields and resolve the current patch in render — the
  // engine command needs the full patch (graph + meta) on Start.
  const songs = useShowStore((s) => s.songs)
  const currentPatchId = useShowStore((s) => s.currentPatchId)
  const currentPatch: PatchWire | undefined = useMemo(() => {
    if (!currentPatchId) return undefined
    for (const song of songs) {
      const p = song.patches.find((p) => p.id === currentPatchId)
      if (p) return p
    }
    return undefined
  }, [songs, currentPatchId])

  // Plan signature: includes every instrument node's choice. Used to
  // decide whether the engine should be on AND whether to rebind when
  // a plugin pick changes. Adds/removes of effects (eq, mix) don't
  // rebind today — switch patches to reload.
  const planSignature = useMemo(() => {
    if (!currentPatch) return undefined
    const parts: string[] = []
    for (const n of currentPatch.graph.nodes) {
      if (n.kind === "instrument.plugin") {
        const c = getPluginChoice(n)
        parts.push(c ? `plug:${c.bundlePath}|${c.pluginId}` : `plug:unconfigured`)
      } else if (n.kind === "instrument.testtone") {
        parts.push(`testtone`)
      }
    }
    return parts.length === 0 ? undefined : parts.join(";")
  }, [currentPatch])

  useEffect(() => {
    void refreshDevices(setMidiInputs, setAudioOutputs)
  }, [])

  // Initial status pull + subscribe to changes.
  const unlistenRef = useRef<(() => void) | null>(null)
  useEffect(() => {
    let alive = true
    void engineStatus().then((s) => alive && setStatus(s))
    void onEngineStatus((s) => alive && setStatus(s)).then((u) => {
      if (!alive) {
        u()
        return
      }
      unlistenRef.current = u
    })
    return () => {
      alive = false
      unlistenRef.current?.()
      unlistenRef.current = null
    }
  }, [])

  // Auto-pick the first hardware MIDI input once devices load.
  useEffect(() => {
    if (midiInput === "__none__" && midiInputs.length > 0) {
      setMidiInput(midiInputs[0].name)
    }
  }, [midiInputs, midiInput])

  // Sync the engine to the desired state. Always-on: if the patch has
  // any hostable instrument the engine runs; otherwise we stop.
  const lastSyncRef = useRef<{
    patchId: string | undefined
    signature: string | undefined
    midiInput: string
    audioOutput: string
  } | null>(null)

  useEffect(() => {
    const want = {
      patchId: currentPatch?.id,
      signature: planSignature,
      midiInput,
      audioOutput,
    }
    const prev = lastSyncRef.current
    if (
      prev &&
      prev.patchId === want.patchId &&
      prev.signature === want.signature &&
      prev.midiInput === want.midiInput &&
      prev.audioOutput === want.audioOutput
    ) {
      return
    }
    lastSyncRef.current = want

    let cancelled = false
    void (async () => {
      setSyncError(undefined)
      if (!currentPatch || !planSignature) {
        try {
          await engineStop()
        } catch {
          // Engine status feed reflects whatever actually happened.
        }
        return
      }
      try {
        await engineStartFromPatch({
          patch: currentPatch,
          midiInput: midiInput === "__none__" ? null : midiInput,
          audioOutput: audioOutput === "__default__" ? null : audioOutput,
        })
      } catch (e) {
        if (!cancelled) setSyncError(asEngineStartError(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [currentPatch, planSignature, midiInput, audioOutput])

  return (
    <div className="border-b border-border bg-muted/40 px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Engine
        </span>

        <PatchChip patchName={currentPatch?.name} signature={planSignature} />

        <select
          className="rounded border bg-background px-2 py-1 text-xs"
          value={midiInput}
          onChange={(e) => setMidiInput(e.target.value)}
          title="MIDI input device. Pick 'On-screen keyboard only' to play from the Preview tab."
        >
          <option value="__none__">On-screen keyboard only</option>
          {midiInputs.map((m) => (
            <option key={m.name} value={m.name}>
              {m.name}
            </option>
          ))}
        </select>

        <select
          className="rounded border bg-background px-2 py-1 text-xs"
          value={audioOutput}
          onChange={(e) => setAudioOutput(e.target.value)}
        >
          <option value="__default__">Default output</option>
          {audioOutputs.map((o) => (
            <option key={o.name} value={o.name}>
              {o.name}
              {o.isDefault ? " (default)" : ""}
            </option>
          ))}
        </select>

        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            void refreshDevices(setMidiInputs, setAudioOutputs)
            void refreshPluginScan()
          }}
          title="Re-scan plugins + devices"
        >
          Refresh
        </Button>

        <div className="ml-auto">
          <StatusLine status={status} syncError={syncError} />
        </div>
      </div>
    </div>
  )
}

function PatchChip({
  patchName,
  signature,
}: {
  patchName: string | undefined
  signature: string | undefined
}) {
  return (
    <div className="flex items-center gap-1.5 rounded border bg-background px-2 py-1 text-xs">
      <span className="text-muted-foreground">Patch:</span>
      <span className="font-medium">{patchName ?? "—"}</span>
      <span className="text-muted-foreground">·</span>
      <span className={signature ? "font-medium" : "italic text-muted-foreground"}>
        {signature ? "ready" : "no instruments"}
      </span>
    </div>
  )
}

function StatusLine({
  status,
  syncError,
}: {
  status: EngineStatus
  syncError: EngineStartError | undefined
}) {
  if (syncError) {
    return <span className="text-xs text-destructive">{describeStartError(syncError)}</span>
  }
  if (status.kind === "idle") {
    return <span className="text-xs text-muted-foreground">Idle</span>
  }
  if (status.kind === "error") {
    return (
      <span className="text-xs text-destructive" title={status.messages.join("\n")}>
        Error: {status.messages[0]}
        {status.messages.length > 1 && ` (+${status.messages.length - 1} more)`}
      </span>
    )
  }
  return (
    <span className="text-xs text-muted-foreground">
      <span className="font-medium text-foreground">Running</span> ·{" "}
      <PluginList plugins={status.plugins} />
      <NativeSummary counts={status.nativeNodes} />
      <span>
        {" "}
        · {status.audioOutput} @ {status.sampleRate / 1000} kHz / {status.channels}ch
      </span>
      {status.droppedEvents > 0 && (
        <span className="ml-2 text-amber-600">⚠ {status.droppedEvents} dropped</span>
      )}
      {status.sampleRateMismatch && (
        <span className="ml-2 text-amber-600">⚠ sample-rate mismatch</span>
      )}
    </span>
  )
}

function PluginList({ plugins }: { plugins: HostedPluginStatus[] | undefined }) {
  const list = plugins ?? []
  if (list.length === 0) return <span className="italic">no plugins</span>
  if (list.length === 1) {
    return <span>{list[0].name}</span>
  }
  return (
    <span title={list.map((p) => `${p.name} (${p.vendor})`).join("\n")}>
      {list.length} plugins ({list.map((p) => p.name).join(", ")})
    </span>
  )
}

function NativeSummary({ counts }: { counts: NativeNodeCounts | undefined }) {
  if (!counts) return null
  const parts: string[] = []
  if ((counts.testTone ?? 0) > 0) parts.push(`${counts.testTone} testtone`)
  if ((counts.eq ?? 0) > 0) parts.push(`${counts.eq} EQ`)
  if ((counts.audioMix ?? 0) > 0) parts.push(`${counts.audioMix} mix`)
  if ((counts.midiTranspose ?? 0) > 0) parts.push(`${counts.midiTranspose} transpose`)
  if ((counts.midiMix ?? 0) > 0) parts.push(`${counts.midiMix} midi-mix`)
  if (parts.length === 0) return null
  return <span> · {parts.join(", ")}</span>
}

function describeStartError(e: EngineStartError): string {
  return `Engine: ${e.message}`
}

async function refreshDevices(
  setMidi: (m: MidiInputInfo[]) => void,
  setAudio: (a: AudioOutputInfo[]) => void,
) {
  const [midi, audio] = await Promise.all([listMidiInputs(), listAudioOutputs()])
  setMidi(midi)
  setAudio(audio)
}
