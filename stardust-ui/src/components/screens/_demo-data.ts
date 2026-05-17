import type { ChainPart } from "@/components/widgets/signal-chain"
import type { PatchChain } from "./patch-editor"

export const HAMILTON_ACT_ONE = [
  {
    id: "1",
    number: 1,
    name: "Alexander Hamilton",
    patches: [
      { id: "1.1", number: 1, name: "Strings intro" },
      { id: "1.2", number: 2, name: "Verse pad", compound: true },
      { id: "1.3", number: 3, name: "Pre-chorus build", compound: true },
      { id: "1.4", number: 4, name: "Chorus brass" },
      { id: "1.5", number: 5, name: "Outro pad" },
    ],
  },
  {
    id: "2",
    number: 2,
    name: "Aaron Burr, Sir",
    patches: [
      { id: "2.1", number: 1, name: "Burr's piano" },
      { id: "2.2", number: 2, name: "Group entrance" },
      { id: "2.3", number: 3, name: "Verse two" },
      { id: "2.4", number: 4, name: "Outro" },
    ],
  },
  {
    id: "3",
    number: 3,
    name: "My Shot",
    patches: [
      { id: "3.1", number: 1, name: "Intro strings" },
      { id: "3.2", number: 2, name: "Verse split", compound: true },
      { id: "3.3", number: 3, name: "Pre-chorus lift", compound: true },
      { id: "3.4", number: 4, name: "Chorus brass" },
      { id: "3.5", number: 5, name: "Bridge synth" },
      { id: "3.6", number: 6, name: "Outro pad" },
    ],
  },
  {
    id: "4",
    number: 4,
    name: "The Story of Tonight",
    patches: [
      { id: "4.1", number: 1, name: "Pad" },
      { id: "4.2", number: 2, name: "Strings" },
      { id: "4.3", number: 3, name: "Outro" },
    ],
  },
  {
    id: "5",
    number: 5,
    name: "The Schuyler Sisters",
    patches: [
      { id: "5.1", number: 1, name: "Pulse synth" },
      { id: "5.2", number: 2, name: "Verse split", compound: true },
      { id: "5.3", number: 3, name: "Pre-chorus" },
      { id: "5.4", number: 4, name: "Chorus" },
      { id: "5.5", number: 5, name: "Outro brass" },
    ],
  },
  {
    id: "6",
    number: 6,
    name: "Farmer Refuted",
    patches: [
      { id: "6.1", number: 1, name: "Seabury's piano" },
      { id: "6.2", number: 2, name: "Hamilton's response" },
      { id: "6.3", number: 3, name: "Tutti" },
      { id: "6.4", number: 4, name: "Out" },
    ],
  },
]

const wurliBlocks: ChainPart["blocks"] = [
  { kind: "instrument", id: "wurli", name: "Wurlitzer 200A", vendor: "AAS", format: "VST3", cpu: 0.06 },
  { kind: "builtin-effect", id: "bass-eq", name: "EQ · low boost" },
]

const rhodesBlocks: ChainPart["blocks"] = [
  { kind: "instrument", id: "scarbee", name: "Scarbee Mark I", vendor: "Native Instruments", format: "VST3", cpu: 0.14 },
  { kind: "effect", id: "tremolo", name: "Tremolator", vendor: "Soundtoys", format: "VST3", cpu: 0.03 },
  { kind: "effect", id: "ep-verb", name: "Valhalla VintageVerb", vendor: "Valhalla DSP", format: "VST3", cpu: 0.04 },
]

export const VERSE_SPLIT_CHAINS: PatchChain[] = [
  {
    id: "bass",
    name: "Wurli Bass",
    color: "var(--chart-1)",
    midiInDevice: "rd2000",
    midiInChannel: 1,
    range: { fromNote: 24, toNote: 47 },
    blocks: wurliBlocks,
    level: 0.85,
  },
  {
    id: "ep",
    name: "Rhodes EP",
    color: "var(--chart-2)",
    midiInDevice: "rd2000",
    midiInChannel: 1,
    range: { fromNote: 48, toNote: 84 },
    blocks: rhodesBlocks,
    level: 0.7,
  },
]
