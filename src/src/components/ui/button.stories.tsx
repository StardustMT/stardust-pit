import type { Meta, StoryObj } from "@storybook/react"
import { Play, Square, AlertTriangle, Settings } from "lucide-react"
import { Button } from "./button"

const meta: Meta<typeof Button> = {
  title: "UI/Button",
  component: Button,
  parameters: { layout: "centered" },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "destructive", "outline", "secondary", "ghost", "link"],
    },
    size: { control: "select", options: ["default", "sm", "lg", "xl", "icon"] },
  },
}
export default meta

type Story = StoryObj<typeof Button>

export const Default: Story = { args: { children: "Go Live" } }
export const Destructive: Story = { args: { variant: "destructive", children: "End Show" } }
export const Outline: Story = { args: { variant: "outline", children: "Cancel" } }
export const Secondary: Story = { args: { variant: "secondary", children: "Test Audio" } }
export const Ghost: Story = { args: { variant: "ghost", children: "Show notes" } }
export const Link: Story = { args: { variant: "link", children: "View on wiki" } }

export const WithIcon: Story = {
  args: { children: ["Play", <Play key="i" />] },
  render: (args) => (
    <Button {...args}>
      <Play />
      Play
    </Button>
  ),
}

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Button size="sm">Small</Button>
      <Button size="default">Default</Button>
      <Button size="lg">Large</Button>
      <Button size="xl">Extra Large</Button>
      <Button size="icon" aria-label="Settings">
        <Settings />
      </Button>
    </div>
  ),
}

export const PanicButton: Story = {
  name: "Stardust › Panic (giant red)",
  render: () => (
    <Button
      variant="destructive"
      className="h-24 w-48 text-lg font-bold uppercase tracking-wider"
    >
      <AlertTriangle className="!size-6" />
      Panic
    </Button>
  ),
}

export const GoLive: Story = {
  name: "Stardust › Go Live (primary CTA)",
  render: () => (
    <Button size="xl" className="px-12">
      <Play />
      Go Live
    </Button>
  ),
}

export const EndShow: Story = {
  name: "Stardust › End Show (destructive xl)",
  render: () => (
    <Button size="xl" variant="destructive" className="px-12">
      <Square />
      End Show
    </Button>
  ),
}
