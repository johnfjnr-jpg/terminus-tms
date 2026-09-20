// R-O4 CALIBRATION, IN BOTH HALVES, BECAUSE THE ROUND'S OWN EVIDENCE IS THAT
// NEITHER CLAIM HAD A DETECTOR.
//
// The react suite went from 1256 green to 1256 green across the wiring change.
// That is not a suite failing to notice a regression: it is Verification 51's
// silence, naming a claim nothing asserted. A literal `null` produces no wrong
// output to assert against, only an absence, so the panel could be empty for as
// long as nobody opened a hybrid deal.
//
// TWO INJECTIONS, ONE PER CLAIM, RUN SEPARATELY. Built into one run they would
// mask each other: with the schedule removed there is nothing in the right
// panel to measure a side-by-side relationship against, so the layout checks
// would fire for the content reason and prove nothing about the layout.
//
// HARNESS DISCIPLINE (Verification 44): full-path keys, an in-flight marker,
// the snapshot asserted before injecting, the restore compared byte for byte
// after every injection, and every stop path restores because `process.exit`
// does not run a `finally`. The TSX injection also REBUILDS, and asserts the
// built bundle actually changed before anything is measured - a probe run
// against a stale bundle measures the code that was just replaced.
import { readFileSync, writeFileSync, existsSync, unlinkSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const ROOT = '/Users/johnfryatt/terminus-tms'
const SNAP = `${ROOT}/.verify/walk4/snap-o4`
const MARKER = `${SNAP}/IN_FLIGHT`
mkdirSync(SNAP, { recursive: true })

const PANEL = `${ROOT}/frontend-react/src/deal/DealPanel.tsx`
const CSS = `${ROOT}/frontend/style.css`
const BUNDLE = `${ROOT}/frontend-react/dist/terminus-react.js`
const FILES = [PANEL, CSS, BUNDLE]
const keyFor = (f) => `${SNAP}/${f.replaceAll('/', '_')}`

if (existsSync(MARKER)) {
  console.error(`REFUSING: ${MARKER} exists, so a previous run stopped mid-injection.`)
  process.exit(3)
}
const original = new Map()
for (const f of FILES) {
  const b = readFileSync(f); writeFileSync(keyFor(f), b)
  if (!existsSync(keyFor(f))) { console.error(`no snapshot for ${f}`); process.exit(3) }
  original.set(f, b)
}
writeFileSync(MARKER, new Date().toISOString())

const restore = () => {
  for (const f of FILES) writeFileSync(f, readFileSync(keyFor(f)))
  for (const f of FILES) {
    if (Buffer.compare(readFileSync(f), original.get(f)) !== 0) {
      console.error(`RESTORE MISMATCH on ${f}. Marker left in place deliberately.`)
      process.exit(4)
    }
  }
}
const stop = (code, why) => { console.error(why); restore(); unlinkSync(MARKER); process.exit(code) }

const build = () => {
  try {
    execFileSync('npm', ['--prefix', `${ROOT}/frontend-react`, 'run', 'build'],
      { cwd: ROOT, encoding: 'utf8', timeout: 120000 })
    return true
  } catch (e) { console.error('BUILD FAILED:', String(e.stdout ?? e).slice(-400)); return false }
}

const runProbe = () => {
  try {
    return execFileSync('node', [`${ROOT}/scripts/walk4/probe-hybrid-panel.mjs`], {
      cwd: ROOT, encoding: 'utf8', timeout: 300000,
      env: {
        ...process.env,
        PUPPETEER_PATH: '/tmp/tms-probe/node_modules/puppeteer',
        PUPPETEER_EXECUTABLE_PATH: `${process.env.HOME}/.cache/puppeteer/chrome/mac_arm-152.0.7977.75/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`,
      },
    })
  } catch (e) { return `${e.stdout ?? ''}${e.stderr ?? ''}` }
}

// ANCHORED ON THE NAMED CHECK, never the exit code: an injection that kills the
// probe early also exits non-zero and would score as FIRED without the check it
// was written for ever running.
const verdict = (out, name) => {
  const line = out.split('\n').find((l) => l.includes(name))
  if (!line) return { seen: false, pass: false, line: `(the check "${name}" never ran)` }
  return { seen: true, pass: line.trim().startsWith('PASS'), line: line.trim() }
}
const SCHEDULE = 'the hosting schedule renders at 1440'
const SIDEBYSIDE = 'START ON THE SAME LINE at 1440'
const DBCHECK = 'the record is a HYBRID deal in the database'

console.log('── 1. HEALTHY ────────────────────────────────────────────────')
let out = runProbe()
const h1 = verdict(out, SCHEDULE)
const h2 = verdict(out, SIDEBYSIDE)
if (!h1.seen || !h2.seen) stop(3, 'a check did not run on the healthy tree, so nothing below means anything')
console.log(`   ${h1.line}`)
console.log(`   ${h2.line}`)
if (!h1.pass || !h2.pass) stop(3, 'the guard is red on the healthy tree; fix that before calibrating')

console.log('\n── 2. INJECTED: hybridSchedule goes back to the literal null ──')
const src = readFileSync(PANEL, 'utf8')
const inj = src.replace(
  'hybridSchedule={schedule ? <YearScheduleView schedule={schedule} /> : null} />',
  'hybridSchedule={null} />')
if (inj === src) stop(3, 'injection 1 changed nothing, so it would have scored a false FIRED')
writeFileSync(PANEL, inj)
if (!build()) stop(3, 'the injected tree does not build, so the run would fail for the wrong reason')
// THE BUILT BUNDLE MUST HAVE MOVED. A probe measuring a stale bundle reports
// the code that was just replaced, and it PASSES, which is the worst reading.
if (Buffer.compare(readFileSync(BUNDLE), original.get(BUNDLE)) === 0) {
  stop(3, 'the bundle is byte-identical after the injected build, so the probe would measure the old code')
}
out = runProbe()
const i1 = verdict(out, SCHEDULE)
const i1side = verdict(out, SIDEBYSIDE)
const i1db = verdict(out, DBCHECK)
console.log(`   ${i1.line}`)
console.log(`   layout check meanwhile: ${i1side.line}`)
console.log(`   fixture check meanwhile: ${i1db.line}`)
writeFileSync(PANEL, original.get(PANEL))
if (!build()) stop(4, 'the restored tree does not build')

console.log('\n── 3. INJECTED: the hybrid grid rule points at nothing ───────')
const css = readFileSync(CSS, 'utf8')
const cinj = css.replace('#deal-hybrid-group:not(.hidden) {', '#deal-hybrid-group-NOT-A-GROUP:not(.hidden) {')
if (cinj === css) stop(3, 'injection 2 changed nothing')
writeFileSync(CSS, cinj)
out = runProbe()
const i2 = verdict(out, SIDEBYSIDE)
const i2sched = verdict(out, SCHEDULE)
console.log(`   ${i2.line}`)
console.log(`   content check meanwhile, must stay green: ${i2sched.line}`)
restore()
if (!build()) stop(4, 'the restored tree does not build')

console.log('\n── 4. REVERTED ───────────────────────────────────────────────')
out = runProbe()
const b1 = verdict(out, SCHEDULE)
const b2 = verdict(out, SIDEBYSIDE)
console.log(`   ${b1.line}`)
console.log(`   ${b2.line}`)

const results = [
  ['healthy: both claims green', h1.pass && h2.pass],
  ['the CONTENT claim fires when hybridSchedule is null again', i1.seen && !i1.pass],
  ['and the fixture still landed, so that fire is not a broken run', i1db.seen && i1db.pass],
  ['the LAYOUT claim fires when the grid rule is removed', i2.seen && !i2.pass],
  ['and the content claim stays GREEN under it, so the two are independent', i2sched.seen && i2sched.pass],
  ['both green again after the revert', b1.pass && b2.pass],
]
console.log('')
for (const [what, ok] of results) console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`)
unlinkSync(MARKER)
const passed = results.filter(([, ok]) => ok).length
console.log(`\n${passed}/${results.length} calibration points`)
process.exit(passed === results.length ? 0 : 1)
