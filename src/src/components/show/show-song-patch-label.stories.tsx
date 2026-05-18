import type { Meta, StoryObj } from "@storybook/react"
import { ShowSongPatchLabel } from "./show-song-patch-label"

const meta: Meta<typeof ShowSongPatchLabel> = {
  title: "Widgets/Show · Song · Patch Label",
  component: ShowSongPatchLabel,
  parameters: { layout: "centered" },
}
export default meta

type Story = StoryObj<typeof ShowSongPatchLabel>

export const Hamilton: Story = {
  args: {
    show: "Hamilton — 2026 Tour",
    song: "My Shot",
    songIndex: 4,
    songTotal: 23,
    patch: "Verse Pad + Bell",
    patchIndex: 2,
    patchTotal: 5,
  },
}

export const CustomLabelNumber: Story = {
  name: "Custom unit label: 'Number'",
  args: {
    show: "Little Shop of Horrors",
    song: "Prologue",
    songIndex: 1,
    songTotal: 14,
    songLabel: "Number",
    patch: "Whistle",
    patchIndex: 1,
    patchTotal: 3,
  },
}

export const CustomLabelCue: Story = {
  name: "Custom unit label: 'Cue'",
  args: {
    show: "The Wild Party",
    song: "Burrs's Entrance",
    songIndex: 7,
    songTotal: 19,
    songLabel: "Cue",
    patch: "Stride Piano",
  },
}
