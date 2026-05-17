import * as React from "react"
import {
  AlertTriangle,
  CircleDot,
  Layers,
  Music4,
  Plus,
  Sparkles,
  Speaker,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Visual signal flow for a patch:
 *
 *   [Instrument] → [FX 1] → [FX 2] → [Output]
 *
 * For compound patches each part has its own row of blocks; they merge
 * into a shared Output:
 *
 *   Part 1: [Instrument] → [FX] ─┐
 *   Part 2: [Instrument] ────────┼→ [Output]
 *   Part 3: [Instrument] → [FX] ─┘
 *
 * Click a block to select it; the parent shell surfaces its parameters
 * in the Inspector. Click a "+" between blocks to insert a new effect.
 */

export type ChainBlock =
  | {
      kind: "instrument"
      id: string
      name: string
      format?: "VST3" | "CLAP" | "AU"
      vendor?: string
      cpu?: number
      muted?: boolean
    }
  | {
      kind: "effect"
      id: string
      name: string
      format?: "VST3" | "CLAP" | "AU"
      vendor?: string
      cpu?: number
      muted?: boolean
      bypassed?: boolean
    }
  | {
      kind: "builtin-effect"
      id: string
      /** "EQ" | "Reverb" | "Compressor" | etc. */
      name: string
      bypassed?: boolean
    }
  | {
      kind: "warning"
      id: string
      message: string
    }

export type ChainPart = {
  id: string
  /** Display label for compound patches; omit for single-patch */
  label?: string
  /** Optional colour for the part's bar (compound visualisation) */
  color?: string
  blocks: ChainBlock[]
}

export interface SignalChainProps {
  /** Single chain = one part. Compound patch = multiple parts. */
  parts: ChainPart[]
  /** id of the block currently selected (highlights it; consumer drives Inspector) */
  selectedId?: string
  onSelectBlock?: (id: string) => void
  onAddInstrument?: (partId: string) => void
  onAddEffect?: (partId: string, afterBlockId: string | null) => void
  onAddPart?: () => void
  /** Output level in dBFS (-inf..0) */
  outputDb?: number
  className?: string
}

export function SignalChain({
  parts,
  selectedId,
  onSelectBlock,
  onAddInstrument,
  onAddEffect,
  onAddPart,
  outputDb,
  className,
}: SignalChainProps) {
  const isCompound = parts.length > 1
  return (
    <div
      className={cn(
        "flex h-full flex-col gap-4 overflow-auto rounded-xl border bg-card p-5",
        className,
      )}
    >
      {/* Header */}
      <header className="flex items-baseline justify-between">
        <div>
          <h3 className="text-base font-semibold tracking-tight">Signal chain</h3>
          <p className="text-xs text-muted-foreground">
            {isCompound
              ? `Compound patch · ${parts.length} parts merge into one output`
              : "Audio flows left to right. Click a block to edit its parameters."}
          </p>
        </div>
        {isCompound && (
          <button
            type="button"
            onClick={onAddPart}
            className="inline-flex items-center gap-1.5 rounded-md border border-dashed px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
          >
            <Layers className="size-3.5" />
            Add part
          </button>
        )}
      </header>

      {/* The flow */}
      <div className="flex min-h-0 flex-1 items-stretch gap-4">
        {/* Parts column */}
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {parts.map((part) => (
            <PartRow
              key={part.id}
              part={part}
              isCompound={isCompound}
              selectedId={selectedId}
              onSelectBlock={onSelectBlock}
              onAddInstrument={() => onAddInstrument?.(part.id)}
              onAddEffect={(afterId) => onAddEffect?.(part.id, afterId)}
            />
          ))}
          {!isCompound && (
            <button
              type="button"
              onClick={onAddPart}
              className="inline-flex items-center gap-1.5 self-start rounded-md border border-dashed px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
            >
              <Layers className="size-3.5" />
              Convert to compound patch
            </button>
          )}
        </div>

        {/* Output endpoint — sits to the right of every part */}
        <OutputBlock outputDb={outputDb} compound={isCompound} />
      </div>
    </div>
  )
}

// =============================================================================
// PartRow — one horizontal lane of blocks for a compound part
// =============================================================================

function PartRow({
  part,
  isCompound,
  selectedId,
  onSelectBlock,
  onAddInstrument,
  onAddEffect,
}: {
  part: ChainPart
  isCompound: boolean
  selectedId?: string
  onSelectBlock?: (id: string) => void
  onAddInstrument?: () => void
  onAddEffect?: (afterId: string | null) => void
}) {
  const color = part.color ?? "var(--chart-1)"
  const hasInstrument = part.blocks.some((b) => b.kind === "instrument")

  return (
    <div className="flex items-stretch gap-2">
      {/* Compound-part label rail */}
      {isCompound && (
        <div className="flex flex-col items-center gap-1.5 pt-3">
          <span
            className="block w-1 flex-1 rounded-full"
            style={{ background: color }}
            aria-hidden
          />
          <span className="rotate-180 [writing-mode:vertical-rl] text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {part.label}
          </span>
        </div>
      )}

      {/* Block flow */}
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto pb-1">
        {!hasInstrument && (
          <button
            type="button"
            onClick={onAddInstrument}
            className="grid h-20 w-40 shrink-0 place-items-center rounded-lg border border-dashed text-xs text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
          >
            <span className="flex items-center gap-1.5">
              <Plus className="size-3.5" />
              Add instrument
            </span>
          </button>
        )}

        {part.blocks.map((block, i) => (
          <React.Fragment key={block.id}>
            <Block
              block={block}
              selected={block.id === selectedId}
              onSelect={() => onSelectBlock?.(block.id)}
            />
            {i < part.blocks.length - 1 ? (
              <Connector />
            ) : (
              // After the last block, an insert affordance and a final connector
              hasInstrument && (
                <>
                  <InsertSlot onClick={() => onAddEffect?.(block.id)} />
                  <Connector />
                </>
              )
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}

// =============================================================================
// Block — one box in the chain (instrument / effect / builtin / warning)
// =============================================================================

function Block({
  block,
  selected,
  onSelect,
}: {
  block: ChainBlock
  selected: boolean
  onSelect: () => void
}) {
  const meta = blockMeta(block)
  return (
    <button
      type="button"
      onClick={onSelect}
      data-selected={selected || undefined}
      className={cn(
        "group relative flex h-20 w-44 shrink-0 flex-col justify-between rounded-lg border bg-card-raised px-3 py-2 text-left transition-all",
        selected
          ? "border-primary ring-2 ring-primary/40"
          : "border-border hover:border-border-strong",
        block.kind !== "warning" && "muted" in block && block.muted && "opacity-50",
        block.kind === "effect" && block.bypassed && "opacity-60",
        block.kind === "builtin-effect" && block.bypassed && "opacity-60",
        block.kind === "warning" && "border-warning/50 bg-warning/10",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <meta.Icon className={cn("size-3", meta.tone)} />
          <span className={meta.tone}>{meta.kindLabel}</span>
        </div>
        {block.kind !== "warning" && "format" in block && block.format && (
          <span className="rounded bg-muted px-1 py-0.5 font-mono text-[9px] uppercase text-muted-foreground">
            {block.format}
          </span>
        )}
      </div>

      <div className="min-w-0">
        <div className="truncate text-sm font-medium leading-tight">
          {block.kind === "warning" ? "Missing plugin" : block.name}
        </div>
        <div className="truncate text-[11px] text-muted-foreground">
          {block.kind === "warning"
            ? block.message
            : "vendor" in block && block.vendor
              ? block.vendor
              : block.kind === "builtin-effect"
                ? "Built-in"
                : ""}
        </div>
      </div>

      {/* Bottom strip: CPU + bypass/mute dots */}
      <div className="absolute inset-x-0 bottom-1.5 flex items-center justify-between px-3">
        <div className="flex items-center gap-1">
          {block.kind !== "warning" && "cpu" in block && block.cpu != null && (
            <span className="font-mono text-[10px] text-muted-foreground">
              {(block.cpu * 100).toFixed(1)}% CPU
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {block.kind !== "warning" && "muted" in block && block.muted && (
            <span title="Muted">
              <CircleDot className="size-3 text-muted-foreground" />
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

// =============================================================================
// Connectors + insert slots
// =============================================================================

function Connector() {
  return (
    <div className="flex h-20 shrink-0 items-center" aria-hidden>
      <span className="block h-px w-6 bg-border-strong" />
      <span className="block size-0 border-y-4 border-l-4 border-y-transparent border-l-border-strong" />
    </div>
  )
}

function InsertSlot({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Insert effect here"
      className="grid h-20 w-6 shrink-0 place-items-center rounded-md border border-dashed border-transparent text-muted-foreground/40 transition-colors hover:border-border-strong hover:text-foreground"
    >
      <Plus className="size-3.5" />
    </button>
  )
}

// =============================================================================
// Output endpoint
// =============================================================================

function OutputBlock({ outputDb, compound }: { outputDb?: number; compound: boolean }) {
  return (
    <div
      className={cn(
        "flex w-32 shrink-0 flex-col justify-between rounded-lg border border-border-strong bg-card-raised px-3 py-2",
        compound && "self-stretch",
      )}
    >
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Speaker className="size-3" />
        Output
      </div>
      <div>
        <div className="text-sm font-medium leading-tight">Master out</div>
        {outputDb != null && (
          <div className="font-mono text-[11px] text-muted-foreground">
            {outputDb > -0.01 ? "0.0" : outputDb.toFixed(1)} dB
          </div>
        )}
      </div>
    </div>
  )
}

// =============================================================================
// Block metadata
// =============================================================================

function blockMeta(block: ChainBlock): { Icon: LucideIcon; kindLabel: string; tone: string } {
  switch (block.kind) {
    case "instrument":
      return { Icon: Music4, kindLabel: "Instrument", tone: "text-chart-3" }
    case "effect":
      return { Icon: Sparkles, kindLabel: "Effect", tone: "text-chart-2" }
    case "builtin-effect":
      return { Icon: Sparkles, kindLabel: "Built-in", tone: "text-chart-2" }
    case "warning":
      return { Icon: AlertTriangle, kindLabel: "Warning", tone: "text-warning" }
  }
}
