#!/usr/bin/env node
// F5_TEARDOWN_SCALE, ruling 2 of 2026-11-24: calibrate the re-aimed guards in
// scripts/tests/teardown-scoping.test.mjs ("tearDown reaches a record beyond
// row 1,000 of its own tag population").
//
//   node --env-file=.env scripts/f5-teardown-scale/calibrate-headroom-guard.mjs
//
// Needs a live session-ref.json (the test reads the test account from it).
// About two minutes: three runs of the one test.
//
// THE CLAIMS:
//   HEADROOM  the guard FIRES on a statement made to exceed its ceiling.
//   INDEX     the guard FIRES when the tag lookup is forced off the index.
//   reverted  HEAD's test, untouched, passes.
//
// HOW THE STATEMENTS ARE MADE HEAVIER. Each gains OR branches on a payload key
// no index serves (`payload->>zz_unindexed`), so Postgres must read the whole
// table and evaluate every branch on every row. That is exactly the pre-index
// cost, re-created without touching the schema.
//
// EACH RUN ON A TEMP COPY OF HEAD (Verification 44), never the tree, and each
// injection gets a run of its own (Verification 51, injections in one run can
// mask each other). A verdict is read from the named assertion text, never the
// exit code, and a run whose failure is a TIMEOUT rather than the guard is NOT
// AS EXPECTED: an alarm for the wrong reason proves nothing (Verification 14).
// The test hard-purges its own rows in a finally, whatever fails; the harness
// re-reads each run's tags from the database and requires zero rows left.
import { execFileSync, spawn } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync, symlinkSync, existsSync, rmSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { tagOr, syntheticNameCost } from '../lib/tag-filter.mjs'

const REPO = '/Users/johnfryatt/terminus-tms'
const TEST = 'scripts/tests/teardown-scoping.test.mjs'
const NAME = 'tearDown reaches a record beyond row 1,000 of its own tag population'
const OUT = join(REPO, '.verify', 'f5-teardown-scale')
const RUN_ID = Date.now().toString(36)
mkdirSync(OUT, { recursive: true })

const dirty = execFileSync('git', ['status', '--porcelain', '--', TEST, 'scripts/fixtures.mjs'], { cwd: REPO, encoding: 'utf8' }).trim()
if (dirty) { console.error(`refused: uncommitted changes to files this calibration runs:\n${dirty}`); process.exit(2) }

const COPY = mkdtempSync(join(tmpdir(), 'f5-headroom-cal-'))
execFileSync('sh', ['-c', `git -C "${REPO}" archive HEAD | tar -x -C "${COPY}"`])
for (const f of ['node_modules', '.env', 'session-ref.json']) symlinkSync(join(REPO, f), join(COPY, f))
if (existsSync(join(COPY, '.scratch'))) { console.error('refused: the copy carries a .scratch ledger'); process.exit(2) }
const MARKER = join(COPY, '.calibration-in-flight')
writeFileSync(MARKER, RUN_ID)

const HEAD_SRC = execFileSync('git', ['show', `HEAD:${TEST}`], { cwd: REPO, encoding: 'utf8' })
const inject = (src, anchor, replacement) => {
  const n = src.split(anchor).length - 1
  if (n !== 1) throw new Error(`anchor occurs ${n} times: ${anchor.slice(0, 80)}`)
  const out = src.replace(anchor, replacement)
  if (out === src) throw new Error('the injection did not change the source')
  return out
}
// Branch names assembled, so this file carries no statement the unbounded or
// source scans would read as a real query (Verification 39).
const unindexed = (n) => Array.from({ length: n }, (_, i) => `payload->>zz_unindexed.ilike.zz${i}%`).join(',')
// MEASURED, NOT GUESSED, after two light injections (runs mwu2zrk5, mwu30qlu):
// 12 and then 30 branches on a missing key gave warm minimums of 848ms and
// 1,115ms, both UNDER the 1,333ms ceiling, so the guard correctly stayed
// silent and the harness stopped. A missing key is cheap per row. A
// leading-wildcard ilike on the real name is not: one missing-key branch to
// force the whole-table read, plus 25 of those, measured 1,737 to 1,778ms warm.
// 2026-11-24, ruling F1: the tag filters became case-sensitive like, and the
// ceiling moved to 1,067ms (COLD_FACTOR 5). These heavy branches stay ILIKE on
// purpose: they are a synthetic cost, not a tag filter, and ilike is the cost.
const HEAVY_BRANCHES = 25
const heavy = () => [unindexed(1), syntheticNameCost(HEAVY_BRANCHES)].join(',')
const RUNS = [
  { id: 'HEADROOM',
    src: inject(HEAD_SRC, ".select('id, record_id').or(or(RUN_TAGS)).order('id', { ascending: true }).range(0, 999), 'headroom probe')",
      `.select('id, record_id').or(or(RUN_TAGS) + ',${heavy()}').order('id', { ascending: true }).range(0, 999), 'headroom probe')`),
    want: (t) => /HEADROOM: the MINIMUM of 5 samples was \d+ms warm, past the \d+ms ceiling/.test(t) && !/canceling statement/.test(t),
    expect: `FAILS on "HEADROOM:" (a whole-table read with ${HEAVY_BRANCHES} leading-wildcard branches), not on a timeout` },
  { id: 'INDEX',
    src: inject(HEAD_SRC, '.or(or(NO_MATCH))',
      `.or(or(NO_MATCH) + ',${unindexed(1)}')`),
    want: (t) => /INDEX: the no-match tag lookup costs \d+ms over a one-row pk read/.test(t) && !/canceling statement/.test(t),
    expect: 'FAILS on "INDEX:" (the lookup is forced off the index), not on a timeout' },
  { id: 'reverted', src: HEAD_SRC,
    want: (t, code) => code === 0 && /(#|ℹ) pass 1\b/.test(t) && /(#|ℹ) fail 0\b/.test(t) && /headroom: .* min \d+ms, ceiling/.test(t),
    expect: 'exit 0, the one test passes, both guard lines printed' },
]

const fixtures = await import(pathToFileURL(join(COPY, 'scripts/fixtures.mjs')).href)
const db = fixtures.admin()
async function leftOf(stamp) {
  const or = tagOr(['a1deep', 'a1keep', 'a1third'].map((p) => `${p}-${stamp}`))
  const { count, error } = await db.from('record_revisions').select('id', { count: 'exact', head: true }).or(or)
  if (error) throw new Error(`residue count ${stamp}: ${error.message}`)
  return count
}

const runTest = () => new Promise((resolve) => {
  const t0 = Date.now()
  const p = spawn(process.execPath, ['--test', '--env-file=.env', `--test-name-pattern=${NAME}`, TEST], { cwd: COPY, stdio: ['ignore', 'pipe', 'pipe'] })
  let text = ''
  p.stdout.on('data', (d) => { text += d }); p.stderr.on('data', (d) => { text += d })
  p.on('exit', (code) => resolve({ code, text, ms: Date.now() - t0 }))
})

let stopped = null
let good = 0
for (const run of RUNS) {
  writeFileSync(join(COPY, TEST), run.src)
  if (readFileSync(join(COPY, TEST), 'utf8') !== run.src) { stopped = `${run.id}: the copy's test did not read back as written`; break }
  const r = await runTest()
  writeFileSync(join(OUT, `${RUN_ID}-headroom-${run.id}.txt`), r.text)
  // A run that printed no result did not run (Verification 48): stop, never score it.
  if (!/(#|ℹ) (pass|fail) \d+/.test(r.text)) { stopped = `${run.id}: no result line after ${r.ms}ms, so it did not run`; break }
  const stamp = (r.text.match(/this run's own tag a1deep-([a-z0-9]+)/) ?? [])[1]
  if (!stamp) { stopped = `${run.id}: the run printed no tag, so its residue cannot be read`; break }
  const left = await leftOf(stamp)
  const ok = run.want(r.text, r.code) && left === 0
  if (ok) good++
  console.log(`${run.id.padEnd(9)} ${ok ? 'AS EXPECTED' : 'NOT AS EXPECTED'}  exit ${r.code}  ${r.ms}ms  tag a1deep-${stamp}, ${left} rows left`)
  console.log(`          expected: ${run.expect}`)
  for (const l of r.text.split('\n').filter((x) => /headroom:|index:|HEADROOM:|INDEX:|purge:|canceling/.test(x))) console.log(`          ${l.trim().slice(0, 260)}`)
  if (left) { stopped = `${run.id}: ${left} rows of its tags remain`; break }
  if (!ok) { stopped = `${run.id} not as expected`; break }
}
if (readFileSync(join(COPY, TEST), 'utf8') !== HEAD_SRC && !stopped) stopped = 'the copy does not end on HEAD\'s test'
if (stopped) { console.log(`STOPPED: ${stopped}. Copy left at ${COPY} with its in-flight marker.`); process.exit(3) }
rmSync(MARKER)
rmSync(COPY, { recursive: true, force: true })
console.log(`${good}/${RUNS.length} as expected; transcripts in ${OUT}/${RUN_ID}-headroom-*.txt`)
