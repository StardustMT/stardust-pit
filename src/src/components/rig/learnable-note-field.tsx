import * as React from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { noteLabel } from "./_catalog"

/**
 * MIDI note picker with three input modes:
 *   • text input — type a MIDI number (0–127), commits on Enter / blur
 *   • stepper arrows — nudge up/down by a semitone
 *   • Learn button — capture from the next incoming MIDI event
 *
 * Below the input, the note name (e.g. "A0") is shown for readability.
 *
 * In Phase 2 the listen handler's setTimeout becomes a Tauri event listener
 * that resolves on the next `midi-note` event after `start_learn(field_id)`.
 */
export interface LearnableNoteFieldProps {
  label: string
  /** Current MIDI note (0–127), or undefined if unset */
  value?: number
  onChange: (note: number | undefined) => void
  /** Storybook only: what to "capture" when the mock listen resolves */
  mockCapture?: () => number
  /** Storybook only: how long to pretend to listen */
  mockListenMs?: number
  className?: string
}

export function LearnableNoteField({
  label,
  value,
  onChange,
  mockCapture,
  mockListenMs = 1400,
  className,
}: LearnableNoteFieldProps) {
  const [listening, setListening] = React.useState(false)
  const [draft, setDraft] = React.useState<string>(
    value !== undefined ? String(value) : ""
  )

  // Keep the editable draft in sync with the canonical value (e.g. when Learn
  // populates it from outside, or when the stepper buttons change it).
  React.useEffect(() => {
    setDraft(value !== undefined ? String(value) : "")
  }, [value])

  React.useEffect(() => {
    if (!listening) return
    const t = window.setTimeout(() => {
      setListening(false)
      const captured = mockCapture ? mockCapture() : 60
      onChange(clampNote(captured))
    }, mockListenMs)
    return () => window.clearTimeout(t)
  }, [listening, mockCapture, mockListenMs, onChange])

  const commitDraft = () => {
    const trimmed = draft.trim()
    if (trimmed === "") {
      onChange(undefined)
      return
    }
    const n = Number(trimmed)
    if (Number.isFinite(n) && n >= 0 && n <= 127) {
      onChange(Math.round(n))
    } else {
      // Reject invalid input — restore the last valid value
      setDraft(value !== undefined ? String(value) : "")
    }
  }

  const adjust = (delta: number) => {
    const current = value ?? 60
    onChange(clampNote(current + delta))
  }

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label className="text-xs">{label}</Label>
      <div className="flex items-stretch gap-1.5">
        <div
          className={cn(
            "flex flex-1 items-stretch overflow-hidden rounded-md border bg-card",
            listening && "border-destructive/60 bg-destructive/5"
          )}
        >
          <button
            type="button"
            disabled={listening}
            onClick={() => adjust(-1)}
            className="grid w-7 place-items-center border-r text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
            title="Lower by 1 semitone"
            aria-label="Lower by 1 semitone"
          >
            <ChevronDown className="size-3.5" />
          </button>
          <Input
            type="number"
            min={0}
            max={127}
            value={draft}
            disabled={listening}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitDraft}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                ;(e.target as HTMLInputElement).blur()
              }
            }}
            placeholder="—"
            className="h-8 flex-1 rounded-none border-0 bg-transparent text-center font-mono text-xs shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <button
            type="button"
            disabled={listening}
            onClick={() => adjust(1)}
            className="grid w-7 place-items-center border-l text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
            title="Raise by 1 semitone"
            aria-label="Raise by 1 semitone"
          >
            <ChevronUp className="size-3.5" />
          </button>
        </div>
        <Button
          type="button"
          size="sm"
          variant={
            listening ? "destructive" : value !== undefined ? "ghost" : "outline"
          }
          onClick={() => setListening((s) => !s)}
          className="h-8 px-2 text-xs"
        >
          {listening ? "Cancel" : value !== undefined ? "Re-learn" : "Learn"}
        </Button>
      </div>
      <div className="px-1 font-mono text-[10px]">
        {listening ? (
          <span className="text-destructive">Listening for a key press…</span>
        ) : value !== undefined ? (
          <span className="text-foreground">{noteLabel(value)}</span>
        ) : (
          <span className="text-muted-foreground">
            Press a key to capture, type a MIDI number, or use the arrows.
          </span>
        )}
      </div>
    </div>
  )
}

function clampNote(n: number): number {
  return Math.max(0, Math.min(127, Math.round(n)))
}
