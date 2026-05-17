import type { Meta, StoryObj } from "@storybook/react"
import { ParameterFavorite } from "./parameter-favorite"

const meta: Meta<typeof ParameterFavorite> = {
  title: "Widgets/Parameter Favorite",
  component: ParameterFavorite,
  parameters: { layout: "centered" },
}
export default meta

export const Slider: StoryObj<typeof ParameterFavorite> = {
  args: {
    label: "Filter cutoff",
    source: "Diva · Cutoff",
    value: 0.62,
    unit: "%",
  },
}

export const Knob: StoryObj<typeof ParameterFavorite> = {
  args: {
    label: "Reverb send",
    source: "Insert 2 · Valhalla Supermassive",
    value: 0.35,
    style: "knob",
    unit: "%",
  },
}

export const Row: StoryObj<typeof ParameterFavorite> = {
  name: "Row of favorites (Live Mode)",
  render: () => (
    <div className="flex gap-3">
      <ParameterFavorite label="Cutoff" value={0.62} style="knob" unit="%" />
      <ParameterFavorite label="Reso" value={0.28} style="knob" unit="%" />
      <ParameterFavorite label="Reverb" value={0.4} style="knob" unit="%" />
      <ParameterFavorite label="Delay" value={0.15} style="knob" unit="%" />
    </div>
  ),
}
