// Build the walk-2 layout harness into .verify/walk2/harness.
//
// PROGRAMMATIC RATHER THAN A CONFIG FILE, and the reason is mechanical: vite
// bundles a config file into `<nearest node_modules>/.vite-temp`, and the
// nearest node_modules to `scripts/` is the REPO ROOT's, which has no vite.
// Resolving `vite` and the react plugin explicitly out of the React
// workspace's own node_modules removes the search entirely.
//
// THE ROOT IS THE REACT WORKSPACE, not the repo, for the same reason the
// entry lives there: node_modules is resolved by walking up from the
// importer. The stylesheet is reached by a relative import that climbs out
// of the root, which vite allows and which keeps ONE copy of it.
import { fileURLToPath } from 'node:url'

const REPO = fileURLToPath(new URL('../../', import.meta.url))
const FR = REPO + 'frontend-react/'

// Resolved through each package's own `exports`, never a hardcoded dist path:
// the same reasoning `scripts/lib/puppeteer.mjs` records, so a version moving
// its files cannot silently break this.
import { readFileSync } from 'node:fs'
const entryOf = (pkg) => {
  const dir = FR + 'node_modules/' + pkg + '/'
  const j = JSON.parse(readFileSync(dir + 'package.json', 'utf8'))
  const e = j.exports?.['.']
  const rel = typeof e === 'string' ? e : (e?.import?.default ?? e?.import ?? e?.default ?? j.module ?? j.main)
  if (!rel) throw new Error(`cannot resolve an entry point for ${pkg}`)
  return dir + rel.replace(/^\.\//, '')
}

const { build } = await import(entryOf('vite'))
const react = (await import(entryOf('@vitejs/plugin-react'))).default

await build({
  configFile: false,
  plugins: [react()],
  root: REPO,
  base: './',
  logLevel: 'warn',
  build: {
    outDir: REPO + '.verify/walk2/harness',
    emptyOutDir: true,
    rollupOptions: { input: FR + 'harness/index.html' },
  },
})
console.log('harness built into .verify/walk2/harness')
