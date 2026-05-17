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
    <div className="p-8">
      <KeyboardVisualizer />
    </div>
  ),
}

export const FullChordHeld: Story = {
  render: () => (
    <div className="p-8">
      <KeyboardVisualizer
        active={[
          { note: 48, velocity: 90 }, // C3
          { note: 52, velocity: 85 }, // E3
          { note: 55, velocity: 88 }, // G3
          { note: 60, velocity: 110 }, // C4
          { note: 64, velocity: 105 }, // E4
          { note: 67, velocity: 100 }, // G4
        ]}
      />
    </div>
  ),
}

export const TwoLayersDifferentChannels: Story = {
  name: "Two layers (split keyboard)",
  render: () => (
    <div className="p-8">
      <KeyboardVisualizer
        active={[
          // Bass layer, channel 0
          { note: 36, velocity: 110, channel: 0 },
          { note: 43, velocity: 100, channel: 0 },
          // Pad layer, channel 1
          { note: 62, velocity: 70, channel: 1 },
          { note: 65, velocity: 70, channel: 1 },
          { note: 69, velocity: 70, channel: 1 },
          { note: 72, velocity: 70, channel: 1 },
        ]}
      />
    </div>
  ),
}

export const Range61: Story = {
  name: "61-key range (E1 — E6)",
  render: () => (
    <div className="p-8">
      <KeyboardVisualizer fromNote={28} toNote={88} />
    </div>
  ),
}

export const Range49: Story = {
  name: "49-key range (C2 — C6)",
  render: () => (
    <div className="p-8">
      <KeyboardVisualizer fromNote={36} toNote={84} active={[{ note: 60, velocity: 100 }]} />
    </div>
  ),
}
