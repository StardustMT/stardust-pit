import * as React from "react"
import {
  ChevronDown,
  MoreVertical,
  Pencil,
  Plus,
  Sparkles,
  Volume2,
  Wand2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Keyboard, noteName, type KeyboardZone } from "@/components/rig/keyboard"
import { Pads, type PadAssignment } from "@/components/rig/pads"
import { SoundFlow, type SoundBlock } from "@/components/sound/sound-flow"
import type { RigKeyboard } from "@/screens/_demo-data"

/**
 * Patch editor — Program mode canvas.
 *
 *   ┌─ Sticky header ───────────────────────────────────────────┐
 *   │ patch name (editable) · level · transpose · transition... │
 *   ├─ Scrollable middle ───────────────────────────────────────┤
 *   │  RIG (live preview, centered, pads-on-top for compound):  │
 *   │    ┌─ Launchkey ────┐                                      │
 *   │    │   [16 pads]    │   centered in max-width wrapper      │
 *   │    │  [keys + wheels]│                                     │
 *   │    └────────────────┘                                      │
 *   │    ┌─ RD-2000 ──────────────────────────────────────────┐  │
 *   │    │ [88-key + wheels]   sets the max-width             │  │
 *   │    └────────────────────────────────────────────────────┘  │
 *   │                                                            │
 *   │  SOUNDS (grouped by source device, all expanded):          │
 *   │    Group: Launchkey · 1 sound                              │
 *   │      ● Rhodes EP                                           │
 *   │      ┌─ MIDI in ─┐ ┌─ flow ───────────┐ ┌─ output ─┐    │
 *   │      │ device    │ │ [insts]→[fx]→...  │ │ bus      │    │
 *   │      │ ch · range│ │                   │ │ +midi    │    │
 *   │      └───────────┘ └───────────────────┘ └──────────┘    │
 *   │    Group: RD-2000 · 2 sounds                              │
 *   │      ...                                                   │
 *   ├─ Sticky mix (always visible) ─────────────────────────────┤
 *   │ smart-balance · post-FX chain · channel strips · master    │
 *   └────────────────────────────────────────────────────────────┘
 */

export type Sound = {
  id: string
  name: string
  color: string
  source: {
    deviceId: string
    channel: number | "all"
    range: { fromNote: number; toNote: number }
    velocity?: { from: number; to: number }
    /** Pad indices (for pad-triggered sounds). When set, range is ignored. */
    padIndices?: number[]
  }
  blocks: SoundBlock[]
  level: number
  muted?: boolean
  soloed?: boolean
  outputBus?: string
  midiOut?: { deviceId: string; channel: number }
  bendRangeOverride?: number
  linkedPresetId?: string
  modifiedFromPreset?: boolean
}

export interface PatchEditorProps {
  patchName: string
  songName: string
  patchLevel: number
  transposeSemitones: number
  transition: string
  sounds: Sound[]
  keyboards: RigKeyboard[]
  selectedId?: string
  onSelect?: (id: string) => void
  onPatchNameChange?: (name: string) => void
  onPatchLevelChange?: (level: number) => void
  onAddSound?: (deviceId?: string) => void
  onSoundChange?: (id: string, updates: Partial<Sound>) => void
  advanced?: boolean
  onAdvancedChange?: (advanced: boolean) => void
  /** Post-mix FX blocks (chain of effects after the patch master) */
  postMixFx?: SoundBlock[]
  onAddPostMixFx?: (afterId: string | null) => void
  className?: string
}

type LinkedPresetState = "none" | "linked" | "edited"
function linkedStateOf(s: Sound): LinkedPresetState {
  if (!s.linkedPresetId) return "none"
  if (s.modifiedFromPreset) return "edited"
  return "linked"
}

function owningSoundOf(selectedId: string | undefined, sounds: Sound[]): string | undefined {
  if (!selectedId) return undefined
  if (sounds.some((s) => s.id === selectedId)) return selectedId
  for (const s of sounds) {
    if (
      selectedId === `${s.id}:in` ||
      selectedId === `${s.id}:out` ||
      selectedId.startsWith(`${s.id}:add-`)
    ) {
      return s.id
    }
  }
  for (const s of sounds) {
    if (s.blocks.some((b) => b.id === selectedId)) return s.id
  }
  return undefined
}

export function PatchEditor({
  patchName,
  songName: _songName,
  patchLevel,
  transposeSemitones,
  transition,
  sounds,
  keyboards,
  selectedId,
  onSelect,
  onPatchNameChange,
  onPatchLevelChange,
  onAddSound,
  onSoundChange,
  advanced = false,
  onAdvancedChange,
  postMixFx = [],
  onAddPostMixFx,
  className,
}: PatchEditorProps) {
  const stackedKeyboards = React.useMemo(
    () => [...keyboards].sort((a, b) => a.stackOrder - b.stackOrder),
    [keyboards],
  )

  // For width centering: compute the widest natural keyboard width
  // (white-key count * keyWidth). The actual visual key width comes from
  // the Keyboard component default (14px inside rig — overridden via
  // whiteKeyWidth prop on render).
  const KEY_WIDTH = 14
  const widestKeysWidth = React.useMemo(() => {
    let max = 0
    for (const kb of stackedKeyboards) {
      const whiteKeyCount = countWhiteKeys(kb.fromNote, kb.toNote)
      max = Math.max(max, whiteKeyCount * KEY_WIDTH)
    }
    return max
  }, [stackedKeyboards])

  // Sounds grouped by source device id, in rig-stack order
  const soundsByDevice = React.useMemo(() => {
    const m = new Map<string, Sound[]>()
    for (const kb of stackedKeyboards) m.set(kb.id, [])
    for (const s of sounds) {
      const list = m.get(s.source.deviceId)
      if (list) list.push(s)
    }
    return m
  }, [sounds, stackedKeyboards])

  return (
    <div className={cn("flex h-full flex-col bg-background", className)}>
      <MetadataHeader
        patchName={patchName}
        soundCount={sounds.length}
        patchLevel={patchLevel}
        transposeSemitones={transposeSemitones}
        transition={transition}
        advanced={advanced}
        onPatchNameChange={onPatchNameChange}
        onPatchLevelChange={onPatchLevelChange}
        onAdvancedChange={onAdvancedChange}
      />

      <div className="flex-1 overflow-y-auto">
        {/* RIG SECTION (live preview) */}
        <section className="border-b">
          <header className="flex items-baseline justify-between px-4 pt-3">
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Rig
            </h2>
            <span className="text-[10px] text-muted-foreground">
              {stackedKeyboards.length} device{stackedKeyboards.length === 1 ? "" : "s"}
            </span>
          </header>
          <div className="space-y-3 p-4">
            {stackedKeyboards.map((kb) => {
              const zones: KeyboardZone[] = (soundsByDevice.get(kb.id) ?? []).map((s) => ({
                id: s.id,
                label: s.name,
                color: s.color,
                fromNote: s.source.range.fromNote,
                toNote: s.source.range.toNote,
              }))
              const padAssignments: PadAssignment[] | undefined = kb.pads
                ? (soundsByDevice.get(kb.id) ?? [])
                    .filter((s) => s.source.padIndices && s.source.padIndices.length > 0)
                    .flatMap((s) =>
                      s.source.padIndices!.map((padIndex) => ({
                        padIndex,
                        soundId: s.id,
                        color: s.color,
                        label: shortPadLabel(s.name),
                      })),
                    )
                : undefined
              return (
                <RigDevice
                  key={kb.id}
                  keyboard={kb}
                  zones={zones}
                  padAssignments={padAssignments}
                  keyWidth={KEY_WIDTH}
                  widestKeysWidth={widestKeysWidth}
                  selectedId={selectedId}
                  onSelect={onSelect}
                  onZoneChange={(zoneId, range) => {
                    const sound = sounds.find((s) => s.id === zoneId)
                    if (!sound) return
                    onSoundChange?.(zoneId, { source: { ...sound.source, range } })
                  }}
                />
              )
            })}
          </div>
        </section>

        {/* SOUNDS SECTION (grouped by source device, all expanded) */}
        <section className="space-y-4 p-4">
          <header className="flex items-baseline justify-between px-1">
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Sounds
            </h2>
            <span className="text-[10px] text-muted-foreground">
              {sounds.length} total
            </span>
          </header>

          {stackedKeyboards.map((kb) => {
            const groupSounds = soundsByDevice.get(kb.id) ?? []
            return (
              <SoundGroup
                key={kb.id}
                keyboard={kb}
                sounds={groupSounds}
                selectedId={selectedId}
                advanced={advanced}
                onSelect={onSelect}
                onSoundChange={onSoundChange}
                onAddSound={() => onAddSound?.(kb.id)}
              />
            )
          })}
        </section>
      </div>

      {/* STICKY MIX */}
      <PatchMixBar
        sounds={sounds}
        patchLevel={patchLevel}
        onPatchLevelChange={onPatchLevelChange}
        selectedId={selectedId}
        onSelect={onSelect}
        postMixFx={postMixFx}
        onAddPostMixFx={onAddPostMixFx}
      />
    </div>
  )
}

function countWhiteKeys(from: number, to: number): number {
  const blackSet = new Set([1, 3, 6, 8, 10])
  let n = 0
  for (let i = from; i <= to; i++) if (!blackSet.has(i % 12)) n++
  return n
}

function shortPadLabel(name: string): string {
  // Compact pad labels: take 2-3 chars from each word
  const parts = name.split(/\s+/).slice(0, 2)
  return parts.map((p) => p.slice(0, 3)).join(" ")
}

// =============================================================================
// Metadata header (sticky top)
// =============================================================================

function MetadataHeader({
  patchName,
  soundCount,
  patchLevel,
  transposeSemitones,
  transition,
  advanced,
  onPatchNameChange,
  onPatchLevelChange,
  onAdvancedChange,
}: {
  patchName: string
  soundCount: number
  patchLevel: number
  transposeSemitones: number
  transition: string
  advanced: boolean
  onPatchNameChange?: (name: string) => void
  onPatchLevelChange?: (level: number) => void
  onAdvancedChange?: (advanced: boolean) => void
}) {
  return (
    <header className="sticky top-0 z-10 flex items-end justify-between gap-6 border-b bg-card-raised px-4 py-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <EditableTitle value={patchName} onChange={onPatchNameChange} />
        <div className="text-xs text-muted-foreground">
          {soundCount} sound{soundCount === 1 ? "" : "s"}
        </div>
      </div>

      <div className="flex shrink-0 items-end gap-5">
        <CompactField label="Transpose">
          <span className="font-mono text-sm tabular-nums">
            {transposeSemitones > 0 ? "+" : ""}
            {transposeSemitones} st
          </span>
        </CompactField>

        <CompactField label="Transition">
          <span className="text-sm">{transition}</span>
        </CompactField>

        <CompactField label="Patch level" className="w-44">
          <div className="flex items-center gap-2">
            <Volume2 className="size-3.5 shrink-0 text-muted-foreground" />
            <Slider
              value={[patchLevel]}
              max={1}
              step={0.01}
              onValueChange={([v]) => onPatchLevelChange?.(v)}
              className="flex-1"
            />
            <span className="w-8 text-right font-mono text-xs tabular-nums">
              {Math.round(patchLevel * 100)}
            </span>
          </div>
        </CompactField>

        <CompactToggle label="Advanced" active={advanced} onChange={onAdvancedChange} />

        <PatchOptionsMenu />
      </div>
    </header>
  )
}

/**
 * Click-to-edit title. Renders as a heading by default with a subtle
 * pencil hint on hover; clicking switches to an Input. Fixes the
 * "patch name not editable" issue from the previous round (Input was
 * present but visually didn't read as editable).
 */
function EditableTitle({
  value,
  onChange,
}: {
  value: string
  onChange?: (next: string) => void
}) {
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState(value)
  React.useEffect(() => setDraft(value), [value])

  if (editing) {
    return (
      <Input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false)
          if (draft !== value) onChange?.(draft)
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            ;(e.target as HTMLInputElement).blur()
          } else if (e.key === "Escape") {
            setDraft(value)
            setEditing(false)
          }
        }}
        className="h-auto rounded border bg-background px-2 py-0.5 text-xl font-semibold tracking-tight shadow-none"
      />
    )
  }
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title="Click to rename"
      className="group flex items-center gap-1.5 self-start rounded px-1 py-0.5 text-xl font-semibold tracking-tight hover:bg-muted/60"
    >
      <span>{value}</span>
      <Pencil className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  )
}

function CompactField({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  )
}

function CompactToggle({
  label,
  active,
  onChange,
}: {
  label: string
  active: boolean
  onChange?: (v: boolean) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="cursor-pointer text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <Switch checked={active} onCheckedChange={onChange} />
    </div>
  )
}

function PatchOptionsMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Patch options">
          <MoreVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Patch
        </DropdownMenuLabel>
        <DropdownMenuItem>
          Save as preset…
          <DropdownMenuShortcut>⇧⌘S</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem>Duplicate</DropdownMenuItem>
        <DropdownMenuItem>Move to song…</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Reset to defaults</DropdownMenuItem>
        <DropdownMenuItem className="text-destructive">Delete patch…</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// =============================================================================
// Rig device — keyboard with optional pads on top, centered in max-width
// =============================================================================

function RigDevice({
  keyboard,
  zones,
  padAssignments,
  keyWidth,
  widestKeysWidth,
  selectedId,
  onSelect,
  onZoneChange,
}: {
  keyboard: RigKeyboard
  zones: KeyboardZone[]
  padAssignments?: PadAssignment[]
  keyWidth: number
  widestKeysWidth: number
  selectedId?: string
  onSelect?: (id: string) => void
  onZoneChange?: (zoneId: string, range: { fromNote: number; toNote: number }) => void
}) {
  const hasSounds = zones.length > 0
  return (
    <div className={cn("transition-opacity", !hasSounds && "opacity-60")}>
      {/* Device label strip */}
      <div className="mb-1 flex items-baseline justify-between px-2 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className={cn(
              "size-1.5 rounded-full",
              hasSounds ? "bg-primary" : "bg-muted-foreground/30",
            )}
          />
          <span className="font-semibold text-foreground">{keyboard.shortName}</span>
          <span className="font-mono">
            {noteName(keyboard.fromNote)}–{noteName(keyboard.toNote)} · ch{" "}
            {keyboard.defaultChannel}
            {keyboard.bendRangeSemitones != null && (
              <> · bend ±{keyboard.bendRangeSemitones}</>
            )}
          </span>
        </span>
        <span>
          {hasSounds
            ? `${zones.length} sound${zones.length === 1 ? "" : "s"}`
            : "no sounds"}
        </span>
      </div>

      {/* Centred device wrapper */}
      <div className="flex justify-center">
        <div className="flex flex-col items-stretch gap-1" style={{ width: widestKeysWidth }}>
          {/* Pads on top (physical layout for compound controllers) */}
          {keyboard.pads && (
            <div className="flex justify-center">
              <Pads
                rows={keyboard.pads.rows}
                cols={keyboard.pads.cols}
                assignments={padAssignments}
                selectedPadIndex={
                  selectedId?.startsWith(`${keyboard.id}:pad:`)
                    ? Number(selectedId.slice(`${keyboard.id}:pad:`.length))
                    : undefined
                }
                onSelectPad={(idx) => onSelect?.(`${keyboard.id}:pad:${idx}`)}
              />
            </div>
          )}

          {/* Keyboard, centred within widestKeysWidth */}
          <div className="flex justify-center">
            <Keyboard
              fromNote={keyboard.fromNote}
              toNote={keyboard.toNote}
              zones={zones}
              selectedZoneId={selectedId}
              onZoneSelect={onSelect}
              onZoneChange={onZoneChange}
              showWheels
              bendRangeSemitones={keyboard.bendRangeSemitones ?? 2}
              whiteKeyWidth={keyWidth}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// Sound group — heading + sounds that use this source device + add-sound CTA
// =============================================================================

function SoundGroup({
  keyboard,
  sounds,
  selectedId,
  advanced,
  onSelect,
  onSoundChange,
  onAddSound,
}: {
  keyboard: RigKeyboard
  sounds: Sound[]
  selectedId?: string
  advanced: boolean
  onSelect?: (id: string) => void
  onSoundChange?: (id: string, updates: Partial<Sound>) => void
  onAddSound?: () => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between px-1">
        <h3 className="text-xs font-semibold">
          Sounds on{" "}
          <span className="text-foreground">{keyboard.shortName}</span>{" "}
          <span className="font-normal text-muted-foreground">
            ({sounds.length})
          </span>
        </h3>
      </div>

      {sounds.length === 0 ? (
        <button
          type="button"
          onClick={onAddSound}
          className="block w-full rounded-lg border border-dashed border-border bg-card/30 px-3 py-4 text-center text-xs text-muted-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary"
        >
          <Plus className="mx-auto mb-1 size-4" />
          No sounds use {keyboard.shortName} yet · click to add
        </button>
      ) : (
        <>
          <div className="space-y-2">
            {sounds.map((s) => (
              <SoundRow
                key={s.id}
                sound={s}
                sourceDevice={keyboard}
                selectedId={selectedId}
                advanced={advanced}
                onSelect={onSelect}
                onChange={(u) => onSoundChange?.(s.id, u)}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={onAddSound}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
          >
            <Plus className="size-3.5" />
            Add sound on {keyboard.shortName}
          </button>
        </>
      )}
    </div>
  )
}

// =============================================================================
// Sound row — always expanded; header strip + full-height in/middle/out grid
// =============================================================================

function SoundRow({
  sound,
  sourceDevice,
  selectedId,
  advanced,
  onSelect,
  onChange,
}: {
  sound: Sound
  sourceDevice?: RigKeyboard
  selectedId?: string
  advanced: boolean
  onSelect?: (id: string) => void
  onChange?: (updates: Partial<Sound>) => void
}) {
  const isSelected = selectedId === sound.id
  const linkedState = linkedStateOf(sound)
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border bg-card transition-colors",
        isSelected ? "border-primary/50" : "border-border",
        sound.muted && "opacity-60",
      )}
    >
      {/* Header strip */}
      <div className="flex items-center gap-3 border-b bg-card-raised px-4 py-2">
        <button
          type="button"
          onClick={() => onSelect?.(sound.id)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span
            aria-hidden
            className="block h-6 w-1 shrink-0 rounded-full"
            style={{ background: sound.color }}
          />
          <Input
            value={sound.name}
            onChange={(e) => onChange?.({ name: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            className="h-7 max-w-[240px] border-transparent bg-transparent text-sm font-semibold shadow-none focus-visible:border-input focus-visible:bg-background"
          />
          {linkedState === "linked" && (
            <span className="rounded bg-accent px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">
              preset
            </span>
          )}
          {linkedState === "edited" && (
            <span className="rounded bg-warning/20 px-1.5 py-0.5 font-mono text-[10px] uppercase text-warning">
              preset · edited
            </span>
          )}
        </button>

        <div className="flex shrink-0 items-center gap-3">
          <div className="flex items-center gap-2 text-xs">
            <Volume2 className="size-3 text-muted-foreground" />
            <Slider
              value={[sound.level]}
              max={1}
              step={0.01}
              onValueChange={([v]) => onChange?.({ level: v })}
              className="w-28"
            />
            <span className="w-7 text-right font-mono tabular-nums">
              {Math.round(sound.level * 100)}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <SoloMuteToggle
              label="M"
              active={sound.muted ?? false}
              onChange={(v) => onChange?.({ muted: v })}
              tone="muted"
            />
            <SoloMuteToggle
              label="S"
              active={sound.soloed ?? false}
              onChange={(v) => onChange?.({ soloed: v })}
              tone="solo"
            />
          </div>
        </div>
      </div>

      {/* Body: full-height MIDI in | sound flow | output */}
      <div className="grid grid-cols-[220px_1fr_180px] items-stretch border-t bg-background">
        <MidiInSidebar
          sound={sound}
          sourceDevice={sourceDevice}
          selected={selectedId === `${sound.id}:in`}
          onSelect={() => onSelect?.(`${sound.id}:in`)}
        />

        <div className="min-w-0 border-x px-3 py-2">
          <SoundFlow
            blocks={sound.blocks}
            selectedId={selectedId}
            advanced={advanced}
            onSelectBlock={onSelect}
            onAddInstrument={() => onSelect?.(`${sound.id}:add-instrument`)}
            onAddEffect={(after) => onSelect?.(`${sound.id}:add-effect:${after}`)}
          />
        </div>

        <OutputSidebar
          sound={sound}
          selected={selectedId === `${sound.id}:out`}
          onSelect={() => onSelect?.(`${sound.id}:out`)}
          advanced={advanced}
        />
      </div>
    </div>
  )
}

function SoloMuteToggle({
  label,
  active,
  onChange,
  tone,
}: {
  label: string
  active: boolean
  onChange: (v: boolean) => void
  tone: "muted" | "solo"
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onChange(!active)
      }}
      title={tone === "muted" ? "Mute" : "Solo"}
      className={cn(
        "grid size-5 place-items-center rounded font-mono text-[10px] font-bold transition-colors",
        active
          ? tone === "muted"
            ? "bg-muted text-foreground/60 line-through"
            : "bg-warning text-warning-foreground"
          : "bg-muted/40 text-muted-foreground hover:bg-muted",
      )}
    >
      {label}
    </button>
  )
}

// =============================================================================
// Full-height MIDI in / output sidebars
// =============================================================================

function MidiInSidebar({
  sound,
  sourceDevice,
  selected,
  onSelect,
}: {
  sound: Sound
  sourceDevice?: RigKeyboard
  selected: boolean
  onSelect: () => void
}) {
  const ch = sound.source.channel === "all" ? "All ch" : `Ch ${sound.source.channel}`
  const usesPads = !!sound.source.padIndices?.length
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex h-full flex-col items-stretch gap-2 px-3 py-3 text-left transition-colors",
        selected ? "bg-primary/10 ring-1 ring-inset ring-primary/40" : "hover:bg-muted/30",
      )}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        MIDI in
      </div>
      <div className="text-sm font-medium">{sourceDevice?.shortName ?? "—"}</div>
      <div className="space-y-0.5 font-mono text-[11px] text-muted-foreground">
        <div>{ch}</div>
        {usesPads ? (
          <div>
            pads{" "}
            {sound.source.padIndices!
              .map((i) => i + 1)
              .sort((a, b) => a - b)
              .join(", ")}
          </div>
        ) : (
          <div>
            {noteName(sound.source.range.fromNote)} – {noteName(sound.source.range.toNote)}
          </div>
        )}
        {sound.source.velocity && (
          <div>
            vel {sound.source.velocity.from}–{sound.source.velocity.to}
          </div>
        )}
        {sound.bendRangeOverride != null && (
          <div className="text-primary">bend ±{sound.bendRangeOverride}</div>
        )}
      </div>
    </button>
  )
}

function OutputSidebar({
  sound,
  selected,
  onSelect,
  advanced,
}: {
  sound: Sound
  selected: boolean
  onSelect: () => void
  advanced: boolean
}) {
  const audioOut = sound.outputBus ?? "Patch mix"
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex h-full flex-col items-stretch gap-2 px-3 py-3 text-left transition-colors",
        selected ? "bg-primary/10 ring-1 ring-inset ring-primary/40" : "hover:bg-muted/30",
      )}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Output
      </div>
      <div className="text-sm font-medium">{audioOut}</div>
      <div className="space-y-0.5 font-mono text-[11px] text-muted-foreground">
        <div>Audio</div>
        {sound.midiOut ? (
          <div className="text-primary">+ MIDI ch {sound.midiOut.channel}</div>
        ) : (
          advanced && <div className="opacity-60">no MIDI out</div>
        )}
      </div>
    </button>
  )
}

// =============================================================================
// Patch mix bar (sticky bottom)
// =============================================================================

function PatchMixBar({
  sounds,
  patchLevel,
  onPatchLevelChange,
  selectedId,
  onSelect,
  postMixFx,
  onAddPostMixFx,
}: {
  sounds: Sound[]
  patchLevel: number
  onPatchLevelChange?: (level: number) => void
  selectedId?: string
  onSelect?: (id: string) => void
  postMixFx: SoundBlock[]
  onAddPostMixFx?: (afterId: string | null) => void
}) {
  const [postFxOpen, setPostFxOpen] = React.useState(false)
  return (
    <div className="z-10 border-t bg-card-raised">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-2">
        <div className="flex items-baseline gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Patch mix
          </span>
          <span className="text-xs text-muted-foreground">
            {sounds.length} channel{sounds.length === 1 ? "" : "s"} · master{" "}
            {Math.round(patchLevel * 100)}%
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5">
            <Wand2 className="size-3.5" />
            Smart-balance
          </Button>
          <Button
            size="sm"
            variant={postFxOpen ? "secondary" : "ghost"}
            onClick={() => setPostFxOpen((o) => !o)}
            className="gap-1.5"
          >
            <Sparkles className="size-3.5" />
            Post-mix FX
            <span className="rounded bg-muted px-1 py-0.5 font-mono text-[9px]">
              {postMixFx.length}
            </span>
            <ChevronDown
              className={cn("size-3 transition-transform", postFxOpen && "rotate-180")}
            />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto_auto] items-end gap-6 px-4 py-3">
        <div className="flex gap-2 overflow-x-auto">
          {sounds.map((s) => (
            <MixChannel
              key={s.id}
              sound={s}
              selected={selectedId === `patch-mix:${s.id}`}
              onSelect={() => onSelect?.(`patch-mix:${s.id}`)}
            />
          ))}
        </div>

        <div aria-hidden className="h-24 w-px bg-border" />

        <MasterChannel
          level={patchLevel}
          onLevelChange={onPatchLevelChange}
          selected={selectedId === "patch-mix:master"}
          onSelect={() => onSelect?.("patch-mix:master")}
        />
      </div>

      {/* Post-mix FX rack — uses SoundFlow with instruments disabled */}
      {postFxOpen && (
        <div className="border-t bg-card px-4 py-3">
          <SoundFlow
            blocks={postMixFx}
            selectedId={selectedId}
            onSelectBlock={onSelect}
            onAddEffect={onAddPostMixFx}
            instrumentsAllowed={false}
          />
        </div>
      )}
    </div>
  )
}

function MixChannel({
  sound,
  selected,
  onSelect,
}: {
  sound: Sound
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-12 flex-col items-center gap-1 rounded p-1 transition-colors",
        selected ? "bg-primary/15 ring-1 ring-primary/40" : "hover:bg-card",
      )}
    >
      <div className="relative h-24 w-full overflow-hidden rounded bg-muted">
        <div
          className="absolute inset-x-0 bottom-0"
          style={{
            background: sound.color,
            height: `${sound.level * 100}%`,
          }}
        />
      </div>
      <div className="w-full truncate text-center text-[9px] font-medium" title={sound.name}>
        {sound.name}
      </div>
      <div className="font-mono text-[9px] text-muted-foreground">
        {Math.round(sound.level * 100)}
      </div>
    </button>
  )
}

function MasterChannel({
  level,
  onLevelChange,
  selected,
  onSelect,
}: {
  level: number
  onLevelChange?: (v: number) => void
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-14 flex-col items-center gap-1 rounded p-1 transition-colors",
        selected ? "bg-primary/15 ring-1 ring-primary/40" : "hover:bg-card",
      )}
    >
      <div className="relative h-24 w-full overflow-hidden rounded bg-muted">
        <div
          className="absolute inset-x-0 bottom-0 bg-primary"
          style={{ height: `${level * 100}%` }}
          onClick={(e) => {
            e.stopPropagation()
            onLevelChange?.(Math.min(1, level + 0.05))
          }}
        />
      </div>
      <div className="text-[9px] font-bold uppercase tracking-wider">Master</div>
      <div className="font-mono text-[9px] text-muted-foreground">
        {Math.round(level * 100)}
      </div>
    </button>
  )
}
