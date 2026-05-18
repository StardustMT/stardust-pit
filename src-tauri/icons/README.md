# Icons

Tauri expects the following files in this directory before `cargo tauri build` succeeds:

| File | Format | Used for |
|---|---|---|
| `32x32.png` | PNG, 32×32 | Linux small icon, fallback |
| `128x128.png` | PNG, 128×128 | Linux icon |
| `128x128@2x.png` | PNG, 256×256 | Linux retina icon |
| `icon.icns` | macOS bundle icon | macOS app bundle |
| `icon.ico` | Windows multi-resolution icon | Windows installer |

These don't exist yet. Generate them from a 1024×1024 source PNG using `cargo tauri icon path/to/source.png` once branding lands.

This file is in v0.1 as a placeholder so the icons directory isn't empty in source control.
