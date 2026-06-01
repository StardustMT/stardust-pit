import type { Meta, StoryObj } from "@storybook/react"
import * as React from "react"
import { AppShellFrame, InspectorFrame, Placeholder } from "./app-shell-frame"
import type { AppMode } from "./nav-rail"

const meta: Meta = {
  title: "Shell/App Shell (bare)",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Bare app shell with placeholder content. Right inspector is draggable to resize. Use Screens/<Mode>/* stories to see real content.",
      },
    },
  },
}
export default meta
type Story = StoryObj

export const Empty: Story = {
  render: () => {
    const [mode, setMode] = React.useState<AppMode>("program")
    return (
      <AppShellFrame
        mode={mode}
        onModeChange={setMode}
        showName="Untitled Show"
        songName="—"
        contextPanel={
          <Placeholder title="Context panel" body="Show outline lives here in real usage." />
        }
        inspector={
          <InspectorFrame>
            <Placeholder
              title="Inspector"
              body="Library + Settings tabs render here. Drag the left edge to resize."
            />
          </InspectorFrame>
        }
        canvas={
          <Placeholder
            title={`${mode} canvas`}
            body="Mode-specific content lives here. See Screens/ stories for real examples."
          />
        }
      />
    )
  },
}
