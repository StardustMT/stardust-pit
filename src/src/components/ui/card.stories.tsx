import type { Meta, StoryObj } from "@storybook/react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./card"
import { Button } from "./button"

const meta: Meta<typeof Card> = {
  title: "UI/Card",
  component: Card,
  parameters: { layout: "centered" },
}
export default meta

type Story = StoryObj<typeof Card>

export const Default: Story = {
  render: () => (
    <Card className="w-[380px]">
      <CardHeader>
        <CardTitle>Spitfire BBC SO Discover</CardTitle>
        <CardDescription>VST3 · 412 MB sample library · Active in 3 patches</CardDescription>
      </CardHeader>
      <CardContent className="text-sm">
        Loaded successfully. No quarantine warnings.
      </CardContent>
      <CardFooter className="gap-2">
        <Button variant="outline">Open editor</Button>
        <Button variant="ghost">Remove</Button>
      </CardFooter>
    </Card>
  ),
}

export const PatchCard: Story = {
  name: "Stardust › Patch card (Edit Mode)",
  render: () => (
    <Card className="w-[320px]">
      <CardHeader>
        <CardDescription>Patch 3 of 7</CardDescription>
        <CardTitle className="text-xl">Sustained Pad</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Chain</span>
          <span>Diva · Valhalla Supermassive</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Transition</span>
          <span>Crossfade · 800 ms</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Mappings</span>
          <span>4 (inherits + 1 override)</span>
        </div>
      </CardContent>
    </Card>
  ),
}
