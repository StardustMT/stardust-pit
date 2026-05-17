import * as React from "react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

/**
 * macOS / Windows-style application menu bar that lives at the very top
 * of the shell. Menu items here are the canonical surface for everything
 * the app can do — power users use these via keyboard, beginners discover
 * features by clicking through.
 */

const MENUS: Array<{ label: string; items: MenuItem[] }> = [
  {
    label: "File",
    items: [
      { label: "New Show…", shortcut: "⌘N" },
      { label: "Open Show…", shortcut: "⌘O" },
      { kind: "submenu", label: "Open Recent", count: 5 },
      { kind: "separator" },
      { label: "Save", shortcut: "⌘S" },
      { label: "Save As…", shortcut: "⇧⌘S" },
      { label: "Export Show Bundle…" },
      { kind: "separator" },
      { label: "Import from MainStage…" },
      { label: "Import from Gig Performer…" },
      { kind: "separator" },
      { label: "Close Show", shortcut: "⌘W" },
    ],
  },
  {
    label: "Edit",
    items: [
      { label: "Undo", shortcut: "⌘Z" },
      { label: "Redo", shortcut: "⇧⌘Z" },
      { kind: "separator" },
      { label: "Cut", shortcut: "⌘X" },
      { label: "Copy", shortcut: "⌘C" },
      { label: "Paste", shortcut: "⌘V" },
      { kind: "separator" },
      { label: "Duplicate Patch", shortcut: "⌘D" },
    ],
  },
  {
    label: "View",
    items: [
      { kind: "check", label: "Edit Mode", checked: true, shortcut: "⌘1" },
      { kind: "check", label: "Live Mode", shortcut: "⌘2" },
      { kind: "separator" },
      { kind: "check", label: "Show Show Outline", checked: true, shortcut: "⌘\\" },
      { kind: "check", label: "Show Inspector", checked: true, shortcut: "⌥⌘I" },
      { kind: "check", label: "Show Status Bar", checked: true },
      { kind: "separator" },
      { label: "Enter Full Screen", shortcut: "⌃⌘F" },
    ],
  },
  {
    label: "Show",
    items: [
      { label: "Add Song", shortcut: "⌘⏎" },
      { label: "Add Patch", shortcut: "⌥⌘⏎" },
      { kind: "separator" },
      { label: "Add Instrument…" },
      { label: "Add Effect…" },
      { label: "Convert Patch to Compound…" },
      { kind: "separator" },
      { label: "Go Live", shortcut: "⌘L" },
      { label: "Panic", shortcut: "⌘." },
    ],
  },
  {
    label: "Window",
    items: [
      { label: "Minimize", shortcut: "⌘M" },
      { label: "Zoom" },
      { kind: "separator" },
      { kind: "check", label: "Always on Top" },
    ],
  },
  {
    label: "Help",
    items: [
      { label: "Stardust Help" },
      { label: "Open Wiki…" },
      { label: "Keyboard Shortcuts", shortcut: "⌘?" },
      { kind: "separator" },
      { label: "Check for Updates" },
      { label: "Report an Issue…" },
    ],
  },
]

type MenuItem =
  | { kind?: undefined; label: string; shortcut?: string }
  | { kind: "separator" }
  | { kind: "submenu"; label: string; count?: number }
  | { kind: "check"; label: string; checked?: boolean; shortcut?: string }

export interface AppMenuBarProps {
  className?: string
  /** Optional brand element on the leading side (e.g. app logo / mark) */
  brand?: React.ReactNode
}

export function AppMenuBar({ className, brand }: AppMenuBarProps) {
  return (
    <div
      className={cn(
        "flex h-9 items-center gap-0.5 border-b bg-card-raised px-1 text-sm",
        className,
      )}
    >
      {brand && <div className="px-2.5 font-semibold tracking-tight">{brand}</div>}
      {MENUS.map((m) => (
        <DropdownMenu key={m.label}>
          <DropdownMenuTrigger className="rounded px-2.5 py-1 text-xs font-medium text-foreground/85 outline-none transition-colors hover:bg-accent data-[state=open]:bg-accent">
            {m.label}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[220px]">
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {m.label}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {m.items.map((it, i) => {
              if (it.kind === "separator") return <DropdownMenuSeparator key={i} />
              if (it.kind === "submenu") {
                return (
                  <DropdownMenuItem key={i}>
                    {it.label}
                    {it.count != null && (
                      <span className="ml-auto text-xs text-muted-foreground">{it.count}</span>
                    )}
                  </DropdownMenuItem>
                )
              }
              if (it.kind === "check") {
                return (
                  <DropdownMenuItem key={i} className="pl-8">
                    <span
                      className={cn(
                        "absolute left-2",
                        it.checked ? "text-primary" : "text-transparent",
                      )}
                    >
                      ✓
                    </span>
                    {it.label}
                    {it.shortcut && <DropdownMenuShortcut>{it.shortcut}</DropdownMenuShortcut>}
                  </DropdownMenuItem>
                )
              }
              return (
                <DropdownMenuItem key={i}>
                  {it.label}
                  {it.shortcut && <DropdownMenuShortcut>{it.shortcut}</DropdownMenuShortcut>}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      ))}
    </div>
  )
}
