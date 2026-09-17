// ── ROUND A PHASE 1: CALIBRATE EVERY NEW CHECK, BOTH DIRECTIONS ──────────
//
// Each injection breaks ONE behaviour from brief items 1.1-1.6 in the source,
// runs the exit-criteria test file, and is scored by WHICH TEST FAILED, never
// by the exit code (Verification 9: an injection can go red without reaching
// the check it was written for). The silent direction is the final reverted
// run of the whole React suite.
//
// THE HARNESS PROTECTS THE WORK IT IS POINTED AT (Verification 44):
//   - it refuses to start while an in-flight marker from a killed run exists;
//   - it snapshots the BYTES of every target, keyed by full path, and asserts
//     the tree still matches them before each injection;
//   - it refuses an anchor that does not occur EXACTLY once;
//   - it confirms the injection LANDED before measuring (V44's write side);
//   - it restores and compares bytes after EVERY injection, stopping dead on a
//     mismatch rather than compounding.
//
// UNWIRED: it rewrites source files while it runs, so it is never a gate stage.
// Run: node scripts/testbed-core/calibrate-p1.mjs > .verify/tb-core/p1-calibrate.txt 2>&1
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '')
const FE = `${ROOT}/frontend-react`
const WORK = `${ROOT}/.verify/tb-core/calib-p1`
const MARKER = `${WORK}/IN-FLIGHT`
const TEST_FILE = 'src/__tests__/testbed-exit-criteria.test.tsx'
const stop = (msg) => { console.error(`\nSTOPPED: ${msg}`); process.exit(3) }

const EXIT = `${FE}/src/testbed/exitCriteria.ts`
const PANEL = `${FE}/src/testbed/StagePanel.tsx`
const TABS = `${FE}/src/testbed/StageTabs.tsx`

const INJECTIONS = [
  { id: 'A 1.3 tickable drops key-set membership', file: EXIT,
    find: "    && typeof r.field === 'string' && TB_EXIT_CRITERION_KEYS.has(r.field)\n    && !!r.label",
    replace: '    && !!r.label',
    expect: ['renders read-only: Installer', 'the labelled SCORE rows are read-only'] },
  // B AIMS AT THE DENOMINATOR. Its first run injected the NUMERATOR and came
  // back SILENT, correctly: every hidden row is met, so the outstanding count
  // is the same over the visible subset by construction (the vanilla's own
  // note). The claim that can fail is the total the count is out of.
  { id: 'B 1.1 summary total counts the VISIBLE subset', file: EXIT,
    find: '${outstanding} of ${res.requirements.length} outstanding',
    replace: '${outstanding} of ${visibleRequirements(res.requirements).length} outstanding',
    expect: ['counts rows the split HIDES'] },
  { id: 'C 1.2 tick row ignores server met', file: PANEL,
    find: 'const shown = confirmed.get(field) ?? r.met',
    replace: 'const shown = confirmed.get(field) ?? false',
    expect: ['the ticked key reads met from the response'] },
  { id: 'C2 1.2 computed row data-met ignores server met', file: PANEL,
    find: "data-met={r.met ? 'true' : 'false'}>",
    replace: "data-met={'false'}>",
    expect: ["computed rows carry the server's met too"] },
  { id: 'D 1.4 split removed', file: EXIT,
    find: 'return reqs.filter((r) => isProcessRequirement(r) || !r.met)',
    replace: 'return [...reqs]',
    expect: ['met DATA-ENTRY rows go', 'counts rows the split HIDES'] },
  { id: 'E B3 StageTabs drops the response', file: TABS,
    find: "setCriteriaData(r.panels['tb-stage-exit-criteria-list'])",
    replace: 'setCriteriaData(null)',
    expect: ['THROUGH StageTabs and its loader'] },
  { id: 'F 1.5 door check removed', file: EXIT,
    find: '  if (!deps.canEdit()) return { ok: false, error: null }\n',
    replace: '',
    expect: ['attemptTick asks the DOOR first'] },
  { id: 'G 1.6 failure feedback removed', file: PANEL,
    find: "    if (r.error !== null) setFeedback(`Could not update: ${r.error ?? 'unknown error'}`)\n",
    replace: '',
    expect: ['a refused write says why in the panel'] },
  { id: 'H 1.5 click always ticks, never unticks', file: PANEL,
    find: 'onClick={() => { void tick(field, shown) }}',
    replace: 'onClick={() => { void tick(field, false) }}',
    expect: ['a met row asks to UNTICK'] },
  { id: 'I confirmed state survives a fresh response', file: PANEL,
    find: '  useEffect(() => { setConfirmed(new Map()) }, [data])\n',
    replace: '',
    expect: ['a fresh server response REPLACES the confirmed state'] },
  { id: 'J 1.3 client key set gains a fifth key', file: EXIT,
    find: "  'exitMonAllMeetingActionsCompleted',\n])",
    replace: "  'exitMonAllMeetingActionsCompleted',\n  'installer_account_id',\n])",
    expect: ["equals the server's TB_EXIT_CRITERION_KEYS", 'renders read-only: Installer'] },
  { id: 'K B3 unreadable answer reads as empty', file: PANEL,
    find: '<p className="empty-state">Unable to load exit criteria.</p>',
    replace: '<p className="empty-state">No exit criteria for this stage.</p>',
    expect: ['the legacy ARRAY shape is refused as unreadable'] },
  { id: 'L 1.1 summary omits to_stage', file: EXIT,
    find: 'outstanding to move to ${res.to_stage}:`',
    replace: 'outstanding:`',
    expect: ['names the outstanding count over ALL requirements and to_stage'] },
  { id: 'M B3 computed rows show only a label', file: PANEL,
    find: '<span className="tb-crit-text">{r.message ?? r.label}</span>',
    replace: '<span className="tb-crit-text">{r.label}</span>',
    expect: ["every one of the fresh Qualification response's requirements is readable"] },
  { id: 'N 1.5 Space no longer ticks', file: PANEL,
    find: "if (e.key === ' ' || e.key === 'Enter')",
    replace: "if (e.key === 'Enter')",
    expect: ['the keyboard ticks too'] },
  { id: 'O 1.5 no refresh after a write', file: EXIT,
    find: '  deps.refresh()\n',
    replace: '',
    expect: ['then refreshes'] },
  { id: 'P 1.5 a confirmed tick does not show', file: PANEL,
    find: '      setConfirmed((m) => new Map(m).set(field, !currentlyMet))\n',
    replace: '',
    expect: ['shows ticked once the write is confirmed'] },
  { id: 'Q 1.1 final-stage message', file: PANEL,
    find: 'This is the final stage - nothing further to exit toward.',
    replace: 'No exit criteria.',
    expect: ['the final stage says so'] },
  { id: 'R 1.1 no-criteria message omits to_stage', file: PANEL,
    find: 'No exit criteria configured for {res.to_stage}.',
    replace: 'No exit criteria configured.',
    expect: ['no criteria names to_stage'] },
  { id: 'S 1.1 all-met sentence', file: EXIT,
    find: '? `All criteria met - ready to move to \${res.to_stage}.`',
    replace: '? `All met.`',
    expect: ['the all-met sentence'] },
]

if (existsSync(MARKER)) {
  stop(`${MARKER} exists: a previous run was killed mid-injection. Restore from ${WORK}/snapshots and delete the marker by hand.`)
}
mkdirSync(`${WORK}/snapshots`, { recursive: true })
const files = [...new Set(INJECTIONS.map((i) => i.file))]
const snap = new Map()
for (const f of files) {
  const bytes = readFileSync(f)
  snap.set(f, bytes)
  const copy = `${WORK}/snapshots/${f.replaceAll('/', '_')}`
  writeFileSync(copy, bytes)
  if (!existsSync(copy) || !readFileSync(copy).equals(bytes)) stop(`snapshot of ${f} did not write`)
}
writeFileSync(MARKER, new Date().toISOString())
console.log(`snapshotted ${files.length} files; marker written`)

const runTests = (label) => {
  const out = `${WORK}/${label.replace(/[^A-Za-z0-9]+/g, '_')}.json`
  rmSync(out, { force: true })
  const t0 = Date.now()
  const r = spawnSync('npx', ['vitest', 'run', TEST_FILE, '--reporter=json', `--outputFile=${out}`],
    { cwd: FE, encoding: 'utf8' })
  const ms = Date.now() - t0
  if (!existsSync(out)) return { ms, exit: r.status, failed: null, total: null, raw: `${r.stdout}${r.stderr}`.slice(-800) }
  const j = JSON.parse(readFileSync(out, 'utf8'))
  const all = j.testResults.flatMap((f) => f.assertionResults)
  return { ms, exit: r.status, total: all.length,
    failed: all.filter((a) => a.status !== 'passed').map((a) => a.title),
    suiteError: j.testResults.map((f) => f.message).filter(Boolean).join(' | ') }
}

const rows = []
try {
  const base = runTests('baseline')
  if (base.failed === null || base.failed.length) stop(`baseline is not green: ${JSON.stringify(base)}`)
  console.log(`baseline: ${base.total} tests, 0 failed, ${base.ms}ms`)
  for (const inj of INJECTIONS) {
    const now = readFileSync(inj.file)
    if (!now.equals(snap.get(inj.file))) stop(`${inj.file} differs from its snapshot before ${inj.id}`)
    const text = now.toString('utf8')
    const count = text.split(inj.find).length - 1
    if (count !== 1) stop(`anchor for ${inj.id} occurs ${count} times, not once`)
    writeFileSync(inj.file, text.replace(inj.find, inj.replace))
    const landed = readFileSync(inj.file, 'utf8')
    if (landed === text) stop(`injection ${inj.id} did not change the file`)
    let res
    try { res = runTests(inj.id) } finally {
      writeFileSync(inj.file, snap.get(inj.file))
      if (!readFileSync(inj.file).equals(snap.get(inj.file))) stop(`restore of ${inj.file} after ${inj.id} is not byte-identical`)
    }
    if (res.failed === null) stop(`${inj.id} produced no result in ${res.ms}ms (exit ${res.exit}): ${res.raw}`)
    const hit = inj.expect.filter((e) => res.failed.some((t) => t.includes(e)))
    const verdict = res.failed.length === 0 ? 'SILENT'
      : hit.length === inj.expect.length ? 'FIRED' : 'FIRED-ELSEWHERE'
    rows.push({ id: inj.id, verdict, hit: `${hit.length}/${inj.expect.length}`, failedCount: res.failed.length, ms: res.ms, failed: res.failed })
    console.log(`${verdict.padEnd(16)} ${inj.id}  expected ${hit.length}/${inj.expect.length}, ${res.failed.length} failed, ${res.ms}ms`)
    for (const t of res.failed) console.log(`                   x ${t}`)
    if (res.suiteError) console.log(`                   suite error: ${res.suiteError.slice(0, 200)}`)
  }
} finally {
  for (const [f, bytes] of snap) {
    if (!readFileSync(f).equals(bytes)) { writeFileSync(f, bytes) }
    if (!readFileSync(f).equals(bytes)) { console.error(`FINAL RESTORE FAILED for ${f}; marker left in place`); process.exit(4) }
  }
  rmSync(MARKER, { force: true })
  console.log('all targets byte-identical to their snapshots; marker removed')
}

// ── THE SILENT DIRECTION: the whole React suite on the reverted tree ─────
const t0 = Date.now()
const full = spawnSync('npx', ['vitest', 'run'], { cwd: FE, encoding: 'utf8' })
const summary = `${full.stdout}${full.stderr}`.split('\n').filter((l) => /Test Files|Tests /.test(l)).join(' | ')
console.log(`\nREVERTED full React suite: exit ${full.status}, ${Date.now() - t0}ms  ${summary.trim()}`)
const notFired = rows.filter((r) => r.verdict !== 'FIRED')
console.log(`\n${rows.length - notFired.length}/${rows.length} FIRED on their named tests; ${notFired.length} not: ${notFired.map((r) => `${r.id}=${r.verdict}`).join(', ') || 'none'}`)
process.exit(full.status === 0 && notFired.length === 0 ? 0 : 1)
