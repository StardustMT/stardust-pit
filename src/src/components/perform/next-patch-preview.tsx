import { cn } from "@/lib/utils"

export interface NextPatchPreviewProps {
  name: string
  subtitle?: string
  /** Direction hint shown at top — "Next" or "Previous". Defaults to "Next". */
  direction?: "Next" | "Previous"
  className?: string
}

export function NextPatchPreview({
  name,
  subtitle,
  direction = "Next",
  className,
}: NextPatchPreviewProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-dashed border-primary/40 bg-primary/5 px-5 py-4",
        className,
      )}
    >
      <div className="text-xs uppercase tracking-[0.2em] text-primary">{direction}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">{name}</div>
      {subtitle && <div className="mt-0.5 text-sm text-muted-foreground">{subtitle}</div>}
    </div>
  )
}
