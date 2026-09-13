// ── Q2: WIRED, RUNNING, AND SILENTLY BROKEN ──────────────────────────────
//
// A failing wired test is caught by the gate. What the gate CANNOT catch is
// a test that passes while asserting against identifiers that no longer
// render - Verification 41's standing qualification already records 52 such
// assertions against three dead markup blocks.
//
// So Q2 asks: which detectors name a testid or id that exists NOWHERE in
// the surfaces they claim to test?
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { stripComments, kindOf } from '../lib/strip-comments.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const walk = (d, out = []) => {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name)
    if (e.isDirectory()) { if (!/node_modules|\.git/.test(p)) walk(p, out) }
    else if (/\.(mjs|js|ts|tsx|html)$/.test(e.name)) out.push(p)
  }
  return out
}
const all = [...walk(join(ROOT, 'scripts')), ...walk(join(ROOT, 'frontend-react/src')),
             join(ROOT, 'frontend/index.html'), join(ROOT, 'frontend/app.js')]
  .map((f) => relative(ROOT, f))
const read = (f) => { try { return readFileSync(join(ROOT, f), 'utf8') } catch { return '' } }

// WHERE AN IDENTIFIER CAN LEGITIMATELY LIVE: the shell's markup, the shell's
// script, and the React tree. Everything else is a test naming it.
const PRODUCERS = all.filter((f) =>
  f === 'frontend/index.html' || f === 'frontend/app.js'
  || (f.startsWith('frontend-react/src/') && !/__tests__|\.test\./.test(f)))
const producerText = PRODUCERS.map(read).join('\n')

const isDetector = (f) => /\.test\.(mjs|ts|tsx)$/.test(f)
  || /^scripts\/.*(probe|census|calibrate|walk|inject)/.test(f)
const detectors = all.filter(isDetector)

const SELF = 'scripts/probe-inventory/q2-rotted.mjs'
const idsIn = (s) => {
  const out = new Set()
  for (const m of s.matchAll(/data-testid=["'`]([a-zA-Z][\w-]{2,})["'`]/g)) out.add(m[1])
  for (const m of s.matchAll(/["'`]\[data-testid=\\?["']([a-zA-Z][\w-]{2,})\\?["']\]["'`]/g)) out.add(m[1])
  for (const m of s.matchAll(/(?:must|getByTestId|\$t|byTestId)\(\s*['"`]([a-zA-Z][\w-]{2,})['"`]/g)) out.add(m[1])
  for (const m of s.matchAll(/getElementById\(\s*['"`]([a-zA-Z][\w-]{2,})['"`]/g)) out.add(m[1])
  return out
}

// ── CALIBRATION (R2): a KNOWN-dead identifier must be flagged; a KNOWN-live
// one must not. Both taken from this estate, not invented.
const KNOWN_LIVE = 'cd-card-account'          // proven live this week, screenshotted
const KNOWN_DEAD = 'tms-probe-inventory-no-such-id-' + 'calibration'
const live = (id) => producerText.includes(id)
console.log('=== Q2 CALIBRATION ===')
console.log(`  known LIVE id "${KNOWN_LIVE}" found in a producer: ${live(KNOWN_LIVE)}   (must be TRUE)`)
console.log(`  known DEAD id (synthetic) found in a producer:     ${live(KNOWN_DEAD)}   (must be FALSE)`)
const calOk = live(KNOWN_LIVE) && !live(KNOWN_DEAD)
console.log(calOk ? '  CALIBRATED: it separates a live identifier from an absent one.\n'
                  : '  *** NOT CALIBRATED. ***\n')

// ── TEMPLATE-GENERATED IDS ARE NOT DEAD, AND THE RAW NUMBER IS A LIE ────
//
// `display-industry`, `cd-note-0` and `deal-ms-0-usd` never appear as
// literals in any producer, because they are built at runtime from
// `data-testid={`display-${key}`}`. A scan for the literal reports every one
// of them as dead.
//
// So: harvest the TEMPLATE PREFIXES the producers actually build, and treat
// an id matching one as explained. The raw count is reported alongside, so
// the refinement cannot hide a real rise.
const prefixes = new Set()
for (const f of PRODUCERS) {
  for (const m of read(f).matchAll(/[`'"]([a-zA-Z][\w-]*-)\$\{/g)) prefixes.add(m[1])
  for (const m of read(f).matchAll(/[`'"]([a-zA-Z][\w-]*-)['"`]\s*\+/g)) prefixes.add(m[1])
}
const templated = (id) => [...prefixes].some((px) => id.startsWith(px))
console.log(`  template prefixes the producers build: ${prefixes.size}`)
console.log(`  e.g. ${[...prefixes].slice(0, 8).join(', ')}\n`)

console.log('=== Q2 RESULT: detectors naming identifiers no producer renders ===')
const rows = []
for (const f of detectors) {
  if (f === SELF) continue
  const ids = [...idsIn(stripComments(read(f), kindOf(f)))]
  // AND AN ID THE DETECTOR ITSELF RENDERS IS ITS OWN FIXTURE, NOT AN
  // ASSERTION ABOUT A PRODUCER. `ui-shell.test.tsx` mounts a Modal with
  // `m-save`, `m-close` and friends; those exist because the test creates
  // them. Third false-positive class in this one sweep, and each was found
  // by reading the output rather than by trusting the count.
  const own = read(f)
  const selfRendered = (id) =>
    new RegExp(`data-testid=["'\`{]*[^\n]{0,40}["'\`]${id.replace(/[-]/g, '\\-')}["'\`]`).test(own)
    || own.includes(`testid="${id}"`) || own.includes(`testid={\`${id}\`}`)
    || own.includes(`data-testid="${id}"`)
  const rawDead = ids.filter((id) => !live(id))
  const dead = rawDead.filter((id) => !templated(id) && !selfRendered(id))
  if (rawDead.length) rows.push({ f, total: ids.length, dead, rawDead })
}
const withDead = rows.filter((r) => r.dead.length)
withDead.sort((a, b) => b.dead.length - a.dead.length)
const rawTotal = rows.reduce((n, r) => n + r.rawDead.length, 0)
const totalDead = withDead.reduce((n, r) => n + r.dead.length, 0)
console.log(`  detectors examined                     : ${detectors.length}`)
console.log(`  RAW: ids matching no producer literal  : ${rawTotal}  across ${rows.length} files`)
console.log(`  minus TEMPLATE-GENERATED and SELF-RENDERED: -${rawTotal - totalDead}`)
console.log(`  = UNEXPLAINED dead references          : ${totalDead}  across ${withDead.length} files`)
console.log(`  (three false-positive classes were removed on reading the output:`)
console.log(`   libraries, template-built ids, and a detector's own fixtures.)\n`)
for (const r of withDead.slice(0, 18))
  console.log(`  ${String(r.dead.length).padStart(3)} of ${String(r.total).padEnd(3)}  ${r.f}\n        ${r.dead.slice(0, 6).join(', ')}${r.dead.length > 6 ? ' ...' : ''}`)
if (withDead.length > 18) console.log(`\n  ... and ${withDead.length - 18} more files, NOT LISTED - bounded, and said rather than silently truncated.`)
if (!calOk) process.exit(2)
