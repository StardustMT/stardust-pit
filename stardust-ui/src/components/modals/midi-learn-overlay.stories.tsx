import type { Meta, StoryObj } from "@storybook/react"
import { MidiLearnOverlay } from "./midi-learn-overlay"

const meta: Meta<typeof MidiLearnOverlay> = {
  title: "Modals/MIDI Learn Overlay",
  component: MidiLearnOverlay,
  parameters: { layout: "fullscreen" },
}
export default meta

export const Listening: StoryObj<typeof MidiLearnOverlay> = {
  args: { target: "Diva · Filter cutoff" },
}

export const Captured: StoryObj<typeof MidiLearnOverlay> = {
  args: {
    target: "Diva · Filter cutoff",
    lastMessage: "CC 11 · channel 1 · value 84",
  },
}
