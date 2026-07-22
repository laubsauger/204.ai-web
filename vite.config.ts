import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        // shareable organism sandbox (user 2026-07-22) — a real page in
        // prod; the SITE never mounts the organism (no bleed)
        'organism-lab': resolve(__dirname, 'organism-lab.html'),
        'organism-game': resolve(__dirname, 'organism-game.html'),
      },
    },
  },
})
