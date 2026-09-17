// ── ROUND A PHASE 2: CALIBRATE THE LIVE SCORE PROBE ON A BROKEN BUNDLE ────
//
// probe-p2-score.mjs passed 30/30 on its first run, which is the tell. Two
// injections go into scoring.ts, the bundle is rebuilt and served, the probe
// runs, and it is scored by WHICH named checks fail:
//
//   contract  the body key goes back to `criterion_key`   -> S5 "the real route ACCEPTED both"
//             (the B1 seam, now refused by the REAL server rather than a stub)
//   stop      the run continues past a refusal             -> S7 "the run STOPPED at the refusal"
//
// Then the source is restored from its byte snapshot, the bundle rebuilt, and
// BOTH must be byte-identical to before: the bundle is committed, so an
// injected one left behind would ship (Verification 44). In-flight marker as
// the other harnesses.
//
// UNWIRED. Run: node --env-file=.env scripts/testbed-core/calibrate-p2-live.mjs
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '')
const SRC = `${ROOT}/frontend-react/src/testbed/scoring.ts`
const DIST = `${ROOT}/frontend-react/dist/terminus-react.js`
const WORK = `${ROOT}/.verify/tb-core/calib-p2-live`
const MARKER = `${WORK}/IN-FLIGHT`
const stop = (m) => { console.error(`STOPPED: ${m}`); process.exit(3) }
const INJ = [
  { id: 'contract', find: '= { criterion: c.criterion_key, score: Number(draft) }',
    replace: '= { criterion_key: c.criterion_key, score: Number(draft) } as never',
    expect: 'the real route ACCEPTED both' },
  { id: 'stop', find: "    if (!r.ok) return { recorded, failed: { key: c.criterion_key, error: r.error ?? 'unknown error' }, refused: false }",
    replace: '    if (!r.ok) continue',
    expect: 'the run STOPPED at the refusal' },
]

if (existsSync(MARKER)) stop(`${MARKER} exists; restore from ${WORK} first`)
mkdirSync(WORK, { recursive: true })
const srcBytes = readFileSync(SRC); const distBytes = readFileSync(DIST)
writeFileSync(`${WORK}/scoring.ts.snapshot`, srcBytes)
writeFileSync(`${WORK}/terminus-react.js.snapshot`, distBytes)
if (!readFileSync(`${WORK}/scoring.ts.snapshot`).equals(srcBytes) || !readFileSync(`${WORK}/terminus-react.js.snapshot`).equals(distBytes)) stop('snapshots did not write')
writeFileSync(MARKER, new Date().toISOString())

const build = () => { const r = spawnSync('npm', ['run', 'build:react'], { cwd: ROOT, encoding: 'utf8' }); if (r.status !== 0) stop(`build failed: ${r.stderr}`) }
let probeOut = ''
try {
  let text = srcBytes.toString('utf8')
  for (const i of INJ) {
    const n = text.split(i.find).length - 1
    if (n !== 1) stop(`anchor ${i.id} occurs ${n} times`)
    text = text.replace(i.find, i.replace)
  }
  writeFileSync(SRC, text)
  if (readFileSync(SRC).equals(srcBytes)) stop('injection did not land')
  build()
  if (readFileSync(DIST).equals(distBytes)) stop('the bundle did not change, so the injected build is not what will be served')
  console.log('injected source built into the served bundle')
  const t0 = Date.now()
  const r = spawnSync('node', ['--env-file=.env', 'scripts/testbed-core/probe-p2-score.mjs'],
    { cwd: ROOT, encoding: 'utf8', env: { ...process.env, TBCORE_RUN: 'p2-score-injected' }, timeout: 500000 })
  probeOut = `${r.stdout}${r.stderr}`
  writeFileSync(`${WORK}/probe-injected.txt`, probeOut)
  console.log(`probe on the injected bundle: exit ${r.status}, ${Date.now() - t0}ms`)
} finally {
  writeFileSync(SRC, srcBytes)
  if (!readFileSync(SRC).equals(srcBytes)) stop('source restore is not byte-identical; marker left')
  build()
  if (!readFileSync(DIST).equals(distBytes)) stop('the rebuilt bundle is NOT byte-identical to the pre-calibration bundle; marker left')
  rmSync(MARKER)
  console.log('source and committed bundle restored byte-identical; marker removed')
}

const fails = probeOut.split('\n').filter((l) => l.includes('  FAIL  '))
for (const l of probeOut.split('\n').filter((l) => /PASS|FAIL|checks PASS|teardown|live after/.test(l))) console.log(l)
let bad = 0
for (const i of INJ) {
  const fired = fails.some((l) => l.includes(i.expect))
  if (!fired) bad++
  console.log(`${fired ? 'FIRED ' : 'SILENT'}  ${i.id}: "${i.expect}"`)
}
process.exit(bad ? 1 : 0)
