import type { Meta, StoryObj } from "@storybook/react"
import { Button } from "@/components/ui/button"
import { Sparkles } from "lucide-react"

const meta: Meta = {
  title: "Modals/About",
  parameters: { layout: "centered" },
}
export default meta

export const Default: StoryObj = {
  render: () => (
    <div className="w-[420px] rounded-lg border bg-card p-6 text-center shadow-2xl">
      <Sparkles className="mx-auto size-10 text-primary" />
      <h2 className="mt-3 text-2xl font-semibold tracking-tight">Stardust</h2>
      <p className="text-sm text-muted-foreground">v0.0.1 · pre-alpha</p>
      <p className="mt-4 text-sm">
        Open-source virtual instrument host built for the stage.
      </p>
      <div className="mt-4 space-y-1 font-mono text-xs text-muted-foreground">
        <div>Built on Tauri 2 · Rust · React · Overture</div>
        <div>GPL v3 · © Stardust contributors</div>
      </div>
      <div className="mt-6 flex justify-center gap-2">
        <Button variant="outline" size="sm">
          Wiki
        </Button>
        <Button variant="outline" size="sm">
          Release notes
        </Button>
        <Button variant="outline" size="sm">
          Licenses
        </Button>
      </div>
    </div>
  ),
}
