// PERF ROUND: THE GUARD, INJECTED AND WATCHED
//
// Verification 9: a detector not proven capable of failing is not evidence.
// The brief asks for the request count to be calibrated BY UN-DEDUPLICATING,
// which is what these three do, each removing a different half of the
// sharing.
//
// ── THE HARNESS'S OWN SAFETY ────────────────────────────────────────────
//
// Snapshots keyed by FULL PATH, asserted to exist before anything is
// injected, every restore compared byte for byte, and an in-flight marker
// that REFUSES a run finding the wreckage of a killed one rather than
// snapshotting it as the original. `stop()` restores before it exits,
// because `process.exit` does not run a `finally`.
//
// THE VERDICT READS WHICH CHECK FAILED, never the exit code: an injection
// that kills a probe early goes red without reaching the assertion it was
// written for, and two red runs look identical.
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'node:fs'
import { execSync } from 'node:child_process'

const ROOT = '/Users/johnfryatt/terminus-tms'
const SNAP = `${ROOT}/.verify/perf1/snap`
mkdirSync(SNAP, { recursive: true })
const MARKER = `${SNAP}/IN-FLIGHT`
const key = (f) => f.replaceAll('/', '_')

if (existsSync(MARKER)) {
  console.error(`REFUSING: ${MARKER} exists, so a previous run was killed mid-injection.`)
  console.error(`Restore by hand from ${SNAP}, then remove the marker.`)
  process.exit(3)
}

const FILES = [
  'frontend/app.js',
  'frontend-react/src/data/contacts.ts',
  'frontend-react/src/reference/KeyContacts.tsx',
]
const orig = {}
for (const f of FILES) {
  orig[f] = readFileSync(`${ROOT}/${f}`, 'utf8')
  writeFileSync(`${SNAP}/${key(f)}`, orig[f])
}
for (const f of FILES) {
  if (!existsSync(`${SNAP}/${key(f)}`)) { console.error(`no snapshot for ${f}`); process.exit(3) }
}
writeFileSync(MARKER, new Date().toISOString())

const restore = () => { for (const f of FILES) writeFileSync(`${ROOT}/${f}`, orig[f]) }
const verify = () => FILES.find((f) => readFileSync(`${ROOT}/${f}`, 'utf8') !== orig[f]) ?? null
const run = (cmd) => {
  try { return { out: execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: process.env }), code: 0 } }
  catch (e) { return { out: `${e.stdout ?? ''}${e.stderr ?? ''}`, code: e.status ?? 1 } }
}
const stop = (code, why) => {
  restore(); run('npm run build:react')
  const bad = verify()
  if (bad) { console.error(`RESTORE FAILED on ${bad}; marker kept at ${MARKER}`); process.exit(4) }
  unlinkSync(MARKER); console.error(why); process.exit(code)
}

const PROBE = 'node --env-file=.env scripts/perf1/probe-one-fetch.mjs'
const firedOn = (out, name) => {
  const lines = out.split('\n')
  const hit = lines.find((l) => l.includes(name) && l.trim().startsWith('FAIL'))
  return { fired: !!hit, reds: lines.filter((l) => l.trim().startsWith('FAIL')).length,
    line: (hit ?? '').trim().slice(0, 110) }
}

console.log('── HEALTHY ──')
const h = run(PROBE)
if (h.code !== 0) stop(3, 'the probe is RED before any injection; nothing can be calibrated from here')
console.log('   13/13, green')

const INJ = [
  { what: 'the vanilla stops using the seam, so it fetches for itself again',
    file: 'frontend/app.js',
    from: "  const contactsCall = window.tmsContacts\n    ? window.tmsContacts({ force: !!force })\n    : api('GET', '/api/contacts')",
    to: "  const contactsCall = api('GET', '/api/contacts')",
    name: 'BOOT makes exactly ONE full-list contacts fetch' },

  { what: 'the stale window goes to zero, so nothing is shared across a load',
    file: 'frontend-react/src/data/contacts.ts',
    from: 'export const CONTACTS_STALE_MS = 30_000',
    to: 'export const CONTACTS_STALE_MS = 0',
    name: 'navigating to contacts list adds NO full-list fetch' },

  { what: "W3's picker drops its scoping and joins the full-list readers",
    file: 'frontend-react/src/reference/KeyContacts.tsx',
    from: '`${KC_ROUTES.contacts}?account_id=${encodeURIComponent(accountId)}`',
    to: 'KC_ROUTES.contacts',
    name: "W3's picker still asks for ONE account" },
]

const results = [['healthy: the guard is green before any injection', true]]
for (const inj of INJ) {
  const src = readFileSync(`${ROOT}/${inj.file}`, 'utf8')
  const n = src.split(inj.from).length - 1
  if (n !== 1) stop(3, `anchor appears ${n} times, not once: ${inj.what}`)
  writeFileSync(`${ROOT}/${inj.file}`, src.replace(inj.from, inj.to))
  const b = run('npm run build:react')
  if (b.code !== 0) { restore(); run('npm run build:react'); stop(3, `the bundle would not build under: ${inj.what}`) }
  const v = firedOn(run(PROBE).out, inj.name)
  restore()
  const rb = run('npm run build:react')
  if (rb.code !== 0) stop(4, `the bundle would not rebuild after restoring: ${inj.what}`)
  const bad = verify()
  if (bad) stop(4, `restore mismatch on ${bad} after: ${inj.what}`)
  console.log(`\n${v.fired ? 'FIRED ' : 'SILENT'}  ${inj.what}   [${v.reds} red]`)
  console.log(`        ${v.line || '(the named check did not go red)'}`)
  results.push([inj.what, v.fired])
}

console.log('\n── REVERTED ──')
const back = run(PROBE)
results.push(['green again after the revert', back.code === 0])
console.log(`   ${back.code === 0 ? '13/13, green' : 'STILL RED'}`)

console.log('')
for (const [w, ok] of results) console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${w}`)
const bad = verify()
if (bad) { console.error(`\nRESTORE MISMATCH on ${bad}`); process.exit(4) }
unlinkSync(MARKER)
const passed = results.filter(([, ok]) => ok).length
console.log(`\n${passed}/${results.length} calibration points`)
process.exit(passed === results.length ? 0 : 1)
