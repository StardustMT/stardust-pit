import type { Meta, StoryObj } from "@storybook/react"
import * as React from "react"
import {
  AppShellFrame,
  InspectorFrame,
  Placeholder,
} from "@/components/shell/app-shell-frame"
import type { AppMode, NavId } from "@/components/shell/nav-rail"
import { defaultNavForMode } from "@/components/shell/nav-rail"

const meta: Meta = {
  title: "Screens/Setup/Rig",
  parameters: { layout: "fullscreen" },
}
export default meta
type Story = StoryObj

export const RigOverview: Story = {
  render: () => {
    const [mode, setMode] = React.useState<AppMode>("setup")
    const [nav, setNav] = React.useState<NavId>(defaultNavForMode("setup"))
    return (
      <AppShellFrame
        mode={mode}
        onModeChange={setMode}
        nav={nav}
        onNavChange={setNav}
        showName="Hamilton — 2026 Tour"
        contextPanel={
          <Placeholder
            title="Rig devices"
            body="List of physical devices in your rig: keyboards, footswitches, expression pedals, MIDI controllers. Selecting a device populates its config in the canvas + Inspector."
          />
        }
        inspector={
          <InspectorFrame label="Boss FS-5U">
            <Placeholder
              title="Device settings"
              body="Source channel, default debounce, sustain-slot handling, default action. Overrides per Show / Song / Patch surface here with cascade indicators."
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
