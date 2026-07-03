import * as React from "react"
import {
  ChevronDown,
  ChevronUp,
  CircleDot,
  Footprints,
  Grid3x3,
  Piano,
  Settings2,
  Sliders,
} from "lucide-react"
import type { GraphNode } from "./_types"
import { classOf, CLASS_COLORS, getPluginChoice } from "./_types"

/**
 * Per-kind body renderer. POC pass: simple icon + descriptive line for
 * source kinds (the embedded mini-keyboard / mini-pad-grid widgets read
 * as ugly miniatures of the real widgets). Inline controls remain for
 * kinds where a quick visual matters — transpose stepper, EQ knobs, sine
 * ADSR, main out level meters. Future iteration: bespoke "node-style"
 * components per kind.
 */
export function NodeBody({ node }: { node: GraphNode }) {
  switch (node.kind) {
    case "source.keyboard":
      return <KeyboardBody node={node} />
    case "source.pads":
      return <PadsBody node={node} />
    case "source.switch":
    case "source.sustain-pedal":
      return <SwitchBody node={node} />
    case "source.expression-pedal":
      return <SimpleIconBody Icon={Sliders} caption="0–127" />
    case "source.pitch-wheel":
      return <SimpleIconBody Icon={ChevronUp} caption="pitch bend" />
    case "source.mod-wheel":
      return <SimpleIconBody Icon={ChevronUp} caption="CC 1" />
    case "source.knob":
      return <SimpleIconBody Icon={CircleDot} caption="rotary" />
    case "source.fader":
      return <SimpleIconBody Icon={Sliders} caption="linear" />
    case "midi.transpose":
      return <TransposeBody node={node} />
    case "midi.mix":
      return <MixBody count={countInputs(node)} signal="midi" />
    case "instrument.plugin":
      return <PluginBody node={node} />
    case "instrument.testtone":
      return <SineBody node={node} />
    case "audio.eq":
      return <EQBody node={node} />
    case "audio.mix":
      return <MixBody count={Math.max(1, Math.floor(countInputs(node) / 2))} signal="audio" />
    case "sink.main-out":
      return <MainOutBody />
  }
}

function countInputs(node: GraphNode): number {
  return node.ports.filter((p) => p.direction === "in").length
}

// =============================================================================
// Bodies — simple icon + descriptor
// =============================================================================

function SimpleIconBody({
  Icon,
  caption,
}: {
  Icon: React.ComponentType<{ className?: string }>
  caption: string
}) {
  return (
    <div className="flex flex-col items-center gap-1 py-2">
      <Icon className="size-5 text-muted-foreground" />
      <span className="text-[10px] text-muted-foreground">{caption}</span>
    </div>
  )
}

function KeyboardBody({ node: _node }: { node: GraphNode }) {
  // Just the icon — zone ranges render as subtitles under their output
  // port labels on the right edge of the node, not stacked under the icon.
  return (
    <div className="flex flex-col items-center gap-1 py-2">
      <Piano className="size-5 text-muted-foreground" />
    </div>
  )
}

function PadsBody({ node }: { node: GraphNode }) {
  const rows = (node.config?.rows as number | undefined) ?? 4
  const cols = (node.config?.cols as number | undefined) ?? 4
  return (
    <div className="flex flex-col items-center gap-1 py-2">
      <Grid3x3 className="size-5 text-muted-foreground" />
      <span className="text-[10px] text-muted-foreground">
        {rows} × {cols}
      </span>
    </div>
  )
}

function SwitchBody({ node }: { node: GraphNode }) {
  const isSustain = node.kind === "source.sustain-pedal"
  return (
    <div className="flex flex-col items-center gap-1 py-2">
      <Footprints className="size-5 text-muted-foreground" />
      <span className="text-[10px] text-muted-foreground">{isSustain ? "CC 64" : "momentary"}</span>
    </div>
  )
}

// =============================================================================
// MIDI processor bodies
// =============================================================================

function TransposeBody({ node }: { node: GraphNode }) {
  const semitones = (node.config?.semitones as number | undefined) ?? 0
  const sign = semitones > 0 ? "+" : ""
  return (
    <div className="flex items-center justify-center gap-1 py-1">
      <button
        type="button"
        className="grid size-5 place-items-center rounded text-muted-foreground hover:bg-muted/40 hover:text-foreground"
        title="Up 1 semitone"
        aria-label="Up 1 semitone"
      >
        <ChevronUp className="size-3.5" />
      </button>
      <span className="min-w-[40px] text-center font-mono text-base font-semibold tabular-nums">
        {sign}
        {semitones}
      </span>
      <button
        type="button"
        className="grid size-5 place-items-center rounded text-muted-foreground hover:bg-muted/40 hover:text-foreground"
        title="Down 1 semitone"
        aria-label="Down 1 semitone"
      >
        <ChevronDown className="size-3.5" />
      </button>
    </div>
  )
}

function MixBody({ count, signal }: { count: number; signal: "midi" | "audio" }) {
  const color = signal === "midi" ? "oklch(0.7 0.15 280)" : "oklch(0.7 0.15 145)"
  return (
    <div className="flex items-center justify-center gap-0.5 py-2">
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className="h-5 w-1 rounded-sm"
          style={{ background: color, opacity: 0.7 - i * 0.08 }}
        />
      ))}
      <span className="mx-1 h-px w-2" style={{ background: color }} />
      <span className="h-5 w-1.5 rounded-sm" style={{ background: color }} />
    </div>
  )
}

// =============================================================================
// Instrument bodies
// =============================================================================

function PluginBody({ node }: { node: GraphNode }) {
  const choice = getPluginChoice(node)
  return (
    <div className="flex flex-col items-stretch gap-1 px-1 py-1.5">
      <button
        type="button"
        className="flex h-6 items-center justify-center gap-1 rounded border bg-card text-[10px] font-medium hover:bg-muted/40"
        disabled={!choice}
        title={choice ? "Open plugin UI" : "Pick a plugin first"}
      >
        <Settings2 className="size-3" />
        Open UI
      </button>
      <div className="flex items-baseline justify-between gap-1 px-1 text-[10px]">
        <span className="text-muted-foreground">Vendor</span>
        <span className="truncate font-mono text-foreground">{choice?.pluginVendor ?? "—"}</span>
      </div>
    </div>
  )
}

function SineBody({ node }: { node: GraphNode }) {
  const poly = (node.config?.polyphony as number | undefined) ?? 8
  return (
    <div className="flex flex-col items-center gap-1 py-1.5">
      <svg width={60} height={18} viewBox="0 0 60 18">
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          className="text-muted-foreground"
          points="0,17 6,2 16,9 40,9 60,17"
        />
      </svg>
      <span className="text-[10px] text-muted-foreground">{poly}-voice</span>
    </div>
  )
}

// =============================================================================
// Audio effect bodies
// =============================================================================

function EQBody({ node }: { node: GraphNode }) {
  const low = (node.config?.low as number | undefined) ?? 0
  const mid = (node.config?.mid as number | undefined) ?? 0
  const high = (node.config?.high as number | undefined) ?? 0
  return (
    <div className="flex items-center justify-around gap-2 py-1.5">
      <LabeledKnob label="LO" value={knobValue(low)} />
      <LabeledKnob label="MID" value={knobValue(mid)} />
      <LabeledKnob label="HI" value={knobValue(high)} />
    </div>
  )
}
function knobValue(db: number): number {
  return Math.max(0, Math.min(1, (db + 12) / 24))
}
function LabeledKnob({ label, value }: { label: string; value: number }) {
  const rotation = -135 + value * 270
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div
        className="relative size-6 rounded-full"
        style={{
          background: "radial-gradient(circle at 50% 30%, #4a4a52 0%, #232328 70%, #15151a 100%)",
          boxShadow:
            "0 2px 4px rgba(0,0,0,0.4), inset 0 -1px 0 rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)",
        }}
      >
        <div
          className="absolute left-1/2 top-1/2 origin-bottom"
          style={{
            width: 1.5,
            height: 10,
            marginLeft: -0.75,
            marginTop: -10,
            background: "oklch(0.85 0.05 0)",
            transform: `rotate(${rotation}deg)`,
            transformOrigin: "bottom",
          }}
        />
      </div>
      <span className="text-[8px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
    </div>
  )
}

// =============================================================================
// Sink body
// =============================================================================

function MainOutBody() {
  return (
    <div className="flex items-center justify-center gap-1.5 py-1.5">
      <Meter level={0.6} />
      <Meter level={0.55} />
    </div>
  )
}
function Meter({ level }: { level: number }) {
  return (
    <div
      className="relative h-10 w-1.5 overflow-hidden rounded-sm"
      style={{ background: "linear-gradient(180deg, #2c2c33, #18181d)" }}
    >
      <div
        className="absolute inset-x-0 bottom-0"
        style={{
          height: `${Math.round(level * 100)}%`,
          background: "linear-gradient(180deg, oklch(0.75 0.18 50), oklch(0.7 0.18 145))",
        }}
      />
    </div>
  )
}

// =============================================================================
// Header chip helpers
// =============================================================================

export function PluginChip({ name }: { name: string | undefined }) {
  if (!name) {
    return (
      <span className="rounded-sm border border-dashed border-current/40 px-1 text-[9px] font-medium uppercase tracking-wider opacity-60">
        no plugin
      </span>
    )
  }
  return (
    <span className="rounded-sm bg-black/30 px-1 text-[9px] font-medium uppercase tracking-wider">
      {name}
    </span>
  )
}

export function pluginChipName(node: GraphNode): string | undefined {
  if (node.kind === "instrument.plugin") {
    return getPluginChoice(node)?.pluginName
  }
  if (node.kind === "instrument.testtone") return "built-in"
  return undefined
}

export function hasPluginChip(node: GraphNode): boolean {
  return node.kind.startsWith("instrument.")
}

export { classOf, CLASS_COLORS }
