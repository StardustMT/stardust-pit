import * as React from "react"
import { Settings2, X } from "lucide-react"
import { ShowToolbar } from "@/components/shell/show-toolbar"
import { EngineStatusBar } from "@/components/shell/engine-status-bar"
import type { AppMode } from "@/components/shell/nav-rail"
import { PatchEditor } from "@/screens/patch-editor"
import { SetupRigScreen } from "@/screens/setup-rig"
import { SettingsScreen } from "@/screens/settings-screen"
import { useShowStore } from "@/state/show-store"
import { useEngineSync } from "@/lib/use-engine-sync"
import { enginePanic } from "@/lib/tauri"

/**
 * The real Stardust shell. The mode switcher routes between screens —
 * Setup mounts the rig screen (#122), Program/Perform mount the patch
 * editor. The engine is synced by `useEngineSync` (always-on, #121) and
 * reports through the real status footer; the old EnginePanel strip is
 * gone. Settings (#117) opens as a full-screen overlay from the gear
 * button (Esc closes it; Shift+Esc stays Panic app-wide).
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

  const [mode, setMode] = React.useState<AppMode>("program")
  const [settingsOpen, setSettingsOpen] = React.useState(false)

  const sync = useEngineSync()

  // Global panic shortcut: Shift+Escape from anywhere in the app.
  // (Configurable binding lands with the button/switch rig work, #5.)
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && e.shiftKey) {
        e.preventDefault()
        void enginePanic()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

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

  const headerActions = (
    <>
      <ShowToolbar />
      <button
        type="button"
        onClick={() => setSettingsOpen(true)}
        aria-label="Open settings"
        title="Settings"
        className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Settings2 className="size-4" />
      </button>
    </>
  )

  const statusBar = <EngineStatusBar sync={sync} />

  return (
    <div className="h-screen w-screen">
      {mode === "setup" ? (
        <SetupRigScreen
          mode={mode}
          onModeChange={setMode}
          headerActions={headerActions}
          statusBar={statusBar}
        />
      ) : (
        <PatchEditor
          showName={showName}
          songs={outline}
          graph={currentPatch?.graph ?? { nodes: [], wires: [], composites: [] }}
          onGraphChange={(g) => currentPatch && setGraph(currentPatch.id, g)}
          selectedPatchId={currentPatchId}
          onSelectPatch={selectPatch}
          patchName={currentPatch?.name ?? "—"}
          songName={currentSong?.name ?? "—"}
          headerActions={headerActions}
          statusBar={statusBar}
          rigComponents={rig.components}
          savedComposites={savedComposites}
          mode={mode}
          onModeChange={setMode}
        />
      )}

      {settingsOpen && <SettingsOverlay onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}

/**
 * Full-screen Settings overlay (#117). Esc or the close button
 * dismisses; focus lands on the close button on open so keyboard users
 * aren't stranded behind the overlay.
 */
function SettingsOverlay({ onClose }: { onClose: () => void }) {
  const closeRef = React.useRef<HTMLButtonElement>(null)
  React.useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.shiftKey) {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      className="dark fixed inset-0 z-50 bg-background text-foreground"
    >
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 inline-flex items-center gap-1 rounded-md border bg-card px-2 py-1 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="size-3.5" />
        Close (Esc)
      </button>
      <SettingsScreen />
    </div>
  )
}
