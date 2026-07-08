import type { Meta, StoryObj } from "@storybook/react"
import * as React from "react"
import { SetupRigScreen } from "./setup-rig"
import type { AppMode } from "@/components/shell/nav-rail"
import type { LearnCapture, LearnEvent } from "@/lib/use-learn"
import type { RigWire } from "@/lib/tauri"
import { useShowStore } from "@/state/show-store"
import { FULL_RIG } from "./_seed-data"

/**
 * Stories for the REAL Setup → Rig screen (#122) — the same component
 * the live app mounts, backed by the show store. Learn is mocked: the
 * capture provider resolves after a short "listening" delay with a
 * plausible event matching the field's accept predicate, exactly where
 * the engine's `engine://learn` stream plugs in inside Tauri.
 */
const meta: Meta = {
  title: "Screens/Setup/Rig",
  parameters: { layout: "fullscreen" },
}
export default meta
type Story = StoryObj

// -----------------------------------------------------------------------------
// Mock Learn stream
// -----------------------------------------------------------------------------

let mockNote = 36
function mockEvents(): LearnEvent[] {
  const device = { deviceId: "mock-port-1", deviceName: "USB MIDI Port 1" }
  return [
    { ...device, msg: { type: "noteOn", channel: 1, note: mockNote++, velocity: 100 } },
    { ...device, msg: { type: "controlChange", channel: 1, cc: 64, value: 127 } },
    { ...device, msg: { type: "pitchBend", channel: 1 } },
  ]
}

const mockLearnCapture: LearnCapture = (accept, signal) =>
  new Promise((resolve) => {
    const t = window.setTimeout(() => resolve(mockEvents().find(accept)), 900)
    signal.addEventListener("abort", () => {
      window.clearTimeout(t)
      resolve(undefined)
    })
  })

// -----------------------------------------------------------------------------
// Store-backed shell
// -----------------------------------------------------------------------------

function RigStory({ rig }: { rig?: RigWire }) {
  const [mode, setMode] = React.useState<AppMode>("setup")
  const [ready, setReady] = React.useState(rig === undefined)
  React.useEffect(() => {
    if (rig !== undefined) {
      useShowStore.setState({ rig })
      setReady(true)
    }
  }, [rig])
  if (!ready) return null
  return <SetupRigScreen mode={mode} onModeChange={setMode} learnCapture={mockLearnCapture} />
}

export const RigOverview: Story = {
  name: "Rig setup (populated)",
  render: () => <RigStory rig={{ components: FULL_RIG }} />,
}

export const EmptyRig: Story = {
  name: "Empty rig (first-time setup)",
  render: () => <RigStory rig={{ components: [] }} />,
}
