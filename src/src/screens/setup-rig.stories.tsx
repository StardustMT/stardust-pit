import type { Meta, StoryObj } from "@storybook/react"
import * as React from "react"
import { CircleDot, Sliders, Trash2 } from "lucide-react"
import {
  AppShellFrame,
  InspectorFrame,
  Placeholder,
} from "@/components/shell/app-shell-frame"
import type { AppMode } from "@/components/shell/nav-rail"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Keyboard } from "@/components/rig/keyboard"
import { Pads } from "@/components/rig/pads"
import { Footswitch } from "@/components/rig/footswitch"
import { ExpressionPedal } from "@/components/rig/expression-pedal"
import { ComponentLibrary } from "@/components/rig/component-library"
import { LearnableField } from "@/components/rig/learnable-field"
import {
  defaultsForKind,
  keyCount,
  noteLabel,
  type RigComponentInstance,
  type RigComponentKind,
  type RigComponentSpec,
} from "@/components/rig/_catalog"
import { cn } from "@/lib/utils"

const meta: Meta = {
  title: "Screens/Setup/Rig",
  parameters: { layout: "fullscreen" },
}
export default meta
type Story = StoryObj

// =============================================================================
// Instance factory
// =============================================================================

let nextInstanceId = 1
function makeInstance(spec: RigComponentSpec): RigComponentInstance {
  return {
    instanceId: `inst-${nextInstanceId++}`,
    name: spec.label,
    kind: spec.kind,
    ...defaultsForKind(spec.kind),
  }
}

// Seed a populated rig showing the atomic decomposition: a typical "keys
// player" rig is keyboard + sustain pedal + pitch wheel + mod wheel + pads,
// each configured separately.
function makeSeed(): RigComponentInstance[] {
  return [
    {
      instanceId: "seed-1",
      name: "Main keyboard",
      kind: "keyboard",
      ...defaultsForKind("keyboard"),
      midiInput: "USB MIDI Port 1",
      midiChannel: 1,
      lowNote: 21,
      highNote: 108,
    },
    {
      instanceId: "seed-2",
      name: "Drum pads",
      kind: "pads",
      ...defaultsForKind("pads"),
      midiInput: "USB MIDI Port 2",
      midiChannel: 10,
      rows: 2,
      cols: 8,
    },
    {
      instanceId: "seed-3",
      name: "Sustain",
      kind: "sustain-pedal",
      ...defaultsForKind("sustain-pedal"),
      switchSource: "CC 64 ch 1",
    },
    {
      instanceId: "seed-4",
      name: "Pitch wheel",
      kind: "pitch-wheel",
      ...defaultsForKind("pitch-wheel"),
      pitchSource: "Pitch bend ch 1",
    },
    {
      instanceId: "seed-5",
      name: "Mod wheel",
      kind: "mod-wheel",
      ...defaultsForKind("mod-wheel"),
      modSource: "CC 1 ch 1",
    },
  ]
}

// =============================================================================
// Stories
// =============================================================================

export const RigOverview: Story = {
  name: "Rig setup (populated)",
  render: () => (
    <RigSetupShell initial={makeSeed()} showName="Little Shop of Horrors" />
  ),
}

export const EmptyRig: Story = {
  name: "Empty rig (first-time setup)",
  render: () => <RigSetupShell initial={[]} showName="Untitled show" />,
}

// =============================================================================
// Shell
// =============================================================================

function RigSetupShell({
  initial,
  showName,
}: {
  initial: RigComponentInstance[]
  showName: string
}) {
  const [mode, setMode] = React.useState<AppMode>("setup")
  const [placed, setPlaced] = React.useState<RigComponentInstance[]>(initial)
  const [selectedId, setSelectedId] = React.useState<string | undefined>(
    initial[0]?.instanceId
  )
  const [tab, setTab] = React.useState<"settings" | "library">(
    initial.length ? "settings" : "library"
  )

  const selected = placed.find((p) => p.instanceId === selectedId)

  const onAdd = (spec: RigComponentSpec) => {
    const inst = makeInstance(spec)
    setPlaced((prev) => [...prev, inst])
    setSelectedId(inst.instanceId)
    setTab("settings")
  }

  const onUpdate = (id: string, patch: Partial<RigComponentInstance>) => {
    setPlaced((prev) =>
      prev.map((p) => (p.instanceId === id ? { ...p, ...patch } : p))
    )
  }

  const onRemove = (id: string) => {
    setPlaced((prev) => prev.filter((p) => p.instanceId !== id))
    if (selectedId === id) setSelectedId(undefined)
  }

  return (
    <AppShellFrame
      mode={mode}
      onModeChange={setMode}
      showName={showName}
      contextPanel={
        <RigOutline
          placed={placed}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      }
      inspector={
        <InspectorFrame>
          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as "settings" | "library")}
            className="flex h-full flex-col"
          >
            <TabsList className="grid h-9 grid-cols-2">
              <TabsTrigger value="settings" className="text-xs">
                Settings
              </TabsTrigger>
              <TabsTrigger value="library" className="text-xs">
                Library
              </TabsTrigger>
            </TabsList>
            <TabsContent
              value="settings"
              className="min-h-0 flex-1 overflow-hidden pt-3"
            >
              <SettingsTab
                component={selected}
                onUpdate={(patch) =>
                  selected && onUpdate(selected.instanceId, patch)
                }
                onRemove={() => selected && onRemove(selected.instanceId)}
              />
            </TabsContent>
            <TabsContent
              value="library"
              className="min-h-0 flex-1 overflow-hidden pt-3"
            >
              <ComponentLibrary onAdd={onAdd} />
            </TabsContent>
          </Tabs>
        </InspectorFrame>
      }
      canvas={
        <RigCanvas
          placed={placed}
          selectedId={selectedId}
          onSelect={(id) => {
            setSelectedId(id)
            setTab("settings")
          }}
        />
      }
    />
  )
}

// =============================================================================
// Context-panel outline
// =============================================================================

const INSTRUMENT_KINDS: RigComponentKind[] = ["keyboard", "pads"]
function isInstrument(k: RigComponentKind): boolean {
  return INSTRUMENT_KINDS.includes(k)
}

function RigOutline({
  placed,
  selectedId,
  onSelect,
}: {
  placed: RigComponentInstance[]
  selectedId: string | undefined
  onSelect: (id: string) => void
}) {
  const instruments = placed.filter((p) => isInstrument(p.kind))
  const controllers = placed.filter((p) => !isInstrument(p.kind))

  return (
    <div className="flex h-full flex-col gap-3 p-2">
      <Section title="Instruments" count={instruments.length}>
        {instruments.map((p) => (
          <OutlineRow
            key={p.instanceId}
            instance={p}
            selected={p.instanceId === selectedId}
            onClick={() => onSelect(p.instanceId)}
          />
        ))}
      </Section>
      <Section title="Controllers" count={controllers.length}>
        {controllers.map((p) => (
          <OutlineRow
            key={p.instanceId}
            instance={p}
            selected={p.instanceId === selectedId}
            onClick={() => onSelect(p.instanceId)}
          />
        ))}
      </Section>
      {placed.length === 0 && (
        <div className="grid flex-1 place-items-center px-2 text-center text-xs text-muted-foreground">
          Empty. Add components from the Library tab.
        </div>
      )}
    </div>
  )
}

function Section({
  title,
  count,
  children,
}: {
  title: string
  count: number
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title} <span className="font-normal opacity-60">({count})</span>
      </div>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  )
}

function OutlineRow({
  instance,
  selected,
  onClick,
}: {
  instance: RigComponentInstance
  selected?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full flex-col rounded-md border bg-card px-2 py-1.5 text-left transition-colors",
        "hover:border-primary/40",
        selected && "border-primary ring-1 ring-primary/20"
      )}
    >
      <span className="truncate text-xs font-semibold">{instance.name}</span>
      <span className="truncate text-[10px] text-muted-foreground">
        {summaryFor(instance)}
      </span>
    </button>
  )
}

function summaryFor(i: RigComponentInstance): string {
  switch (i.kind) {
    case "keyboard": {
      const kc = keyCount(i.lowNote, i.highNote)
      const range =
        i.lowNote !== undefined && i.highNote !== undefined
          ? `${noteLabel(i.lowNote)}–${noteLabel(i.highNote)}`
          : "range not learned"
      return `${kc ?? "?"} keys · ${range} · ch ${i.midiChannel ?? "—"}`
    }
    case "pads": {
      const r = i.rows ?? 0
      const c = i.cols ?? 0
      const learned = (i.padAssignments ?? []).filter((a) => a?.note !== undefined).length
      return `${r}×${c} · ${learned}/${r * c} learned · ch ${i.midiChannel ?? "—"}`
    }
    case "switch":
      return `${i.switchMode ?? "—"} · ${i.switchSource ?? "unassigned"}`
    case "sustain-pedal":
      return i.switchSource ?? "unassigned"
    case "expression-pedal":
      return `${i.polarity ?? "—"} · ${i.expressionSource ?? "unassigned"}`
    case "pitch-wheel":
      return `±${i.pitchRangeSemitones ?? 2} st · ${i.pitchSource ?? "unassigned"}`
    case "mod-wheel":
      return i.modSource ?? "unassigned"
    case "knob":
    case "fader":
      return `${i.controlRange ?? "—"} · ${i.controlSource ?? "unassigned"}`
  }
}

// =============================================================================
// Canvas — visual rig of placed components
// =============================================================================

function RigCanvas({
  placed,
  selectedId,
  onSelect,
}: {
  placed: RigComponentInstance[]
  selectedId: string | undefined
  onSelect: (id: string) => void
}) {
  if (placed.length === 0) {
    return (
      <div className="grid h-full place-items-center text-sm text-muted-foreground">
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full border border-dashed border-muted-foreground/40">
            <span className="text-2xl opacity-60">+</span>
          </div>
          <div className="text-base font-medium text-foreground">
            Start your rig
          </div>
          <div className="mt-1 text-xs">
            Add components from the{" "}
            <span className="font-semibold text-foreground">Library</span> tab.
            Use Learn to capture key range, pad notes, and MIDI sources from
            your hardware.
          </div>
        </div>
      </div>
    )
  }
  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-4 p-4">
        {placed.map((p) => (
          <ComponentVisualCard
            key={p.instanceId}
            instance={p}
            selected={p.instanceId === selectedId}
            onSelect={() => onSelect(p.instanceId)}
          />
        ))}
      </div>
    </ScrollArea>
  )
}

function ComponentVisualCard({
  instance,
  selected,
  onSelect,
}: {
  instance: RigComponentInstance
  selected?: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "rounded-lg border bg-card p-3 text-left transition-colors",
        "hover:border-primary/40",
        selected && "border-primary ring-2 ring-primary/20"
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {instance.kind.replace("-", " ")}
          </div>
          <div className="text-sm font-semibold">{instance.name}</div>
        </div>
        {instance.midiChannel !== undefined && (
          <div className="font-mono text-[10px] uppercase text-muted-foreground">
            ch {instance.midiChannel}
          </div>
        )}
      </div>
      <ComponentVisual instance={instance} />
    </button>
  )
}

function ComponentVisual({ instance }: { instance: RigComponentInstance }) {
  switch (instance.kind) {
    case "keyboard": {
      const from = instance.lowNote ?? 21
      const to = instance.highNote ?? 108
      return (
        <Keyboard fromNote={from} toNote={to} whiteKeyWidth={10} readOnly />
      )
    }
    case "pads":
      return (
        <div className="flex justify-center">
          <Pads rows={instance.rows ?? 4} cols={instance.cols ?? 4} />
        </div>
      )
    case "switch":
    case "sustain-pedal":
      return (
        <div className="flex justify-center">
          <Footswitch label={instance.kind === "sustain-pedal" ? "SUS" : instance.name.slice(0, 4) || "SW"} />
        </div>
      )
    case "expression-pedal":
      return (
        <div className="flex justify-center">
          <ExpressionPedal value={0.5} label={instance.name} />
        </div>
      )
    case "pitch-wheel":
      return <div className="flex justify-center"><PitchWheelGlyph label={instance.name} /></div>
    case "mod-wheel":
      return <div className="flex justify-center"><ModWheelGlyph label={instance.name} /></div>
    case "knob":
      return <div className="flex justify-center"><KnobGlyph label={instance.name} /></div>
    case "fader":
      return <div className="flex justify-center"><FaderGlyph label={instance.name} /></div>
  }
}

function PitchWheelGlyph({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="relative h-20 w-6 rounded-full"
        style={{
          background: "linear-gradient(180deg, #2c2c33 0%, #18181d 100%)",
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.05)",
        }}
      >
        <div className="absolute inset-x-1 top-1/2 h-px bg-primary/50" />
        <div
          className="absolute left-1/2 top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-md"
          style={{
            background: "linear-gradient(180deg, #66666e 0%, #3a3a42 100%)",
            boxShadow: "0 2px 4px rgba(0,0,0,0.5)",
          }}
        />
      </div>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  )
}

function ModWheelGlyph({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="relative h-20 w-6 rounded-full"
        style={{
          background: "linear-gradient(180deg, #2c2c33 0%, #18181d 100%)",
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.05)",
        }}
      >
        <div
          className="absolute bottom-1 left-1/2 size-5 -translate-x-1/2 rounded-md"
          style={{
            background: "linear-gradient(180deg, #66666e 0%, #3a3a42 100%)",
            boxShadow: "0 2px 4px rgba(0,0,0,0.5)",
          }}
        />
      </div>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  )
}

function KnobGlyph({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="grid size-14 place-items-center rounded-full"
        style={{
          background:
            "radial-gradient(circle at 50% 30%, #4a4a52 0%, #232328 70%, #15151a 100%)",
          boxShadow:
            "0 4px 8px rgba(0,0,0,0.4), inset 0 -2px 0 0 rgba(0,0,0,0.5), inset 0 2px 0 0 rgba(255,255,255,0.05)",
        }}
      >
        <CircleDot className="size-5 text-muted-foreground" />
      </div>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  )
}

function FaderGlyph({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="relative h-16 w-3 rounded-full"
        style={{
          background: "linear-gradient(180deg, #2c2c33 0%, #18181d 100%)",
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.05)",
        }}
      >
        <div
          className="absolute left-1/2 size-5 -translate-x-1/2 rounded-sm"
          style={{
            top: "30%",
            background: "linear-gradient(180deg, #66666e 0%, #3a3a42 100%)",
            boxShadow: "0 2px 4px rgba(0,0,0,0.5)",
          }}
        />
      </div>
      <Sliders className="size-3 text-muted-foreground" />
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  )
}

// =============================================================================
// Settings tab — kind-specific fields with Learn
// =============================================================================

function SettingsTab({
  component,
  onUpdate,
  onRemove,
}: {
  component: RigComponentInstance | undefined
  onUpdate: (patch: Partial<RigComponentInstance>) => void
  onRemove: () => void
}) {
  if (!component) {
    return (
      <Placeholder
        title="No component selected"
        body="Click a component on the canvas (or in the left panel) to configure it here."
      />
    )
  }

  // Some kinds don't have a meaningful per-instance MIDI channel
  // (sustain pedal / expression pedal / wheels / single switches / knobs / faders
  //  all carry channel in their MIDI source string).
  const showChannel =
    component.kind === "keyboard" || component.kind === "pads"

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-5 px-1 pb-6">
        <Header instance={component} />

        <Group title="Identity & MIDI input">
          <FieldRow>
            <Label htmlFor="display-name" className="text-xs">
              Display name
            </Label>
            <Input
              id="display-name"
              value={component.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              className="h-8 text-xs"
            />
          </FieldRow>

          <LearnableField
            label="MIDI input port"
            value={component.midiInput}
            placeholder="Press a key/control to capture the port"
            onCapture={(captured) => onUpdate({ midiInput: captured })}
            mockCapture={() => mockPortName()}
          />

          {showChannel && (
            <FieldRow>
              <Label htmlFor="midi-channel" className="text-xs">
                MIDI channel
              </Label>
              <ChannelInput
                value={component.midiChannel ?? 1}
                onChange={(v) => onUpdate({ midiChannel: v })}
              />
            </FieldRow>
          )}
        </Group>

        {component.kind === "keyboard" && (
          <KeyboardSettings instance={component} onUpdate={onUpdate} />
        )}
        {component.kind === "pads" && (
          <PadsSettings instance={component} onUpdate={onUpdate} />
        )}
        {component.kind === "switch" && (
          <SwitchSettings instance={component} onUpdate={onUpdate} />
        )}
        {component.kind === "sustain-pedal" && (
          <SustainPedalSettings instance={component} onUpdate={onUpdate} />
        )}
        {component.kind === "expression-pedal" && (
          <ExpressionPedalSettings instance={component} onUpdate={onUpdate} />
        )}
        {component.kind === "pitch-wheel" && (
          <PitchWheelSettings instance={component} onUpdate={onUpdate} />
        )}
        {component.kind === "mod-wheel" && (
          <ModWheelSettings instance={component} onUpdate={onUpdate} />
        )}
        {(component.kind === "knob" || component.kind === "fader") && (
          <ContinuousControlSettings instance={component} onUpdate={onUpdate} />
        )}

        <Separator />

        <Button
          variant="ghost"
          className="justify-start text-destructive hover:text-destructive"
          onClick={onRemove}
        >
          <Trash2 className="mr-2 size-3.5" /> Remove from rig
        </Button>
      </div>
    </ScrollArea>
  )
}

function Header({ instance }: { instance: RigComponentInstance }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {instance.kind.replace("-", " ")}
      </div>
      <div className="text-sm font-semibold">{instance.name}</div>
    </div>
  )
}

function Group({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      {children}
    </div>
  )
}

function FieldRow({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-1.5">{children}</div>
}

function Separator() {
  return <div className="h-px bg-border" />
}

function ChannelInput({
  value,
  onChange,
}: {
  value: number
  onChange: (v: number) => void
}) {
  return (
    <Input
      type="number"
      min={1}
      max={16}
      value={value}
      onChange={(e) =>
        onChange(Math.max(1, Math.min(16, Number(e.target.value) || 1)))
      }
      className="h-8 w-20 text-xs"
    />
  )
}

// -----------------------------------------------------------------------------
// Per-kind settings
// -----------------------------------------------------------------------------

function KeyboardSettings({
  instance,
  onUpdate,
}: {
  instance: RigComponentInstance
  onUpdate: (patch: Partial<RigComponentInstance>) => void
}) {
  const kc = keyCount(instance.lowNote, instance.highNote)
  return (
    <Group title="Key range">
      <div className="rounded-md border border-dashed bg-muted/20 px-2.5 py-2 text-[10px] text-muted-foreground">
        Press the lowest key on your keyboard to capture, then the highest.
        Stardust derives the key count from the range.
      </div>

      <LearnableField
        label="Lowest key"
        value={
          instance.lowNote !== undefined
            ? `${noteLabel(instance.lowNote)} (MIDI ${instance.lowNote})`
            : undefined
        }
        placeholder="Press lowest key to capture"
        onCapture={() => onUpdate({ lowNote: 21 })} // A0 default mock
        mockCapture={() => `A0 (MIDI 21)`}
      />
      <LearnableField
        label="Highest key"
        value={
          instance.highNote !== undefined
            ? `${noteLabel(instance.highNote)} (MIDI ${instance.highNote})`
            : undefined
        }
        placeholder="Press highest key to capture"
        onCapture={() => onUpdate({ highNote: 108 })} // C8 default mock
        mockCapture={() => `C8 (MIDI 108)`}
      />

      <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs">
        <span className="text-muted-foreground">Derived:</span>{" "}
        <span className="font-mono font-semibold">
          {kc !== undefined ? `${kc} keys` : "—"}
        </span>
      </div>
    </Group>
  )
}

function PadsSettings({
  instance,
  onUpdate,
}: {
  instance: RigComponentInstance
  onUpdate: (patch: Partial<RigComponentInstance>) => void
}) {
  const rows = instance.rows ?? 4
  const cols = instance.cols ?? 4
  const assignments = instance.padAssignments ?? []
  const learnedCount = assignments.filter((a) => a?.note !== undefined).length

  const setRows = (n: number) => {
    const r = Math.max(1, Math.min(16, n))
    onUpdate({ rows: r })
  }
  const setCols = (n: number) => {
    const c = Math.max(1, Math.min(16, n))
    onUpdate({ cols: c })
  }
  const learnPad = (idx: number, note: number) => {
    const next = [...assignments]
    next[idx] = { note }
    onUpdate({ padAssignments: next })
  }
  const clearAll = () => onUpdate({ padAssignments: [] })

  return (
    <Group title="Pad grid">
      <div className="flex items-end gap-3">
        <FieldRow>
          <Label className="text-xs">Rows</Label>
          <Input
            type="number"
            min={1}
            max={16}
            value={rows}
            onChange={(e) => setRows(Number(e.target.value) || 1)}
            className="h-8 w-20 text-xs"
          />
        </FieldRow>
        <FieldRow>
          <Label className="text-xs">Columns</Label>
          <Input
            type="number"
            min={1}
            max={16}
            value={cols}
            onChange={(e) => setCols(Number(e.target.value) || 1)}
            className="h-8 w-20 text-xs"
          />
        </FieldRow>
        <div className="ml-auto text-[10px] text-muted-foreground">
          {learnedCount} / {rows * cols} learned
        </div>
      </div>

      <div className="rounded-md border border-dashed bg-muted/20 px-2.5 py-2 text-[10px] text-muted-foreground">
        Click a cell, then hit the corresponding pad on your hardware. Each
        cell captures its own MIDI note.
      </div>

      <PadLearnGrid
        rows={rows}
        cols={cols}
        assignments={assignments}
        onLearn={learnPad}
      />

      {learnedCount > 0 && (
        <Button
          size="sm"
          variant="ghost"
          className="self-start text-xs text-muted-foreground hover:text-foreground"
          onClick={clearAll}
        >
          Clear all assignments
        </Button>
      )}
    </Group>
  )
}

function PadLearnGrid({
  rows,
  cols,
  assignments,
  onLearn,
}: {
  rows: number
  cols: number
  assignments: Array<{ note?: number } | undefined>
  onLearn: (idx: number, note: number) => void
}) {
  return (
    <div
      className="grid gap-1.5"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: rows * cols }).map((_, idx) => (
        <PadLearnCell
          key={idx}
          assignment={assignments[idx]}
          onCapture={(note) => onLearn(idx, note)}
          mockNote={36 + idx} // sequential mock: pad 0 -> C2, pad 1 -> C#2, ...
        />
      ))}
    </div>
  )
}

function PadLearnCell({
  assignment,
  onCapture,
  mockNote,
}: {
  assignment: { note?: number } | undefined
  onCapture: (note: number) => void
  mockNote: number
}) {
  const [listening, setListening] = React.useState(false)
  React.useEffect(() => {
    if (!listening) return
    const t = window.setTimeout(() => {
      setListening(false)
      onCapture(mockNote)
    }, 900)
    return () => window.clearTimeout(t)
  }, [listening, mockNote, onCapture])

  const note = assignment?.note
  return (
    <button
      type="button"
      onClick={() => setListening(true)}
      className={cn(
        "grid aspect-square place-items-center rounded-md text-[10px] font-mono transition-colors",
        listening
          ? "animate-pulse border border-destructive bg-destructive/10 text-destructive"
          : note !== undefined
          ? "border border-primary/40 bg-primary/10 text-primary"
          : "border border-dashed border-muted-foreground/30 text-muted-foreground hover:border-foreground/40"
      )}
      title={note !== undefined ? `${noteLabel(note)} (MIDI ${note})` : "Click to Learn"}
    >
      {listening ? "···" : note !== undefined ? noteLabel(note) : "—"}
    </button>
  )
}

function SwitchSettings({
  instance,
  onUpdate,
}: {
  instance: RigComponentInstance
  onUpdate: (patch: Partial<RigComponentInstance>) => void
}) {
  return (
    <Group title="Switch">
      <LearnableField
        label="MIDI source"
        value={instance.switchSource}
        placeholder="Press the switch to capture"
        onCapture={(captured) => onUpdate({ switchSource: captured })}
        mockCapture={() => `CC ${Math.floor(Math.random() * 95) + 16} ch 1`}
      />
      <FieldRow>
        <Label className="text-xs">Behaviour</Label>
        <Select
          value={instance.switchMode ?? "momentary"}
          onValueChange={(v) =>
            onUpdate({ switchMode: v as "momentary" | "toggle" })
          }
        >
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="momentary">Momentary</SelectItem>
            <SelectItem value="toggle">Toggle</SelectItem>
          </SelectContent>
        </Select>
      </FieldRow>
    </Group>
  )
}

function SustainPedalSettings({
  instance,
  onUpdate,
}: {
  instance: RigComponentInstance
  onUpdate: (patch: Partial<RigComponentInstance>) => void
}) {
  return (
    <Group title="Sustain pedal">
      <LearnableField
        label="MIDI source"
        value={instance.switchSource}
        placeholder="Press the sustain pedal to capture"
        onCapture={(captured) => onUpdate({ switchSource: captured })}
        mockCapture={() => `CC 64 ch 1`}
      />
      <div className="text-[10px] text-muted-foreground">
        Sustain pedals are always momentary — held = sustain on.
      </div>
    </Group>
  )
}

function ExpressionPedalSettings({
  instance,
  onUpdate,
}: {
  instance: RigComponentInstance
  onUpdate: (patch: Partial<RigComponentInstance>) => void
}) {
  return (
    <Group title="Expression pedal">
      <LearnableField
        label="MIDI source"
        value={instance.expressionSource}
        placeholder="Sweep the pedal to capture"
        onCapture={(captured) => onUpdate({ expressionSource: captured })}
        mockCapture={() => `CC 11 ch 1`}
      />
      <FieldRow>
        <Label className="text-xs">Polarity</Label>
        <Select
          value={instance.polarity ?? "normal"}
          onValueChange={(v) =>
            onUpdate({ polarity: v as "normal" | "inverted" })
          }
        >
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="normal">Normal (toe down = max)</SelectItem>
            <SelectItem value="inverted">Inverted</SelectItem>
          </SelectContent>
        </Select>
      </FieldRow>
      <div className="flex items-end gap-3">
        <FieldRow>
          <Label className="text-xs">Min value</Label>
          <Input
            type="number"
            min={0}
            max={127}
            value={instance.expressionMin ?? 0}
            onChange={(e) =>
              onUpdate({
                expressionMin: Math.max(
                  0,
                  Math.min(127, Number(e.target.value) || 0)
                ),
              })
            }
            className="h-8 w-20 text-xs"
          />
        </FieldRow>
        <FieldRow>
          <Label className="text-xs">Max value</Label>
          <Input
            type="number"
            min={0}
            max={127}
            value={instance.expressionMax ?? 127}
            onChange={(e) =>
              onUpdate({
                expressionMax: Math.max(
                  0,
                  Math.min(127, Number(e.target.value) || 127)
                ),
              })
            }
            className="h-8 w-20 text-xs"
          />
        </FieldRow>
      </div>
    </Group>
  )
}

function PitchWheelSettings({
  instance,
  onUpdate,
}: {
  instance: RigComponentInstance
  onUpdate: (patch: Partial<RigComponentInstance>) => void
}) {
  return (
    <Group title="Pitch wheel">
      <LearnableField
        label="MIDI source"
        value={instance.pitchSource}
        placeholder="Move the pitch wheel to capture"
        onCapture={(captured) => onUpdate({ pitchSource: captured })}
        mockCapture={() => `Pitch bend ch 1`}
      />
      <FieldRow>
        <Label className="text-xs">Bend range (semitones)</Label>
        <Input
          type="number"
          min={1}
          max={24}
          value={instance.pitchRangeSemitones ?? 2}
          onChange={(e) =>
            onUpdate({
              pitchRangeSemitones: Math.max(
                1,
                Math.min(24, Number(e.target.value) || 2)
              ),
            })
          }
          className="h-8 w-20 text-xs"
        />
      </FieldRow>
    </Group>
  )
}

function ModWheelSettings({
  instance,
  onUpdate,
}: {
  instance: RigComponentInstance
  onUpdate: (patch: Partial<RigComponentInstance>) => void
}) {
  return (
    <Group title="Mod wheel">
      <LearnableField
        label="MIDI source"
        value={instance.modSource}
        placeholder="Move the mod wheel to capture"
        onCapture={(captured) => onUpdate({ modSource: captured })}
        mockCapture={() => `CC 1 ch 1`}
      />
    </Group>
  )
}

function ContinuousControlSettings({
  instance,
  onUpdate,
}: {
  instance: RigComponentInstance
  onUpdate: (patch: Partial<RigComponentInstance>) => void
}) {
  const noun = instance.kind === "knob" ? "knob" : "fader"
  return (
    <Group title={instance.kind === "knob" ? "Knob" : "Fader"}>
      <LearnableField
        label="MIDI source"
        value={instance.controlSource}
        placeholder={`Move the ${noun} to capture`}
        onCapture={(captured) => onUpdate({ controlSource: captured })}
        mockCapture={() => `CC ${instance.kind === "knob" ? 16 : 7} ch 1`}
      />
      <FieldRow>
        <Label className="text-xs">Range mode</Label>
        <Select
          value={instance.controlRange ?? "absolute"}
          onValueChange={(v) =>
            onUpdate({ controlRange: v as "absolute" | "relative" })
          }
        >
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="absolute">Absolute (0–127)</SelectItem>
            <SelectItem value="relative">
              {instance.kind === "knob"
                ? "Relative (endless encoder)"
                : "Relative (delta)"}
            </SelectItem>
          </SelectContent>
        </Select>
      </FieldRow>
    </Group>
  )
}

// =============================================================================
// Helpers
// =============================================================================

function mockPortName(): string {
  const ports = [
    "USB MIDI Port 1",
    "USB MIDI Port 2",
    "DIN MIDI In",
    "Bluetooth MIDI",
  ]
  return ports[Math.floor(Math.random() * ports.length)]
}
