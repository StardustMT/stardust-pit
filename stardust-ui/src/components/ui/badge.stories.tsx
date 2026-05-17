import type { Meta, StoryObj } from "@storybook/react"
import { Badge } from "./badge"

const meta: Meta<typeof Badge> = { title: "UI/Badge", component: Badge, parameters: { layout: "centered" } }
export default meta

export const Statuses: StoryObj<typeof Badge> = {
  render: () => (
    <div className="flex gap-2">
      <Badge variant="success">Loaded</Badge>
      <Badge variant="warning">Slow boot</Badge>
      <Badge variant="destructive">Quarantined</Badge>
      <Badge variant="outline">Inactive</Badge>
      <Badge>v0.1</Badge>
    </div>
  ),
}
