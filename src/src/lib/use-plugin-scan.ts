/**
 * Shared CLAP plugin scan cache.
 *
 * `list_clap_plugins` walks every plugin search path and dlopens each
 * `.clap` bundle, which is slow enough that we never want it to happen
 * twice in the same session unsolicited. The Settings screen needs the list
 * to populate its diagnostic dropdowns and the patch editor's plugin
 * picker needs the same data; both hit this hook and share one scan.
 *
 * State is module-level (a small zustand store) so every consumer sees
 * the same snapshot regardless of where in the tree it mounts. First
 * caller triggers the scan via `refresh()`; subsequent callers reuse the
 * cached `plugins` array. Calling `refresh()` from anywhere re-scans for
 * all subscribers — that's how the Settings screen's Rescan button propagates
 * to the picker.
 *
 * Storybook / non-Tauri: `refresh()` is a no-op, `plugins` stays empty.
 */

import * as React from "react"
import { create } from "zustand"
import { type ClapPluginInfo, isTauri, listClapPlugins, onPluginScan, rescanPlugins } from "./tauri"

interface PluginScanState {
  plugins: ClapPluginInfo[]
  loading: boolean
  error: string | undefined
  /** Has any consumer ever triggered a scan? */
  initialized: boolean
  /** When the current snapshot arrived (ms epoch); undefined pre-scan. */
  lastScanAt: number | undefined
  refresh: () => Promise<void>
  /** Kick the Rust background rescan thread ("Rescan now"). The fresh
   *  snapshot lands via the `plugins://scan` event — non-blocking. */
  rescanNow: () => Promise<void>
}

export const usePluginScanStore = create<PluginScanState>()((set, get) => {
  // Background rescans (#4) publish fresh snapshots; every subscriber
  // updates without polling.
  if (isTauri()) {
    void onPluginScan((result) => {
      set({ plugins: result.plugins, loading: false, lastScanAt: Date.now() })
    })
  }
  return {
    plugins: [],
    loading: false,
    error: undefined,
    initialized: false,
    lastScanAt: undefined,
    refresh: async () => {
      if (!isTauri()) {
        set({ initialized: true })
        return
      }
      if (get().loading) return
      set({ loading: true, error: undefined })
      try {
        const result = await listClapPlugins()
        set({
          plugins: result.plugins,
          loading: false,
          initialized: true,
          lastScanAt: Date.now(),
        })
      } catch (e) {
        set({
          loading: false,
          initialized: true,
          error: e instanceof Error ? e.message : String(e),
        })
      }
    },
    rescanNow: async () => {
      if (!isTauri()) return
      set({ loading: true, error: undefined })
      try {
        await rescanPlugins()
      } catch (e) {
        set({ loading: false, error: e instanceof Error ? e.message : String(e) })
      }
    },
  }
})

/**
 * Convenience wrapper that triggers a one-shot scan on first mount and
 * returns the current cached list + a refresh action.
 */
export function usePluginScan() {
  const plugins = usePluginScanStore((s) => s.plugins)
  const loading = usePluginScanStore((s) => s.loading)
  const error = usePluginScanStore((s) => s.error)
  const initialized = usePluginScanStore((s) => s.initialized)
  const lastScanAt = usePluginScanStore((s) => s.lastScanAt)
  const refresh = usePluginScanStore((s) => s.refresh)
  const rescanNow = usePluginScanStore((s) => s.rescanNow)
  React.useEffect(() => {
    if (!initialized) void refresh()
  }, [initialized, refresh])
  return { plugins, loading, error, lastScanAt, refresh, rescanNow }
}
