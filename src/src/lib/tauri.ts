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
import { listen, type UnlistenFn } from "@tauri-apps/api/event"
import type { NodeKind, PatchGraph } from "@/components/patch-graph/_types"

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
// Engine (plugin host)
// =============================================================================

/**
 * One hosted plugin in the running plan. The Running variant carries a
 * list of these (v0.8b — multi-plugin chains).
 */
export interface HostedPluginStatus {
  name: string
  id: string
  vendor: string
}

/**
 * Counts of native DSP / MIDI nodes the running plan is executing.
 * Surfaced in EnginePanel as a one-line summary.
 */
export interface NativeNodeCounts {
  sine: number
  eq: number
  audioMix: number
  midiTranspose: number
  midiMix: number
}

/**
 * Mirror of `engine::EngineStatus`. Tagged on `kind`; the Running
 * payload was reshaped in v0.8b — it now carries a list of plugins and
 * a count of native nodes instead of one plugin name/id.
 */
export type EngineStatus =
  | { kind: "idle" }
  | {
      kind: "running"
      plugins: HostedPluginStatus[]
      nativeNodes: NativeNodeCounts
      /** `null` when running with no hardware MIDI — UI source only. */
      midiInput: string | null
      audioOutput: string
      sampleRate: number
      channels: number
      droppedEvents: number
      sampleRateMismatch: boolean
    }
  /** One or more plan-build / runtime errors. Pre-formatted by Rust. */
  | { kind: "error"; messages: string[] }

/**
 * Mirror of `commands::EngineStartError`. Synchronous return only
 * surfaces channel-closed failures since v0.8b — every plan-build /
 * plugin-load failure comes back asynchronously via EngineStatus.Error.
 */
export type EngineStartError = { kind: "engine"; message: string }

/**
 * Start the engine from the currently-selected patch. The Rust side walks
 * the patch graph to find the first `instrument.plugin` node and lifts
 * its `bundlePath` / `pluginId` into the engine's `StartConfig`.
 */
export function engineStartFromPatch(args: {
  patch: PatchWire
  midiInput: string | null
  audioOutput: string | null
}): Promise<void> {
  return invoke<void>("engine_start_from_patch", args)
}

/** `.catch(asEngineStartError)` to get a typed error instead of `unknown`. */
export function asEngineStartError(e: unknown): EngineStartError {
  if (e && typeof e === "object" && "kind" in e) return e as EngineStartError
  return { kind: "engine", message: String(e) }
}

/**
 * One MIDI message from a UI source (on-screen keyboard). Fire-and-forget:
 * the Rust side silently no-ops when the engine isn't running, so callers
 * don't need to gate on status before sending.
 */
export type UiMidiMessage =
  | { kind: "noteOn"; channel: number; note: number; velocity: number }
  | { kind: "noteOff"; channel: number; note: number; velocity: number }

export function engineSendMidi(msg: UiMidiMessage): Promise<void> {
  return invoke<void>("engine_send_midi", { msg })
}

export function engineStop(): Promise<void> {
  return invoke<void>("engine_stop")
}

export function engineStatus(): Promise<EngineStatus> {
  return invoke<EngineStatus>("engine_status")
}

/**
 * Subscribe to engine status changes. The engine thread emits one
 * event per state transition (Idle → Running, Stop, errors) plus
 * periodic updates while running if the dropped-event counter ticks.
 */
export function onEngineStatus(cb: (s: EngineStatus) => void): Promise<UnlistenFn> {
  return listen<EngineStatus>("engine://status", (e) => cb(e.payload))
}

// =============================================================================
// Show document load/save
//
// Mirror of `stardust_show::ShowDocument` and surrounding types. The Rust
// crate inlines each patch's `PatchGraph`, so the TS shape does too — no
// side-tables. `kind: "stardust.show"` and `schemaVersion: 1` per ADR-0003
// / ADR-0005.
// =============================================================================

export interface ShowHeader {
  kind: "stardust.show"
  schemaVersion: 1
  stardustVersion?: string
  /** ISO-8601 timestamp set by the UI on every save. */
  savedAt?: string
}

export interface RigSourceWire {
  kind: NodeKind
  label: string
}

export interface RigWire {
  sources: RigSourceWire[]
}

export interface SavedBlockWire {
  id: string
  name: string
  nodeCount: number
}

export interface PatchWire {
  id: string
  number: number
  name: string
  compound?: boolean
  graph: PatchGraph
}

export interface SongWire {
  id: string
  number: number
  name: string
  patches: PatchWire[]
}

export interface ShowWire {
  name: string
  songs: SongWire[]
  rig: RigWire
  savedBlocks?: SavedBlockWire[]
}

export type ShowDocument = ShowHeader & { show: ShowWire }

/**
 * Tagged union mirroring `stardust_patch::ValidationError`. Same shape is
 * shared by patch and show error reporting (the show variant
 * `PatchInvalid` carries a `Vec<ValidationError>` from the embedded patch
 * graph).
 */
export type GraphValidationError =
  | { kind: "duplicateNodeId"; id: string }
  | { kind: "duplicateWireId"; id: string }
  | { kind: "duplicateCompositeId"; id: string }
  | { kind: "duplicatePortId"; node: string; port: string }
  | { kind: "wireUnknownEndpoint"; wire: string; endpoint: string }
  | { kind: "wireUnknownPort"; wire: string; endpoint: string; port: string }
  | { kind: "wireSignalMismatch"; wire: string; from: string; to: string }
  | { kind: "wireDirection"; wire: string; from: string; to: string }
  | { kind: "compositeUnknownNode"; composite: string; node: string }
  | { kind: "compositePromotedPortInvalid"; composite: string; node: string; port: string }
  | { kind: "compositeNotConnected"; composite: string }

/** Mirror of `stardust_show::ShowValidationError`. */
export type ShowValidationError =
  | { kind: "duplicateSongId"; id: string }
  | { kind: "duplicatePatchId"; id: string }
  | { kind: "duplicateBlockId"; id: string }
  | {
      kind: "patchInvalid"
      song: string
      patch: string
      errors: GraphValidationError[]
    }

export type ShowError =
  | { kind: "parse"; message: string }
  | { kind: "validation"; errors: ShowValidationError[] }

/**
 * Tauri rejects invoke promises with the serialized error variant for
 * commands whose `Result::Err` is `Serialize`. Caller `.catch(asShowError)`
 * gets a typed `ShowError` instead of `unknown`.
 */
export function asShowError(e: unknown): ShowError {
  if (e && typeof e === "object" && "kind" in e) return e as ShowError
  return { kind: "parse", message: String(e) }
}

export function loadShow(json: string): Promise<ShowDocument> {
  return invoke<ShowDocument>("load_show", { json })
}

export function saveShow(doc: ShowDocument): Promise<string> {
  return invoke<string>("save_show", { doc })
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
