import type { Meta, StoryObj } from "@storybook/react"
import { PluginBrowser } from "./plugin-browser"

const meta: Meta<typeof PluginBrowser> = {
  title: "Modals/Plugin Browser",
  component: PluginBrowser,
  parameters: { layout: "centered" },
}
export default meta

export const Default: StoryObj<typeof PluginBrowser> = {
  args: {
    plugins: [
      { id: "diva", name: "Diva", vendor: "u-he", format: "VST3", category: "Instrument" },
      {
        id: "surge",
        name: "Surge XT",
        vendor: "Surge Synth Team",
        format: "CLAP",
        category: "Instrument",
      },
      { id: "vital", name: "Vital", vendor: "Vital Audio", format: "VST3", category: "Instrument" },
      {
        id: "muse",
        name: "MuseSounds Strings",
        vendor: "Muse Group",
        format: "VST3",
        category: "Instrument",
      },
      {
        id: "bbc",
        name: "BBC SO Discover",
        vendor: "Spitfire Audio",
        format: "VST3",
        category: "Instrument",
      },
      {
        id: "labs",
        name: "LABS — Soft Piano",
        vendor: "Spitfire Audio",
        format: "VST3",
        category: "Instrument",
      },
      { id: "dexed", name: "Dexed", vendor: "asb2m10", format: "VST3", category: "Instrument" },
      {
        id: "supermassive",
        name: "Valhalla Supermassive",
        vendor: "Valhalla DSP",
        format: "VST3",
        category: "Effect",
      },
      { id: "prol2", name: "Pro-L 2", vendor: "FabFilter", format: "VST3", category: "Effect" },
      { id: "proq3", name: "Pro-Q 3", vendor: "FabFilter", format: "VST3", category: "Effect" },
      {
        id: "decapitator",
        name: "Decapitator",
        vendor: "Soundtoys",
        format: "VST3",
        category: "Effect",
      },
    ],
  },
}
