# Icons

Tauri's build script (`tauri-build`) validates every file listed under
`bundle.icon` in `tauri.conf.json`. Missing files → `cargo build` fails
with a build-script-exit-1 error even in `bun dev`.

| File | Format | Used for |
|---|---|---|
| `32x32.png` | PNG, 32×32 | Linux small icon, fallback |
| `128x128.png` | PNG, 128×128 | Linux icon |
| `128x128@2x.png` | PNG, 256×256 | Linux retina icon |
| `icon.icns` | macOS bundle icon | macOS app bundle |
| `icon.ico` | Windows multi-resolution icon | Windows installer |

## Current state — placeholders

What lives in this directory today is a procedurally-generated
placeholder: a dark square with a warm-orange dot. It satisfies the
build but is **not the brand**. Replace it the moment real artwork
lands.

## Replacing with real branding

```bash
# From the project root, with a 1024×1024 source PNG:
bun x tauri icon path/to/stardust-logo.png
```

That regenerates every file in this directory at the right size +
format. Commit the result.
