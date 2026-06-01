import type { Meta, StoryObj } from "@storybook/react"
import { LayoutCanvasGrid } from "./layout-canvas-grid"

const meta: Meta<typeof LayoutCanvasGrid> = {
  title: "Widgets/Layout Canvas Grid",
  component: LayoutCanvasGrid,
  parameters: { layout: "fullscreen" },
}
export default meta

export const PitLayout: StoryObj<typeof LayoutCanvasGrid> = {
  render: () => (
    <div className="h-[640px] p-6">
      <LayoutCanvasGrid
        selectedId="patch-list"
        widgets={[
          {
            id: "label",
            label: "Show / Song / Patch label",
            col: 1,
            row: 1,
            colSpan: 6,
            rowSpan: 1,
          },
          { id: "next", label: "Next Patch preview", col: 7, row: 1, colSpan: 4, rowSpan: 1 },
          { id: "perf", label: "Performance Lock", col: 11, row: 1, colSpan: 2, rowSpan: 1 },
          { id: "notes", label: "Show notes", col: 1, row: 2, colSpan: 7, rowSpan: 4 },
          { id: "favs", label: "Parameter favorites", col: 8, row: 2, colSpan: 5, rowSpan: 2 },
          { id: "click", label: "Click + Time + VU", col: 8, row: 4, colSpan: 5, rowSpan: 2 },
          { id: "patch-list", label: "Patch list strip", col: 1, row: 6, colSpan: 12, rowSpan: 1 },
          { id: "keyboard", label: "Keyboard visualizer", col: 1, row: 7, colSpan: 12, rowSpan: 2 },
        ]}
      />
    </div>
  ),
}
