import * as React from "react"
import { Play, Sparkles, X } from "lucide-react"
import { AppMenuBar } from "./app-menu-bar"
import { NavRail, type NavId, type AppMode, defaultNavForMode, navLabel } from "./nav-rail"
import { ModeSwitcher } from "./mode-switcher"
import { StatusBar } from "./status-bar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * Reusable app shell frame. Story files render this around their canvas
 * content so every screen is shown in proper app context, not floating
 * in a story void.
 */

export interface AppShellFrameProps {
  mode: AppMode
  onModeChange?: (mode: AppMode) => void
  nav: NavId
  onNavChange?: (id: NavId) => void
  showName?: string
  songName?: string
  /** Left context panel content (driven by the active nav id) */
  contextPanel: React.ReactNode
  /** Center main canvas content (driven by mode) */
  canvas: React.ReactNode
  /** Right inspector panel content (selection-driven) */
  inspector: React.ReactNode
  /** Show Go Live button in perform mode */
  onGoLive?: () => void
  className?: string
}

export function AppShellFrame({
  mode,
  onModeChange,
  nav,
  onNavChange,
  showName,
  songName,
  contextPanel,
  canvas,
  inspector,
  onGoLive,
  className,
}: AppShellFrameProps) {
  const isPerform = mode === "perform"
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

      <div className="flex h-12 items-center justify-between border-b bg-background px-3">
        <div className="flex items-center gap-3">
          <ModeSwitcher
            mode={mode}
            onChange={(next) => {
              onModeChange?.(next)
              // When mode changes, pick the default nav for that mode
              // unless caller is controlling nav themselves.
              if (onNavChange) onNavChange(defaultNavForMode(next))
            }}
          />
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

      <div className="grid grid-cols-[3.5rem_280px_1fr_320px] overflow-hidden">
        <NavRail active={nav} mode={mode} onSelect={onNavChange} />
        <aside className="overflow-hidden border-r bg-background p-3">
          <div className="flex h-full flex-col gap-2">
            <div className="px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {navLabel(nav)}
            </div>
            <div className="min-h-0 flex-1">{contextPanel}</div>
          </div>
        </aside>
        <main className="overflow-hidden bg-background">{canvas}</main>
        <aside className="overflow-hidden border-l bg-background p-3">{inspector}</aside>
      </div>

      <StatusBar
        showName={showName}
        songName={songName}
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

export function InspectorFrame({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex h-full flex-col gap-2">
      <div className="px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Inspector · {label}
      </div>
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
