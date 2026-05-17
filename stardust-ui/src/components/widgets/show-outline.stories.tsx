import type { Meta, StoryObj } from "@storybook/react"
import { ShowOutline } from "./show-outline"

const meta: Meta<typeof ShowOutline> = {
  title: "Widgets/Show Outline",
  component: ShowOutline,
  parameters: { layout: "fullscreen" },
}
export default meta

const HAMILTON_ACT_ONE = [
  {
    id: "1",
    number: 1,
    name: "Alexander Hamilton",
    patches: [
      { id: "1.1", number: 1, name: "Strings intro" },
      { id: "1.2", number: 2, name: "Verse pad", compound: true },
      { id: "1.3", number: 3, name: "Pre-chorus build", compound: true },
      { id: "1.4", number: 4, name: "Chorus brass" },
      { id: "1.5", number: 5, name: "Outro pad" },
    ],
  },
  {
    id: "2",
    number: 2,
    name: "Aaron Burr, Sir",
    patches: [
      { id: "2.1", number: 1, name: "Burr's piano" },
      { id: "2.2", number: 2, name: "Group entrance" },
      { id: "2.3", number: 3, name: "Verse two" },
      { id: "2.4", number: 4, name: "Outro" },
    ],
  },
  {
    id: "3",
    number: 3,
    name: "My Shot",
    patches: [
      { id: "3.1", number: 1, name: "Intro strings" },
      { id: "3.2", number: 2, name: "Verse split", compound: true },
      { id: "3.3", number: 3, name: "Pre-chorus lift", compound: true },
      { id: "3.4", number: 4, name: "Chorus brass" },
      { id: "3.5", number: 5, name: "Bridge synth" },
      { id: "3.6", number: 6, name: "Outro pad" },
    ],
  },
  {
    id: "4",
    number: 4,
    name: "The Story of Tonight",
    patches: [
      { id: "4.1", number: 1, name: "Pad" },
      { id: "4.2", number: 2, name: "Strings" },
      { id: "4.3", number: 3, name: "Outro" },
    ],
  },
  {
    id: "5",
    number: 5,
    name: "The Schuyler Sisters",
    patches: [
      { id: "5.1", number: 1, name: "Pulse synth" },
      { id: "5.2", number: 2, name: "Verse split", compound: true },
      { id: "5.3", number: 3, name: "Pre-chorus" },
      { id: "5.4", number: 4, name: "Chorus" },
      { id: "5.5", number: 5, name: "Outro brass" },
    ],
  },
  {
    id: "6",
    number: 6,
    name: "Farmer Refuted",
    patches: [
      { id: "6.1", number: 1, name: "Seabury's piano" },
      { id: "6.2", number: 2, name: "Hamilton's response" },
      { id: "6.3", number: 3, name: "Tutti" },
      { id: "6.4", number: 4, name: "Out" },
    ],
  },
  {
    id: "7",
    number: 7,
    name: "You'll Be Back",
    patches: [
      { id: "7.1", number: 1, name: "George's piano" },
      { id: "7.2", number: 2, name: "Strings come in" },
      { id: "7.3", number: 3, name: "Full ensemble" },
    ],
  },
]

export const EditMode: StoryObj<typeof ShowOutline> = {
  render: () => (
    <div className="dark h-screen w-[320px] bg-background p-4">
      <ShowOutline
        showName="Hamilton — 2026 Tour"
        songs={HAMILTON_ACT_ONE}
        currentSongId="3"
        currentPatchId="3.2"
        mode="edit"
      />
    </div>
  ),
}

export const LiveMode: StoryObj<typeof ShowOutline> = {
  name: "Live mode (read-only)",
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

export const WorshipSet: StoryObj<typeof ShowOutline> = {
  render: () => (
    <div className="dark h-screen w-[320px] bg-background p-4">
      <ShowOutline
        showName="Sunday 17 May"
        songLabel="Song"
        mode="edit"
        songs={[
          {
            id: "a",
            number: 1,
            name: "Build My Life",
            patches: [
              { id: "a.1", number: 1, name: "Pad + acoustic" },
              { id: "a.2", number: 2, name: "Lift" },
              { id: "a.3", number: 3, name: "Bridge" },
            ],
          },
          {
            id: "b",
            number: 2,
            name: "Goodness of God",
            patches: [
              { id: "b.1", number: 1, name: "Verse pad" },
              { id: "b.2", number: 2, name: "Chorus lift", compound: true },
              { id: "b.3", number: 3, name: "Bridge pad" },
              { id: "b.4", number: 4, name: "Outro" },
            ],
          },
          {
            id: "c",
            number: 3,
            name: "Way Maker",
            patches: [
              { id: "c.1", number: 1, name: "Intro pad" },
              { id: "c.2", number: 2, name: "Verse synth" },
              { id: "c.3", number: 3, name: "Chorus lead", compound: true },
            ],
          },
        ]}
        currentSongId="b"
        currentPatchId="b.2"
      />
    </div>
  ),
}
