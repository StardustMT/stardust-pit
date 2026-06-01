import * as React from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"

export interface ContextMenuItem {
  id: string
  label: string
  /** Optional small left-side icon component. */
  icon?: React.ComponentType<{ className?: string }>
  /** Optional right-aligned shortcut hint. */
  shortcut?: string
  /** "danger" = red text, used for destructive actions. */
  variant?: "default" | "danger"
  disabled?: boolean
  onSelect?: () => void
}

export interface ContextMenuSection {
  id: string
  items: ContextMenuItem[]
}

export interface ContextMenuProps {
  /** Page coordinates of the menu anchor (e.g. cursor at right-click time). */
  anchor: { x: number; y: number }
  sections: ContextMenuSection[]
  onClose: () => void
}

/**
 * Simple positioned context menu. Mounts to document.body via a portal so
 * it floats above any clipping ancestors (the canvas's overflow-auto in
 * particular). Closes on outside-click / Escape / item-select.
 *
 * The menu auto-clamps to the viewport — if anchored too close to the
 * right or bottom edge, it shifts in.
 */
export function ContextMenu({ anchor, sections, onClose }: ContextMenuProps) {
  const menuRef = React.useRef<HTMLDivElement>(null)
  const [position, setPosition] = React.useState(anchor)

  // Reposition after mount so the menu fits in the viewport.
  React.useLayoutEffect(() => {
    const menu = menuRef.current
    if (!menu) return
    const rect = menu.getBoundingClientRect()
    const margin = 6
    let x = anchor.x
    let y = anchor.y
    if (x + rect.width + margin > window.innerWidth) {
      x = Math.max(margin, window.innerWidth - rect.width - margin)
    }
    if (y + rect.height + margin > window.innerHeight) {
      y = Math.max(margin, window.innerHeight - rect.height - margin)
    }
    setPosition({ x, y })
  }, [anchor.x, anchor.y])

  // Outside click / Escape close.
  React.useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    // Defer so we don't pick up the same event that opened us.
    const id = window.setTimeout(() => {
      window.addEventListener("pointerdown", onPointerDown)
      window.addEventListener("keydown", onKey)
    }, 0)
    return () => {
      window.clearTimeout(id)
      window.removeEventListener("pointerdown", onPointerDown)
      window.removeEventListener("keydown", onKey)
    }
  }, [onClose])

  if (typeof document === "undefined") return null

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      className="fixed z-50 min-w-[180px] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-lg"
      style={{ left: position.x, top: position.y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {sections.map((section, sIdx) => (
        <React.Fragment key={section.id}>
          {sIdx > 0 && <div className="h-px bg-border" />}
          {section.items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                if (item.disabled) return
                item.onSelect?.()
                onClose()
              }}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors",
                item.disabled ? "cursor-not-allowed opacity-40" : "hover:bg-muted/60",
                item.variant === "danger" && !item.disabled
                  ? "text-destructive hover:bg-destructive/10"
                  : "",
              )}
            >
              {item.icon ? (
                <item.icon className="size-3.5 shrink-0 opacity-70" />
              ) : (
                <span className="size-3.5" />
              )}
              <span className="flex-1">{item.label}</span>
              {item.shortcut && (
                <span className="font-mono text-[10px] text-muted-foreground">{item.shortcut}</span>
              )}
            </button>
          ))}
        </React.Fragment>
      ))}
    </div>,
    document.body,
  )
}
