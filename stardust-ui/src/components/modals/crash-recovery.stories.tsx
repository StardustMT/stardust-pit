import type { Meta, StoryObj } from "@storybook/react"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

const meta: Meta = {
  title: "Modals/Crash Recovery Details",
  parameters: { layout: "centered" },
}
export default meta

export const FirstCrash: StoryObj = {
  name: "First crash (toast)",
  render: () => (
    <div className="w-[400px] rounded-md border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200 shadow-lg">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0" />
        <div className="flex-1">
          <div className="font-semibold">Spitfire BBC SO crashed</div>
          <div className="text-sm opacity-90">
            Restarted in 240 ms. Voices cleaned up. Show continues.
          </div>
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="outline">
              View details
            </Button>
            <Button size="sm" variant="ghost">
              Dismiss
            </Button>
          </div>
        </div>
      </div>
    </div>
  ),
}

export const QuarantineConfirm: StoryObj = {
  name: "Quarantine confirmation (2nd crash)",
  render: () => (
    <div className="w-[440px] rounded-lg border bg-card p-6 shadow-2xl">
      <div className="mb-3 flex items-center gap-2">
        <AlertTriangle className="size-5 text-destructive" />
        <h2 className="text-lg font-semibold">Quarantine Surge XT?</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Surge XT has crashed twice in this session. Quarantining will skip it for the
        remainder of the show; you can re-enable it from{" "}
        <span className="font-medium text-foreground">Settings → Plugins</span>.
      </p>
      <div className="mt-3 space-y-1 rounded-md bg-muted p-3 font-mono text-xs">
        <div>
          <Badge variant="destructive" className="font-sans">
            Crash 1
          </Badge>{" "}
          14:22 · My Shot · Patch 3
        </div>
        <div>
          <Badge variant="destructive" className="font-sans">
            Crash 2
          </Badge>{" "}
          14:31 · Burn · Patch 1
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost">Cancel (risk a 3rd)</Button>
        <Button variant="destructive">Quarantine</Button>
      </div>
    </div>
  ),
}
