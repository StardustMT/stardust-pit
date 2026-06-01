import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react"
import { PatchEditor } from "./patch-editor"
import {
  casualPatchGraph,
  compositeBlockPatchGraph,
  DEFAULT_RIG,
  FULL_RIG,
  LSOH_SONGS,
  pianoWithSendsPatchGraph,
  transposedSplitPatchGraph,
} from "./_seed-data"
import type { PatchGraph } from "@/components/patch-graph/_types"

/**
 * Storybook stories for the patch editor. The actual component lives
 * in `./patch-editor.tsx` so it can be reused from the real Tauri app;
 * fixtures live in `./_seed-data.ts`. Each story below is a thin
 * wrapper that composes the two with different scenarios.
 *
 * The real app drives `graph` / `onGraphChange` from the show store
 * (lifts state above the patch editor so Save Show can serialise every
 * patch in one go). Storybook doesn't need persistence — it just holds
 * the graph in local state so mutations within a story stick.
 */

const meta: Meta = {
  title: "Screens/Program/Patch Editor — Node Graph",
  parameters: { layout: "fullscreen" },
}
export default meta
type Story = StoryObj

const SHOW = "Little Shop of Horrors"

function StoryFrame({
  initialGraph,
  ...rest
}: {
  initialGraph: PatchGraph
  showName: string
  songs: typeof LSOH_SONGS
  selectedPatchId: string
  patchName: string
  songName: string
  rigSources: typeof DEFAULT_RIG
  savedComposites?: Array<{ id: string; name: string; nodeCount: number }>
}) {
  const [graph, setGraph] = React.useState(initialGraph)
  return <PatchEditor {...rest} graph={graph} onGraphChange={setGraph} />
}

export const CasualPatch: Story = {
  name: "Casual patch (Keyboard → Sine → Output)",
  render: () => (
    <StoryFrame
      showName={SHOW}
      songs={LSOH_SONGS}
      initialGraph={casualPatchGraph()}
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
    <StoryFrame
      showName={SHOW}
      songs={LSOH_SONGS}
      initialGraph={transposedSplitPatchGraph()}
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
    <StoryFrame
      showName={SHOW}
      songs={LSOH_SONGS}
      initialGraph={pianoWithSendsPatchGraph()}
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
    <StoryFrame
      showName={SHOW}
      songs={LSOH_SONGS}
      initialGraph={compositeBlockPatchGraph()}
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
