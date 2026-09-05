import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    // jsdom for the shell test, which mounts a real React root into a real
    // container. The shape tests need no DOM and renderToStaticMarkup does not
    // touch one, but one environment for both keeps the runner single-config.
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    // The suite reaches across the boundary into ../src/lib, which is plain JS
    // the migration does not touch. That import is the point: the fixtures are
    // produced by the SYSTEM's evaluator, not written down here.
    server: { deps: { inline: [/src\/lib/] } },
  },
})
