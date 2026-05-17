import type { Meta, StoryObj } from "@storybook/react"
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Disc3,
  Menu,
  Mic2,
  Settings,
} from "lucide-react"
import { KeyboardVisualizer } from "@/components/widgets/keyboard-visualizer"
import { CompoundPartsList } from "@/components/widgets/compound-parts-list"
import { Setlist } from "@/components/widgets/setlist"
import { PatchesPanel } from "@/components/widgets/patches-panel"
import { ShowNotesPane } from "@/components/widgets/show-notes-pane"
import { Footswitch } from "@/components/widgets/footswitch"
import { ExpressionPedal } from "@/components/widgets/expression-pedal"
import { ClickIndicator } from "@/components/widgets/click-indicator"
import { TransposeIndicator } from "@/components/widgets/transpose-indicator"
import { TimeElapsed } from "@/components/widgets/time-elapsed"
import { StereoVuMeter } from "@/components/widgets/vu-meter"
import { CpuLatencyBadge } from "@/components/widgets/cpu-latency-badge"
import { MidiActivityDots } from "@/components/widgets/midi-activity-dots"
import { PerformanceLockToggle } from "@/components/widgets/performance-lock-toggle"
import { ParameterFavorite } from "@/components/widgets/parameter-favorite"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const meta: Meta = {
  title: "Screens/Live Mode",
  parameters: { layout: "fullscreen" },
}
export default meta
type Story = StoryObj

// =============================================================================
// Pit keyboardist — full redesign
// =============================================================================

const ACT_ONE = [
  { id: "1", number: 1, name: "Alexander Hamilton", patchCount: 5, length: "4:01", key: "F#m" },
  { id: "2", number: 2, name: "Aaron Burr, Sir", patchCount: 4, length: "1:53", key: "D" },
  { id: "3", number: 3, name: "My Shot", patchCount: 6, length: "5:32", key: "Bbm" },
  { id: "4", number: 4, name: "The Story of Tonight", patchCount: 3, length: "2:21" },
  { id: "5", number: 5, name: "The Schuyler Sisters", patchCount: 5, length: "3:08" },
  { id: "6", number: 6, name: "Farmer Refuted", patchCount: 4, length: "1:23" },
  { id: "7", number: 7, name: "You'll Be Back", patchCount: 3, length: "3:31", key: "G" },
  { id: "8", number: 8, name: "Right Hand Man", patchCount: 7, length: "5:18" },
]

const MY_SHOT_PATCHES = [
  { id: "p1", number: 1, name: "Intro Strings", subtitle: "BBC SO", transition: "Immediate" },
  {
    id: "p2",
    number: 2,
    name: "Verse Split",
    subtitle: "Wurli Bass + EP",
    partCount: 2,
    transition: "Fade 200 ms",
  },
  {
    id: "p3",
    number: 3,
    name: "Pre-Chorus Lift",
    subtitle: "Pad + Bell layer",
    partCount: 3,
    transition: "Crossfade 800 ms",
  },
  { id: "p4", number: 4, name: "Chorus Brass", subtitle: "Spitfire Brass", transition: "Immediate" },
  { id: "p5", number: 5, name: "Bridge Synth", subtitle: "Surge XT", transition: "Fade 400 ms" },
  { id: "p6", number: 6, name: "Outro Pad", subtitle: "Diva Sustain", transition: "Crossfade 1.2 s" },
]

const COMPOUND_PARTS = [
  {
    id: "bass",
    name: "Wurli Bass",
    color: "var(--chart-1)",
    range: { fromNote: 24, toNote: 47 },
    level: 0.85,
    receiving: true,
  },
  {
    id: "ep",
    name: "Rhodes EP",
    color: "var(--chart-2)",
    range: { fromNote: 48, toNote: 71 },
    level: 0.7,
    receiving: true,
  },
  {
    id: "pad",
    name: "String Pad",
    color: "var(--chart-3)",
    range: { fromNote: 60, toNote: 96 },
    level: 0.55,
  },
]

function TopBar() {
  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-4">
      {/* Left: menu + show name */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" aria-label="Menu">
          <Menu />
        </Button>
        <div className="flex items-center gap-2 border-l pl-3">
          <Disc3 className="size-4 text-muted-foreground" />
          <div className="leading-tight">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Show
            </div>
            <div className="text-sm font-semibold">Hamilton — 2026 Tour</div>
          </div>
        </div>
        <div className="ml-3 border-l pl-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Tonight
          </div>
          <div className="text-sm">Tue 17 May · Richard Rodgers</div>
        </div>
      </div>

      {/* Right: tempo + transpose + system */}
      <div className="flex items-center gap-2">
        <ClickIndicator bpm={92} currentBeat={2} />
        <TransposeIndicator semitones={0} />
        <CpuLatencyBadge cpu={0.42} latencyMs={7.8} />
        <MidiActivityDots
          ports={[
            { name: "RD-2000", activity: 0.9 },
            { name: "FCB1010", activity: 0.0 },
            { name: "EV-5", activity: 0.4 },
            { name: "Sustain", activity: 0.0 },
          ]}
        />
        <Button variant="ghost" size="icon" aria-label="Settings">
          <Settings />
        </Button>
        <PerformanceLockToggle locked />
      </div>
    </header>
  )
}

function PatchHero() {
  return (
    <section className="flex items-center justify-between rounded-2xl border border-border-strong bg-card-raised px-6 py-4 shadow-sm">
      <div>
        <div className="flex items-baseline gap-2">
          <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Song 3 of 23
          </span>
          <span className="text-sm text-muted-foreground">·</span>
          <span className="text-sm text-muted-foreground">Bbm · 92 bpm</span>
        </div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">My Shot</h1>
        <div className="mt-3 flex items-baseline gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-stage">
            Now
          </span>
          <span className="text-5xl font-semibold leading-none tracking-tight">
            Verse Split
          </span>
          <span className="font-mono text-sm text-muted-foreground">Patch 2 / 6</span>
        </div>
        <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-mono text-xs uppercase tracking-wider">Next</span>
          <ChevronRight className="size-3" />
          <span>Pre-Chorus Lift</span>
          <span className="text-muted-foreground/50">·</span>
          <span className="text-xs">Crossfade 800 ms</span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <TimeElapsed seconds={73} totalSeconds={332} />
        <div className="flex items-end gap-3">
          <Button variant="outline" size="lg" aria-label="Previous patch">
            <ChevronLeft className="!size-5" />
          </Button>
          <Button size="lg" className="px-8 text-base" aria-label="Advance patch">
            Next patch
            <ChevronRight className="!size-5" />
          </Button>
        </div>
      </div>
    </section>
  )
}

function HardwareRow() {
  return (
    <footer className="flex items-end justify-between gap-6 rounded-2xl border bg-card px-6 py-4">
      {/* Footswitch row */}
      <div className="flex items-end gap-5">
        <Footswitch label="FS1" binding="Prev patch" />
        <Footswitch label="FS2" binding="Next patch" active />
        <Footswitch label="FS3" binding="Tap tempo" />
        <Footswitch label="FS4" binding="Panic" />
      </div>

      {/* Expression pedal */}
      <ExpressionPedal value={0.55} label="EXP" binding="→ Filter cutoff" />

      {/* Output meters + panic */}
      <div className="flex items-end gap-5">
        <div className="text-center">
          <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Output
          </div>
          <StereoVuMeter left={-9} right={-12} leftPeak={-4} rightPeak={-6} />
        </div>
        <Button
          variant="destructive"
          size="lg"
          className="h-20 w-20 flex-col gap-1 rounded-full text-xs uppercase tracking-wider"
        >
          <AlertTriangle className="!size-6" />
          Panic
        </Button>
      </div>
    </footer>
  )
}

export const PitKeyboardist: Story = {
  name: "Preset · Pit keyboardist (redesigned)",
  render: () => (
    <div className="dark grid h-screen w-screen grid-rows-[auto_1fr] bg-background text-foreground">
      <TopBar />

      <div className="grid grid-cols-[280px_1fr_320px] gap-4 overflow-hidden p-4">
        {/* LEFT RAIL — setlist */}
        <Setlist items={ACT_ONE} currentId="3" />

        {/* CENTER — hero + keyboard + hardware */}
        <div className="grid grid-rows-[auto_1fr_auto_auto] gap-4 overflow-hidden">
          <PatchHero />

          {/* Keyboard + compound parts side-by-side */}
          <div className="grid grid-cols-[1fr_320px] gap-4 overflow-hidden">
            <div className="flex flex-col gap-3 overflow-hidden">
              <KeyboardVisualizer
                parts={COMPOUND_PARTS.map(({ id, name, color, range }) => ({
                  id,
                  label: name,
                  color,
                  fromNote: range!.fromNote,
                  toNote: range!.toNote,
                }))}
                active={[
                  { note: 36, velocity: 95, partId: "bass" },
                  { note: 60, velocity: 70, partId: "ep" },
                  { note: 64, velocity: 70, partId: "ep" },
                  { note: 67, velocity: 70, partId: "ep" },
                ]}
              />

              {/* Parameter favorites row */}
              <div className="grid grid-cols-4 gap-3">
                <ParameterFavorite
                  label="Cutoff"
                  source="Wurli · Tone"
                  value={0.62}
                  style="knob"
                  unit="%"
                />
                <ParameterFavorite
                  label="EP drive"
                  source="Rhodes · Drive"
                  value={0.4}
                  style="knob"
                  unit="%"
                />
                <ParameterFavorite
                  label="Pad swell"
                  source="Strings · Expression"
                  value={0.55}
                  style="knob"
                  unit="%"
                />
                <ParameterFavorite
                  label="Reverb"
                  source="Supermassive · Mix"
                  value={0.3}
                  style="knob"
                  unit="%"
                />
              </div>
            </div>
            <CompoundPartsList parts={COMPOUND_PARTS} />
          </div>

          <HardwareRow />
        </div>

        {/* RIGHT RAIL — patches in song + show notes */}
        <div className="grid grid-rows-[auto_1fr] gap-4 overflow-hidden">
          <PatchesPanel patches={MY_SHOT_PATCHES} currentIndex={1} />
          <ShowNotesPane
            content={[
              { type: "h", level: 2, text: "Cues" },
              {
                type: "ul",
                items: [
                  "Bar 17: footswitch → Patch 3 (Pre-Chorus Lift)",
                  "Bar 32: conductor cue ch1 C2 → Patch 4 (Chorus Brass)",
                  "Bar 64: footswitch → Patch 5 (Bridge Synth)",
                ],
              },
              { type: "h", level: 2, text: "Notes" },
              { type: "p", text: "Watch Marie for the bar 32 cue — don't trust the click here." },
              { type: "chord", line: "Bbm · capo 0 · book is in Eb (transpose +2)" },
            ]}
          />
        </div>
      </div>
    </div>
  ),
}

// =============================================================================
// Old presets — temporarily disabled until the language is approved
// =============================================================================
//
// SoloElectronic, Worship, and Conductor compositions will be rebuilt using
// the new language (warm slate palette, hardware pedals, whole-show context,
// persistent rails) once the PitKeyboardist redesign is approved.
