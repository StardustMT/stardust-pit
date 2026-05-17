import type { Meta, StoryObj } from "@storybook/react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs"

const meta: Meta<typeof Tabs> = { title: "UI/Tabs", component: Tabs }
export default meta

export const EditMode: StoryObj<typeof Tabs> = {
  render: () => (
    <Tabs defaultValue="patch" className="w-[460px]">
      <TabsList>
        <TabsTrigger value="patch">Patch</TabsTrigger>
        <TabsTrigger value="layout">Layout</TabsTrigger>
      </TabsList>
      <TabsContent value="patch" className="rounded-lg border bg-card p-6">
        VST chain, parameter mappings, MIDI Learn.
      </TabsContent>
      <TabsContent value="layout" className="rounded-lg border bg-card p-6">
        Live Mode canvas: drag widgets, configure layout.
      </TabsContent>
    </Tabs>
  ),
}
