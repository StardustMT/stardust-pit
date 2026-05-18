import type { Meta, StoryObj } from "@storybook/react"
import { PanicButton } from "./panic-button"

const meta: Meta<typeof PanicButton> = {
  title: "Widgets/Panic Button",
  component: PanicButton,
  parameters: { layout: "centered" },
  argTypes: { size: { control: "select", options: ["default", "lg", "xl"] } },
}
export default meta

export const Default: StoryObj<typeof PanicButton> = { args: {} }
export const Large: StoryObj<typeof PanicButton> = { args: { size: "lg" } }
export const StagePanic: StoryObj<typeof PanicButton> = {
  name: "Stage size (xl)",
  args: { size: "xl" },
}
