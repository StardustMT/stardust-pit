import type { Meta, StoryObj } from "@storybook/react"
import { NextPatchPreview } from "./next-patch-preview"

const meta: Meta<typeof NextPatchPreview> = {
  title: "Widgets/Next Patch Preview",
  component: NextPatchPreview,
  parameters: { layout: "centered" },
}
export default meta

export const Next: StoryObj<typeof NextPatchPreview> = {
  args: { name: "Sustained Pad", subtitle: "Diva + Supermassive · crossfade 800 ms" },
}

export const Previous: StoryObj<typeof NextPatchPreview> = {
  args: { direction: "Previous", name: "Celeste Bells", subtitle: "MuseSounds Celeste" },
}
