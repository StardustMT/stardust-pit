/**
 * Typed wrappers around the Tauri command surface defined in
 * `src-tauri/src/commands.rs`. UI code should import these helpers
 * instead of calling `invoke()` directly — keeps the command names
 * and response shapes in one place so renaming a command is a
 * single-file change.
 *
 * Response types here mirror the `Serialize` impls in
 * `src-tauri/src/commands.rs` (with `serde(rename_all = "camelCase")`),
 * so anywhere the Rust side renames a field you need to update the
 * TypeScript shape too. There's no auto-generated bridge yet —
 * keeping things hand-typed for v0.2.
 */

import { invoke } from "@tauri-apps/api/core"

// =============================================================================
// Plugin discovery
// =============================================================================

export interface ClapPluginInfo {
  bundlePath: string
  id: string
  name: string
  vendor: string
  version: string
  description: string
  features: string[]
}

export interface ClapScanError {
  path: string
  message: string
}

export interface ClapScanResult {
  plugins: ClapPluginInfo[]
  errors: ClapScanError[]
  pathsScanned: string[]
}

export function listClapPlugins(): Promise<ClapScanResult> {
  return invoke<ClapScanResult>("list_clap_plugins")
}

// =============================================================================
// MIDI input devices
// =============================================================================

export interface MidiInputInfo {
  name: string
}

export function listMidiInputs(): Promise<MidiInputInfo[]> {
  return invoke<MidiInputInfo[]>("list_midi_inputs")
}

// =============================================================================
// Audio output devices
// =============================================================================

export interface AudioOutputInfo {
  name: string
  isDefault: boolean
}

export function listAudioOutputs(): Promise<AudioOutputInfo[]> {
  return invoke<AudioOutputInfo[]>("list_audio_outputs")
}

// =============================================================================
// Tauri detection
// =============================================================================

/**
 * True if we're running inside the Tauri webview (so `invoke` calls
 * will reach the Rust side). False in plain web dev / Storybook —
 * caller can decide to render stub data instead of hitting the bridge
 * and getting an error.
 */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window
}
