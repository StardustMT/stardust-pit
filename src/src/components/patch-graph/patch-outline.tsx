import * as React from "react"
import { ChevronDown, ChevronRight, Music, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

export interface OutlinePatch {
  id: string
  name: string
}

export interface OutlineSong {
  id: string
  name: string
  patches: OutlinePatch[]
}

export interface PatchOutlineProps {
  songs: OutlineSong[]
  selectedPatchId?: string
  onSelectPatch?: (songId: string, patchId: string) => void
  onAddSong?: () => void
  onAddPatch?: (songId: string) => void
}

/**
 * Left-side songs/patches outline. Songs are collapsible; patches click to
 * load. Mock interaction only — real wiring happens in the data-model pass.
 */
export function PatchOutline({
  songs,
  selectedPatchId,
  onSelectPatch,
  onAddSong,
  onAddPatch,
}: PatchOutlineProps) {
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {}
    for (const s of songs) init[s.id] = true
    return init
  })

  const toggle = (id: string) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))

  return (
    <div className="flex h-full flex-col gap-2 p-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Songs · Patches
        </span>
        <Button
          size="icon"
          variant="ghost"
          className="size-6 text-muted-foreground"
          onClick={onAddSong}
          title="Add song"
          aria-label="Add song"
        >
          <Plus className="size-3.5" />
        </Button>
      </div>

      <ScrollArea className="-mr-2 flex-1 pr-2">
        <div className="flex flex-col gap-2">
          {songs.map((song) => (
            <SongGroup
              key={song.id}
              song={song}
              expanded={expanded[song.id] ?? true}
              onToggle={() => toggle(song.id)}
              selectedPatchId={selectedPatchId}
              onSelectPatch={(pid) => onSelectPatch?.(song.id, pid)}
              onAddPatch={() => onAddPatch?.(song.id)}
            />
          ))}
          {songs.length === 0 && (
            <div className="grid h-32 place-items-center px-2 text-center text-xs text-muted-foreground">
              No songs yet. Click + to add one.
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

function SongGroup({
  song,
  expanded,
  onToggle,
  selectedPatchId,
  onSelectPatch,
  onAddPatch,
}: {
  song: OutlineSong
  expanded: boolean
  onToggle: () => void
  selectedPatchId: string | undefined
  onSelectPatch: (patchId: string) => void
  onAddPatch: () => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onToggle}
          className="grid size-5 place-items-center rounded text-muted-foreground hover:text-foreground"
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? (
            <ChevronDown className="size-3.5" />
          ) : (
            <ChevronRight className="size-3.5" />
          )}
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <Music className="size-3 shrink-0 text-muted-foreground" />
          <span className="truncate text-xs font-semibold">{song.name}</span>
          <span className="text-[10px] text-muted-foreground/70">
            ({song.patches.length})
          </span>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="size-5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:opacity-100"
          onClick={onAddPatch}
          title="Add patch"
          aria-label="Add patch"
        >
          <Plus className="size-3" />
        </Button>
      </div>
      {expanded && (
        <div className="ml-4 flex flex-col gap-0.5 border-l border-border pl-2">
          {song.patches.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelectPatch(p.id)}
              className={cn(
                "rounded px-2 py-1 text-left text-xs transition-colors",
                p.id === selectedPatchId
                  ? "bg-primary/15 font-semibold text-primary"
                  : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              )}
            >
              {p.name}
            </button>
          ))}
          {song.patches.length === 0 && (
            <div className="px-2 py-1 text-[10px] text-muted-foreground/60">
              No patches
            </div>
          )}
        </div>
      )}
    </div>
  )
}
