import type { Meta, StoryObj } from "@storybook/react"
import * as React from "react"
import { Pads, type PadAssignment } from "./pads"

const meta: Meta<typeof Pads> = {
  title: "Rig/Pads",
  component: Pads,
  parameters: { layout: "centered" },
}
export default meta
type Story = StoryObj<typeof Pads>

export const LaunchkeyEmpty: Story = {
  name: "Launchkey 16-pad · idle",
  render: () => (
    <div className="dark bg-background p-8">
      <Pads rows={2} cols={8} />
    </div>
  ),
}

export const LaunchkeyAssigned: Story = {
  name: "Launchkey 16-pad · assigned",
  render: () => {
    const [selected, setSelected] = React.useState<number | undefined>(0)
    const assignments: PadAssignment[] = [
      { padIndex: 0, soundId: "kick", color: "var(--chart-1)", label: "Kick" },
      { padIndex: 1, soundId: "snare", color: "var(--chart-2)", label: "Snare" },
      { padIndex: 2, soundId: "hat-c", color: "var(--chart-3)", label: "HH cl" },
      { padIndex: 3, soundId: "hat-o", color: "var(--chart-3)", label: "HH op" },
      { padIndex: 4, soundId: "perc1", color: "var(--chart-4)", label: "Cl" },
      { padIndex: 5, soundId: "perc2", color: "var(--chart-4)", label: "Cw" },
      { padIndex: 6, soundId: "perc3", color: "var(--chart-4)", label: "Tmb" },
      { padIndex: 8, soundId: "stab", color: "var(--chart-5)", label: "Stab" },
      { padIndex: 9, soundId: "vox", color: "var(--chart-2)", label: "Vox" },
    ]
    return (
      <div className="dark bg-background p-8">
        <Pads
          rows={2}
          cols={8}
          assignments={assignments}
          selectedPadIndex={selected}
          onSelectPad={setSelected}
        />
      </div>
    )
  },
}

export const OctapadStyle: Story = {
  name: "Octapad-style · 1 row of 8",
  render: () => (
    <div className="dark bg-background p-8">
      <Pads
        rows={1}
        cols={8}
        active={[2, 5]}
        assignments={[
          { padIndex: 0, soundId: "x", color: "var(--chart-1)", label: "Kit A" },
          { padIndex: 1, soundId: "y", color: "var(--chart-2)", label: "Kit B" },
          { padIndex: 2, soundId: "z", color: "var(--chart-3)", label: "Aux" },
          { padIndex: 5, soundId: "w", color: "var(--chart-5)", label: "Trig" },
        ]}
      />
    </div>
  ),
}
