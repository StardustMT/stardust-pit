import * as React from "react"
import { CircleDot, Sliders, Trash2, Unplug } from "lucide-react"
import { AppShellFrame, InspectorFrame, Placeholder } from "@/components/shell/app-shell-frame"
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
import { LearnableNoteField } from "@/components/rig/learnable-note-field"
import {
  defaultConfigForKind,
  deviceLabel,
  isBound,
  keyCount,
  nodeKindFor,
  noteLabel,
  rigKindFor,
  sourceLabel,
  summaryFor,
  type RigComponentKind,
  type RigComponentSpec,
} from "@/components/rig/_catalog"
import {
  type LearnCapture,
  type LearnEvent,
  acceptsAny,
  acceptsControlSource,
  acceptsNoteOn,
  captureNextLearnEvent,
} from "@/lib/use-learn"
import { nextRigComponentId, useShowStore } from "@/state/show-store"
import type { RigComponentConfig, RigComponentWire } from "@/lib/tauri"
import { cn } from "@/lib/utils"

/**
 * The real Setup → Rig screen (#122), extracted from the approved
 * `Screens/Setup/Rig` Storybook mock. Components are CRUD'd against the
 * show store (persisted in the show document, schema v3); Learn fields
 * stream real captures from the engine's Learn mode via
 * `captureNextLearnEvent` — capturing a source on an unbound component
 * also binds the device it arrived on.
 */

export interface SetupRigScreenProps {
  mode: AppMode
  onModeChange?: (mode: AppMode) => void
  headerActions?: React.ReactNode
  statusBar?: React.ReactNode
  /** Injectable Learn stream — Storybook passes a mock; defaults to the
   *  real engine capture. */
  learnCapture?: LearnCapture
}

export function SetupRigScreen({
  mode,
  onModeChange,
  headerActions,
  statusBar,
  learnCapture = captureNextLearnEvent,
}: SetupRigScreenProps) {
  const showName = useShowStore((s) => s.showName)
  const components = useShowStore((s) => s.rig.components)
  const addRigComponent = useShowStore((s) => s.addRigComponent)
  const updateRigComponent = useShowStore((s) => s.updateRigComponent)
  const removeRigComponent = useShowStore((s) => s.removeRigComponent)

  const [selectedId, setSelectedId] = React.useState<string | undefined>(components[0]?.id)
  const [tab, setTab] = React.useState<"settings" | "library">(
    components.length ? "settings" : "library",
  )

  const selected = components.find((c) => c.id === selectedId)

  const onAdd = (spec: RigComponentSpec) => {
    const component: RigComponentWire = {
      id: nextRigComponentId(components),
      kind: nodeKindFor(spec.kind),
      name: spec.label,
      config: defaultConfigForKind(spec.kind),
    }
    addRigComponent(component)
    setSelectedId(component.id)
    setTab("settings")
  }

  return (
    <AppShellFrame
      className="h-full w-full"
      mode={mode}
      onModeChange={onModeChange}
      showName={showName}
      headerActions={headerActions}
      statusBar={statusBar}
      contextPanel={
        <RigOutline components={components} selectedId={selectedId} onSelect={setSelectedId} />
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
            <TabsContent value="settings" className="min-h-0 flex-1 overflow-hidden pt-3">
              <ComponentSettings
                component={selected}
                learnCapture={learnCapture}
                onUpdate={(patch) => selected && updateRigComponent(selected.id, patch)}
                onRemove={() => {
                  if (!selected) return
                  removeRigComponent(selected.id)
                  setSelectedId(undefined)
                }}
              />
            </TabsContent>
            <TabsContent value="library" className="min-h-0 flex-1 overflow-hidden pt-3">
              <ComponentLibrary onAdd={onAdd} />
            </TabsContent>
          </Tabs>
        </InspectorFrame>
      }
      canvas={
        <RigCanvas
          components={components}
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
function isInstrument(c: RigComponentWire): boolean {
  const kind = rigKindFor(c.kind)
  return kind !== undefined && INSTRUMENT_KINDS.includes(kind)
}

function RigOutline({
  components,
  selectedId,
  onSelect,
}: {
  components: RigComponentWire[]
  selectedId: string | undefined
  onSelect: (id: string) => void
}) {
  const instruments = components.filter(isInstrument)
  const controllers = components.filter((c) => !isInstrument(c))

  return (
    <nav aria-label="Rig components" className="flex h-full flex-col gap-3 p-2">
      <Section title="Instruments" count={instruments.length}>
        {instruments.map((c) => (
          <OutlineRow
            key={c.id}
            component={c}
            selected={c.id === selectedId}
            onClick={() => onSelect(c.id)}
          />
        ))}
      </Section>
      <Section title="Controllers" count={controllers.length}>
        {controllers.map((c) => (
          <OutlineRow
            key={c.id}
            component={c}
            selected={c.id === selectedId}
            onClick={() => onSelect(c.id)}
          />
        ))}
      </Section>
      {components.length === 0 && (
        <div className="grid flex-1 place-items-center px-2 text-center text-xs text-muted-foreground">
          Empty. Add components from the Library tab.
        </div>
      )}
    </nav>
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
  component,
  selected,
  onClick,
}: {
  component: RigComponentWire
  selected?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={selected || undefined}
      className={cn(
        "flex w-full flex-col rounded-md border bg-card px-2 py-1.5 text-left transition-colors",
        "hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected && "border-primary ring-1 ring-primary/20",
      )}
    >
      <span className="flex items-center gap-1.5 truncate text-xs font-semibold">
        {component.name}
        {!isBound(component) && (
          <Unplug aria-label="No device bound" className="size-3 shrink-0 text-amber-500" />
        )}
      </span>
      <span className="truncate text-[10px] text-muted-foreground">{summaryFor(component)}</span>
    </button>
  )
}

// =============================================================================
// Canvas — visual rig of placed components
// =============================================================================

function RigCanvas({
  components,
  selectedId,
  onSelect,
}: {
  components: RigComponentWire[]
  selectedId: string | undefined
  onSelect: (id: string) => void
}) {
  if (components.length === 0) {
    return (
      <div className="grid h-full place-items-center text-sm text-muted-foreground">
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full border border-dashed border-muted-foreground/40">
            <span className="text-2xl opacity-60">+</span>
          </div>
          <div className="text-base font-medium text-foreground">Start your rig</div>
          <div className="mt-1 text-xs">
            Add components from the <span className="font-semibold text-foreground">Library</span>{" "}
            tab. Use Learn to capture key range, pad notes, and MIDI sources from your hardware.
          </div>
        </div>
      </div>
    )
  }
  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-4 p-4">
        {components.map((c) => (
          <ComponentVisualCard
            key={c.id}
            component={c}
            selected={c.id === selectedId}
            onSelect={() => onSelect(c.id)}
          />
        ))}
      </div>
    </ScrollArea>
  )
}

function ComponentVisualCard({
  component,
  selected,
  onSelect,
}: {
  component: RigComponentWire
  selected?: boolean
  onSelect: () => void
}) {
  const device = deviceLabel(component.config)
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected || undefined}
      className={cn(
        "rounded-lg border bg-card p-3 text-left transition-colors",
        "hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected && "border-primary ring-2 ring-primary/20",
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {rigKindFor(component.kind)?.replace("-", " ") ?? component.kind}
          </div>
          <div className="text-sm font-semibold">{component.name}</div>
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase text-muted-foreground">
          {device ? (
            <span>{device}</span>
          ) : (
            <span className="flex items-center gap-1 text-amber-500">
              <Unplug className="size-3" /> no device
            </span>
          )}
          {component.config?.channel !== undefined && <span>ch {component.config.channel}</span>}
        </div>
      </div>
      <ComponentVisual component={component} />
    </button>
  )
}

function ComponentVisual({ component }: { component: RigComponentWire }) {
  const cfg = component.config
  switch (rigKindFor(component.kind)) {
    case "keyboard": {
      const from = cfg?.lowNote ?? 21
      const to = cfg?.highNote ?? 108
      return <Keyboard fromNote={from} toNote={to} whiteKeyWidth={10} readOnly />
    }
    case "pads":
      return (
        <div className="flex justify-center">
          <Pads rows={cfg?.rows ?? 4} cols={cfg?.cols ?? 4} />
        </div>
      )
    case "switch":
    case "sustain-pedal":
      return (
        <div className="flex justify-center">
          <Footswitch
            label={
              rigKindFor(component.kind) === "sustain-pedal"
                ? "SUS"
                : component.name.slice(0, 4) || "SW"
            }
          />
        </div>
      )
    case "expression-pedal":
      return (
        <div className="flex justify-center">
          <ExpressionPedal value={0.5} label={component.name} />
        </div>
      )
    case "pitch-wheel":
      return (
        <div className="flex justify-center">
          <WheelGlyph label={component.name} centered />
        </div>
      )
    case "mod-wheel":
      return (
        <div className="flex justify-center">
          <WheelGlyph label={component.name} />
        </div>
      )
    case "knob":
      return (
        <div className="flex justify-center">
          <KnobGlyph label={component.name} />
        </div>
      )
    case "fader":
      return (
        <div className="flex justify-center">
          <FaderGlyph label={component.name} />
        </div>
      )
    default:
      return null
  }
}

function WheelGlyph({ label, centered }: { label: string; centered?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="relative h-20 w-6 rounded-full"
        style={{
          background: "linear-gradient(180deg, #2c2c33 0%, #18181d 100%)",
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.05)",
        }}
      >
        {centered && <div className="absolute inset-x-1 top-1/2 h-px bg-primary/50" />}
        <div
          className={cn(
            "absolute left-1/2 size-5 -translate-x-1/2 rounded-md",
            centered ? "top-1/2 -translate-y-1/2" : "bottom-1",
          )}
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
          background: "radial-gradient(circle at 50% 30%, #4a4a52 0%, #232328 70%, #15151a 100%)",
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

type UpdatePatch = { name?: string; config?: Partial<RigComponentConfig> }

function ComponentSettings({
  component,
  learnCapture,
  onUpdate,
  onRemove,
}: {
  component: RigComponentWire | undefined
  learnCapture: LearnCapture
  onUpdate: (patch: UpdatePatch) => void
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
    <ComponentSettingsInner
      key={component.id}
      component={component}
      learnCapture={learnCapture}
      onUpdate={onUpdate}
      onRemove={onRemove}
    />
  )
}

function ComponentSettingsInner({
  component,
  learnCapture,
  onUpdate,
  onRemove,
}: {
  component: RigComponentWire
  learnCapture: LearnCapture
  onUpdate: (patch: UpdatePatch) => void
  onRemove: () => void
}) {
  const kind = rigKindFor(component.kind)
  const cfg = component.config

  // Some kinds don't have a meaningful per-instance MIDI channel field
  // (pedals / wheels / switches / knobs / faders carry channel with
  // their captured source).
  const showChannel = kind === "keyboard" || kind === "pads"

  // Capturing on an unbound component also binds the device (and
  // channel) the event arrived on — Learn is the binding gesture.
  const bindFromEvent = (e: LearnEvent): Partial<RigComponentConfig> => ({
    device: { id: e.deviceId, name: e.deviceName },
    channel: cfg?.channel ?? e.msg.channel,
  })

  const captureDevice = (signal: AbortSignal) =>
    learnCapture(acceptsAny, signal).then((e) => {
      if (!e) return undefined
      onUpdate({
        config: { device: { id: e.deviceId, name: e.deviceName }, channel: e.msg.channel },
      })
      return e.deviceName
    })

  const captureNote = (write: (note: number, e: LearnEvent) => Partial<RigComponentConfig>) => {
    return (signal: AbortSignal) =>
      learnCapture(acceptsNoteOn, signal).then((e) => {
        if (!e || e.msg.type !== "noteOn") return undefined
        onUpdate({ config: { ...bindFromEvent(e), ...write(e.msg.note, e) } })
        return e.msg.note
      })
  }

  const captureSource = (signal: AbortSignal) =>
    learnCapture(acceptsControlSource, signal).then((e) => {
      if (!e) return undefined
      const source: RigComponentConfig["source"] =
        e.msg.type === "controlChange" ? { type: "cc", cc: e.msg.cc } : { type: "pitchBend" }
      onUpdate({ config: { ...bindFromEvent(e), channel: e.msg.channel, source } })
      return sourceLabel({ source, channel: e.msg.channel })
    })

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-5 px-1 pb-6">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {kind?.replace("-", " ") ?? component.kind}
          </div>
          <div className="text-sm font-semibold">{component.name}</div>
        </div>

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
            label="MIDI input device"
            value={deviceLabel(cfg)}
            placeholder="Press a key/control to capture the device"
            capture={captureDevice}
          />
          {!isBound(component) && (
            <div className="flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-2 text-[10px] text-amber-500">
              <Unplug className="size-3 shrink-0" />
              No device bound — patch nodes using this component stay silent until you Learn one.
            </div>
          )}

          {showChannel && (
            <FieldRow>
              <Label htmlFor="midi-channel" className="text-xs">
                MIDI channel
              </Label>
              <Input
                id="midi-channel"
                type="number"
                min={1}
                max={16}
                value={cfg?.channel ?? 1}
                onChange={(e) =>
                  onUpdate({
                    config: { channel: Math.max(1, Math.min(16, Number(e.target.value) || 1)) },
                  })
                }
                className="h-8 w-20 text-xs"
              />
            </FieldRow>
          )}
        </Group>

        {kind === "keyboard" && (
          <Group title="Key range">
            <div className="rounded-md border border-dashed bg-muted/20 px-2.5 py-2 text-[10px] text-muted-foreground">
              Press the lowest key on your keyboard to capture, then the highest. You can also type
              a MIDI number or nudge with the arrows. Stardust derives the key count from the range.
            </div>
            <LearnableNoteField
              label="Lowest key"
              value={cfg?.lowNote}
              onChange={(n) => onUpdate({ config: { lowNote: n } })}
              capture={captureNote((note) => ({ lowNote: note }))}
            />
            <LearnableNoteField
              label="Highest key"
              value={cfg?.highNote}
              onChange={(n) => onUpdate({ config: { highNote: n } })}
              capture={captureNote((note) => ({ highNote: note }))}
            />
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs">
              <span className="text-muted-foreground">Derived:</span>{" "}
              <span className="font-mono font-semibold">
                {keyCount(cfg?.lowNote, cfg?.highNote) !== undefined
                  ? `${keyCount(cfg?.lowNote, cfg?.highNote)} keys`
                  : "—"}
              </span>
            </div>
          </Group>
        )}

        {kind === "pads" && (
          <PadsSettings
            cfg={cfg}
            onUpdate={onUpdate}
            capturePadNote={(idx) =>
              captureNote((note) => {
                const next = [...(cfg?.padNotes ?? [])]
                while (next.length <= idx) next.push(null)
                next[idx] = note
                return { padNotes: next }
              })
            }
          />
        )}

        {kind === "switch" && (
          <Group title="Switch">
            <LearnableField
              label="MIDI source"
              value={sourceLabel(cfg)}
              placeholder="Press the switch to capture"
              capture={captureSource}
            />
            <FieldRow>
              <Label className="text-xs">Behaviour</Label>
              <Select
                value={cfg?.switchMode ?? "momentary"}
                onValueChange={(v) =>
                  onUpdate({ config: { switchMode: v as "momentary" | "toggle" } })
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
        )}

        {kind === "sustain-pedal" && (
          <Group title="Sustain pedal">
            <LearnableField
              label="MIDI source"
              value={sourceLabel(cfg)}
              placeholder="Press the sustain pedal to capture"
              capture={captureSource}
            />
            <div className="text-[10px] text-muted-foreground">
              Sustain pedals are always momentary — held = sustain on.
            </div>
          </Group>
        )}

        {kind === "expression-pedal" && (
          <Group title="Expression pedal">
            <LearnableField
              label="MIDI source"
              value={sourceLabel(cfg)}
              placeholder="Sweep the pedal to capture"
              capture={captureSource}
            />
            <FieldRow>
              <Label className="text-xs">Polarity</Label>
              <Select
                value={cfg?.polarity ?? "normal"}
                onValueChange={(v) =>
                  onUpdate({ config: { polarity: v as "normal" | "inverted" } })
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
                  value={cfg?.expressionMin ?? 0}
                  onChange={(e) =>
                    onUpdate({
                      config: {
                        expressionMin: Math.max(0, Math.min(127, Number(e.target.value) || 0)),
                      },
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
                  value={cfg?.expressionMax ?? 127}
                  onChange={(e) =>
                    onUpdate({
                      config: {
                        expressionMax: Math.max(0, Math.min(127, Number(e.target.value) || 127)),
                      },
                    })
                  }
                  className="h-8 w-20 text-xs"
                />
              </FieldRow>
            </div>
          </Group>
        )}

        {kind === "pitch-wheel" && (
          <Group title="Pitch wheel">
            <LearnableField
              label="MIDI source"
              value={sourceLabel(cfg)}
              placeholder="Move the pitch wheel to capture"
              capture={captureSource}
            />
            <FieldRow>
              <Label className="text-xs">Bend range (semitones)</Label>
              <Input
                type="number"
                min={1}
                max={24}
                value={cfg?.pitchRangeSemitones ?? 2}
                onChange={(e) =>
                  onUpdate({
                    config: {
                      pitchRangeSemitones: Math.max(1, Math.min(24, Number(e.target.value) || 2)),
                    },
                  })
                }
                className="h-8 w-20 text-xs"
              />
            </FieldRow>
          </Group>
        )}

        {kind === "mod-wheel" && (
          <Group title="Mod wheel">
            <LearnableField
              label="MIDI source"
              value={sourceLabel(cfg)}
              placeholder="Move the mod wheel to capture"
              capture={captureSource}
            />
          </Group>
        )}

        {(kind === "knob" || kind === "fader") && (
          <Group title={kind === "knob" ? "Knob" : "Fader"}>
            <LearnableField
              label="MIDI source"
              value={sourceLabel(cfg)}
              placeholder={`Move the ${kind} to capture`}
              capture={captureSource}
            />
            <FieldRow>
              <Label className="text-xs">Range mode</Label>
              <Select
                value={cfg?.controlRange ?? "absolute"}
                onValueChange={(v) =>
                  onUpdate({ config: { controlRange: v as "absolute" | "relative" } })
                }
              >
                <SelectTrigger className="h-8 w-40 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="absolute">Absolute (0–127)</SelectItem>
                  <SelectItem value="relative">
                    {kind === "knob" ? "Relative (endless encoder)" : "Relative (delta)"}
                  </SelectItem>
                </SelectContent>
              </Select>
            </FieldRow>
          </Group>
        )}

        <div className="h-px bg-border" />

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

function Group({ title, children }: { title: string; children: React.ReactNode }) {
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

// -----------------------------------------------------------------------------
// Pads — grid config + per-pad note Learn
// -----------------------------------------------------------------------------

function PadsSettings({
  cfg,
  onUpdate,
  capturePadNote,
}: {
  cfg: RigComponentConfig | undefined
  onUpdate: (patch: UpdatePatch) => void
  capturePadNote: (idx: number) => (signal: AbortSignal) => Promise<number | undefined>
}) {
  const rows = cfg?.rows ?? 4
  const cols = cfg?.cols ?? 4
  const padNotes = cfg?.padNotes ?? []
  const learnedCount = padNotes.filter((n) => n !== null && n !== undefined).length

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
            onChange={(e) =>
              onUpdate({ config: { rows: Math.max(1, Math.min(16, Number(e.target.value) || 1)) } })
            }
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
            onChange={(e) =>
              onUpdate({ config: { cols: Math.max(1, Math.min(16, Number(e.target.value) || 1)) } })
            }
            className="h-8 w-20 text-xs"
          />
        </FieldRow>
        <div className="ml-auto text-[10px] text-muted-foreground">
          {learnedCount} / {rows * cols} learned
        </div>
      </div>

      <div className="rounded-md border border-dashed bg-muted/20 px-2.5 py-2 text-[10px] text-muted-foreground">
        Click a cell, then hit the corresponding pad on your hardware. Each cell captures its own
        MIDI note.
      </div>

      <div
        role="group"
        aria-label="Pad note assignments"
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: rows * cols }).map((_, idx) => (
          <PadLearnCell key={idx} index={idx} note={padNotes[idx]} capture={capturePadNote(idx)} />
        ))}
      </div>

      {learnedCount > 0 && (
        <Button
          size="sm"
          variant="ghost"
          className="self-start text-xs text-muted-foreground hover:text-foreground"
          onClick={() => onUpdate({ config: { padNotes: [] } })}
        >
          Clear all assignments
        </Button>
      )}
    </Group>
  )
}

function PadLearnCell({
  index,
  note,
  capture,
}: {
  index: number
  note: number | null | undefined
  capture: (signal: AbortSignal) => Promise<number | undefined>
}) {
  const [listening, setListening] = React.useState(false)
  // Ref keeps an in-flight listen stable across parent re-renders (the
  // capture closure is re-created every render).
  const captureRef = React.useRef(capture)
  React.useEffect(() => {
    captureRef.current = capture
  })
  React.useEffect(() => {
    if (!listening) return
    const controller = new AbortController()
    void captureRef.current(controller.signal).then(() => {
      if (!controller.signal.aborted) setListening(false)
    })
    return () => controller.abort()
  }, [listening])

  const learned = note !== null && note !== undefined
  return (
    <button
      type="button"
      onClick={() => setListening((s) => !s)}
      aria-label={
        learned
          ? `Pad ${index + 1}: ${noteLabel(note)} (MIDI ${note}). Press to re-learn.`
          : `Pad ${index + 1}: not learned. Press to learn.`
      }
      className={cn(
        "grid aspect-square place-items-center rounded-md font-mono text-[10px] transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        listening
          ? "animate-pulse border border-destructive bg-destructive/10 text-destructive"
          : learned
            ? "border border-primary/40 bg-primary/10 text-primary"
            : "border border-dashed border-muted-foreground/30 text-muted-foreground hover:border-foreground/40",
      )}
    >
      {listening ? "···" : learned ? noteLabel(note) : "—"}
    </button>
  )
}
