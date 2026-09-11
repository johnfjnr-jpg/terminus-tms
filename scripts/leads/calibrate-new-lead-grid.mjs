// P5 CALIBRATION: prove every check in probe-new-lead-grid.mjs can FAIL.
//
// Eighteen checks went green on their first run. That is the tell, not the
// proof. Each injection below breaks one claim and the run must go red; a
// SILENT injection names a claim nothing asserts (Verification 51).
//
// HARNESS DISCIPLINE, in full, because two harnesses in this estate destroyed
// the work they were calibrating:
//   - snapshots keyed on the FULL PATH, never the basename (src/lib and
//     src/routes deliberately mirror names here);
//   - the snapshot is asserted to EXIST before anything is injected;
//   - restored bytes are compared to the original after EVERY injection and
//     the run stops dead on a mismatch rather than compounding;
//   - an IN-FLIGHT marker refuses a run that finds wreckage from a killed one,
//     so a previous run's mutation is never snapshotted as the original;
//   - a final reverted run, which has been the sole witness four times.
// Written in JavaScript, not shell: zsh does not word-split an unquoted
// variable, which is how one harness silently snapshotted nothing.
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { execFileSync, spawn } from 'node:child_process'
import { api } from '../api-client.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const SNAP = `${ROOT}/.verify/leads/p5-snapshots`
const INFLIGHT = `${SNAP}/IN_FLIGHT`
mkdirSync(SNAP, { recursive: true })

if (existsSync(INFLIGHT)) {
  console.error(`REFUSING TO RUN: ${INFLIGHT} exists, so a previous run was killed mid-injection.`)
  console.error(`Its snapshots are in ${SNAP}. Restore them by hand, delete the marker, then re-run.`)
  console.error('Snapshotting now would bless the mutation as the original.')
  process.exit(2)
}

const key = (f) => f.replaceAll('/', '_')
const FILES = [
  'frontend-react/src/leads/NewLeadGrid.tsx',
  'src/routes/contacts.js',
]
const ORIGINAL = new Map()
for (const f of FILES) {
  const bytes = readFileSync(`${ROOT}/${f}`)
  writeFileSync(`${SNAP}/${key(f)}`, bytes)
  if (!existsSync(`${SNAP}/${key(f)}`)) throw new Error(`snapshot of ${f} does not exist; refusing to inject`)
  ORIGINAL.set(f, bytes)
}
console.log(`  snapshotted ${FILES.length} file(s), keyed on full path`)

const build = () => execFileSync('npm', ['run', 'build'], { cwd: `${ROOT}/frontend-react`, stdio: 'pipe' })
// src/routes changes need the server restarted: it runs without --watch, so a
// probe would otherwise measure the code that was just replaced - and it would
// PASS, because the old route satisfies almost every assertion the new one does.
//
// THE FIRST VERSION OF THIS FUNCTION HUNG THE WHOLE SWEEP, and the mechanism is
// worth keeping because it is invisible: it used
//     execFileSync('bash', ['-c', '... & sleep 2'], { stdio: 'pipe' })
// and `execFileSync` waits for its stdout pipe to CLOSE, not for the command to
// exit. The backgrounded subshell inherits that pipe and holds it open for as
// long as the server lives, which is forever. The sweep sat on injection 2 with
// every process healthy and the probe never launched. `spawn` detached with
// stdio ignored cannot do this: there is no pipe to hold.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const restartApi = async () => {
  try { execFileSync('pkill', ['-f', 'src/server.js'], { stdio: 'ignore' }) } catch { /* none running */ }
  await sleep(400)
  const child = spawn('node', ['--env-file=.env', 'src/server.js'],
    { cwd: ROOT, detached: true, stdio: 'ignore' })
  child.unref()
  // Wait on the server SERVING A REAL ROUTE, never on a fixed delay and never
  // on a raw fetch. The estate's own guard caught the first version of this
  // line and was right to: a readiness poll that treats ANY answer as ready is
  // exactly the silent-non-2xx shape the throwing client exists to prevent, so
  // a server that came back broken would have read as ready.
  //
  // `api` throws on non-2xx, so this proves the server can serve an
  // authenticated route rather than merely that something is listening - which
  // is the thing the injected probe is about to depend on.
  for (let i = 0; i < 60; i++) {
    try {
      await api('GET', '/industries')
      return
    } catch { /* not up, or not up HEALTHY, yet */ }
    await sleep(250)
  }
  throw new Error('the API server did not serve /industries within 15s of restart')
}

const runProbe = () => {
  const t0 = Date.now()
  let code = 0, out = ''
  try {
    out = execFileSync('node', ['--env-file=.env', 'scripts/leads/probe-new-lead-grid.mjs'],
      { cwd: ROOT, encoding: 'utf8', timeout: 300000,
        env: { ...process.env, PUPPETEER_PATH: '/tmp/tms-probe/node_modules/puppeteer' } })
  } catch (e) {
    code = e.status ?? -1
    out = `${e.stdout ?? ''}${e.stderr ?? ''}`
  }
  const ms = Date.now() - t0
  // A stage that fails faster than it could run has not run. The probe drives
  // a browser and takes tens of seconds; a fast red is the environment.
  const passLine = /(\d+)\/(\d+) checks pass/.exec(out)
  return { code, out, ms, passed: passLine ? Number(passLine[1]) : null,
           total: passLine ? Number(passLine[2]) : null }
}

const restore = (f) => {
  writeFileSync(`${ROOT}/${f}`, ORIGINAL.get(f))
  const back = readFileSync(`${ROOT}/${f}`)
  if (!back.equals(ORIGINAL.get(f))) {
    console.error(`RESTORE MISMATCH on ${f} - stopping dead rather than compounding`)
    process.exit(3)
  }
}

const INJECTIONS = [
  { name: 'the required markers stop rendering',
    file: 'frontend-react/src/leads/NewLeadGrid.tsx',
    from: '{required.includes(c.key)', to: '{(false && required.includes(c.key))',
    expects: 'CLAIM 1b' },
  // NOT "remove company from the server's tuple". That injection CANNOT fire,
  // and the reason is the thing under test: the tuple feeds both the refusal
  // and the endpoint the grid reads, so removing it moves BOTH readers together
  // and they still agree. It would have come back SILENT while the design was
  // working perfectly.
  //
  // The defect the ruling exists to prevent is a SECOND READER, so that is what
  // is injected: the grid stops asking the server and carries its own list.
  { name: 'the grid hardcodes its own mandatory list instead of deriving it',
    file: 'frontend-react/src/leads/NewLeadGrid.tsx',
    from: '      if (req.ok && req.data) { setRequired(req.data.required); setSources(req.data.sources) }',
    to: "      if (req.ok && req.data) { setRequired(['name', 'email']); setSources(req.data.sources) }",
    expects: 'CLAIM 1b: screen and server disagree' },
  { name: 'email format is no longer checked',
    file: 'frontend-react/src/leads/NewLeadGrid.tsx',
    from: "if (email && !isValidEmail(email)) p.email = 'Not an email address'", to: '',
    expects: 'CLAIM 2 email' },
  { name: 'mobile format is no longer checked',
    file: 'frontend-react/src/leads/NewLeadGrid.tsx',
    from: "if (mobile && !isValidMobile(mobile)) p.mobile = 'Not a phone number'", to: '',
    expects: 'CLAIM 2 mobile' },
  { name: 'every filled row is treated as valid',
    file: 'frontend-react/src/leads/NewLeadGrid.tsx',
    from: '  const valid = filled.filter(({ i }) => Object.keys(problems[i]).length === 0)',
    to: '  const valid = filled',
    expects: 'CLAIM 2 flags / CLAIM 3 membership' },
  { name: 'the last row stops auto-extending',
    file: 'frontend-react/src/leads/NewLeadGrid.tsx',
    from: '    if (i === rows.length - 1) setRows((rs) => [...rs, blank()])', to: '',
    expects: 'the auto-extend check' },
  // THE SERVER HALF, and it is the only injection that CAN break the two
  // apart from the server's side. The tuple feeds both the refusal and the
  // endpoint, so changing the tuple moves both together - which is the design.
  // Making the ENDPOINT stop serving the tuple is a real defect and the one
  // that reintroduces a second reader from the far end.
  //
  // It is also the only injection that exercises `restartApi`. Without it that
  // function was a recovery path nothing had ever run, which is the shape this
  // estate has been caught by before.
  { name: 'the endpoint stops serving the tuple the refusal reads',
    file: 'src/routes/contacts.js',
    from: '      required: CONTACT_REQUIRED_AT_CREATION.map(({ key }) => key),',
    to: "      required: ['name'],",
    expects: 'CLAIM 1b: the screen marks 1, the server refuses 6' },
  { name: 'save clears every row, invalid ones included',
    file: 'frontend-react/src/leads/NewLeadGrid.tsx',
    from: '        const kept = rs.filter((_, i) => !savedIdx.has(i))',
    to: '        const kept = []',
    expects: 'CLAIM 3 invalid rows kept' },
]

writeFileSync(INFLIGHT, new Date().toISOString())
const verdicts = []
try {
  for (const inj of INJECTIONS) {
    const src = ORIGINAL.get(inj.file).toString('utf8')
    const n = src.split(inj.from).length - 1
    if (n !== 1) { console.error(`ANCHOR NOT UNIQUE for "${inj.name}": ${n} occurrences. Refusing.`); process.exit(4) }
    writeFileSync(`${ROOT}/${inj.file}`, src.replace(inj.from, inj.to))
    // Confirm the edit LANDED before measuring: an edit that fails plus a run
    // that proceeds is indistinguishable from a run on the edited file.
    if (readFileSync(`${ROOT}/${inj.file}`).equals(ORIGINAL.get(inj.file))) {
      console.error(`INJECTION DID NOT LAND for "${inj.name}"`); process.exit(5)
    }
    let buildOk = true
    try { build() } catch { buildOk = false }
    if (inj.file.startsWith('src/')) await restartApi()
    const r = buildOk ? runProbe() : { code: -1, out: 'build failed', ms: 0, passed: null, total: null }
    const fired = r.code !== 0
    verdicts.push({ ...inj, fired, ms: r.ms, passed: r.passed, total: r.total, buildOk })
    console.log(`  ${fired ? 'FIRED ' : 'SILENT'}  ${inj.name}`)
    console.log(`          ${r.passed ?? '?'}/${r.total ?? '?'} passed, ${(r.ms / 1000).toFixed(1)}s, exit ${r.code}, expected to break ${inj.expects}`)
    if (!fired) writeFileSync(`${ROOT}/.verify/leads/p5-silent-${key(inj.name).slice(0, 40)}.txt`, r.out)
    restore(inj.file)
    if (inj.file.startsWith('src/')) await restartApi()
  }
  build()
} finally {
  for (const f of FILES) restore(f)
  build()
  await restartApi()
  rmSync(INFLIGHT, { force: true })
}

console.log('\n  FINAL REVERTED RUN (the pass that has been the sole witness four times)')
const final = runProbe()
console.log(`  ${final.passed}/${final.total} checks pass, ${(final.ms / 1000).toFixed(1)}s, exit ${final.code}`)
const silent = verdicts.filter((v) => !v.fired)
console.log(`\n  ${verdicts.length - silent.length}/${verdicts.length} injections fired`)
for (const v of silent) console.log(`  SILENT: ${v.name} - a claim nothing asserts, or a matcher that missed`)
process.exit(silent.length === 0 && final.code === 0 ? 0 : 1)
