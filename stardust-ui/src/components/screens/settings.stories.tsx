import type { Meta, StoryObj } from "@storybook/react"
import {
  AudioLines,
  Cable,
  Cpu,
  Palette,
  Plug,
  Settings as SettingsIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

const meta: Meta = {
  title: "Screens/Settings",
  parameters: { layout: "fullscreen" },
}
export default meta
type Story = StoryObj

const NAV = [
  { id: "general", label: "General", icon: SettingsIcon },
  { id: "audio", label: "Audio", icon: AudioLines },
  { id: "midi", label: "MIDI", icon: Cable },
  { id: "plugins", label: "Plugins", icon: Plug },
  { id: "themes", label: "Themes", icon: Palette },
  { id: "performance", label: "Performance", icon: Cpu },
] as const

function SettingsShell({
  active,
  children,
}: {
  active: (typeof NAV)[number]["id"]
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto grid max-w-6xl grid-cols-[220px_1fr] gap-8 px-8 py-10">
        <aside>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Settings
          </h2>
          <nav className="flex flex-col gap-1">
            {NAV.map((n) => (
              <button
                key={n.id}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                  n.id === active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                )}
              >
                <n.icon className="size-4" />
                {n.label}
              </button>
            ))}
          </nav>
        </aside>
        <main>{children}</main>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      <div className="space-y-3 rounded-lg border bg-card p-5">{children}</div>
    </section>
  )
}

function Row({
  label,
  description,
  children,
}: {
  label: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {description && (
          <div className="text-xs text-muted-foreground">{description}</div>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

// =============================================================================
// General
// =============================================================================

export const General: Story = {
  render: () => (
    <SettingsShell active="general">
      <div className="space-y-8">
        <Section title="Defaults">
          <Row label="Default unit label" description="What to call sub-items by default">
            <Select defaultValue="song">
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="song">Song</SelectItem>
                <SelectItem value="number">Number</SelectItem>
                <SelectItem value="cue">Cue</SelectItem>
                <SelectItem value="piece">Piece</SelectItem>
                <SelectItem value="track">Track</SelectItem>
              </SelectContent>
            </Select>
          </Row>
          <Row
            label="Autosave on edits"
            description="Save show file automatically when you make a change in Edit Mode"
          >
            <Switch defaultChecked />
          </Row>
          <Row label="Open last show on launch" description="Skip the show browser">
            <Switch />
          </Row>
        </Section>

        <Section title="Updates">
          <Row label="Check for updates" description="Stardust v0.0.1 · up to date">
            <Button variant="outline" size="sm">
              Check now
            </Button>
          </Row>
          <Row label="Include pre-release builds">
            <Switch />
          </Row>
        </Section>
      </div>
    </SettingsShell>
  ),
}

// =============================================================================
// Audio
// =============================================================================

export const Audio: Story = {
  render: () => (
    <SettingsShell active="audio">
      <div className="space-y-8">
        <Section title="Device">
          <Row label="Output device">
            <Select defaultValue="focusrite">
              <SelectTrigger className="w-60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="focusrite">Focusrite Scarlett 18i20</SelectItem>
                <SelectItem value="motu">MOTU M4</SelectItem>
                <SelectItem value="rme">RME Babyface Pro FS</SelectItem>
                <SelectItem value="builtin">MacBook Pro (built-in)</SelectItem>
              </SelectContent>
            </Select>
          </Row>
          <Row label="Sample rate">
            <Select defaultValue="48000">
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="44100">44.1 kHz</SelectItem>
                <SelectItem value="48000">48 kHz</SelectItem>
                <SelectItem value="96000">96 kHz</SelectItem>
              </SelectContent>
            </Select>
          </Row>
          <Row label="Buffer size" description="Lower = less latency, more CPU pressure">
            <Select defaultValue="128">
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="64">64</SelectItem>
                <SelectItem value="128">128 (recommended)</SelectItem>
                <SelectItem value="256">256</SelectItem>
                <SelectItem value="512">512</SelectItem>
              </SelectContent>
            </Select>
          </Row>
          <Separator />
          <Row label="Latency (measured)" description="Round-trip — input to output">
            <Badge variant="success">7.2 ms</Badge>
          </Row>
        </Section>

        <Section title="Windows-only">
          <Row label="Driver" description="ASIO drivers beat WASAPI by 5–10 ms on most interfaces">
            <Select defaultValue="asio">
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="asio">ASIO</SelectItem>
                <SelectItem value="wasapi">WASAPI</SelectItem>
              </SelectContent>
            </Select>
          </Row>
        </Section>
      </div>
    </SettingsShell>
  ),
}

// =============================================================================
// MIDI
// =============================================================================

export const Midi: Story = {
  render: () => (
    <SettingsShell active="midi">
      <Section title="Input ports">
        <Row label="RD-2000 USB MIDI" description="Channels 1-3 · Roland RD-2000 profile">
          <Switch defaultChecked />
        </Row>
        <Row label="Boss FS-5U (sustain jack)" description="Channel 4 · Footswitch slot">
          <Switch defaultChecked />
        </Row>
        <Row
          label="EV-5 (expression input)"
          description="Channel 4, CC 11 · Expression pedal slot"
        >
          <Switch defaultChecked />
        </Row>
        <Row label="FCB1010 (foot controller)" description="Channel 16">
          <Switch defaultChecked />
        </Row>
        <Row
          label="Conductor cue (network MIDI)"
          description="rtpMIDI · Bonjour name 'Conductor iPad'"
        >
          <Switch />
        </Row>
      </Section>
    </SettingsShell>
  ),
}

// =============================================================================
// Plugins
// =============================================================================

export const Plugins: Story = {
  render: () => (
    <SettingsShell active="plugins">
      <div className="space-y-8">
        <Section title="Scan">
          <Row
            label="Last scan"
            description="38 VST3 plugins · 4 CLAP plugins · scanned 2 min ago"
          >
            <Button variant="outline" size="sm">
              Re-scan
            </Button>
          </Row>
          <Row label="VST3 search folders">
            <Button variant="ghost" size="sm">
              Edit folders
            </Button>
          </Row>
          <Row label="CLAP search folders">
            <Button variant="ghost" size="sm">
              Edit folders
            </Button>
          </Row>
        </Section>

        <Section title="Quarantine">
          <p className="text-sm text-muted-foreground">
            Plugins that crashed twice in a session are quarantined for the rest of that
            session. You can re-enable them here.
          </p>
          <Row
            label="Surge XT"
            description="Quarantined 2026-05-12 — 2 crashes in My Shot rehearsal"
          >
            <Button variant="outline" size="sm">
              Re-enable
            </Button>
          </Row>
        </Section>
      </div>
    </SettingsShell>
  ),
}

// =============================================================================
// Themes
// =============================================================================

export const Themes: Story = {
  render: () => (
    <SettingsShell active="themes">
      <div className="space-y-8">
        <Section title="Theme">
          <Row label="Appearance">
            <Select defaultValue="dark">
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="system">Match system</SelectItem>
                <SelectItem value="contrast">High contrast (stage)</SelectItem>
              </SelectContent>
            </Select>
          </Row>
          <Row label="Accent colour">
            <div className="flex gap-2">
              {["#7c3aed", "#f59e0b", "#10b981", "#ef4444", "#06b6d4"].map((c) => (
                <button
                  key={c}
                  className="size-7 rounded-full border ring-offset-background hover:ring-2 hover:ring-ring"
                  style={{ background: c }}
                  aria-label={`Accent ${c}`}
                />
              ))}
            </div>
          </Row>
        </Section>

        <Section title="Live Mode typography">
          <Row label="Base font size" description="Affects all Live Mode text">
            <div className="w-48">
              <Slider defaultValue={[16]} min={12} max={28} step={1} />
            </div>
          </Row>
          <Row label="Patch label size multiplier">
            <div className="w-48">
              <Slider defaultValue={[1.6]} min={1} max={3} step={0.1} />
            </div>
          </Row>
        </Section>

        <Section title="Custom CSS (advanced)">
          <Label htmlFor="css">Inject custom CSS into Live Mode</Label>
          <Input id="css" placeholder="/* e.g. .show-label { letter-spacing: 0.1em } */" />
        </Section>
      </div>
    </SettingsShell>
  ),
}

// =============================================================================
// Performance
// =============================================================================

export const Performance: Story = {
  render: () => (
    <SettingsShell active="performance">
      <div className="space-y-8">
        <Section title="Plugin sandboxing">
          <Row label="Sandboxing mode" description="Recommended: Strict for live, Grouped for CPU-constrained machines">
            <Select defaultValue="strict">
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="strict">Strict (one per process)</SelectItem>
                <SelectItem value="grouped">Grouped</SelectItem>
                <SelectItem value="inprocess">In-process (debug only)</SelectItem>
              </SelectContent>
            </Select>
          </Row>
          <Row label="Heartbeat tolerance" description="Audio callbacks missed before a plugin is treated as crashed">
            <Select defaultValue="3">
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1</SelectItem>
                <SelectItem value="3">3 (default)</SelectItem>
                <SelectItem value="6">6</SelectItem>
              </SelectContent>
            </Select>
          </Row>
        </Section>

        <Section title="Performance Lock">
          <Row
            label="Enabled by default when opening a show"
            description="Off in Edit Mode, on once you Go Live"
          >
            <Switch defaultChecked />
          </Row>
          <Row
            label="Block pre-scan during a show"
            description="No plugin or device re-scan while Performance Lock is active"
          >
            <Switch defaultChecked />
          </Row>
        </Section>

        <Section title="Pre-show validation">
          <Row label="Warn if battery is below" description="Suggest plugging in before going live">
            <Select defaultValue="50">
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="20">20%</SelectItem>
                <SelectItem value="50">50%</SelectItem>
                <SelectItem value="80">80%</SelectItem>
              </SelectContent>
            </Select>
          </Row>
        </Section>
      </div>
    </SettingsShell>
  ),
}
