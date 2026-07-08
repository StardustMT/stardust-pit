/**
 * Learn-mode capture plumbing (#122).
 *
 * The engine's Learn mode opens every connected MIDI input and streams
 * decoded events on `engine://learn`. This module reference-counts the
 * session: the first pending capture starts Learn (which closes the
 * rig-derived performance set), the last one to finish stops it (which
 * restores the set). Fields await `captureNextLearnEvent` with a
 * predicate; cancelling aborts via `AbortSignal`.
 *
 * Outside Tauri (Storybook / web dev) there is no event stream — the
 * learnable-field components fall back to their mock timers, and the
 * Setup screen's stories inject a mock capture provider instead.
 */

import { type LearnEvent, engineLearnStart, engineLearnStop, isTauri, onLearnEvent } from "./tauri"

export type { LearnEvent }

/** A field-level capture: resolves with the first accepted event, or
 *  `undefined` when the signal aborts. */
export type LearnCapture = (
  accept: (e: LearnEvent) => boolean,
  signal: AbortSignal,
) => Promise<LearnEvent | undefined>

type Subscriber = (e: LearnEvent) => void

let refs = 0
let unlisten: (() => void) | null = null
const subscribers = new Set<Subscriber>()

async function acquire(): Promise<void> {
  refs += 1
  if (refs > 1) return
  if (!isTauri()) return
  unlisten = await onLearnEvent((e) => {
    for (const s of [...subscribers]) s(e)
  })
  await engineLearnStart()
}

function release(): void {
  refs -= 1
  if (refs > 0) return
  unlisten?.()
  unlisten = null
  if (isTauri()) void engineLearnStop()
}

/**
 * Wait for the next Learn event matching `accept`. Starts the engine's
 * Learn session on first use; stops it when no capture is pending.
 */
export const captureNextLearnEvent: LearnCapture = async (accept, signal) => {
  if (signal.aborted) return undefined
  await acquire()
  return new Promise<LearnEvent | undefined>((resolve) => {
    const done = (value: LearnEvent | undefined) => {
      subscribers.delete(onEvent)
      signal.removeEventListener("abort", onAbort)
      release()
      resolve(value)
    }
    const onEvent: Subscriber = (e) => {
      if (accept(e)) done(e)
    }
    const onAbort = () => done(undefined)
    subscribers.add(onEvent)
    signal.addEventListener("abort", onAbort)
  })
}

// -----------------------------------------------------------------------------
// Accept predicates for the field types the Setup screen captures
// -----------------------------------------------------------------------------

export const acceptsAny = (_e: LearnEvent): boolean => true

export const acceptsNoteOn = (e: LearnEvent): boolean => e.msg.type === "noteOn"

export const acceptsControlSource = (e: LearnEvent): boolean =>
  e.msg.type === "controlChange" || e.msg.type === "pitchBend"
