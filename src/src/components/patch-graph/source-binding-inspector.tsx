import * as React from "react"
import { ChevronRight, Unplug } from "lucide-react"
import { cn } from "@/lib/utils"
import { type GraphNode, type HardwareBinding, getHardwareBinding } from "./_types"

/**
 * One MIDI input the inspector can offer. `connected: false` renders the
 * disconnected state (italic, "(disconnected)") — the binding persists
 * and the engine re-matches when the device comes back (#2).
 */
export interface MidiDeviceOption {
  name: string
  /** Opaque midir port id — the persistence key. */
  id: string
  connected: boolean
}

export interface SourceBindingInspectorProps {
  node: GraphNode
  /** Connected devices (live: midir enumeration; Storybook: mocks). */
  devices: MidiDeviceOption[]
  onChange: (binding: HardwareBinding | undefined) => void
  className?: string
}

const ANY_DEVICE = "__any__"

/**
 * Hardware-binding editor for a source node (#2): which physical
 * controller feeds this node, on which channel, over which note / CC
 * range. Lives in the patch editor's Settings tab when a source node is
 * selected; the UX shape was locked during v0.6.0 refinement.
 */
export function SourceBindingInspector({
  node,
  devices,
  onChange,
  className,
}: SourceBindingInspectorProps) {
  const binding = getHardwareBinding(node)
  const [advancedOpen, setAdvancedOpen] = React.useState(Boolean(binding?.ccRange))

  const boundId = binding?.deviceId ?? null
  const boundDevice = boundId ? devices.find((d) => d.id === boundId) : undefined
  const boundIsDisconnected = boundId !== null && (!boundDevice || !boundDevice.connected)

  const patch = (changes: Partial<HardwareBinding>) => {
    const next: HardwareBinding = { deviceId: null, ...binding, ...changes }
    onChange(next)
  }

  return (
    <div className={cn("flex flex-col gap-3 text-xs", className)}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Hardware binding
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-[10px] font-medium text-muted-foreground">Device</span>
        <select
          className="h-8 rounded-md border bg-background px-2 text-xs"
          value={boundId ?? ANY_DEVICE}
          onChange={(e) => {
            const v = e.target.value
            if (v === ANY_DEVICE) {
              patch({ deviceId: null, deviceName: undefined })
              return
            }
            const dev = devices.find((d) => d.id === v)
            patch({ deviceId: v, deviceName: dev?.name ?? binding?.deviceName })
          }}
        >
          <option value={ANY_DEVICE}>Any device</option>
          {devices
            .filter((d) => d.connected)
            .map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          {boundIsDisconnected && (
            <option value={boundId}>{binding?.deviceName ?? boundId} (disconnected)</option>
          )}
        </select>
        {boundIsDisconnected && (
          <span className="flex items-center gap-1 text-[10px] italic text-amber-500">
            <Unplug className="size-3" />
            {binding?.deviceName ?? "Bound device"} is disconnected — the binding persists and
            re-matches on reconnect.
          </span>
        )}
      </label>

      <label className="flex items-center gap-2">
        <span className="w-14 shrink-0 text-[10px] font-medium text-muted-foreground">Channel</span>
        <select
          className="h-7 rounded-md border bg-background px-2 text-xs"
          value={binding?.channel ?? ""}
          onChange={(e) =>
            patch({ channel: e.target.value === "" ? null : Number(e.target.value) })
          }
        >
          <option value="">Any</option>
          {Array.from({ length: 16 }, (_, i) => i + 1).map((ch) => (
            <option key={ch} value={ch}>
              {ch}
            </option>
          ))}
        </select>
      </label>

      <RangeRow
        label="Notes"
        hint="lo – hi (0–127)"
        value={binding?.noteRange ?? null}
        onChange={(range) => patch({ noteRange: range })}
      />

      <button
        type="button"
        onClick={() => setAdvancedOpen((o) => !o)}
        aria-expanded={advancedOpen}
        className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
      >
        <ChevronRight className={cn("size-3 transition-transform", advancedOpen && "rotate-90")} />
        Advanced
      </button>
      {advancedOpen && (
        <RangeRow
          label="CC range"
          hint="optional"
          value={binding?.ccRange ?? null}
          onChange={(range) => patch({ ccRange: range })}
        />
      )}

      <div className="text-[10px] text-muted-foreground">
        {boundId ? (
          <>
            Bound to port id <span className="font-mono">{boundId}</span> (re-matches on replug)
          </>
        ) : (
          "Not bound — receives matching events from every connected device."
        )}
      </div>
    </div>
  )
}

function RangeRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint: string
  value: [number, number] | null
  onChange: (range: [number, number] | null) => void
}) {
  const clamp = (n: number) => Math.min(127, Math.max(0, Math.round(n)))
  const set = (index: 0 | 1, raw: string) => {
    if (raw === "" && (value === null || value[1 - index] === undefined)) {
      onChange(null)
      return
    }
    const lo = index === 0 ? raw : (value?.[0] ?? 0)
    const hi = index === 1 ? raw : (value?.[1] ?? 127)
    const loN = clamp(Number(lo === "" ? 0 : lo))
    const hiN = clamp(Number(hi === "" ? 127 : hi))
    onChange([Math.min(loN, hiN), Math.max(loN, hiN)])
  }
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 shrink-0 text-[10px] font-medium text-muted-foreground">{label}</span>
      <input
        type="number"
        min={0}
        max={127}
        aria-label={`${label} low bound`}
        className="h-7 w-16 rounded-md border bg-background px-2 text-xs"
        value={value?.[0] ?? ""}
        placeholder="—"
        onChange={(e) => set(0, e.target.value)}
      />
      <span className="text-muted-foreground">—</span>
      <input
        type="number"
        min={0}
        max={127}
        aria-label={`${label} high bound`}
        className="h-7 w-16 rounded-md border bg-background px-2 text-xs"
        value={value?.[1] ?? ""}
        placeholder="—"
        onChange={(e) => set(1, e.target.value)}
      />
      <span className="text-[10px] text-muted-foreground">({hint})</span>
      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-[10px] text-muted-foreground underline hover:text-foreground"
        >
          clear
        </button>
      )}
    </div>
  )
}
