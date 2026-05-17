import type { Meta, StoryObj } from "@storybook/react"
import * as React from "react"
import { Sparkles } from "lucide-react"
import { AppMenuBar } from "./app-menu-bar"
import { NavRail, type NavId } from "./nav-rail"
import { ModeSwitcher, type AppMode } from "./mode-switcher"
import { StatusBar } from "./status-bar"
import { ShowOutline } from "@/components/widgets/show-outline"
import { PerformanceLockToggle } from "@/components/widgets/performance-lock-toggle"

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
    key: "F#m",
    length: "4:01",
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
    key: "D",
    length: "1:53",
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
    key: "Bbm",
    length: "5:32",
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
    key: "G",
    length: "2:21",
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
    key: "Eb",
    length: "3:08",
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
    length: "1:23",
    patches: [
      { id: "6.1", number: 1, name: "Seabury's piano" },
      { id: "6.2", number: 2, name: "Hamilton's response" },
      { id: "6.3", number: 3, name: "Tutti" },
      { id: "6.4", number: 4, name: "Out" },
    ],
  },
]

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
      {/* App menu bar */}
      <AppMenuBar
        brand={
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-primary" />
            Stardust
          </span>
        }
      />

      {/* Header band: mode switcher (left) + current show context (center) + Performance Lock (right) */}
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
        <PerformanceLockToggle locked={mode === "live"} onChange={(l) => setMode(l ? "live" : "edit")} />
      </div>

      {/* Body: nav rail + context panel + canvas + inspector */}
      <div className="grid grid-cols-[3.5rem_280px_1fr_320px] overflow-hidden">
        <NavRail active={nav} onSelect={setNav} />
        <aside className="overflow-hidden border-r p-2">{contextPanel}</aside>
        <main className="overflow-hidden bg-background">{canvas}</main>
        <aside className="overflow-hidden border-l p-2">{inspector}</aside>
      </div>

      {/* Status bar */}
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

// =============================================================================
// Stories
// =============================================================================

export const Frame: Story = {
  name: "01 · Empty frame",
  render: () => {
    const [nav, setNav] = React.useState<NavId>("outline")
    const [mode, setMode] = React.useState<AppMode>("edit")
    return (
      <Shell
        nav={nav}
        setNav={setNav}
        mode={mode}
        setMode={setMode}
        showName="Untitled Show"
        songName="—"
        contextPanel={
          <Placeholder
            title="Context panel"
            body="Driven by the nav rail. Pick an icon on the left."
          />
        }
        inspector={
          <Placeholder
            title="Inspector"
            body="Selection-driven. When a patch, instrument, or FX is selected its properties appear here."
          />
        }
        canvas={
          <Placeholder
            title="Canvas"
            body={`Mode-specific content lands here. Currently: ${mode}.`}
            fullHeight
          />
        }
      />
    )
  },
}

export const WithShowOutline: Story = {
  name: "02 · With Show Outline (Edit Mode)",
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
        contextPanel={
          <ShowOutline
            showName="Hamilton — 2026 Tour"
            songs={HAMILTON_ACT_ONE}
            currentSongId="3"
            currentPatchId="3.2"
            className="h-full"
          />
        }
        inspector={
          <Placeholder
            title="Inspector"
            body="Selection: Patch 3.2 · Verse split. The patch's instruments, effects, and parameters will land here once the signal-chain view is built."
          />
        }
        canvas={
          <Placeholder
            title="Edit canvas"
            body="The patch editor — signal-chain view (instruments → FX → output) lands here. Or the Layout tab if you switch tabs at the top of the canvas."
            fullHeight
          />
        }
      />
    )
  },
}

export const WithShowOutlineLive: Story = {
  name: "03 · With Show Outline (Live Mode)",
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
        contextPanel={
          <ShowOutline
            showName="Hamilton — 2026 Tour"
            songs={HAMILTON_ACT_ONE}
            currentSongId="3"
            currentPatchId="3.2"
            focusCurrentSong
            className="h-full"
          />
        }
        inspector={
          <Placeholder
            title="Inspector"
            body="During a show the Inspector typically hides or shows minimal context. Auto-collapses with Performance Lock."
          />
        }
        canvas={
          <Placeholder
            title="Live canvas"
            body="The user-configured Live Mode layout renders here. Widgets are placed and sized in the Edit Mode → Layout tab. Lands in the next iteration."
            fullHeight
          />
        }
      />
    )
  },
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function Placeholder({
  title,
  body,
  fullHeight,
}: {
  title: string
  body: string
  fullHeight?: boolean
}) {
  return (
    <div
      className={
        "flex h-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-card/30 p-6 text-center text-muted-foreground" +
        (fullHeight ? "" : "")
      }
    >
      <div className="text-[10px] uppercase tracking-[0.2em]">{title}</div>
      <div className="max-w-sm text-sm leading-relaxed">{body}</div>
    </div>
  )
}
