import type { Meta, StoryObj } from "@storybook/react"
import { CueEditorRow } from "./cue-editor-row"

const meta: Meta<typeof CueEditorRow> = {
  title: "Widgets/Cue Editor Row",
  component: CueEditorRow,
  parameters: { layout: "padded" },
}
export default meta

export const Mixed: StoryObj<typeof CueEditorRow> = {
  name: "Cue list (Song view)",
  render: () => (
    <div className="w-[640px] space-y-2">
      <CueEditorRow trigger={{ type: "footswitch", switch: "FS1" }} action={{ type: "advance" }} />
      <CueEditorRow
        trigger={{ type: "midi-note", channel: 1, note: "C2" }}
        action={{ type: "jump", patch: "Patch 3 — Strings" }}
      />
      <CueEditorRow trigger={{ type: "bar", bar: 33 }} action={{ type: "tempo", bpm: 168 }} />
      <CueEditorRow
        trigger={{ type: "midi-cc", channel: 16, cc: 100 }}
        action={{ type: "panic" }}
      />
    </div>
  ),
}
