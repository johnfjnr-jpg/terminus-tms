// R-O7/R-O8 CALIBRATION, SCREEN AND RECORD.
//
// The pure calibration proved the arithmetic. These are the claims that live
// above it: that the card offers the table, that the panel says what an
// overridden fee includes, that the deal sheet shows the warranty on its own
// line, and that the RECORD keeps the override rather than only the screen.
//
// THE LAST ONE IS INJECTED AGAINST THE SERVER, because that is where this
// round's real defect was: the client sent both keys, the react suite proved
// it sent them, the PATCH answered 200 with a new revision, and the route
// dropped them. A key outside the allowlist is carried forward silently rather
// than refused, so nothing anywhere reported a failure.
//
// The server runs under `--watch`, so a route edit reloads it; the harness
// waits for the reload to land rather than assuming it.
import { readFileSync, writeFileSync, existsSync, unlinkSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const ROOT = '/Users/johnfryatt/terminus-tms'
const SNAP = `${ROOT}/.verify/walk4/snap-o7ui`
const MARKER = `${SNAP}/IN_FLIGHT`
mkdirSync(SNAP, { recursive: true })

const S4 = `${ROOT}/frontend-react/src/deal/section4.tsx`
const ROWS = `${ROOT}/frontend-react/src/deal/rows.ts`
const ROUTE = `${ROOT}/src/routes/opportunities.js`
const BUNDLE = `${ROOT}/frontend-react/dist/terminus-react.js`
const FILES = [S4, ROWS, ROUTE, BUNDLE]
const keyFor = (f) => `${SNAP}/${f.replaceAll('/', '_')}`

if (existsSync(MARKER)) { console.error(`REFUSING: ${MARKER} exists`); process.exit(3) }
const original = new Map()
for (const f of FILES) {
  const b = readFileSync(f); writeFileSync(keyFor(f), b)
  if (!existsSync(keyFor(f))) { console.error(`no snapshot for ${f}`); process.exit(3) }
  original.set(f, b)
}
writeFileSync(MARKER, new Date().toISOString())
const restore = () => {
  for (const f of FILES) writeFileSync(f, readFileSync(keyFor(f)))
  for (const f of FILES) if (Buffer.compare(readFileSync(f), original.get(f)) !== 0) {
    console.error(`RESTORE MISMATCH ${f}; marker left`); process.exit(4)
  }
}
const stop = (c, w) => { console.error(w); restore(); unlinkSync(MARKER); process.exit(c) }

const build = () => {
  try { execFileSync('npm', ['--prefix', `${ROOT}/frontend-react`, 'run', 'build'],
    { cwd: ROOT, encoding: 'utf8', timeout: 120000 }); return true }
  catch (e) { console.error('BUILD FAILED', String(e.stdout ?? e).slice(-300)); return false }
}
const react = (pattern) => {
  try {
    return execFileSync('npx', ['vitest', 'run', 'src/__tests__/deal-section4.test.tsx',
      'src/__tests__/deal-panel.test.tsx', '-t', pattern, '--reporter=verbose'],
      { cwd: `${ROOT}/frontend-react`, encoding: 'utf8', timeout: 180000 })
  } catch (e) { return `${e.stdout ?? ''}${e.stderr ?? ''}` }
}
const probe = () => {
  try {
    return execFileSync('node', [`${ROOT}/scripts/walk4/probe-hosting-override.mjs`], {
      cwd: ROOT, encoding: 'utf8', timeout: 300000,
      env: { ...process.env,
        PUPPETEER_PATH: '/tmp/tms-probe/node_modules/puppeteer',
        PUPPETEER_EXECUTABLE_PATH: `${process.env.HOME}/.cache/puppeteer/chrome/mac_arm-152.0.7977.75/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing` },
    })
  } catch (e) { return `${e.stdout ?? ''}${e.stderr ?? ''}` }
}
// POSITIVE WITNESS BOTH WAYS. A run that never reached the check prints
// neither a tick nor a cross, and "no cross" is what a pass looks like too.
const vitestVerdict = (out, name) => {
  const line = out.split('\n').find((l) => l.includes(name) && (l.includes('✓') || l.includes('×')))
  if (!line) return { seen: false, red: false, line: `(the test "${name}" never ran)` }
  return { seen: true, red: line.includes('×'), line: line.trim().slice(0, 100) }
}
const probeVerdict = (out, name) => {
  const line = out.split('\n').find((l) => l.includes(name))
  if (!line) return { seen: false, red: false, line: `(the check "${name}" never ran)` }
  return { seen: true, red: line.trim().startsWith('FAIL'), line: line.trim().slice(0, 110) }
}

const results = []
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

console.log('── HEALTHY (react) ───────────────────────────────────────────')
let out = react('R-O7')
const h = vitestVerdict(out, 'ON, the fee table replaces it')
if (!h.seen) stop(3, 'the react check never ran on the healthy tree')
console.log(`   ${h.line}`)
results.push(['healthy: the fee table test is green', !h.red])

const REACT_INJECTIONS = [
  { what: 'the card never renders the fee table', file: S4,
    from: '{isHosting && perUnit ? (\n              <HostingFeeRows',
    to: '{false ? (\n              <HostingFeeRows',
    test: 'ON, the fee table replaces it' },
  { what: 'the warranty-inclusive help text is removed', file: S4,
    from: '<p className="pg-item-note" data-testid="deal-hosting-fee-help">',
    to: '<p className="pg-item-note" data-testid="deal-hosting-fee-help-GONE">',
    test: 'the help text says an overridden fee is warranty-inclusive' },
  { what: 'the deal sheet folds the warranty back into hardware', file: ROWS,
    from: "    split('Hardware cost', neg(hwCostExWarranty), D, D, neg(hwCostExWarranty)),\n    split('Warranty provision, at cost', neg(warrantyCost), D, D, neg(warrantyCost)),",
    to: "    split('Hardware and warranty cost', neg(hwCost), D, D, neg(hwCost)),",
    test: 'TOTAL COST IS THE VISIBLE SUM' },
]

for (const inj of REACT_INJECTIONS) {
  const src = readFileSync(inj.file, 'utf8')
  if (!src.includes(inj.from)) stop(3, `anchor not found: ${inj.what}`)
  writeFileSync(inj.file, src.replace(inj.from, inj.to))
  const o = react(inj.test.split(' ').slice(0, 3).join(' '))
  const v = vitestVerdict(o, inj.test)
  writeFileSync(inj.file, original.get(inj.file))
  console.log(`\n${v.red ? 'FIRED ' : 'SILENT'}  ${inj.what}`)
  console.log(`        ${v.line}`)
  results.push([inj.what, v.seen && v.red])
}

// ── THE SERVER HALF, AND IT IS THE ONE THAT FOUND A REAL DEFECT ─────────
console.log('\n── INJECTED: the two keys leave the route allowlist ──────────')
if (!build()) stop(3, 'the restored bundle does not build')
const routeSrc = readFileSync(ROUTE, 'utf8')
const routeInj = routeSrc.replace("    'hostingPriceMode', 'hostingUnitFees',\n", '')
if (routeInj === routeSrc) stop(3, 'the route injection changed nothing')
writeFileSync(ROUTE, routeInj)
await sleep(4000)   // the server watches the tree; give the reload time to land
let po = probe()
const dbCheck = probeVerdict(po, 'THE DATABASE holds the override mode')
const screenCheck = probeVerdict(po, 'CONTRACT NET inherited the override at 1440')
console.log(`   ${dbCheck.line}`)
console.log(`   the SCREEN meanwhile: ${screenCheck.line}`)
results.push(['the DATABASE check fires when the route drops the keys', dbCheck.seen && dbCheck.red])
results.push(['and the SCREEN still recalculates under it, which is why only the record could see it',
  screenCheck.seen && !screenCheck.red])

restore()
await sleep(4000)
if (!build()) stop(4, 'the restored tree does not build')

console.log('\n── REVERTED ──────────────────────────────────────────────────')
po = probe()
const back = probeVerdict(po, 'THE DATABASE holds the override mode')
console.log(`   ${back.line}`)
results.push(['the database check is green again after the revert', back.seen && !back.red])

console.log('')
for (const [what, ok] of results) console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`)
unlinkSync(MARKER)
const passed = results.filter(([, ok]) => ok).length
console.log(`\n${passed}/${results.length} calibration points`)
process.exit(passed === results.length ? 0 : 1)
