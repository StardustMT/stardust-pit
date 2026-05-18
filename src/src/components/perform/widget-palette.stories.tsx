import type { Meta, StoryObj } from "@storybook/react"
import { WidgetPalette } from "./widget-palette"

const meta: Meta<typeof WidgetPalette> = {
  title: "Widgets/Widget Palette",
  component: WidgetPalette,
  parameters: { layout: "padded" },
}
export default meta

export const Default: StoryObj<typeof WidgetPalette> = { args: {} }
