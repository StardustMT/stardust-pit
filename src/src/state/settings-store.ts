/**
 * App-level settings (not show-document data): the audio output pick and
 * the plugin scan interval. Persisted to localStorage so they survive
 * restarts — device identity is machine-local, so it does NOT belong in
 * the show document (a show must load on any machine).
 *
 * `audioOutput` uses the `"__default__"` sentinel for "host default
 * output" (mirrors the engine's `None`).
 */

import { create } from "zustand"
import { persist } from "zustand/middleware"

export const DEFAULT_OUTPUT = "__default__"

interface SettingsState {
  /** Audio output device name, or `"__default__"`. */
  audioOutput: string
  /** Background plugin rescan interval, minutes (1..=60). */
  scanIntervalMin: number

  setAudioOutput: (device: string) => void
  setScanIntervalMin: (minutes: number) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      audioOutput: DEFAULT_OUTPUT,
      scanIntervalMin: 5,
      setAudioOutput: (audioOutput) => set({ audioOutput }),
      setScanIntervalMin: (minutes) =>
        set({ scanIntervalMin: Math.max(1, Math.min(60, Math.round(minutes) || 5)) }),
    }),
    { name: "stardust-settings" },
  ),
)
