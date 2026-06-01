import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import path from "node:path"

// Tauri expects a fixed port + strict-port behaviour. See tauri.conf.json.
const TAURI_DEV_PORT = 1420

export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  clearScreen: false,

  server: {
    port: TAURI_DEV_PORT,
    strictPort: true,
    host: process.env.TAURI_DEV_HOST ?? false,
    watch: {
      // Tell Vite to ignore the Rust sibling, since Tauri watches it directly.
      ignored: ["**/stardust-core/**"],
    },
  },

  // Tell Vite to produce assets compatible with the Tauri target platform.
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  build: {
    target: process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "safari13",
    minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
}))
