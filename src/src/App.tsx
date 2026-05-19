import * as React from "react"
import {
  isTauri,
  listAudioOutputs,
  listClapPlugins,
  listMidiInputs,
  type AudioOutputInfo,
  type ClapPluginInfo,
  type ClapScanError,
  type MidiInputInfo,
} from "@/lib/tauri"

/**
 * v0.2 diagnostic shell: proves the Tauri ↔ stardust-core bridge is
 * alive. Lists the CLAP plugins, MIDI inputs, and audio outputs that
 * the Rust side can see, so you can confirm the host's view of the
 * world matches what's actually plugged in / installed.
 *
 * The real Pit shell (showname, navigation, patch editor, performance
 * surface) lives in Storybook for now and will move in here once we
 * wire the patch graph data model.
 */
export default function App() {
  const inTauri = isTauri()
  if (!inTauri) {
    return (
      <Shell>
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/[0.06] p-4 text-sm">
          <p className="font-semibold text-amber-500">Running outside Tauri</p>
          <p className="mt-1 text-muted-foreground">
            Launch with{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">bun dev</code>{" "}
            to load the Tauri host and see live discovery from
            <code className="ml-1 rounded bg-muted px-1 py-0.5 text-xs">
              stardust-core
            </code>
            .
          </p>
        </div>
      </Shell>
    )
  }
  return (
    <Shell>
      <Diagnostics />
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b px-6 py-4">
        <h1 className="text-2xl font-semibold tracking-tight">Stardust</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          v0.2 — Tauri ↔ stardust-core bridge
        </p>
      </header>
      <main className="mx-auto max-w-5xl space-y-6 px-6 py-6">{children}</main>
    </div>
  )
}

function Diagnostics() {
  const plugins = useDiscoveredPlugins()
  const midi = useDiscoveredMidi()
  const audio = useDiscoveredAudio()

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
      <Card title="CLAP plugins" count={plugins.data?.plugins.length}>
        <AsyncContent state={plugins}>
          {(data) => <PluginList plugins={data.plugins} errors={data.errors} />}
        </AsyncContent>
      </Card>
      <Card title="MIDI inputs" count={midi.data?.length}>
        <AsyncContent state={midi}>
          {(data) => <MidiList inputs={data} />}
        </AsyncContent>
      </Card>
      <Card title="Audio outputs" count={audio.data?.length}>
        <AsyncContent state={audio}>
          {(data) => <AudioList outputs={data} />}
        </AsyncContent>
      </Card>
    </div>
  )
}

// =============================================================================
// Async helpers
// =============================================================================

interface AsyncState<T> {
  data?: T
  error?: string
  loading: boolean
  reload: () => void
}

function useAsync<T>(fetcher: () => Promise<T>): AsyncState<T> {
  const [data, setData] = React.useState<T | undefined>(undefined)
  const [error, setError] = React.useState<string | undefined>(undefined)
  const [loading, setLoading] = React.useState<boolean>(true)
  const run = React.useCallback(() => {
    setLoading(true)
    setError(undefined)
    fetcher()
      .then((d) => {
        setData(d)
        setLoading(false)
      })
      .catch((e) => {
        setError(typeof e === "string" ? e : (e?.message ?? String(e)))
        setLoading(false)
      })
  }, [fetcher])
  React.useEffect(() => {
    run()
  }, [run])
  return { data, error, loading, reload: run }
}

function useDiscoveredPlugins() {
  return useAsync(listClapPlugins)
}
function useDiscoveredMidi() {
  return useAsync(listMidiInputs)
}
function useDiscoveredAudio() {
  return useAsync(listAudioOutputs)
}

function AsyncContent<T>({
  state,
  children,
}: {
  state: AsyncState<T>
  children: (data: T) => React.ReactNode
}) {
  if (state.loading && !state.data) {
    return <p className="text-xs text-muted-foreground">Loading…</p>
  }
  if (state.error) {
    return (
      <div className="space-y-2 text-xs">
        <p className="text-destructive">{state.error}</p>
        <button
          type="button"
          onClick={state.reload}
          className="rounded border px-2 py-1 text-xs hover:bg-muted/40"
        >
          Retry
        </button>
      </div>
    )
  }
  return <>{state.data ? children(state.data) : null}</>
}

// =============================================================================
// Presentational
// =============================================================================

function Card({
  title,
  count,
  children,
}: {
  title: string
  count?: number
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <header className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">{title}</h2>
        {typeof count === "number" && (
          <span className="font-mono text-xs text-muted-foreground">
            {count}
          </span>
        )}
      </header>
      {children}
    </section>
  )
}

function PluginList({
  plugins,
  errors,
}: {
  plugins: ClapPluginInfo[]
  errors: ClapScanError[]
}) {
  if (plugins.length === 0) {
    return <Empty>No CLAP plugins on the standard search paths.</Empty>
  }
  return (
    <div className="space-y-1.5">
      {plugins.map((p) => (
        <div
          key={`${p.bundlePath}::${p.id}`}
          className="rounded-md border bg-background px-2.5 py-2 text-xs"
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate font-semibold">{p.name}</span>
            <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
              {p.version}
            </span>
          </div>
          <div className="truncate text-[10px] text-muted-foreground">
            {p.vendor || "—"} · {p.id}
          </div>
          {p.features.length > 0 && (
            <div className="mt-1 truncate font-mono text-[10px] text-muted-foreground/80">
              {p.features.join(", ")}
            </div>
          )}
        </div>
      ))}
      {errors.length > 0 && (
        <details className="mt-2 text-[10px] text-muted-foreground">
          <summary className="cursor-pointer">
            {errors.length} bundle{errors.length === 1 ? "" : "s"} failed to load
          </summary>
          <ul className="mt-1 space-y-0.5 pl-4">
            {errors.map((e) => (
              <li key={e.path} className="truncate">
                <span className="text-foreground">{e.path}</span> — {e.message}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

function MidiList({ inputs }: { inputs: MidiInputInfo[] }) {
  if (inputs.length === 0) {
    return <Empty>No MIDI input ports detected.</Empty>
  }
  return (
    <ul className="space-y-1.5">
      {inputs.map((m) => (
        <li
          key={m.name}
          className="truncate rounded-md border bg-background px-2.5 py-2 text-xs"
        >
          {m.name}
        </li>
      ))}
    </ul>
  )
}

function AudioList({ outputs }: { outputs: AudioOutputInfo[] }) {
  if (outputs.length === 0) {
    return <Empty>No audio outputs detected.</Empty>
  }
  return (
    <ul className="space-y-1.5">
      {outputs.map((a) => (
        <li
          key={a.name}
          className="flex items-baseline justify-between gap-2 rounded-md border bg-background px-2.5 py-2 text-xs"
        >
          <span className="truncate">{a.name}</span>
          {a.isDefault && (
            <span className="shrink-0 rounded bg-primary/15 px-1 text-[10px] uppercase tracking-wider text-primary">
              default
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border border-dashed bg-muted/20 px-3 py-3 text-xs text-muted-foreground">
      {children}
    </p>
  )
}
