import * as React from "react"
import { Box, ExternalLink, Plus } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { CLASS_COLORS, type NodeClass, type NodeKind } from "./_types"
import { NODE_CATALOG } from "./_catalog"
import type { ClapPluginInfo } from "@/lib/tauri"

/**
 * A single source available from the user's configured rig. Sources only
 * appear in the Library if the user has actually wired them up in the rig
 * screen — you can't drop a "pads" node into a patch unless your rig has
 * pads. Everything else (MIDI processors, instruments, effects, sinks) is
 * generic and shows unconditionally.
 */
export interface RigSource {
  /** Stable per-rig id. Maps to the source.* NodeKind. */
  kind: NodeKind
  /** Friendly name as the user labelled it (e.g. "Nord Stage 3 keys"). */
  label: string
}

/**
 * Optional overrides for a spawn — used when the library entry knows
 * more than the catalog default (e.g. a CLAP plugin card carries its
 * choice so the new node lands pre-configured with that plugin).
 */
export interface AddNodeOverrides {
  name?: string
  config?: Record<string, unknown>
}

export interface RightPanelProps {
  onAddNode?: (kind: NodeKind, overrides?: AddNodeOverrides) => void
  /** If provided, ONLY these source kinds appear in the Sources group. */
  rigSources?: RigSource[]
  /** Click handler for "Add additional source" — routes to the Rig screen. */
  onOpenRigScreen?: () => void
  /**
   * CLAP plugins discovered on disk. When provided, the Instruments
   * group renders one card per plugin (each spawns an `instrument.plugin`
   * node pre-configured with that plugin's choice). When undefined,
   * falls back to the catalog's generic instrument entries (legacy).
   */
  installedPlugins?: ClapPluginInfo[]
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
  rigSources,
  onOpenRigScreen,
  installedPlugins,
  savedComposites = [],
  onAddComposite,
  className,
}: RightPanelProps) {
  return (
    <Tabs
      defaultValue="library"
      className={cn("flex h-full flex-col rounded-xl border bg-card", className)}
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
          <LibraryContent
            onAddNode={onAddNode}
            rigSources={rigSources}
            onOpenRigScreen={onOpenRigScreen}
            installedPlugins={installedPlugins}
          />
        </ScrollArea>
      </TabsContent>

      <TabsContent value="blocks" className="min-h-0 flex-1 overflow-hidden p-3">
        <ScrollArea className="-mr-2 h-full pr-2">
          <BlocksContent savedComposites={savedComposites} onAddComposite={onAddComposite} />
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

/**
 * One library card. Renders as a draggable / clickable button that
 * spawns a node with optional overrides (name / config). Used uniformly
 * for rig sources, MIDI processors, plugins, audio effects, and sinks.
 */
interface LibraryItem {
  /** Stable key for React. */
  key: string
  kind: NodeKind
  label: string
  description: string
  overrides?: AddNodeOverrides
}

function LibraryContent({
  onAddNode,
  rigSources,
  onOpenRigScreen,
  installedPlugins,
}: {
  onAddNode?: (kind: NodeKind, overrides?: AddNodeOverrides) => void
  rigSources?: RigSource[]
  onOpenRigScreen?: () => void
  installedPlugins?: ClapPluginInfo[]
}) {
  const grouped = React.useMemo<Array<{ cls: NodeClass; items: LibraryItem[] }>>(() => {
    return CLASS_ORDER.map((cls) => {
      if (cls === "source") {
        // Sources: rig-bound when the rig is known, else the catalog
        // (legacy / no-rig context).
        if (rigSources === undefined) {
          return {
            cls,
            items: NODE_CATALOG.filter((s) => s.class === cls).map((s) => ({
              key: `catalog-${s.kind}`,
              kind: s.kind,
              label: s.label,
              description: s.description,
            })),
          }
        }
        return {
          cls,
          items: rigSources.map((src, i) => {
            const spec = NODE_CATALOG.find((s) => s.kind === src.kind)
            return {
              key: `rig-${i}-${src.kind}`,
              kind: src.kind,
              label: src.label,
              description: spec?.description ?? "",
              overrides: { name: src.label },
            }
          }),
        }
      }
      if (cls === "instrument") {
        // Instruments: render one card per discovered CLAP plugin,
        // each pre-configured so the new node is hostable immediately.
        // Drop the catalog's generic "Plugin instrument" and the
        // "Built-in sine" — neither matched the way users think about
        // instruments in a live performance context.
        if (installedPlugins === undefined) {
          return { cls, items: [] }
        }
        return {
          cls,
          items: installedPlugins.map((p) => ({
            key: `plugin-${p.bundlePath}::${p.id}`,
            kind: "instrument.plugin" as NodeKind,
            label: p.name,
            description: p.vendor || p.description || "CLAP plugin",
            overrides: {
              name: p.name,
              config: {
                bundlePath: p.bundlePath,
                pluginId: p.id,
                pluginName: p.name,
                pluginVendor: p.vendor,
              },
            },
          })),
        }
      }
      return {
        cls,
        items: NODE_CATALOG.filter((s) => s.class === cls).map((s) => ({
          key: `catalog-${s.kind}`,
          kind: s.kind,
          label: s.label,
          description: s.description,
        })),
      }
    })
  }, [rigSources, installedPlugins])

  return (
    <div className="flex flex-col gap-4">
      {grouped.map(({ cls, items }) => {
        const isSources = cls === "source"
        const isInstruments = cls === "instrument"
        const emptyMessage = isSources
          ? "No sources in your rig yet."
          : isInstruments
            ? installedPlugins === undefined
              ? "Plugin scan not available outside Tauri."
              : "No CLAP plugins found on disk."
            : null
        return (
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
              {items.length === 0 && emptyMessage && (
                <div className="rounded-md border border-dashed bg-muted/20 px-2.5 py-3 text-center text-[11px] text-muted-foreground">
                  {emptyMessage}
                </div>
              )}
              {items.map((item) => (
                <div
                  key={item.key}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = "copy"
                    e.dataTransfer.setData("application/x-stardust-node-kind", item.kind)
                    if (item.overrides) {
                      e.dataTransfer.setData(
                        "application/x-stardust-node-overrides",
                        JSON.stringify(item.overrides),
                      )
                    }
                    e.dataTransfer.setData("text/plain", item.label)
                  }}
                  onClick={() => onAddNode?.(item.kind, item.overrides)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") onAddNode?.(item.kind, item.overrides)
                  }}
                  className="group flex w-full cursor-grab items-center gap-3 rounded-md border bg-background px-2.5 py-2 text-left transition-colors hover:border-primary/50 hover:bg-muted/40 active:cursor-grabbing"
                  title="Click to add at center, or drag onto the canvas"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-semibold">{item.label}</div>
                    <div className="truncate text-[10px] text-muted-foreground/80">
                      {item.description}
                    </div>
                  </div>
                  <span className="grid size-6 shrink-0 place-items-center text-muted-foreground group-hover:text-primary">
                    <Plus className="size-3" />
                  </span>
                </div>
              ))}
              {isSources && onOpenRigScreen && (
                <button
                  type="button"
                  onClick={onOpenRigScreen}
                  className="mt-0.5 flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed px-2.5 py-1.5 text-[10px] font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted/40 hover:text-foreground"
                  title="Open the rig screen to add or group hardware sources"
                >
                  <ExternalLink className="size-3" />
                  Add additional source (in Rig)
                </button>
              )}
            </div>
          </div>
        )
      })}
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
            <div className="truncate text-[10px] text-muted-foreground/80">{c.nodeCount} nodes</div>
          </div>
          <Plus className="size-3 text-muted-foreground" />
        </button>
      ))}
    </div>
  )
}
