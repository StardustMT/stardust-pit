import type { Meta, StoryObj } from "@storybook/react"
import * as React from "react"
import { SignalChain, type ChainPart } from "./signal-chain"

const meta: Meta<typeof SignalChain> = {
  title: "Widgets/Signal Chain",
  component: SignalChain,
  parameters: { layout: "fullscreen" },
}
export default meta
type Story = StoryObj<typeof SignalChain>

// Wrapper for interactive selection state
function Demo({ parts, outputDb }: { parts: ChainPart[]; outputDb?: number }) {
  const [selectedId, setSelectedId] = React.useState<string | undefined>(parts[0]?.blocks[0]?.id)
  return (
    <div className="dark h-screen bg-background p-6 text-foreground">
      <SignalChain
        parts={parts}
        selectedId={selectedId}
        onSelectBlock={setSelectedId}
        outputDb={outputDb}
        className="h-full"
      />
    </div>
  )
}

export const SimplePatch: Story = {
  name: "Simple patch (one instrument)",
  render: () => (
    <Demo
      outputDb={-6}
      parts={[
        {
          id: "p1",
          blocks: [
            {
              kind: "instrument",
              id: "diva",
              name: "Diva",
              vendor: "u-he",
              format: "VST3",
              cpu: 0.12,
            },
          ],
        },
      ]}
    />
  ),
}

export const InstrumentPlusEffects: Story = {
  name: "Instrument + effects chain",
  render: () => (
    <Demo
      outputDb={-4.2}
      parts={[
        {
          id: "p1",
          blocks: [
            {
              kind: "instrument",
              id: "diva",
              name: "Diva",
              vendor: "u-he",
              format: "VST3",
              cpu: 0.18,
            },
            { kind: "builtin-effect", id: "eq", name: "EQ" },
            {
              kind: "effect",
              id: "reverb",
              name: "Valhalla Supermassive",
              vendor: "Valhalla DSP",
              format: "VST3",
              cpu: 0.04,
            },
            {
              kind: "effect",
              id: "limit",
              name: "Pro-L 2",
              vendor: "FabFilter",
              format: "VST3",
              cpu: 0.02,
            },
          ],
        },
      ]}
    />
  ),
}

export const CompoundPatch: Story = {
  name: "Compound patch (keyboard split, 3 parts)",
  render: () => (
    <Demo
      outputDb={-5.4}
      parts={[
        {
          id: "bass",
          label: "Bass",
          color: "var(--chart-1)",
          blocks: [
            {
              kind: "instrument",
              id: "wurli",
              name: "Wurlitzer 200A",
              vendor: "AAS",
              format: "VST3",
              cpu: 0.06,
            },
            { kind: "builtin-effect", id: "bass-eq", name: "EQ · low boost" },
          ],
        },
        {
          id: "ep",
          label: "Rhodes EP",
          color: "var(--chart-2)",
          blocks: [
            {
              kind: "instrument",
              id: "scarbee",
              name: "Scarbee Mark I",
              vendor: "Native Instruments",
              format: "VST3",
              cpu: 0.14,
            },
            {
              kind: "effect",
              id: "tremolo",
              name: "Soundtoys Tremolator",
              vendor: "Soundtoys",
              format: "VST3",
              cpu: 0.03,
            },
            {
              kind: "effect",
              id: "ep-verb",
              name: "Valhalla VintageVerb",
              vendor: "Valhalla DSP",
              format: "VST3",
              cpu: 0.04,
            },
          ],
        },
        {
          id: "pad",
          label: "Pad",
          color: "var(--chart-3)",
          blocks: [
            {
              kind: "instrument",
              id: "strings",
              name: "Spitfire BBC SO",
              vendor: "Spitfire Audio",
              format: "VST3",
              cpu: 0.22,
            },
          ],
        },
      ]}
    />
  ),
}

export const WithMissingPlugin: Story = {
  name: "Chain with missing plugin (warning state)",
  render: () => (
    <Demo
      outputDb={-9}
      parts={[
        {
          id: "p1",
          blocks: [
            {
              kind: "warning",
              id: "missing",
              message: "BBC SO Discover not installed",
            },
            { kind: "builtin-effect", id: "eq", name: "EQ" },
          ],
        },
      ]}
    />
  ),
}
