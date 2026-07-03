import * as React from "react"
import { CheckCircle2, Loader2, XCircle, Activity } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { engineSelfTest, type SelfTestResult } from "@/lib/tauri"

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
}

type RunState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "done"; result: SelfTestResult }
  | { kind: "error"; message: string }

export function SettingsScreen({ runSelfTest = engineSelfTest }: SettingsScreenProps) {
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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="size-5 text-primary" />
              Engine self-test
            </CardTitle>
            <CardDescription>
              Plays a high-pitched test tone through a synthetic patch for two seconds and measures
              the loudest 100&nbsp;ms RMS in dBFS. Confirms the audio path is wired correctly
              end-to-end. Pass threshold: {SELF_TEST_THRESHOLD_DBFS}&nbsp;dBFS.
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
