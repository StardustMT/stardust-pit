import * as React from "react"
import { Check, AlertTriangle, X, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type CheckStatus = "pass" | "warn" | "fail"

export interface ValidationCheck {
  status: CheckStatus
  category: string
  detail: string
  resolution?: string
}

export interface PreShowValidationProps {
  checks: ValidationCheck[]
  onGoLive?: () => void
  onCancel?: () => void
  className?: string
}

const ICON: Record<CheckStatus, React.ComponentType<{ className?: string }>> = {
  pass: Check,
  warn: AlertTriangle,
  fail: X,
}

const TONE: Record<CheckStatus, string> = {
  pass: "text-emerald-400",
  warn: "text-amber-400",
  fail: "text-destructive",
}

export function PreShowValidation({
  checks,
  onGoLive,
  onCancel,
  className,
}: PreShowValidationProps) {
  const hasFail = checks.some((c) => c.status === "fail")
  const hasWarn = checks.some((c) => c.status === "warn")

  return (
    <div className={cn("w-full max-w-2xl rounded-lg border bg-card shadow-2xl", className)}>
      <header className="border-b px-6 py-4">
        <h2 className="text-lg font-semibold">Pre-Show Validation</h2>
        <p className="text-sm text-muted-foreground">
          Last checks before <span className="font-semibold">Go Live</span>.
        </p>
      </header>

      <ul className="divide-y">
        {checks.map((c, i) => {
          const Icon = ICON[c.status]
          return (
            <li key={i} className="flex items-start gap-3 px-6 py-3">
              <Icon className={cn("mt-0.5 size-4 shrink-0", TONE[c.status])} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{c.category}</div>
                <div className="text-sm text-muted-foreground">{c.detail}</div>
                {c.resolution && (
                  <button className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                    {c.resolution}
                    <ChevronRight className="size-3" />
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      <footer className="flex items-center justify-end gap-2 border-t px-6 py-4">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="outline" disabled={hasFail}>
          Resolve issues
        </Button>
        <Button onClick={onGoLive} disabled={hasFail}>
          {hasWarn ? "Go Live anyway" : "Go Live"}
        </Button>
      </footer>
    </div>
  )
}
