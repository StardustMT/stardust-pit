import type { Meta, StoryObj } from "@storybook/react"
import * as React from "react"
import type { GraphNode } from "./_types"
import { SourceComponentPicker } from "./source-component-picker"
import type { RigComponentWire } from "@/lib/tauri"

/**
 * Stories for the source-node rig-component picker (#122). Replaces the
 * v2-era Source Binding Inspector stories — raw binding fields no longer
 * exist; nodes reference rig components configured in Setup → Rig.
 */
const meta: Meta = {
  title: "Patch Editor/Source Component Picker",
  parameters: { layout: "centered" },
}
export default meta
type Story = StoryObj

const COMPONENTS: RigComponentWire[] = [
  {
    id: "rc-1",
    kind: "source.keyboard",
    name: "Nord Stage 3 keys",
    config: {
      device: { id: "port-1", name: "Nord Stage 3 MIDI" },
      channel: 1,
      lowNote: 21,
      highNote: 108,
    },
  },
  {
    id: "rc-2",
    kind: "source.keyboard",
    name: "Second keyboard",
    config: { channel: 2 },
  },
  {
    id: "rc-3",
    kind: "source.sustain-pedal",
    name: "Sustain",
    config: { device: { id: "port-1", name: "Nord Stage 3 MIDI" }, source: { type: "cc", cc: 64 } },
  },
]

function sourceNode(componentId?: string): GraphNode {
  return {
    id: "kbd-1",
    kind: "source.keyboard",
    name: "Main keyboard",
    x: 0,
    y: 0,
    ports: [{ id: "out", label: "MIDI out", signal: "midi", direction: "out" }],
    config: componentId ? { rigComponentId: componentId } : undefined,
  }
}

function Interactive({ initial }: { initial?: string }) {
  const [node, setNode] = React.useState(() => sourceNode(initial))
  return (
    <div className="dark w-80 rounded-md border bg-background p-3 text-foreground">
      <SourceComponentPicker
        node={node}
        components={COMPONENTS}
        onChange={(id) =>
          setNode((n) => ({ ...n, config: id ? { rigComponentId: id } : undefined }))
        }
        onOpenRigScreen={() => {}}
      />
    </div>
  )
}

export const AssignedToBoundComponent: Story = {
  name: "Assigned (bound component)",
  render: () => <Interactive initial="rc-1" />,
}

export const AssignedToUnboundComponent: Story = {
  name: "Assigned (component has no device)",
  render: () => <Interactive initial="rc-2" />,
}

export const Unassigned: Story = {
  name: "Unassigned (silent + flagged)",
  render: () => <Interactive />,
}

export const DanglingReference: Story = {
  name: "Deleted component (dangling reference)",
  render: () => <Interactive initial="rc-gone" />,
}
