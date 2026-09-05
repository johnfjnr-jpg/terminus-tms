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
  // ── THE PRE-STAGE. Migration Round 1, Phase 5 ──────────────────────────
  //
  // FIRST, and every HTTP stage below is marked `needsSession`. When this fails
  // those stages are not run at all and are reported as SKIPPED, because the
  // failure mode being removed is a run that reports fourteen findings when
  // nothing ran. See scripts/check-session.mjs for why it validates by use.
  {
    name: 'session precondition',
    cmd: ['node', ['scripts/check-session.mjs']],
    needs: 'the dev server on :3000 AND a live session-ref.json',
    gate: true,
  },
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
  // ── THE REACT TREE. Migration Round 1, Phase 3 ─────────────────────────
  //
  // Two stages, and they are two because they fail for different reasons and a
  // reader needs to know which. The suite says the components render what the
  // brief's twelve points require; the freshness stage says the bundle the
  // server actually serves is the one this source builds.
  //
  // BOTH ARE HERE RATHER THAN ONLY IN CI, because a gate that skips them reads
  // as complete. The whole point of the merge gate is that it is the thing
  // quoted at people.
  {
    name: 'react suite',
    cmd: ['npm', ['run', 'test:react']],
    needs: 'frontend-react/node_modules. Run: npm --prefix frontend-react ci',
  },
  {
    name: 'react bundle freshness',
    cmd: ['node', ['scripts/check-dist-fresh.mjs']],
    needs: 'frontend-react/node_modules, and it rebuilds then restores dist',
  },
  {
    name: 'HTTP precondition probe',
    cmd: ['node', ['scripts/probe-preconditions.mjs', 'GATE']],
    needs: 'the dev server on :3000 AND a live session-ref.json',
    needsSession: true,
  },
  {
    name: 'HTTP version-approval probe',
    cmd: ['node', ['scripts/probe-version-approval.mjs', 'GATE']],
    needs: 'the dev server on :3000 AND a live session-ref.json',
    needsSession: true,
  },
  {
    // The manual pricing-approval request: raised against an ISSUED version,
    // non-freezing, refused before Proposal where nothing is version-gated.
    name: 'HTTP pricing-approval probe',
    cmd: ['node', ['scripts/probe-pricing-approval.mjs', 'GATE']],
    needs: 'the dev server on :3000 AND a live session-ref.json',
    needsSession: true,
  },
  {
    // W2. A pricing approval closes by BOTH routes it can close by: its last
    // required track approving, and a newer major superseding it. Either fault
    // alone reproduced the walk's stuck "V1 is waiting on approval" banner on a
    // record whose V1 was fully approved, so both are exercised separately.
    name: 'HTTP review-closes probe',
    cmd: ['node', ['scripts/probe-review-closes.mjs', 'GATE']],
    needs: 'the dev server on :3000 AND a live session-ref.json',
    needsSession: true,
  },
  {
    // W5. The factoring term is an INITIAL VALUE and structure-dependent:
    // two-phase follows the recovery period, hybrid takes the admin default,
    // an override is never overwritten, and a cleared term stays cleared.
    // Architecture 11 proven on the field that was thought to be breaking it.
    name: 'HTTP term initial-value probe',
    cmd: ['node', ['scripts/probe-term-initial-value.mjs', 'GATE']],
    needs: 'the dev server on :3000 AND a live session-ref.json',
    needsSession: true,
  },
  {
    // W1. Probability is re-derived on every stage change, by whichever mover
    // writes records.status. It used to live in the transition route, which the
    // workflow does not go through: seven live opportunities had drifted to the
    // Qualification default, five of them at Proposal.
    name: 'HTTP stage-probability probe',
    cmd: ['node', ['scripts/probe-stage-probability.mjs', 'GATE']],
    needs: 'the dev server on :3000 AND a live session-ref.json',
    needsSession: true,
  },
  {
    // Item 4. Both halves of the from-Proposal check-and-go on one record, with
    // the stage-gated half proven unchanged on the same walk.
    name: 'HTTP version-gate probe',
    cmd: ['node', ['scripts/probe-version-gate.mjs', 'GATE']],
    needs: 'the dev server on :3000 AND a live session-ref.json',
    needsSession: true,
  },
  {
    // Item 4. The no-freeze guarantee rests on one WHERE clause, so it is
    // exercised in both directions rather than read.
    name: 'HTTP no-freeze probe',
    cmd: ['node', ['scripts/probe-no-freeze.mjs', 'GATE']],
    needs: 'the dev server on :3000 AND a live session-ref.json',
    needsSession: true,
  },
  {
    // Round 41. Constructs the state where a version's own (major, minor)
    // sequence disagrees with the opportunity's revision sequence, which is the
    // only way to test that the later-draft check follows the right one.
    name: 'HTTP version-order probe',
    cmd: ['node', ['scripts/probe-version-order.mjs', 'GATE']],
    needs: 'the dev server on :3000 AND a live session-ref.json',
    needsSession: true,
  },
  {
    name: 'HTTP commercial-gate probe',
    cmd: ['node', ['scripts/probe-commercial-gate.mjs', 'GATE']],
    needs: 'the dev server on :3000 AND a live session-ref.json',
    needsSession: true,
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
    needsSession: true,
  },
  {
    // Round 41, after the seventh walk. The whole ruled sequence: a save creates
    // no draft, a stranded draft is refused, an empty control is a real state,
    // and saving from current pricing creates the target.
    name: 'HTTP issue-target probe',
    cmd: ['node', ['scripts/probe-issue-target.mjs']],
    needs: 'the dev server on :3000 AND a live session-ref.json',
    needsSession: true,
  },
  {
    // Round 41 W-J. The criterion the migration added must be satisfiable by
    // issuing and by nothing else, or it is the "criterion nobody can tick" the
    // migration named as its own risk.
    name: 'HTTP proposal-issued probe',
    cmd: ['node', ['scripts/probe-proposal-issued.mjs']],
    needs: 'the dev server on :3000 AND a live session-ref.json',
    needsSession: true,
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
    needsSession: true,
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
// Walk 2026-09-03 adds probe-version-actions on the same terms: whether a
// control is on screen at a given stage, and whether four buttons and a
// sentence share one line at 1240, are properties of a browser.
//
// Walk 2026-09-04 adds probe-pulse-stall on the same terms. Whether a failing
// poll SAYS SO after two consecutive failures, stays quiet after one, and clears
// on the next success is a property of a browser and of injected responses.
// What runs unattended is in transition-requests.test.mjs.
//
// U9/U10, 2026-09-04 add probe-stale-recover on the same terms: two tabs racing
// on one record, and whether the second one's write recovers itself, is a
// property of a browser. Calibrated 1/4 against the pre-fix client.
//
// 2026-09-04 adds probe-version-join on the same terms: it reads the browser's
// banner and needs the real TT-SGP-SMARTC-118 history to assert the join
// against, so it is run by the round and reported. Calibrated 1/8 against the
// pre-fix code, reproducing the walk's own screen.
//
// L1-L7, 2026-09-04, adds probe-payment-layout on the same terms. Panel
// parentage, three widths, hover affordances and typed-not-assigned keystrokes
// are all properties of a browser. Its calc half is the exception in kind but
// not in venue: the milestone USD is read from the rendered field, because the
// claim is what the screen computes.
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

// Set when the pre-stage fails. Everything downstream of it is SKIPPED rather
// than run, so the summary cannot be read as a list of findings.
let sessionDead = false

for (const stage of STAGES) {
  if (stage.needsSession && sessionDead) {
    summary.push(`SKIP  ${stage.name.padEnd(26)} not run: the session precondition failed`)
    transcript.push(
      `${'='.repeat(72)}\n${stage.name}\nSKIPPED. The session precondition failed, so this stage was not run.\n` +
      `This is not a finding about ${stage.name}. Nothing was measured.\n${'='.repeat(72)}\n`)
    continue
  }
  const [bin, args] = stage.cmd
  const started = process.hrtime.bigint()
  const run = spawnSync(bin, args, { cwd: ROOT, encoding: 'utf8', shell: false })
  const ms = Number((process.hrtime.bigint() - started) / 1000000n)
  const output = `${run.stdout ?? ''}${run.stderr ?? ''}`
  // status is null when the process could not be spawned at all, which is a
  // different failure from a failing suite and must not read as one.
  const ok = run.status === 0
  if (!ok) failed++
  if (!ok && stage.gate) sessionDead = true

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
  let tally = n('tests') ? `  ${n('pass')}/${n('tests')} pass, ${n('fail')} fail` : ''

  // ── AND THE SAME FOR VITEST, WHICH COUNTS IN ITS OWN WORDS ─────────────
  //
  // Migration Round 1 Phase 3. node:test prints `# pass 440`; vitest prints
  // `Tests  37 passed (37)`, or `Tests  2 failed | 35 passed (37)`. The parser
  // above matched neither, so the React stage reported PASS with NO NUMBER -
  // and a report quoting "37/37" would then have been a hand-typed second
  // reader, which is the exact fault the paragraph above exists to prevent.
  //
  // Read from the run rather than added to it, both halves, so a stage that
  // ran zero tests cannot read as a stage that passed.
  if (!tally) {
    const v = output.match(/^\s*Tests\s+(?:(\d+) failed \| )?(\d+) passed(?: \| \d+ skipped)? \((\d+)\)/m)
    if (v) tally = `  ${v[2]}/${v[3]} pass, ${v[1] ?? 0} fail`
    else if (/^\s*Tests\s+no tests/m.test(output)) tally = '  0/0 pass, 0 fail'
  }
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
// A SKIPPED stage is not a passed one and not a failed one, and saying so is
// the whole point of the pre-stage: "1 of 19 stages FAILED" beside fourteen
// skips reads correctly, where fourteen failures did not.
const skipped = summary.filter((l) => l.startsWith('SKIP')).length
console.log(failed
  ? `\n${failed} of ${STAGES.length} stages FAILED${skipped ? `, ${skipped} NOT RUN` : ''}. Do not merge.`
  : `\nAll ${STAGES.length} stages passed.`)
if (skipped) {
  console.log('\nNothing was measured by the skipped stages. They are not findings.')
}
process.exit(failed ? 1 : 0)
