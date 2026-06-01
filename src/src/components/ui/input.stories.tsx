import type { Meta, StoryObj } from "@storybook/react"
import { Input } from "./input"
import { Label } from "./label"

const meta: Meta<typeof Input> = {
  title: "UI/Input",
  component: Input,
  parameters: { layout: "centered" },
}
export default meta

export const Default: StoryObj<typeof Input> = {
  render: () => (
    <div className="grid w-[320px] gap-2">
      <Label htmlFor="show-name">Show name</Label>
      <Input id="show-name" placeholder="Little Shop of Horrors" />
    </div>
  ),
}
