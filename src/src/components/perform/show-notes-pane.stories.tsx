import type { Meta, StoryObj } from "@storybook/react"
import { ShowNotesPane } from "./show-notes-pane"

const meta: Meta<typeof ShowNotesPane> = {
  title: "Widgets/Show Notes Pane",
  component: ShowNotesPane,
  parameters: { layout: "fullscreen" },
}
export default meta

export const MtNotes: StoryObj<typeof ShowNotesPane> = {
  name: "MT pit notes",
  render: () => (
    <div className="h-[420px] w-[460px] p-6">
      <ShowNotesPane
        content={[
          { type: "h", level: 1, text: "My Shot" },
          {
            type: "p",
            text: "Verse pads → bridge bell on cue. Watch Marie for the conductor cue at bar 64.",
          },
          { type: "h", level: 2, text: "Cues" },
          {
            type: "ul",
            items: [
              "Bar 17: footswitch → Patch 2 (Bell)",
              "Bar 64: conductor cue Ch1 C2 → Patch 3 (Sustained Pad)",
              "Bar 92: footswitch → Patch 4 (Outro Strings)",
            ],
          },
          { type: "h", level: 2, text: "Key" },
          { type: "chord", line: "Bb major  ·  capo 0  ·  transpose +2 from book" },
        ]}
      />
    </div>
  ),
}

export const ChordChart: StoryObj<typeof ShowNotesPane> = {
  render: () => (
    <div className="h-[420px] w-[460px] p-6">
      <ShowNotesPane
        content={[
          { type: "h", level: 1, text: "Hallelujah" },
          { type: "chord", line: "C    Am   C    Am" },
          { type: "p", text: "Now I've heard there was a secret chord" },
          { type: "chord", line: "F    G    C    G" },
          { type: "p", text: "That David played and it pleased the Lord" },
        ]}
      />
    </div>
  ),
}
