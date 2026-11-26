import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

import { port } from './vite/port.ts';
import { publicPages } from './vite/public-pages-plugin.ts';

// https://vite.dev/config/
export default defineConfig({
  build: {
    rolldownOptions: {
      input: {
        about: resolve(import.meta.dirname, 'about.html'),
        main: resolve(import.meta.dirname, 'index.html'),
      },
      output: {
        // Preserve dependency licenses and our modified-file notices before
        // chunk hashing. Vite otherwise drops legal comments when minifying.
        comments: { legal: true },
      },
    },
  },
  optimizeDeps: {
    // The generated adapter uses engine-local dependency paths. Prebundle its
    // full dependency graph so native development workers never load raw CJS.
    include: ['pdf-internals-viewer/inspection'],
  },
  plugins: [react(), tailwindcss(), publicPages()],
  preview: { port, strictPort: true },
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, './src'),
      'pdf-internals-viewer/inspection': resolve(import.meta.dirname, './src/generated/libpdf-inspection.mjs'),
    },
  },
  server: { port, strictPort: true },
});
