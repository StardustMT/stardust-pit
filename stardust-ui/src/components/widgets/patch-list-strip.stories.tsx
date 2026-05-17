import type { Meta, StoryObj } from "@storybook/react"
import { PatchListStrip } from "./patch-list-strip"

const meta: Meta<typeof PatchListStrip> = {
  title: "Widgets/Patch List Strip",
  component: PatchListStrip,
  parameters: { layout: "padded" },
}
export default meta

type Story = StoryObj<typeof PatchListStrip>

const PROLOGUE = [
  { id: "1", name: "Whistle", subtitle: "Spitfire Solo Strings" },
  { id: "2", name: "Celeste Bells", subtitle: "MuseSounds Celeste" },
  { id: "3", name: "Sustained Pad", subtitle: "Diva + Supermassive" },
]

const LONG_SHOW = Array.from({ length: 12 }, (_, i) => ({
  id: String(i + 1),
  name: ["Verse", "Pre-chorus", "Chorus", "Bridge", "Outro"][i % 5] + " " + Math.ceil((i + 1) / 5),
  subtitle: ["Strings", "Pad", "Brass", "Solo synth", "Piano"][i % 5],
}))

export const ShortSong: Story = {
  args: { patches: PROLOGUE, currentIndex: 0 },
}

export const MidSong: Story = {
  args: { patches: PROLOGUE, currentIndex: 1 },
}

export const LongScrollable: Story = {
  args: { patches: LONG_SHOW, currentIndex: 5 },
}
