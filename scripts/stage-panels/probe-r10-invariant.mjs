// ── R10's INVARIANT, IN THE PROBE CONVENTION ────────────────────────────
//
// scripts/testbed-units/calibrate-server.mjs is already calibrated and already
// does everything this needs - verified snapshot, unique anchor, injection,
// byte-identical restore, a marker that refuses a rerun after a killed one -
// and it scores a run by reading `  FAIL  <named check>` lines. What it cannot
// read is `node --test` output.
//
// So this is the adapter rather than a fourth harness: it runs the invariant
// file and reprints each test in the convention that harness understands. The
// test NAME is what is anchored on, never the exit code, because a run can go
// red for a reason unrelated to the claim (Verification 9's clause).
//
// UNWIRED. Run: node --env-file=.env scripts/stage-panels/probe-r10-invariant.mjs
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '')
const FILE = 'scripts/tests/config-invariants.test.mjs'
const t0 = Date.now()
const r = spawnSync('node', ['--env-file=.env', '--test', FILE], { cwd: ROOT, encoding: 'utf8', timeout: 580000 })
const out = `${r.stdout}${r.stderr}`
const ms = Date.now() - t0

// A run that produced no result is STOPPED, never scored (Verification 48): a
// suite that never ran prints no test lines at all, which otherwise reads
// exactly like every test failing.
const lines = out.split('\n')
const results = []
for (const l of lines) {
  const m = /^\s*([✔✖])\s(.+?)\s\(\d/.exec(l)
  // The reporter prints a failing test TWICE, once inline and once in its
  // failure summary, so a naive push counts 26 checks in a run of 25 and the
  // total stops being a number the run emitted. Keyed by name, first wins.
  if (m && !results.some((t) => t.name === m[2])) results.push({ ok: m[1] === '✔', name: m[2] })
}
if (!results.length) {
  console.log(`  FAIL  the invariant suite produced no result in ${ms}ms (exit ${r.status})`)
  console.log(out.slice(-1200))
  process.exit(2)
}
for (const t of results) console.log(`  ${t.ok ? 'PASS' : 'FAIL'}  ${t.name}`)
const passed = results.filter((t) => t.ok).length
console.log(`\n${passed}/${results.length} checks PASS  (${ms}ms, exit ${r.status})`)
process.exit(passed === results.length ? 0 : 1)
