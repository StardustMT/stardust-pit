import * as React from "react"
import { CheckCircle2, Loader2, XCircle, Activity, AudioLines, Blocks } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import {
  type AudioOutputInfo,
  type SelfTestResult,
  engineSelfTest,
  isTauri,
  listAudioOutputs,
  setPluginScanInterval,
} from "@/lib/tauri"
import { usePluginScan } from "@/lib/use-plugin-scan"
import { DEFAULT_OUTPUT, useSettingsStore } from "@/state/settings-store"

/**
 * Engine self-test pass threshold mirrored from the Rust side
 * (`SELF_TEST_THRESHOLD_DBFS`). Used only for explanatory copy — the
 * actual pass/fail decision is made by the engine.
 */
const SELF_TEST_THRESHOLD_DBFS = -24

export interface SettingsScreenProps {
  /**
   * Injectable for Storybook + tests. Defaults to the real Tauri IPC
   * invoker so the live app gets a working diagnostic.
   */
  runSelfTest?: () => Promise<SelfTestResult>
  /** Injectable device enumeration (Storybook mocks; real IPC default). */
  listOutputs?: () => Promise<AudioOutputInfo[]>
}

type RunState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "done"; result: SelfTestResult }
  | { kind: "error"; message: string }

export function SettingsScreen({
  runSelfTest = engineSelfTest,
  listOutputs = listAudioOutputs,
}: SettingsScreenProps) {
  const [state, setState] = React.useState<RunState>({ kind: "idle" })

  const handleRun = React.useCallback(async () => {
    setState({ kind: "running" })
    try {
      const result = await runSelfTest()
      setState({ kind: "done", result })
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : String(e) })
    }
  }, [runSelfTest])

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Application preferences and engine diagnostics.
          </p>
        </header>

        <Separator className="mb-8" />

        <div className="flex flex-col gap-6">
          <AudioCard listOutputs={listOutputs} />
          <PluginsCard />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="size-5 text-primary" />
                Engine self-test
              </CardTitle>
              <CardDescription>
                Plays a high-pitched test tone through a synthetic patch for two seconds and
                measures the loudest 100&nbsp;ms RMS in dBFS. Confirms the audio path is wired
                correctly end-to-end. Pass threshold: {SELF_TEST_THRESHOLD_DBFS}&nbsp;dBFS.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-4">
              <Button onClick={handleRun} disabled={state.kind === "running"}>
                {state.kind === "running" ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Running…
                  </>
                ) : (
                  "Run engine self-test"
                )}
              </Button>
              <SelfTestStatus state={state} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// Audio — output device pick (#117 / #121: this is the picker's home now
// that the EnginePanel strip is gone; changes rebind in place, #1)
// -----------------------------------------------------------------------------

function AudioCard({ listOutputs }: { listOutputs: () => Promise<AudioOutputInfo[]> }) {
  const audioOutput = useSettingsStore((s) => s.audioOutput)
  const setAudioOutput = useSettingsStore((s) => s.setAudioOutput)
  const [outputs, setOutputs] = React.useState<AudioOutputInfo[]>([])

  React.useEffect(() => {
    if (!isTauri()) return
    let alive = true
    void listOutputs().then((o) => alive && setOutputs(o))
    return () => {
      alive = false
    }
  }, [listOutputs])

  const knownSelection =
    audioOutput === DEFAULT_OUTPUT || outputs.some((o) => o.name === audioOutput)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AudioLines className="size-5 text-primary" />
          Audio
        </CardTitle>
        <CardDescription>
          Output device for the engine. Switching swaps the stream in place — no plugin reloads,
          held notes keep sounding.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Label htmlFor="audio-output" className="text-xs">
          Output device
        </Label>
        <select
          id="audio-output"
          className="h-9 w-full max-w-md rounded-md border bg-background px-2 text-sm"
          value={knownSelection ? audioOutput : audioOutput}
          onChange={(e) => setAudioOutput(e.target.value)}
        >
          <option value={DEFAULT_OUTPUT}>System default output</option>
          {outputs.map((o) => (
            <option key={o.name} value={o.name}>
              {o.name}
              {o.isDefault ? " (default)" : ""}
            </option>
          ))}
          {!knownSelection && <option value={audioOutput}>{audioOutput} (disconnected)</option>}
        </select>
        {!isTauri() && (
          <span className="text-xs text-muted-foreground">
            Device enumeration is available in the desktop app.
          </span>
        )}
      </CardContent>
    </Card>
  )
}

// -----------------------------------------------------------------------------
// Plugins — scan cache controls (#4)
// -----------------------------------------------------------------------------

function PluginsCard() {
  const { plugins, loading, error, lastScanAt, rescanNow } = usePluginScan()
  const scanIntervalMin = useSettingsStore((s) => s.scanIntervalMin)
  const setScanIntervalMin = useSettingsStore((s) => s.setScanIntervalMin)

  // Keep the Rust background thread in sync with the persisted setting.
  React.useEffect(() => {
    if (!isTauri()) return
    void setPluginScanInterval(scanIntervalMin)
  }, [scanIntervalMin])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Blocks className="size-5 text-primary" />
          Plugins
        </CardTitle>
        <CardDescription>
          Plugin metadata is cached by file modification time — only new or changed bundles are
          re-scanned. A background pass picks up newly installed plugins automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="scan-interval" className="text-xs">
              Plugin scan interval (minutes)
            </Label>
            <Input
              id="scan-interval"
              type="number"
              min={1}
              max={60}
              value={scanIntervalMin}
              onChange={(e) => setScanIntervalMin(Number(e.target.value))}
              className="h-9 w-24"
            />
          </div>
          <Button variant="outline" onClick={() => void rescanNow()} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Scanning…
              </>
            ) : (
              "Rescan now"
            )}
          </Button>
        </div>
        <div aria-live="polite" className="text-xs text-muted-foreground">
          {error ? (
            <span className="text-destructive">Scan failed: {error}</span>
          ) : (
            <>
              {plugins.length} plugin{plugins.length === 1 ? "" : "s"} in the library
              {lastScanAt !== undefined && (
                <> · last scanned {new Date(lastScanAt).toLocaleTimeString()}</>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function SelfTestStatus({ state }: { state: RunState }) {
  if (state.kind === "idle") {
    return <span className="text-sm text-muted-foreground">Not run yet.</span>
  }
  if (state.kind === "running") {
    return <span className="text-sm text-muted-foreground">Rendering 2 s of audio…</span>
  }
  if (state.kind === "error") {
    return (
      <span
        role="alert"
        aria-live="polite"
        className="flex items-center gap-2 text-sm text-destructive"
      >
        <XCircle className="size-4" />
        {state.message}
      </span>
    )
  }
  const { peakRmsDbfs, passed } = state.result
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-center gap-2 text-sm",
        passed ? "text-emerald-500" : "text-destructive",
      )}
    >
      {passed ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
      {passed ? "Passed" : "Failed"} · peak RMS&nbsp;
      {Number.isFinite(peakRmsDbfs) ? `${peakRmsDbfs.toFixed(1)} dBFS` : "−∞ dBFS"}
    </span>
  )
}
