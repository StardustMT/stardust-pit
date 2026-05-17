import type { Meta, StoryObj } from "@storybook/react"
import * as React from "react"
import { LiveFullscreen } from "@/components/shell/app-shell-frame"
import { ShowOutline } from "@/components/widgets/show-outline"
import { HAMILTON_ACT_ONE } from "./_demo-data"

const meta: Meta = {
  title: "Screens/Perform/Live",
  parameters: { layout: "fullscreen" },
}
export default meta
type Story = StoryObj

export const LivePlaceholder: Story = {
  name: "Live · placeholder layout",
  render: () => {
    const [exited, setExited] = React.useState(false)
    if (exited) {
      return (
        <div className="dark grid h-screen w-screen place-items-center bg-background text-muted-foreground">
          Exited Live. (In the real app this returns to Perform mode with chrome back.)
        </div>
      )
    }
    return (
      <LiveFullscreen onExit={() => setExited(true)}>
        <div className="grid h-full grid-cols-[320px_1fr] gap-3 p-3">
          <ShowOutline
            showName="Hamilton — 2026 Tour"
            songs={HAMILTON_ACT_ONE}
            currentSongId="3"
            currentPatchId="3.2"
            mode="live"
            className="h-full"
          />
          <div className="grid place-items-center rounded-xl border border-primary/30 bg-card/40 p-6 text-center text-muted-foreground">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-primary">Live · fullscreen</div>
              <div className="mt-2 text-3xl font-semibold tracking-tight">Hamilton — My Shot</div>
              <div className="mt-1 text-lg">Verse split</div>
              <div className="mt-8 max-w-md text-sm leading-relaxed">
                The user's configured Live canvas renders here. A real composed example
                (keyboard + pedals + favourites + click + meters) lands in a future
                iteration once the layout-editor canvas is wired.
              </div>
            </div>
          </div>
        </div>
      </LiveFullscreen>
    )
  },
}
