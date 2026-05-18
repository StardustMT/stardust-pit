import * as React from "react"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { DeviceLibraryCard } from "./device-library-card"
import {
  MOCK_CONNECTED_DEVICE_IDS,
  RIG_DEVICE_CATALOG,
  findSpec,
  type RigDeviceKind,
  type RigDeviceSpec,
} from "./_catalog"

const KIND_LABELS: Record<RigDeviceKind, string> = {
  keyboard88: "88-key keyboards",
  keyboard76: "76-key keyboards",
  keyboard61: "61–76-key keyboards",
  keyboard49: "49-key keyboards",
  "pad-keyboard": "Keys + pads controllers",
  "pad-controller": "Pad controllers",
  footswitch: "Footswitches",
  "multi-switch": "Multi-switches",
  "expression-pedal": "Expression pedals",
  "foot-controller": "Foot controllers",
  "wind-controller": "Wind controllers",
  "audio-interface": "Audio interfaces",
  other: "Other",
}

const KIND_ORDER: RigDeviceKind[] = [
  "keyboard88",
  "keyboard76",
  "keyboard61",
  "keyboard49",
  "pad-keyboard",
  "pad-controller",
  "footswitch",
  "multi-switch",
  "expression-pedal",
  "foot-controller",
  "wind-controller",
  "audio-interface",
  "other",
]

export interface DeviceLibraryProps {
  onAddDevice?: (spec: RigDeviceSpec) => void
  /** IDs (spec IDs) of devices already in the user's rig — shown with "added" state. */
  addedIds?: string[]
  /** IDs (spec IDs) of physically connected devices — drives the filter and the badge. */
  connectedIds?: string[]
  className?: string
}

export function DeviceLibrary({
  onAddDevice,
  addedIds = [],
  connectedIds = MOCK_CONNECTED_DEVICE_IDS,
  className,
}: DeviceLibraryProps) {
  const [query, setQuery] = React.useState("")
  const [matchOnly, setMatchOnly] = React.useState(false)

  const connectedKinds = React.useMemo(() => {
    const kinds = new Set<RigDeviceKind>()
    for (const id of connectedIds) {
      const spec = findSpec(id)
      if (spec) kinds.add(spec.kind)
    }
    return kinds
  }, [connectedIds])

  const filtered = React.useMemo(() => {
    return RIG_DEVICE_CATALOG.filter((spec) => {
      if (matchOnly && !connectedKinds.has(spec.kind)) return false
      if (query.trim()) {
        const q = query.toLowerCase()
        const hay = `${spec.vendor} ${spec.model} ${spec.notes ?? ""}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [query, matchOnly, connectedKinds])

  const grouped = React.useMemo(() => {
    const byKind = new Map<RigDeviceKind, RigDeviceSpec[]>()
    for (const k of KIND_ORDER) byKind.set(k, [])
    for (const spec of filtered) byKind.get(spec.kind)?.push(spec)
    return KIND_ORDER.map((k) => ({
      kind: k,
      items: byKind.get(k) ?? [],
    })).filter((g) => g.items.length > 0)
  }, [filtered])

  return (
    <div className={"flex h-full flex-col gap-3 " + (className ?? "")}>
      {/* Search */}
      <div className="relative px-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by vendor or model…"
          className="h-8 pl-7 text-xs"
        />
      </div>

      {/* Filter toggle */}
      <div className="flex items-center justify-between gap-2 px-1 text-xs">
        <Label
          htmlFor="rig-library-match-only"
          className="flex cursor-pointer items-center gap-2 text-muted-foreground"
        >
          <Switch
            id="rig-library-match-only"
            checked={matchOnly}
            onCheckedChange={setMatchOnly}
          />
          <span>
            Only types matching connected
            {connectedKinds.size > 0 && (
              <span className="ml-1 opacity-60">({connectedKinds.size})</span>
            )}
          </span>
        </Label>
        <span className="text-muted-foreground">
          {filtered.length} / {RIG_DEVICE_CATALOG.length}
        </span>
      </div>

      {/* Grouped list */}
      <ScrollArea className="-mr-2 flex-1 pr-2">
        <div className="flex flex-col gap-3">
          {grouped.map(({ kind, items }) => (
            <div key={kind} className="flex flex-col gap-1.5">
              <div className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {KIND_LABELS[kind]}{" "}
                <span className="font-normal opacity-60">({items.length})</span>
              </div>
              <div className="flex flex-col gap-1">
                {items.map((spec) => (
                  <DeviceLibraryCard
                    key={spec.id}
                    spec={spec}
                    connected={connectedIds.includes(spec.id)}
                    added={addedIds.includes(spec.id)}
                    onAdd={() => onAddDevice?.(spec)}
                  />
                ))}
              </div>
            </div>
          ))}
          {grouped.length === 0 && (
            <div className="grid h-32 place-items-center px-4 text-center text-xs text-muted-foreground">
              No devices match. Try clearing the filter or search.
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
