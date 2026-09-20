// R-O2 CALIBRATION: the containment guard is shown FIRING before it is trusted.
//
// The claim it guards is not "the header is one line". One line is a per-width
// measurement the ruling defers to. The claim is that the header STAYS INSIDE
// ITS CARD at every width, which is what A1 recorded losing and what the 1240
// screenshot showed: ADD NOTE clipped against the follow-up card.
//
// THE INJECTION REMOVES THE FIX, not the assertion. It points the scoped wrap
// rules at a selector nothing carries, which is exactly the state the estate
// was in an hour ago, so a FIRE here is the real defect reproduced rather than
// a synthetic one.
//
// HARNESS DISCIPLINE (Verification 44): bytes snapshotted and keyed by FULL
// path, an in-flight marker written before the first injection and removed
// only after the final byte comparison, and every stop path is a restore path
// because `process.exit` does not run a `finally`.
import { readFileSync, writeFileSync, existsSync, unlinkSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const ROOT = '/Users/johnfryatt/terminus-tms'
const SNAP = `${ROOT}/.verify/walk4/snap`
const MARKER = `${SNAP}/IN_FLIGHT`
mkdirSync(SNAP, { recursive: true })

const FILES = [`${ROOT}/frontend/style.css`]
const keyFor = (f) => `${SNAP}/${f.replaceAll('/', '_')}`

if (existsSync(MARKER)) {
  console.error(`REFUSING: ${MARKER} exists, so a previous run stopped mid-injection.`)
  console.error(`Restore from ${SNAP} by hand and remove the marker before running again.`)
  process.exit(3)
}

const original = new Map()
for (const f of FILES) {
  const bytes = readFileSync(f)
  writeFileSync(keyFor(f), bytes)
  if (!existsSync(keyFor(f))) { console.error(`no snapshot for ${f}`); process.exit(3) }
  original.set(f, bytes)
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

const runProbe = () => {
  try {
    return execFileSync('node', [`${ROOT}/scripts/walk4/probe-notes-header.mjs`], {
      cwd: ROOT, encoding: 'utf8', timeout: 240000,
      env: {
        ...process.env,
        PUPPETEER_PATH: '/tmp/tms-probe/node_modules/puppeteer',
        PUPPETEER_EXECUTABLE_PATH: `${process.env.HOME}/.cache/puppeteer/chrome/mac_arm-152.0.7977.75/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`,
      },
    })
  } catch (e) { return `${e.stdout ?? ''}${e.stderr ?? ''}` }
}

// ANCHORED ON THE ASSERTION'S OWN TEXT, not on the exit code. CLAUDE.md records
// an injection that went red because the probe DIED six lines earlier, printed
// FIRED, and never reached the check it was written for.
const verdict = (out, name) => {
  const line = out.split('\n').find((l) => l.includes(name))
  if (!line) return { seen: false, pass: false, line: '(the check never ran)' }
  return { seen: true, pass: line.trim().startsWith('PASS'), line: line.trim() }
}

const CONTAIN_1240 = 'stays inside its card on the opportunity at 1240'
const CONTAIN_LEAD = 'stays inside its card on the lead card at 1240'
const BEHAVIOUR = 'beyond two notes the range buttons render on the opportunity'

console.log('── 1. HEALTHY: the guard must be silent ───────────────────────')
let out = runProbe()
let healthy = verdict(out, CONTAIN_1240)
if (!healthy.seen) stop(3, 'the containment check did not run on the healthy tree, so nothing below means anything')
console.log(`   ${healthy.line}`)
if (!healthy.pass) stop(3, 'the guard is red on the healthy tree; fix that before calibrating')

console.log('\n── 2. INJECTED: the scoped wrap rules point at nothing ────────')
const css = readFileSync(FILES[0], 'utf8')
const injected = css.replaceAll("[data-panel-header='cd-notes']", "[data-panel-header='cd-notes-NOT-A-PANEL']")
if (injected === css) stop(3, 'the injection changed nothing, so it would have scored a false FIRED')
writeFileSync(FILES[0], injected)

out = runProbe()
const fired = verdict(out, CONTAIN_1240)
const firedLead = verdict(out, CONTAIN_LEAD)
const sibling = verdict(out, BEHAVIOUR)
console.log(`   ${fired.line}`)
console.log(`   ${firedLead.line}`)
console.log(`   sibling, must stay green: ${sibling.line}`)

restore()

console.log('\n── 3. REVERTED: byte-identical, and green again ───────────────')
out = runProbe()
const back = verdict(out, CONTAIN_1240)
console.log(`   ${back.line}`)

const results = [
  ['the guard is silent on the healthy tree', healthy.pass],
  ['the guard FIRES on the opportunity when the fix is removed', fired.seen && !fired.pass],
  ['and FIRES on the lead card too, so the fix is not opportunity-only', firedLead.seen && !firedLead.pass],
  ['the unrelated behaviour check stays GREEN, so the injection is not a blunt break', sibling.seen && sibling.pass],
  ['the guard is green again after the revert', back.pass],
]
console.log('')
for (const [what, ok] of results) console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`)
unlinkSync(MARKER)
const passed = results.filter(([, ok]) => ok).length
console.log(`\n${passed}/${results.length} calibration points`)
process.exit(passed === results.length ? 0 : 1)
