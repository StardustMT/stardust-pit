import type { Meta, StoryObj } from "@storybook/react"
import * as React from "react"
import {
  AppShellFrame,
  InspectorFrame,
  Placeholder,
} from "@/components/shell/app-shell-frame"
import type { AppMode, NavId } from "@/components/shell/nav-rail"
import { defaultNavForMode } from "@/components/shell/nav-rail"
import { ShowOutline } from "@/components/widgets/show-outline"
import { PatchEditor, type PatchChain } from "./patch-editor"
import { HAMILTON_ACT_ONE, VERSE_SPLIT_CHAINS } from "./_demo-data"

const meta: Meta = {
  title: "Screens/Program/Patch editor",
  parameters: { layout: "fullscreen" },
}
export default meta
type Story = StoryObj

function InspectorForBlock(selectedId: string | undefined, chains: PatchChain[]) {
  for (const chain of chains) {
    const b = chain.blocks.find((x) => x.id === selectedId)
    if (!b) continue
    if (b.kind === "instrument") {
      return {
        label: `${b.name} · Instrument`,
        title: `${b.name}`,
        body: `Chain: ${chain.name}. ${"vendor" in b && b.vendor ? `${b.vendor} ` : ""}${"format" in b && b.format ? `(${b.format})` : ""}. Plugin parameters land here as cascaded controls.`,
      }
    }
    if (b.kind === "effect") {
      return {
        label: `${b.name} · Effect`,
        title: b.name,
        body: `Chain: ${chain.name}. ${"vendor" in b && b.vendor ? b.vendor : ""}. Bypass / wet-dry / per-param overrides here.`,
      }
    }
    if (b.kind === "builtin-effect") {
      return {
        label: `${b.name} · Built-in`,
        title: b.name,
        body: `Chain: ${chain.name}. Built-in DSP. Bypassable, removable.`,
      }
    }
  }
  return {
    label: "Patch",
    title: "Patch properties",
    body: "Click any block in a chain to see its parameters. The outline on the left navigates between patches.",
  }
}

export const Compound2Chains: Story = {
  name: "Compound patch (2 chains)",
  render: () => {
    const [mode, setMode] = React.useState<AppMode>("program")
    const [nav, setNav] = React.useState<NavId>(defaultNavForMode("program"))
    const [chains, setChains] = React.useState<PatchChain[]>(VERSE_SPLIT_CHAINS)
    const [selectedBlockId, setSelectedBlockId] = React.useState<string | undefined>("wurli")
    const [patchName, setPatchName] = React.useState("Verse split")

    const inspector = InspectorForBlock(selectedBlockId, chains)

    return (
      <AppShellFrame
        mode={mode}
        onModeChange={setMode}
        nav={nav}
        onNavChange={setNav}
        showName="Hamilton — 2026 Tour"
        songName="My Shot"
        contextPanel={
          <ShowOutline
            showName="Hamilton — 2026 Tour"
            songs={HAMILTON_ACT_ONE}
            currentSongId="3"
            currentPatchId="3.2"
            mode="program"
            onAddSong={() => {}}
            onAddPatch={() => {}}
            className="h-full"
          />
        }
        inspector={
          <InspectorFrame label={inspector.label}>
            <Placeholder title={inspector.title} body={inspector.body} />
          </InspectorFrame>
        }
        canvas={
          <PatchEditor
            patchName={patchName}
            onPatchNameChange={setPatchName}
            songName="My Shot"
            patchLevel={0.78}
            transitionLabel="Crossfade 800 ms"
            chains={chains}
            selectedBlockId={selectedBlockId}
            onSelectBlock={setSelectedBlockId}
            onAddChain={() =>
              setChains((cs) => [
                ...cs,
                {
                  id: `chain-${cs.length + 1}`,
                  name: `New chain`,
                  color: "var(--chart-3)",
                  midiInDevice: "rd2000",
                  midiInChannel: 1,
                  range: { fromNote: 60, toNote: 84 },
                  blocks: [],
                  level: 0.7,
                },
              ])
            }
            onChainChange={(id, updates) =>
              setChains((cs) => cs.map((c) => (c.id === id ? { ...c, ...updates } : c)))
            }
          />
        }
      />
    )
  },
}

export const SinglePatch: Story = {
  name: "Simple single-chain patch",
  render: () => {
    const [mode, setMode] = React.useState<AppMode>("program")
    const [nav, setNav] = React.useState<NavId>(defaultNavForMode("program"))
    const [chains, setChains] = React.useState<PatchChain[]>([VERSE_SPLIT_CHAINS[1]])
    const [selectedBlockId, setSelectedBlockId] = React.useState<string | undefined>("scarbee")
    const [patchName, setPatchName] = React.useState("Verse pad")

    const inspector = InspectorForBlock(selectedBlockId, chains)

    return (
      <AppShellFrame
        mode={mode}
        onModeChange={setMode}
        nav={nav}
        onNavChange={setNav}
        showName="Hamilton — 2026 Tour"
        songName="My Shot"
        contextPanel={
          <ShowOutline
            showName="Hamilton — 2026 Tour"
            songs={HAMILTON_ACT_ONE}
            currentSongId="3"
            currentPatchId="3.1"
            mode="program"
            onAddSong={() => {}}
            onAddPatch={() => {}}
            className="h-full"
          />
        }
        inspector={
          <InspectorFrame label={inspector.label}>
            <Placeholder title={inspector.title} body={inspector.body} />
          </InspectorFrame>
        }
        canvas={
          <PatchEditor
            patchName={patchName}
            onPatchNameChange={setPatchName}
            songName="My Shot"
            patchLevel={0.8}
            transitionLabel="Immediate"
            chains={chains}
            selectedBlockId={selectedBlockId}
            onSelectBlock={setSelectedBlockId}
            onAddChain={() =>
              setChains((cs) => [
                ...cs,
                {
                  id: `chain-${cs.length + 1}`,
                  name: "Bass layer",
                  color: "var(--chart-1)",
                  midiInDevice: "rd2000",
                  midiInChannel: 1,
                  range: { fromNote: 24, toNote: 47 },
                  blocks: [],
                  level: 0.7,
                },
              ])
            }
            onChainChange={(id, updates) =>
              setChains((cs) => cs.map((c) => (c.id === id ? { ...c, ...updates } : c)))
            }
          />
        }
      />
    )
  },
}
