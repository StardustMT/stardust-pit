import type { Meta, StoryObj } from "@storybook/react"
import { KeyboardVisualizer } from "./keyboard-visualizer"

const meta: Meta<typeof KeyboardVisualizer> = {
  title: "Widgets/Keyboard Visualizer",
  component: KeyboardVisualizer,
  parameters: { layout: "fullscreen" },
}
export default meta

type Story = StoryObj<typeof KeyboardVisualizer>

export const Idle: Story = {
  render: () => (
    <div className="bg-background p-8">
      <KeyboardVisualizer />
    </div>
  ),
}

export const FullChord: Story = {
  render: () => (
    <div className="bg-background p-8">
      <KeyboardVisualizer
        active={[
          { note: 48, velocity: 90 },
          { note: 52, velocity: 85 },
          { note: 55, velocity: 88 },
          { note: 60, velocity: 110 },
          { note: 64, velocity: 105 },
          { note: 67, velocity: 100 },
        ]}
      />
    </div>
  ),
}

export const CompoundSplit2Parts: Story = {
  name: "Compound · 2 parts (bass / pad)",
  render: () => (
    <div className="bg-background p-8">
      <KeyboardVisualizer
        parts={[
          { id: "bass", label: "Diva Bass", fromNote: 24, toNote: 47 },
          { id: "pad", label: "Strings Pad", fromNote: 48, toNote: 84 },
        ]}
        active={[
          { note: 36, velocity: 110, partId: "bass" },
          { note: 43, velocity: 100, partId: "bass" },
          { note: 60, velocity: 70, partId: "pad" },
          { note: 64, velocity: 70, partId: "pad" },
          { note: 67, velocity: 70, partId: "pad" },
          { note: 72, velocity: 70, partId: "pad" },
        ]}
      />
    </div>
  ),
}

export const CompoundSplit3Parts: Story = {
  name: "Compound · 3 parts (bass / pad / lead)",
  render: () => (
    <div className="bg-background p-8">
      <KeyboardVisualizer
        parts={[
          { id: "bass", label: "Wurli Bass", fromNote: 24, toNote: 43 },
          { id: "pad", label: "Rhodes EP", fromNote: 44, toNote: 71 },
          { id: "lead", label: "Lead Synth", fromNote: 72, toNote: 96 },
        ]}
        active={[
          { note: 36, velocity: 90, partId: "bass" },
          { note: 60, velocity: 70, partId: "pad" },
          { note: 64, velocity: 70, partId: "pad" },
          { note: 79, velocity: 100, partId: "lead" },
        ]}
      />
    </div>
  ),
}

export const CompoundOverlapping: Story = {
  name: "Compound · overlapping ranges (layer in middle)",
  render: () => (
    <div className="bg-background p-8">
      <KeyboardVisualizer
        parts={[
          { id: "low", label: "Sub bass", fromNote: 24, toNote: 55 },
          { id: "layer", label: "Layered pad", fromNote: 48, toNote: 72 },
          { id: "high", label: "Sparkle", fromNote: 60, toNote: 96 },
        ]}
        active={[
          { note: 36, velocity: 95, partId: "low" },
          { note: 52, velocity: 75, partId: "layer" },
          { note: 64, velocity: 70, partId: "high" },
        ]}
      />
    </div>
  ),
}

export const Range61: Story = {
  name: "61-key range (E1 — E6)",
  render: () => (
    <div className="bg-background p-8">
      <KeyboardVisualizer fromNote={28} toNote={88} />
    </div>
  ),
}
