import type { Meta, StoryObj } from "@storybook/react"
import * as React from "react"
import {
  AppShellFrame,
  InspectorFrame,
  Placeholder,
} from "@/components/shell/app-shell-frame"
import type { AppMode } from "@/components/shell/nav-rail"

const meta: Meta = {
  title: "Screens/Setup/Rig",
  parameters: { layout: "fullscreen" },
}
export default meta
type Story = StoryObj

export const RigOverview: Story = {
  render: () => {
    const [mode, setMode] = React.useState<AppMode>("setup")
    return (
      <AppShellFrame
        mode={mode}
        onModeChange={setMode}
        showName="Little Shop of Horrors"
        contextPanel={
          <Placeholder
            title="Rig devices"
            body="List of physical devices: keyboards, footswitches, expression pedals, MIDI controllers. Selecting one populates its config."
          />
        }
        inspector={
          <InspectorFrame>
            <Placeholder
              title="Device settings"
              body="Source channel, default debounce, sustain-slot handling. Overrides per Show / Song / Patch surface here with cascade indicators."
            />
          </InspectorFrame>
        }
        canvas={
          <Placeholder
            title="Rig canvas"
            body="Visual layout of your physical rig — keyboards, pedals, controllers as cards. Drag to reorder. Each card surfaces its hardware/software interfacing controls on click."
          />
        }
      />
    )
  },
}
