import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// ── THE BUNDLE IS SERVED BY FASTIFY AT /app/, NOT BY A DEV SERVER ─────────
//
// Migration Round 1, Phase 1. `base` matches the static prefix so the emitted
// asset URLs resolve when Fastify serves them; a dev-server proxy is
// deliberately not used in the pilot, because headers and auth must stay
// identical to production and a proxy is a second set of both.
//
// src/lib IS IMPORTED ACROSS THE WORKSPACE BOUNDARY BY PLAIN RELATIVE PATH.
// No alias and no `server.fs.allow`: Phase 0 item 4 proved a plain relative
// import resolves and bundles, and an alias would be a second name for one
// module - the shape this round exists to stop repeating.
export default defineConfig({
  plugins: [react()],
  base: '/app/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // A STABLE FILENAME, NOT A CONTENT HASH. The bundle is loaded by a static
    // <script src> in the vanilla index.html, which cannot know a hash; and the
    // server sends `cache-control: no-store, must-revalidate` on everything
    // outside /api, so a content hash would be buying cache-busting that is
    // already unconditional. Hashing here would cost the revert its one-line
    // property for nothing.
    rollupOptions: {
      input: 'src/main.tsx',
      output: {
        entryFileNames: 'terminus-react.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
})
