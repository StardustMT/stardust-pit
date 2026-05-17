import type { Meta, StoryObj } from "@storybook/react"
import * as React from "react"
import { Play, Sparkles, X } from "lucide-react"
import { AppMenuBar } from "./app-menu-bar"
import { NavRail, type NavId } from "./nav-rail"
import { ModeSwitcher, type AppMode } from "./mode-switcher"
import { StatusBar } from "./status-bar"
import { ShowOutline } from "@/components/widgets/show-outline"
import { Button } from "@/components/ui/button"

const meta: Meta = {
  title: "Shell/App Shell",
  parameters: { layout: "fullscreen" },
}
export default meta
type Story = StoryObj

const HAMILTON_ACT_ONE = [
  {
    id: "1",
    number: 1,
    name: "Alexander Hamilton",
    patches: [
      { id: "1.1", number: 1, name: "Strings intro" },
      { id: "1.2", number: 2, name: "Verse pad", compound: true },
      { id: "1.3", number: 3, name: "Pre-chorus build", compound: true },
      { id: "1.4", number: 4, name: "Chorus brass" },
      { id: "1.5", number: 5, name: "Outro pad" },
    ],
  },
  {
    id: "2",
    number: 2,
    name: "Aaron Burr, Sir",
    patches: [
      { id: "2.1", number: 1, name: "Burr's piano" },
      { id: "2.2", number: 2, name: "Group entrance" },
      { id: "2.3", number: 3, name: "Verse two" },
      { id: "2.4", number: 4, name: "Outro" },
    ],
  },
  {
    id: "3",
    number: 3,
    name: "My Shot",
    patches: [
      { id: "3.1", number: 1, name: "Intro strings" },
      { id: "3.2", number: 2, name: "Verse split", compound: true },
      { id: "3.3", number: 3, name: "Pre-chorus lift", compound: true },
      { id: "3.4", number: 4, name: "Chorus brass" },
      { id: "3.5", number: 5, name: "Bridge synth" },
      { id: "3.6", number: 6, name: "Outro pad" },
    ],
  },
  {
    id: "4",
    number: 4,
    name: "The Story of Tonight",
    patches: [
      { id: "4.1", number: 1, name: "Pad" },
      { id: "4.2", number: 2, name: "Strings" },
      { id: "4.3", number: 3, name: "Outro" },
    ],
  },
  {
    id: "5",
    number: 5,
    name: "The Schuyler Sisters",
    patches: [
      { id: "5.1", number: 1, name: "Pulse synth" },
      { id: "5.2", number: 2, name: "Verse split", compound: true },
      { id: "5.3", number: 3, name: "Pre-chorus" },
      { id: "5.4", number: 4, name: "Chorus" },
      { id: "5.5", number: 5, name: "Outro brass" },
    ],
  },
  {
    id: "6",
    number: 6,
    name: "Farmer Refuted",
    patches: [
      { id: "6.1", number: 1, name: "Seabury's piano" },
      { id: "6.2", number: 2, name: "Hamilton's response" },
      { id: "6.3", number: 3, name: "Tutti" },
      { id: "6.4", number: 4, name: "Out" },
    ],
  },
]

function ContextPanelFrame({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col gap-2">
      <div className="px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  )
}

function InspectorFrame({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col gap-2">
      <div className="px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Inspector · {label}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  )
}

function Placeholder({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-card/30 p-6 text-center text-muted-foreground">
      <div className="text-[10px] uppercase tracking-[0.18em]">{title}</div>
      <div className="max-w-sm text-sm leading-relaxed">{body}</div>
    </div>
  )
}

function navLabel(id: NavId): string {
  switch (id) {
    case "outline":
      return "Show outline"
    case "library":
      return "Patches"
    case "instruments":
      return "Instruments"
    case "effects":
      return "Effects"
    case "midi":
      return "MIDI"
    case "audio":
      return "Audio"
    case "shows":
      return "Shows"
    case "settings":
      return "Settings"
  }
}

function Shell({
  nav,
  setNav,
  mode,
  setMode,
  perform,
  contextPanel,
  inspector,
  canvas,
  showName,
  songName,
  onGoLive,
}: {
  nav: NavId
  setNav: (n: NavId) => void
  mode: AppMode
  setMode: (m: AppMode) => void
  /** When true and mode === "perform", render the Go Live affordance */
  perform?: boolean
  contextPanel: React.ReactNode
  inspector: React.ReactNode
  canvas: React.ReactNode
  showName?: string
  songName?: string
  onGoLive?: () => void
}) {
  return (
    <div className="dark grid h-screen w-screen grid-rows-[auto_auto_1fr_auto] bg-background text-foreground">
      <AppMenuBar
        brand={
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-primary" />
            Stardust
          </span>
        }
      />

      <div className="flex h-12 items-center justify-between border-b bg-background px-3">
        <div className="flex items-center gap-3">
          <ModeSwitcher mode={mode} onChange={setMode} />
          <div className="hidden h-5 w-px bg-border md:block" />
          <nav className="hidden text-xs text-muted-foreground md:flex md:items-center md:gap-1">
            <span>{showName ?? "Untitled Show"}</span>
            <span className="opacity-50">/</span>
            <span className="text-foreground">{songName ?? "—"}</span>
          </nav>
        </div>
        {perform && (
          <Button onClick={onGoLive} className="gap-2">
            <Play className="size-4 fill-current" />
            Go Live
          </Button>
        )}
      </div>

      <div className="grid grid-cols-[3.5rem_280px_1fr_320px] overflow-hidden">
        <NavRail active={nav} onSelect={setNav} />
        <aside className="overflow-hidden border-r bg-background p-3">{contextPanel}</aside>
        <main className="overflow-hidden bg-background">{canvas}</main>
        <aside className="overflow-hidden border-l bg-background p-3">{inspector}</aside>
      </div>

      <StatusBar
        showName={showName}
        songName={songName}
        audioDevice="Focusrite Scarlett 18i20"
        sampleRate={48000}
        bufferSize={128}
        latencyMs={7.8}
        midiPortCount={4}
        cpu={0.42}
        ramMb={5_400}
        ramTotalMb={32_768}
      />
    </div>
  )
}

function LiveFullscreen({
  onExit,
  showName,
  songName,
}: {
  onExit: () => void
  showName: string
  songName: string
}) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onExit()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onExit])

  return (
    <div className="dark fixed inset-0 z-50 grid grid-cols-[320px_1fr] gap-3 bg-background p-3 text-foreground">
      <ShowOutline
        showName={showName}
        songs={HAMILTON_ACT_ONE}
        currentSongId="3"
        currentPatchId="3.2"
        mode="live"
        className="h-full"
      />
      <div className="relative flex h-full flex-col items-center justify-center rounded-xl border border-primary/30 bg-card/40">
        <div className="text-xs uppercase tracking-[0.2em] text-primary">Live · fullscreen</div>
        <div className="mt-2 text-2xl font-semibold tracking-tight">{showName}</div>
        <div className="mt-1 text-lg text-muted-foreground">{songName}</div>
        <div className="mt-8 max-w-md rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          The configured Live canvas renders here. App chrome (menu bar, nav rail, status
          bar, inspector) is hidden so the player's attention is on the canvas only.
          <br />
          <br />
          Exit Live with{" "}
          <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">Esc</kbd>{" "}
          or the button.
        </div>
        <button
          onClick={onExit}
          className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-md border bg-card px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" />
          Exit Live
        </button>
      </div>
    </div>
  )
}

function CanvasFor({ mode, songName, patchName }: { mode: AppMode; songName?: string; patchName?: string }) {
  if (mode === "program") {
    return (
      <Placeholder
        title="Program canvas"
        body={`Selected: ${songName ?? "—"} → ${patchName ?? "—"}. Patch signal chain (Instrument → FX → Output) lands here. Click a block to surface its parameters in the Inspector.`}
      />
    )
  }
  return (
    <Placeholder
      title="Perform · layout editor"
      body="Drag-and-resize widget grid for the Live canvas. Default layout is Show-wide; override per Song / Patch via the Inspector. Click Go Live (top right) to fullscreen this layout."
    />
  )
}

function ContextPanelForMode({ nav }: { nav: NavId; mode: AppMode }) {
  if (nav === "outline") {
    return (
      <ContextPanelFrame label="Show outline">
        <ShowOutline
          showName="Hamilton — 2026 Tour"
          songs={HAMILTON_ACT_ONE}
          currentSongId="3"
          currentPatchId="3.2"
          mode="edit"
          className="h-full"
        />
      </ContextPanelFrame>
    )
  }
  return (
    <ContextPanelFrame label={navLabel(nav)}>
      <Placeholder
        title={navLabel(nav)}
        body={`The ${navLabel(nav).toLowerCase()} panel lands in a future iteration.`}
      />
    </ContextPanelFrame>
  )
}

function InspectorForMode({ mode }: { mode: AppMode }) {
  if (mode === "program") {
    return (
      <InspectorFrame label="Patch · Verse split">
        <Placeholder
          title="Patch properties"
          body="Compound patch with 2 parts (Wurli Bass + Rhodes EP). Selecting a part or a plugin in the signal chain populates its parameters here."
        />
      </InspectorFrame>
    )
  }
  return (
    <InspectorFrame label="No widget selected">
      <Placeholder
        title="Widget properties"
        body="Click a widget on the Perform canvas to configure it (size, level, controller filter). Cascade indicators show whether the setting is inherited from Show / Song / Patch."
      />
    </InspectorFrame>
  )
}

// =============================================================================
// Stories
// =============================================================================

export const Program: Story = {
  name: "Program mode",
  render: () => {
    const [nav, setNav] = React.useState<NavId>("outline")
    const [mode, setMode] = React.useState<AppMode>("program")
    return (
      <Shell
        nav={nav}
        setNav={setNav}
        mode={mode}
        setMode={setMode}
        showName="Hamilton — 2026 Tour"
        songName="My Shot"
        contextPanel={<ContextPanelForMode nav={nav} mode={mode} />}
        inspector={<InspectorForMode mode={mode} />}
        canvas={<CanvasFor mode={mode} songName="My Shot" patchName="Verse split" />}
      />
    )
  },
}

export const Perform: Story = {
  name: "Perform mode (layout editor)",
  render: () => {
    const [nav, setNav] = React.useState<NavId>("outline")
    const [mode, setMode] = React.useState<AppMode>("perform")
    const [live, setLive] = React.useState(false)
    return (
      <>
        <Shell
          nav={nav}
          setNav={setNav}
          mode={mode}
          setMode={setMode}
          perform
          onGoLive={() => setLive(true)}
          showName="Hamilton — 2026 Tour"
          songName="My Shot"
          contextPanel={<ContextPanelForMode nav={nav} mode={mode} />}
          inspector={<InspectorForMode mode={mode} />}
          canvas={<CanvasFor mode={mode} songName="My Shot" patchName="Verse split" />}
        />
        {live && (
          <LiveFullscreen
            showName="Hamilton — 2026 Tour"
            songName="My Shot"
            onExit={() => setLive(false)}
          />
        )}
      </>
    )
  },
}

export const Live: Story = {
  name: "Live (fullscreen takeover)",
  render: () => {
    const [exited, setExited] = React.useState(false)
    if (exited) {
      return (
        <div className="dark grid h-screen w-screen place-items-center bg-background text-muted-foreground">
          Exited Live. (In the real app this would return to Perform mode with chrome back.)
        </div>
      )
    }
    return (
      <LiveFullscreen
        showName="Hamilton — 2026 Tour"
        songName="My Shot"
        onExit={() => setExited(true)}
      />
    )
  },
}
