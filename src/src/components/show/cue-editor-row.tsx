import { ChevronsRight, Pencil, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"

export type CueTrigger =
  | { type: "footswitch"; switch: string }
  | { type: "midi-note"; channel: number; note: string }
  | { type: "midi-cc"; channel: number; cc: number }
  | { type: "bar"; bar: number }

export type CueAction =
  | { type: "advance" }
  | { type: "jump"; patch: string }
  | { type: "tempo"; bpm: number }
  | { type: "panic" }

export interface CueEditorRowProps {
  trigger: CueTrigger
  action: CueAction
  className?: string
}

function triggerText(t: CueTrigger) {
  switch (t.type) {
    case "footswitch":
      return `Footswitch ${t.switch}`
    case "midi-note":
      return `MIDI note ${t.note} (ch ${t.channel})`
    case "midi-cc":
      return `MIDI CC${t.cc} (ch ${t.channel})`
    case "bar":
      return `Bar ${t.bar}`
  }
}

function actionText(a: CueAction) {
  switch (a.type) {
    case "advance":
      return "Advance patch"
    case "jump":
      return `Jump → ${a.patch}`
    case "tempo":
      return `Set tempo ${a.bpm} BPM`
    case "panic":
      return "Panic"
  }
}

export function CueEditorRow({ trigger, action, className }: CueEditorRowProps) {
  return (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-md border bg-card px-3 py-2 text-sm",
        className,
      )}
    >
      <span className="min-w-0 flex-1 truncate font-mono text-xs">{triggerText(trigger)}</span>
      <ChevronsRight className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate">{actionText(action)}</span>
      <button
        className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Edit cue"
      >
        <Pencil className="size-3.5" />
      </button>
      <button
        className="rounded p-1.5 text-muted-foreground opacity-0 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
        aria-label="Delete cue"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  )
}
