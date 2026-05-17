import type { Meta, StoryObj } from "@storybook/react"
import { Footswitch, FootswitchArray } from "./footswitch"

const meta: Meta<typeof Footswitch> = {
  title: "Widgets/Footswitch",
  component: Footswitch,
  parameters: { layout: "centered" },
}
export default meta

export const Inactive: StoryObj<typeof Footswitch> = {
  args: { label: "FS1", binding: "→ Patch +1" },
}
export const Pressed: StoryObj<typeof Footswitch> = {
  args: { label: "FS1", active: true, binding: "→ Patch +1" },
}

export const FullArray: StoryObj<typeof FootswitchArray> = {
  name: "Four-switch FCB1010 layout",
  render: () => (
    <FootswitchArray
      switches={[
        { label: "FS1", binding: "Patch +1" },
        { label: "FS2", binding: "Patch −1" },
        { label: "FS3", active: true, binding: "Panic" },
        { label: "FS4", binding: "Tap tempo" },
      ]}
    />
  ),
}
