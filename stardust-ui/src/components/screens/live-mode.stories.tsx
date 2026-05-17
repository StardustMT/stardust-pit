import type { Meta, StoryObj } from "@storybook/react"
import { KeyboardVisualizer } from "@/components/widgets/keyboard-visualizer"
import { ShowSongPatchLabel } from "@/components/widgets/show-song-patch-label"
import { PatchListStrip } from "@/components/widgets/patch-list-strip"
import { NextPatchPreview } from "@/components/widgets/next-patch-preview"
import { PanicButton } from "@/components/widgets/panic-button"
import { StereoVuMeter } from "@/components/widgets/vu-meter"
import { CpuLatencyBadge } from "@/components/widgets/cpu-latency-badge"
import { MidiActivityDots } from "@/components/widgets/midi-activity-dots"
import { ClickIndicator } from "@/components/widgets/click-indicator"
import { PerformanceLockToggle } from "@/components/widgets/performance-lock-toggle"
import { TimeElapsed } from "@/components/widgets/time-elapsed"
import { TransposeIndicator } from "@/components/widgets/transpose-indicator"
import { ShowNotesPane } from "@/components/widgets/show-notes-pane"
import { Footswitch, FootswitchArray } from "@/components/widgets/footswitch"
import { ExpressionPedal } from "@/components/widgets/expression-pedal"
import { ParameterFavorite } from "@/components/widgets/parameter-favorite"

const meta: Meta = {
  title: "Screens/Live Mode",
  parameters: { layout: "fullscreen" },
}
export default meta
type Story = StoryObj

const PATCHES = [
  { id: "1", name: "Verse Pad", subtitle: "Diva + Supermassive" },
  { id: "2", name: "Pre-Chorus Bell", subtitle: "MuseSounds Celeste" },
  { id: "3", name: "Chorus Strings", subtitle: "Spitfire BBC SO Discover" },
  { id: "4", name: "Bridge Stab", subtitle: "Surge XT — Wavetable" },
  { id: "5", name: "Outro Pad", subtitle: "Diva — Sustain" },
]

const MIDI_PORTS = [
  { name: "RD-2000", activity: 0.9 },
  { name: "Sustain", activity: 0.0 },
  { name: "EV-5", activity: 0.3 },
  { name: "FCB1010", activity: 0.0 },
]

// =============================================================================
// Preset 1: Pit keyboardist
// =============================================================================

export const PitKeyboardist: Story = {
  name: "Preset · Pit keyboardist",
  render: () => (
    <div className="min-h-screen bg-background p-6 text-foreground">
      <div className="mx-auto grid h-full max-w-[1440px] grid-rows-[auto_1fr_auto] gap-4">
        {/* Top bar */}
        <header className="flex items-center justify-between">
          <ShowSongPatchLabel
            show="Hamilton — 2026 Tour"
            song="My Shot"
            songIndex={4}
            songTotal={23}
            patch="Verse Pad"
            patchIndex={1}
            patchTotal={5}
          />
          <div className="flex items-center gap-3">
            <CpuLatencyBadge cpu={0.42} latencyMs={8.2} />
            <MidiActivityDots ports={MIDI_PORTS} />
            <TransposeIndicator semitones={0} />
            <PerformanceLockToggle locked />
          </div>
        </header>

        {/* Content split: notes on left, next patch + favorites on right */}
        <main className="grid grid-cols-[1.2fr_1fr] gap-4">
          <ShowNotesPane
            content={[
              { type: "h", level: 1, text: "My Shot" },
              {
                type: "p",
                text: "Verse pad → bridge bell on cue. Watch Marie for the conductor cue at bar 64.",
              },
              { type: "h", level: 2, text: "Cues" },
              {
                type: "ul",
                items: [
                  "Bar 17: footswitch → Patch 2 (Bell)",
                  "Bar 64: conductor cue Ch1 C2 → Patch 3 (Strings)",
                  "Bar 92: footswitch → Patch 4 (Stab)",
                ],
              },
            ]}
          />
          <div className="flex flex-col gap-4">
            <NextPatchPreview name="Pre-Chorus Bell" subtitle="Crossfade 600 ms" />
            <div className="flex gap-3">
              <ParameterFavorite label="Cutoff" value={0.62} style="knob" unit="%" />
              <ParameterFavorite label="Reverb" value={0.4} style="knob" unit="%" />
              <ParameterFavorite label="Pad layer" value={0.7} style="knob" unit="%" />
            </div>
            <div className="flex items-end gap-6">
              <ClickIndicator bpm={92} currentBeat={2} />
              <TimeElapsed seconds={73} totalSeconds={210} />
              <StereoVuMeter left={-9} right={-12} leftPeak={-4} rightPeak={-6} />
            </div>
          </div>
        </main>

        {/* Bottom: patch list + keyboard */}
        <footer className="space-y-3">
          <PatchListStrip patches={PATCHES} currentIndex={0} />
          <KeyboardVisualizer
            active={[
              { note: 48, velocity: 90 },
              { note: 55, velocity: 90 },
              { note: 60, velocity: 95 },
              { note: 64, velocity: 95 },
            ]}
          />
          <div className="flex items-center justify-between">
            <FootswitchArray
              switches={[
                { label: "FS1", binding: "Patch +1" },
                { label: "FS2", binding: "Patch −1" },
              ]}
            />
            <PanicButton size="lg" />
          </div>
        </footer>
      </div>
    </div>
  ),
}

// =============================================================================
// Preset 2: Solo electronic musician
// =============================================================================

export const SoloElectronic: Story = {
  name: "Preset · Solo electronic",
  render: () => (
    <div className="min-h-screen bg-background p-6 text-foreground">
      <div className="mx-auto grid h-full max-w-[1440px] grid-rows-[auto_1fr_auto] gap-4">
        <header className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Stardust Sessions
            </div>
            <div className="text-3xl font-semibold tracking-tight">Solar Drift</div>
          </div>
          <PerformanceLockToggle locked />
        </header>

        <main className="grid grid-rows-[1fr_auto] gap-6">
          {/* Big knob grid */}
          <div className="grid grid-cols-6 gap-4">
            {[
              { l: "Cutoff", v: 0.62, s: "Diva · LP-12" },
              { l: "Reso", v: 0.28 },
              { l: "Drive", v: 0.85 },
              { l: "Delay", v: 0.45, s: "Tape — feedback" },
              { l: "Reverb", v: 0.62, s: "Supermassive" },
              { l: "Macro", v: 0.5, s: "Arp depth" },
            ].map((p) => (
              <ParameterFavorite
                key={p.l}
                label={p.l}
                source={p.s}
                value={p.v}
                style="knob"
                unit="%"
              />
            ))}
          </div>

          <div className="flex items-end gap-6">
            <ExpressionPedal value={0.55} binding="→ Filter cutoff" />
            <ClickIndicator bpm={128} currentBeat={3} />
            <StereoVuMeter left={-6} right={-5} leftPeak={-2} rightPeak={-1} />
            <div className="ml-auto">
              <PanicButton size="xl" />
            </div>
          </div>
        </main>

        <footer>
          <KeyboardVisualizer
            fromNote={28}
            toNote={88}
            active={[
              { note: 40, velocity: 100 },
              { note: 47, velocity: 80 },
              { note: 52, velocity: 95 },
            ]}
          />
        </footer>
      </div>
    </div>
  ),
}

// =============================================================================
// Preset 3: Worship leader
// =============================================================================

export const Worship: Story = {
  name: "Preset · Worship",
  render: () => (
    <div className="min-h-screen bg-background p-6 text-foreground">
      <div className="mx-auto grid h-full max-w-[1440px] grid-rows-[auto_1fr_auto] gap-4">
        <header className="flex items-center justify-between">
          <ShowSongPatchLabel
            show="Sunday — 17 May"
            songLabel="Set"
            song="Goodness of God"
            songIndex={3}
            songTotal={5}
            patch="Verse Pad"
          />
          <div className="flex items-center gap-3">
            <TransposeIndicator semitones={2} fromKey="C" toKey="D" />
            <ClickIndicator bpm={72} currentBeat={1} beatsPerBar={4} />
            <PerformanceLockToggle locked />
          </div>
        </header>

        <main className="grid grid-cols-[1.4fr_1fr] gap-4">
          <ShowNotesPane
            content={[
              { type: "h", level: 1, text: "Goodness of God" },
              { type: "chord", line: "G          D/F#       Em        Bm" },
              { type: "p", text: "I love You, Lord; oh, Your mercy never fails me" },
              { type: "chord", line: "C          G/B        Am7       D" },
              { type: "p", text: "All my days, I've been held in Your hands" },
              { type: "chord", line: "G          D/F#       Em        Bm" },
              { type: "p", text: "From the moment that I wake up until I lay my head" },
              { type: "chord", line: "C          G/B        Am7       D" },
              { type: "p", text: "I will sing of the goodness of God" },
            ]}
          />
          <div className="flex flex-col gap-3">
            <NextPatchPreview name="Chorus Strings + Pad" subtitle="On the lift" />
            <div className="grid grid-cols-2 gap-3">
              <ParameterFavorite label="Pad layer" value={0.7} style="knob" unit="%" />
              <ParameterFavorite label="Reverb" value={0.55} style="knob" unit="%" />
            </div>
            <ExpressionPedal value={0.4} binding="→ Master volume" />
          </div>
        </main>

        <footer>
          <KeyboardVisualizer
            active={[
              { note: 50, velocity: 70 },
              { note: 57, velocity: 70 },
              { note: 62, velocity: 80 },
              { note: 66, velocity: 80 },
            ]}
          />
        </footer>
      </div>
    </div>
  ),
}

// =============================================================================
// Preset 4: Conductor
// =============================================================================

export const Conductor: Story = {
  name: "Preset · Conductor / MD",
  render: () => (
    <div className="min-h-screen bg-background p-6 text-foreground">
      <div className="mx-auto grid h-full max-w-[1440px] grid-rows-[auto_auto_1fr_auto] gap-4">
        <header className="flex items-center justify-between">
          <ShowSongPatchLabel
            show="The Wild Party"
            song="Burrs's Entrance"
            songIndex={7}
            songTotal={19}
            songLabel="Cue"
            patch="Stride Piano"
            patchIndex={1}
            patchTotal={2}
          />
          <PerformanceLockToggle locked />
        </header>

        <div className="flex items-center justify-between rounded-lg border bg-card p-4">
          <ClickIndicator bpm={144} currentBeat={1} />
          <TimeElapsed seconds={42} totalSeconds={184} />
          <TransposeIndicator semitones={0} />
          <CpuLatencyBadge cpu={0.31} latencyMs={6.4} />
        </div>

        <main className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border bg-card p-5">
            <div className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">
              Upcoming cues
            </div>
            <ol className="space-y-2 text-sm">
              <li>
                <span className="font-mono text-xs text-muted-foreground">bar 17</span>
                <div>
                  <span className="font-semibold">Patch → Stride Piano + Brass Stab</span>
                </div>
              </li>
              <li>
                <span className="font-mono text-xs text-muted-foreground">bar 33</span>
                <div>
                  <span className="font-semibold">Tempo shift</span>: 144 → 168
                </div>
              </li>
              <li>
                <span className="font-mono text-xs text-muted-foreground">bar 49</span>
                <div>
                  <span className="font-semibold">Patch → Vamp Out</span> · crossfade 2 s
                </div>
              </li>
            </ol>
          </div>
          <ShowNotesPane
            content={[
              { type: "h", level: 1, text: "Burrs's Entrance" },
              { type: "p", text: "After Queenie's chorus, the band drops out for the first half-bar." },
              { type: "p", text: "Watch Burrs's hand for the downbeat; don't trust the click here." },
              { type: "h", level: 2, text: "Out" },
              { type: "p", text: "Hold the last chord through applause cue from SM." },
            ]}
          />
        </main>

        <footer>
          <PatchListStrip patches={PATCHES} currentIndex={0} />
        </footer>
      </div>
    </div>
  ),
}
