import type { Meta, StoryObj } from "@storybook/react"
import { PluginParameterPanel } from "./plugin-parameter-panel"

const meta: Meta<typeof PluginParameterPanel> = {
  title: "Widgets/Plugin Parameter Panel",
  component: PluginParameterPanel,
  parameters: { layout: "padded" },
}
export default meta

export const Diva: StoryObj<typeof PluginParameterPanel> = {
  render: () => (
    <div className="w-[640px]">
      <PluginParameterPanel
        pluginName="u-he Diva"
        parameters={[
          { id: "cut", name: "Cutoff", value: 0.62, mapped: true, favorited: true },
          { id: "res", name: "Resonance", value: 0.28 },
          { id: "env", name: "Env amount", value: 0.42 },
          { id: "atk", name: "Attack", value: 0.05 },
          { id: "dec", name: "Decay", value: 0.4 },
          { id: "sus", name: "Sustain", value: 0.8 },
          { id: "rel", name: "Release", value: 0.6, favorited: true },
          { id: "lfo", name: "LFO rate", value: 0.3 },
        ]}
      />
    </div>
  ),
}
