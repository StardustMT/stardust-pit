import type { Meta, StoryObj } from "@storybook/react"
import { MidiActivityDots } from "./midi-activity-dots"

const meta: Meta<typeof MidiActivityDots> = {
  title: "Widgets/MIDI Activity Dots",
  component: MidiActivityDots,
  parameters: { layout: "centered" },
}
export default meta

export const TypicalRig: StoryObj<typeof MidiActivityDots> = {
  args: {
    ports: [
      { name: "RD-2000", activity: 0.9 },
      { name: "Sustain", activity: 0.0 },
      { name: "EV-5", activity: 0.4 },
      { name: "Footswitch", activity: 0.0 },
      { name: "Conductor cue", activity: 0.0 },
    ],
  },
}
