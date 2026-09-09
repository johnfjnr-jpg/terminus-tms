// Calibrating the widget half of the door, both directions.
//
// The check is the CENSUS, not probe-readonly-view: the probe's enumeration is
// an allowlist that cannot see a div with a handler, which is the exact class
// this fix exists to neutralise. Using it here would be a calibration that
// cannot fail.
//
// HARNESS DISCIPLINE (Verification 44): byte snapshot keyed by full path,
// asserted present before injecting; byte comparison after every injection,
// stopping dead on mismatch; an in-flight marker so a killed run cannot bless
// its own damage; a final reverted run. Never git checkout as the restore.
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'fs'
import { execFileSync } from 'child_process'
import { createHash } from 'crypto'

const ROOT = '/Users/johnfryatt/terminus-tms'
const SNAP = process.env.SNAPDIR
const INFLIGHT = `${SNAP}/IN_FLIGHT`
const FILES = ['frontend/app.js']
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')
const key = (f) => `${SNAP}/${f.replace(/\//g, '_')}`

mkdirSync(SNAP, { recursive: true })
if (existsSync(INFLIGHT)) {
  console.error(`REFUSING: ${INFLIGHT} exists, so a previous run died mid-injection.`)
  console.error(`Restore from ${SNAP} by hand before running again.`)
  process.exit(2)
}
for (const f of FILES) {
  writeFileSync(key(f), readFileSync(`${ROOT}/${f}`))
  if (!existsSync(key(f))) { console.error(`snapshot failed for ${f}`); process.exit(2) }
}
const ORIG = Object.fromEntries(FILES.map((f) => [f, sha(`${ROOT}/${f}`)]))
writeFileSync(INFLIGHT, new Date().toISOString())

// The census is a browser run; it needs the same env the probes need.
const runCensus = () => {
  const started = Date.now()
  let out = ''
  try {
    out = execFileSync('node', ['--env-file=.env', 'scripts/ui-hygiene/census-door.mjs'],
      { cwd: ROOT, encoding: 'utf8', timeout: 300000,
        env: { ...process.env, PUPPETEER_PATH: '/tmp/tms-probe/node_modules/puppeteer' } })
  } catch (e) { out = `${e.stdout ?? ''}${e.stderr ?? ''}` }
  const ms = Date.now() - started
  // Verification 48: a run that produced no parseable result has NOT run and
  // must never be scored.
  const m = out.match(/REACHABLE write controls\s+(\d+)\s+(\d+)/)
  const mouse = out.match(/reachable by MOUSE\s+(\d+)\s+(\d+)/)
  if (!m) return { notMine: null, mine: null, mouse: null, ms, out }
  return { notMine: Number(m[1]), mine: Number(m[2]), mouse: mouse ? Number(mouse[1]) : null, ms, out }
}

const restore = (label) => {
  for (const f of FILES) {
    writeFileSync(`${ROOT}/${f}`, readFileSync(key(f)))
    if (sha(`${ROOT}/${f}`) !== ORIG[f]) {
      console.error(`\nSTOP: restore of ${f} did not match after "${label}". Snapshot at ${key(f)}.`)
      process.exit(2)
    }
  }
}

const inject = (f, from, to, label) => {
  const p = `${ROOT}/${f}`
  const src = readFileSync(p, 'utf8')
  const n = src.split(from).length - 1
  if (n !== 1) {
    console.error(`\nSTOP: anchor for "${label}" occurs ${n} times in ${f}; it must be unique.`)
    restore(label); rmSync(INFLIGHT, { force: true }); process.exit(2)
  }
  writeFileSync(p, src.replace(from, to))
}

console.log('DIRECTION ONE: the healthy tree\n')
const healthy = runCensus()
if (healthy.notMine === null) {
  console.error(`STOP: the census produced no parseable result in ${healthy.ms}ms. Not scored.`)
  console.error(healthy.out.slice(-600))
  restore('healthy'); rmSync(INFLIGHT, { force: true }); process.exit(2)
}
console.log(`  healthy   not-mine ${healthy.notMine} reachable, mouse ${healthy.mouse}, own record ${healthy.mine}  ${healthy.ms}ms`)

console.log('\nDIRECTION TWO: the widget neutralisation removed\n')
inject('frontend/app.js',
  "    const isWidget = (role && WIDGET_ROLES.has(role)) || (ti !== null && Number(ti) >= 0) || inlineHandler",
  "    const isWidget = false",
  'the widget rule is removed')
const broken = runCensus()
restore('the widget rule is removed')

if (broken.notMine === null) {
  console.error(`STOP: the injected census produced no parseable result in ${broken.ms}ms. Not scored.`)
  rmSync(INFLIGHT, { force: true }); process.exit(2)
}
console.log(`  injected  not-mine ${broken.notMine} reachable, mouse ${broken.mouse}, own record ${broken.mine}  ${broken.ms}ms`)

console.log('\nDIRECTION TWO-B: the container kill, reinstated\n')
// ── A REGRESSION CAUGHT ONCE BY LUCK IS CAUGHT FOREVER BY CALIBRATION ────
//
// The first widget rule matched `tabindex >= 0`. Tab panels carry tabindex="0"
// as a focus affordance, so it marked #opp-tab-commercial inert and
// pointer-events:none INHERITED across the whole panel: every control inside
// it, the disclosure toggle that must stay alive, and the panel's own tab stop.
//
// It also FLATTERED THE HEADLINE: "mouse reachable 0" was partly a blanket
// container kill rather than controls being treated. It was found by walking
// one dead control's ancestor chain, which is luck. This injection is what
// makes it not luck.
inject('frontend/app.js',
  '    if (el.querySelector(NATIVE_CONTROL_SELECTOR)) continue',
  '    if (false) continue',
  'the container exclusion is removed')
const containerKill = runCensus()
const panelState = containerKill.out.match(/disclosure and help \(must stay alive\)\s+(\d+)\s+(\d+)/)
restore('the container exclusion is removed')
if (containerKill.notMine === null) {
  console.error(`STOP: the injected census produced no parseable result in ${containerKill.ms}ms.`)
  rmSync(INFLIGHT, { force: true }); process.exit(2)
}
console.log(`  container kill  not-mine ${containerKill.notMine} reachable, mouse ${containerKill.mouse}, ` +
  `disclosure still alive ${panelState ? panelState[1] : '?'}  ${containerKill.ms}ms`)

console.log('\nDIRECTION THREE: reverted\n')
const reverted = runCensus()
console.log(`  reverted  not-mine ${reverted.notMine} reachable, mouse ${reverted.mouse}, own record ${reverted.mine}  ${reverted.ms}ms`)

let ok = true
for (const f of FILES) {
  const same = sha(`${ROOT}/${f}`) === ORIG[f]
  console.log(`\n  ${f} byte-identical to its snapshot: ${same}`)
  if (!same) ok = false
}
rmSync(INFLIGHT, { force: true })

const fired = broken.notMine > healthy.notMine
const recovered = reverted.notMine === healthy.notMine
// THE CONTAINER KILL IS DETECTED BY THE DISCLOSURE COUNT, not by the reachable
// count: killing a panel makes FEWER controls reachable, which looks like an
// improvement. What it destroys is the read affordances that must stay alive.
const healthyDisc = (healthy.out.match(/disclosure and help \(must stay alive\)\s+(\d+)/) ?? [])[1]
const killedDisc = panelState ? panelState[1] : null
const containerCaught = killedDisc !== null && healthyDisc !== undefined && Number(killedDisc) < Number(healthyDisc)
console.log(`\n  FIRED (removing the rule makes more reachable): ${fired}  (${healthy.notMine} -> ${broken.notMine})`)
console.log(`  CONTAINER KILL CAUGHT (disclosure dies):        ${containerCaught}  (${healthyDisc} -> ${killedDisc})`)
console.log(`  RECOVERED (revert returns the healthy number):  ${recovered}  (${reverted.notMine})`)
console.log(`  own record unchanged across all three:          ${healthy.mine === broken.mine && broken.mine === reverted.mine}`)
process.exit(ok && fired && recovered && containerCaught ? 0 : 1)
