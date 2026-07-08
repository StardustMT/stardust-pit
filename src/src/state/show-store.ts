/**
 * Zustand store for the loaded show.
 *
 * Single source of truth for the show currently open in the app:
 * songs (each with patches that inline their PatchGraph), rig sources,
 * saved blocks, and which patch is currently being edited. The patch
 * editor used to own its own graph state via `useState`; lifting that
 * here lets Save Show serialise every patch in the show, not just the
 * one on-screen.
 *
 * The state shape mirrors `ShowWire` from `lib/tauri.ts` (which mirrors
 * `stardust_show::Show`) so `getDocument()` is a straight wrap, not a
 * conversion pass.
 *
 * Seeded from `_seed-data.ts` on first import. The seed survives until
 * the user opens a `.stardustshow` file, at which point `replaceShow`
 * swaps in the loaded document.
 */

import { create } from "zustand"
import type {
  PatchWire,
  RigComponentConfig,
  RigComponentWire,
  RigWire,
  SavedBlockWire,
  ShowDocument,
  ShowWire,
  SongWire,
} from "@/lib/tauri"
import { classOf, type NodeKind, type PatchGraph } from "@/components/patch-graph/_types"
import {
  DEFAULT_RIG,
  LSOH_SONGS,
  casualPatchGraph,
  compositeBlockPatchGraph,
  pianoWithSendsPatchGraph,
  transposedSplitPatchGraph,
} from "@/screens/_seed-data"

interface ShowState {
  showName: string
  songs: SongWire[]
  rig: RigWire
  savedBlocks: SavedBlockWire[]
  currentPatchId: string | undefined
  dirty: boolean

  // Actions
  setGraph: (patchId: string, graph: PatchGraph) => void
  selectPatch: (patchId: string) => void
  replaceShow: (doc: ShowDocument) => void
  /**
   * Rig component CRUD (#122). Components are the unit of hardware
   * identity; source nodes reference them by id. Deleting a component
   * leaves referencing nodes unassigned (silent + flagged) — it never
   * invalidates a show.
   */
  addRigComponent: (component: RigComponentWire) => void
  updateRigComponent: (
    id: string,
    patch: { name?: string; config?: Partial<RigComponentConfig> },
  ) => void
  removeRigComponent: (id: string) => void
  /**
   * Reset the store to a minimal blank show: one untitled song with one
   * untitled patch holding an empty graph, no rig sources, no saved
   * blocks. The next save will prompt for a filename.
   */
  newShow: () => void
  /**
   * Append a new song to the show with one empty patch, and select that
   * patch. ID + number are picked to be unique within the current show
   * (ADR-0005: patch ids must be unique show-wide, not just per song).
   */
  addSong: () => void
  /**
   * Append a new empty patch to the given song and select it. No-op if
   * the song id isn't found.
   */
  addPatch: (songId: string) => void
  markClean: () => void
  getDocument: () => ShowDocument
}

/** Pick the next `s<N>` id not already in use by any song. */
function nextSongId(songs: SongWire[]): string {
  const taken = new Set(songs.map((s) => s.id))
  let n = songs.length + 1
  while (taken.has(`s${n}`)) n++
  return `s${n}`
}

/**
 * Pick a fresh patch id within the given song scope, formatted to look
 * like the seed convention (`p<song-num>.<patch-num>`). Falls back to
 * appending a numeric suffix if the natural name collides — patch ids
 * must be unique show-wide per ADR-0005.
 */
function nextPatchId(songId: string, allPatchIds: Set<string>, patchCount: number): string {
  const songNum = songId.match(/^s(\d+)$/)?.[1] ?? songId.replace(/[^a-z0-9]/gi, "")
  let n = patchCount + 1
  let candidate = `p${songNum}.${n}`
  while (allPatchIds.has(candidate)) {
    n++
    candidate = `p${songNum}.${n}`
  }
  return candidate
}

/** Pick the next `rc-<N>` id not already in use by any rig component. */
export function nextRigComponentId(components: RigComponentWire[]): string {
  const taken = new Set(components.map((c) => c.id))
  let n = components.length + 1
  while (taken.has(`rc-${n}`)) n++
  return `rc-${n}`
}

/**
 * Minimal blank show used by `newShow()`. One song / one patch / empty
 * graph — gives the user a slot to start dropping nodes into without
 * having to navigate the outline first.
 */
function buildBlankShow(): {
  showName: string
  songs: SongWire[]
  rig: RigWire
  savedBlocks: SavedBlockWire[]
  currentPatchId: string
} {
  const patch: PatchWire = {
    id: "p1.1",
    number: 1,
    name: "Untitled patch",
    graph: { nodes: [], wires: [], composites: [] },
  }
  const song: SongWire = {
    id: "s1",
    number: 1,
    name: "Untitled song",
    patches: [patch],
  }
  return {
    showName: "Untitled show",
    songs: [song],
    rig: { components: [] },
    savedBlocks: [],
    currentPatchId: patch.id,
  }
}

/**
 * Build the initial show from the existing TS fixtures. Most patches in
 * `_seed-data.ts` are placeholders (no graph); we attach a varied set of
 * pre-built graphs to the first few so the app boots with realistic
 * content. The rest get an empty graph (one keyboard + one main out, no
 * wires) — they're edit-from-scratch slots.
 */
function buildSeedShow(): {
  showName: string
  songs: SongWire[]
  rig: RigWire
  savedBlocks: SavedBlockWire[]
  currentPatchId: string
} {
  const variantByPatchId: Record<string, () => PatchGraph> = {
    "p1.1": casualPatchGraph,
    "p2.1": transposedSplitPatchGraph,
    "p3.1": pianoWithSendsPatchGraph,
    "p4.1": compositeBlockPatchGraph,
  }
  const songs: SongWire[] = LSOH_SONGS.map((s) => ({
    id: s.id,
    number: s.number,
    name: s.name,
    patches: s.patches.map<PatchWire>((p) => ({
      id: p.id,
      number: p.number,
      name: p.name,
      compound: p.compound,
      graph: assignSeedComponents((variantByPatchId[p.id] ?? casualPatchGraph)(), DEFAULT_RIG),
    })),
  }))
  return {
    showName: "Little Shop of Horrors",
    songs,
    rig: { components: DEFAULT_RIG },
    savedBlocks: [],
    currentPatchId: "p1.1",
  }
}

/**
 * Point every source node in a seed graph at the first rig component of
 * its kind, so the seed show boots with assigned (not flagged) sources.
 * Seed-only convenience — real assignment happens in the inspector.
 */
function assignSeedComponents(graph: PatchGraph, components: RigComponentWire[]): PatchGraph {
  const byKind = new Map<NodeKind, string>()
  for (const c of components) {
    if (!byKind.has(c.kind)) byKind.set(c.kind, c.id)
  }
  return {
    ...graph,
    nodes: graph.nodes.map((n) => {
      if (classOf(n.kind) !== "source") return n
      const componentId = byKind.get(n.kind)
      if (!componentId) return n
      return { ...n, config: { ...n.config, rigComponentId: componentId } }
    }),
  }
}

export const useShowStore = create<ShowState>()((set, get) => {
  const seed = buildSeedShow()
  return {
    ...seed,
    dirty: false,

    setGraph: (patchId, graph) =>
      set((s) => ({
        songs: s.songs.map((song) => ({
          ...song,
          patches: song.patches.map((p) => (p.id === patchId ? { ...p, graph } : p)),
        })),
        dirty: true,
      })),

    selectPatch: (patchId) => set({ currentPatchId: patchId }),

    replaceShow: (doc) =>
      set({
        showName: doc.show.name,
        songs: doc.show.songs,
        rig: doc.show.rig,
        savedBlocks: doc.show.savedBlocks ?? [],
        currentPatchId: doc.show.songs[0]?.patches[0]?.id,
        dirty: false,
      }),

    newShow: () => set({ ...buildBlankShow(), dirty: false }),

    addRigComponent: (component) =>
      set((s) => ({
        rig: { components: [...s.rig.components, component] },
        dirty: true,
      })),

    updateRigComponent: (id, patch) =>
      set((s) => ({
        rig: {
          components: s.rig.components.map((c) => {
            if (c.id !== id) return c
            return {
              ...c,
              ...(patch.name !== undefined ? { name: patch.name } : {}),
              ...(patch.config !== undefined ? { config: { ...c.config, ...patch.config } } : {}),
            }
          }),
        },
        dirty: true,
      })),

    removeRigComponent: (id) =>
      set((s) => ({
        rig: { components: s.rig.components.filter((c) => c.id !== id) },
        dirty: true,
      })),

    addSong: () =>
      set((s) => {
        const songId = nextSongId(s.songs)
        const allPatchIds = new Set(s.songs.flatMap((x) => x.patches.map((p) => p.id)))
        const patchId = nextPatchId(songId, allPatchIds, 0)
        const newSong: SongWire = {
          id: songId,
          number: s.songs.length + 1,
          name: "New song",
          patches: [
            {
              id: patchId,
              number: 1,
              name: "New patch",
              graph: { nodes: [], wires: [], composites: [] },
            },
          ],
        }
        return {
          songs: [...s.songs, newSong],
          currentPatchId: patchId,
          dirty: true,
        }
      }),

    addPatch: (songId) =>
      set((s) => {
        const song = s.songs.find((x) => x.id === songId)
        if (!song) return s
        const allPatchIds = new Set(s.songs.flatMap((x) => x.patches.map((p) => p.id)))
        const patchId = nextPatchId(songId, allPatchIds, song.patches.length)
        const newPatch: PatchWire = {
          id: patchId,
          number: song.patches.length + 1,
          name: "New patch",
          graph: { nodes: [], wires: [], composites: [] },
        }
        return {
          songs: s.songs.map((x) =>
            x.id === songId ? { ...x, patches: [...x.patches, newPatch] } : x,
          ),
          currentPatchId: patchId,
          dirty: true,
        }
      }),

    markClean: () => set({ dirty: false }),

    getDocument: () => {
      const s = get()
      const show: ShowWire = {
        name: s.showName,
        songs: s.songs,
        rig: s.rig,
      }
      if (s.savedBlocks.length > 0) show.savedBlocks = s.savedBlocks
      return {
        kind: "stardust.show",
        schemaVersion: 3,
        stardustVersion: "0.6.0",
        savedAt: new Date().toISOString(),
        show,
      }
    },
  }
})

// Derivations (current patch, current song, outline view, etc.) live in
// the consumer via `useMemo` — keeping them out of the store sidesteps
// Zustand's Object.is equality and the infinite re-render that comes
// with returning fresh arrays/objects on every selector call.
