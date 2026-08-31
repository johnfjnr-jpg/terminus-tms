#!/usr/bin/env node
// The whole merge gate, in one command, captured to one file.
//
// Round 38. CI runs the pure suite only, and the pure suite passed a route that
// answered 500 to every call. The database suite and the HTTP probe both sit
// outside CI, so the only thing gating a merge was the thing that could not see
// the defect. Until the database suite runs in CI, this is the gate, and it is
// a command rather than a recipe so that "I ran the checks" means one
// reproducible thing.
//
// EVERY RUN IS CAPTURED TO A FILE, WHOLE, BEFORE ANYTHING IS SEARCHED.
// Verification 16: a filtered run that shows nothing is indistinguishable from
// a run that found nothing, and the moment you most need the output is the
// moment you have already discarded it.

import { spawnSync } from 'node:child_process'
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('../', import.meta.url).pathname
const OUT_DIR = join(ROOT, '.verify')
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true })

const STAGES = [
  {
    name: 'pure suite',
    cmd: ['npm', ['test']],
    needs: 'nothing. This is what CI runs.',
  },
  {
    name: 'database suite',
    cmd: ['npm', ['run', 'test:db']],
    needs: '.env with SUPABASE_URL and SUPABASE_SECRET_KEY',
  },
  {
    name: 'HTTP precondition probe',
    cmd: ['node', ['scripts/probe-preconditions.mjs', 'GATE']],
    needs: 'the dev server on :3000 AND a live session-ref.json',
  },
  {
    name: 'HTTP version-approval probe',
    cmd: ['node', ['scripts/probe-version-approval.mjs', 'GATE']],
    needs: 'the dev server on :3000 AND a live session-ref.json',
  },
  {
    name: 'HTTP commercial-gate probe',
    cmd: ['node', ['scripts/probe-commercial-gate.mjs', 'GATE']],
    needs: 'the dev server on :3000 AND a live session-ref.json',
  },
  {
    // Round 41 W4. The three probes above all measure REFUSALS: a stale write
    // rejected, an approval refused, a gate held shut. Not one of them
    // exercises a write that is supposed to WORK, which is how a
    // ReferenceError on a 201 response line reached main and was found by a
    // walk rather than by the gate. CLAUDE.md Verification 40.
    name: 'HTTP score success probe',
    cmd: ['node', ['scripts/probe-score-success.mjs']],
    needs: 'the dev server on :3000 AND a live session-ref.json',
  },
]

const transcript = []
const summary = []
let failed = 0

for (const stage of STAGES) {
  const [bin, args] = stage.cmd
  const started = process.hrtime.bigint()
  const run = spawnSync(bin, args, { cwd: ROOT, encoding: 'utf8', shell: false })
  const ms = Number((process.hrtime.bigint() - started) / 1000000n)
  const output = `${run.stdout ?? ''}${run.stderr ?? ''}`
  // status is null when the process could not be spawned at all, which is a
  // different failure from a failing suite and must not read as one.
  const ok = run.status === 0
  if (!ok) failed++

  transcript.push(
    `${'='.repeat(72)}\n${stage.name}  (${bin} ${args.join(' ')})\nneeds: ${stage.needs}\n` +
    `exit: ${run.status === null ? `could not run (${run.error?.message ?? 'unknown'})` : run.status}  in ${ms}ms\n` +
    `${'='.repeat(72)}\n${output}`)
  // ── THE COUNT COMES FROM THE RUN ────────────────────────────────────────
  //
  // Round 39 close, set by the business, and it is Verification 20 rather than
  // a new idea: a hand-typed test count is a SECOND READER of a computed value,
  // and second readers drift. A commit message said "217 pass" while the suite
  // said 216, and the gap was not a typo: six new tests were not in the suite
  // at all, because the line adding them had never landed.
  //
  // The mismatch is what surfaced it. That is the argument for emitting the
  // number here rather than tidiness: a message that quotes this line cannot
  // claim a green suite that did not include the tests it was adding.
  const counts = output.match(/^. (tests|pass|fail) (\d+)$/gm) ?? []
  const n = (k) => counts.find((l) => l.includes(` ${k} `))?.match(/(\d+)$/)?.[1]
  const tally = n('tests') ? `  ${n('pass')}/${n('tests')} pass, ${n('fail')} fail` : ''
  summary.push(`${ok ? 'PASS' : 'FAIL'}  ${stage.name.padEnd(26)} exit ${run.status ?? 'n/a'}  ${ms}ms${tally}`)
}

const stamp = process.env.VERIFY_STAMP ?? String(process.hrtime.bigint())
const file = join(OUT_DIR, `verify-${stamp}.txt`)
writeFileSync(file, transcript.join('\n'))

const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).stdout?.trim()
const branch = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).stdout?.trim()
const dirty = spawnSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).stdout?.trim()

console.log(`\nMERGE GATE  ${branch}  ${head}${dirty ? '  (WORKING TREE DIRTY)' : ''}`)
console.log(summary.map((l) => `  ${l}`).join('\n'))
console.log(`\nfull output: ${file}`)
console.log(failed
  ? `\n${failed} of ${STAGES.length} stages FAILED. Do not merge.`
  : `\nAll ${STAGES.length} stages passed.`)
process.exit(failed ? 1 : 0)
