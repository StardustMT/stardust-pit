import type { Meta, StoryObj } from "@storybook/react"
import * as React from "react"
import { SoundFlow, type SoundBlock } from "./sound-flow"

const meta: Meta<typeof SoundFlow> = {
  title: "Sound/Sound Flow",
  component: SoundFlow,
  parameters: { layout: "padded" },
}
export default meta
type Story = StoryObj<typeof SoundFlow>

function Demo({ blocks, advanced }: { blocks: SoundBlock[]; advanced?: boolean }) {
  const [selectedId, setSelectedId] = React.useState<string | undefined>(blocks[0]?.id)
  return (
    <div className="dark bg-background p-6 text-foreground">
      <SoundFlow
        blocks={blocks}
        selectedId={selectedId}
        onSelectBlock={setSelectedId}
        advanced={advanced}
      />
    </div>
  )
}

export const SingleInstrument: Story = {
  render: () => (
    <Demo
      blocks={[
        { kind: "instrument", id: "diva", name: "Diva", vendor: "u-he", format: "VST3", cpu: 0.12 },
      ]}
    />
  ),
}

export const InstrumentPlusEffects: Story = {
  render: () => (
    <Demo
      blocks={[
        { kind: "instrument", id: "diva", name: "Diva", vendor: "u-he", format: "VST3", cpu: 0.18 },
        { kind: "effect", id: "eq", name: "EQ", format: "built-in" },
        {
          kind: "effect",
          id: "reverb",
          name: "Valhalla Supermassive",
          vendor: "Valhalla DSP",
          format: "VST3",
          cpu: 0.04,
        },
        {
          kind: "effect",
          id: "limit",
          name: "Pro-L 2",
          vendor: "FabFilter",
          format: "VST3",
          cpu: 0.02,
        },
      ]}
    />
  ),
}

export const Advanced: Story = {
  name: "Advanced view (CPU + format badges)",
  render: () => (
    <Demo
      advanced
      blocks={[
        { kind: "instrument", id: "diva", name: "Diva", vendor: "u-he", format: "VST3", cpu: 0.18 },
        { kind: "effect", id: "eq", name: "EQ", format: "built-in" },
        {
          kind: "effect",
          id: "reverb",
          name: "Valhalla Supermassive",
          vendor: "Valhalla DSP",
          format: "VST3",
          cpu: 0.04,
        },
        {
          kind: "effect",
          id: "limit",
          name: "Pro-L 2",
          vendor: "FabFilter",
          format: "VST3",
          cpu: 0.02,
        },
      ]}
    />
  ),
}

export const Layered: Story = {
  name: "Layered instruments (organ-stop style)",
  render: () => (
    <Demo
      blocks={[
        {
          kind: "instrument",
          id: "low",
          name: "B3 — drawbars 88 8000 000",
          vendor: "GG Audio",
          format: "VST3",
          cpu: 0.06,
        },
        {
          kind: "instrument",
          id: "high",
          name: "B3 — perc 3rd",
          vendor: "GG Audio",
          format: "VST3",
          cpu: 0.03,
        },
        { kind: "effect", id: "leslie", name: "Leslie", format: "built-in" },
      ]}
    />
  ),
}

export const Empty: Story = {
  name: "Empty (no instrument yet)",
  render: () => <Demo blocks={[]} />,
}

export const WithWarning: Story = {
  render: () => (
    <Demo
      blocks={[
        { kind: "warning", id: "missing", message: "BBC SO Discover not installed" },
        { kind: "effect", id: "eq", name: "EQ", format: "built-in" },
      ]}
    />
  ),
}
