import type { Meta, StoryObj } from "@storybook/react"
import {
  AudioLines,
  Cable,
  CheckCircle2,
  Plug,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

const meta: Meta = {
  title: "Modals/First-Run Wizard",
  parameters: { layout: "fullscreen" },
}
export default meta
type Story = StoryObj

function WizardShell({ step, children }: { step: number; children: React.ReactNode }) {
  const steps = ["Welcome", "Audio", "MIDI", "Plugins", "Done"]
  return (
    <div className="min-h-screen bg-background p-12 text-foreground">
      <div className="mx-auto max-w-3xl">
        {/* Stepper */}
        <ol className="mb-10 flex items-center justify-center gap-3 text-xs">
          {steps.map((label, i) => {
            const idx = i + 1
            const active = idx === step
            const done = idx < step
            return (
              <React.Fragment key={label}>
                <li
                  className={cn(
                    "flex items-center gap-2",
                    active && "font-semibold text-foreground",
                    done && "text-muted-foreground",
                    !active && !done && "text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-6 place-items-center rounded-full text-[10px]",
                      active && "bg-primary text-primary-foreground",
                      done && "bg-emerald-500/20 text-emerald-400",
                      !active && !done && "bg-muted",
                    )}
                  >
                    {done ? <CheckCircle2 className="size-4" /> : idx}
                  </span>
                  {label}
                </li>
                {i < steps.length - 1 && <li className="h-px w-8 bg-border" />}
              </React.Fragment>
            )
          })}
        </ol>

        <div className="rounded-lg border bg-card p-10">{children}</div>
      </div>
    </div>
  )
}

// Need React.Fragment in scope
import * as React from "react"

export const StepWelcome: Story = {
  name: "Step 1 · Welcome",
  render: () => (
    <WizardShell step={1}>
      <div className="text-center">
        <Sparkles className="mx-auto size-10 text-primary" />
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Welcome to Stardust</h1>
        <p className="mx-auto mt-2 max-w-md text-muted-foreground">
          A few quick steps to pick your audio device, find your MIDI rig, and scan plugins.
          You can change everything later in Settings.
        </p>
        <div className="mt-8 flex justify-center">
          <Button size="lg">Get started</Button>
        </div>
      </div>
    </WizardShell>
  ),
}

export const StepAudio: Story = {
  name: "Step 2 · Audio",
  render: () => (
    <WizardShell step={2}>
      <div className="space-y-6">
        <header className="flex items-center gap-3">
          <AudioLines className="size-6 text-primary" />
          <h2 className="text-2xl font-semibold tracking-tight">Pick an audio device</h2>
        </header>
        <p className="text-sm text-muted-foreground">
          The lower the buffer size, the lower the latency — at the cost of CPU pressure.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Output device">
            <Select defaultValue="focusrite">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="focusrite">Focusrite Scarlett 18i20</SelectItem>
                <SelectItem value="motu">MOTU M4</SelectItem>
                <SelectItem value="builtin">MacBook Pro (built-in)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Sample rate">
            <Select defaultValue="48000">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="44100">44.1 kHz</SelectItem>
                <SelectItem value="48000">48 kHz</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Buffer size">
            <Select defaultValue="128">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="64">64 (lowest latency)</SelectItem>
                <SelectItem value="128">128 (recommended)</SelectItem>
                <SelectItem value="256">256</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="flex justify-between border-t pt-4">
          <Button variant="ghost">Back</Button>
          <Button>Continue</Button>
        </div>
      </div>
    </WizardShell>
  ),
}

export const StepMidi: Story = {
  name: "Step 3 · MIDI",
  render: () => (
    <WizardShell step={3}>
      <div className="space-y-6">
        <header className="flex items-center gap-3">
          <Cable className="size-6 text-primary" />
          <h2 className="text-2xl font-semibold tracking-tight">Find your MIDI rig</h2>
        </header>
        <p className="text-sm text-muted-foreground">
          We detected the following devices. Toggle off anything you don't want Stardust to
          listen to.
        </p>
        <ul className="space-y-2">
          {[
            "RD-2000 USB MIDI",
            "Boss FS-5U (sustain jack)",
            "EV-5 (expression input)",
            "FCB1010 (foot controller)",
          ].map((d) => (
            <li
              key={d}
              className="flex items-center justify-between rounded-md border bg-card px-3 py-2"
            >
              <span className="text-sm">{d}</span>
              <Switch defaultChecked />
            </li>
          ))}
        </ul>
        <div className="flex justify-between border-t pt-4">
          <Button variant="ghost">Back</Button>
          <Button>Continue</Button>
        </div>
      </div>
    </WizardShell>
  ),
}

export const StepPlugins: Story = {
  name: "Step 4 · Plugins",
  render: () => (
    <WizardShell step={4}>
      <div className="space-y-6">
        <header className="flex items-center gap-3">
          <Plug className="size-6 text-primary" />
          <h2 className="text-2xl font-semibold tracking-tight">Scanning plugins</h2>
        </header>
        <div className="rounded-md border bg-card p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-mono">~/Library/Audio/Plug-Ins/VST3</span>
            <span className="text-muted-foreground">38 found</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-2/3 rounded-full bg-primary" />
          </div>
          <div className="mt-2 font-mono text-xs text-muted-foreground">
            Scanning: Surge XT.vst3…
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          You can pause here and finish on your own time. Anything not scanned now will be
          picked up on the next launch.
        </p>
        <div className="flex justify-between border-t pt-4">
          <Button variant="ghost">Back</Button>
          <Button>Continue</Button>
        </div>
      </div>
    </WizardShell>
  ),
}

export const StepDone: Story = {
  name: "Step 5 · Done",
  render: () => (
    <WizardShell step={5}>
      <div className="text-center">
        <CheckCircle2 className="mx-auto size-10 text-emerald-400" />
        <h2 className="mt-4 text-2xl font-semibold tracking-tight">You're set up</h2>
        <p className="mx-auto mt-2 max-w-md text-muted-foreground">
          Build your first show, or import an existing one. Everything you just configured
          is editable in Settings.
        </p>
        <div className="mt-8 flex justify-center gap-2">
          <Button variant="outline">Import existing</Button>
          <Button>Create first show</Button>
        </div>
      </div>
    </WizardShell>
  ),
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-sm font-medium">{label}</div>
      {children}
    </div>
  )
}
