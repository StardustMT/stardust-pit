import type { Meta, StoryObj } from "@storybook/react"
import { VstChainRow } from "./vst-chain-row"

const meta: Meta<typeof VstChainRow> = {
  title: "Widgets/VST Chain Row",
  component: VstChainRow,
  parameters: { layout: "padded" },
}
export default meta

export const Default: StoryObj<typeof VstChainRow> = {
  args: { name: "Diva", format: "VST3", sandboxed: true, cpu: 0.18 },
}

export const Stack: StoryObj<typeof VstChainRow> = {
  name: "Plugin chain (3-deep)",
  render: () => (
    <div className="w-[520px] space-y-2">
      <VstChainRow name="Diva" format="VST3" sandboxed cpu={0.18} />
      <VstChainRow name="Valhalla Supermassive" format="VST3" sandboxed cpu={0.04} />
      <VstChainRow name="Pro-L 2" format="VST3" sandboxed cpu={0.02} />
    </div>
  ),
}
