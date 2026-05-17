import type { Meta, StoryObj } from "@storybook/react"
import { ShowOutline } from "./show-outline"
import { HAMILTON_ACT_ONE } from "@/components/screens/_demo-data"

const meta: Meta<typeof ShowOutline> = {
  title: "Widgets/Show Outline",
  component: ShowOutline,
  parameters: { layout: "fullscreen" },
}
export default meta

export const ProgramMode: StoryObj<typeof ShowOutline> = {
  name: "Program mode (full interactivity + add)",
  render: () => (
    <div className="dark h-screen w-[320px] bg-background p-4">
      <ShowOutline
        showName="Hamilton — 2026 Tour"
        songs={HAMILTON_ACT_ONE}
        mode="program"
        onAddSong={() => {}}
        onAddPatch={() => {}}
      />
    </div>
  ),
}

export const LiveMode: StoryObj<typeof ShowOutline> = {
  name: "Live mode · All / Current toggle",
  render: () => (
    <div className="dark h-screen w-[320px] bg-background p-4">
      <ShowOutline
        showName="Hamilton — 2026 Tour"
        songs={HAMILTON_ACT_ONE}
        currentSongId="3"
        currentPatchId="3.2"
        mode="live"
      />
    </div>
  ),
}
