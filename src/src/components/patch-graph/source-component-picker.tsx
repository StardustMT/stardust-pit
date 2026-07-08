import { AlertTriangle, ExternalLink, Unplug } from "lucide-react"
import { cn } from "@/lib/utils"
import { type GraphNode, getRigComponentId } from "./_types"
import { deviceLabel, isBound, summaryFor } from "@/components/rig/_catalog"
import type { RigComponentWire } from "@/lib/tauri"

export interface SourceComponentPickerProps {
  node: GraphNode
  /** The show's rig components (all kinds; the picker filters). */
  components: RigComponentWire[]
  onChange: (rigComponentId: string | undefined) => void
  /** Jump to Setup → Rig to create / bind components. */
  onOpenRigScreen?: () => void
  className?: string
}

const UNASSIGNED = "__unassigned__"

/**
 * Rig-component picker for a source node (#122, replacing the #2 raw
 * binding fields). A source node *is* a rig component appearing in the
 * patch: the picker offers the components matching the node's kind.
 * Hardware identity (device, channel, ranges) is configured once in
 * Setup → Rig, never per node. An unassigned node is silent and flagged.
 */
export function SourceComponentPicker({
  node,
  components,
  onChange,
  onOpenRigScreen,
  className,
}: SourceComponentPickerProps) {
  const assignedId = getRigComponentId(node)
  const matching = components.filter((c) => c.kind === node.kind)
  const assigned = assignedId ? components.find((c) => c.id === assignedId) : undefined
  const dangling = assignedId !== undefined && assigned === undefined

  return (
    <div className={cn("flex flex-col gap-3 text-xs", className)}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Rig component
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-[10px] font-medium text-muted-foreground">Component</span>
        <select
          className="h-8 rounded-md border bg-background px-2 text-xs"
          value={dangling ? assignedId : (assignedId ?? UNASSIGNED)}
          onChange={(e) => onChange(e.target.value === UNASSIGNED ? undefined : e.target.value)}
        >
          <option value={UNASSIGNED}>Unassigned (silent)</option>
          {matching.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {isBound(c) ? "" : " (no device)"}
            </option>
          ))}
          {dangling && <option value={assignedId}>{assignedId} (deleted component)</option>}
        </select>
      </label>

      {assignedId === undefined && (
        <div
          role="status"
          className="flex items-start gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-2 text-[10px] text-amber-500"
        >
          <AlertTriangle className="mt-0.5 size-3 shrink-0" />
          No rig component assigned — this node produces nothing from hardware. The on-screen
          keyboard still previews it.
        </div>
      )}

      {dangling && (
        <div
          role="status"
          className="flex items-start gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-2 text-[10px] text-destructive"
        >
          <AlertTriangle className="mt-0.5 size-3 shrink-0" />
          The assigned component was deleted from the rig — this node is silent. Pick another
          component or re-create one in Setup.
        </div>
      )}

      {assigned && (
        <div className="flex flex-col gap-1 rounded-md border bg-muted/30 px-2.5 py-2">
          <div className="text-[10px] text-muted-foreground">{summaryFor(assigned)}</div>
          {isBound(assigned) ? (
            <div className="text-[10px]">
              <span className="text-muted-foreground">Device: </span>
              <span className="font-mono">{deviceLabel(assigned.config)}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-[10px] text-amber-500">
              <Unplug className="size-3" />
              Component has no device bound — Learn one in Setup or the node stays silent.
            </div>
          )}
        </div>
      )}

      {matching.length === 0 && !dangling && (
        <div className="text-[10px] text-muted-foreground">
          No {node.kind.replace("source.", "").replace("-", " ")} components in your rig yet.
        </div>
      )}

      {onOpenRigScreen && (
        <button
          type="button"
          onClick={onOpenRigScreen}
          className="flex w-fit items-center gap-1 text-[10px] text-muted-foreground underline hover:text-foreground"
        >
          <ExternalLink className="size-3" />
          Edit rig in Setup
        </button>
      )}
    </div>
  )
}
