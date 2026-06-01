import type { Meta, StoryObj } from "@storybook/react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog"
import { Button } from "./button"

const meta: Meta<typeof Dialog> = { title: "UI/Dialog", component: Dialog }
export default meta

type Story = StoryObj<typeof Dialog>

export const Default: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Open dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Quarantine plugin?</DialogTitle>
          <DialogDescription>
            Surge XT crashed twice this session. Quarantining will skip it for the rest of the show;
            you can re-enable from the plugin browser.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost">Cancel</Button>
          <Button variant="destructive">Quarantine</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
}
