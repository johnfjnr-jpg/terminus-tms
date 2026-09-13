// ── THE META-CHECK: IS EVERY MECHANICALLY-CHECKABLE CONTROL ENFORCED? ────
//
// The estate has repeatedly built a correct control and then not enforced
// that work routes through it. Four instances:
//
//   1. INTERACTION_STANDARDS.md - maintained, then abandoned.
//   2. check-state-fresh.mjs    - existed, wired to no gate stage.
//   3. edit.mjs + the journal   - built to stop a false commit message, and
//      bypassed, so the fault recurred TWICE. The journal deleted itself on
//      success, so routed and unrouted were indistinguishable: the guard
//      FAILED OPEN on the only case it existed to catch.
//   4. the puppeteer scratch install - present as a directory, not installed,
//      so a test skipped itself and reported nothing wrong.
//
// Closing four by hand does not fix the class. This is the stage that turns
// a built-but-unenforced control RED instead of leaving it to be discovered
// by tripping over it.
//
// ── IT FAILS CLOSED ──────────────────────────────────────────────────────
//
// Where it cannot determine whether a control is enforced, it FAILS and
// names what it could not decide. It never passes on "could not tell" - a
// check that passes when unsure is the silent failure mode the SCANNER
// WINDOW round killed, and instance 3 above is the same shape again.
//
// ── WHAT IT CANNOT DO, NAMED RATHER THAN IMPLIED ─────────────────────────
//
// It enforces MECHANICAL enforcement only: is a guard wired, did an edit
// route, does a dependency load. It cannot enforce JUDGEMENT - whether a
// document is maintained, whether a decision was sound, whether a promoted
// rule is being followed. Instance 1 is in that bucket and this stage does
// NOT cover it.
//
// A meta-check implying otherwise would be this round's own fault one level
// up, which is why the boundary is written here and not only in the report.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { readCode } from '../lib/strip-comments.mjs'

const ROOT = new URL('../../', import.meta.url).pathname
const read = (p) => readFileSync(join(ROOT, p), 'utf8')

// ── COMMENTS STRIPPED, AND THIS FILE EARNED THE LESSON IMMEDIATELY ───────
//
// Verification 39: prose satisfies a check meant for code. The registry
// entry below asks whether `edit.mjs` still deletes the journal. Its first
// version matched the raw source - and the SUPERSEDED-DESIGN COMMENT in that
// file contains the literal `unlinkSync(JOURNAL)`, explaining what the code
// no longer does.
//
// So the check failed on a file that was already correct, inside a round
// about guards, minutes after being written. `readCode` is the estate's own
// answer and it is used here rather than a cleverer regex.
const code = (p) => readCode(join(ROOT, p))

// FAIL CLOSED at the first step: everything below reads these, and a check
// that cannot read its own inputs must not report clean.
let pkg, verifyAll, hook
test('the meta-check can read its own inputs, or it reports nothing', () => {
  assert.doesNotThrow(() => { pkg = JSON.parse(read('package.json')) },
    'package.json unreadable, so no wiring question can be answered')
  assert.doesNotThrow(() => { verifyAll = read('scripts/verify-all.mjs') },
    'verify-all.mjs unreadable')
  assert.doesNotThrow(() => { hook = read('.githooks/pre-commit') },
    '.githooks/pre-commit unreadable')
})

const suiteText = () => Object.values(pkg.scripts ?? {}).join(' ')
const wiredAnywhere = (base) =>
  suiteText().includes(base) || verifyAll.includes(base) || hook.includes(base)

test('every test file is named by a suite, or nothing runs it', () => {
  const tests = readdirSync(join(ROOT, 'scripts/tests')).filter((f) => f.endsWith('.test.mjs'))
  assert.ok(tests.length > 0, 'no test files found at all, which is not a clean result')
  const unrun = tests.filter((f) => !suiteText().includes(f))
  assert.deepEqual(unrun, [],
    `test files that no npm script runs, so they cannot fail:\n  ${unrun.join('\n  ')}`)
})

test('every standing check is wired to a runner', () => {
  const checks = readdirSync(join(ROOT, 'scripts'))
    .filter((f) => /^check-.*\.mjs$/.test(f))
  assert.ok(checks.length > 0, 'no standing checks found, which is not a clean result')
  const unwired = checks.filter((f) => !wiredAnywhere(f))
  assert.deepEqual(unwired, [],
    `standing checks nothing runs:\n  ${unwired.join('\n  ')}`)
})

// ── THE REGISTRY: controls whose enforcement is a FACT, not a convention ─
//
// Enumerated by name ONLY because each names a specific mechanism whose
// absence is otherwise invisible. Verification 19 warns that a list fails
// silently on the member nobody added, so the structural checks above carry
// the general case and this carries the four that have actually failed.
const REGISTRY = [
  { what: 'the edit-routing guard runs in the pre-commit hook',
    holds: () => hook.includes('journal-guard.mjs') },
  { what: 'the routing guard exists',
    holds: () => existsSync(join(ROOT, 'scripts/hooks/journal-guard.mjs')) },
  { what: 'the journal ACCUMULATES rather than deleting on success',
    holds: () => !/unlinkSync\(JOURNAL\)/.test(code('scripts/lib/edit.mjs')) },
  { what: 'CURRENT_STATE staleness is a gate stage',
    holds: () => verifyAll.includes('check-state-fresh.mjs') },
  { what: 'the browser dependency is checked for FUNCTION, not presence',
    holds: () => verifyAll.includes('check-browser-usable.mjs') },
  { what: 'this meta-check is itself named by a suite',
    holds: () => suiteText().includes('enforcement.test.mjs') },
]

test('every registered control is enforced', () => {
  const broken = []
  for (const r of REGISTRY) {
    let ok
    try { ok = r.holds() } catch (e) {
      // FAIL CLOSED. An indeterminate answer is a failure, never a pass.
      broken.push(`${r.what}  -- INDETERMINATE: ${String(e).split('\n')[0]}`)
      continue
    }
    if (!ok) broken.push(r.what)
  }
  assert.deepEqual(broken, [],
    `controls that are built but NOT enforced:\n  ${broken.join('\n  ')}\n\n`
    + 'A built control nothing routes through is not a control. Wire it, or\n'
    + 'remove it - but it may not sit there looking like protection.')
})

test('OUT OF SCOPE is stated, so the green is not read as more than it is', () => {
  // Not a behaviour test. It asserts the boundary is WRITTEN in the file, so
  // a reader of a green gate cannot mistake mechanical enforcement for the
  // whole of it. Overclaiming coverage is the fault this round exists to fix.
  const self = read('scripts/tests/enforcement.test.mjs')
  assert.match(self, /It cannot enforce JUDGEMENT/,
    'the meta-check must state what it does not cover')
  assert.match(self, /whether a document is maintained/,
    'instance 1 lives in the unenforceable bucket and must be named')
})
