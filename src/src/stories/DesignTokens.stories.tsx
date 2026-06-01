import type { Meta, StoryObj } from "@storybook/react"

const meta: Meta = {
  title: "Design System/Tokens",
  parameters: { layout: "padded" },
}
export default meta

type Story = StoryObj

const SWATCHES = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "destructive-foreground",
  "border",
  "input",
  "ring",
] as const

const CHARTS = ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"] as const

export const Colors: Story = {
  render: () => (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-lg font-semibold tracking-tight">Semantic palette</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {SWATCHES.map((token) => (
            <div key={token} className="rounded-lg border bg-card p-3">
              <div
                className="h-14 w-full rounded border"
                style={{ background: `var(--${token})` }}
              />
              <div className="mt-2 font-mono text-xs">--{token}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold tracking-tight">Chart palette</h2>
        <div className="grid grid-cols-5 gap-3">
          {CHARTS.map((token) => (
            <div key={token} className="rounded-lg border bg-card p-3">
              <div className="h-14 w-full rounded" style={{ background: `var(--${token})` }} />
              <div className="mt-2 font-mono text-xs">--{token}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  ),
}

export const Typography: Story = {
  render: () => (
    <div className="space-y-6">
      <div>
        <div className="text-xs text-muted-foreground">display</div>
        <div className="text-5xl font-semibold tracking-tight">Stardust</div>
      </div>
      <div>
        <div className="text-xs text-muted-foreground">h1</div>
        <div className="text-3xl font-semibold tracking-tight">Live Mode</div>
      </div>
      <div>
        <div className="text-xs text-muted-foreground">h2</div>
        <div className="text-2xl font-semibold">Show / Song / Patch</div>
      </div>
      <div>
        <div className="text-xs text-muted-foreground">h3</div>
        <div className="text-xl font-medium">Cascading settings</div>
      </div>
      <div>
        <div className="text-xs text-muted-foreground">body</div>
        <p className="max-w-prose">
          Stardust is a virtual instrument host built for the stage. It loads VST3 and CLAP plugins,
          handles MIDI and audio routing, and wraps them in a control surface designed for live
          performance.
        </p>
      </div>
      <div>
        <div className="text-xs text-muted-foreground">muted body</div>
        <p className="max-w-prose text-muted-foreground">
          From a single keyboardist's rig to a full pit's worth of programmed sounds.
        </p>
      </div>
      <div>
        <div className="text-xs text-muted-foreground">mono</div>
        <code className="rounded bg-muted px-2 py-1 font-mono text-sm">
          patch.advance() -&gt; Result&lt;(), PatchError&gt;
        </code>
      </div>
    </div>
  ),
}

export const Spacing: Story = {
  render: () => (
    <div className="space-y-3">
      {[1, 2, 3, 4, 6, 8, 12, 16, 24, 32].map((n) => (
        <div key={n} className="flex items-center gap-3">
          <div className="w-12 font-mono text-xs text-muted-foreground">{n * 4}px</div>
          <div className="h-3 rounded bg-primary" style={{ width: `${n * 4}px` }} />
        </div>
      ))}
    </div>
  ),
}

export const Radii: Story = {
  render: () => (
    <div className="flex gap-4">
      {(["sm", "md", "lg", "xl"] as const).map((size) => (
        <div key={size} className="text-center">
          <div
            className="h-24 w-24 border bg-card"
            style={{ borderRadius: `var(--radius-${size})` }}
          />
          <div className="mt-2 font-mono text-xs">{size}</div>
        </div>
      ))}
    </div>
  ),
}
