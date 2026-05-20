import * as React from "react"
import { EnginePanel } from "@/components/shell/engine-panel"
import { ShowToolbar } from "@/components/shell/show-toolbar"
import { PatchEditor } from "@/screens/patch-editor"
import { useShowStore } from "@/state/show-store"

/**
 * The real Stardust shell. The engine panel above the patch editor is
 * a diagnostic surface — pick a CLAP plugin + MIDI in + audio out, hit
 * Start, hear it play. The patch editor below is now wired to the
 * store: every graph mutation persists into the show, and Open / Save
 * Show round-trip the whole document to disk via the Tauri bridge.
 *
 * Subscribe to primitive store fields (songs, currentPatchId, etc.) —
 * not to derived selectors that build new objects each call — and
 * compute the derivations via `useMemo`. Zustand's default equality is
 * `Object.is`, so a selector that returns a fresh array each render
 * loops forever.
 */
export default function App() {
  const showName = useShowStore((s) => s.showName)
  const rig = useShowStore((s) => s.rig)
  const savedBlocks = useShowStore((s) => s.savedBlocks)
  const currentPatchId = useShowStore((s) => s.currentPatchId)
  const songs = useShowStore((s) => s.songs)
  const setGraph = useShowStore((s) => s.setGraph)
  const selectPatch = useShowStore((s) => s.selectPatch)

  const outline = React.useMemo(
    () =>
      songs.map((song) => ({
        id: song.id,
        number: song.number,
        name: song.name,
        patches: song.patches.map((p) => ({
          id: p.id,
          number: p.number,
          name: p.name,
          compound: p.compound,
        })),
      })),
    [songs],
  )

  const { currentPatch, currentSong } = React.useMemo(() => {
    if (!currentPatchId) return { currentPatch: undefined, currentSong: undefined }
    for (const song of songs) {
      const p = song.patches.find((p) => p.id === currentPatchId)
      if (p) return { currentPatch: p, currentSong: song }
    }
    return { currentPatch: undefined, currentSong: undefined }
  }, [songs, currentPatchId])

  const savedComposites = React.useMemo(
    () =>
      savedBlocks.map((b) => ({
        id: b.id,
        name: b.name,
        nodeCount: b.nodeCount,
      })),
    [savedBlocks],
  )

  return (
    <div className="flex h-screen flex-col">
      <EnginePanel />
      <div className="min-h-0 flex-1">
        <PatchEditor
          showName={showName}
          songs={outline}
          graph={currentPatch?.graph ?? { nodes: [], wires: [], composites: [] }}
          onGraphChange={(g) => currentPatch && setGraph(currentPatch.id, g)}
          selectedPatchId={currentPatchId}
          onSelectPatch={selectPatch}
          patchName={currentPatch?.name ?? "—"}
          songName={currentSong?.name ?? "—"}
          headerActions={<ShowToolbar />}
          rigSources={rig.sources}
          savedComposites={savedComposites}
        />
      </div>
    </div>
  )
}
