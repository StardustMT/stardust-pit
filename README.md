<div align="center">

# Stardust

**An open-source live-performance VST host, built for musical theatre.**

A cross-platform alternative to industry staples like MainStage and Gig Performer — designed first for the workflows of MT music directors, but useful for any live keyboard rig.

[![Build status](https://img.shields.io/github/actions/workflow/status/ChaseCondon/Stardust/ci.yml?branch=main&label=build)](https://github.com/ChaseCondon/Stardust/actions)
[![Release](https://img.shields.io/github/v/release/ChaseCondon/Stardust?include_prereleases&label=release)](https://github.com/ChaseCondon/Stardust/releases)
[![License: GPL v3](https://img.shields.io/badge/license-GPL%20v3-blue.svg)](LICENSE)
[![Wiki](https://img.shields.io/badge/docs-wiki-green.svg)](https://github.com/ChaseCondon/Stardust/wiki)
[![Discussions](https://img.shields.io/github/discussions/ChaseCondon/Stardust)](https://github.com/ChaseCondon/Stardust/discussions)

</div>

---

> [!WARNING]
> **Pre-alpha.** Stardust is in early-stage development. No releases yet. Star the repo to follow along.

## What is Stardust?

Stardust is a host application for VST3 and CLAP audio plugins, aimed at live performance. You load the sounds you need for a show, organise them into songs and patches, and step through them on stage with a footswitch.

It runs on macOS and Windows as first-class platforms. The full feature set is documented on the [wiki](https://github.com/ChaseCondon/Stardust/wiki).

## Why it exists

Most existing live-host software is either macOS-only, closed-source, or built around session musician workflows that don't quite fit the realities of running a pit. Stardust started as a side project to scratch those itches — cross-platform from day one, plugin sandboxing so a single crash doesn't kill the show, and a data model (Show → Song → Patch) that mirrors how MDs actually think.

See the [wiki](https://github.com/ChaseCondon/Stardust/wiki/Comparison) for a feature comparison with other hosts.

## Core features

- **Show / Song / Patch model** — programme an entire show, advance patches with a footswitch
- **Plugin sandboxing** — a crashing VST does not take down the app
- **Sub-10ms latency** on macOS, sub-15ms on Windows with quality interfaces
- **MIDI Learn** with device profiles for common controllers
- **Cue system** — footswitch and MIDI-event triggers
- **Cascading settings** — configure MIDI once at Show level, override per Song or Patch only when needed
- **Customisable Live Mode** — touch-friendly, designed to be the mode you actively want to use
- **macOS and Windows** as tier-1 platforms from day one
- **Community sharing** for shows, device profiles, layouts, themes
- **Click track**, transpose, show notes, forScore integration via MIDI

## Usage

### Quick start (user)

> [!NOTE]
> Pre-release. Pre-built installers will be published with the first alpha. This section is a placeholder.

Once releases are available:

1. Download the latest installer for your platform from [Releases](https://github.com/ChaseCondon/Stardust/releases)
2. Run the installer
3. Open Stardust and follow the first-run setup to pick your audio device and MIDI inputs
4. Import a show file, or build your first show in Edit Mode

### Quick start (contributor)

To run a development build locally:

```bash
git clone git@github.com:ChaseCondon/Stardust.git
cd Stardust
cargo tauri dev
```

See [Dev Setup](https://github.com/ChaseCondon/Stardust/wiki/Dev-Setup) on the wiki for the full toolchain (Rust, Node, platform-specific audio SDKs).

### Build from source

For a production build:

```bash
cargo tauri build
```

Artifacts are written to `src-tauri/target/release/bundle/`.

## Documentation

- **[Project wiki](https://github.com/ChaseCondon/Stardust/wiki)** — architecture, feature pages, decisions, learning materials
- **[Project site](https://chasecondon.github.io/Stardust/)** — user-facing docs, downloads, FAQ

## High-level architecture

Stardust is a Tauri 2 application:

- **Frontend**: React + TypeScript for the UI
- **Backend**: Rust, orchestrating shows, patches, and settings
- **Audio engine**: [Overture](https://github.com/ChaseCondon/Overture), a sibling Rust crate handling audio I/O, MIDI, and plugin hosting

Plugins run in sandboxed child processes, communicating with the host over shared-memory ring buffers. A crashing plugin cannot take down the audio engine.

See the [Architecture Overview](https://github.com/ChaseCondon/Stardust/wiki/Architecture-Overview) on the wiki for diagrams and detail.

## Roadmap

The 1.0 release is the goal. Progress and per-phase detail live on the [Roadmap](https://github.com/ChaseCondon/Stardust/wiki/Roadmap) wiki page.

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md). Open an [issue](https://github.com/ChaseCondon/Stardust/issues) or join the [discussions](https://github.com/ChaseCondon/Stardust/discussions).

## License

[GPL v3](LICENSE). The sibling [Overture](https://github.com/ChaseCondon/Overture) library is Apache 2.0 — see the [license decision](https://github.com/ChaseCondon/Stardust/wiki/ADR-License-Split) for the reasoning.

---

<sub>MainStage is a trademark of Apple Inc. Gig Performer is a trademark of Deskew Technologies. All trademarks are property of their respective owners. Stardust is not affiliated with or endorsed by any of them.</sub>
