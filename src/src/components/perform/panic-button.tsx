import * as React from "react"
import { AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

export interface PanicButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: "default" | "lg" | "xl"
}

const SIZE_CLASS: Record<NonNullable<PanicButtonProps["size"]>, string> = {
  default: "h-12 px-6 text-base",
  lg: "h-16 px-8 text-lg",
  xl: "h-24 px-12 text-2xl",
}

export function PanicButton({
  className,
  size = "lg",
  children = "Panic",
  ...props
}: PanicButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center gap-3 rounded-lg font-bold uppercase tracking-wider text-destructive-foreground transition-colors",
        "bg-destructive shadow-lg shadow-destructive/20 hover:bg-destructive/90",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "active:scale-[0.98]",
        SIZE_CLASS[size],
        className,
      )}
      {...props}
    >
      <AlertTriangle className="size-[1.25em]" />
      {children}
    </button>
  )
}
