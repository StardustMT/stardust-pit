import type { Meta, StoryObj } from "@storybook/react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select"

const meta: Meta<typeof Select> = {
  title: "UI/Select",
  component: Select,
  parameters: { layout: "centered" },
}
export default meta

export const AudioDevice: StoryObj<typeof Select> = {
  render: () => (
    <div className="w-[280px]">
      <Select defaultValue="focusrite">
        <SelectTrigger>
          <SelectValue placeholder="Choose audio device" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="focusrite">Focusrite Scarlett 18i20</SelectItem>
          <SelectItem value="motu">MOTU M4</SelectItem>
          <SelectItem value="rme">RME Babyface Pro FS</SelectItem>
          <SelectItem value="builtin">MacBook Pro (built-in)</SelectItem>
        </SelectContent>
      </Select>
    </div>
  ),
}
