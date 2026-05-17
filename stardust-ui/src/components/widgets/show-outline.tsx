import * as React from "react"
import {
  ChevronDown,
  ChevronRight,
  Disc3,
  Eye,
  EyeOff,
  Layers,
  Music,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Show > Song > Patch hierarchical outline. Single component that
 * replaces the previous separate Setlist + PatchesPanel. Each song
 * collapses to show or hide its patches. A "current-song only" toggle
 * collapses every song except the one currently active — useful during
 * a show when you want focus, not list scanning.
 */

export type OutlinePatch = {
  id: string
  number: number
  name: string
  /** Optional subtitle: instrument shorthand, e.g. "Wurli + EP" */
  subtitle?: string
  /** Marks a compound (multi-part) patch */
  compound?: boolean
}

export type OutlineSong = {
  id: string
  number: number
  name: string
  /** Display key, e.g. "Bbm" */
  key?: string
  /** Approximate length "5:32" */
  length?: string
  patches: OutlinePatch[]
}

export interface ShowOutlineProps {
  showName: string
  /** Per-Show terminology override */
  songLabel?: string
  songs: OutlineSong[]
  /** Currently active song id */
  currentSongId: string
  /** Currently active patch id */
  currentPatchId: string
  /** Initially expanded song ids; if undefined, only current is expanded */
  defaultExpandedSongIds?: string[]
  /** Controlled focus mode */
  focusCurrentSong?: boolean
  onFocusChange?: (focus: boolean) => void
  onPickSong?: (id: string) => void
  onPickPatch?: (songId: string, patchId: string) => void
  className?: string
}

export function ShowOutline({
  showName,
  songLabel = "Song",
  songs,
  currentSongId,
  currentPatchId,
  defaultExpandedSongIds,
  focusCurrentSong: controlledFocus,
  onFocusChange,
  onPickSong,
  onPickPatch,
  className,
}: ShowOutlineProps) {
  const [internalFocus, setInternalFocus] = React.useState(false)
  const focusCurrent = controlledFocus ?? internalFocus

  const [expanded, setExpanded] = React.useState<Set<string>>(
    () =>
      new Set(
        defaultExpandedSongIds ?? [currentSongId],
      ),
  )

  const toggleSong = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleFocus = () => {
    const next = !focusCurrent
    if (onFocusChange) onFocusChange(next)
    else setInternalFocus(next)
  }

  const totalPatches = songs.reduce((n, s) => n + s.patches.length, 0)

  return (
    <div className={cn("flex h-full flex-col rounded-xl border bg-card", className)}>
      {/* Header */}
      <header className="border-b px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Disc3 className="size-4 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Show outline
            </div>
            <div className="truncate text-sm font-semibold">{showName}</div>
          </div>
          <button
            type="button"
            onClick={toggleFocus}
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-1.5 py-1 text-[10px] font-medium uppercase tracking-wider transition-colors",
              focusCurrent
                ? "border-primary/40 bg-primary/15 text-primary"
                : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
            title={focusCurrent ? "Showing only current song" : "Showing entire show"}
          >
            {focusCurrent ? (
              <>
                <EyeOff className="size-3" /> Focus
              </>
            ) : (
              <>
                <Eye className="size-3" /> All
              </>
            )}
          </button>
        </div>
        <div className="mt-1 font-mono text-[11px] text-muted-foreground">
          {songs.length} {songLabel.toLowerCase()}
          {songs.length === 1 ? "" : "s"} · {totalPatches} patch
          {totalPatches === 1 ? "" : "es"}
        </div>
      </header>

      {/* Body */}
      <ol className="flex-1 overflow-y-auto p-1.5">
        {songs.map((s) => {
          const isCurrent = s.id === currentSongId
          const isExpanded = expanded.has(s.id)
          const hidden = focusCurrent && !isCurrent
          return (
            <li
              key={s.id}
              className={cn("mb-0.5 transition-opacity", hidden && "hidden")}
            >
              <SongRow
                song={s}
                songLabel={songLabel}
                expanded={isExpanded}
                current={isCurrent}
                onToggle={() => toggleSong(s.id)}
                onPick={() => onPickSong?.(s.id)}
              />
              {(isExpanded || (focusCurrent && isCurrent)) && (
                <ol className="ml-7 mt-0.5 space-y-px border-l border-border pl-1">
                  {s.patches.map((p, i) => {
                    const isCurrentPatch = isCurrent && p.id === currentPatchId
                    const isNextPatch =
                      isCurrent &&
                      i > 0 &&
                      s.patches[i - 1]?.id === currentPatchId
                    return (
                      <li key={p.id}>
                        <PatchRow
                          patch={p}
                          current={isCurrentPatch}
                          next={isNextPatch}
                          onPick={() => onPickPatch?.(s.id, p.id)}
                        />
                      </li>
                    )
                  })}
                </ol>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function SongRow({
  song,
  songLabel,
  expanded,
  current,
  onToggle,
  onPick,
}: {
  song: OutlineSong
  songLabel: string
  expanded: boolean
  current: boolean
  onToggle: () => void
  onPick: () => void
}) {
  const Caret: LucideIcon = expanded ? ChevronDown : ChevronRight
  return (
    <div
      className={cn(
        "group flex items-center gap-1 rounded-md px-1 py-1 transition-colors",
        current ? "bg-primary/15" : "hover:bg-accent",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "grid size-5 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground",
          current && "text-primary",
        )}
        aria-label={expanded ? `Collapse ${song.name}` : `Expand ${song.name}`}
      >
        <Caret className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={onPick}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
      >
        <span
          className={cn(
            "w-5 shrink-0 text-right font-mono text-[11px]",
            current ? "text-primary" : "text-muted-foreground",
          )}
        >
          {song.number}
        </span>
        <Music className={cn("size-3.5 shrink-0", current ? "text-primary" : "text-muted-foreground/60")} />
        <span className={cn("min-w-0 truncate text-sm leading-none", current && "font-semibold")}>
          {song.name}
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-2 font-mono text-[10px] text-muted-foreground">
          {song.key && <span>{song.key}</span>}
          {song.length && <span>{song.length}</span>}
          <span title={`${song.patches.length} patches in this ${songLabel.toLowerCase()}`}>
            {song.patches.length}p
          </span>
        </div>
      </button>
    </div>
  )
}

function PatchRow({
  patch,
  current,
  next,
  onPick,
}: {
  patch: OutlinePatch
  current: boolean
  next: boolean
  onPick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs transition-colors",
        current && "bg-primary text-primary-foreground font-semibold",
        next && !current && "bg-accent text-foreground",
        !current && !next && "text-foreground/80 hover:bg-accent hover:text-foreground",
      )}
    >
      <span
        className={cn(
          "w-5 shrink-0 text-right font-mono text-[10px]",
          current ? "text-primary-foreground/80" : "text-muted-foreground",
        )}
      >
        {patch.number}
      </span>
      <span className="min-w-0 flex-1 truncate">{patch.name}</span>
      {patch.compound && (
        <Layers
          className={cn(
            "size-3 shrink-0",
            current ? "text-primary-foreground/80" : "text-muted-foreground",
          )}
        />
      )}
      {patch.subtitle && !current && (
        <span className="hidden truncate font-mono text-[10px] text-muted-foreground sm:inline">
          {patch.subtitle}
        </span>
      )}
      {current && (
        <span className="font-mono text-[9px] uppercase tracking-wider opacity-80">Now</span>
      )}
      {next && (
        <span className="font-mono text-[9px] uppercase tracking-wider opacity-80">Next</span>
      )}
    </button>
  )
}
