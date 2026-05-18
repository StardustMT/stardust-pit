import * as React from "react"
import { ChevronDown, ChevronUp, Power, Settings2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Keyboard } from "@/components/rig/keyboard"
import { Pads } from "@/components/rig/pads"
import type { GraphNode } from "./_types"
import { classOf, CLASS_COLORS } from "./_types"

/**
 * Per-kind body renderer. Aim: a pedal-style strip of inline controls that
 * make the node's current state legible at a glance without opening the
 * inspector — like the front panel of a Boss / EHX / Strymon pedal.
 *
 * For nodes that already have a polished widget in the rig screen (keyboard,
 * pads), we reuse the rig component at a compressed size.
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
      return <ExpressionBody />
    case "source.pitch-wheel":
      return <PitchBody />
    case "source.mod-wheel":
      return <ModBody />
    case "source.knob":
      return <KnobBody />
    case "source.fader":
      return <FaderBody />
    case "midi.transpose":
      return <TransposeBody node={node} />
    case "midi.mix":
      return <MixBody count={countInputs(node)} signal="midi" />
    case "instrument.plugin":
      return <PluginBody node={node} />
    case "instrument.sine":
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
// Source bodies — reuse rig widgets at compressed scale
// =============================================================================

function KeyboardBody({ node }: { node: GraphNode }) {
  // For multi-zone keyboards, render colored zones derived from port configs.
  const zones = node.ports
    .filter((p) => p.direction === "out" && p.config?.kind === "zone")
    .map((p, i) => {
      const cfg = p.config as { kind: "zone"; fromNote: number; toNote: number }
      return {
        id: p.id,
        label: p.label,
        fromNote: cfg.fromNote,
        toNote: cfg.toNote,
        color: `oklch(0.65 0.18 ${(i * 130) % 360})`,
      }
    })
  return (
    <div className="flex justify-center py-1">
      <Keyboard
        fromNote={21}
        toNote={108}
        whiteKeyWidth={2.2}
        zones={zones}
        readOnly
      />
    </div>
  )
}

function PadsBody({ node }: { node: GraphNode }) {
  const rows = (node.config?.rows as number | undefined) ?? 4
  const cols = (node.config?.cols as number | undefined) ?? 4
  return (
    <div className="flex justify-center py-1">
      <div style={{ transform: "scale(0.55)", transformOrigin: "center" }}>
        <Pads rows={rows} cols={cols} />
      </div>
    </div>
  )
}

function SwitchBody({ node }: { node: GraphNode }) {
  const isSustain = node.kind === "source.sustain-pedal"
  return (
    <div className="flex items-center justify-center gap-2 py-1.5">
      <span
        className="grid size-7 place-items-center rounded-full"
        style={{
          background:
            "radial-gradient(circle at 50% 30%, #4a4a52 0%, #232328 100%)",
          boxShadow: "inset 0 -1px 0 rgba(0,0,0,0.4)",
        }}
      >
        <Power className="size-3 text-muted-foreground" />
      </span>
      <span className="text-[10px] text-muted-foreground">
        {isSustain ? "CC 64" : "switch"}
      </span>
    </div>
  )
}

function ExpressionBody() {
  return (
    <div className="flex items-center justify-center py-1.5">
      <div
        className="relative h-3 w-20 rounded-full"
        style={{ background: "linear-gradient(90deg, #18181d, #2c2c33)" }}
      >
        <div
          className="absolute top-1/2 size-2.5 -translate-y-1/2 rounded-full"
          style={{
            left: "50%",
            background: "linear-gradient(180deg, #66666e, #3a3a42)",
            boxShadow: "0 1px 2px rgba(0,0,0,0.5)",
          }}
        />
      </div>
    </div>
  )
}

function PitchBody() {
  return (
    <div className="flex items-center justify-center py-1.5">
      <WheelGlyph centerDetent />
    </div>
  )
}
function ModBody() {
  return (
    <div className="flex items-center justify-center py-1.5">
      <WheelGlyph />
    </div>
  )
}
function WheelGlyph({ centerDetent }: { centerDetent?: boolean }) {
  return (
    <div
      className="relative h-10 w-3 rounded-full"
      style={{ background: "linear-gradient(180deg, #2c2c33, #18181d)" }}
    >
      {centerDetent && (
        <div className="absolute inset-x-0.5 top-1/2 h-px bg-primary/40" />
      )}
      <div
        className="absolute left-1/2 size-2.5 -translate-x-1/2 rounded-sm"
        style={{
          top: centerDetent ? "calc(50% - 5px)" : "calc(100% - 10px)",
          background: "linear-gradient(180deg, #66666e, #3a3a42)",
          boxShadow: "0 1px 2px rgba(0,0,0,0.5)",
        }}
      />
    </div>
  )
}

function KnobBody() {
  return (
    <div className="flex items-center justify-center py-1">
      <KnobGlyph value={0.7} size={26} />
    </div>
  )
}
function FaderBody() {
  return (
    <div className="flex items-center justify-center py-1">
      <FaderGlyph value={0.55} />
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
  const color =
    signal === "midi" ? "oklch(0.7 0.15 280)" : "oklch(0.7 0.15 145)"
  return (
    <div className="flex items-center justify-center gap-0.5 py-2">
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className="h-5 w-1 rounded-sm"
          style={{ background: color, opacity: 0.7 - i * 0.08 }}
        />
      ))}
      <span
        className="mx-1 h-px w-2"
        style={{ background: color }}
      />
      <span
        className="h-5 w-1.5 rounded-sm"
        style={{ background: color }}
      />
    </div>
  )
}

// =============================================================================
// Instrument bodies
// =============================================================================

function PluginBody({ node }: { node: GraphNode }) {
  const preset = (node.config?.preset as string | undefined) ?? "Init"
  return (
    <div className="flex flex-col items-stretch gap-1 px-1 py-1.5">
      <button
        type="button"
        className="flex h-6 items-center justify-center gap-1 rounded border bg-card text-[10px] font-medium hover:bg-muted/40"
      >
        <Settings2 className="size-3" />
        Open UI
      </button>
      <div className="flex items-baseline justify-between gap-1 px-1 text-[10px]">
        <span className="text-muted-foreground">Preset</span>
        <span className="truncate font-mono text-foreground">{preset}</span>
      </div>
    </div>
  )
}

function SineBody({ node }: { node: GraphNode }) {
  const poly = (node.config?.polyphony as number | undefined) ?? 8
  return (
    <div className="flex flex-col items-center gap-1 py-1.5">
      <AdsrGlyph />
      <span className="text-[10px] text-muted-foreground">
        {poly}-voice
      </span>
    </div>
  )
}
function AdsrGlyph() {
  // Tiny SVG: rises (attack), drops to sustain (decay), holds, drops to 0 (release)
  return (
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
  // Map -12..+12 dB to 0..1, centered at 0.5
  return Math.max(0, Math.min(1, (db + 12) / 24))
}
function LabeledKnob({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <KnobGlyph value={value} size={22} />
      <span className="text-[8px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
    </div>
  )
}

// =============================================================================
// Sink bodies
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
          background:
            "linear-gradient(180deg, oklch(0.75 0.18 50), oklch(0.7 0.18 145))",
        }}
      />
    </div>
  )
}

// =============================================================================
// Shared knob + fader glyphs (small, render-only)
// =============================================================================

function KnobGlyph({ value, size = 24 }: { value: number; size?: number }) {
  // value 0..1; rotation -135deg (min) .. +135deg (max)
  const rotation = -135 + value * 270
  return (
    <div
      className="relative rounded-full"
      style={{
        width: size,
        height: size,
        background:
          "radial-gradient(circle at 50% 30%, #4a4a52 0%, #232328 70%, #15151a 100%)",
        boxShadow:
          "0 2px 4px rgba(0,0,0,0.4), inset 0 -1px 0 rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)",
      }}
    >
      <div
        className="absolute left-1/2 top-1/2 origin-bottom"
        style={{
          width: 1.5,
          height: size * 0.4,
          marginLeft: -0.75,
          marginTop: -size * 0.4,
          background: "oklch(0.85 0.05 0)",
          transform: `rotate(${rotation}deg)`,
          transformOrigin: "bottom",
        }}
      />
    </div>
  )
}

function FaderGlyph({ value }: { value: number }) {
  return (
    <div
      className="relative h-10 w-2 rounded-full"
      style={{ background: "linear-gradient(180deg, #2c2c33, #18181d)" }}
    >
      <div
        className="absolute left-1/2 size-3.5 -translate-x-1/2 rounded-sm"
        style={{
          top: `calc(${(1 - value) * 100}% - 7px)`,
          background: "linear-gradient(180deg, #66666e, #3a3a42)",
          boxShadow: "0 1px 2px rgba(0,0,0,0.5)",
        }}
      />
    </div>
  )
}

/** Small badge shown in the node header for nodes that wrap a plugin. */
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

/** Returns the plugin name to display in the header, or undefined. */
export function pluginChipName(node: GraphNode): string | undefined {
  if (node.kind === "instrument.plugin") {
    return (node.config?.pluginUri as string | undefined) ?? undefined
  }
  if (node.kind === "instrument.sine") return "built-in"
  return undefined
}

/** Whether this kind shows a plugin chip in its header. */
export function hasPluginChip(node: GraphNode): boolean {
  return node.kind.startsWith("instrument.")
}

// `classOf` + `CLASS_COLORS` are re-exported so the header logic in patch-node
// stays a single source of truth.
export { classOf, CLASS_COLORS }
