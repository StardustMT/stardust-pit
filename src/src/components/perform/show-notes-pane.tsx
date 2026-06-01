import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

export interface ShowNotesPaneProps {
  /** Plain or lightly-marked-up content. For v0.1 scaffold we render
   *  paragraphs / headings / bullets from a simple {h, p, ul, code} shape.
   *  Real markdown rendering lands when we wire to the engine. */
  content: NoteBlock[]
  className?: string
}

export type NoteBlock =
  | { type: "h"; level?: 1 | 2 | 3; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "code"; text: string }
  | { type: "chord"; line: string }

export function ShowNotesPane({ content, className }: ShowNotesPaneProps) {
  return (
    <ScrollArea
      className={cn("h-full rounded-lg border bg-card p-5 text-sm leading-relaxed", className)}
    >
      <div className="space-y-3">
        {content.map((block, i) => {
          switch (block.type) {
            case "h": {
              const lvl = block.level ?? 2
              const cls = lvl === 1 ? "text-2xl" : lvl === 2 ? "text-lg" : "text-base"
              return (
                <div key={i} className={cn("font-semibold tracking-tight", cls)}>
                  {block.text}
                </div>
              )
            }
            case "p":
              return (
                <p key={i} className="text-foreground/90">
                  {block.text}
                </p>
              )
            case "ul":
              return (
                <ul key={i} className="ml-5 list-disc space-y-1">
                  {block.items.map((it, j) => (
                    <li key={j}>{it}</li>
                  ))}
                </ul>
              )
            case "code":
              return (
                <pre
                  key={i}
                  className="overflow-x-auto rounded bg-muted px-3 py-2 font-mono text-xs"
                >
                  {block.text}
                </pre>
              )
            case "chord":
              return (
                <div key={i} className="font-mono text-base font-semibold tracking-wide">
                  {block.line}
                </div>
              )
          }
        })}
      </div>
    </ScrollArea>
  )
}
