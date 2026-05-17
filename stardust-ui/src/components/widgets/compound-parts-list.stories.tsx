import type { Meta, StoryObj } from "@storybook/react"
import { CompoundPartsList } from "./compound-parts-list"

const meta: Meta<typeof CompoundPartsList> = {
  title: "Widgets/Compound Parts List",
  component: CompoundPartsList,
  parameters: { layout: "centered" },
}
export default meta

export const KeyboardSplit: StoryObj<typeof CompoundPartsList> = {
  render: () => (
    <div className="w-[420px] bg-background p-4">
      <CompoundPartsList
        parts={[
          {
            id: "bass",
            name: "Wurli Bass",
            color: "var(--chart-1)",
            range: { fromNote: 24, toNote: 43 },
            level: 0.85,
            receiving: true,
          },
          {
            id: "pad",
            name: "Rhodes EP",
            color: "var(--chart-2)",
            range: { fromNote: 44, toNote: 71 },
            level: 0.7,
          },
          {
            id: "lead",
            name: "Lead Synth",
            color: "var(--chart-4)",
            range: { fromNote: 72, toNote: 96 },
            level: 0.6,
            soloed: true,
          },
        ]}
      />
    </div>
  ),
}

export const ControllerSplit: StoryObj<typeof CompoundPartsList> = {
  name: "Multi-controller compound (octopad scenario)",
  render: () => (
    <div className="w-[420px] bg-background p-4">
      <CompoundPartsList
        parts={[
          {
            id: "kit",
            name: "Drum kit",
            color: "var(--chart-1)",
            controller: { label: "Octapad SPD-30 · ch 10" },
            level: 0.9,
            receiving: true,
          },
          {
            id: "perc",
            name: "Aux percussion",
            color: "var(--chart-3)",
            controller: { label: "Octapad SPD-30 · ch 11" },
            level: 0.6,
          },
          {
            id: "trigger",
            name: "Backing triggers",
            color: "var(--chart-5)",
            controller: { label: "Octapad SPD-30 · ch 12" },
            level: 0.5,
            muted: true,
          },
        ]}
      />
    </div>
  ),
}
