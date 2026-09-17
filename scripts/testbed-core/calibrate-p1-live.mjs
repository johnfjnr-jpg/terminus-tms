// ── ROUND A PHASE 1: CALIBRATE THE LIVE PROBE ON A DELIBERATELY BROKEN BUNDLE ─
//
// probe-p1-exit.mjs passed 22/22 on its first run, which is the tell, not the
// proof. Two injections go into the SOURCE, the bundle is rebuilt, the probe
// runs against the served screen, and it is scored by WHICH named checks fail:
//
//   door   attemptTick loses its canEdit() guard  -> T6 "Space and Enter ... send NO PATCH"
//   safety isTickable loses key-set membership     -> T5 "the Installer row renders ... computed"
//
// Both at once, because they touch different checks and a bundle build plus a
// live run is the expensive part; the scoring names each check separately.
//
// It then restores the source from its byte snapshot, rebuilds, and requires
// BOTH the source and the committed bundle to be byte-identical to before -
// the bundle is committed, so a calibration that left an injected bundle
// behind would ship it (Verification 44). An in-flight marker refuses a rerun
// after a killed one.
//
// UNWIRED. Run: node --env-file=.env scripts/testbed-core/calibrate-p1-live.mjs
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '')
const SRC = `${ROOT}/frontend-react/src/testbed/exitCriteria.ts`
const DIST = `${ROOT}/frontend-react/dist/terminus-react.js`
const WORK = `${ROOT}/.verify/tb-core/calib-p1-live`
const MARKER = `${WORK}/IN-FLIGHT`
const stop = (m) => { console.error(`STOPPED: ${m}`); process.exit(3) }
const INJ = [
  { id: 'door', find: '  if (!deps.canEdit()) return { ok: false, error: null }\n', replace: '',
    expect: 'mouse, Space and Enter on the unowned row send NO PATCH' },
  { id: 'safety', find: "    && typeof r.field === 'string' && TB_EXIT_CRITERION_KEYS.has(r.field)\n    && !!r.label", replace: '    && !!r.label',
    expect: 'the Installer row renders, visible, computed, with no role and no tab stop' },
]

if (existsSync(MARKER)) stop(`${MARKER} exists; restore from ${WORK} first`)
mkdirSync(WORK, { recursive: true })
const srcBytes = readFileSync(SRC); const distBytes = readFileSync(DIST)
writeFileSync(`${WORK}/exitCriteria.ts.snapshot`, srcBytes)
writeFileSync(`${WORK}/terminus-react.js.snapshot`, distBytes)
if (!readFileSync(`${WORK}/exitCriteria.ts.snapshot`).equals(srcBytes) || !readFileSync(`${WORK}/terminus-react.js.snapshot`).equals(distBytes)) stop('snapshots did not write')
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
  const r = spawnSync('node', ['--env-file=.env', 'scripts/testbed-core/probe-p1-exit.mjs'],
    { cwd: ROOT, encoding: 'utf8', env: { ...process.env, TBCORE_RUN: 'p1-exit-injected' }, timeout: 400000 })
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
