import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

/**
 * A read-only display + a Learn button. While listening, the Learn button
 * pulses red and the display reads "Listening for control…".
 *
 * Real capture: pass `capture` — an async function that resolves with the
 * captured display value (having done any side-effecting config writes
 * itself) or `undefined` on cancel; the field aborts it via `AbortSignal`
 * when the user hits Cancel. Without `capture` (Storybook / mocks), the
 * field auto-resolves with `mockCapture` after a short delay.
 */
export interface LearnableFieldProps {
  label: string
  /** Current captured/saved value. */
  value?: string
  /** Hint text when nothing has been captured yet. */
  placeholder?: string
  /** Called when Learn completes; receives the captured value. */
  onCapture?: (captured: string) => void
  /** Real capture (#122): awaits the next matching Learn event. */
  capture?: (signal: AbortSignal) => Promise<string | undefined>
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
  capture,
  mockCapture,
  mockListenMs = 1400,
  className,
}: LearnableFieldProps) {
  const [listening, setListening] = React.useState(false)

  // Refs keep an in-flight listen stable across parent re-renders —
  // re-created closures must not abort + restart the Learn session.
  const captureRef = React.useRef(capture)
  const mockRef = React.useRef(mockCapture)
  const onCaptureRef = React.useRef(onCapture)
  React.useEffect(() => {
    captureRef.current = capture
    mockRef.current = mockCapture
    onCaptureRef.current = onCapture
  })

  React.useEffect(() => {
    if (!listening) return
    const capture = captureRef.current
    if (capture) {
      const controller = new AbortController()
      void capture(controller.signal).then((captured) => {
        if (controller.signal.aborted) return
        setListening(false)
        if (captured !== undefined) onCaptureRef.current?.(captured)
      })
      return () => controller.abort()
    }
    const t = window.setTimeout(() => {
      setListening(false)
      const captured = mockRef.current
        ? mockRef.current()
        : `CC ${Math.floor(Math.random() * 127) + 1} ch 1`
      onCaptureRef.current?.(captured)
    }, mockListenMs)
    return () => window.clearTimeout(t)
  }, [listening, mockListenMs])

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label className="text-xs">{label}</Label>
      <div className="flex items-stretch gap-2">
        <div
          className={cn(
            "flex flex-1 items-center rounded-md border bg-card px-2.5 text-xs",
            listening && "border-destructive/60 bg-destructive/5",
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
