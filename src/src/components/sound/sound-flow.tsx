import * as React from "react"
import {
  AlertTriangle,
  Music4,
  Plus,
  Sparkles,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Visual sound flow:
 *
 *      [Instrument 1]
 *      [Instrument 2 (layer)]  ──→  [FX 1] [+] → [FX 2] [+] → ...
 *      [Instrument 3 (layer)]
 *      [+ Add instrument]
 *
 * Instruments stack vertically (organ-stop style layering) with the
 * "+ Add instrument" CTA placed BELOW them — they're the first layer of
 * control, so they read top-to-bottom as their own column. Effects flow
 * horizontally to the right of the implicit convergence point.
 *
 * Block rules (data model is still flat — `blocks` array — but layout
 * groups by kind):
 *   - Instruments precede effects.
 *   - Multiple instruments = layered (same MIDI input → all instruments).
 *   - Effects can be reordered among themselves; instruments stay at start.
 *   - Built-in effects render the same as plugin effects.
 *
 * Insert `+` slots sit to the RIGHT of each effect's connector arrow
 * (where the inserted effect actually lands).
 *
 * The same component is reused for the post-mix FX rack — set
 * `instrumentsAllowed={false}` to disable the instrument column.
 */

export type PluginFormat = "VST3" | "CLAP" | "AU" | "built-in"

export type SoundBlock =
  | {
      kind: "instrument"
      id: string
      name: string
      format: PluginFormat
      vendor?: string
      cpu?: number
      muted?: boolean
      /** Short "at a glance" summary of the most important settings. */
      summary?: string
    }
  | {
      kind: "effect"
      id: string
      name: string
      format: PluginFormat
      vendor?: string
      cpu?: number
      bypassed?: boolean
      /** Short summary — e.g. "low boost +6 dB", "wet 35%". */
      summary?: string
    }
  | {
      kind: "warning"
      id: string
      message: string
    }

export interface SoundFlowProps {
  blocks: SoundBlock[]
  selectedId?: string
  onSelectBlock?: (id: string) => void
  onAddInstrument?: () => void
  onAddEffect?: (afterBlockId: string | null) => void
  /** Show power-user metadata on each block */
  advanced?: boolean
  /** Hide the instrument column (used for post-mix FX rack — effects only) */
  instrumentsAllowed?: boolean
  className?: string
}

export function SoundFlow({
  blocks,
  selectedId,
  onSelectBlock,
  onAddInstrument,
  onAddEffect,
  advanced,
  instrumentsAllowed = true,
  className,
}: SoundFlowProps) {
  const instruments = blocks.filter((b) => b.kind === "instrument")
  const effects = blocks.filter((b) => b.kind === "effect" || b.kind === "warning")
  const hasInstrument = instruments.length > 0

  return (
    <div className={cn("flex min-w-0 items-start gap-3 overflow-x-auto py-2", className)}>
      {/* Instrument column */}
      {instrumentsAllowed && (
        <div className="flex shrink-0 flex-col gap-2">
          {hasInstrument ? (
            <>
              {instruments.map((block, i) => (
                <Block
                  key={block.id}
                  block={block}
                  selected={block.id === selectedId}
                  advanced={advanced}
                  onSelect={() => onSelectBlock?.(block.id)}
                  variant="instrument-stacked"
                  layerIndex={i}
                />
              ))}
              <AddSecondaryCTA label="Add instrument" onClick={onAddInstrument} />
            </>
          ) : (
            <AddInstrumentCTA onClick={onAddInstrument} />
          )}
        </div>
      )}

      {/* Convergence arrow (only when both sides exist) */}
      {instrumentsAllowed && hasInstrument && (
        <ConvergenceArrow effectsPresent={effects.length > 0} />
      )}

      {/* Effects row */}
      {(effects.length > 0 || !instrumentsAllowed || hasInstrument) && (
        <div className="flex shrink-0 items-center gap-0.5 pt-1">
          {effects.map((block, i) => (
            <React.Fragment key={block.id}>
              <Block
                block={block}
                selected={block.id === selectedId}
                advanced={advanced}
                onSelect={() => onSelectBlock?.(block.id)}
                variant="effect"
              />
              <ArrowWithInsert onInsert={() => onAddEffect?.(block.id)} />
              {i === effects.length - 1 && null /* trailing handled inline */}
            </React.Fragment>
          ))}
          {effects.length === 0 && instrumentsAllowed && hasInstrument && (
            <AddEffectCTA onClick={() => onAddEffect?.(null)} />
          )}
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Block (instrument / effect / warning) — two layout variants
// =============================================================================

function Block({
  block,
  selected,
  advanced,
  onSelect,
  variant,
  layerIndex,
}: {
  block: SoundBlock
  selected: boolean
  advanced?: boolean
  onSelect: () => void
  variant: "instrument-stacked" | "effect"
  layerIndex?: number
}) {
  const meta = blockMeta(block)
  const isWarning = block.kind === "warning"
  const isMuted = block.kind !== "warning" && "muted" in block && block.muted
  const isBypassed = block.kind === "effect" && block.bypassed
  const showLayerHint = variant === "instrument-stacked" && (layerIndex ?? 0) > 0

  return (
    <button
      type="button"
      onClick={onSelect}
      data-selected={selected || undefined}
      className={cn(
        "group relative flex shrink-0 flex-col justify-between rounded-lg border bg-card-raised px-3 py-2 text-left transition-all",
        variant === "instrument-stacked" ? "w-56 min-h-[64px]" : "h-20 w-44",
        selected
          ? "border-primary ring-2 ring-primary/40"
          : "border-border hover:border-border-strong",
        isMuted && "opacity-50",
        isBypassed && "opacity-60",
        isWarning && "border-warning/50 bg-warning/10",
      )}
    >
      <div className="flex items-start justify-between gap-1.5">
        <span className="flex items-center gap-1.5">
          <meta.Icon className={cn("size-3 shrink-0", meta.tone)} />
          <span className={cn("text-[10px] font-semibold uppercase tracking-wider", meta.tone)}>
            {meta.label}
            {showLayerHint && (
              <span className="ml-1 opacity-60">· layer</span>
            )}
          </span>
        </span>
        {advanced && block.kind !== "warning" && "format" in block && block.format !== "built-in" && (
          <span className="rounded bg-muted px-1 py-0.5 font-mono text-[9px] uppercase text-muted-foreground">
            {block.format}
          </span>
        )}
      </div>

      <div className="min-w-0">
        <div className="truncate text-sm font-medium leading-tight">
          {block.kind === "warning" ? "Missing plugin" : block.name}
        </div>
        {block.kind === "warning" ? (
          <div className="truncate text-[11px] text-warning">{block.message}</div>
        ) : (
          <div className="truncate text-[11px] text-muted-foreground">
            {block.summary ?? ("vendor" in block && block.vendor) ?? ""}
          </div>
        )}
      </div>

      {advanced && block.kind !== "warning" && "cpu" in block && block.cpu != null && (
        <div className="font-mono text-[10px] text-muted-foreground">
          {(block.cpu * 100).toFixed(1)}% CPU
        </div>
      )}
    </button>
  )
}

// =============================================================================
// Convergence arrow (instruments → effects)
// =============================================================================

function ConvergenceArrow({ effectsPresent }: { effectsPresent: boolean }) {
  return (
    <div className="flex h-20 shrink-0 items-center pt-2" aria-hidden>
      <span className="block h-px w-6 bg-border-strong" />
      <span className="block size-0 border-y-[3px] border-l-[5px] border-y-transparent border-l-border-strong" />
      {!effectsPresent && (
        <span className="ml-1 text-[10px] text-muted-foreground">(no effects)</span>
      )}
    </div>
  )
}

// =============================================================================
// Connector arrow + insert slot AFTER an effect block
// =============================================================================

function ArrowWithInsert({ onInsert }: { onInsert: () => void }) {
  return (
    <div className="flex h-20 shrink-0 items-center gap-1 pt-1" aria-hidden>
      <span className="block h-px w-3 bg-border-strong" />
      <span className="block size-0 border-y-[3px] border-l-[5px] border-y-transparent border-l-border-strong" />
      <button
        type="button"
        onClick={onInsert}
        title="Insert effect"
        aria-label="Insert effect"
        className="grid size-5 place-items-center rounded border border-dashed border-border text-muted-foreground/60 transition-colors hover:border-primary hover:text-primary"
      >
        <Plus className="size-3" />
      </button>
    </div>
  )
}

// =============================================================================
// Add CTAs
// =============================================================================

function AddInstrumentCTA({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-16 w-56 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border bg-card/30 text-xs text-muted-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary"
    >
      <span className="flex items-center gap-1.5">
        <Plus className="size-3.5" />
        <span className="font-medium">Add instrument</span>
      </span>
      <span className="text-[10px] opacity-70">VST3 · CLAP · built-in</span>
    </button>
  )
}

function AddSecondaryCTA({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid h-9 w-56 shrink-0 place-items-center rounded-md border border-dashed border-border bg-card/30 text-[11px] text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
    >
      <span className="flex items-center gap-1">
        <Plus className="size-3" />
        {label}
      </span>
    </button>
  )
}

function AddEffectCTA({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid h-20 w-32 place-items-center rounded-lg border border-dashed border-border bg-card/30 text-[11px] text-muted-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary"
    >
      <span className="flex flex-col items-center gap-0.5">
        <Plus className="size-3.5" />
        Add effect
      </span>
    </button>
  )
}

// =============================================================================
// Block metadata
// =============================================================================

function blockMeta(block: SoundBlock): { Icon: LucideIcon; tone: string; label: string } {
  switch (block.kind) {
    case "instrument":
      return { Icon: Music4, tone: "text-chart-3", label: "Instrument" }
    case "effect":
      return { Icon: Sparkles, tone: "text-chart-2", label: "Effect" }
    case "warning":
      return { Icon: AlertTriangle, tone: "text-warning", label: "Warning" }
  }
}

// =============================================================================
// Backwards-compat aliases
// =============================================================================

/** @deprecated use SoundFlow */
export const SignalChain = SoundFlow

/** @deprecated use SoundBlock */
export type ChainPart = { id: string; label?: string; color?: string; blocks: SoundBlock[] }
/** @deprecated use SoundBlock */
export type ChainBlock = SoundBlock
