import type { Meta, StoryObj } from "@storybook/react"
import { SettingsScreen } from "./settings-screen"
import type { SelfTestResult } from "@/lib/tauri"

const meta: Meta<typeof SettingsScreen> = {
  title: "Screens/Settings",
  component: SettingsScreen,
  parameters: { layout: "fullscreen" },
}
export default meta

type Story = StoryObj<typeof SettingsScreen>

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export const Idle: Story = {
  args: {
    runSelfTest: async () => {
      await delay(2000)
      const result: SelfTestResult = { peakRmsDbfs: -12.3, passed: true }
      return result
    },
  },
}

export const PassingResult: Story = {
  args: {
    runSelfTest: async () => ({ peakRmsDbfs: -14.7, passed: true }),
  },
}

export const FailingResult: Story = {
  args: {
    runSelfTest: async () => ({ peakRmsDbfs: -42.1, passed: false }),
  },
}

export const Silence: Story = {
  args: {
    runSelfTest: async () => ({ peakRmsDbfs: Number.NEGATIVE_INFINITY, passed: false }),
  },
}

export const ErrorState: Story = {
  args: {
    runSelfTest: async () => {
      throw new Error("plan build failed: missing audio output")
    },
  },
}
