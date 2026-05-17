import type { Meta, StoryObj } from "@storybook/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const meta: Meta = {
  title: "Modals/New Show Wizard",
  parameters: { layout: "centered" },
}
export default meta

export const Default: StoryObj = {
  render: () => (
    <div className="w-[520px] rounded-lg border bg-card p-6 shadow-2xl">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">New show</h2>
        <p className="text-sm text-muted-foreground">
          Just the basics. You can change everything later.
        </p>
      </div>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="show-name">Name</Label>
          <Input id="show-name" placeholder="Hamilton — 2026 Tour" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="unit">Call sub-items</Label>
          <Select defaultValue="song">
            <SelectTrigger id="unit">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="song">Songs (universal default)</SelectItem>
              <SelectItem value="number">Numbers (musical-theatre style)</SelectItem>
              <SelectItem value="cue">Cues (theatre style)</SelectItem>
              <SelectItem value="piece">Pieces (classical style)</SelectItem>
              <SelectItem value="track">Tracks (concert style)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="template">Start from template</Label>
          <Select defaultValue="blank">
            <SelectTrigger id="template">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="blank">Blank show</SelectItem>
              <SelectItem value="mt">MT pit (3 keyboards, click, click bus)</SelectItem>
              <SelectItem value="worship">Worship (3 songs, chord chart)</SelectItem>
              <SelectItem value="solo">Solo electronic (8 patches)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost">Cancel</Button>
        <Button>Create show</Button>
      </div>
    </div>
  ),
}
