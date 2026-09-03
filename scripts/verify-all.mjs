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
    // The manual pricing-approval request: raised against an ISSUED version,
    // non-freezing, refused before Proposal where nothing is version-gated.
    name: 'HTTP pricing-approval probe',
    cmd: ['node', ['scripts/probe-pricing-approval.mjs', 'GATE']],
    needs: 'the dev server on :3000 AND a live session-ref.json',
  },
  {
    // W2. A pricing approval closes by BOTH routes it can close by: its last
    // required track approving, and a newer major superseding it. Either fault
    // alone reproduced the walk's stuck "V1 is waiting on approval" banner on a
    // record whose V1 was fully approved, so both are exercised separately.
    name: 'HTTP review-closes probe',
    cmd: ['node', ['scripts/probe-review-closes.mjs', 'GATE']],
    needs: 'the dev server on :3000 AND a live session-ref.json',
  },
  {
    // W1. Probability is re-derived on every stage change, by whichever mover
    // writes records.status. It used to live in the transition route, which the
    // workflow does not go through: seven live opportunities had drifted to the
    // Qualification default, five of them at Proposal.
    name: 'HTTP stage-probability probe',
    cmd: ['node', ['scripts/probe-stage-probability.mjs', 'GATE']],
    needs: 'the dev server on :3000 AND a live session-ref.json',
  },
  {
    // Item 4. Both halves of the from-Proposal check-and-go on one record, with
    // the stage-gated half proven unchanged on the same walk.
    name: 'HTTP version-gate probe',
    cmd: ['node', ['scripts/probe-version-gate.mjs', 'GATE']],
    needs: 'the dev server on :3000 AND a live session-ref.json',
  },
  {
    // Item 4. The no-freeze guarantee rests on one WHERE clause, so it is
    // exercised in both directions rather than read.
    name: 'HTTP no-freeze probe',
    cmd: ['node', ['scripts/probe-no-freeze.mjs', 'GATE']],
    needs: 'the dev server on :3000 AND a live session-ref.json',
  },
  {
    // Round 41. Constructs the state where a version's own (major, minor)
    // sequence disagrees with the opportunity's revision sequence, which is the
    // only way to test that the later-draft check follows the right one.
    name: 'HTTP version-order probe',
    cmd: ['node', ['scripts/probe-version-order.mjs', 'GATE']],
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
    name: 'HTTP write success probe',
    cmd: ['node', ['scripts/probe-write-success.mjs']],
    needs: 'the dev server on :3000 AND a live session-ref.json',
  },
  {
    // Round 41, after the seventh walk. The whole ruled sequence: a save creates
    // no draft, a stranded draft is refused, an empty control is a real state,
    // and saving from current pricing creates the target.
    name: 'HTTP issue-target probe',
    cmd: ['node', ['scripts/probe-issue-target.mjs']],
    needs: 'the dev server on :3000 AND a live session-ref.json',
  },
  {
    // Round 41 W-J. The criterion the migration added must be satisfiable by
    // issuing and by nothing else, or it is the "criterion nobody can tick" the
    // migration named as its own risk.
    name: 'HTTP proposal-issued probe',
    cmd: ['node', ['scripts/probe-proposal-issued.mjs']],
    needs: 'the dev server on :3000 AND a live session-ref.json',
  },
  {
    // Round 41 W6. A transition needing no approval used to raise a request
    // nothing could close, and an open request freezes the record: a walk
    // record was unmovable and uneditable from the moment it was raised. The
    // fourth claim in this probe is the discriminating one - a build that had
    // simply stopped opening requests would satisfy the other three.
    name: 'HTTP zero-track transition probe',
    cmd: ['node', ['scripts/probe-zero-track-transition.mjs']],
    needs: 'the dev server on :3000 AND a live session-ref.json',
  },
]

// ── WHAT IS DELIBERATELY NOT A STAGE, AND WHY ─────────────────────────────
//
// The BROWSER probes - probe-readonly-view, probe-dead-selectors,
// probe-strip-layout, probe-install-prose, probe-cost-basis-line, probe-pulse,
// probe-revision-adoption, probe-panel-stability - are run by the round and
// reported, not run by the gate. puppeteer is deliberately not a
// dependency of this repository, so a stage needing it would be red on any
// machine that had not scratch-installed a browser, and a gate that is red for
// a missing optional tool is a gate people learn to ignore.
//
// Round 41 W1 wanted probe-readonly-view here and it is not, for that reason.
// Its claim - every control on another user's record non-interactive, every
// control on your own still typeable - is measured by that probe and reported at
// the boundary. The part of W1 that CAN run unattended is asserted in the pure
// suite instead: the class is set once, from the record owner and the session,
// and the stylesheet makes it non-interactive rather than merely dim.
//
// Round 41, 2026-09-03 adds probe-decision-feedback on the same terms. Its
// claim - the pending state, the double-click guard and a VISIBLE refusal on
// whichever banner the click came from - is a property of a browser and of a
// person reading a screen, and is reported at the boundary. What runs
// unattended is scripts/tests/decision-surface.test.mjs: the handler resolves
// its surface from the clicked control rather than naming one, both banners
// carry the markers that let it, and a refusal has a floor when the refusal
// dissolves its own banner. Calibrated four-of-five red against the pre-fix
// frontend.
//
// Round 41 W3, 2026-09-03 adds probe-stage-tab-identity on the same terms. Its
// three claims - the current-stage dot follows the record, a deliberate tab
// selection survives a re-render, and a transition lands on the new stage - are
// properties of a browser. Calibrated red on the dot against the pre-fix
// frontend, with the other seven holding, which is what shows X1 and the
// transition landing were not traded for it.
//
// Round 41 W4/W5, 2026-09-03 add probe-version-range and
// probe-term-from-recovery on the same terms. Their claims - a version history
// that stays readable as minor versions accumulate, and a factoring term that
// takes the recovery period as an INITIAL value without ever overwriting one a
// person set - are properties of a browser and of typing into a field.
//
// probe-term-from-recovery SKIPS one of its three clauses and says so: the
// server applies system_defaults.factoringTermMonths on every write, so a deal
// cannot ARRIVE with the term not recorded, and a check that cannot reach its
// state is not evidence either way.
//
// Round 41 F4 adds probe-pulse on the same terms, and the split is the same.
// Its claim - a screen follows a record somebody else changed, within one poll
// interval and with no manual refresh - is a property of a BROWSER and cannot
// be asserted anywhere else. What can run unattended is asserted in the pure
// suite instead: the interval is one named constant, the tick uses the cheap
// endpoint, an unchanged record short-circuits before any re-read, the pulse is
// excluded from revision adoption, a hidden tab is guarded, and the manual
// control goes through the same re-read path as the poll.
//
// T4's probe-revision-adoption joins them on the same terms, and its unattended
// half is the AUDIT: a test asserts that every file appending a record revision
// reports one, in both directions, which is the part that would rot silently.
// What needs a browser is the hook's behaviour on a version-shaped response,
// and that is measured here and reported at the boundary.

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
