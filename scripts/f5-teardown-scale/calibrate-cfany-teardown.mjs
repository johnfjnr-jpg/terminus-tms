#!/usr/bin/env node
// F5_TEARDOWN_SCALE ruling H1: calibrate the hardened teardown of
// scripts/probe-create-from-any-contact.mjs.
//
//   node --env-file=.env scripts/f5-teardown-scale/calibrate-cfany-teardown.mjs
//
// Needs what the probe needs: the dev server on :3000, a live session-ref.json
// and the scratch browser. About four minutes: three probe runs.
//
// THE CLAIM: a forced failure of the teardown's tag enumeration (the statement
// that hit the timeout in the merged gate of 2026-11-22) still leaves ZERO
// live records of the run's tag, and the run reports the failure.
//
// THREE RUNS, EACH ON A TEMP COPY OF HEAD (Verification 44), never the tree:
//   H1-new   HEAD's probe, its tag enumeration forced to throw. Expected: the
//            run fails on the named teardown check, prints the injected
//            failure, and the harness's OWN query finds 0 live.
//   H1-old   the pre-H1 probe (705ae98), the same statement forced to throw.
//            The counterfactual: it must leave records live, or the zero
//            above is not a reading (Verification 13). Its residue is then
//            removed through the copy's own fixtures and ledger, and proved 0.
//   reverted HEAD's probe untouched. Expected: exit 0, the teardown check
//            passes, 0 live.
//
// A verdict is read from the named text, not the exit code (Verification 51).
// The harness compares each copy's probe bytes to their source after writing
// them, and an in-flight marker sits in the copy until the last run is read.
import { execFileSync, spawn } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync, symlinkSync, existsSync, rmSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const REPO = '/Users/johnfryatt/terminus-tms'
const PROBE = 'scripts/probe-create-from-any-contact.mjs'
const PRE_H1 = '705ae98'
const OUT = join(REPO, '.verify', 'f5-teardown-scale')
const RUN_ID = Date.now().toString(36)
mkdirSync(OUT, { recursive: true })

const dirty = execFileSync('git', ['status', '--porcelain', '--', PROBE, 'scripts/fixtures.mjs'], { cwd: REPO, encoding: 'utf8' }).trim()
if (dirty) { console.error(`refused: uncommitted changes to files this calibration runs:\n${dirty}`); process.exit(2) }

const COPY = mkdtempSync(join(tmpdir(), 'f5-cfany-cal-'))
execFileSync('sh', ['-c', `git -C "${REPO}" archive HEAD | tar -x -C "${COPY}"`])
for (const f of ['node_modules', '.env', 'session-ref.json']) symlinkSync(join(REPO, f), join(COPY, f))
if (existsSync(join(COPY, '.scratch'))) { console.error('refused: the copy carries a .scratch ledger'); process.exit(2) }
const MARKER = join(COPY, '.calibration-in-flight')
writeFileSync(MARKER, RUN_ID)

const HEAD_SRC = execFileSync('git', ['show', `HEAD:${PROBE}`], { cwd: REPO, encoding: 'utf8' })
const OLD_SRC = execFileSync('git', ['show', `${PRE_H1}:${PROBE}`], { cwd: REPO, encoding: 'utf8' })
const THROW = "throw new Error('tagged: canceling statement due to statement timeout (INJECTED)')"
const inject = (src, anchor, replacement) => {
  const n = src.split(anchor).length - 1
  if (n !== 1) throw new Error(`anchor occurs ${n} times: ${anchor.slice(0, 80)}`)
  const out = src.replace(anchor, replacement)
  if (out === src) throw new Error('the injection did not change the source')
  return out
}
const RUNS = [
  { id: 'H1-new', tag: `cfanyh1n-${RUN_ID}`,
    src: inject(HEAD_SRC, "try { tagged = await tagScan('tagged') }", `try { ${THROW} }`),
    want: (r) => r.code !== 0
      && r.text.includes('teardown FAIL: tag enumeration: tagged: canceling statement due to statement timeout (INJECTED)')
      && /FAIL {2}teardown: zero live records of this run's tag/.test(r.text)
      && / 0 still live/.test(r.text) && r.live === 0,
    expect: 'the injected failure is reported, the teardown check FAILS, and 0 are live' },
  { id: 'H1-old', tag: `cfanyh1o-${RUN_ID}`,
    src: inject(OLD_SRC, "const ids = must(await db.from('record_revisions').select('record_id').like('payload->>name', `${TAG} %`).range(0, 999), 'tagged')", `const ids = (() => { ${THROW} })()`),
    want: (r) => r.code !== 0 && r.text.includes('(INJECTED)') && r.live > 0,
    expect: 'COUNTERFACTUAL: the pre-H1 teardown leaves records live' },
  { id: 'reverted', tag: `cfanyh1r-${RUN_ID}`, src: HEAD_SRC,
    want: (r) => r.code === 0 && /PASS {2}teardown: zero live records of this run's tag/.test(r.text)
      && / 0 still live/.test(r.text) && r.live === 0,
    expect: 'exit 0, the teardown check passes, 0 live' },
]

// THE HARNESS'S OWN RESIDUE READING, not the probe's: every record whose
// revision names start with the run's tag, live.
const fixtures = await import(pathToFileURL(join(COPY, 'scripts/fixtures.mjs')).href)
const db = fixtures.admin()
async function liveOf(tag) {
  const { data, error } = await db.from('record_revisions').select('record_id').like('payload->>name', `${tag} %`).range(0, 999)
  if (error) throw new Error(`residue scan ${tag}: ${error.message}`)
  const ids = [...new Set(data.map((x) => x.record_id))]
  if (!ids.length) return { ids, live: 0, liveIds: [] }
  const { data: l, error: e2 } = await db.from('records').select('id').in('id', ids).is('deleted_at', null).range(0, 999)
  if (e2) throw new Error(`residue live ${tag}: ${e2.message}`)
  return { ids, live: l.length, liveIds: l.map((x) => x.id) }
}

const runProbe = (tag) => new Promise((resolve) => {
  const t0 = Date.now()
  const p = spawn(process.execPath, ['--env-file=.env', PROBE, tag], { cwd: COPY, stdio: ['ignore', 'pipe', 'pipe'] })
  let text = ''
  p.stdout.on('data', (d) => { text += d }); p.stderr.on('data', (d) => { text += d })
  p.on('exit', (code) => resolve({ code, text, ms: Date.now() - t0 }))
})

let stopped = null
const verdicts = []
for (const run of RUNS) {
  writeFileSync(join(COPY, PROBE), run.src)
  if (readFileSync(join(COPY, PROBE), 'utf8') !== run.src) { stopped = `${run.id}: the copy's probe did not read back as written`; break }
  const r = await runProbe(run.tag)
  writeFileSync(join(OUT, `${RUN_ID}-${run.id}.txt`), r.text)
  const res = await liveOf(run.tag)
  r.live = res.live
  const ok = run.want(r)
  verdicts.push({ run, ok })
  console.log(`${run.id.padEnd(9)} ${ok ? 'AS EXPECTED' : 'NOT AS EXPECTED'}  exit ${r.code}  ${r.ms}ms  `
    + `${res.ids.length} tagged records, ${res.live} live  (${(r.text.match(/(\d+)\/(\d+) checks passed/) ?? [''])[0]})`)
  console.log(`          expected: ${run.expect}`)
  for (const l of r.text.split('\n').filter((x) => /^teardown|FAIL {2}teardown|PASS {2}teardown/.test(x))) console.log(`          ${l.trim()}`)
  if (res.live) {
    // Only the counterfactual is meant to leave anything. Hand back, then the
    // copy's own tearDown (its ledger holds the hand-aways), then re-read.
    for (const id of res.liveIds) await fixtures.handOver(id, JSON.parse(readFileSync(join(REPO, 'session-ref.json'), 'utf8')).user.id)
    await fixtures.tearDown(run.tag)
    const again = await liveOf(run.tag)
    console.log(`          cleaned: ${res.live} live -> ${again.live} live`)
    if (again.live) { stopped = `${run.id}: ${again.live} records still live after cleanup`; break }
  }
  if (!ok) { stopped = `${run.id} not as expected`; break }
}
if (readFileSync(join(COPY, PROBE), 'utf8') !== HEAD_SRC && !stopped) stopped = 'the copy does not end on HEAD\'s probe'
if (stopped) { console.log(`STOPPED: ${stopped}. Copy left at ${COPY} with its in-flight marker.`); process.exit(3) }
rmSync(MARKER)
rmSync(COPY, { recursive: true, force: true })
console.log(`${verdicts.length}/${RUNS.length} as expected; transcripts in ${OUT}/${RUN_ID}-*.txt`)
