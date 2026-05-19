import * as React from "react"
import { ChevronDown, ChevronUp, Pin, PinOff } from "lucide-react"
import { cn } from "@/lib/utils"

export interface PatchTabSpec {
  id: string
  label: string
  /** Renderer for the tab's content panel when expanded. */
  content: React.ReactNode
}

export interface PatchTabRailProps {
  /** Tab specs to display. Order is preserved in the rail. */
  tabs: PatchTabSpec[]
  /** Where the rail lives. Drives chevron direction + content placement. */
  side: "top" | "bottom"
  /** Default height for the expanded content area in pixels. */
  expandedHeight?: number
  /** Controlled open-tab id. Pass null to collapse. */
  openTabId?: string | null
  /** Controlled change handler — called on user clicks (tab, close). */
  onOpenTabIdChange?: (id: string | null) => void
  className?: string
}

/**
 * Collapsible top or bottom tab rail. The strip of tab labels is always
 * visible; the content area expands when a tab is selected, collapses
 * when the same tab is clicked again or when "X" is pressed.
 *
 * Pin toggle keeps the rail expanded across tab switches; without it the
 * rail behaves modally (click tab to peek, click again to close).
 *
 * Default state: collapsed. Pin defaults off.
 */
export function PatchTabRail({
  tabs,
  side,
  expandedHeight = 240,
  openTabId: openTabIdProp,
  onOpenTabIdChange,
  className,
}: PatchTabRailProps) {
  const isControlled = openTabIdProp !== undefined
  const [openTabIdLocal, setOpenTabIdLocal] = React.useState<string | null>(null)
  const openTabId = isControlled ? openTabIdProp : openTabIdLocal
  const setOpenTabId = (next: string | null) => {
    if (!isControlled) setOpenTabIdLocal(next)
    onOpenTabIdChange?.(next)
  }
  const [pinned, setPinned] = React.useState(false)

  const openTab = openTabId ? tabs.find((t) => t.id === openTabId) : null
  const expanded = !!openTab

  const onTabClick = (id: string) => {
    if (openTabId === id && !pinned) {
      setOpenTabId(null)
      return
    }
    setOpenTabId(id)
  }

  const onClose = () => setOpenTabId(null)

  // Tab rail (the strip with labels). Always rendered.
  const railEl = (
    <div
      className={cn(
        "flex h-9 items-stretch gap-px border-y bg-muted/40 px-2",
        side === "top" ? "border-t-0" : "border-b-0"
      )}
    >
      {tabs.map((t) => {
        const active = t.id === openTabId
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onTabClick(t.id)}
            className={cn(
              "flex items-center gap-1.5 px-3 text-xs font-medium transition-colors",
              "border-x border-transparent",
              active
                ? "border-x-border bg-background text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span>{t.label}</span>
            {active &&
              (side === "top" ? (
                <ChevronDown className="size-3" />
              ) : (
                <ChevronUp className="size-3" />
              ))}
          </button>
        )
      })}

      {/* Right-side controls: pin + close (when expanded) */}
      {expanded && (
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPinned((p) => !p)}
            className={cn(
              "grid size-6 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground",
              pinned && "text-primary"
            )}
            title={pinned ? "Unpin (collapse on tab toggle)" : "Pin open"}
            aria-label={pinned ? "Unpin tab rail" : "Pin tab rail"}
          >
            {pinned ? (
              <PinOff className="size-3.5" />
            ) : (
              <Pin className="size-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Collapse"
            aria-label="Collapse tab rail"
          >
            {side === "top" ? (
              <ChevronUp className="size-3.5" />
            ) : (
              <ChevronDown className="size-3.5" />
            )}
          </button>
        </div>
      )}
    </div>
  )

  // Content panel — rendered only when a tab is open.
  const contentEl = expanded && openTab ? (
    <div
      className="overflow-hidden border-y bg-background"
      style={{
        height: expandedHeight,
        borderTop: side === "top" ? "none" : undefined,
        borderBottom: side === "bottom" ? "none" : undefined,
      }}
    >
      <div className="h-full overflow-auto p-3">{openTab.content}</div>
    </div>
  ) : null

  // For top: rail above content. For bottom: content above rail.
  return (
    <div className={cn("flex flex-col", className)}>
      {side === "top" ? (
        <>
          {railEl}
          {contentEl}
        </>
      ) : (
        <>
          {contentEl}
          {railEl}
        </>
      )}
    </div>
  )
}
