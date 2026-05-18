import type { Meta, StoryObj } from "@storybook/react"
import * as React from "react"
import {
  AppShellFrame,
  InspectorFrame,
  LiveFullscreen,
  Placeholder,
} from "@/components/shell/app-shell-frame"
import type { AppMode } from "@/components/shell/nav-rail"
import { ShowOutline } from "@/components/show/show-outline"
import { LSOH_ACT_ONE } from "./_demo-data"

const meta: Meta = {
  title: "Screens/Perform/Layout editor",
  parameters: { layout: "fullscreen" },
}
export default meta
type Story = StoryObj

export const LayoutEditor: Story = {
  name: "Layout editor (with Go Live)",
  render: () => {
    const [mode, setMode] = React.useState<AppMode>("perform")
    const [live, setLive] = React.useState(false)
    return (
      <>
        <AppShellFrame
          mode={mode}
          onModeChange={setMode}
          showName="Little Shop of Horrors"
          songName="Skid Row (Downtown)"
          onGoLive={() => setLive(true)}
          contextPanel={
            <ShowOutline
              showName="Little Shop of Horrors"
              songs={LSOH_ACT_ONE}
              currentSongId="s2"
              currentPatchId="s2.1"
              mode="program"
              className="h-full"
            />
          }
          inspector={
            <InspectorFrame>
              <Placeholder
                title="Widget properties"
                body="Click a widget on the canvas to configure its size, position, source, and cascading overrides."
              />
            </InspectorFrame>
          }
          canvas={
            <Placeholder
              title="Perform · layout editor"
              body="Drag-and-resize widget grid for the Live canvas. Click Go Live to fullscreen."
            />
          }
        />
        {live && (
          <LiveFullscreen onExit={() => setLive(false)}>
            <div className="grid h-full place-items-center text-muted-foreground">
              <div className="text-center">
                <div className="text-xs uppercase tracking-[0.2em] text-primary">Live</div>
                <div className="mt-2 text-3xl font-semibold tracking-tight">
                  Little Shop · Skid Row
                </div>
                <div className="mt-2 max-w-md text-sm">
                  The configured Live canvas renders here. A real composed Live layout lands in
                  a future iteration.
                </div>
              </div>
            </div>
          </LiveFullscreen>
        )}
      </>
    )
  },
}
