import type { Meta, StoryObj } from "@storybook/react"
import { StereoVuMeter, VuMeter } from "./vu-meter"

const meta: Meta<typeof VuMeter> = {
  title: "Widgets/VU Meter",
  component: VuMeter,
  parameters: { layout: "centered" },
}
export default meta

export const Quiet: StoryObj<typeof VuMeter> = { args: { levelDb: -32, peakDb: -22 } }
export const Loud: StoryObj<typeof VuMeter> = { args: { levelDb: -6, peakDb: -3 } }
export const Clipping: StoryObj<typeof VuMeter> = {
  args: { levelDb: 0, peakDb: 0, clipping: true },
}

export const Horizontal: StoryObj<typeof VuMeter> = {
  render: () => (
    <div className="w-[320px] space-y-2">
      <VuMeter orientation="horizontal" levelDb={-12} peakDb={-6} />
      <VuMeter orientation="horizontal" levelDb={-8} peakDb={-3} />
    </div>
  ),
}

export const Stereo: StoryObj<typeof StereoVuMeter> = {
  name: "Stereo pair",
  render: () => <StereoVuMeter left={-9} right={-12} leftPeak={-4} rightPeak={-6} />,
}
