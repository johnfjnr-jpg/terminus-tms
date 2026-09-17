// ── CALIBRATE COMPONENT AND HOST TESTS, BOTH DIRECTIONS, FROM A SPEC ──────
//
// The generalised form of calibrate-p1.mjs and calibrate-p2.mjs, made for Round
// A Phase 3 so the harness is not copied a third time. A SPEC names the test
// files and injections (file, find, replace, the test titles each must make
// fail). Each injection breaks ONE behaviour, runs the named test files, and is
// scored by WHICH TEST FAILED, never by exit code. The silent direction is the
// final reverted run of the whole React suite.
//
// Protections (Verification 44): refuses to start over an in-flight marker;
// byte snapshots keyed by full path; an anchor must occur exactly once; the
// injection must land before anything is measured; bytes compared after every
// restore, stopping dead on a mismatch.
//
// UNWIRED: it rewrites source while it runs.
// Run: node scripts/testbed-core/calibrate-unit.mjs scripts/testbed-core/unit-specs/<spec>.mjs
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const ROOT = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '')
const FE = `${ROOT}/frontend-react`
const specPath = process.argv[2]
if (!specPath) { console.error('usage: calibrate-unit.mjs <spec module>'); process.exit(2) }
const spec = (await import(pathToFileURL(resolve(ROOT, specPath)).href)).default
const WORK = `${ROOT}/.verify/tb-core/calib-unit-${spec.name}`
const MARKER = `${WORK}/IN-FLIGHT`
const stop = (msg) => { console.error(`\nSTOPPED: ${msg}`); process.exit(3) }

if (existsSync(MARKER)) stop(`${MARKER} exists: a previous run was killed. Restore from ${WORK}/snapshots and delete the marker.`)
mkdirSync(`${WORK}/snapshots`, { recursive: true })
const files = [...new Set(spec.injections.map((i) => `${ROOT}/${i.file}`))]
const snap = new Map()
for (const f of files) {
  const bytes = readFileSync(f)
  snap.set(f, bytes)
  const copy = `${WORK}/snapshots/${f.replaceAll('/', '_')}`
  writeFileSync(copy, bytes)
  if (!readFileSync(copy).equals(bytes)) stop(`snapshot of ${f} did not write`)
}
writeFileSync(MARKER, new Date().toISOString())
console.log(`snapshotted ${files.length} files; marker written`)

const runTests = (label) => {
  const out = `${WORK}/${label.replace(/[^A-Za-z0-9]+/g, '_')}.json`
  rmSync(out, { force: true })
  const t0 = Date.now()
  const r = spawnSync('npx', ['vitest', 'run', ...spec.testFiles, '--reporter=json', `--outputFile=${out}`], { cwd: FE, encoding: 'utf8' })
  const ms = Date.now() - t0
  if (!existsSync(out)) return { ms, exit: r.status, failed: null, raw: `${r.stdout}${r.stderr}`.slice(-800) }
  const j = JSON.parse(readFileSync(out, 'utf8'))
  const all = j.testResults.flatMap((f) => f.assertionResults)
  return { ms, exit: r.status, total: all.length, failed: all.filter((a) => a.status !== 'passed').map((a) => a.title),
    suiteError: j.testResults.map((f) => f.message).filter(Boolean).join(' | ') }
}

const rows = []
try {
  const base = runTests('baseline')
  if (base.failed === null || base.failed.length) stop(`baseline is not green: ${JSON.stringify(base)}`)
  console.log(`baseline: ${base.total} tests across ${spec.testFiles.length} files, 0 failed, ${base.ms}ms`)
  for (const inj of spec.injections) {
    const file = `${ROOT}/${inj.file}`
    const now = readFileSync(file)
    if (!now.equals(snap.get(file))) stop(`${inj.file} differs from its snapshot before ${inj.id}`)
    const text = now.toString('utf8')
    const count = text.split(inj.find).length - 1
    if (count !== 1) stop(`anchor for ${inj.id} occurs ${count} times, not once`)
    writeFileSync(file, text.replace(inj.find, inj.replace))
    if (readFileSync(file, 'utf8') === text) stop(`injection ${inj.id} did not change the file`)
    let res
    try { res = runTests(inj.id) } finally {
      writeFileSync(file, snap.get(file))
      if (!readFileSync(file).equals(snap.get(file))) stop(`restore of ${inj.file} after ${inj.id} is not byte-identical`)
    }
    if (res.failed === null) stop(`${inj.id} produced no result in ${res.ms}ms (exit ${res.exit}): ${res.raw}`)
    const hit = inj.expect.filter((e) => res.failed.some((t) => t.includes(e)))
    const verdict = res.failed.length === 0 ? 'SILENT'
      : (inj.expect.length && hit.length === inj.expect.length ? 'FIRED' : 'FIRED-ELSEWHERE')
    rows.push({ id: inj.id, verdict })
    console.log(`${verdict.padEnd(16)} ${inj.id}  expected ${hit.length}/${inj.expect.length}, ${res.failed.length} failed, ${res.ms}ms`)
    for (const t of res.failed) console.log(`                   x ${t}`)
    if (res.suiteError) console.log(`                   suite error: ${res.suiteError.slice(0, 200)}`)
  }
} finally {
  for (const [f, bytes] of snap) {
    if (!readFileSync(f).equals(bytes)) writeFileSync(f, bytes)
    if (!readFileSync(f).equals(bytes)) { console.error(`FINAL RESTORE FAILED for ${f}; marker left`); process.exit(4) }
  }
  rmSync(MARKER, { force: true })
  console.log('all targets byte-identical to their snapshots; marker removed')
}

const t0 = Date.now()
const full = spawnSync('npx', ['vitest', 'run'], { cwd: FE, encoding: 'utf8' })
const summary = `${full.stdout}${full.stderr}`.split('\n').filter((l) => /Test Files|Tests /.test(l)).join(' | ')
console.log(`\nREVERTED full React suite: exit ${full.status}, ${Date.now() - t0}ms  ${summary.trim()}`)
const notFired = rows.filter((r) => r.verdict !== 'FIRED')
console.log(`\n${rows.length - notFired.length}/${rows.length} FIRED on their named tests; not: ${notFired.map((r) => `${r.id}=${r.verdict}`).join(', ') || 'none'}`)
process.exit(full.status === 0 && notFired.length === 0 ? 0 : 1)
