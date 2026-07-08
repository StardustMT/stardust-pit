/**
 * Engine lifecycle sync (#121, absorbing the deleted EnginePanel's
 * logic). Always-on: whenever the active patch has a hostable
 * instrument, the engine runs it; otherwise it stops. Three change
 * classes, three paths:
 *
 * - **Patch / instrument change** → `engine_start_from_patch` (plan
 *   rebuild). MIDI connections survive inside the engine (#122 — the
 *   open set is rig-derived and session-wide).
 * - **Audio output change only** → `engine_rebind_routing` (same plan,
 *   stream swap, held voices intact — #1).
 * - **Rig edit** → `engine_update_rig` (routes re-programmed, device
 *   union re-derived; never a restart).
 *
 * No-op outside Tauri. Mount once in App.
 */

import * as React from "react"
import { useShowStore } from "@/state/show-store"
import { DEFAULT_OUTPUT, useSettingsStore } from "@/state/settings-store"
import { getPluginChoice } from "@/components/patch-graph/_types"
import {
  type EngineStartError,
  type PatchWire,
  type RebindError,
  asEngineStartError,
  asRebindError,
  engineRebindRouting,
  engineStartFromPatch,
  engineStop,
  engineUpdateRig,
  isTauri,
} from "./tauri"

export interface EngineSyncState {
  syncError: EngineStartError | undefined
  rebindError: RebindError | undefined
}

export function useEngineSync(): EngineSyncState {
  const inTauri = React.useMemo(() => isTauri(), [])
  const songs = useShowStore((s) => s.songs)
  const rig = useShowStore((s) => s.rig)
  const currentPatchId = useShowStore((s) => s.currentPatchId)
  const audioOutput = useSettingsStore((s) => s.audioOutput)

  const [syncError, setSyncError] = React.useState<EngineStartError | undefined>()
  const [rebindError, setRebindError] = React.useState<RebindError | undefined>()

  const currentPatch: PatchWire | undefined = React.useMemo(() => {
    if (!currentPatchId) return undefined
    for (const song of songs) {
      const p = song.patches.find((p) => p.id === currentPatchId)
      if (p) return p
    }
    return undefined
  }, [songs, currentPatchId])

  // Plan signature: every instrument node's choice. Decides whether the
  // engine should be on AND whether a change needs a plan rebuild.
  const planSignature = React.useMemo(() => {
    if (!currentPatch) return undefined
    const parts: string[] = []
    for (const n of currentPatch.graph.nodes) {
      if (n.kind === "instrument.plugin") {
        const c = getPluginChoice(n)
        parts.push(c ? `plug:${c.bundlePath}|${c.pluginId}` : `plug:unconfigured`)
      } else if (n.kind === "instrument.testtone") {
        parts.push(`testtone`)
      }
    }
    return parts.length === 0 ? undefined : parts.join(";")
  }, [currentPatch])

  // Source→component assignments feed the engine's route tables, which
  // are rebuilt on start — so assignment edits ride the start path via
  // this signature (cheap rebuild; assignments change rarely).
  const routingSignature = React.useMemo(() => {
    if (!currentPatch) return undefined
    return currentPatch.graph.nodes
      .filter((n) => n.kind.startsWith("source."))
      .map((n) => `${n.id}:${(n.config?.rigComponentId as string | undefined) ?? ""}`)
      .join(";")
  }, [currentPatch])

  // Rebind failures are transient by design (the engine kept the old
  // device) — surface for a few seconds, then clear.
  React.useEffect(() => {
    if (!rebindError) return
    const t = window.setTimeout(() => setRebindError(undefined), 6000)
    return () => window.clearTimeout(t)
  }, [rebindError])

  // ------------------------------------------------------------------
  // Start / rebind / stop
  // ------------------------------------------------------------------
  const lastSyncRef = React.useRef<{
    patchId: string | undefined
    signature: string | undefined
    routing: string | undefined
    audioOutput: string
  } | null>(null)

  React.useEffect(() => {
    if (!inTauri) return
    const want = {
      patchId: currentPatch?.id,
      signature: planSignature,
      routing: routingSignature,
      audioOutput,
    }
    const prev = lastSyncRef.current
    if (
      prev &&
      prev.patchId === want.patchId &&
      prev.signature === want.signature &&
      prev.routing === want.routing &&
      prev.audioOutput === want.audioOutput
    ) {
      return
    }
    const planUnchanged =
      prev !== null &&
      prev.patchId === want.patchId &&
      prev.signature === want.signature &&
      prev.routing === want.routing &&
      currentPatch !== undefined &&
      planSignature !== undefined
    lastSyncRef.current = want

    let cancelled = false
    const rigSnapshot = rig
    void (async () => {
      setSyncError(undefined)
      setRebindError(undefined)
      if (!currentPatch || !planSignature) {
        try {
          await engineStop()
        } catch {
          // Engine status feed reflects whatever actually happened.
        }
        return
      }
      if (planUnchanged) {
        // Only the audio pick moved — swap the stream in place (#1).
        try {
          await engineRebindRouting({
            audio: { device: audioOutput === DEFAULT_OUTPUT ? null : audioOutput },
          })
          return
        } catch (e) {
          const err = asRebindError(e)
          if (!cancelled) setRebindError(err)
          if (err.kind !== "notRunning") return
          // Engine had stopped underneath us — fall through to a start.
        }
      }
      try {
        await engineStartFromPatch({
          patch: currentPatch,
          rig: rigSnapshot,
          audioOutput: audioOutput === DEFAULT_OUTPUT ? null : audioOutput,
        })
      } catch (e) {
        if (!cancelled) setSyncError(asEngineStartError(e))
      }
    })()
    return () => {
      cancelled = true
    }
    // `rig` is deliberately absent: rig edits take the update path below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inTauri, currentPatch, planSignature, routingSignature, audioOutput])

  // ------------------------------------------------------------------
  // Rig edits → engine_update_rig (debounced; Learn writes in bursts)
  // ------------------------------------------------------------------
  const firstRigRef = React.useRef(true)
  React.useEffect(() => {
    if (!inTauri) return
    if (firstRigRef.current) {
      // The initial rig rides with the first Start — don't double-send.
      firstRigRef.current = false
      return
    }
    const t = window.setTimeout(() => {
      engineUpdateRig(rig).catch((e) => setRebindError(asRebindError(e)))
    }, 400)
    return () => window.clearTimeout(t)
  }, [inTauri, rig])

  return { syncError, rebindError }
}

/** Human strings for the footer's transient error line. */
export function describeRebindError(e: RebindError): string {
  switch (e.kind) {
    case "notRunning":
      return "Device change ignored — engine is not running."
    case "audioDeviceNotFound":
      return `Audio device "${e.name}" not found — previous device is still active.`
    case "audioOpenFailed":
      return e.restored
        ? `Could not open the new audio device (${e.message}) — previous device restored.`
        : `Could not open the new audio device and restoring the old one failed (${e.message}).`
    case "midiInputNotFound":
      return `MIDI input "${e.name}" not found — previous inputs are still active.`
    case "midiOpenFailed":
      return `MIDI input "${e.name}" failed to open (${e.message}) — previous inputs are still active.`
    case "tooManyMidiInputs":
      return `Too many MIDI inputs (max ${e.max}).`
    case "internal":
      return `Device change failed: ${e.message}`
  }
}
