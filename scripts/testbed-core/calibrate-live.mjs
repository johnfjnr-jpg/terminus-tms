// ── CALIBRATE A LIVE PROBE ON A DELIBERATELY BROKEN, SERVED BUNDLE ────────
//
// The generalised form of calibrate-p1-live.mjs and calibrate-p2-live.mjs,
// made for Round A Phase 3 so a third copy of the harness was not pasted.
// A SPEC names the probe, a run label, and injections (file, find, replace,
// and the probe check each must make FAIL). The injections go into the source,
// the bundle is rebuilt and served, the probe runs, and each injection is
// scored by whether its NAMED check failed.
//
// Then every touched source file and the committed bundle are restored from
// byte snapshots and must be byte-identical, because an injected bundle left
// behind would ship (Verification 44). An in-flight marker refuses a rerun
// after a killed one.
//
// UNWIRED. Run: node --env-file=.env scripts/testbed-core/calibrate-live.mjs scripts/testbed-core/live-specs/<spec>.mjs
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const ROOT = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '')
const specPath = process.argv[2]
if (!specPath) { console.error('usage: calibrate-live.mjs <spec module>'); process.exit(2) }
const spec = (await import(pathToFileURL(resolve(ROOT, specPath)).href)).default
const DIST = `${ROOT}/frontend-react/dist/terminus-react.js`
const WORK = `${ROOT}/.verify/tb-core/calib-live-${spec.run}`
const MARKER = `${WORK}/IN-FLIGHT`
// ── A STOP AFTER AN INJECTION RESTORES BEFORE IT EXITS. Ruling R12 ────────
//
// `stop()` calls process.exit, and process.exit does NOT run a finally block.
// So every stop between the first injection and the end of the try left the
// injected source on disk: measured 2026-09-18, a server-only injection tripped
// "the bundle did not change", exited 3, and left src/routes/test-beds.js
// mutated. The dev server runs under --watch, so the mutation went live, and the
// next spec's run measured a server that had a ruling disabled.
//
// `armDisarm` is set once the snapshots exist. From then on a stop restores from
// those snapshots, proves the restore byte-identical, and only then removes the
// marker and reports the stop. If the restore does NOT match, the marker stays
// and the message says so: a mismatch is the one case where leaving the marker
// is the right answer (Verification 44).
let armDisarm = null
const stop = (m) => {
  console.error(`STOPPED: ${m}`)
  if (armDisarm) {
    try { armDisarm() } catch (e) {
      console.error(`AND THE RESTORE FAILED: ${e.message}`)
      console.error(`  the injection may still be on disk; restore from ${WORK} by hand`)
      process.exit(4)
    }
  }
  process.exit(3)
}

if (existsSync(MARKER)) stop(`${MARKER} exists; restore from ${WORK} first`)
mkdirSync(WORK, { recursive: true })

// ── PRECONDITION: THE BUNDLE IS FRESH FOR THE SOURCE, BEFORE ANYTHING ─────
//
// Found by this harness's own restore check, the first time the p3-buyers spec
// ran: a source file had changed after the last build, so the "pre-calibration"
// bundle was stale, and rebuilding the RESTORED source could never reproduce it.
// The restore check stopped correctly, but only after an injected run. Asked
// here instead, so a stale bundle refuses before anything is injected.
{
  const fresh = spawnSync('node', ['scripts/check-dist-fresh.mjs'], { cwd: ROOT, encoding: 'utf8' })
  if (fresh.status !== 0) stop(`the committed bundle is not fresh for its source; build first.\n${fresh.stdout}${fresh.stderr}`)
}
const files = [...new Set(spec.injections.map((i) => `${ROOT}/${i.file}`))]
const snap = new Map([[DIST, readFileSync(DIST)], ...files.map((f) => [f, readFileSync(f)])])
for (const [f, b] of snap) {
  const copy = `${WORK}/${f.replaceAll('/', '_')}.snapshot`
  writeFileSync(copy, b)
  if (!readFileSync(copy).equals(b)) stop(`snapshot of ${f} did not write`)
}
writeFileSync(MARKER, new Date().toISOString())

// R12: from here on, any stop restores. The bundle is restored from its BYTES
// rather than rebuilt, because a stop may be a failed build, and the bytes are
// what the snapshot holds.
armDisarm = () => {
  for (const [f, b] of snap) writeFileSync(f, b)
  for (const [f, b] of snap) {
    if (!readFileSync(f).equals(b)) throw new Error(`restore of ${f} is not byte-identical`)
  }
  rmSync(MARKER)
  console.error('  restored from the snapshots, byte-identical; marker removed')
}

const build = () => { const r = spawnSync('npm', ['run', 'build:react'], { cwd: ROOT, encoding: 'utf8' }); if (r.status !== 0) stop(`build failed: ${r.stderr}`) }
let probeOut = ''
try {
  const texts = new Map(files.map((f) => [f, snap.get(f).toString('utf8')]))
  for (const i of spec.injections) {
    const f = `${ROOT}/${i.file}`
    const t = texts.get(f)
    const n = t.split(i.find).length - 1
    if (n !== 1) stop(`anchor ${i.id} occurs ${n} times in ${i.file}`)
    texts.set(f, t.replace(i.find, i.replace))
  }
  for (const f of files) {
    writeFileSync(f, texts.get(f))
    if (readFileSync(f).equals(snap.get(f))) stop(`injection into ${f} did not land`)
  }
  build()
  if (readFileSync(DIST).equals(snap.get(DIST))) stop('the bundle did not change, so the injected build is not what will be served')
  console.log(`injected ${spec.injections.length} fault(s) built into the served bundle`)
  const t0 = Date.now()
  const r = spawnSync('node', ['--env-file=.env', spec.probe], {
    cwd: ROOT, encoding: 'utf8', env: { ...process.env, TBCORE_RUN: `${spec.run}-injected` }, timeout: 580000 })
  probeOut = `${r.stdout}${r.stderr}`
  writeFileSync(`${WORK}/probe-injected.txt`, probeOut)
  console.log(`probe on the injected bundle: exit ${r.status}, ${Date.now() - t0}ms`)
} finally {
  // The normal path REBUILDS and compares, which proves the restored source
  // produces the committed bundle rather than only that the bytes were put back.
  // A stop takes the shorter route above, because a stop may BE a failed build.
  //
  // DISARMED FIRST: a stop raised from inside this block means the restore here
  // failed, and its own message says the marker is left. Leaving the arm set
  // would have the stop restore again and remove the marker, which is the one
  // case where the marker must stay.
  armDisarm = null
  for (const f of files) writeFileSync(f, snap.get(f))
  for (const f of files) if (!readFileSync(f).equals(snap.get(f))) stop(`restore of ${f} is not byte-identical; marker left`)
  build()
  if (!readFileSync(DIST).equals(snap.get(DIST))) stop('the rebuilt bundle is NOT byte-identical to the pre-calibration bundle; marker left')
  rmSync(MARKER)
  console.log('sources and committed bundle restored byte-identical; marker removed')
}

for (const l of probeOut.split('\n').filter((l) => /  (PASS|FAIL)  |checks PASS|teardown/.test(l))) console.log(l)
const fails = probeOut.split('\n').filter((l) => l.includes('  FAIL  '))
let bad = 0
for (const i of spec.injections) {
  const fired = i.expect.every((e) => fails.some((l) => l.includes(e)))
  if (!fired) bad++
  console.log(`${fired ? 'FIRED ' : 'SILENT'}  ${i.id}: ${i.expect.map((e) => `"${e}"`).join(' + ')}`)
}
process.exit(bad ? 1 : 0)
