import type { Meta, StoryObj } from "@storybook/react"
import { ClickIndicator } from "./click-indicator"

const meta: Meta<typeof ClickIndicator> = {
  title: "Widgets/Click Indicator",
  component: ClickIndicator,
  parameters: { layout: "centered" },
}
export default meta

export const FourFour: StoryObj<typeof ClickIndicator> = {
  args: { bpm: 120, currentBeat: 1, beatsPerBar: 4 },
}
export const ThreeFour: StoryObj<typeof ClickIndicator> = {
  args: { bpm: 92, currentBeat: 2, beatsPerBar: 3, timeSignature: [3, 4] },
}
export const SixEight: StoryObj<typeof ClickIndicator> = {
  args: { bpm: 72, currentBeat: 4, beatsPerBar: 6, timeSignature: [6, 8] },
}
export const Stopped: StoryObj<typeof ClickIndicator> = {
  args: { bpm: 120, currentBeat: null },
}
