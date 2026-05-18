import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

/**
 * A read-only display + a Learn button. While listening, the Learn button
 * pulses red and the display reads "Listening for control…". The next
 * incoming MIDI event (in real life) populates the value; in Storybook we
 * mock the capture by auto-resolving with `mockCapture` after a short delay.
 *
 * In Phase 2 (Tauri wiring), replace the setTimeout in the listen handler
 * with a Tauri event listener that resolves on the next `midi-cc` / `midi-note`
 * event after `start_learn(field_id)` has been issued.
 */
export interface LearnableFieldProps {
  label: string
  /** Current captured/saved value. */
  value?: string
  /** Hint text when nothing has been captured yet. */
  placeholder?: string
  /** Called when Learn completes; receives the captured value. */
  onCapture?: (captured: string) => void
  /** Storybook only: what to "capture" when the mock listen resolves. */
  mockCapture?: () => string
  /** Storybook only: how long to pretend to listen. */
  mockListenMs?: number
  className?: string
}

export function LearnableField({
  label,
  value,
  placeholder = "Not assigned",
  onCapture,
  mockCapture,
  mockListenMs = 1400,
  className,
}: LearnableFieldProps) {
  const [listening, setListening] = React.useState(false)

  React.useEffect(() => {
    if (!listening) return
    const t = window.setTimeout(() => {
      setListening(false)
      const captured = mockCapture ? mockCapture() : `CC ${Math.floor(Math.random() * 127) + 1} ch 1`
      onCapture?.(captured)
    }, mockListenMs)
    return () => window.clearTimeout(t)
  }, [listening, mockCapture, mockListenMs, onCapture])

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label className="text-xs">{label}</Label>
      <div className="flex items-stretch gap-2">
        <div
          className={cn(
            "flex flex-1 items-center rounded-md border bg-card px-2.5 text-xs",
            listening && "border-destructive/60 bg-destructive/5"
          )}
        >
          {listening ? (
            <span className="flex items-center gap-2 text-destructive">
              <span className="inline-block size-2 animate-pulse rounded-full bg-destructive" />
              Listening for control…
            </span>
          ) : value ? (
            <span className="font-mono text-foreground">{value}</span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </div>
        <Button
          type="button"
          size="sm"
          variant={listening ? "destructive" : value ? "ghost" : "outline"}
          onClick={() => setListening((s) => !s)}
          className="h-8 px-2 text-xs"
        >
          {listening ? "Cancel" : value ? "Re-learn" : "Learn"}
        </Button>
      </div>
    </div>
  )
}
