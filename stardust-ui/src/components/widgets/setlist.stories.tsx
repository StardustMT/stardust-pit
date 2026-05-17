import type { Meta, StoryObj } from "@storybook/react"
import { Setlist } from "./setlist"

const meta: Meta<typeof Setlist> = {
  title: "Widgets/Setlist",
  component: Setlist,
  parameters: { layout: "fullscreen" },
}
export default meta

const HAMILTON_ACT_ONE = [
  { id: "1", number: 1, name: "Alexander Hamilton", patchCount: 5, length: "4:01", key: "F#m" },
  { id: "2", number: 2, name: "Aaron Burr, Sir", patchCount: 4, length: "1:53", key: "D" },
  { id: "3", number: 3, name: "My Shot", patchCount: 6, length: "5:32", key: "Bbm" },
  { id: "4", number: 4, name: "The Story of Tonight", patchCount: 3, length: "2:21" },
  { id: "5", number: 5, name: "The Schuyler Sisters", patchCount: 5, length: "3:08" },
  { id: "6", number: 6, name: "Farmer Refuted", patchCount: 4, length: "1:23" },
  { id: "7", number: 7, name: "You'll Be Back", patchCount: 3, length: "3:31", key: "G" },
  { id: "8", number: 8, name: "Right Hand Man", patchCount: 7, length: "5:18" },
  { id: "9", number: 9, name: "A Winter's Ball", patchCount: 3, length: "0:47" },
  { id: "10", number: 10, name: "Helpless", patchCount: 4, length: "4:01", key: "Bb" },
  { id: "11", number: 11, name: "Satisfied", patchCount: 6, length: "5:34" },
  { id: "12", number: 12, name: "Wait For It", patchCount: 3, length: "3:11" },
  { id: "13", number: 13, name: "Non-Stop", patchCount: 8, length: "6:23" },
]

export const HamiltonActOne: StoryObj<typeof Setlist> = {
  render: () => (
    <div className="h-screen w-[320px] bg-background p-4">
      <Setlist items={HAMILTON_ACT_ONE} currentId="3" />
    </div>
  ),
}

export const WorshipSet: StoryObj<typeof Setlist> = {
  render: () => (
    <div className="h-screen w-[320px] bg-background p-4">
      <Setlist
        unitLabel="Song"
        items={[
          { id: "a", number: 1, name: "Build My Life", patchCount: 3, key: "C" },
          { id: "b", number: 2, name: "Goodness of God", patchCount: 4, key: "D" },
          { id: "c", number: 3, name: "Way Maker", patchCount: 4, key: "E" },
          { id: "d", number: 4, name: "Reckless Love", patchCount: 5, key: "F" },
          { id: "e", number: 5, name: "Great Are You Lord (reprise)", patchCount: 2, key: "G" },
        ]}
        currentId="b"
      />
    </div>
  ),
}
