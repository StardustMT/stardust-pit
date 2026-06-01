import type { Meta, StoryObj } from "@storybook/react"
import { Slider } from "./slider"

const meta: Meta<typeof Slider> = {
  title: "UI/Slider",
  component: Slider,
  parameters: { layout: "centered" },
}
export default meta

export const ParameterValue: StoryObj<typeof Slider> = {
  render: () => (
    <div className="w-[320px] space-y-2">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">Filter cutoff</span>
        <span className="font-mono">62%</span>
      </div>
      <Slider defaultValue={[62]} max={100} step={1} />
    </div>
  ),
}
