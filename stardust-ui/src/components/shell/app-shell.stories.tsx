import type { Meta, StoryObj } from "@storybook/react"
import * as React from "react"
import { LayoutGrid, PencilLine, Play, Sparkles } from "lucide-react"
import { AppMenuBar } from "./app-menu-bar"
import { NavRail, type NavId } from "./nav-rail"
import { ModeSwitcher, type AppMode } from "./mode-switcher"
import { StatusBar } from "./status-bar"
import { ShowOutline } from "@/components/widgets/show-outline"

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

function Shell({
  nav,
  setNav,
  mode,
  setMode,
  contextPanel,
  inspector,
  canvas,
  showName,
  songName,
}: {
  nav: NavId
  setNav: (n: NavId) => void
  mode: AppMode
  setMode: (m: AppMode) => void
  contextPanel: React.ReactNode
  inspector: React.ReactNode
  canvas: React.ReactNode
  showName?: string
  songName?: string
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
        <ModeBadge mode={mode} />
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
        bpm={92}
        transposeSemitones={0}
        cpu={0.42}
      />
    </div>
  )
}

function ModeBadge({ mode }: { mode: AppMode }) {
  const tone =
    mode === "live"
      ? "border-primary/40 bg-primary/15 text-primary"
      : mode === "layout"
        ? "border-chart-2/40 bg-chart-2/10 text-chart-2"
        : "border-border bg-card text-muted-foreground"
  const Icon = mode === "live" ? Play : mode === "layout" ? LayoutGrid : PencilLine
  const label =
    mode === "live"
      ? "Live · locked"
      : mode === "layout"
        ? "Layout · editing canvas"
        : "Edit · editing patches"
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${tone}`}
    >
      <Icon className="size-3" />
      {label}
    </span>
  )
}

function CanvasPlaceholder({
  mode,
  songName,
  patchName,
}: {
  mode: AppMode
  songName?: string
  patchName?: string
}) {
  if (mode === "edit") {
    return (
      <Placeholder
        title="Edit canvas"
        body={`Selected: ${songName ?? "—"} → ${patchName ?? "—"}. Patch signal chain (Instrument → FX → Output) lands here. Click a block to surface its parameters in the Inspector.`}
      />
    )
  }
  if (mode === "layout") {
    return (
      <Placeholder
        title="Layout canvas"
        body="Drag-and-resize widget grid. Default layout is Show-wide; you can override per Song or Patch. Widget palette docked on the left context panel, selected-widget config in the Inspector."
      />
    )
  }
  return (
    <Placeholder
      title="Live canvas"
      body="Renders the configured layout for the current Show / Song / Patch. Locked while Live mode is active. Interaction is via keys, footswitches, and configured widgets — not the canvas itself."
    />
  )
}

function ContextPanelForMode({ nav, mode }: { nav: NavId; mode: AppMode }) {
  if (nav === "outline") {
    return (
      <ContextPanelFrame label="Show outline">
        <ShowOutline
          showName="Hamilton — 2026 Tour"
          songs={HAMILTON_ACT_ONE}
          currentSongId="3"
          currentPatchId="3.2"
          mode={mode === "live" ? "live" : "edit"}
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
  if (mode === "edit") {
    return (
      <InspectorFrame label="Patch · Verse split">
        <Placeholder
          title="Patch properties"
          body="Compound patch with 2 parts (Wurli Bass + Rhodes EP). Selecting a part or a plugin in the signal chain populates its parameters here."
        />
      </InspectorFrame>
    )
  }
  if (mode === "layout") {
    return (
      <InspectorFrame label="No widget selected">
        <Placeholder
          title="Widget properties"
          body="Click a widget on the canvas to configure it (size, level, controller filter). Cascade indicators show whether the setting is inherited from Show / Song / Patch."
        />
      </InspectorFrame>
    )
  }
  return (
    <InspectorFrame label="Auto-collapsed">
      <Placeholder
        title="Hidden during Live"
        body="Inspector auto-collapses in Live mode — selection-driven affordances aren't useful while playing. You can show it manually via View menu."
      />
    </InspectorFrame>
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

export const Edit: Story = {
  name: "Edit mode",
  render: () => {
    const [nav, setNav] = React.useState<NavId>("outline")
    const [mode, setMode] = React.useState<AppMode>("edit")
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
        canvas={<CanvasPlaceholder mode={mode} songName="My Shot" patchName="Verse split" />}
      />
    )
  },
}

export const Layout: Story = {
  name: "Layout mode",
  render: () => {
    const [nav, setNav] = React.useState<NavId>("outline")
    const [mode, setMode] = React.useState<AppMode>("layout")
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
        canvas={<CanvasPlaceholder mode={mode} songName="My Shot" patchName="Verse split" />}
      />
    )
  },
}

export const Live: Story = {
  name: "Live mode",
  render: () => {
    const [nav, setNav] = React.useState<NavId>("outline")
    const [mode, setMode] = React.useState<AppMode>("live")
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
        canvas={<CanvasPlaceholder mode={mode} songName="My Shot" patchName="Verse split" />}
      />
    )
  },
}

function Placeholder({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-card/30 p-6 text-center text-muted-foreground">
      <div className="text-[10px] uppercase tracking-[0.18em]">{title}</div>
      <div className="max-w-sm text-sm leading-relaxed">{body}</div>
    </div>
  )
}
