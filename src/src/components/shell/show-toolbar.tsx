import * as React from "react"
import { AlertTriangle, FilePlus, FolderOpen, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { openShowFile, saveShowFile } from "@/lib/show-files"
import { isTauri, type ShowError, type ShowValidationError } from "@/lib/tauri"
import { useShowStore } from "@/state/show-store"

/**
 * App-shell toolbar: Open Show / Save Show buttons, dirty indicator, and
 * the error dialog that surfaces parse / validation failures from the
 * Tauri bridge. Show-level actions live up here (not in the per-patch
 * title bar) because a .stardustshow file is the document scope.
 *
 * Hidden outside Tauri — file dialogs and `tauri-plugin-fs` don't exist
 * in Storybook / web dev.
 */
export function ShowToolbar() {
  const inTauri = React.useMemo(() => isTauri(), [])
  const dirty = useShowStore((s) => s.dirty)
  const showName = useShowStore((s) => s.showName)
  const replaceShow = useShowStore((s) => s.replaceShow)
  const newShow = useShowStore((s) => s.newShow)
  const markClean = useShowStore((s) => s.markClean)
  const getDocument = useShowStore((s) => s.getDocument)

  const [error, setError] = React.useState<ShowError | null>(null)
  const [errorPath, setErrorPath] = React.useState<string | undefined>()
  const [busy, setBusy] = React.useState(false)

  if (!inTauri) return null

  const confirmDiscardIfDirty = (): boolean => {
    if (!dirty) return true
    return window.confirm("You have unsaved changes. Discard them and start a new show?")
  }

  const onNew = () => {
    if (busy) return
    if (!confirmDiscardIfDirty()) return
    newShow()
  }

  const onOpen = async () => {
    if (busy) return
    if (!confirmDiscardIfDirty()) return
    setBusy(true)
    try {
      const result = await openShowFile()
      if (result.kind === "ok") {
        replaceShow(result.doc)
      } else if (result.kind === "error") {
        setErrorPath(result.path)
        setError(result.error)
      }
    } finally {
      setBusy(false)
    }
  }

  const onSave = async () => {
    if (busy) return
    setBusy(true)
    try {
      const doc = getDocument()
      const result = await saveShowFile(doc, showName)
      if (result.kind === "ok") {
        markClean()
      } else if (result.kind === "error") {
        setErrorPath(result.path)
        setError(result.error)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="flex items-center gap-1.5">
        {dirty && (
          <span
            className="size-1.5 rounded-full bg-amber-500"
            title="Unsaved changes"
            aria-label="Unsaved changes"
          />
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={onNew}
          disabled={busy}
          className="gap-1.5"
          title="Start a blank show — one song, one empty patch"
        >
          <FilePlus className="size-3.5" />
          New Show
        </Button>
        <Button size="sm" variant="ghost" onClick={onOpen} disabled={busy} className="gap-1.5">
          <FolderOpen className="size-3.5" />
          Open Show
        </Button>
        <Button size="sm" variant="ghost" onClick={onSave} disabled={busy} className="gap-1.5">
          <Save className="size-3.5" />
          Save Show
        </Button>
      </div>
      <ShowErrorDialog
        error={error}
        path={errorPath}
        onClose={() => {
          setError(null)
          setErrorPath(undefined)
        }}
      />
    </>
  )
}

function ShowErrorDialog({
  error,
  path,
  onClose,
}: {
  error: ShowError | null
  path: string | undefined
  onClose: () => void
}) {
  return (
    <Dialog
      open={error !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-500" />
            {error?.kind === "validation" ? "Show has structural problems" : "Couldn't load show"}
          </DialogTitle>
          {path && <DialogDescription className="font-mono text-[11px]">{path}</DialogDescription>}
        </DialogHeader>
        <div className="max-h-[50vh] overflow-auto text-xs">
          {error?.kind === "parse" && (
            <p className="rounded-md border border-destructive/40 bg-destructive/[0.06] p-3 text-destructive">
              {error.message}
            </p>
          )}
          {error?.kind === "validation" && (
            <ul className="flex flex-col gap-1.5">
              {error.errors.map((e, i) => (
                <li
                  key={i}
                  className="rounded-md border border-amber-500/40 bg-amber-500/[0.06] p-2.5"
                >
                  {formatShowValidationError(e)}
                </li>
              ))}
            </ul>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" size="sm">
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function formatShowValidationError(e: ShowValidationError): React.ReactNode {
  switch (e.kind) {
    case "duplicateSongId":
      return (
        <>
          Duplicate song id <code className="font-mono">{e.id}</code>
        </>
      )
    case "duplicatePatchId":
      return (
        <>
          Duplicate patch id <code className="font-mono">{e.id}</code> (patch ids must be unique
          across the entire show)
        </>
      )
    case "duplicateBlockId":
      return (
        <>
          Duplicate saved-block id <code className="font-mono">{e.id}</code>
        </>
      )
    case "patchInvalid":
      return (
        <>
          <div className="font-semibold">
            Patch <code className="font-mono">{e.patch}</code> (in song{" "}
            <code className="font-mono">{e.song}</code>) has {e.errors.length} structural{" "}
            {e.errors.length === 1 ? "error" : "errors"}:
          </div>
          <ul className="mt-1 list-disc pl-5 text-[11px] text-muted-foreground">
            {e.errors.map((ge, i) => (
              <li key={i}>{ge.kind}</li>
            ))}
          </ul>
        </>
      )
  }
}
