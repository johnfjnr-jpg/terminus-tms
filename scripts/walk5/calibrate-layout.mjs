// THE LAYOUT TIER'S GUARD, CALIBRATED. Every assertion in `probe-layout.mjs`
// went green on its first complete run, which is the tell rather than the
// proof. Each injection below removes one ruled behaviour and names the check
// that must notice.
//
// ANCHORED ON THE NAMED CHECK, never the exit code: an injection that kills
// the probe early also exits non-zero and would score as FIRED with the check
// it was written for never having run.
//
// HARNESS DISCIPLINE: full-path keys, in-flight marker, snapshot asserted
// before injecting, bytes compared after every injection, and every stop path
// restores because `process.exit` does not run a `finally`.
import { readFileSync, writeFileSync, existsSync, unlinkSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const ROOT = '/Users/johnfryatt/terminus-tms'
const SNAP = `${ROOT}/.verify/walk5/snap-layout`
const MARKER = `${SNAP}/IN_FLIGHT`
mkdirSync(SNAP, { recursive: true })

const CSS = `${ROOT}/frontend/style.css`
const PARTS = `${ROOT}/frontend-react/src/deal/panelParts.tsx`
const REFP = `${ROOT}/frontend-react/src/reference/ReferencePanel.tsx`
const BUNDLE = `${ROOT}/frontend-react/dist/terminus-react.js`
const FILES = [CSS, PARTS, REFP, BUNDLE]
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
const probe = () => {
  try {
    return execFileSync('node', [`${ROOT}/scripts/walk5/probe-layout.mjs`], {
      cwd: ROOT, encoding: 'utf8', timeout: 300000,
      env: { ...process.env,
        PUPPETEER_PATH: '/tmp/tms-probe/node_modules/puppeteer',
        PUPPETEER_EXECUTABLE_PATH: `${process.env.HOME}/.cache/puppeteer/chrome/mac_arm-152.0.7977.75/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing` },
    })
  } catch (e) { return `${e.stdout ?? ''}${e.stderr ?? ''}` }
}
const verdict = (out, name) => {
  const line = out.split('\n').find((l) => l.includes(name))
  if (!line) return { seen: false, red: false, line: `(the check "${name}" never ran)` }
  return { seen: true, red: line.trim().startsWith('FAIL'), line: line.trim().slice(0, 108) }
}

const INJECTIONS = [
  { what: 'the installation grid loses its column labels', file: PARTS, rebuild: true,
    from: '<span>Month</span><span>Milestone</span><span>%</span><span>Amount</span>',
    to: '<span /><span /><span /><span />',
    fires: 'W6-W9 the installation grid has its four column labels at 1440' },
  { what: 'the installation grid stops taking the prototype template', file: CSS, rebuild: false,
    from: '.cm-grid-head,\n.cm-grid-row {\n  display: grid;\n  grid-template-columns: 44px 195px 44px 64px;',
    to: '.cm-grid-head,\n.cm-grid-row {\n  display: grid;\n  grid-template-columns: 1fr 1fr 1fr 1fr;',
    fires: 'W6-W9 Month and % are sized to two digits at 1440' },
  // THE FIRST VERSION OF THIS INJECTION ONLY REMOVED THE CLASS, which takes
  // away the right-alignment and leaves the element in the grid's fourth
  // column - so its right edge still matched the column and the check passed.
  // The check was right and the injection was aimed at the wrong property.
  // This one takes the figure OUT of the grid row, which is what W10 is about.
  { what: 'the lump sum figure goes back inside a plain paragraph', file: PARTS, rebuild: true,
    from: '      <div className="cm-grid-row cm-grid-total" data-testid="contractor-base-row">',
    to: '      <div data-testid="contractor-base-row">',
    fires: 'W10 the lump sum figure ends with the Amount column at 1440' },
  { what: 'the hybrid column opens back up to the whole row', file: CSS, rebuild: false,
    from: '  grid-template-columns: 375px minmax(0, 280px);\n  justify-content: start;',
    to: '  grid-template-columns: minmax(365px, 1fr) minmax(0, 280px);',
    fires: 'W13 panel 1 closes onto its grid at 1440' },
  { what: 'the Opportunity type card comes back', file: REFP, rebuild: true,
    from: "        {row('oppType')}\n        {['lead',",
    to: "        {['lead',",
    fires: 'W2 and the row is INSIDE Terminus Details at 1440' },
]

console.log('── HEALTHY ───────────────────────────────────────────────────')
let out = probe()
const reds = out.split('\n').filter((l) => l.trim().startsWith('FAIL')).length
console.log(`   failing checks on the healthy tree: ${reds}`)
if (reds > 0) stop(3, 'the guard is red before any injection; nothing below means anything')

const results = [['healthy: the guard is silent', true]]
for (const inj of INJECTIONS) {
  const src = readFileSync(inj.file, 'utf8')
  if (!src.includes(inj.from)) stop(3, `anchor not found: ${inj.what}`)
  if (src.split(inj.from).length - 1 !== 1) stop(3, `anchor is not unique: ${inj.what}`)
  writeFileSync(inj.file, src.replace(inj.from, inj.to))
  if (inj.rebuild) {
    if (!build()) stop(3, `the injected tree does not build: ${inj.what}`)
    if (Buffer.compare(readFileSync(BUNDLE), original.get(BUNDLE)) === 0) {
      stop(3, `the bundle did not move, so the probe would measure the old code: ${inj.what}`)
    }
  }
  const o = probe()
  const v = verdict(o, inj.fires)
  writeFileSync(inj.file, original.get(inj.file))
  if (inj.rebuild && !build()) stop(4, 'the restored tree does not build')
  console.log(`\n${v.red ? 'FIRED ' : 'SILENT'}  ${inj.what}`)
  console.log(`        ${v.line}`)
  results.push([inj.what, v.seen && v.red])
}

restore()
if (!build()) stop(4, 'the restored tree does not build')
console.log('\n── REVERTED ──────────────────────────────────────────────────')
out = probe()
const back = out.split('\n').filter((l) => l.trim().startsWith('FAIL')).length
console.log(`   failing checks after the revert: ${back}`)
results.push(['green again after the revert', back === 0])

console.log('')
for (const [what, ok] of results) console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`)
unlinkSync(MARKER)
const passed = results.filter(([, ok]) => ok).length
console.log(`\n${passed}/${results.length} calibration points`)
process.exit(passed === results.length ? 0 : 1)
