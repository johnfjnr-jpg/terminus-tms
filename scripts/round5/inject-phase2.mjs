// ── ROUND 5 PHASE 2 ITEM 6: THE SWAP'S OWN INJECTIONS ───────────────────
// Verified-snapshot harness: full-path keys, snapshot asserted before
// injecting, restore compared byte-for-byte after every injection with a stop
// on mismatch, unique anchors, final reverted run. Node, not a shell.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'

const ROOT = new URL('../../', import.meta.url).pathname
const SNAP = process.env.SNAP
if (!SNAP) throw new Error('SNAP is required')
mkdirSync(SNAP, { recursive: true })
const key = (rel) => SNAP + '/' + rel.replaceAll('/', '_')

const HTML = 'frontend/index.html'
const APP = 'frontend/app.js'
const CSS = 'frontend/style.css'
const MAIN = 'frontend-react/src/main.tsx'
const DESC = 'frontend-react/src/reference/descriptors.ts'
const PANEL = 'frontend-react/src/reference/ReferencePanel.tsx'
const HOST = 'frontend-react/src/reference/ReferenceHost.tsx'

const INJECTIONS = [
  { name: 'the vanilla Reference tag is restored, undoing the swap',
    claim: 'THE REACT REFERENCE PANEL IS THE LIVE ONE',
    file: HTML,
    from: '<!-- ── SUPERSEDED BY THE REACT REFERENCE PANEL. Round 5, Phase 2 ─────',
    to: '<script src="/opportunity-reference.js"></script>\n'
      + '<!-- ── SUPERSEDED BY THE REACT REFERENCE PANEL. Round 5, Phase 2 ─────' },

  { name: 'the mount container is removed',
    claim: 'the React Reference panel has a container to mount into',
    file: HTML, from: 'id="ref-root"', to: 'id="ref-root-GONE"' },

  { name: 'the revert target markup is removed',
    claim: 'the Reference tab\'s revert target survives',
    file: HTML, from: 'id="ref-vanilla"', to: 'id="ref-vanilla-GONE"' },

  { name: 'the door registry line is dropped',
    claim: 'CAN_EDIT_BY_VIEW carries opportunity-detail, or every row refuses',
    file: APP,
    from: "  'opportunity-detail': () => {\n    const v = document.getElementById('view-opportunity-detail')\n    return !!v && !v.classList.contains('is-not-mine')\n  },",
    to: '' },

  { name: 'the door fails OPEN on a missing view, as the vanilla does',
    claim: 'the registry line fails CLOSED, per contract finding 10',
    file: APP,
    from: "    return !!v && !v.classList.contains('is-not-mine')",
    to: "    return !v?.classList.contains('is-not-mine')" },

  { name: 'the bundle stops registering the panel',
    claim: 'the shell global surface is exactly the five registered names',
    file: MAIN,
    from: 'window.initOpportunityReferencePanel = function (opp: OppRecord): void {',
    to: 'window.initOpportunityReferencePanelXX = function (opp: OppRecord): void {' },

  { name: 'the panel reads the vanilla module\'s lexical state',
    claim: 'the React surface names none of the vanilla\'s unreachable state',
    file: HOST,
    from: '  const shell = useShell()',
    to: '  const shell = useShell()\n  const unused = (window as unknown as { refEdits?: unknown }).refEdits' },

  { name: 'display:flex overrides [hidden] again (behaviour 3)',
    claim: 'a closed row keeps its editor hidden and out of the tab order',
    file: CSS,
    from: '.field-row-edit:not([hidden]) { display: flex; align-items: center; gap: 8px; }',
    to: '.field-row-edit { display: flex; align-items: center; gap: 8px; }' },

  { name: 'the ownership treatment stops reaching the migrated rows',
    claim: 'a not-owned record dims the React rows as well as refusing them',
    file: CSS,
    from: '.is-not-mine .field-row-display,\n.is-not-mine .field-edit-bar,',
    to: '.is-not-mine .field-edit-bar,' },

  { name: 'Date Created renders the raw stored timestamp',
    claim: 'a date row reads as a date',
    file: DESC,
    from: "    { name: 'ro-created', label: 'Date Created', value: asDate(src.createdAt), readOnly: true },",
    to: "    { name: 'ro-created', label: 'Date Created', value: String(src.createdAt ?? ''), readOnly: true }," },

  { name: 'the cards lose their titles',
    claim: 'each section is NAMED, which no control census can see',
    file: PANEL,
    from: '      <p className="pg-card-title">{title}</p>\n',
    to: '' },

  { name: 'the save sends every key rather than only the dirty ones',
    claim: 'only what moved is sent',
    file: HOST,
    from: '    if (!Object.keys(payloadUpdate).length) return',
    // THE FIRST VERSION OF THIS WAS A NO-OP: it added `country`, which the
    // test already edits, so the assertion saw the key it expected. A real
    // violation adds a key nobody touched.
    to: '    if (!Object.keys(payloadUpdate).length) return\n    payloadUpdate.region = null' },
]

const FILES = [...new Set(INJECTIONS.map((i) => i.file))]
const original = new Map()
for (const rel of FILES) {
  if (!existsSync(ROOT + rel)) throw new Error(`SNAPSHOT: ${rel} missing`)
  const b = readFileSync(ROOT + rel)
  writeFileSync(key(rel), b)
  original.set(rel, b)
}
for (const rel of FILES) {
  if (!existsSync(key(rel))) throw new Error(`SNAPSHOT NOT WRITTEN for ${rel}`)
  if (readFileSync(key(rel)).length !== original.get(rel).length) {
    throw new Error(`SNAPSHOT SIZE MISMATCH for ${rel}`)
  }
  console.log(`snapshot verified  ${rel}  ${original.get(rel).length}B`)
}
if (new Set(FILES.map(key)).size !== FILES.length) throw new Error('SNAPSHOT KEY COLLISION')

const restore = (rel) => {
  writeFileSync(ROOT + rel, readFileSync(key(rel)))
  if (!readFileSync(ROOT + rel).equals(original.get(rel))) {
    throw new Error(`RESTORE MISMATCH on ${rel} - STOPPING`)
  }
}
const run = () => {
  const started = Date.now()
  try {
    const out = execSync('npm test 2>&1 && npm --prefix frontend-react run test 2>&1',
      { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' })
    return { green: true, out, ms: Date.now() - started }
  } catch (e) { return { green: false, out: (e.stdout ?? '') + (e.stderr ?? ''), ms: Date.now() - started } }
}
const fails = (out) => [...new Set([
  ...[...out.matchAll(/^\s*×\s+(.+?)\s+\d+ms$/gm)].map((m) => m[1].trim()),
  ...[...out.matchAll(/^✖ (.+?) \(\d/gm)].map((m) => m[1].trim()),
])].slice(0, 3)

console.log('\nBASELINE')
const base = run()
console.log(`  ${base.green ? 'GREEN' : '*** NOT GREEN ***'}  ${base.ms}ms`)
if (!base.green) { console.log(fails(base.out).join('\n')); process.exit(1) }

const results = []
for (const inj of INJECTIONS) {
  const src = readFileSync(ROOT + inj.file, 'utf8')
  const hits = src.split(inj.from).length - 1
  if (hits !== 1) {
    results.push({ ...inj, verdict: hits === 0 ? 'ANCHOR NOT FOUND' : `ANCHOR NOT UNIQUE (${hits})`, caught: [] })
    restore(inj.file); continue
  }
  writeFileSync(ROOT + inj.file, src.replace(inj.from, inj.to))
  const r = run()
  const noResult = !/pass \d+/.test(r.out) && !/Tests {2}/.test(r.out)
  results.push({ ...inj, verdict: noResult ? 'NO RESULT' : r.green ? 'SILENT' : 'DETECTED',
    ms: r.ms, caught: fails(r.out) })
  restore(inj.file)
}

console.log('\nFINAL REVERTED RUN')
const final = run()
console.log(`  ${final.green ? 'GREEN' : '*** NOT GREEN ***'}`)
for (const rel of FILES) {
  console.log(`  ${readFileSync(ROOT + rel).equals(original.get(rel)) ? 'identical' : '*** DIFFERS ***'}  ${rel}`)
}
console.log('\n── SWEEP ───────────────────────────────────────────────────────')
for (const r of results) {
  console.log(`\n${r.verdict.padEnd(20)} ${r.name}`)
  console.log(`  claim   ${r.claim}`)
  for (const c of r.caught) console.log(`  caught  ${c}`)
}
const bad = results.filter((r) => r.verdict !== 'DETECTED')
console.log(`\n${results.length - bad.length}/${results.length} detected`)
if (bad.length) {
  console.log('\nNOT DETECTED - each names a claim with no detector (Verification 51):')
  for (const b of bad) console.log(`  ${b.verdict}: ${b.claim}`)
}
