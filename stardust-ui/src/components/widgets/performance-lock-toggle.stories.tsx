import type { Meta, StoryObj } from "@storybook/react"
import { EndShowButton, PerformanceLockToggle } from "./performance-lock-toggle"

const meta: Meta<typeof PerformanceLockToggle> = {
  title: "Widgets/Performance Lock Toggle",
  component: PerformanceLockToggle,
  parameters: { layout: "centered" },
}
export default meta

export const Idle: StoryObj<typeof PerformanceLockToggle> = { args: { locked: false } }
export const Live: StoryObj<typeof PerformanceLockToggle> = { args: { locked: true } }

export const PairWithEndShow: StoryObj<typeof PerformanceLockToggle> = {
  name: "Live + End Show pair",
  render: () => (
    <div className="flex items-center gap-3">
      <PerformanceLockToggle locked />
      <EndShowButton />
    </div>
  ),
}
