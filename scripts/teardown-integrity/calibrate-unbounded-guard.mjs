// Calibrating the unbounded-select guard, both directions.
//
// Harness discipline per Verification 44: byte snapshots keyed by FULL PATH
// (this estate mirrors basenames across src/lib and src/routes on purpose),
// snapshot asserted present before any injection, bytes compared after EVERY
// injection with a hard stop on mismatch, an in-flight marker so a killed run
// cannot bless its own wreckage as the next run's baseline, and a final
// reverted run - the line that has caught a broken harness four times here.
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'

const ROOT = '/Users/johnfryatt/terminus-tms'
const SNAP = process.env.SNAPDIR
if (!SNAP) { console.error('REFUSING: SNAPDIR is unset, so there is nowhere to snapshot to.'); process.exit(2) }
const INFLIGHT = `${SNAP}/IN_FLIGHT`
const FILES = [
  'scripts/lib/unbounded-selects.mjs',
  'scripts/lib/unbounded-select-allowlist.mjs',
  'scripts/probe-version-order.mjs',
]
const key = (f) => `${SNAP}/${f.replace(/\//g, '_')}`
const sha = (f) => createHash('sha256').update(readFileSync(`${ROOT}/${f}`)).digest('hex')

mkdirSync(SNAP, { recursive: true })
if (existsSync(INFLIGHT)) {
  console.error(`REFUSING: ${INFLIGHT} exists, so a previous run died mid-injection.`)
  console.error(`Restore from ${SNAP} by hand; otherwise the wreckage is snapshotted as the original.`)
  process.exit(2)
}
for (const f of FILES) {
  writeFileSync(key(f), readFileSync(`${ROOT}/${f}`))
  if (!existsSync(key(f))) { console.error(`snapshot failed for ${f}`); process.exit(2) }
}
const ORIG = Object.fromEntries(FILES.map((f) => [f, sha(f)]))
writeFileSync(INFLIGHT, new Date().toISOString())

const run = () => {
  const t0 = Date.now()
  let out = ''
  try {
    out = execFileSync('node', ['--test', 'scripts/tests/no-unbounded-select.test.mjs'],
      { cwd: ROOT, encoding: 'utf8', timeout: 120000 })
  } catch (e) { out = `${e.stdout ?? ''}${e.stderr ?? ''}` }
  const m = out.match(/^. fail (\d+)/m)
  // Verification 48: a run with no parseable result has NOT run and is never
  // scored as "failed, therefore caught".
  return { fail: m ? Number(m[1]) : null, ms: Date.now() - t0, out }
}
const restore = (label) => {
  for (const f of FILES) {
    writeFileSync(`${ROOT}/${f}`, readFileSync(key(f)))
    if (sha(f) !== ORIG[f]) {
      console.error(`\nSTOP: restore of ${f} did not match after "${label}". Snapshot: ${key(f)}`)
      process.exit(3)
    }
  }
}
const edit = (f, from, to) => {
  const p = `${ROOT}/${f}`
  const s = readFileSync(p, 'utf8')
  const n = s.split(from).length - 1
  if (n !== 1) { console.error(`anchor in ${f} occurs ${n} times, must be unique`); process.exit(2) }
  writeFileSync(p, s.replace(from, to))
}
const append = (f, text) => writeFileSync(`${ROOT}/${f}`, readFileSync(`${ROOT}/${f}`, 'utf8') + text)

// A dead function: never called, so the probe's behaviour is untouched, but the
// scanner is static and sees it exactly as it would see a real one.
const NEW_SELECT = `
async function __calibrationOnlyNeverCalled(db) {
  return await db.from('records').select('id, record_type').eq('record_type', 'opportunity')
}
`
const INJECTIONS = [
  { name: 'a NEW unbounded select appears in a gate-run file',
    expect: 'no unbounded select outside the measured allowlist',
    go: () => append('scripts/probe-version-order.mjs', NEW_SELECT) },

  { name: 'R7\'s own scenario: the new select is ADDED to the allowlist',
    expect: 'SHRINK-ONLY',
    go: () => {
      append('scripts/probe-version-order.mjs', NEW_SELECT)
      edit('scripts/lib/unbounded-select-allowlist.mjs', 'export const ALLOWED = [',
        "export const ALLOWED = [\n  'scripts/probe-version-order.mjs::records::0',")
    } },

  { name: 'the allowlist keeps an entry the tree no longer has',
    expect: 'no stale entries',
    go: () => edit('scripts/lib/unbounded-select-allowlist.mjs', 'export const ALLOWED = [',
      "export const ALLOWED = [\n  'scripts/gone.mjs::records::0',")
      || edit('scripts/lib/unbounded-select-allowlist.mjs', 'export const CEILING = 41', 'export const CEILING = 42') },

  { name: 'the file walk stops finding anything (a vacuous green)',
    expect: 'so a zero would be a measurement',
    go: () => edit('scripts/lib/unbounded-selects.mjs',
      "      if (gate.includes(base) || suiteText.includes(base)) out.push(p)",
      "      if (false && (gate.includes(base) || suiteText.includes(base))) out.push(p)") },
]

const base = run()
console.log(`  healthy    fail=${base.fail}  ${base.ms}ms  ${base.fail === 0 ? 'GREEN' : 'NOT GREEN - stopping'}`)
if (base.fail !== 0) { restore('baseline'); rmSync(INFLIGHT); process.exit(2) }

let allFired = true
for (const inj of INJECTIONS) {
  inj.go()
  const r = run()
  const fired = r.fail !== null && r.fail > 0 && r.out.includes(inj.expect)
  console.log(`  ${fired ? 'FIRED  ' : r.fail === null ? 'NO RESULT' : 'SILENT '}  fail=${r.fail}  ${String(r.ms).padStart(5)}ms  ${inj.name}`)
  if (!fired) {
    allFired = false
    console.log(`           expected the failure to name: ${inj.expect}`)
  }
  restore(inj.name)
}
const end = run()
console.log(`  reverted   fail=${end.fail}  ${end.ms}ms  ${end.fail === 0 ? 'GREEN' : 'RED'}`)
let identical = true
for (const f of FILES) if (sha(f) !== ORIG[f]) { identical = false; console.log(`  ${f} NOT byte-identical`) }
console.log(`\n  ${INJECTIONS.filter(Boolean).length} injections; all fired: ${allFired}; files byte-identical: ${identical}`)
rmSync(INFLIGHT)
process.exit(allFired && end.fail === 0 && identical ? 0 : 1)
