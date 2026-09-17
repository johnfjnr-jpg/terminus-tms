// REFUSE A COMMIT WHEN A SUITE IS RED.
//
// Ruled by John 2026-09-11, Leads round P2, as option (a): a mechanical fix
// rather than a third restatement of a rule that had failed twice while known.
//
// THE FAULT THIS REPLACES A RULE FOR. Twice in one phase I checked the REACT
// suite, saw it green, and committed with the PURE suite red:
//
//   daa90af   react 932/932, pure 511/512   four probes calling fetch directly
//   8ceaaf2   react 938/938, pure 510/512   two tests enforcing a superseded ruling
//
// The second was four commits after I caught the first and wrote it up.
// Verification 20's suite-attribution clause - "which script runs this file?" -
// was in CLAUDE.md, was quoted at myself, and did not help. What fails is that
// checking ONE suite feels identical to checking THE suite, and the feeling is
// the same in both cases. So the answer is not a better rule.
//
// ── WHAT IT RUNS, AND WHAT IT DELIBERATELY DOES NOT ──────────────────────
//
// The two HERMETIC suites always: no network, no session, ~16s together. Both
// red commits would have been refused by these alone. The React typecheck runs
// beside them (R13, below), for the same reason and at the same cost class.
//
// The database suite needs a live Supabase session and 35-60s. A hook that
// demanded one would make committing impossible whenever the session has
// expired - which happens often enough in this estate to have its own recovery
// procedure - and a hook people cannot run is a hook people bypass. So it runs
// when a session is live and is reported NOT RUN, loudly, when it is not.
//
// A SKIP IS NEVER SILENT. That is the whole difference between this and the
// habit it replaces: the output always says which suites were consulted, so a
// commit made without the database suite is a commit somebody can see was made
// without it.
//
// THE GATE REMAINS THE AUTHORITY. This is a fast guard against one specific
// fault, not a replacement for the round-close gate, and it says so.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// ── ROOT IS WHERE THIS FILE IS, NOT WHERE ONE LAPTOP KEEPS IT ────────────
//
// Ruling R7, Round A. This was the absolute path of one checkout, and every
// other checkout ran the suites of THAT one: measured in a git worktree with a
// red pure suite (582 pass, 1 fail), this script printed `PASS pure` and exited
// 0, because it had tested the main tree's green copy. A hook that reports on a
// different tree from the one being committed is a false clean, which is worse
// than no hook (Verification 12, the author's side).
//
// Derived from this module's own location, one directory up, so a worktree, a
// clone at another path or another machine each test themselves.
const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '')

function sessionIsLive() {
  try {
    const s = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
    return new Date((s.expires_at ?? 0) * 1000) > new Date()
  } catch { return false }
}

function run(label, args, cwd = ROOT) {
  const t0 = Date.now()
  try {
    execFileSync('npm', args, { cwd, encoding: 'utf8', stdio: 'pipe', timeout: 300000 })
    return { label, ok: true, ms: Date.now() - t0, out: '' }
  } catch (e) {
    return { label, ok: false, ms: Date.now() - t0, out: `${e.stdout ?? ''}${e.stderr ?? ''}` }
  }
}

const results = []
results.push(run('pure', ['test']))
results.push(run('react', ['run', 'test:react']))
// ── RULING R13, Round A: THE TYPECHECK IS A SUITE TOO ────────────────────
//
// vitest transpiles without typechecking, so a React change can pass `react`
// and still fail `tsc`. Measured: Round A Phase 4's abe38d6 passed this hook
// and failed the typecheck, and the remedy recorded was to run tsc by hand
// before each commit. That is a person-shaped guard and does not survive the
// next session. Hermetic like the two above: no network, no session.
results.push(run('typecheck', ['run', 'typecheck:react']))

const dbLive = sessionIsLive()
if (dbLive) results.push(run('database', ['run', 'test:db']))

console.error('')
for (const r of results) {
  console.error(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.label.padEnd(9)} ${(r.ms / 1000).toFixed(1)}s`)
}
if (!dbLive) {
  console.error('  NOT RUN  database  no live session (scripts/refresh-session.js)')
  console.error('           Reported, not skipped silently. The round-close gate is the authority.')
}

const red = results.filter((r) => !r.ok)
if (!red.length) {
  console.error('')
  process.exit(0)
}

console.error('')
console.error('COMMIT REFUSED: a suite is red.')
console.error('')
for (const r of red) {
  const tail = r.out.split('\n').filter((l) => /✖|not ok|AssertionError|FAIL|Error:|error TS/.test(l)).slice(0, 6)
  console.error(`  ${r.label}:`)
  for (const l of tail) console.error(`      ${l.trim().slice(0, 120)}`)
  if (!tail.length) console.error('      (no parseable failure line; run the suite directly)')
}
console.error('')
console.error('  Run the suite yourself and read it. This hook exists because checking ONE')
console.error('  suite feels identical to checking THE suite - it replaced a rule that failed')
console.error('  twice in one phase while its author was quoting it at himself.')
console.error('')
process.exit(1)
