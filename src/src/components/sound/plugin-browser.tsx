import * as React from "react"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { Badge } from "@/components/ui/badge"
import { Plug } from "lucide-react"
import { cn } from "@/lib/utils"

export interface PluginEntry {
  id: string
  name: string
  vendor: string
  format: "VST3" | "CLAP" | "AU"
  category: "Instrument" | "Effect"
  quarantined?: boolean
}

export interface PluginBrowserProps {
  plugins: PluginEntry[]
  className?: string
}

export function PluginBrowser({ plugins, className }: PluginBrowserProps) {
  const grouped = React.useMemo(() => {
    const buckets: Record<string, PluginEntry[]> = { Instrument: [], Effect: [] }
    for (const p of plugins) buckets[p.category].push(p)
    return buckets
  }, [plugins])

  return (
    <div
      className={cn(
        "w-full max-w-2xl overflow-hidden rounded-lg border bg-card shadow-2xl",
        className,
      )}
    >
      <Command>
        <CommandInput placeholder="Search plugins — name, vendor, format" />
        <CommandList>
          <CommandEmpty>No plugins match.</CommandEmpty>
          {Object.entries(grouped).map(([cat, items], idx) => (
            <React.Fragment key={cat}>
              {idx > 0 && <CommandSeparator />}
              <CommandGroup heading={cat}>
                {items.map((p) => (
                  <CommandItem key={p.id} className="gap-2">
                    <Plug className="text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{p.name}</div>
                      <div className="truncate text-xs text-muted-foreground">{p.vendor}</div>
                    </div>
                    <Badge variant="outline" className="font-mono">
                      {p.format}
                    </Badge>
                    {p.quarantined && <Badge variant="destructive">quarantined</Badge>}
                  </CommandItem>
                ))}
              </CommandGroup>
            </React.Fragment>
          ))}
        </CommandList>
      </Command>
    </div>
  )
}
