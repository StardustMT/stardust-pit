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
  RigWire,
  SavedBlockWire,
  ShowDocument,
  ShowWire,
  SongWire,
} from "@/lib/tauri"
import type { PatchGraph } from "@/components/patch-graph/_types"
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
  markClean: () => void
  getDocument: () => ShowDocument
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
      graph: (variantByPatchId[p.id] ?? casualPatchGraph)(),
    })),
  }))
  return {
    showName: "Little Shop of Horrors",
    songs,
    rig: { sources: DEFAULT_RIG },
    savedBlocks: [],
    currentPatchId: "p1.1",
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
          patches: song.patches.map((p) =>
            p.id === patchId ? { ...p, graph } : p,
          ),
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
        schemaVersion: 1,
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
