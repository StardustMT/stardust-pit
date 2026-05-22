import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { getPluginChoice } from "@/components/patch-graph/_types"
import { usePluginScan } from "@/lib/use-plugin-scan"
import { useShowStore } from "@/state/show-store"
import {
  type AudioOutputInfo,
  type EngineStartError,
  type EngineStatus,
  type MidiInputInfo,
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
 * whatever the currently-selected patch points at, and stops itself when
 * the patch has no plugin to host. There is no Start/Stop button. The
 * panel exposes the routing knobs (MIDI input, audio output) plus a live
 * status readout. Changing either dropdown rebinds the engine.
 *
 * Hidden when not running inside Tauri (Storybook / web dev) — the
 * commands would fail anyway and the device lists would be empty.
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

  // Subscribe to just enough store state to find the current patch. The
  // engine command needs the full patch (graph + meta) on Start, not a
  // derived selector — so we pull the raw fields and resolve in render.
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
  const pluginChoice = useMemo(() => {
    if (!currentPatch) return undefined
    for (const n of currentPatch.graph.nodes) {
      if (n.kind === "instrument.plugin") {
        const c = getPluginChoice(n)
        if (c) return c
      }
    }
    return undefined
  }, [currentPatch])

  useEffect(() => {
    void refreshDevices(setMidiInputs, setAudioOutputs)
  }, [])

  // Initial status pull + subscribe to changes. The pull catches the
  // case where the engine is already running when the panel mounts
  // (e.g. HMR remount); the listener gets every subsequent change.
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

  // Auto-pick the first hardware MIDI input once devices load — saves the
  // user a dropdown click. Users without a controller stay on "__none__"
  // and play via the on-screen keyboard.
  useEffect(() => {
    if (midiInput === "__none__" && midiInputs.length > 0) {
      setMidiInput(midiInputs[0].name)
    }
  }, [midiInputs, midiInput])

  // Sync the engine to the desired state (always-on model).
  //
  // The desired state is a pure function of (current patch, plugin choice,
  // midi input, audio output). Whenever any input changes:
  //  - If the patch has a hostable plugin → bring up / rebind to it with
  //    the current routing.
  //  - Otherwise → stop the engine (silence when there's nothing to play).
  //
  // The Rust engine's Start command tears down any previous plugin before
  // bringing up the next one, so rebind is just another Start call. A ref
  // tracks the last params we asked for so we skip no-op rebinds when an
  // unrelated dep moves.
  const lastSyncRef = useRef<{
    patchId: string | undefined
    bundlePath: string | undefined
    pluginId: string | undefined
    midiInput: string
    audioOutput: string
  } | null>(null)

  useEffect(() => {
    const want = {
      patchId: currentPatch?.id,
      bundlePath: pluginChoice?.bundlePath,
      pluginId: pluginChoice?.pluginId,
      midiInput,
      audioOutput,
    }
    const prev = lastSyncRef.current
    if (
      prev &&
      prev.patchId === want.patchId &&
      prev.bundlePath === want.bundlePath &&
      prev.pluginId === want.pluginId &&
      prev.midiInput === want.midiInput &&
      prev.audioOutput === want.audioOutput
    ) {
      return
    }
    lastSyncRef.current = want

    let cancelled = false
    void (async () => {
      setSyncError(undefined)
      if (!currentPatch || !pluginChoice) {
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
  }, [currentPatch, pluginChoice, midiInput, audioOutput])

  return (
    <div className="border-b border-border bg-muted/40 px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Engine
        </span>

        <PatchPluginChip
          patchName={currentPatch?.name}
          pluginName={pluginChoice?.pluginName}
        />

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

function PatchPluginChip({
  patchName,
  pluginName,
}: {
  patchName: string | undefined
  pluginName: string | undefined
}) {
  return (
    <div className="flex items-center gap-1.5 rounded border bg-background px-2 py-1 text-xs">
      <span className="text-muted-foreground">Patch:</span>
      <span className="font-medium">{patchName ?? "—"}</span>
      <span className="text-muted-foreground">·</span>
      <span className="text-muted-foreground">Plugin:</span>
      <span
        className={pluginName ? "font-medium" : "italic text-muted-foreground"}
      >
        {pluginName ?? "none"}
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
    return (
      <span className="text-xs text-destructive">
        {describeStartError(syncError)}
      </span>
    )
  }
  if (status.kind === "idle") {
    return <span className="text-xs text-muted-foreground">Idle</span>
  }
  if (status.kind === "error") {
    return (
      <span className="text-xs text-destructive" title={status.message}>
        Error: {status.message}
      </span>
    )
  }
  return (
    <span className="text-xs text-muted-foreground">
      <span className="font-medium text-foreground">Running</span> · {status.pluginName} ·{" "}
      {status.audioOutput} @ {status.sampleRate / 1000} kHz / {status.channels}ch
      {status.droppedEvents > 0 && (
        <span className="ml-2 text-amber-600">⚠ {status.droppedEvents} dropped</span>
      )}
      {status.sampleRateMismatch && (
        <span className="ml-2 text-amber-600">⚠ sample-rate mismatch</span>
      )}
    </span>
  )
}

function describeStartError(e: EngineStartError): string {
  switch (e.kind) {
    case "noInstrumentNode":
      return "This patch has no instrument node. Add one in the editor."
    case "missingPluginConfig":
      return `Pick a plugin on "${e.node}" in the patch editor.`
    case "engine":
      return `Engine: ${e.message}`
  }
}

async function refreshDevices(
  setMidi: (m: MidiInputInfo[]) => void,
  setAudio: (a: AudioOutputInfo[]) => void,
) {
  const [midi, audio] = await Promise.all([
    listMidiInputs(),
    listAudioOutputs(),
  ])
  setMidi(midi)
  setAudio(audio)
}
