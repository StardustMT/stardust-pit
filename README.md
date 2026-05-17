<div align="center">

# Stardust

**Live-performance VST host for musical theatre keyboardists.**

An open-source, cross-platform alternative to Apple MainStage — built for Broadway-grade reliability on macOS *and* Windows.

[![Build status](https://img.shields.io/github/actions/workflow/status/ChaseCondon/Stardust/ci.yml?branch=main&label=build)](https://github.com/ChaseCondon/Stardust/actions)
[![Release](https://img.shields.io/github/v/release/ChaseCondon/Stardust?include_prereleases&label=release)](https://github.com/ChaseCondon/Stardust/releases)
[![License: GPL v3](https://img.shields.io/badge/license-GPL%20v3-blue.svg)](LICENSE)
[![Wiki](https://img.shields.io/badge/docs-wiki-green.svg)](https://github.com/ChaseCondon/Stardust/wiki)
[![Discussions](https://img.shields.io/github/discussions/ChaseCondon/Stardust)](https://github.com/ChaseCondon/Stardust/discussions)

</div>

---

> ⚠️ **Pre-alpha.** Stardust is in early-stage development. No releases yet. Star the repo to follow along.

## What is Stardust?

Stardust hosts your VST3 / CLAP plugins, routes MIDI from your keyboard and pedals, and lets you advance through a programmed show — patch by patch — with footswitch control. It's the missing piece between your keyboard rig and a Broadway pit.

Built for working musicians who play live shows night after night, by a working MD who got tired of MainStage's quirks (Windows users locked out, stuck notes between patches, panic buttons existing in the first place, no plugin sandboxing).

## Core features

- 🎹 **Show / Song / Patch model** — programme an entire show, advance patches with a footswitch
- 🛡️ **Plugin sandboxing** — a crashing VST does NOT take the app down
- ⚡ **Sub-10ms latency** on macOS, sub-15ms on Windows with quality interfaces
- 🎛️ **MIDI Learn** with smart device profiles (RD-2000, Nord, Yamaha, Kawai, and more)
- 🦶 **Cue system** — footswitch and MIDI-event triggers
- 🎚️ **Cascading settings** — set up MIDI once at Show level, override per Song/Patch only when needed
- 🎨 **Customizable Live Mode** — beautiful, touch-friendly, designed to be the mode you *want* to use
- 🪟 **macOS and Windows** as tier-1 platforms from day one
- 📦 **Community sharing** for shows, device profiles, layouts, themes
- 🎼 **Click track**, transpose, show notes, forScore integration via MIDI

## Quickstart

*(Pre-release — install instructions coming with the first alpha.)*

```bash
# Build from source (Phase 1+)
git clone git@github.com:ChaseCondon/Stardust.git
cd stardust
cargo tauri dev
```

## Documentation

📚 **[Project Wiki](https://github.com/ChaseCondon/Stardust/wiki)** — comprehensive docs, feature pages, architecture decisions, roadmap, and learning materials.

🌐 **[Project Site](https://chasecondon.github.io/Stardust/)** — user-facing docs, downloads, FAQ.

## Architecture in 30 seconds

Stardust is a Tauri 2 app:
- **React + TypeScript frontend** for the UI
- **Rust backend** orchestrating shows, patches, settings
- **[Overture](https://github.com/ChaseCondon/Overture)** (sibling crate) provides the underlying audio engine, MIDI I/O, and plugin hosting

Plugins run in sandboxed child processes — a crashing VST cannot kill the show.

See the [Architecture Overview](https://github.com/ChaseCondon/Stardust/wiki/Architecture-Overview) for the full picture.

## Roadmap

See the [full roadmap](https://github.com/ChaseCondon/Stardust/wiki/Roadmap) on the wiki.

- **Phase 0** — Foundations: repos, wiki, Storybook, CI
- **Phase 1** — Core engine: CPAL + midir + VST3 hosting in-process
- **Phase 1b** — Plugin sandboxing + CLAP support
- **Phase 2** — Show / Song / Patch model + UI core
- **Phase 3** — MT-essential features: click, transpose, notes, sampler
- **Phase 4** — Polish + 1.0 release
- **Phase 5+** — Marketplace, AU hosting, mobile companion, multi-keyboardist sync

## Contributing

Contributions welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) and our [Code of Conduct](CODE_OF_CONDUCT.md).

Open an [issue](https://github.com/ChaseCondon/Stardust/issues) or join the [discussions](https://github.com/ChaseCondon/Stardust/discussions).

## License

[GPL v3](LICENSE). The sibling [Overture](https://github.com/ChaseCondon/Overture) library is Apache 2.0 — see the [license decision write-up](https://github.com/ChaseCondon/Stardust/wiki/ADR-License-Split) for the why.
