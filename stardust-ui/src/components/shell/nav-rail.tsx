import * as React from "react"
import {
  AudioLines,
  Cable,
  Cog,
  Folder,
  Library,
  ListTree,
  Music4,
  Plug,
  Settings2,
  Sparkles,
  type LucideIcon,
} from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export type NavId =
  | "outline"
  | "library"
  | "instruments"
  | "effects"
  | "midi"
  | "audio"
  | "shows"
  | "settings"

export interface NavRailProps {
  active: NavId
  onSelect?: (id: NavId) => void
  className?: string
}

const TOP_ITEMS: Array<{ id: NavId; label: string; icon: LucideIcon }> = [
  { id: "outline", label: "Show Outline", icon: ListTree },
  { id: "library", label: "Patches", icon: Library },
  { id: "instruments", label: "Instruments", icon: Music4 },
  { id: "effects", label: "Effects", icon: Sparkles },
  { id: "midi", label: "MIDI", icon: Cable },
  { id: "audio", label: "Audio", icon: AudioLines },
]

const BOTTOM_ITEMS: Array<{ id: NavId; label: string; icon: LucideIcon }> = [
  { id: "shows", label: "Shows", icon: Folder },
  { id: "settings", label: "Settings", icon: Settings2 },
]

export function NavRail({ active, onSelect, className }: NavRailProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <nav
        className={cn(
          "flex h-full w-14 flex-col items-center justify-between border-r bg-card py-2",
          className,
        )}
      >
        <ul className="flex flex-col items-center gap-1">
          {TOP_ITEMS.map((it) => (
            <NavItem
              key={it.id}
              item={it}
              active={active === it.id}
              onSelect={onSelect}
            />
          ))}
        </ul>
        <ul className="flex flex-col items-center gap-1">
          {BOTTOM_ITEMS.map((it) => (
            <NavItem
              key={it.id}
              item={it}
              active={active === it.id}
              onSelect={onSelect}
            />
          ))}
        </ul>
      </nav>
    </TooltipProvider>
  )
}

function NavItem({
  item,
  active,
  onSelect,
}: {
  item: { id: NavId; label: string; icon: LucideIcon }
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
