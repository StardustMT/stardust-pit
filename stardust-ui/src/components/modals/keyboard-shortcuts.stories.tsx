import type { Meta, StoryObj } from "@storybook/react"

const meta: Meta = {
  title: "Modals/Keyboard Shortcuts",
  parameters: { layout: "centered" },
}
export default meta

const SHORTCUTS: Array<{ section: string; rows: Array<{ keys: string[]; desc: string }> }> = [
  {
    section: "Global",
    rows: [
      { keys: ["⌘", "K"], desc: "Open command palette" },
      { keys: ["⌘", ","], desc: "Open settings" },
      { keys: ["⌘", "S"], desc: "Save show" },
      { keys: ["⌘", "Z"], desc: "Undo last edit" },
    ],
  },
  {
    section: "Modes",
    rows: [
      { keys: ["⌘", "1"], desc: "Edit Mode" },
      { keys: ["⌘", "2"], desc: "Live Mode" },
      { keys: ["⌘", "L"], desc: "Toggle Performance Lock" },
      { keys: ["⌘", "."], desc: "Panic" },
    ],
  },
  {
    section: "Patches",
    rows: [
      { keys: ["→"], desc: "Advance patch" },
      { keys: ["←"], desc: "Previous patch" },
      { keys: ["1", "…", "9"], desc: "Jump to patch N" },
      { keys: ["Space"], desc: "Tap tempo" },
    ],
  },
]

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold">
      {children}
    </kbd>
  )
}

export const Default: StoryObj = {
  render: () => (
    <div className="w-[520px] rounded-lg border bg-card p-6 shadow-2xl">
      <h2 className="mb-4 text-lg font-semibold">Keyboard shortcuts</h2>
      <div className="space-y-5">
        {SHORTCUTS.map((s) => (
          <section key={s.section}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {s.section}
            </h3>
            <ul className="space-y-1.5 text-sm">
              {s.rows.map((r) => (
                <li key={r.desc} className="flex items-center justify-between">
                  <span>{r.desc}</span>
                  <span className="flex items-center gap-1">
                    {r.keys.map((k, i) => (
                      <Kbd key={i}>{k}</Kbd>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  ),
}
