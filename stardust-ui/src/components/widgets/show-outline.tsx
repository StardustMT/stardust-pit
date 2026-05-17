import * as React from "react"
import { ChevronDown, ChevronRight, Layers } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Show > Song > Patch hierarchical outline. The canonical "where am I"
 * surface for the whole app.
 *
 * Mode behaviour:
 *   - `mode="edit"`: full interactivity. Any song can be expanded or
 *     collapsed. No focus toggle (you want to see everything when editing).
 *   - `mode="live"`: read-only. Always shows every song, but only the
 *     current song's patches are visible. No expand/collapse affordances —
 *     during a show the player isn't fiddling with arrows.
 */

export type OutlinePatch = {
  id: string
  number: number
  name: string
  /** Marks a compound (multi-part) patch */
  compound?: boolean
}

export type OutlineSong = {
  id: string
  number: number
  name: string
  patches: OutlinePatch[]
}

export interface ShowOutlineProps {
  showName: string
  songs: OutlineSong[]
  /** Currently active song id */
  currentSongId: string
  /** Currently active patch id */
  currentPatchId: string
  /** Per-Show terminology override */
  songLabel?: string
  /** "edit" = collapsible. "live" = read-only, current song expanded only */
  mode?: "edit" | "live"
  /** Initially expanded song ids (edit mode only). Defaults to current. */
  defaultExpandedSongIds?: string[]
  onPickSong?: (id: string) => void
  onPickPatch?: (songId: string, patchId: string) => void
  className?: string
}

export function ShowOutline({
  showName,
  songs,
  currentSongId,
  currentPatchId,
  songLabel = "Song",
  mode = "edit",
  defaultExpandedSongIds,
  onPickSong,
  onPickPatch,
  className,
}: ShowOutlineProps) {
  const [expanded, setExpanded] = React.useState<Set<string>>(
    () => new Set(defaultExpandedSongIds ?? [currentSongId]),
  )

  const toggleSong = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const isLive = mode === "live"

  return (
    <div className={cn("flex h-full flex-col rounded-xl border bg-card", className)}>
      <header className="border-b px-3 py-2.5">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {songLabel}s
        </div>
        <div className="truncate text-sm font-semibold">{showName}</div>
      </header>

      <ol className="flex-1 overflow-y-auto p-1.5">
        {songs.map((s) => {
          const isCurrent = s.id === currentSongId
          // Live mode: only the current song shows its patches; other songs
          // render collapsed and non-interactive. Edit mode: respect the
          // user's expand/collapse state.
          const showPatches = isLive ? isCurrent : expanded.has(s.id)
          return (
            <li key={s.id} className="mb-0.5">
              <SongRow
                song={s}
                expanded={showPatches}
                current={isCurrent}
                interactive={!isLive}
                onToggle={() => toggleSong(s.id)}
                onPick={() => onPickSong?.(s.id)}
              />
              {showPatches && (
                <ol className="ml-7 mt-0.5 space-y-px border-l border-border pl-1">
                  {s.patches.map((p, i) => {
                    const isCurrentPatch = isCurrent && p.id === currentPatchId
                    const currentPatchIndex = s.patches.findIndex(
                      (q) => q.id === currentPatchId,
                    )
                    const isNextPatch =
                      isCurrent &&
                      currentPatchIndex !== -1 &&
                      i === currentPatchIndex + 1
                    return (
                      <li key={p.id}>
                        <PatchRow
                          patch={p}
                          current={isCurrentPatch}
                          next={isNextPatch}
                          interactive={!isLive}
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
  expanded,
  current,
  interactive,
  onToggle,
  onPick,
}: {
  song: OutlineSong
  expanded: boolean
  current: boolean
  interactive: boolean
  onToggle: () => void
  onPick: () => void
}) {
  return (
    <div
      className={cn(
        "group flex items-center gap-1 rounded-md px-1 py-1 transition-colors",
        current ? "bg-primary/15" : interactive && "hover:bg-accent",
      )}
    >
      {interactive ? (
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            "grid size-5 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground",
            current && "text-primary",
          )}
          aria-label={expanded ? `Collapse ${song.name}` : `Expand ${song.name}`}
        >
          {expanded ? (
            <ChevronDown className="size-3.5" />
          ) : (
            <ChevronRight className="size-3.5" />
          )}
        </button>
      ) : (
        <span aria-hidden className="size-5" />
      )}
      <button
        type="button"
        onClick={interactive ? onPick : undefined}
        disabled={!interactive}
        className="flex min-w-0 flex-1 items-center gap-2 text-left disabled:cursor-default"
      >
        <span
          className={cn(
            "w-5 shrink-0 text-right font-mono text-[11px]",
            current ? "text-primary" : "text-muted-foreground",
          )}
        >
          {song.number}
        </span>
        <span
          className={cn(
            "min-w-0 truncate text-sm leading-none",
            current && "font-semibold",
          )}
        >
          {song.name}
        </span>
      </button>
    </div>
  )
}

function PatchRow({
  patch,
  current,
  next,
  interactive,
  onPick,
}: {
  patch: OutlinePatch
  current: boolean
  next: boolean
  interactive: boolean
  onPick: () => void
}) {
  return (
    <button
      type="button"
      onClick={interactive ? onPick : undefined}
      disabled={!interactive}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs transition-colors disabled:cursor-default",
        current && "bg-primary text-primary-foreground font-semibold",
        !current && interactive && "text-foreground/80 hover:bg-accent hover:text-foreground",
        !current && !interactive && "text-foreground/80",
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
      {current && (
        <span className="font-mono text-[9px] uppercase tracking-wider opacity-80">Now</span>
      )}
      {next && (
        <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
          Next
        </span>
      )}
    </button>
  )
}
