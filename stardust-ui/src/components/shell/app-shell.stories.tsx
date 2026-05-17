import type { Meta, StoryObj } from "@storybook/react"
import * as React from "react"
import {
  AppShellFrame,
  InspectorFrame,
  Placeholder,
} from "./app-shell-frame"
import type { AppMode, NavId } from "./nav-rail"
import { defaultNavForMode } from "./nav-rail"

const meta: Meta = {
  title: "Shell/App Shell (bare)",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Bare app shell with placeholder canvas / inspector content. Use Screens/<Mode>/* stories to see real content in this shell.",
      },
    },
  },
}
export default meta
type Story = StoryObj

export const Empty: Story = {
  render: () => {
    const [mode, setMode] = React.useState<AppMode>("program")
    const [nav, setNav] = React.useState<NavId>(defaultNavForMode("program"))
    return (
      <AppShellFrame
        mode={mode}
        onModeChange={setMode}
        nav={nav}
        onNavChange={setNav}
        showName="Untitled Show"
        songName="—"
        contextPanel={
          <Placeholder
            title="Context panel"
            body="Driven by the active nav rail icon. Items change per mode."
          />
        }
        inspector={
          <InspectorFrame label="Nothing selected">
            <Placeholder
              title="Inspector"
              body="Selection-driven. Click something on the canvas to see its properties."
            />
          </InspectorFrame>
        }
        canvas={
          <Placeholder
            title={`${mode} canvas`}
            body="Mode-specific content lives here. See the Screens/ stories for real examples."
          />
        }
      />
    )
  },
}
