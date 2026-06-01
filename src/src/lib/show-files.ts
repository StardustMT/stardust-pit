/**
 * File-dialog + filesystem wiring for Open Show / Save Show.
 *
 * The Rust side (`load_show` / `save_show`) is pure JSON <-> struct; the
 * UI owns the file picker and the disk read/write via
 * `tauri-plugin-dialog` + `tauri-plugin-fs`. Both plugins are registered
 * in `src-tauri/src/lib.rs` and granted in
 * `src-tauri/capabilities/default.json`.
 *
 * No-ops outside Tauri (Storybook / web dev) — callers should gate UI on
 * `isTauri()` rather than relying on these to fail gracefully.
 */

import { open, save } from "@tauri-apps/plugin-dialog"
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs"
import { asShowError, loadShow, saveShow, type ShowDocument, type ShowError } from "@/lib/tauri"

const SHOW_EXTENSION = "stardustshow"
const SHOW_FILTER = { name: "Stardust show", extensions: [SHOW_EXTENSION] }

/** Result of an Open Show flow. `cancelled` means the user dismissed the
 * picker — not an error, just no-op. `error` carries either a parse failure
 * or a list of validation errors with patch context. */
export type OpenShowResult =
  | { kind: "ok"; doc: ShowDocument; path: string }
  | { kind: "cancelled" }
  | { kind: "error"; error: ShowError; path?: string }

export async function openShowFile(): Promise<OpenShowResult> {
  const picked = await open({
    multiple: false,
    directory: false,
    filters: [SHOW_FILTER],
  })
  if (!picked || Array.isArray(picked)) return { kind: "cancelled" }
  const path = picked as string
  let raw: string
  try {
    raw = await readTextFile(path)
  } catch (e) {
    return {
      kind: "error",
      path,
      error: { kind: "parse", message: `Couldn't read file: ${String(e)}` },
    }
  }
  try {
    const doc = await loadShow(raw)
    return { kind: "ok", doc, path }
  } catch (e) {
    return { kind: "error", path, error: asShowError(e) }
  }
}

/** Result of a Save Show flow. */
export type SaveShowResult =
  | { kind: "ok"; path: string }
  | { kind: "cancelled" }
  | { kind: "error"; error: ShowError; path?: string }

export async function saveShowFile(
  doc: ShowDocument,
  suggestedName: string,
): Promise<SaveShowResult> {
  const path = await save({
    defaultPath: ensureExtension(suggestedName),
    filters: [SHOW_FILTER],
  })
  if (!path) return { kind: "cancelled" }
  let json: string
  try {
    json = await saveShow(doc)
  } catch (e) {
    return { kind: "error", path, error: asShowError(e) }
  }
  try {
    await writeTextFile(path, json)
  } catch (e) {
    return {
      kind: "error",
      path,
      error: { kind: "parse", message: `Couldn't write file: ${String(e)}` },
    }
  }
  return { kind: "ok", path }
}

function ensureExtension(name: string): string {
  if (name.endsWith(`.${SHOW_EXTENSION}`)) return name
  return `${name}.${SHOW_EXTENSION}`
}
