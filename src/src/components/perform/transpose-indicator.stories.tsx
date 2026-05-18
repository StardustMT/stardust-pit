import type { Meta, StoryObj } from "@storybook/react"
import { TransposeIndicator } from "./transpose-indicator"

const meta: Meta<typeof TransposeIndicator> = {
  title: "Widgets/Transpose Indicator",
  component: TransposeIndicator,
  parameters: { layout: "centered" },
}
export default meta

export const NoTranspose: StoryObj<typeof TransposeIndicator> = { args: { semitones: 0 } }
export const Up: StoryObj<typeof TransposeIndicator> = { args: { semitones: 2 } }
export const Down: StoryObj<typeof TransposeIndicator> = { args: { semitones: -3 } }
export const WithKeys: StoryObj<typeof TransposeIndicator> = {
  args: { semitones: 2, fromKey: "Eb", toKey: "F" },
}
