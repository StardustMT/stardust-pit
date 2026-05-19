import * as React from "react"
import { Box, Plus } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { CLASS_COLORS, type NodeClass, type NodeKind } from "./_types"
import { NODE_CATALOG } from "./_catalog"

export interface RightPanelProps {
  onAddNode?: (kind: NodeKind) => void
  savedComposites?: Array<{ id: string; name: string; nodeCount: number }>
  onAddComposite?: (id: string) => void
  className?: string
}

/**
 * Right-side panel. Two tabs only — Library (atomic nodes from the catalog,
 * grouped by class) and Blocks (the user's saved composites).
 * The Live / Mix / Settings tabs live in the wider bottom panel now.
 */
export function RightPanel({
  onAddNode,
  savedComposites = [],
  onAddComposite,
  className,
}: RightPanelProps) {
  return (
    <Tabs
      defaultValue="library"
      className={cn(
        "flex h-full flex-col rounded-xl border bg-card",
        className
      )}
    >
      <div className="border-b px-2 pt-2">
        <TabsList className="grid h-8 grid-cols-2">
          <TabsTrigger value="library" className="text-xs">
            Library
          </TabsTrigger>
          <TabsTrigger value="blocks" className="text-xs">
            Blocks {savedComposites.length > 0 && `(${savedComposites.length})`}
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="library" className="min-h-0 flex-1 overflow-hidden p-3">
        <ScrollArea className="-mr-2 h-full pr-2">
          <LibraryContent onAddNode={onAddNode} />
        </ScrollArea>
      </TabsContent>

      <TabsContent value="blocks" className="min-h-0 flex-1 overflow-hidden p-3">
        <ScrollArea className="-mr-2 h-full pr-2">
          <BlocksContent
            savedComposites={savedComposites}
            onAddComposite={onAddComposite}
          />
        </ScrollArea>
      </TabsContent>
    </Tabs>
  )
}

const CLASS_ORDER: NodeClass[] = [
  "source",
  "midi-processor",
  "instrument",
  "audio-effect",
  "audio-router",
  "sink",
]

function LibraryContent({ onAddNode }: { onAddNode?: (kind: NodeKind) => void }) {
  const grouped = React.useMemo(() => {
    return CLASS_ORDER.map((cls) => ({
      cls,
      items: NODE_CATALOG.filter((s) => s.class === cls),
    })).filter((g) => g.items.length > 0)
  }, [])

  return (
    <div className="flex flex-col gap-4">
      {grouped.map(({ cls, items }) => (
        <div key={cls} className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 px-1">
            <span
              className="size-1.5 rounded-full"
              style={{ background: `oklch(0.7 0.18 ${CLASS_COLORS[cls].hue})` }}
            />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {CLASS_COLORS[cls].label}
              <span className="ml-1 font-normal opacity-60">({items.length})</span>
            </span>
          </div>
          <div className="flex flex-col gap-1">
            {items.map((spec) => (
              <div
                key={spec.kind}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "copy"
                  e.dataTransfer.setData(
                    "application/x-stardust-node-kind",
                    spec.kind
                  )
                  // A simple drag image hint.
                  e.dataTransfer.setData("text/plain", spec.label)
                }}
                onClick={() => onAddNode?.(spec.kind)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") onAddNode?.(spec.kind)
                }}
                className="group flex w-full cursor-grab items-center gap-3 rounded-md border bg-background px-2.5 py-2 text-left transition-colors hover:border-primary/50 hover:bg-muted/40 active:cursor-grabbing"
                title="Click to add at center, or drag onto the canvas"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-semibold">{spec.label}</div>
                  <div className="truncate text-[10px] text-muted-foreground/80">
                    {spec.description}
                  </div>
                </div>
                <span className="grid size-6 shrink-0 place-items-center text-muted-foreground group-hover:text-primary">
                  <Plus className="size-3" />
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function BlocksContent({
  savedComposites,
  onAddComposite,
}: {
  savedComposites: Array<{ id: string; name: string; nodeCount: number }>
  onAddComposite?: (id: string) => void
}) {
  if (savedComposites.length === 0) {
    return (
      <div className="grid h-full place-items-center px-4 text-center text-xs text-muted-foreground">
        <div>
          <Box className="mx-auto mb-2 size-6 opacity-40" />
          <div className="font-medium text-foreground">No saved blocks yet</div>
          <div className="mt-1">
            Select a region on the canvas and
            <br />
            <span className="font-mono text-foreground">Wrap as composite…</span>
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-1.5">
      {savedComposites.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onAddComposite?.(c.id)}
          className="flex w-full items-center gap-3 rounded-md border border-amber-500/30 bg-amber-500/[0.05] px-2.5 py-2 text-left transition-colors hover:border-amber-500/60 hover:bg-amber-500/[0.08]"
        >
          <Box className="size-4 text-amber-500" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-semibold">{c.name}</div>
            <div className="truncate text-[10px] text-muted-foreground/80">
              {c.nodeCount} nodes
            </div>
          </div>
          <Plus className="size-3 text-muted-foreground" />
        </button>
      ))}
    </div>
  )
}
