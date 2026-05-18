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
import { Switch } from "@/components/ui/switch"
import { Keyboard } from "@/components/rig/keyboard"
import { Pads } from "@/components/rig/pads"
import { Footswitch } from "@/components/rig/footswitch"
import { ExpressionPedal } from "@/components/rig/expression-pedal"
import { ComponentLibrary } from "@/components/rig/component-library"
import { LearnableField } from "@/components/rig/learnable-field"
import {
  defaultsForKind,
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

// Seed instances — show a populated rig out of the box.
function makeSeed(): RigComponentInstance[] {
  return [
    {
      instanceId: `seed-1`,
      name: "Main keyboard",
      kind: "keyboard",
      ...defaultsForKind("keyboard"),
      midiInput: "USB MIDI Port 1",
      midiChannel: 1,
    },
    {
      instanceId: `seed-2`,
      name: "Drum pads",
      kind: "pads",
      ...defaultsForKind("pads"),
      midiInput: "USB MIDI Port 2",
      midiChannel: 10,
      rows: 2,
      cols: 8,
    },
    {
      instanceId: `seed-3`,
      name: "Sustain",
      kind: "switch",
      ...defaultsForKind("switch"),
      switchSource: "CC 64 ch 1",
      switchMode: "momentary",
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
  const [tab, setTab] = React.useState<"settings" | "library">("library")

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

function RigOutline({
  placed,
  selectedId,
  onSelect,
}: {
  placed: RigComponentInstance[]
  selectedId: string | undefined
  onSelect: (id: string) => void
}) {
  const instruments = placed.filter((p) =>
    ["keyboard", "pads"].includes(p.kind)
  )
  const controllers = placed.filter(
    (p) => !["keyboard", "pads"].includes(p.kind)
  )

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
  const summary = summaryFor(instance)
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
        {summary}
      </span>
    </button>
  )
}

function summaryFor(i: RigComponentInstance): string {
  switch (i.kind) {
    case "keyboard":
      return `${i.keys ?? "?"} keys · ch ${i.midiChannel ?? "—"}`
    case "pads":
      return `${i.rows ?? "?"}×${i.cols ?? "?"} · ch ${i.midiChannel ?? "—"}`
    case "switch":
      return `${i.switchMode ?? "—"} · ${i.switchSource ?? "unassigned"}`
    case "expression-pedal":
      return `${i.polarity ?? "—"} · ${i.expressionSource ?? "unassigned"}`
    case "knob":
      return `${i.controlRange ?? "—"} · ${i.controlSource ?? "unassigned"}`
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
            Each component captures its MIDI source with a Learn button in
            settings.
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
      const range = keyRange(instance.keys ?? 88)
      return (
        <Keyboard
          fromNote={range.from}
          toNote={range.to}
          whiteKeyWidth={10}
          readOnly
        />
      )
    }
    case "pads":
      return (
        <div className="flex justify-center">
          <Pads rows={instance.rows ?? 4} cols={instance.cols ?? 4} />
        </div>
      )
    case "switch":
      return (
        <div className="flex justify-center">
          <Footswitch label={instance.name.slice(0, 4) || "SW"} />
        </div>
      )
    case "expression-pedal":
      return (
        <div className="flex justify-center">
          <ExpressionPedal value={0.5} label={instance.name} />
        </div>
      )
    case "knob":
      return (
        <div className="flex justify-center">
          <KnobGlyph label={instance.name} />
        </div>
      )
    case "fader":
      return (
        <div className="flex justify-center">
          <FaderGlyph label={instance.name} />
        </div>
      )
  }
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
          background:
            "linear-gradient(180deg, #2c2c33 0%, #18181d 100%)",
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

function keyRange(keys: number): { from: number; to: number } {
  switch (keys) {
    case 88: return { from: 21, to: 108 }
    case 76: return { from: 28, to: 103 }
    case 73: return { from: 28, to: 100 }
    case 61: return { from: 36, to: 96 }
    case 49: return { from: 36, to: 84 }
    case 32: return { from: 48, to: 79 }
    case 25: return { from: 48, to: 72 }
    default: {
      const from = 36
      const to = Math.min(127, from + keys - 1)
      return { from, to }
    }
  }
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
  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-5 px-1 pb-6">
        <Header instance={component} />

        <Group title="Identity & MIDI source">
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

          {component.kind !== "switch" &&
            component.kind !== "expression-pedal" &&
            component.kind !== "knob" &&
            component.kind !== "fader" && (
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
        {component.kind === "expression-pedal" && (
          <ExpressionPedalSettings instance={component} onUpdate={onUpdate} />
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

const KEY_COUNTS = [25, 32, 49, 61, 73, 76, 88] as const
const PAD_GRIDS = [
  { rows: 2, cols: 8, label: "2 × 8" },
  { rows: 4, cols: 4, label: "4 × 4" },
  { rows: 8, cols: 8, label: "8 × 8" },
] as const

function KeyboardSettings({
  instance,
  onUpdate,
}: {
  instance: RigComponentInstance
  onUpdate: (patch: Partial<RigComponentInstance>) => void
}) {
  return (
    <>
      <Group title="Keyboard">
        <FieldRow>
          <Label className="text-xs">Key count</Label>
          <Select
            value={String(instance.keys ?? 88)}
            onValueChange={(v) => onUpdate({ keys: Number(v) })}
          >
            <SelectTrigger className="h-8 w-28 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KEY_COUNTS.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n} keys
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldRow>

        <FieldRow>
          <Label className="text-xs">Pitch wheel range (semitones)</Label>
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

        <ToggleRow
          label="Has pitch wheel"
          value={instance.hasPitchWheel ?? true}
          onChange={(v) => onUpdate({ hasPitchWheel: v })}
        />
        <ToggleRow
          label="Has mod wheel"
          value={instance.hasModWheel ?? true}
          onChange={(v) => onUpdate({ hasModWheel: v })}
        />
      </Group>

      <Group title="Controller MIDI assignments">
        <LearnableField
          label="Sustain pedal source"
          value={instance.sustainSource}
          placeholder="Press sustain pedal to capture"
          onCapture={(captured) => onUpdate({ sustainSource: captured })}
          mockCapture={() => `CC 64 ch ${instance.midiChannel ?? 1}`}
        />
        {instance.hasModWheel !== false && (
          <LearnableField
            label="Mod wheel source"
            value={instance.modWheelSource}
            placeholder="Move mod wheel to capture"
            onCapture={(captured) => onUpdate({ modWheelSource: captured })}
            mockCapture={() => `CC 1 ch ${instance.midiChannel ?? 1}`}
          />
        )}
      </Group>
    </>
  )
}

function PadsSettings({
  instance,
  onUpdate,
}: {
  instance: RigComponentInstance
  onUpdate: (patch: Partial<RigComponentInstance>) => void
}) {
  const currentGrid =
    PAD_GRIDS.find(
      (g) => g.rows === instance.rows && g.cols === instance.cols
    ) ?? PAD_GRIDS[1]

  return (
    <Group title="Pads">
      <FieldRow>
        <Label className="text-xs">Grid layout</Label>
        <Select
          value={`${currentGrid.rows}x${currentGrid.cols}`}
          onValueChange={(v) => {
            const grid = PAD_GRIDS.find(
              (g) => `${g.rows}x${g.cols}` === v
            )
            if (grid) onUpdate({ rows: grid.rows, cols: grid.cols })
          }}
        >
          <SelectTrigger className="h-8 w-28 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAD_GRIDS.map((g) => (
              <SelectItem key={`${g.rows}x${g.cols}`} value={`${g.rows}x${g.cols}`}>
                {g.label} ({g.rows * g.cols} pads)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldRow>

      <LearnableField
        label="Base note (lowest pad)"
        value={instance.baseNote !== undefined ? `Note ${instance.baseNote}` : undefined}
        placeholder="Hit the lowest pad to capture"
        onCapture={() =>
          onUpdate({ baseNote: 36 })
        }
        mockCapture={() => `Note 36 ch ${instance.midiChannel ?? 10}`}
      />
    </Group>
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
        mockCapture={() => `CC 64 ch 1`}
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
          <SelectTrigger className="h-8 w-36 text-xs">
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
        mockCapture={() =>
          `CC ${instance.kind === "knob" ? 16 : 7} ch 1`
        }
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

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label className="cursor-pointer text-xs">{label}</Label>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
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
