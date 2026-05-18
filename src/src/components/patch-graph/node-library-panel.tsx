import * as React from "react"
import {
  AudioWaveform,
  Box,
  Cable,
  ChevronsUpDown,
  CircleDot,
  Footprints,
  Grid3x3,
  Move3D,
  MoveVertical,
  Piano,
  Plus,
  Settings2,
  Sliders,
  Volume2,
  Waves,
} from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { CLASS_COLORS, type NodeClass, type NodeKind } from "./_types"
import { NODE_CATALOG, type NodeSpec } from "./_catalog"

const CLASS_ORDER: NodeClass[] = [
  "source",
  "midi-processor",
  "instrument",
  "audio-effect",
  "audio-router",
  "sink",
]

const CLASS_DISPLAY_LABEL: Record<NodeClass, string> = {
  source: "Sources",
  "midi-processor": "MIDI processors",
  instrument: "Instruments",
  "audio-effect": "Audio effects",
  "audio-router": "Audio routers",
  sink: "Outputs",
}

export interface NodeLibraryPanelProps {
  onAddNode?: (kind: NodeKind) => void
  /** Composite blocks the user has saved — populates the "My Blocks" tab. */
  savedComposites?: Array<{ id: string; name: string; nodeCount: number }>
  onAddComposite?: (compositeId: string) => void
}

/**
 * Right-side library panel. Two tabs:
 *   • Base — catalog of atomic node kinds, grouped by class.
 *   • My Blocks — user-saved composite blocks (drag whole sub-graph in).
 *
 * Currently click-to-add. Drag-and-drop onto canvas lands in the interaction
 * iteration.
 */
export function NodeLibraryPanel({
  onAddNode,
  savedComposites = [],
  onAddComposite,
}: NodeLibraryPanelProps) {
  const grouped = React.useMemo(() => {
    return CLASS_ORDER.map((cls) => ({
      cls,
      items: NODE_CATALOG.filter((s) => s.class === cls),
    })).filter((g) => g.items.length > 0)
  }, [])

  return (
    <Tabs defaultValue="base" className="flex h-full flex-col">
      <TabsList className="grid h-9 grid-cols-2">
        <TabsTrigger value="base" className="text-xs">
          Base
        </TabsTrigger>
        <TabsTrigger value="my-blocks" className="text-xs">
          My Blocks{savedComposites.length > 0 && ` (${savedComposites.length})`}
        </TabsTrigger>
      </TabsList>

      <TabsContent
        value="base"
        className="min-h-0 flex-1 overflow-hidden pt-3"
      >
        <ScrollArea className="-mr-2 h-full pr-2">
          <div className="flex flex-col gap-4">
            {grouped.map(({ cls, items }) => (
              <ClassSection
                key={cls}
                cls={cls}
                items={items}
                onAddNode={onAddNode}
              />
            ))}
          </div>
        </ScrollArea>
      </TabsContent>

      <TabsContent
        value="my-blocks"
        className="min-h-0 flex-1 overflow-hidden pt-3"
      >
        {savedComposites.length === 0 ? (
          <div className="grid h-full place-items-center px-4 text-center text-xs text-muted-foreground">
            <div>
              <Box className="mx-auto mb-2 size-6 opacity-40" />
              <div className="font-medium text-foreground">No saved blocks yet</div>
              <div className="mt-1">
                Select a region on the canvas and choose
                <br />
                <span className="font-mono text-foreground">Wrap as composite</span> to save a chain.
              </div>
            </div>
          </div>
        ) : (
          <ScrollArea className="-mr-2 h-full pr-2">
            <div className="flex flex-col gap-1.5">
              {savedComposites.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onAddComposite?.(c.id)}
                  className="flex items-center gap-3 rounded-md border bg-card px-3 py-2.5 text-left transition-colors hover:border-primary/50 hover:bg-muted/40"
                >
                  <div className="grid size-9 shrink-0 place-items-center rounded-md border border-amber-500/30 bg-amber-500/[0.08] text-amber-500">
                    <Box className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-semibold">{c.name}</div>
                    <div className="truncate text-[10px] text-muted-foreground/80">
                      {c.nodeCount} nodes
                    </div>
                  </div>
                  <span className="grid size-7 shrink-0 place-items-center text-muted-foreground">
                    <Plus className="size-3.5" />
                  </span>
                </button>
              ))}
            </div>
          </ScrollArea>
        )}
      </TabsContent>
    </Tabs>
  )
}

function ClassSection({
  cls,
  items,
  onAddNode,
}: {
  cls: NodeClass
  items: NodeSpec[]
  onAddNode?: (kind: NodeKind) => void
}) {
  const palette = CLASS_COLORS[cls]
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2 px-1">
        <span
          className="size-1.5 rounded-full"
          style={{ background: `oklch(0.7 0.18 ${palette.hue})` }}
        />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {CLASS_DISPLAY_LABEL[cls]}
          <span className="ml-1 font-normal opacity-60">({items.length})</span>
        </span>
      </div>
      <div className="flex flex-col gap-1">
        {items.map((spec) => (
          <NodeLibraryCard
            key={spec.kind}
            spec={spec}
            onAdd={() => onAddNode?.(spec.kind)}
          />
        ))}
      </div>
    </div>
  )
}

function NodeLibraryCard({
  spec,
  onAdd,
}: {
  spec: NodeSpec
  onAdd?: () => void
}) {
  const Icon = iconFor(spec.kind)
  const palette = CLASS_COLORS[spec.class]
  return (
    <button
      type="button"
      onClick={onAdd}
      className={cn(
        "group flex w-full items-center gap-3 rounded-md border bg-card px-2.5 py-2 text-left transition-colors",
        "hover:border-primary/50 hover:bg-muted/40"
      )}
    >
      <div
        className="grid size-8 shrink-0 place-items-center rounded-md border"
        style={{
          background: `oklch(0.3 0.05 ${palette.hue})`,
          borderColor: `oklch(0.5 0.1 ${palette.hue})`,
          color: `oklch(0.85 0.1 ${palette.hue})`,
        }}
      >
        <Icon className="size-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-semibold">{spec.label}</div>
        <div className="truncate text-[10px] text-muted-foreground/80">
          {spec.description}
        </div>
      </div>
      <span className="grid size-6 shrink-0 place-items-center text-muted-foreground group-hover:text-primary">
        <Plus className="size-3" />
      </span>
    </button>
  )
}

function iconFor(kind: NodeKind): React.ComponentType<{ className?: string }> {
  switch (kind) {
    case "source.keyboard":
      return Piano
    case "source.pads":
      return Grid3x3
    case "source.switch":
    case "source.sustain-pedal":
      return Footprints
    case "source.expression-pedal":
      return Move3D
    case "source.pitch-wheel":
      return ChevronsUpDown
    case "source.mod-wheel":
      return MoveVertical
    case "source.knob":
      return CircleDot
    case "source.fader":
      return Sliders
    case "midi.transpose":
      return AudioWaveform
    case "midi.mix":
      return Cable
    case "instrument.plugin":
    case "instrument.sine":
      return Waves
    case "audio.eq":
      return Settings2
    case "audio.mix":
      return Cable
    case "sink.main-out":
      return Volume2
  }
}
