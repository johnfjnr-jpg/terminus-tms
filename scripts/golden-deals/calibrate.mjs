// Calibration for scripts/golden-deals-check, per Verification 9 and 44.
//
//   node scripts/golden-deals/calibrate.mjs
//
// Snapshots keyed on the FULL PATH, asserted present before any injection,
// in-flight marker so a killed run cannot bless its wreckage, restore compared
// byte for byte after EVERY case, every stop path restores before it exits,
// and a final reverted run.
//
// SCORED ON WHICH CHECK FIRED, not on the exit code. Verification 9's clause: a
// red run and a red run look the same, and an injection that kills the harness
// early reports FIRED while proving nothing.
//
// ── REBUILT 2026-11-15, GOLDEN_STATUS ROUND. IT HAD BEEN DEAD SINCE ee177d8 ──
//
// The previous version could not run from 2026-09-30: G5 made the G1 coupling
// anchor `structure: 'single'` occur twice, and the status cases anchored on a
// file-wide `"status": "CONFIRMED"` that R-TL1a's recompute had removed. The
// gate's comment went on saying "five injections, five fired" for six weeks.
// Verification 9, twice over: a calibration anchored on the state it watches
// stops being calibrated the day that state changes, and a detector nothing
// schedules rots while its silence reads like its success.
//
// So anchors are now either (a) built from the deal they target, carrying that
// deal's own title or id so they cannot match another deal, or (b) checked for
// uniqueness by `inject`, which refuses rather than guessing.
import { readFileSync, writeFileSync, existsSync, unlinkSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { paths, buildCases, CalibrationPrecondition } from './calibration-cases.mjs'

const ROOT = process.cwd()
const SP = process.env.TMS_SCRATCH ?? mkdtempSync(join(tmpdir(), 'tms-golden-cal-'))
const MARKER = `${SP}/GOLDENS-CALIBRATION-IN-FLIGHT`

// The paths and the cases live in calibration-cases.mjs, which the pure suite
// also reads to assert every anchor is unique (calibration-anchors.test.mjs).
const P = paths(ROOT)
const FILES = Object.values(P)
const snapPath = (f) => `${SP}/snap_${f.slice(1).replace(/\//g, '_')}`

if (existsSync(MARKER)) {
  console.error(`REFUSING: ${MARKER} exists, a previous run did not restore.`)
  process.exit(3)
}
const original = new Map()
for (const f of FILES) {
  const bytes = readFileSync(f)
  original.set(f, bytes)
  writeFileSync(snapPath(f), bytes)
  if (!existsSync(snapPath(f))) { console.error(`no snapshot for ${f}`); process.exit(3) }
}
writeFileSync(MARKER, FILES.join('\n'))

const restoreAll = () => {
  for (const f of FILES) {
    writeFileSync(f, original.get(f))
    if (Buffer.compare(readFileSync(f), original.get(f)) !== 0) {
      console.error(`RESTORE MISMATCH on ${f}. Marker left in place deliberately.`)
      process.exit(3)
    }
  }
}
// EVERY STOP RESTORES FIRST. process.exit does not run a finally (Verification
// 44's Test Bed units clause), so a stop is itself a restore path.
const stop = (msg) => { restoreAll(); unlinkSync(MARKER); console.error(msg); process.exit(3) }

const exec = (bin, args) => {
  const t0 = Date.now()
  try {
    const out = execFileSync(bin, args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    return { code: 0, out, ms: Date.now() - t0 }
  } catch (e) { return { code: e.status ?? -1, out: (e.stdout ?? '') + (e.stderr ?? ''), ms: Date.now() - t0 } }
}
const harness = () => exec('node', ['scripts/golden-deals-check'])
const compute = () => exec('node', ['scripts/golden-deals/compute.mjs'])
const echoTest = () => exec('node', ['--test', 'scripts/tests/stage-echo.test.mjs'])
const gate = () => exec('node', ['scripts/verify-all.mjs'])

/** Replace exactly once in the CURRENT bytes, or stop. */
const inject = (file, anchor, replacement) => {
  if (!original.has(file)) stop(`REFUSING: ${file} is injected into but is not in FILES, so it has no snapshot.`)
  const src = readFileSync(file, 'utf8')
  const hits = src.split(anchor).length - 1
  if (hits !== 1) stop(`anchor x${hits} in ${file}, need 1:\n${anchor}`)
  writeFileSync(file, src.replace(anchor, replacement))
  // THE WRITE SIDE: confirm the edit landed before anything measures it.
  if (readFileSync(file, 'utf8') === src) stop(`injection into ${file} did not change it`)
}

// The cases, built from the committed bytes snapshotted above. A precondition
// failure is a stop, and a stop restores.
let CASES
try {
  ;({ CASES } = buildCases(P, original.get(P.expect).toString('utf8'), { harness, compute, echoTest, gate }))
} catch (e) {
  // ANY failure to build is a stop, not only a precondition: a throw here
  // would otherwise exit with the marker set and nothing restored.
  stop(e instanceof CalibrationPrecondition ? `PRECONDITION: ${e.message}` : `could not build the cases: ${e.stack}`)
}

console.log('=== 0. HEALTHY ===')
const healthy = harness()
console.log(`exit ${healthy.code}  ${healthy.ms}ms  ${/^PASS: /m.test(healthy.out) ? 'GREEN' : 'NOT GREEN'}`)
if (healthy.code !== 0) { console.log(healthy.out); stop('healthy run is not green, refusing to calibrate') }

let allFired = true
for (const [i, c] of CASES.entries()) {
  for (const [f, a, p] of c.edits) inject(f, a, p)
  const r = (c.run ?? harness)()
  const fired = c.expect(r.out)
  if (!fired) allFired = false
  console.log(`\n=== ${i + 1}. ${c.name} ===`)
  console.log(`exit ${r.code}  ${r.ms}ms  ${fired ? (c.healthy ? 'WITNESSED as expected' : 'FIRED as expected') : '*** DID NOT FIRE THE EXPECTED CHECK ***'}`)
  for (const line of r.out.split('\n').filter((l) => /FAIL|ECHO MISSING|KEPT|RESET|^after:|✖/.test(l))) console.log(`   ${line.trim()}`)
  if (!fired) console.log(r.out)
  restoreAll()
}

console.log('\n=== FINAL REVERTED RUN ===')
const rev = harness()
const green = rev.code === 0 && /^PASS: /m.test(rev.out)
let identical = true
for (const f of FILES) if (Buffer.compare(readFileSync(f), original.get(f)) !== 0) identical = false
console.log(`exit ${rev.code}  ${rev.ms}ms  ${green ? 'GREEN' : 'NOT GREEN'}   bytes identical: ${identical}`)

unlinkSync(MARKER)
console.log(`\n${allFired && green && identical ? `CALIBRATED: ${CASES.length} of ${CASES.length} fired, reverted green, every file byte-identical.` : 'CALIBRATION FAILED.'}`)
process.exit(allFired && green && identical ? 0 : 1)
