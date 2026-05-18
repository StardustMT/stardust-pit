import type { Meta, StoryObj } from "@storybook/react"
import { MidiMappingRow } from "./midi-mapping-row"

const meta: Meta<typeof MidiMappingRow> = {
  title: "Widgets/MIDI Mapping Row",
  component: MidiMappingRow,
  parameters: { layout: "padded" },
}
export default meta

export const InheritedFromShow: StoryObj<typeof MidiMappingRow> = {
  args: {
    source: "EV-5 (CC 11, ch 1)",
    target: "Master volume",
    inheritedFrom: "Show",
    range: "0 → 127 · linear",
  },
}

export const OverriddenAtPatch: StoryObj<typeof MidiMappingRow> = {
  args: {
    source: "EV-5 (CC 11, ch 1)",
    target: "Diva · Filter cutoff",
    inheritedFrom: "Patch",
    overridden: true,
    range: "20 → 100 · exp",
  },
}

export const TypicalList: StoryObj<typeof MidiMappingRow> = {
  name: "Mapping list (Patch view)",
  render: () => (
    <div className="w-[680px] space-y-2">
      <MidiMappingRow
        source="RD-2000 Mod wheel (CC 1)"
        target="Diva · LFO depth"
        inheritedFrom="Show"
        range="0 → 127 · linear"
      />
      <MidiMappingRow
        source="EV-5 (CC 11)"
        target="Diva · Filter cutoff"
        inheritedFrom="Patch"
        overridden
        range="20 → 100 · exp"
      />
      <MidiMappingRow
        source="FCB1010 FS1"
        target="Patch advance"
        inheritedFrom="Show"
      />
      <MidiMappingRow
        source="FCB1010 FS3"
        target="Tap tempo"
        inheritedFrom="Song"
      />
    </div>
  ),
}
