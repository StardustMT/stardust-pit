import type { Meta, StoryObj } from "@storybook/react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { VstChainRow } from "@/components/widgets/vst-chain-row"
import { PluginParameterPanel } from "@/components/widgets/plugin-parameter-panel"
import { MidiMappingRow } from "@/components/widgets/midi-mapping-row"
import { BuiltinEffectsRack } from "@/components/widgets/builtin-effects-rack"
import { CueEditorRow } from "@/components/widgets/cue-editor-row"
import { LayoutCanvasGrid } from "@/components/widgets/layout-canvas-grid"
import { WidgetPalette } from "@/components/widgets/widget-palette"
import { ShowSongPatchLabel } from "@/components/widgets/show-song-patch-label"
import { PerformanceLockToggle } from "@/components/widgets/performance-lock-toggle"

const meta: Meta = {
  title: "Screens/Edit Mode",
  parameters: { layout: "fullscreen" },
}
export default meta
type Story = StoryObj

function EditModeShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <ShowSongPatchLabel
          show="Hamilton — 2026 Tour"
          song="My Shot"
          songIndex={4}
          songTotal={23}
          patch="Verse Pad"
          patchIndex={1}
          patchTotal={5}
        />
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            Discard changes
          </Button>
          <Button size="sm">Save</Button>
          <PerformanceLockToggle locked={false} />
        </div>
      </header>
      <div className="p-6">{children}</div>
    </div>
  )
}

export const PatchTab: Story = {
  name: "Patch tab",
  render: () => (
    <EditModeShell>
      <Tabs defaultValue="patch">
        <TabsList>
          <TabsTrigger value="patch">Patch</TabsTrigger>
          <TabsTrigger value="layout">Layout</TabsTrigger>
        </TabsList>
        <TabsContent value="patch" className="space-y-6">
          {/* VST chain */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                VST chain
              </h3>
              <Button size="sm" variant="outline">
                + Add plugin
              </Button>
            </div>
            <VstChainRow name="u-he Diva" format="VST3" sandboxed cpu={0.18} />
            <VstChainRow name="Valhalla Supermassive" format="VST3" sandboxed cpu={0.04} />
            <VstChainRow name="Pro-L 2" format="VST3" sandboxed cpu={0.02} />
          </section>

          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            {/* Parameter panel */}
            <PluginParameterPanel
              pluginName="u-he Diva"
              parameters={[
                { id: "cut", name: "Cutoff", value: 0.62, mapped: true, favorited: true },
                { id: "res", name: "Resonance", value: 0.28 },
                { id: "env", name: "Env amount", value: 0.42 },
                { id: "atk", name: "Attack", value: 0.05 },
                { id: "dec", name: "Decay", value: 0.4 },
                { id: "sus", name: "Sustain", value: 0.8 },
                { id: "rel", name: "Release", value: 0.6, favorited: true },
                { id: "lfo", name: "LFO rate", value: 0.3 },
              ]}
            />

            {/* Builtin effects */}
            <BuiltinEffectsRack />
          </div>

          {/* MIDI mappings */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                MIDI mappings
              </h3>
              <Button size="sm" variant="outline">
                + MIDI Learn
              </Button>
            </div>
            <MidiMappingRow
              source="RD-2000 Mod wheel (CC 1)"
              target="Diva · LFO depth"
              inheritedFrom="Show"
              range="0 → 127 · linear"
            />
            <MidiMappingRow
              source="EV-5 (CC 11)"
              target="Diva · Filter cutoff"
              inheritedFrom="Patch"
              overridden
              range="20 → 100 · exp"
            />
            <MidiMappingRow
              source="FCB1010 FS1"
              target="Patch advance"
              inheritedFrom="Show"
            />
          </section>

          {/* Cues */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Cues
              </h3>
              <Button size="sm" variant="outline">
                + Cue
              </Button>
            </div>
            <CueEditorRow
              trigger={{ type: "midi-note", channel: 1, note: "C2" }}
              action={{ type: "jump", patch: "Patch 3 — Strings" }}
            />
            <CueEditorRow
              trigger={{ type: "bar", bar: 33 }}
              action={{ type: "tempo", bpm: 168 }}
            />
          </section>
        </TabsContent>
      </Tabs>
    </EditModeShell>
  ),
}

export const LayoutTab: Story = {
  name: "Layout tab",
  render: () => (
    <EditModeShell>
      <Tabs defaultValue="layout">
        <TabsList>
          <TabsTrigger value="patch">Patch</TabsTrigger>
          <TabsTrigger value="layout">Layout</TabsTrigger>
        </TabsList>
        <TabsContent value="layout">
          <div className="flex gap-4">
            <WidgetPalette />
            <div className="h-[720px] flex-1">
              <LayoutCanvasGrid
                selectedId="notes"
                widgets={[
                  { id: "label", label: "Show / Song / Patch", col: 1, row: 1, colSpan: 6, rowSpan: 1 },
                  { id: "next", label: "Next Patch preview", col: 7, row: 1, colSpan: 4, rowSpan: 1 },
                  { id: "perf", label: "Performance Lock", col: 11, row: 1, colSpan: 2, rowSpan: 1 },
                  { id: "notes", label: "Show notes (selected)", col: 1, row: 2, colSpan: 7, rowSpan: 4 },
                  { id: "favs", label: "Parameter favorites", col: 8, row: 2, colSpan: 5, rowSpan: 2 },
                  { id: "click", label: "Click + Time + VU", col: 8, row: 4, colSpan: 5, rowSpan: 2 },
                  { id: "patch-list", label: "Patch list strip", col: 1, row: 6, colSpan: 12, rowSpan: 1 },
                  { id: "keyboard", label: "Keyboard visualizer", col: 1, row: 7, colSpan: 12, rowSpan: 2 },
                ]}
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </EditModeShell>
  ),
}
