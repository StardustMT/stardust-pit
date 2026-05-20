import type { Meta, StoryObj } from "@storybook/react"
import { PatchEditor } from "./patch-editor-v5"
import {
  casualPatchGraph,
  compositeBlockPatchGraph,
  DEFAULT_RIG,
  FULL_RIG,
  LSOH_SONGS,
  pianoWithSendsPatchGraph,
  transposedSplitPatchGraph,
} from "./_seed-data"

/**
 * Storybook stories for the v5 patch editor. The actual component
 * lives in `./patch-editor-v5.tsx` so it can be reused from the real
 * Tauri app; fixtures live in `./_seed-data.ts`. Each story below is
 * a thin wrapper that composes the two with different scenarios.
 */

const meta: Meta = {
  title: "Screens/Program/Patch Editor v5 — Node Graph",
  parameters: { layout: "fullscreen" },
}
export default meta
type Story = StoryObj

const SHOW = "Little Shop of Horrors"

export const CasualPatch: Story = {
  name: "Casual patch (Keyboard → Sine → Output)",
  render: () => (
    <PatchEditor
      showName={SHOW}
      songs={LSOH_SONGS}
      graph={casualPatchGraph()}
      selectedPatchId="p1.1"
      patchName="Cold open"
      songName="Prologue"
      rigSources={DEFAULT_RIG}
    />
  ),
}

export const SplitWithTranspose: Story = {
  name: "Split keyboard + transpose + parallel synths",
  render: () => (
    <PatchEditor
      showName={SHOW}
      songs={LSOH_SONGS}
      graph={transposedSplitPatchGraph()}
      selectedPatchId="p4.2"
      patchName="Growl bass + pads"
      songName="Feed Me (Git It)"
      rigSources={DEFAULT_RIG}
    />
  ),
}

export const PianoWithSends: Story = {
  name: "Piano with EQ + reverb send",
  render: () => (
    <PatchEditor
      showName={SHOW}
      songs={LSOH_SONGS}
      graph={pianoWithSendsPatchGraph()}
      selectedPatchId="p3.1"
      patchName="Solo piano"
      songName="Somewhere That's Green"
      rigSources={DEFAULT_RIG}
    />
  ),
}

export const WithCompositeBlock: Story = {
  name: "With composite block (B3 + Leslie, locked)",
  render: () => (
    <PatchEditor
      showName={SHOW}
      songs={LSOH_SONGS}
      graph={compositeBlockPatchGraph()}
      selectedPatchId="p2.2"
      patchName="Chorus pads"
      songName="Skid Row (Downtown)"
      rigSources={FULL_RIG}
      savedComposites={[
        { id: "b3", name: "B3 + Leslie", nodeCount: 2 },
        { id: "rhodes", name: "Rhodes + chorus + tape", nodeCount: 3 },
        { id: "pad", name: "Lush pad layer", nodeCount: 4 },
      ]}
    />
  ),
}
