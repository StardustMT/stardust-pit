import * as React from "react"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

export interface BuiltinEffectsRackProps {
  className?: string
}

/** Stub of the built-in effects rack: 3-band EQ, compressor, reverb send.
 *  All values are mocked in v0.1. */
export function BuiltinEffectsRack({ className }: BuiltinEffectsRackProps) {
  return (
    <div className={cn("grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-3", className)}>
      <EqSection />
      <CompSection />
      <ReverbSection />
    </div>
  )
}

function EqSection() {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-semibold">EQ</h4>
        <Switch defaultChecked />
      </div>
      <div className="space-y-3">
        <Knob label="Low" hz="80 Hz" defaultValue={0.5} />
        <Knob label="Mid" hz="900 Hz · Q 1.2" defaultValue={0.5} />
        <Knob label="High" hz="8 kHz" defaultValue={0.65} />
      </div>
    </section>
  )
}

function CompSection() {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-semibold">Compressor</h4>
        <Switch />
      </div>
      <div className="space-y-3">
        <Knob label="Threshold" hz="−18 dB" defaultValue={0.4} />
        <Knob label="Ratio" hz="4 : 1" defaultValue={0.5} />
        <Knob label="Makeup" hz="+4 dB" defaultValue={0.6} />
      </div>
    </section>
  )
}

function ReverbSection() {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-semibold">Reverb send</h4>
        <Switch defaultChecked />
      </div>
      <div className="space-y-3">
        <Knob label="Send" hz="−12 dB" defaultValue={0.35} />
        <Knob label="Decay" hz="2.4 s" defaultValue={0.5} />
        <Knob label="Mix" hz="dry/wet" defaultValue={0.25} />
      </div>
    </section>
  )
}

function Knob({
  label,
  hz,
  defaultValue,
}: {
  label: string
  hz: string
  defaultValue: number
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span>{label}</span>
        <span className="font-mono text-xs text-muted-foreground">{hz}</span>
      </div>
      <Slider defaultValue={[defaultValue]} max={1} step={0.01} />
    </div>
  )
}
