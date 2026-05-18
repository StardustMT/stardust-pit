import type { Meta, StoryObj } from "@storybook/react"
import * as React from "react"
import { AppShellFrame, InspectorFrame, Placeholder } from "@/components/shell/app-shell-frame"
import type { AppMode } from "@/components/shell/nav-rail"
import { ShowOutline } from "@/components/show/show-outline"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, ArrowLeftRight, ChevronRight, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { PatchEditor, type Sound } from "@/screens/patch-editor"
import type { SoundBlock } from "@/components/sound/sound-flow"
import {
  FEED_ME_AUDREY_SOUNDS,
  FEED_ME_PAD_KIT_SOUND,
  LSOH_ACT_ONE,
  LSOH_KEYBOARDS,
  LSOH_POST_MIX_FX,
  SKID_ROW_VERSE_SOUNDS,
  SOMEWHERE_VERSE_SOUND,
} from "./_demo-data"

const meta: Meta = {
  title: "Screens/Program/Patch editor",
  parameters: { layout: "fullscreen" },
}
export default meta
type Story = StoryObj

// =============================================================================
// Library tab — organized tree (NOT a flat list with search). Categories
// are collapsible; search filters the visible tree.
// =============================================================================

type LibraryKind = "instrument" | "effect" | "midi-device" | "output-bus" | "sound-preset"

function libraryKindFor(selectedId: string | undefined, sounds: Sound[]): LibraryKind {
  if (!selectedId) return "sound-preset"
  if (selectedId.endsWith(":in")) return "midi-device"
  if (selectedId.endsWith(":out") || selectedId.startsWith("patch-mix")) return "output-bus"
  if (selectedId.startsWith("post-")) return "effect"
  for (const s of sounds) {
    if (selectedId === s.id) return "sound-preset"
    const b = s.blocks.find((x) => x.id === selectedId)
    if (b?.kind === "instrument") return "instrument"
    if (b?.kind === "effect") return "effect"
    if (selectedId.startsWith(`${s.id}:add-instrument`)) return "instrument"
    if (selectedId.startsWith(`${s.id}:add-effect`)) return "effect"
  }
  return "sound-preset"
}

type LibraryItem = { name: string; vendor?: string; format?: string; tags: string[] }
type LibraryTree = { group: string; items: LibraryItem[] }[]

const LIBRARY_TREES: Record<LibraryKind, LibraryTree> = {
  instrument: [
    {
      group: "By format · Built-in",
      items: [
        { name: "Basic Sampler", format: "built-in", tags: ["sampler"] },
      ],
    },
    {
      group: "By format · VST3",
      items: [
        { name: "Diva", vendor: "u-he", format: "VST3", tags: ["analog"] },
        { name: "Scarbee Mark I", vendor: "Native Instruments", format: "VST3", tags: ["rhodes"] },
        { name: "Vintage B3", vendor: "GG Audio", format: "VST3", tags: ["organ"] },
        { name: "FM8", vendor: "Native Instruments", format: "VST3", tags: ["fm"] },
        { name: "BFD3", vendor: "inMusic", format: "VST3", tags: ["drums"] },
        { name: "BBC SO Discover", vendor: "Spitfire Audio", format: "VST3", tags: ["orchestral"] },
        { name: "Sforzando", vendor: "Plogue", format: "VST3", tags: ["sampler"] },
      ],
    },
    {
      group: "By format · CLAP",
      items: [
        { name: "Surge XT", vendor: "Surge Synth Team", format: "CLAP", tags: ["synth"] },
        { name: "Vital", vendor: "Vital Audio", format: "CLAP", tags: ["wavetable"] },
      ],
    },
    {
      group: "By vendor · u-he",
      items: [{ name: "Diva", vendor: "u-he", format: "VST3", tags: ["analog"] }],
    },
    {
      group: "By vendor · Spitfire Audio",
      items: [
        { name: "BBC SO Discover", vendor: "Spitfire Audio", format: "VST3", tags: ["orchestral"] },
      ],
    },
  ],
  effect: [
    {
      group: "Built-in · Dynamics",
      items: [
        { name: "Compressor", format: "built-in", tags: ["dynamics"] },
        { name: "Limiter", format: "built-in", tags: ["dynamics"] },
        { name: "Gate", format: "built-in", tags: ["dynamics"] },
      ],
    },
    {
      group: "Built-in · Tone",
      items: [
        { name: "EQ", format: "built-in", tags: ["eq"] },
        { name: "Filter", format: "built-in", tags: ["filter"] },
        { name: "Transpose", format: "built-in", tags: ["pitch"] },
      ],
    },
    {
      group: "Built-in · Ambience",
      items: [
        { name: "Reverb (algorithmic)", format: "built-in", tags: ["reverb"] },
        { name: "Delay (BPM-synced)", format: "built-in", tags: ["delay"] },
        { name: "Chorus", format: "built-in", tags: ["modulation"] },
      ],
    },
    {
      group: "VST3 · Valhalla DSP",
      items: [
        { name: "Valhalla Supermassive", vendor: "Valhalla DSP", format: "VST3", tags: ["reverb"] },
        { name: "Valhalla VintageVerb", vendor: "Valhalla DSP", format: "VST3", tags: ["reverb"] },
      ],
    },
    {
      group: "VST3 · FabFilter",
      items: [
        { name: "Pro-L 2", vendor: "FabFilter", format: "VST3", tags: ["limiter"] },
        { name: "Pro-Q 4", vendor: "FabFilter", format: "VST3", tags: ["eq"] },
      ],
    },
    {
      group: "VST3 · Soundtoys",
      items: [
        { name: "Tremolator", vendor: "Soundtoys", format: "VST3", tags: ["modulation"] },
        { name: "Decapitator", vendor: "Soundtoys", format: "VST3", tags: ["distortion"] },
      ],
    },
  ],
  "midi-device": [
    {
      group: "Keyboards",
      items: [
        { name: "Roland RD-2000", tags: ["88-key"] },
        { name: "Novation Launchkey 49", tags: ["49-key", "pads"] },
      ],
    },
    {
      group: "Pad controllers",
      items: [{ name: "Roland SPD-30 Octapad", tags: ["pads"] }],
    },
  ],
  "output-bus": [
    {
      group: "Internal",
      items: [
        { name: "Patch mix", tags: ["default"] },
        { name: "Sidechain bus", tags: ["internal"] },
      ],
    },
    {
      group: "Physical",
      items: [
        { name: "Main 1-2", tags: ["physical"] },
        { name: "Cue 3-4", tags: ["physical"] },
        { name: "Aux 5-6", tags: ["physical"] },
      ],
    },
  ],
  "sound-preset": [
    {
      group: "My presets",
      items: [
        { name: "Wurli soft", tags: ["wurli"] },
        { name: "Audrey II growl", tags: ["audrey-ii", "fx"] },
        { name: "Suddenly Seymour strings", tags: ["strings", "ballad"] },
      ],
    },
    {
      group: "Stardust factory",
      items: [
        { name: "B3 doo-wop", tags: ["organ", "factory"] },
        { name: "Layered piano + strings", tags: ["layered", "factory"] },
      ],
    },
  ],
}

const LIBRARY_LABELS: Record<LibraryKind, string> = {
  instrument: "Instruments",
  effect: "Effects",
  "midi-device": "MIDI devices",
  "output-bus": "Output buses",
  "sound-preset": "Sound presets",
}

function LibraryTab({
  selectedId,
  sounds,
}: {
  selectedId: string | undefined
  sounds: Sound[]
}) {
  const kind = libraryKindFor(selectedId, sounds)
  const tree = LIBRARY_TREES[kind]
  const [filter, setFilter] = React.useState("")
  const [open, setOpen] = React.useState<Record<string, boolean>>({})

  const filteredTree = React.useMemo(() => {
    if (!filter.trim()) return tree
    const lc = filter.toLowerCase()
    return tree
      .map((g) => ({
        group: g.group,
        items: g.items.filter(
          (it) =>
            it.name.toLowerCase().includes(lc) ||
            it.vendor?.toLowerCase().includes(lc) ||
            it.tags.some((t) => t.toLowerCase().includes(lc)),
        ),
      }))
      .filter((g) => g.items.length > 0)
  }, [tree, filter])

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {LIBRARY_LABELS[kind]}
        </div>
        {selectedId && (
          <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-xs">
            <ArrowLeftRight className="size-3.5" />
            Swap selected
          </Button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="h-8 pl-7 text-xs"
          placeholder="Filter…"
        />
      </div>

      <div className="flex-1 space-y-0.5 overflow-y-auto pr-1">
        {filteredTree.map((g) => {
          const isOpen = open[g.group] ?? true
          return (
            <div key={g.group} className="rounded-md">
              <button
                type="button"
                onClick={() => setOpen((o) => ({ ...o, [g.group]: !isOpen }))}
                className="flex w-full items-center gap-1 rounded px-1.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              >
                <ChevronRight
                  className={cn("size-3 transition-transform", isOpen && "rotate-90")}
                />
                <span className="truncate">{g.group}</span>
                <span className="ml-auto font-mono normal-case text-[10px] opacity-60">
                  {g.items.length}
                </span>
              </button>
              {isOpen && (
                <ul className="ml-3 space-y-px border-l border-border pl-1">
                  {g.items.map((it) => (
                    <li key={`${g.group}-${it.name}`}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left text-xs transition-colors hover:bg-muted/40"
                      >
                        <span className="truncate">{it.name}</span>
                        {it.vendor && (
                          <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                            {it.vendor}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// =============================================================================
// Settings tab — context-aware. (Mostly carried forward from the previous
// iteration; DAW-style effect surfaces land in the next round.)
// =============================================================================

function SettingsTab({
  selectedId,
  sounds,
}: {
  selectedId: string | undefined
  sounds: Sound[]
}) {
  if (!selectedId) {
    return (
      <SettingsBody title="Patch" subtitle="Click something on the canvas to inspect">
        <SettingsRow label="Patch level">
          <Slider defaultValue={[78]} max={100} />
        </SettingsRow>
        <SettingsRow label="Transpose" hint="Semitones, applied to all sounds">
          <Slider defaultValue={[0]} min={-24} max={24} step={1} />
        </SettingsRow>
      </SettingsBody>
    )
  }

  for (const s of sounds) {
    if (selectedId === `${s.id}:in`) {
      return (
        <SettingsBody title="MIDI in" subtitle={`Source for ${s.name}`}>
          <SettingsRow label="Device">
            <Select defaultValue={s.source.deviceId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rd2000">Roland RD-2000</SelectItem>
                <SelectItem value="launchkey49">Novation Launchkey 49</SelectItem>
              </SelectContent>
            </Select>
          </SettingsRow>
          <SettingsRow label="Channel">
            <Select defaultValue={String(s.source.channel)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All channels</SelectItem>
                {Array.from({ length: 16 }).map((_, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>
                    Ch {i + 1}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsRow>
          <RangeWithLearn
            label="Note range"
            from={s.source.range.fromNote}
            to={s.source.range.toNote}
          />
          <SettingsRow label="Velocity range" hint="0–127">
            <Slider defaultValue={[0, 127]} min={0} max={127} step={1} />
          </SettingsRow>
          <SettingsRow label="Bend range override">
            <div className="flex items-center gap-2">
              <Switch defaultChecked={s.bendRangeOverride != null} />
              <span className="font-mono text-xs">
                {s.bendRangeOverride != null ? `±${s.bendRangeOverride} st` : "inherit"}
              </span>
            </div>
          </SettingsRow>
        </SettingsBody>
      )
    }
    if (selectedId === `${s.id}:out`) {
      return (
        <SettingsBody title="Output" subtitle={`Where ${s.name}'s audio + MIDI goes`}>
          <SettingsRow label="Audio bus">
            <Select defaultValue={s.outputBus ?? "Patch mix"}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Patch mix">Patch mix (default)</SelectItem>
                <SelectItem value="Main 1-2">Main 1-2</SelectItem>
                <SelectItem value="Cue 3-4">Cue 3-4</SelectItem>
                <SelectItem value="Aux 5-6">Aux 5-6</SelectItem>
              </SelectContent>
            </Select>
          </SettingsRow>
          <SettingsRow label="Send MIDI out" hint="e.g. for forScore page turns">
            <Switch defaultChecked={!!s.midiOut} />
          </SettingsRow>
          {s.midiOut && (
            <SettingsRow label="MIDI out channel">
              <Select defaultValue={String(s.midiOut.channel)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 16 }).map((_, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>
                      Ch {i + 1}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingsRow>
          )}
        </SettingsBody>
      )
    }
  }

  for (const s of sounds) {
    const block = s.blocks.find((b) => b.id === selectedId)
    if (!block) continue
    if (block.kind === "warning") {
      return (
        <SettingsBody title="Missing plugin" subtitle={block.message}>
          <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
            <AlertTriangle className="mb-1 inline size-4" /> The sound chain can't play
            until this plugin is installed or replaced.
          </div>
          <Button variant="outline" size="sm" className="w-full">
            Pick a replacement from the Library
          </Button>
        </SettingsBody>
      )
    }
    if (block.kind === "instrument") {
      return (
        <SettingsBody title={block.name} subtitle={`Instrument · in: ${s.name}`}>
          <SettingsRow label="Preset">
            <Select defaultValue="ms2-bass">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ms2-bass">MS2 Bass · {block.name}</SelectItem>
                <SelectItem value="poly-pad">Poly Pad</SelectItem>
              </SelectContent>
            </Select>
          </SettingsRow>
          <SettingsRow label="Cutoff">
            <Slider defaultValue={[60]} max={100} />
          </SettingsRow>
          <SettingsRow label="Resonance">
            <Slider defaultValue={[25]} max={100} />
          </SettingsRow>
          <SettingsRow label="Open plugin GUI">
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1">
                In drawer
              </Button>
              <Button size="sm" variant="outline" className="flex-1">
                Pop out
              </Button>
            </div>
          </SettingsRow>
          <SettingsRow label="Save as preset">
            <Button size="sm" variant="outline" className="w-full">
              Save instrument preset…
            </Button>
          </SettingsRow>
        </SettingsBody>
      )
    }
    if (block.kind === "effect") {
      return (
        <SettingsBody title={block.name} subtitle={`Effect · in: ${s.name}`}>
          <div className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-6 text-center text-xs text-muted-foreground">
            DAW-style effect surface (EQ curve / compressor transfer graph
            / reverb impulse) lands in the next iteration.
          </div>
          <SettingsRow label="Bypass">
            <Switch defaultChecked={!block.bypassed} />
          </SettingsRow>
          <SettingsRow label="Wet / dry">
            <Slider defaultValue={[35]} max={100} />
          </SettingsRow>
          <SettingsRow label="Save as preset">
            <Button size="sm" variant="outline" className="w-full">
              Save effect preset…
            </Button>
          </SettingsRow>
        </SettingsBody>
      )
    }
  }

  const sound = sounds.find((s) => s.id === selectedId)
  if (sound) {
    return (
      <SettingsBody title={sound.name} subtitle="Sound properties">
        <SettingsRow label="Name">
          <Input defaultValue={sound.name} />
        </SettingsRow>
        <SettingsRow label="Colour">
          <ColourSwatchRow color={sound.color} />
        </SettingsRow>
        <SettingsRow label="Sound preset">
          {sound.linkedPresetId ? (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="font-mono">
                {sound.linkedPresetId}
              </Badge>
              <Button size="sm" variant="outline" className="ml-auto">
                Update preset
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="outline">
              Save as preset…
            </Button>
          )}
        </SettingsRow>
      </SettingsBody>
    )
  }

  if (selectedId === "patch-mix:master") {
    return (
      <SettingsBody title="Patch master" subtitle="Output of the patch into the show mix">
        <SettingsRow label="Master level">
          <Slider defaultValue={[78]} max={100} />
        </SettingsRow>
        <SettingsRow label="Smart balance" hint="Auto-level all sounds in this patch">
          <Button size="sm" variant="outline" className="w-full">
            Analyse and balance
          </Button>
        </SettingsRow>
      </SettingsBody>
    )
  }

  if (selectedId.startsWith("post-")) {
    return (
      <SettingsBody title="Post-mix effect" subtitle="Applied to the patch master, post-mix">
        <div className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-6 text-center text-xs text-muted-foreground">
          DAW-style effect surface lands in the next iteration.
        </div>
        <SettingsRow label="Bypass">
          <Switch defaultChecked />
        </SettingsRow>
      </SettingsBody>
    )
  }

  return (
    <SettingsBody title="Selection" subtitle="Settings for this element">
      <Placeholder title="No settings" body="No settings wired for this element yet." />
    </SettingsBody>
  )
}

function SettingsBody({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto">
      <div>
        <div className="text-sm font-semibold">{title}</div>
        {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function SettingsRow({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <Label className="text-xs font-medium">{label}</Label>
        {hint && <span className="truncate text-[10px] text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

function ColourSwatchRow({ color }: { color: string }) {
  const swatches = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
  ]
  return (
    <div className="flex gap-1.5">
      {swatches.map((c) => (
        <button
          key={c}
          type="button"
          className={cn(
            "size-6 rounded-full border-2",
            c === color ? "border-foreground" : "border-transparent",
          )}
          style={{ background: c }}
          aria-label={`Colour ${c}`}
        />
      ))}
    </div>
  )
}

function RangeWithLearn({
  label,
  from,
  to,
}: {
  label: string
  from: number
  to: number
}) {
  const [learn, setLearn] = React.useState<"from" | "to" | null>(null)
  const noteLabel = (m: number) => {
    const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
    return `${names[m % 12]}${Math.floor(m / 12) - 1}`
  }
  return (
    <SettingsRow label={label} hint="Drag on keyboard, or use Learn">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="flex items-center gap-1">
          <Input value={noteLabel(from)} readOnly className="h-8 font-mono text-xs" />
          <Button
            size="sm"
            variant={learn === "from" ? "destructive" : "outline"}
            className={cn("h-8 text-xs", learn === "from" && "animate-pulse")}
            onClick={() => setLearn(learn === "from" ? null : "from")}
          >
            {learn === "from" ? "Listening…" : "Learn"}
          </Button>
        </div>
        <span className="text-muted-foreground">–</span>
        <div className="flex items-center gap-1">
          <Input value={noteLabel(to)} readOnly className="h-8 font-mono text-xs" />
          <Button
            size="sm"
            variant={learn === "to" ? "destructive" : "outline"}
            className={cn("h-8 text-xs", learn === "to" && "animate-pulse")}
            onClick={() => setLearn(learn === "to" ? null : "to")}
          >
            {learn === "to" ? "Listening…" : "Learn"}
          </Button>
        </div>
      </div>
    </SettingsRow>
  )
}

// =============================================================================
// Tabbed inspector — mounted into the right panel
// =============================================================================

function TabbedInspector({
  selectedId,
  sounds,
}: {
  selectedId: string | undefined
  sounds: Sound[]
}) {
  return (
    <Tabs defaultValue="settings" className="flex h-full flex-col">
      <TabsList className="grid h-9 grid-cols-2">
        <TabsTrigger value="settings" className="text-xs">
          Settings
        </TabsTrigger>
        <TabsTrigger value="library" className="text-xs">
          Library
        </TabsTrigger>
      </TabsList>
      <TabsContent value="settings" className="min-h-0 flex-1 overflow-hidden pt-3">
        <SettingsTab selectedId={selectedId} sounds={sounds} />
      </TabsContent>
      <TabsContent value="library" className="min-h-0 flex-1 overflow-hidden pt-3">
        <LibraryTab selectedId={selectedId} sounds={sounds} />
      </TabsContent>
    </Tabs>
  )
}

// =============================================================================
// Shared story frame
// =============================================================================

function PatchEditorStoryFrame({
  songId,
  patchId,
  songName,
  initialSounds,
  initialPatchName,
  initialPatchLevel = 0.78,
  initialAdvanced = false,
  initialSelectedId,
  initialTransition = "Crossfade 600 ms",
  initialPostMixFx = LSOH_POST_MIX_FX,
}: {
  songId: string
  patchId: string
  songName: string
  initialSounds: Sound[]
  initialPatchName: string
  initialPatchLevel?: number
  initialAdvanced?: boolean
  initialSelectedId?: string
  initialTransition?: string
  initialPostMixFx?: SoundBlock[]
}) {
  const [mode, setMode] = React.useState<AppMode>("program")
  const [sounds, setSounds] = React.useState<Sound[]>(initialSounds)
  const [selectedId, setSelectedId] = React.useState<string | undefined>(initialSelectedId)
  const [patchName, setPatchName] = React.useState(initialPatchName)
  const [patchLevel, setPatchLevel] = React.useState(initialPatchLevel)
  const [advanced, setAdvanced] = React.useState(initialAdvanced)
  const [postMixFx] = React.useState(initialPostMixFx)

  return (
    <AppShellFrame
      mode={mode}
      onModeChange={setMode}
      showName="Little Shop of Horrors"
      songName={songName}
      contextPanel={
        <ShowOutline
          showName="Little Shop of Horrors"
          songs={LSOH_ACT_ONE}
          currentSongId={songId}
          currentPatchId={patchId}
          mode="program"
          onAddSong={() => {}}
          onAddPatch={() => {}}
          className="h-full"
        />
      }
      inspector={
        <InspectorFrame>
          <TabbedInspector selectedId={selectedId} sounds={sounds} />
        </InspectorFrame>
      }
      canvas={
        <PatchEditor
          patchName={patchName}
          onPatchNameChange={setPatchName}
          songName={songName}
          patchLevel={patchLevel}
          onPatchLevelChange={setPatchLevel}
          transposeSemitones={0}
          transition={initialTransition}
          sounds={sounds}
          keyboards={LSOH_KEYBOARDS}
          selectedId={selectedId}
          onSelect={setSelectedId}
          advanced={advanced}
          onAdvancedChange={setAdvanced}
          postMixFx={postMixFx}
          onAddSound={(deviceId) =>
            setSounds((ss) => [
              ...ss,
              {
                id: `sound-${ss.length + 1}`,
                name: `New sound ${ss.length + 1}`,
                color: "var(--chart-5)",
                source: {
                  deviceId: deviceId ?? "rd2000",
                  channel: 1,
                  range: { fromNote: 48, toNote: 72 },
                },
                blocks: [],
                level: 0.7,
              },
            ])
          }
          onSoundChange={(id, updates) =>
            setSounds((ss) => ss.map((s) => (s.id === id ? { ...s, ...updates } : s)))
          }
        />
      }
    />
  )
}

// =============================================================================
// Stories
// =============================================================================

export const SkidRowVerseGroove: Story = {
  name: "Skid Row · Verse groove (3 sounds, 2 keyboards)",
  render: () => (
    <PatchEditorStoryFrame
      songId="s2"
      patchId="s2.1"
      songName="Skid Row (Downtown)"
      initialPatchName="Verse groove"
      initialSounds={SKID_ROW_VERSE_SOUNDS}
      initialSelectedId="bass"
    />
  ),
}

export const SomewhereSingleSound: Story = {
  name: "Somewhere That's Green · Single-sound (linked preset)",
  render: () => (
    <PatchEditorStoryFrame
      songId="s6"
      patchId="s6.1"
      songName="Somewhere That's Green"
      initialPatchName="Audrey verse — Wurli"
      initialSounds={SOMEWHERE_VERSE_SOUND}
      initialSelectedId="audrey-wurli"
      initialTransition="Immediate"
    />
  ),
}

export const FeedMeOverlappingLayers: Story = {
  name: "Feed Me · Overlapping layers (sub + growl + Launchkey hits + drum pads)",
  render: () => (
    <PatchEditorStoryFrame
      songId="s11"
      patchId="s11.1"
      songName="Feed Me (Git It)"
      initialPatchName="Audrey II groove"
      initialSounds={[...FEED_ME_AUDREY_SOUNDS, FEED_ME_PAD_KIT_SOUND]}
      initialSelectedId="audrey-growl"
      initialTransition="Crossfade 800 ms"
    />
  ),
}

export const AdvancedView: Story = {
  name: "Advanced view (CPU + format badges + +MIDI)",
  render: () => (
    <PatchEditorStoryFrame
      songId="s11"
      patchId="s11.1"
      songName="Feed Me (Git It)"
      initialPatchName="Audrey II groove"
      initialSounds={[...FEED_ME_AUDREY_SOUNDS, FEED_ME_PAD_KIT_SOUND]}
      initialSelectedId="fm8"
      initialAdvanced
      initialTransition="Crossfade 800 ms"
    />
  ),
}
