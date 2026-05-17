import type { Meta, StoryObj } from "@storybook/react"
import { TimeElapsed } from "./time-elapsed"

const meta: Meta<typeof TimeElapsed> = {
  title: "Widgets/Time Elapsed",
  component: TimeElapsed,
  parameters: { layout: "centered" },
}
export default meta

export const Default: StoryObj<typeof TimeElapsed> = { args: { seconds: 187 } }
export const WithRemaining: StoryObj<typeof TimeElapsed> = {
  args: { seconds: 187, totalSeconds: 312 },
}
