import type { Meta, StoryObj } from "@storybook/react"
import * as React from "react"
import { Keyboard, type KeyboardZone } from "./keyboard"

const meta: Meta<typeof Keyboard> = {
  title: "Rig/Keyboard",
  component: Keyboard,
  parameters: { layout: "fullscreen" },
}
export default meta
type Story = StoryObj<typeof Keyboard>

function InteractiveKeyboard({
  initialZones,
  fromNote,
  toNote,
}: {
  initialZones: KeyboardZone[]
  fromNote?: number
  toNote?: number
}) {
  const [zones, setZones] = React.useState(initialZones)
  const [selectedId, setSelectedId] = React.useState<string | undefined>(initialZones[0]?.id)
  return (
    <div className="dark bg-background p-8">
      <Keyboard
        zones={zones}
        fromNote={fromNote}
        toNote={toNote}
        selectedZoneId={selectedId}
        onZoneSelect={setSelectedId}
        onZoneChange={(id, range) =>
          setZones((zs) => zs.map((z) => (z.id === id ? { ...z, ...range } : z)))
        }
      />
      <div className="mt-3 font-mono text-xs text-muted-foreground">
        Drag zone edges to resize · drag middle to translate · click to select
      </div>
    </div>
  )
}

export const Idle: Story = {
  render: () => (
    <div className="dark bg-background p-8">
      <Keyboard />
    </div>
  ),
}

export const InteractiveSplit2: Story = {
  name: "Interactive 2-zone split",
  render: () => (
    <InteractiveKeyboard
      initialZones={[
        { id: "bass", label: "Synth bass", fromNote: 24, toNote: 47 },
        { id: "pad", label: "String pad", fromNote: 48, toNote: 84 },
      ]}
    />
  ),
}

export const InteractiveSplit3: Story = {
  name: "Interactive 3-zone split",
  render: () => (
    <InteractiveKeyboard
      initialZones={[
        { id: "bass", label: "Wurli bass", fromNote: 24, toNote: 43 },
        { id: "ep", label: "Rhodes EP", fromNote: 44, toNote: 71 },
        { id: "lead", label: "Lead synth", fromNote: 72, toNote: 96 },
      ]}
    />
  ),
}

export const ReadOnly: Story = {
  name: "Read-only (no drag handles)",
  render: () => (
    <div className="dark bg-background p-8">
      <Keyboard
        readOnly
        zones={[
          { id: "bass", label: "Bass", fromNote: 24, toNote: 47 },
          { id: "lead", label: "Lead", fromNote: 60, toNote: 84 },
        ]}
        active={[
          { note: 36, velocity: 95, zoneId: "bass" },
          { note: 67, velocity: 80, zoneId: "lead" },
          { note: 72, velocity: 80, zoneId: "lead" },
        ]}
      />
    </div>
  ),
}

export const Range61: Story = {
  name: "Launchkey 49 range (C2 – C6)",
  render: () => (
    <InteractiveKeyboard
      fromNote={36}
      toNote={84}
      initialZones={[{ id: "rhodes", label: "Rhodes EP (Launchkey)", fromNote: 36, toNote: 84 }]}
    />
  ),
}
