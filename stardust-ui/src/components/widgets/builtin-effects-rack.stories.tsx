import type { Meta, StoryObj } from "@storybook/react"
import { BuiltinEffectsRack } from "./builtin-effects-rack"

const meta: Meta<typeof BuiltinEffectsRack> = {
  title: "Widgets/Built-in Effects Rack",
  component: BuiltinEffectsRack,
  parameters: { layout: "padded" },
}
export default meta

export const Default: StoryObj<typeof BuiltinEffectsRack> = {
  render: () => (
    <div className="w-[820px]">
      <BuiltinEffectsRack />
    </div>
  ),
}
