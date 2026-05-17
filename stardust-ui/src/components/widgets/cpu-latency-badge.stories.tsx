import type { Meta, StoryObj } from "@storybook/react"
import { CpuLatencyBadge } from "./cpu-latency-badge"

const meta: Meta<typeof CpuLatencyBadge> = {
  title: "Widgets/CPU + Latency Badge",
  component: CpuLatencyBadge,
  parameters: { layout: "centered" },
}
export default meta

export const Healthy: StoryObj<typeof CpuLatencyBadge> = {
  args: { cpu: 0.32, latencyMs: 7.5 },
}
export const Warning: StoryObj<typeof CpuLatencyBadge> = {
  args: { cpu: 0.72, latencyMs: 14.2 },
}
export const Stressed: StoryObj<typeof CpuLatencyBadge> = {
  args: { cpu: 0.93, latencyMs: 22.0, dropouts: 3 },
}
