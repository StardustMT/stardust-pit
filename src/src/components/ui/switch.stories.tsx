import type { Meta, StoryObj } from "@storybook/react"
import { Switch } from "./switch"
import { Label } from "./label"

const meta: Meta<typeof Switch> = {
  title: "UI/Switch",
  component: Switch,
  parameters: { layout: "centered" },
}
export default meta

export const PerformanceLock: StoryObj<typeof Switch> = {
  render: () => (
    <div className="flex items-center gap-3">
      <Switch id="perf-lock" defaultChecked />
      <Label htmlFor="perf-lock">Performance Lock</Label>
    </div>
  ),
}
