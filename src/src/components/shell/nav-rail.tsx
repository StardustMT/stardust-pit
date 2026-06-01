import {
  Boxes,
  Cable,
  Folder,
  Library,
  ListTree,
  Music4,
  Settings2,
  Sparkles,
  Wrench,
  type LucideIcon,
} from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export type NavId =
  // Setup mode
  | "rig"
  | "show-meta"
  // Program mode
  | "outline"
  | "patches"
  | "instruments"
  | "effects"
  | "midi"
  // Perform mode
  | "widgets"
  // Cross-mode
  | "shows"
  | "settings"

export type AppMode = "setup" | "program" | "perform"

export interface NavRailProps {
  active: NavId
  mode?: AppMode
  onSelect?: (id: NavId) => void
  className?: string
}

/**
 * Mode-aware nav rail. Items change per mode — Setup shows hardware-y
 * destinations, Program shows show-content destinations, Perform shows
 * playback-time destinations. Shows / Settings are cross-mode and live
 * at the bottom.
 */
export function NavRail({ active, mode = "program", onSelect, className }: NavRailProps) {
  const top = ITEMS_BY_MODE[mode]
  return (
    <TooltipProvider delayDuration={300}>
      <nav
        className={cn(
          "flex h-full w-14 flex-col items-center justify-between border-r bg-card py-2",
          className,
        )}
      >
        <ul className="flex flex-col items-center gap-1">
          {top.map((it) => (
            <NavItem key={it.id} item={it} active={active === it.id} onSelect={onSelect} />
          ))}
        </ul>
        <ul className="flex flex-col items-center gap-1">
          {BOTTOM_ITEMS.map((it) => (
            <NavItem key={it.id} item={it} active={active === it.id} onSelect={onSelect} />
          ))}
        </ul>
      </nav>
    </TooltipProvider>
  )
}

type Item = { id: NavId; label: string; icon: LucideIcon }

const ITEMS_BY_MODE: Record<AppMode, Item[]> = {
  setup: [
    { id: "rig", label: "Rig (hardware)", icon: Wrench },
    { id: "show-meta", label: "Show metadata", icon: Folder },
  ],
  program: [
    { id: "outline", label: "Show outline", icon: ListTree },
    { id: "patches", label: "Patch library", icon: Library },
    { id: "instruments", label: "Instruments", icon: Music4 },
    { id: "effects", label: "Effects", icon: Sparkles },
    { id: "midi", label: "MIDI bindings", icon: Cable },
  ],
  perform: [
    { id: "outline", label: "Show outline", icon: ListTree },
    { id: "widgets", label: "Widget palette", icon: Boxes },
  ],
}

const BOTTOM_ITEMS: Item[] = [
  { id: "shows", label: "Shows", icon: Folder },
  { id: "settings", label: "Settings", icon: Settings2 },
]

function NavItem({
  item,
  active,
  onSelect,
}: {
  item: Item
  active: boolean
  onSelect?: (id: NavId) => void
}) {
  const Icon = item.icon
  return (
    <li>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => onSelect?.(item.id)}
            className={cn(
              "relative grid size-10 place-items-center rounded-lg text-muted-foreground transition-colors",
              "hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active && "bg-accent text-foreground",
            )}
            aria-current={active || undefined}
            aria-label={item.label}
          >
            <Icon className="size-[18px]" />
            {active && (
              <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-primary" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    </li>
  )
}

/** Pick a sensible default nav id for a given mode. */
export function defaultNavForMode(mode: AppMode): NavId {
  return ITEMS_BY_MODE[mode][0].id
}

/** Look up the human label for any nav id. */
export function navLabel(id: NavId): string {
  const all = [...Object.values(ITEMS_BY_MODE).flat(), ...BOTTOM_ITEMS]
  return all.find((i) => i.id === id)?.label ?? id
}
