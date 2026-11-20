import { resolve } from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    // The generated adapter uses engine-local dependency paths. Prebundle its
    // full dependency graph so native development workers never load raw CJS.
    include: ["pdf-internals-viewer/inspection"],
  },
  build: {
    rolldownOptions: {
      output: {
        // Preserve dependency licenses and our modified-file notices before
        // chunk hashing. Vite otherwise drops legal comments when minifying.
        comments: { legal: true },
      },
    },
  },
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
      "pdf-internals-viewer/inspection": resolve(
        import.meta.dirname,
        "./src/generated/libpdf-inspection.mjs"
      ),
    },
  },
})
