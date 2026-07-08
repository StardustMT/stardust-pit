/**
 * Shared engine-status subscription. One store; every consumer (status
 * footer, Settings diagnostics, future widgets) sees the same snapshot.
 * Subscribes to `engine://status` on first use; outside Tauri the status
 * stays `idle`.
 */

import * as React from "react"
import { create } from "zustand"
import { type EngineStatus, engineStatus, isTauri, onEngineStatus } from "./tauri"

interface EngineStatusState {
  status: EngineStatus
  initialized: boolean
  init: () => void
}

export const useEngineStatusStore = create<EngineStatusState>()((set, get) => ({
  status: { kind: "idle" },
  initialized: false,
  init: () => {
    if (get().initialized) return
    set({ initialized: true })
    if (!isTauri()) return
    void engineStatus().then((status) => set({ status }))
    void onEngineStatus((status) => set({ status }))
  },
}))

export function useEngineStatus(): EngineStatus {
  const status = useEngineStatusStore((s) => s.status)
  const init = useEngineStatusStore((s) => s.init)
  React.useEffect(() => init(), [init])
  return status
}
