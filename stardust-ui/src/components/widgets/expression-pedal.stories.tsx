import type { Meta, StoryObj } from "@storybook/react"
import { ExpressionPedal } from "./expression-pedal"

const meta: Meta<typeof ExpressionPedal> = {
  title: "Widgets/Expression Pedal",
  component: ExpressionPedal,
  parameters: { layout: "centered" },
}
export default meta

export const Heel: StoryObj<typeof ExpressionPedal> = {
  args: { value: 0.05, binding: "→ Master volume" },
}
export const Mid: StoryObj<typeof ExpressionPedal> = {
  args: { value: 0.55, binding: "→ Filter cutoff" },
}
export const Toe: StoryObj<typeof ExpressionPedal> = {
  args: { value: 1.0, binding: "→ Master volume" },
}
