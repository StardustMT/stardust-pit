import type { Meta, StoryObj } from "@storybook/react"
import { FileMusic, FolderOpen, Plus, Star, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"

const meta: Meta = {
  title: "Screens/Show Browser",
  parameters: { layout: "fullscreen" },
}
export default meta
type Story = StoryObj

const RECENT = [
  {
    name: "Hamilton — 2026 Tour",
    file: "hamilton-2026.stardust",
    last: "Today, 14:22",
    songs: 23,
    starred: true,
  },
  {
    name: "Goodness of God (Sunday set)",
    file: "sunday-set.stardust",
    last: "Yesterday",
    songs: 5,
  },
  {
    name: "The Wild Party",
    file: "wild-party.stardust",
    last: "3 days ago",
    songs: 19,
    starred: true,
  },
  { name: "Demo show — Mikado", file: "mikado-demo.stardust", last: "2 weeks ago", songs: 12 },
  { name: "Stardust Sessions Vol. 3", file: "sessions-3.stardust", last: "Last month", songs: 7 },
]

export const Default: Story = {
  render: () => (
    <div className="min-h-screen bg-background p-12 text-foreground">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-2 text-center">
          <h1 className="text-4xl font-semibold tracking-tight">Stardust</h1>
          <p className="text-muted-foreground">Open a show, or start a new one.</p>
        </header>

        <div className="flex justify-center gap-3">
          <Button size="lg">
            <Plus />
            New show
          </Button>
          <Button size="lg" variant="outline">
            <FolderOpen />
            Open file
          </Button>
        </div>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Recent
          </h2>
          <div className="divide-y rounded-lg border bg-card">
            {RECENT.map((s) => (
              <button
                key={s.file}
                className="group flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-accent"
              >
                <div className="grid size-10 place-items-center rounded bg-muted">
                  <FileMusic className="size-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{s.name}</span>
                    {s.starred && <Star className="size-3.5 fill-amber-400 text-amber-400" />}
                  </div>
                  <div className="font-mono text-xs text-muted-foreground">
                    {s.file} · {s.songs} songs · {s.last}
                  </div>
                </div>
                <button
                  className="rounded p-1.5 text-muted-foreground opacity-0 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                  aria-label="Remove from recents"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Trash2 className="size-4" />
                </button>
              </button>
            ))}
          </div>
        </section>

        <footer className="text-center text-xs text-muted-foreground">
          Stardust v0.1 · <a className="underline">Wiki</a> · <a className="underline">Discussions</a>
        </footer>
      </div>
    </div>
  ),
}
