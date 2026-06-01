import * as React from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ComponentLibraryCard } from "./component-library-card"
import { RIG_COMPONENT_CATALOG, type RigComponentGroup, type RigComponentSpec } from "./_catalog"

const GROUP_LABELS: Record<RigComponentGroup, string> = {
  instrument: "Instruments",
  controller: "Controllers",
}

const GROUP_ORDER: RigComponentGroup[] = ["instrument", "controller"]

export interface ComponentLibraryProps {
  onAdd?: (spec: RigComponentSpec) => void
  className?: string
}

export function ComponentLibrary({ onAdd, className }: ComponentLibraryProps) {
  const grouped = React.useMemo(() => {
    return GROUP_ORDER.map((group) => ({
      group,
      items: RIG_COMPONENT_CATALOG.filter((c) => c.group === group),
    }))
  }, [])

  return (
    <div className={"flex h-full flex-col gap-3 " + (className ?? "")}>
      <div className="px-1 text-[10px] leading-tight text-muted-foreground">
        Generic building blocks. Future iterations will add pre-configured complex devices (e.g. a
        single &ldquo;Launchkey 49&rdquo; that brings its keyboard, pads, knobs, and faders
        pre-wired).
      </div>
      <ScrollArea className="-mr-2 flex-1 pr-2">
        <div className="flex flex-col gap-4">
          {grouped.map(({ group, items }) => (
            <div key={group} className="flex flex-col gap-1.5">
              <div className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {GROUP_LABELS[group]}
              </div>
              <div className="flex flex-col gap-1.5">
                {items.map((spec) => (
                  <ComponentLibraryCard key={spec.kind} spec={spec} onAdd={() => onAdd?.(spec)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
