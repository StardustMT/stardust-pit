import type { Meta, StoryObj } from "@storybook/react"
import { PreShowValidation } from "./pre-show-validation"

const meta: Meta<typeof PreShowValidation> = {
  title: "Modals/Pre-Show Validation",
  component: PreShowValidation,
  parameters: { layout: "centered" },
}
export default meta

export const AllGreen: StoryObj<typeof PreShowValidation> = {
  args: {
    checks: [
      { status: "pass", category: "Plugins", detail: "All 12 plugins loaded" },
      {
        status: "pass",
        category: "Audio",
        detail: "Focusrite Scarlett 18i20 · 128 / 48 kHz · 7.2 ms",
      },
      { status: "pass", category: "MIDI", detail: "RD-2000, FS-5U, EV-5, FCB1010 — all detected" },
      { status: "pass", category: "Mappings", detail: "42 mappings · all resolve" },
      { status: "pass", category: "System", detail: "CPU 18% · 32 GB free · plugged in" },
      {
        status: "pass",
        category: "Show file",
        detail: "hamilton-2026.stardust · valid · no missing samples",
      },
    ],
  },
}

export const Warnings: StoryObj<typeof PreShowValidation> = {
  args: {
    checks: [
      { status: "pass", category: "Plugins", detail: "All 12 plugins loaded" },
      { status: "pass", category: "Audio", detail: "Focusrite Scarlett 18i20 · 128 / 48 kHz" },
      {
        status: "warn",
        category: "MIDI",
        detail: "Roland RD-2000 not detected",
        resolution: "Connect the RD-2000 and click Re-scan",
      },
      { status: "pass", category: "Mappings", detail: "42 mappings · all resolve" },
      {
        status: "warn",
        category: "System",
        detail: "Running on battery (62%)",
        resolution: "Plug in the laptop",
      },
      { status: "pass", category: "Show file", detail: "valid" },
    ],
  },
}

export const HasFail: StoryObj<typeof PreShowValidation> = {
  args: {
    checks: [
      {
        status: "fail",
        category: "Plugins",
        detail: "Spitfire BBC SO Discover not found — will crash on load",
        resolution: "Install or update the plugin",
      },
      { status: "pass", category: "Audio", detail: "Focusrite Scarlett 18i20 · 128 / 48 kHz" },
      { status: "pass", category: "MIDI", detail: "All ports detected" },
      {
        status: "warn",
        category: "Mappings",
        detail: "3 mappings reference the missing plugin",
        resolution: "Show details",
      },
    ],
  },
}
