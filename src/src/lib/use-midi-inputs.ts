/**
 * Shared MIDI input enumeration cache — same pattern as
 * `use-plugin-scan`. The engine panel's device dropdown and the patch
 * editor's source-binding inspector (#2) both need the list; one store
 * keeps them consistent and the panel's Refresh re-enumerates for all
 * subscribers.
 *
 * Storybook / non-Tauri: `refresh()` is a no-op, `inputs` stays empty —
 * callers provide their own mock lists.
 */

import * as React from "react"
import { create } from "zustand"
import { type MidiInputInfo, isTauri, listMidiInputs } from "./tauri"

interface MidiInputsState {
  inputs: MidiInputInfo[]
  loading: boolean
  error: string | undefined
  initialized: boolean
  refresh: () => Promise<void>
}

export const useMidiInputsStore = create<MidiInputsState>()((set, get) => ({
  inputs: [],
  loading: false,
  error: undefined,
  initialized: false,
  refresh: async () => {
    if (!isTauri()) {
      set({ initialized: true })
      return
    }
    if (get().loading) return
    set({ loading: true, error: undefined })
    try {
      const inputs = await listMidiInputs()
      set({ inputs, loading: false, initialized: true })
    } catch (e) {
      set({
        loading: false,
        initialized: true,
        error: e instanceof Error ? e.message : String(e),
      })
    }
  },
}))

/** One-shot enumeration on first mount + the cached list. */
export function useMidiInputs() {
  const inputs = useMidiInputsStore((s) => s.inputs)
  const loading = useMidiInputsStore((s) => s.loading)
  const error = useMidiInputsStore((s) => s.error)
  const initialized = useMidiInputsStore((s) => s.initialized)
  const refresh = useMidiInputsStore((s) => s.refresh)
  React.useEffect(() => {
    if (!initialized) void refresh()
  }, [initialized, refresh])
  return { inputs, loading, error, refresh }
}
