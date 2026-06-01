import {
  Activity,
  AlertTriangle,
  AudioLines,
  Clock,
  FileText,
  Gauge,
  KeyboardMusic,
  ListMusic,
  Lock,
  PianoIcon,
  Sliders,
  Timer,
} from "lucide-react"
import { cn } from "@/lib/utils"

const WIDGETS = [
  { id: "ssp", label: "Show / Song / Patch label", icon: FileText },
  { id: "patch-list", label: "Patch list strip", icon: ListMusic },
  { id: "next-patch", label: "Next Patch preview", icon: ListMusic },
  { id: "keyboard", label: "Keyboard visualizer", icon: KeyboardMusic },
  { id: "notes", label: "Show notes pane", icon: FileText },
  { id: "click", label: "Click indicator", icon: Clock },
  { id: "elapsed", label: "Time elapsed", icon: Timer },
  { id: "vu", label: "VU meter", icon: AudioLines },
  { id: "cpu", label: "CPU + latency", icon: Gauge },
  { id: "midi", label: "MIDI activity", icon: Activity },
  { id: "transpose", label: "Transpose indicator", icon: PianoIcon },
  { id: "favorite", label: "Parameter favorite", icon: Sliders },
  { id: "panic", label: "Panic button", icon: AlertTriangle },
  { id: "perf-lock", label: "Performance Lock", icon: Lock },
]

export interface WidgetPaletteProps {
  className?: string
  /** Optional callback when a widget is "picked" (in real app, drag begins) */
  onPick?: (id: string) => void
}

export function WidgetPalette({ className, onPick }: WidgetPaletteProps) {
  return (
    <aside className={cn("flex w-64 flex-col gap-1 rounded-lg border bg-card p-2", className)}>
      <div className="px-2 pb-2 pt-1 text-xs uppercase tracking-wider text-muted-foreground">
        Widgets
      </div>
      {WIDGETS.map((w) => (
        <button
          key={w.id}
          onClick={() => onPick?.(w.id)}
          draggable
          className="flex cursor-grab items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground active:cursor-grabbing"
        >
          <w.icon className="size-4 text-muted-foreground" />
          {w.label}
        </button>
      ))}
    </aside>
  )
}
