import type { Meta, StoryObj } from "@storybook/react"
import * as React from "react"
import type { GraphNode, HardwareBinding } from "./_types"
import { type MidiDeviceOption, SourceBindingInspector } from "./source-binding-inspector"

/**
 * Hardware-binding inspector for a source node (#2). Storybook drives it
 * with a mock device list — the live app enumerates real midir devices.
 */
const meta: Meta<typeof SourceBindingInspector> = {
  title: "Patch Editor/Source Binding Inspector",
  component: SourceBindingInspector,
  parameters: { layout: "centered" },
}
export default meta

const MOCK_DEVICES: MidiDeviceOption[] = [
  { name: "Yamaha P-125 (USB)", id: "mock-yamaha-p125", connected: true },
  { name: "Roland RD-2000 MIDI 1", id: "mock-roland-rd2000", connected: true },
  { name: "nanoKONTROL2", id: "mock-korg-nano", connected: true },
]

function sourceNode(kind: GraphNode["kind"], binding?: HardwareBinding): GraphNode {
  return {
    id: "n1",
    kind,
    name: "Keyboard",
    x: 0,
    y: 0,
    ports: [{ id: "out", label: "MIDI out", signal: "midi", direction: "out" }],
    config: binding ? { hardwareBinding: binding } : undefined,
  }
}

function Stateful({
  initial,
  devices,
  kind = "source.keyboard",
}: {
  initial?: HardwareBinding
  devices: MidiDeviceOption[]
  kind?: GraphNode["kind"]
}) {
  const [node, setNode] = React.useState(() => sourceNode(kind, initial))
  return (
    <div className="w-80 rounded-xl border bg-card p-4">
      <SourceBindingInspector
        node={node}
        devices={devices}
        onChange={(binding) =>
          setNode((n) => ({
            ...n,
            config: binding ? { ...n.config, hardwareBinding: binding } : n.config,
          }))
        }
      />
    </div>
  )
}

export const Unbound: StoryObj = {
  render: () => <Stateful devices={MOCK_DEVICES} />,
}

export const BoundWithNoteRange: StoryObj = {
  name: "Bound + note range",
  render: () => (
    <Stateful
      devices={MOCK_DEVICES}
      initial={{
        deviceId: "mock-yamaha-p125",
        deviceName: "Yamaha P-125 (USB)",
        channel: null,
        noteRange: [21, 108],
      }}
    />
  ),
}

export const DisconnectedDevice: StoryObj = {
  name: "Bound device disconnected",
  render: () => (
    <Stateful
      devices={MOCK_DEVICES.map((d) =>
        d.id === "mock-yamaha-p125" ? { ...d, connected: false } : d,
      )}
      initial={{
        deviceId: "mock-yamaha-p125",
        deviceName: "Yamaha P-125 (USB)",
        channel: 1,
        noteRange: [21, 108],
      }}
    />
  ),
}

export const PedalWithChannel: StoryObj = {
  name: "Sustain pedal, channel-filtered",
  render: () => (
    <Stateful
      kind="source.sustain-pedal"
      devices={MOCK_DEVICES}
      initial={{
        deviceId: "mock-roland-rd2000",
        deviceName: "Roland RD-2000 MIDI 1",
        channel: 2,
      }}
    />
  ),
}
