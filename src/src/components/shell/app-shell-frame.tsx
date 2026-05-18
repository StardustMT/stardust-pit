import * as React from "react"
import { Play, Sparkles, X } from "lucide-react"
import { AppMenuBar } from "./app-menu-bar"
import type { AppMode } from "./nav-rail"
import { ModeSwitcher } from "./mode-switcher"
import { StatusBar } from "./status-bar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * App shell frame. Nav rail removed (its destinations are covered by
 * the left panel, the right Library tab, the app menu bar, and the
 * status bar). Right panel is draggable to resize.
 */

const MIN_INSPECTOR = 240
const MAX_INSPECTOR = 640
const DEFAULT_INSPECTOR = 340

export interface AppShellFrameProps {
  mode: AppMode
  onModeChange?: (mode: AppMode) => void
  showName?: string
  songName?: string
  contextPanel: React.ReactNode
  canvas: React.ReactNode
  inspector: React.ReactNode
  onGoLive?: () => void
  className?: string
}

export function AppShellFrame({
  mode,
  onModeChange,
  showName,
  songName,
  contextPanel,
  canvas,
  inspector,
  onGoLive,
  className,
}: AppShellFrameProps) {
  const isPerform = mode === "perform"
  const [inspectorWidth, setInspectorWidth] = React.useState(DEFAULT_INSPECTOR)
  const draggingRef = React.useRef(false)
  const startXRef = React.useRef(0)
  const startWRef = React.useRef(DEFAULT_INSPECTOR)

  React.useEffect(() => {
    function onMove(e: PointerEvent) {
      if (!draggingRef.current) return
      const dx = startXRef.current - e.clientX
      const next = Math.min(
        MAX_INSPECTOR,
        Math.max(MIN_INSPECTOR, startWRef.current + dx),
      )
      setInspectorWidth(next)
    }
    function onUp() {
      draggingRef.current = false
      document.body.style.cursor = ""
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    return () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
    }
  }, [])

  return (
    <div
      className={cn(
        "dark grid h-screen w-screen grid-rows-[auto_auto_1fr_auto] bg-background text-foreground",
        className,
      )}
    >
      <AppMenuBar
        brand={
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-primary" />
            Stardust
          </span>
        }
      />

      {/* Mode switcher + breadcrumb. The breadcrumb is the canonical place
       *  for show/song context. Nothing else duplicates it. */}
      <div className="flex h-12 items-center justify-between border-b bg-background px-3">
        <div className="flex items-center gap-3">
          <ModeSwitcher mode={mode} onChange={onModeChange} />
          <div className="hidden h-5 w-px bg-border md:block" />
          <nav className="hidden text-xs text-muted-foreground md:flex md:items-center md:gap-1">
            <span>{showName ?? "Untitled Show"}</span>
            <span className="opacity-50">/</span>
            <span className="text-foreground">{songName ?? "—"}</span>
          </nav>
        </div>
        {isPerform && (
          <Button onClick={onGoLive} className="gap-2">
            <Play className="size-4 fill-current" />
            Go Live
          </Button>
        )}
      </div>

      <div
        className="grid overflow-hidden"
        style={{
          gridTemplateColumns: `280px 1fr ${inspectorWidth}px`,
        }}
      >
        {/* Left context panel — no header label, content speaks for itself */}
        <aside className="overflow-hidden border-r bg-background p-3">
          <div className="h-full">{contextPanel}</div>
        </aside>

        {/* Center canvas */}
        <main className="overflow-hidden bg-background">{canvas}</main>

        {/* Right inspector with draggable left edge */}
        <aside className="relative overflow-hidden border-l bg-background">
          {/* Drag handle (3px wide hit area, visible vertical line) */}
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize inspector"
            onPointerDown={(e) => {
              draggingRef.current = true
              startXRef.current = e.clientX
              startWRef.current = inspectorWidth
              document.body.style.cursor = "col-resize"
              e.preventDefault()
            }}
            className="absolute left-0 top-0 z-10 h-full w-1 cursor-col-resize bg-transparent transition-colors hover:bg-primary/40"
          />
          <div className="h-full overflow-hidden p-3 pl-4">{inspector}</div>
        </aside>
      </div>

      {/* Status bar — system info only. No show/song duplicate. */}
      <StatusBar
        audioDevice="Focusrite Scarlett 18i20"
        sampleRate={48000}
        bufferSize={128}
        latencyMs={7.8}
        midiPortCount={4}
        cpu={0.42}
        ramMb={5_400}
        ramTotalMb={32_768}
      />
    </div>
  )
}

export function LiveFullscreen({
  onExit,
  children,
}: {
  onExit: () => void
  children: React.ReactNode
}) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onExit()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onExit])

  return (
    <div className="dark fixed inset-0 z-50 bg-background text-foreground">
      <button
        onClick={onExit}
        className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-md border bg-card px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <X className="size-3.5" />
        Exit Live (Esc)
      </button>
      {children}
    </div>
  )
}

/**
 * Lightweight wrapper for inspector content. Keeps the optional label
 * for legacy stories; new code can omit the label entirely.
 */
export function InspectorFrame({
  label,
  children,
}: {
  label?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex h-full flex-col gap-2">
      {label && (
        <div className="px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </div>
      )}
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  )
}

export function Placeholder({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-card/30 p-6 text-center text-muted-foreground">
      <div className="text-[10px] uppercase tracking-[0.18em]">{title}</div>
      <div className="max-w-sm text-sm leading-relaxed">{body}</div>
    </div>
  )
}

// Re-exports for backwards compatibility while screens update
export { AppShellFrame as default }
