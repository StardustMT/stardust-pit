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
  /**
   * Opaque platform port id (midir) — the persistence key for per-source
   * hardware bindings. More stable across replug than the display name.
   */
  id: string
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
 * Surfaced in the status footer as a one-line summary.
 */
export interface NativeNodeCounts {
  testTone: number
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
      /** Open hardware MIDI input names; empty = UI source only. */
      midiInputs: string[]
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
 * Start the engine from the currently-selected patch. MIDI inputs are
 * derived from the rig (union of bound devices, session-wide — #122);
 * the UI never picks devices per patch.
 */
export function engineStartFromPatch(args: {
  patch: PatchWire
  rig: RigWire
  audioOutput: string | null
}): Promise<void> {
  return invoke<void>("engine_start_from_patch", args)
}

/**
 * Push a rig edit to the running engine: re-derives the open device set
 * + per-connection routes and rebinds in place (never restarts). A no-op
 * success while the engine is idle.
 */
export function engineUpdateRig(rig: RigWire): Promise<void> {
  return invoke<void>("engine_update_rig", { rig })
}

/**
 * What `engine_rebind_routing` should change. Omitted (`undefined`)
 * fields are left untouched, so audio and MIDI rebind independently.
 * `audio.device: null` = host default output.
 */
export interface RebindSpec {
  audio?: { device: string | null }
  midiInputs?: string[]
}

/**
 * Mirror of `engine::RebindError`. On any error the previously-active
 * devices stay (or are restored) active — except
 * `audioOpenFailed { restored: false }`, where the engine has stopped
 * and published an Error status.
 */
export type RebindError =
  | { kind: "notRunning" }
  | { kind: "audioDeviceNotFound"; name: string }
  | { kind: "audioOpenFailed"; message: string; restored: boolean }
  | { kind: "midiInputNotFound"; name: string }
  | { kind: "midiOpenFailed"; name: string; message: string }
  | { kind: "tooManyMidiInputs"; max: number }
  | { kind: "internal"; message: string }

/** `.catch(asRebindError)` to get a typed error instead of `unknown`. */
export function asRebindError(e: unknown): RebindError {
  if (e && typeof e === "object" && "kind" in e) return e as RebindError
  return { kind: "internal", message: String(e) }
}

/**
 * Swap the audio output and/or hardware MIDI input set in place — same
 * plan, no plugin reloads, held voices intact. Device identity changes
 * only; a sample-rate or buffer-size change goes through
 * `engineStartFromPatch` (full plan rebuild) instead.
 */
export function engineRebindRouting(spec: RebindSpec): Promise<void> {
  return invoke<void>("engine_rebind_routing", { spec })
}

/**
 * Emergency reset: flush every held voice + reset all continuous
 * controllers on all 16 channels within one audio block. Safe to spam;
 * no-op when the engine is idle.
 */
export function enginePanic(): Promise<void> {
  return invoke<void>("engine_panic")
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

/**
 * Result of `engine_self_test` — the loudest 100ms-RMS in dBFS and a
 * pass flag. The threshold is owned by the engine
 * (`SELF_TEST_THRESHOLD_DBFS`, currently −24 dBFS).
 */
export interface SelfTestResult {
  peakRmsDbfs: number
  passed: boolean
}

/**
 * Run the engine self-test: render two seconds of a high-pitched note
 * through a synthetic testtone graph, return the peak RMS.
 */
export function engineSelfTest(): Promise<SelfTestResult> {
  return invoke<SelfTestResult>("engine_self_test")
}

// =============================================================================
// Learn mode (#122)
// =============================================================================

/** One decoded capture streamed while Learn mode is active (1-based channel). */
export interface LearnEvent {
  deviceId: string
  deviceName: string
  msg:
    | { type: "noteOn"; channel: number; note: number; velocity: number }
    | { type: "noteOff"; channel: number; note: number }
    | { type: "controlChange"; channel: number; cc: number; value: number }
    | { type: "pitchBend"; channel: number }
}

/**
 * Enter Learn mode: the engine opens every connected MIDI input and
 * streams decoded captures via `engine://learn`. The rig-derived
 * performance set is restored by `engineLearnStop`.
 */
export function engineLearnStart(): Promise<void> {
  return invoke<void>("engine_learn_start")
}

export function engineLearnStop(): Promise<void> {
  return invoke<void>("engine_learn_stop")
}

export function onLearnEvent(cb: (e: LearnEvent) => void): Promise<UnlistenFn> {
  return listen<LearnEvent>("engine://learn", (e) => cb(e.payload))
}

// =============================================================================
// Plugin scan cache controls (#4)
// =============================================================================

/** Kick the background rescan thread ("Rescan now"); non-blocking. */
export function rescanPlugins(): Promise<void> {
  return invoke<void>("rescan_plugins")
}

/** Set the background rescan interval (minutes, clamped 1..=60 by Rust). */
export function setPluginScanInterval(minutes: number): Promise<void> {
  return invoke<void>("set_plugin_scan_interval", { minutes })
}

/** Fresh scan snapshots published by the background rescan thread. */
export function onPluginScan(cb: (r: ClapScanResult) => void): Promise<UnlistenFn> {
  return listen<ClapScanResult>("plugins://scan", (e) => cb(e.payload))
}

// =============================================================================
// Show document load/save
//
// Mirror of `stardust_show::ShowDocument` and surrounding types. The Rust
// crate inlines each patch's `PatchGraph`, so the TS shape does too — no
// side-tables. `kind: "stardust.show"` and `schemaVersion: 3` per ADR-0003
// / ADR-0005 (v3: rig components own hardware identity, #122).
// =============================================================================

export interface ShowHeader {
  kind: "stardust.show"
  schemaVersion: 3
  stardustVersion?: string
  /** ISO-8601 timestamp set by the UI on every save. */
  savedAt?: string
}

/**
 * Kind-specific configuration bag for one rig component. Mirrors the
 * free-form `config` on `stardust_show::RigComponent` (ADR-0004: strong
 * typing lives in the engine); the vocabulary is documented in
 * `docs/schemas/CHANGELOG.md` and consumed by
 * `engine_graph.rs::parse_rig`.
 */
export interface RigComponentConfig {
  /** Bound hardware device; absent = unbound (referencing nodes silent).
   *  `id: null` = name-only binding (matches by display name). */
  device?: { id: string | null; name: string }
  /** 1–16; absent = any channel. */
  channel?: number

  // Keyboard — learned key range
  lowNote?: number
  highNote?: number

  // Pads — grid + learned notes, row-major; null = not learned. Stored
  // now, consumed per-note by v0.10.0 widgets.
  rows?: number
  cols?: number
  padNotes?: Array<number | null>

  // Controllers — the captured MIDI source
  source?: { type: "cc"; cc: number } | { type: "pitchBend" } | { type: "note"; note: number }

  // Behavioural extras (UI semantics; engine ignores these today)
  switchMode?: "momentary" | "toggle"
  polarity?: "normal" | "inverted"
  expressionMin?: number
  expressionMax?: number
  pitchRangeSemitones?: number
  controlRange?: "absolute" | "relative"
}

/** One rig component (schema v3): the unit of hardware identity. */
export interface RigComponentWire {
  id: string
  kind: NodeKind
  name: string
  config?: RigComponentConfig
}

export interface RigWire {
  components: RigComponentWire[]
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
  | { kind: "duplicateRigComponentId"; id: string }
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
