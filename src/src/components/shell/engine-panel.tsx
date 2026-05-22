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
 * Diagnostic engine controls. The patch picks the plugin now (per the
 * `instrument.plugin` node in the currently-selected patch); this panel
 * only routes the audio / MIDI endpoints. Start sends the active patch
 * to the Rust side, which walks its graph to find the instrument and
 * brings the plugin online.
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
  const [pending, setPending] = useState(false)
  const [startError, setStartError] = useState<EngineStartError | undefined>()

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

  // Auto-pick the first hardware MIDI input if one's available — keeps
  // Start one-click for users with a controller. Users without one stay
  // on "__none__" and play via the on-screen keyboard.
  useEffect(() => {
    if (midiInput === "__none__" && midiInputs.length > 0) {
      setMidiInput(midiInputs[0].name)
    }
  }, [midiInputs, midiInput])

  const canStart =
    !pending &&
    currentPatch != null &&
    pluginChoice != null &&
    status.kind !== "running"
  const canStop = !pending && status.kind === "running"

  async function start() {
    if (!currentPatch) return
    setPending(true)
    setStartError(undefined)
    try {
      await engineStartFromPatch({
        patch: currentPatch,
        midiInput: midiInput === "__none__" ? null : midiInput,
        audioOutput: audioOutput === "__default__" ? null : audioOutput,
      })
    } catch (e) {
      setStartError(asEngineStartError(e))
    } finally {
      setPending(false)
    }
  }

  async function stop() {
    setPending(true)
    try {
      await engineStop()
    } finally {
      setPending(false)
    }
  }

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
          disabled={status.kind === "running"}
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
          disabled={status.kind === "running"}
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
          onClick={start}
          disabled={!canStart}
          title={
            !currentPatch
              ? "No patch selected"
              : !pluginChoice
                ? "Pick a plugin on the instrument node in the patch editor"
                : undefined
          }
        >
          Start
        </Button>
        <Button size="sm" variant="outline" onClick={stop} disabled={!canStop}>
          Stop
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            void refreshDevices(setMidiInputs, setAudioOutputs)
            void refreshPluginScan()
          }}
          disabled={status.kind === "running"}
          title="Re-scan plugins + devices"
        >
          Refresh
        </Button>

        <div className="ml-auto">
          <StatusLine status={status} startError={startError} />
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
  startError,
}: {
  status: EngineStatus
  startError: EngineStartError | undefined
}) {
  if (startError) {
    return (
      <span className="text-xs text-destructive">
        {describeStartError(startError)}
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
