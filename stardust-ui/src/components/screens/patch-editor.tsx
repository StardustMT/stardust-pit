import * as React from "react"
import { Music4, Plus, Volume2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import {
  KeyboardVisualizer,
  type KeyboardPart,
} from "@/components/widgets/keyboard-visualizer"
import { SignalChain, type ChainPart } from "@/components/widgets/signal-chain"
import { cn } from "@/lib/utils"

/**
 * Patch editor canvas (lives in Program mode's main canvas area).
 *
 * Sections, top to bottom:
 *   - Metadata: name, base level, transition style, output device
 *   - Instrument visualizer: keyboard with coloured zones per chain
 *   - Chains: one block per chain with MIDI in (with range + channel
 *     filter), the signal chain itself, and per-chain output level.
 *     "Compound" patch = multiple chains. Add another chain via the
 *     "+ Add chain" button at the bottom.
 *
 * The keyboard visualizer up top is mirrored from the per-chain
 * ranges — adjusting a chain's range live-updates the keyboard.
 */

export type PatchChain = {
  id: string
  /** Display name (e.g. "Bass", "Pad layer") */
  name: string
  /** Colour for the chain — used on keyboard zone bar + chain header */
  color: string
  /** MIDI input source */
  midiInDevice: string
  /** MIDI input channel — 1..16 or "All" */
  midiInChannel: number | "all"
  /** Note range this chain responds to */
  range: { fromNote: number; toNote: number }
  /** Velocity range (0..127). Defaults to full. */
  velocity?: { from: number; to: number }
  /** Signal chain blocks */
  blocks: ChainPart["blocks"]
  /** Per-chain output level, 0..1 */
  level: number
  /** True if this chain is muted */
  muted?: boolean
  /** Soloed (mutes other chains) */
  soloed?: boolean
}

export interface PatchEditorProps {
  patchName: string
  songName: string
  /** Base patch-level output (post-chain-mix) */
  patchLevel: number
  /** "immediate" | "fade-200" | "crossfade-800" etc */
  transitionLabel?: string
  chains: PatchChain[]
  selectedBlockId?: string
  onSelectBlock?: (id: string) => void
  onPatchNameChange?: (name: string) => void
  onAddChain?: () => void
  onChainChange?: (chainId: string, updates: Partial<PatchChain>) => void
  className?: string
}

export function PatchEditor({
  patchName,
  songName,
  patchLevel,
  transitionLabel = "Immediate",
  chains,
  selectedBlockId,
  onSelectBlock,
  onPatchNameChange,
  onAddChain,
  onChainChange,
  className,
}: PatchEditorProps) {
  const isCompound = chains.length > 1

  const keyboardParts: KeyboardPart[] = chains
    .filter((c) => !c.muted)
    .map((c) => ({
      id: c.id,
      label: c.name,
      color: c.color,
      fromNote: c.range.fromNote,
      toNote: c.range.toNote,
    }))

  return (
    <div className={cn("flex h-full flex-col gap-4 overflow-auto p-4", className)}>
      {/* ── Patch metadata header ─────────────────────────────── */}
      <header className="flex items-end justify-between gap-4 rounded-xl border bg-card p-4">
        <div className="grid flex-1 grid-cols-[1fr_140px_180px_140px] gap-3">
          <div>
            <Label htmlFor="patch-name" className="mb-1.5 block text-[10px] uppercase tracking-wider text-muted-foreground">
              Patch name
            </Label>
            <Input
              id="patch-name"
              value={patchName}
              onChange={(e) => onPatchNameChange?.(e.target.value)}
            />
            <div className="mt-1 text-xs text-muted-foreground">
              in <span className="text-foreground/80">{songName}</span>
              {isCompound && (
                <>
                  <span className="opacity-60"> · </span>
                  <span className="italic">compound · {chains.length} chains</span>
                </>
              )}
            </div>
          </div>

          <div>
            <Label className="mb-1.5 block text-[10px] uppercase tracking-wider text-muted-foreground">
              Transition
            </Label>
            <Select defaultValue="immediate">
              <SelectTrigger>
                <SelectValue placeholder="Transition" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="immediate">Immediate</SelectItem>
                <SelectItem value="fade-200">Fade · 200 ms</SelectItem>
                <SelectItem value="fade-500">Fade · 500 ms</SelectItem>
                <SelectItem value="crossfade-800">Crossfade · 800 ms</SelectItem>
                <SelectItem value="crossfade-1500">Crossfade · 1.5 s</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="mb-1.5 block text-[10px] uppercase tracking-wider text-muted-foreground">
              Patch level
            </Label>
            <div className="flex items-center gap-2">
              <Volume2 className="size-3.5 text-muted-foreground" />
              <Slider value={[patchLevel]} max={1} step={0.01} className="flex-1" />
              <span className="w-10 text-right font-mono text-xs tabular-nums">
                {(patchLevel * 100).toFixed(0)}
              </span>
            </div>
          </div>

          <div>
            <Label className="mb-1.5 block text-[10px] uppercase tracking-wider text-muted-foreground">
              Output bus
            </Label>
            <Select defaultValue="main">
              <SelectTrigger>
                <SelectValue placeholder="Output" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="main">Main 1-2</SelectItem>
                <SelectItem value="cue">Cue 3-4</SelectItem>
                <SelectItem value="aux">Aux 5-6</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      {/* ── Instrument (keyboard) with chain ranges ───────────── */}
      <section className="rounded-xl border bg-card p-4">
        <div className="mb-2 flex items-baseline justify-between">
          <div>
            <h3 className="text-sm font-semibold">Instrument</h3>
            <p className="text-xs text-muted-foreground">
              Coloured zones show which chain responds to which notes. Adjust ranges per chain
              below.
            </p>
          </div>
          <div className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
            <Music4 className="size-3" />
            88-key keyboard (A0 – C8)
          </div>
        </div>
        <KeyboardVisualizer parts={keyboardParts} />
      </section>

      {/* ── Chains ────────────────────────────────────────────── */}
      <section className="space-y-3">
        <header className="flex items-baseline justify-between">
          <div>
            <h3 className="text-sm font-semibold">
              {isCompound ? `Signal chains (${chains.length})` : "Signal chain"}
            </h3>
            <p className="text-xs text-muted-foreground">
              {isCompound
                ? "Each chain processes its own MIDI source / range and outputs to the patch mix."
                : "Single chain. Add another below to create a compound patch with split or layered parts."}
            </p>
          </div>
        </header>

        {chains.map((chain) => (
          <ChainCard
            key={chain.id}
            chain={chain}
            selectedBlockId={selectedBlockId}
            onSelectBlock={onSelectBlock}
            onChange={(updates) => onChainChange?.(chain.id, updates)}
          />
        ))}

        <button
          type="button"
          onClick={onAddChain}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
        >
          <Plus className="size-3.5" />
          Add chain {isCompound ? "" : "(makes this a compound patch)"}
        </button>
      </section>
    </div>
  )
}

// =============================================================================
// ChainCard — one chain row: MIDI-in config + signal chain + level
// =============================================================================

function ChainCard({
  chain,
  selectedBlockId,
  onSelectBlock,
  onChange,
}: {
  chain: PatchChain
  selectedBlockId?: string
  onSelectBlock?: (id: string) => void
  onChange?: (updates: Partial<PatchChain>) => void
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      {/* Chain header */}
      <div className="flex items-center gap-3 border-b bg-card-raised px-4 py-2.5">
        <span
          className="block size-3 shrink-0 rounded-full"
          style={{ background: chain.color }}
          aria-hidden
        />
        <Input
          value={chain.name}
          onChange={(e) => onChange?.({ name: e.target.value })}
          className="h-7 max-w-[200px] border-transparent bg-transparent text-sm font-semibold shadow-none focus-visible:border-input focus-visible:bg-background"
        />
        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs">
            <Volume2 className="size-3.5 text-muted-foreground" />
            <Slider
              value={[chain.level]}
              max={1}
              step={0.01}
              className="w-24"
            />
            <span className="w-8 text-right font-mono tabular-nums">
              {(chain.level * 100).toFixed(0)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Mute
            </Label>
            <Switch checked={chain.muted ?? false} onCheckedChange={(m) => onChange?.({ muted: m })} />
          </div>
          <div className="flex items-center gap-1.5">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Solo
            </Label>
            <Switch checked={chain.soloed ?? false} onCheckedChange={(s) => onChange?.({ soloed: s })} />
          </div>
        </div>
      </div>

      {/* Chain body — MIDI in + signal chain side by side */}
      <div className="grid grid-cols-[260px_1fr]">
        {/* MIDI in panel */}
        <div className="space-y-3 border-r bg-background/50 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            MIDI in
          </div>
          <div>
            <Label className="mb-1 block text-xs">Device</Label>
            <Select
              value={chain.midiInDevice}
              onValueChange={(midiInDevice) => onChange?.({ midiInDevice })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rd2000">RD-2000</SelectItem>
                <SelectItem value="nord">Nord Stage 3</SelectItem>
                <SelectItem value="yamaha">Yamaha Montage</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 block text-xs">Channel</Label>
            <Select
              value={String(chain.midiInChannel)}
              onValueChange={(v) =>
                onChange?.({ midiInChannel: v === "all" ? "all" : Number(v) })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All channels</SelectItem>
                {Array.from({ length: 16 }).map((_, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>
                    Ch {i + 1}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 block text-xs">Note range</Label>
            <div className="space-y-1.5">
              <Slider
                value={[chain.range.fromNote, chain.range.toNote]}
                min={21}
                max={108}
                step={1}
                onValueChange={([fromNote, toNote]) =>
                  onChange?.({ range: { fromNote, toNote } })
                }
              />
              <div className="flex justify-between font-mono text-[10px] text-muted-foreground">
                <span>{noteName(chain.range.fromNote)}</span>
                <span>{noteName(chain.range.toNote)}</span>
              </div>
            </div>
          </div>
          {chain.velocity && (
            <div>
              <Label className="mb-1 block text-xs">Velocity range</Label>
              <Slider
                value={[chain.velocity.from, chain.velocity.to]}
                min={0}
                max={127}
                step={1}
              />
              <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">
                <span>{chain.velocity.from}</span>
                <span>{chain.velocity.to}</span>
              </div>
            </div>
          )}
        </div>

        {/* Signal chain itself */}
        <div className="overflow-x-auto p-3">
          <SignalChain
            parts={[{ id: chain.id, blocks: chain.blocks }]}
            selectedId={selectedBlockId}
            onSelectBlock={onSelectBlock}
            outputDb={undefined}
            className="h-auto"
          />
        </div>
      </div>
    </div>
  )
}

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
function noteName(midi: number) {
  return `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`
}
