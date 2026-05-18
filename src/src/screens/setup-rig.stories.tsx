import type { Meta, StoryObj } from "@storybook/react"
import * as React from "react"
import { Trash2 } from "lucide-react"
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
import { Keyboard } from "@/components/rig/keyboard"
import { Pads } from "@/components/rig/pads"
import { Footswitch } from "@/components/rig/footswitch"
import { ExpressionPedal } from "@/components/rig/expression-pedal"
import { DeviceLibrary } from "@/components/rig/device-library"
import {
  MOCK_CONNECTED_DEVICE_IDS,
  findSpec,
  type RigDeviceSpec,
} from "@/components/rig/_catalog"
import { cn } from "@/lib/utils"

const meta: Meta = {
  title: "Screens/Setup/Rig",
  parameters: { layout: "fullscreen" },
}
export default meta
type Story = StoryObj

// =============================================================================
// State model — placed devices are catalog specs with an instance id
// =============================================================================

interface PlacedDevice {
  instanceId: string
  /** Per-instance display name (defaults to vendor + model) */
  name: string
  spec: RigDeviceSpec
  /** MIDI channel for this instance */
  midiChannel: number
}

let nextInstanceId = 1
function placeDevice(spec: RigDeviceSpec): PlacedDevice {
  return {
    instanceId: `inst-${nextInstanceId++}`,
    name: `${spec.vendor} ${spec.model}`,
    spec,
    midiChannel: 1,
  }
}

// Seed the populated demo with the connected RD-2000 already in the rig.
function makeSeed(): PlacedDevice[] {
  const rd = findSpec("rd-2000")
  return rd ? [placeDevice(rd)] : []
}

// =============================================================================
// Story — populated rig
// =============================================================================

export const RigOverview: Story = {
  name: "Rig setup (library + canvas + inspector)",
  render: () => {
    const [mode, setMode] = React.useState<AppMode>("setup")
    const [placed, setPlaced] = React.useState<PlacedDevice[]>(makeSeed)
    const [selectedId, setSelectedId] = React.useState<string | undefined>(
      () => makeSeed()[0]?.instanceId
    )
    const [tab, setTab] = React.useState<"settings" | "library">("library")

    return (
      <RigSetupShell
        mode={mode}
        setMode={setMode}
        placed={placed}
        setPlaced={setPlaced}
        selectedId={selectedId}
        setSelectedId={setSelectedId}
        tab={tab}
        setTab={setTab}
        showName="Little Shop of Horrors"
      />
    )
  },
}

export const EmptyRig: Story = {
  name: "Empty rig (first-time setup)",
  render: () => {
    const [mode, setMode] = React.useState<AppMode>("setup")
    const [placed, setPlaced] = React.useState<PlacedDevice[]>([])
    const [selectedId, setSelectedId] = React.useState<string | undefined>(undefined)
    const [tab, setTab] = React.useState<"settings" | "library">("library")

    return (
      <RigSetupShell
        mode={mode}
        setMode={setMode}
        placed={placed}
        setPlaced={setPlaced}
        selectedId={selectedId}
        setSelectedId={setSelectedId}
        tab={tab}
        setTab={setTab}
        showName="Untitled show"
      />
    )
  },
}

// =============================================================================
// Shared shell
// =============================================================================

function RigSetupShell({
  mode,
  setMode,
  placed,
  setPlaced,
  selectedId,
  setSelectedId,
  tab,
  setTab,
  showName,
}: {
  mode: AppMode
  setMode: (m: AppMode) => void
  placed: PlacedDevice[]
  setPlaced: React.Dispatch<React.SetStateAction<PlacedDevice[]>>
  selectedId: string | undefined
  setSelectedId: (id: string | undefined) => void
  tab: "settings" | "library"
  setTab: (t: "settings" | "library") => void
  showName: string
}) {
  const addedSpecIds = React.useMemo(
    () => placed.map((p) => p.spec.id),
    [placed]
  )
  const selected = placed.find((p) => p.instanceId === selectedId)

  const onAddDevice = (spec: RigDeviceSpec) => {
    const dev = placeDevice(spec)
    setPlaced((prev) => [...prev, dev])
    setSelectedId(dev.instanceId)
    setTab("settings")
  }

  const onRemove = (instanceId: string) => {
    setPlaced((prev) => prev.filter((p) => p.instanceId !== instanceId))
    if (selectedId === instanceId) setSelectedId(undefined)
  }

  const onUpdate = (instanceId: string, patch: Partial<PlacedDevice>) => {
    setPlaced((prev) =>
      prev.map((p) => (p.instanceId === instanceId ? { ...p, ...patch } : p))
    )
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
                device={selected}
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
              <DeviceLibrary
                addedIds={addedSpecIds}
                connectedIds={MOCK_CONNECTED_DEVICE_IDS}
                onAddDevice={onAddDevice}
              />
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
// Context-panel: outline of devices in the current rig
// =============================================================================

function RigOutline({
  placed,
  selectedId,
  onSelect,
}: {
  placed: PlacedDevice[]
  selectedId: string | undefined
  onSelect: (id: string) => void
}) {
  return (
    <div className="flex h-full flex-col gap-2 p-2">
      <div className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Rig devices ({placed.length})
      </div>
      {placed.length === 0 ? (
        <div className="grid flex-1 place-items-center px-2 text-center text-xs text-muted-foreground">
          Empty. Add from the Library tab.
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {placed.map((p) => (
            <button
              key={p.instanceId}
              type="button"
              onClick={() => onSelect(p.instanceId)}
              className={cn(
                "flex w-full flex-col rounded-md border bg-card px-2 py-1.5 text-left transition-colors",
                "hover:border-primary/40",
                p.instanceId === selectedId &&
                  "border-primary ring-1 ring-primary/20"
              )}
            >
              <span className="truncate text-xs font-semibold">{p.name}</span>
              <span className="text-[10px] text-muted-foreground">
                ch {p.midiChannel} · {p.spec.kind}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Canvas — visual rig of placed devices
// =============================================================================

function RigCanvas({
  placed,
  selectedId,
  onSelect,
}: {
  placed: PlacedDevice[]
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
            Pick a device from the{" "}
            <span className="font-semibold text-foreground">Library</span> tab
            on the right. Toggle{" "}
            <em>Only types matching connected</em> to narrow the list to gear
            you have plugged in.
          </div>
        </div>
      </div>
    )
  }
  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-4 p-4">
        {placed.map((p) => (
          <DeviceVisualCard
            key={p.instanceId}
            device={p}
            selected={p.instanceId === selectedId}
            onSelect={() => onSelect(p.instanceId)}
          />
        ))}
      </div>
    </ScrollArea>
  )
}

function DeviceVisualCard({
  device,
  selected,
  onSelect,
}: {
  device: PlacedDevice
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
            {device.spec.vendor}
          </div>
          <div className="text-sm font-semibold">{device.name}</div>
        </div>
        <div className="font-mono text-[10px] uppercase text-muted-foreground">
          ch {device.midiChannel}
        </div>
      </div>
      <DeviceVisual spec={device.spec} />
    </button>
  )
}

function DeviceVisual({ spec }: { spec: RigDeviceSpec }) {
  switch (spec.kind) {
    case "keyboard88":
    case "keyboard76":
    case "keyboard61":
    case "keyboard49": {
      const range = keyRange(spec.keys ?? 88)
      return (
        <Keyboard
          fromNote={range.from}
          toNote={range.to}
          whiteKeyWidth={10}
          readOnly
        />
      )
    }
    case "pad-keyboard": {
      const range = keyRange(spec.keys ?? 49)
      return (
        <div className="flex flex-col items-center gap-3">
          {spec.pads && <Pads rows={spec.pads.rows} cols={spec.pads.cols} />}
          <Keyboard
            fromNote={range.from}
            toNote={range.to}
            whiteKeyWidth={10}
            readOnly
          />
        </div>
      )
    }
    case "pad-controller":
      return spec.pads ? (
        <div className="flex justify-center">
          <Pads rows={spec.pads.rows} cols={spec.pads.cols} />
        </div>
      ) : null
    case "footswitch":
      return (
        <div className="flex justify-center">
          <Footswitch label="Sustain" />
        </div>
      )
    case "multi-switch":
      return (
        <div className="flex justify-center gap-4">
          <Footswitch label="A" />
          <Footswitch label="B" />
        </div>
      )
    case "expression-pedal":
      return (
        <div className="flex justify-center">
          <ExpressionPedal value={0.5} label="Expression" />
        </div>
      )
    case "foot-controller":
      return (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {Array.from({ length: Math.min(spec.pedals ?? 4, 6) }).map((_, i) => (
            <Footswitch key={i} label={String(i + 1)} variant="compact" />
          ))}
          {spec.pedals && spec.pedals > 6 && (
            <span className="text-xs text-muted-foreground">
              +{spec.pedals - 6} more
            </span>
          )}
        </div>
      )
    default:
      return (
        <div className="rounded-md border border-dashed bg-muted/20 p-4 text-center text-xs text-muted-foreground">
          Visual representation lands as {spec.kind} support comes online.
        </div>
      )
  }
}

/**
 * Compute fromNote / toNote MIDI numbers for an N-key keyboard, anchoring
 * to the conventional ranges (88 starts at A0; 76 at E1; 61 at C2; 49 at C2).
 */
function keyRange(keys: number): { from: number; to: number } {
  switch (keys) {
    case 88: return { from: 21, to: 108 } // A0 .. C8
    case 76: return { from: 28, to: 103 } // E1 .. G7
    case 73: return { from: 28, to: 100 } // E1 .. E7 (Nord 73)
    case 61: return { from: 36, to: 96 }  // C2 .. C7
    case 49: return { from: 36, to: 84 }  // C2 .. C6
    case 32: return { from: 48, to: 79 }  // C3 .. G5
    default: {
      const from = 36
      const to = Math.min(127, from + keys - 1)
      return { from, to }
    }
  }
}

// =============================================================================
// Settings tab — per-device config (minimal POC fields)
// =============================================================================

function SettingsTab({
  device,
  onUpdate,
  onRemove,
}: {
  device: PlacedDevice | undefined
  onUpdate: (patch: Partial<PlacedDevice>) => void
  onRemove: () => void
}) {
  if (!device) {
    return (
      <Placeholder
        title="No device selected"
        body="Click a device on the canvas (or in the left panel), then configure it here."
      />
    )
  }
  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-4 px-1">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {device.spec.vendor}
          </div>
          <div className="text-sm font-semibold">{device.spec.model}</div>
          <div className="mt-1 text-[10px] text-muted-foreground/80">
            {device.spec.notes ?? "—"}
          </div>
        </div>

        <Separator />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="device-name" className="text-xs">
            Display name
          </Label>
          <Input
            id="device-name"
            value={device.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            className="h-8 text-xs"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="device-channel" className="text-xs">
            MIDI channel
          </Label>
          <Input
            id="device-channel"
            type="number"
            min={1}
            max={16}
            value={device.midiChannel}
            onChange={(e) =>
              onUpdate({
                midiChannel: Math.max(
                  1,
                  Math.min(16, Number(e.target.value) || 1)
                ),
              })
            }
            className="h-8 w-20 text-xs"
          />
        </div>

        <ConnectionsRow spec={device.spec} />

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

function ConnectionsRow({ spec }: { spec: RigDeviceSpec }) {
  const items: string[] = []
  if (spec.hasUsbMidi) items.push("USB MIDI")
  if (spec.hasDinMidi) items.push("DIN MIDI")
  if (spec.hasTrsMidi) items.push("TRS MIDI")
  if (items.length === 0) return null
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-xs text-muted-foreground">Available connections</div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((tag) => (
          <span
            key={tag}
            className="rounded bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  )
}

function Separator() {
  return <div className="h-px bg-border" />
}
