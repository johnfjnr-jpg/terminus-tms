// F6 from the LEADS close: the gate summarised a SKIP as a PASS.
//
// These tests exist because the fault was in a line nobody could exercise
// without a seventeen-minute run, so it was never exercised.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gateVerdict, skipsInside } from '../lib/gate-verdict.mjs'
import { stripComments } from '../lib/strip-comments.mjs'

const ROOT = new URL('../../', import.meta.url).pathname
const joined = (v) => v.lines.join('\n')

test('the healthy case still reads as it always did', () => {
  const v = gateVerdict({ stageCount: 22, failed: 0 })
  assert.equal(v.exitCode, 0)
  assert.equal(joined(v), 'All 22 stages passed.')
})

// ── G1, GATE HYGIENE 2026-11-15. SUPERSEDED, QUOTED NOT DELETED ───────────
// Three tests stood here and asserted F6's split: "an ordinary run with a
// skipped required stage still exits 0", "a ROUND CLOSE fails on a skipped
// required stage", and "a round close does NOT fail on a skipped stage that is
// not required". John ruled the split out: a stage that does not run to a PASS
// or FAIL result is a red gate, on every run. The reasoning they encoded is
// kept in scripts/lib/gate-verdict.mjs beside the supersession.

test('THE FAULT: a skipped stage is never summarised as every stage passing', () => {
  const v = gateVerdict({ stageCount: 22, failed: 0, notRun: [{ name: 'HTTP readonly-view probe', why: 'no browser' }] })
  assert.doesNotMatch(joined(v), /All 22 stages passed/)
  assert.match(joined(v), /21 of 22 stages passed; 1 NOT RUN\. Do not merge\./)
})

test('G1: a stage that did not run makes the gate RED, on an ordinary run, and is named', () => {
  const v = gateVerdict({ stageCount: 26, notRun: [
    { name: 'HTTP readonly-view probe', why: 'no browser (set PUPPETEER_PATH)' },
    { name: 'browser dependency is functional', why: 'no browser (set PUPPETEER_PATH)' }] })
  assert.equal(v.exitCode, 1, 'an unanswered stage is a failed gate, not a pass with a footnote')
  assert.match(joined(v), /NOT RUN\s+HTTP readonly-view probe: no browser/)
  assert.match(joined(v), /NOT RUN\s+browser dependency is functional: no browser/)
})

test('G1: required no longer decides it - a stage nobody marked required is red too', () => {
  const v = gateVerdict({ stageCount: 22, notRun: [{ name: 'CURRENT_STATE staleness', why: 'the session precondition stage failed' }] })
  assert.equal(v.exitCode, 1)
})

test('G1: a stage that skipped part of ITSELF is red, and says what it skipped', () => {
  const v = gateVerdict({ stageCount: 26, skippedInside: [{ name: 'HTTP term initial-value probe', holes: ['SKIP a branch'] }] })
  assert.equal(v.exitCode, 1)
  assert.match(joined(v), /25 of 26 stages passed; 1 SKIPPED INSIDE\. Do not merge\./)
  assert.match(joined(v), /SKIPPED INSIDE\s+HTTP term initial-value probe: SKIP a branch/)
})

test('G1: --round-close is accepted and changes nothing', () => {
  for (const notRun of [[], [{ name: 'x', why: 'y' }]]) {
    const a = gateVerdict({ stageCount: 5, notRun })
    const b = gateVerdict({ stageCount: 5, notRun, roundClose: true })
    assert.equal(a.exitCode, b.exitCode, 'the flag must not change the verdict')
  }
})

test('a real failure still reports as a failure, skips or not', () => {
  const a = gateVerdict({ stageCount: 22, failed: 1 })
  assert.equal(a.exitCode, 1)
  assert.match(joined(a), /21 of 22 stages passed; 1 FAILED\. Do not merge\./)
  const b = gateVerdict({ stageCount: 22, failed: 1, notRun: Array.from({ length: 14 }, (_, i) => ({ name: `s${i}`, why: 'the session precondition stage failed' })) })
  assert.equal(b.exitCode, 1)
  assert.match(joined(b), /7 of 22 stages passed; 1 FAILED, 14 NOT RUN\. Do not merge\./)
})

test('G1: skipsInside reads every kind of hole, and nothing that is not one', () => {
  // Calibrated both ways on synthetic output, so a green gate cannot come from
  // a reader that sees nothing.
  assert.deepEqual(skipsInside('ℹ tests 9\nℹ pass 8\nℹ skipped 1\nℹ todo 0\n'), ['node:test skipped 1'])
  assert.deepEqual(skipsInside('ℹ todo 2\n'), ['node:test todo 2'])
  assert.deepEqual(skipsInside('# skipped 3\n'), ['node:test skipped 3'])
  assert.deepEqual(skipsInside('      Tests  35 passed | 2 skipped (37)\n'), ['vitest skipped 2'])
  assert.deepEqual(skipsInside('      Tests  35 passed | 1 todo (36)\n'), ['vitest todo 1'])
  assert.deepEqual(skipsInside('PASS  a\nSKIP  weighted amount not exercised\n'), ['SKIP weighted amount not exercised'])
  // Not holes: zero counts, the gate's own SKIPPED banner, prose, indented text.
  assert.deepEqual(skipsInside('ℹ skipped 0\nℹ todo 0\n      Tests  37 passed (37)\n'), [])
  assert.deepEqual(skipsInside('SKIPPED. puppeteer is not available\n'), [])
  assert.deepEqual(skipsInside('the step was easy to skip here\n    SKIP inside a comment block\n'), [])
})


test('the door stage is the one marked required, and the gate reads --round-close', () => {
  // A test about the WIRING, because the function above can be perfect while
  // nothing calls it. Verification 9: the guard is proven by what breaks.
  const src = readFileSync(`${ROOT}scripts/verify-all.mjs`, 'utf8')
  assert.match(src, /required: true,\s*\n\s*name: 'HTTP readonly-view probe'/,
    'the door stage must carry required: true')
  assert.match(src, /process\.argv\.includes\('--round-close'\)/)
  assert.match(src, /gateVerdict\(\{/)
  // And the skip record must be structural, not parsed back out of the
  // printed summary - seven stage names are longer than the padding.
  assert.doesNotMatch(src, /summary\s*\n?\s*\.filter\(\(l\) => l\.startsWith\('SKIP'\)\)\s*\n?\s*\.map\(/,
    'skipped stages are recorded as objects, never recovered by parsing the summary')
})

// ── G4, GATE HYGIENE 2026-11-15: IMPORTING THE GATE MUST NOT RUN IT ──────
//
// An import of verify-all.mjs ran every stage in the background and left
// harness fixtures behind when it was killed. The live proof is one import
// with no child process and no rows; this holds the SHAPE that makes it true,
// so a later edit cannot put an effect back at module scope unnoticed. It is
// a source test on purpose: a test that imported the gate to check would, on
// the day the guard broke, start the gate inside the pure suite.
export function gateModuleScope(code) {
  const at = code.indexOf('function runGate() {')
  const effects = at < 0 ? []
    : [...code.slice(0, at).matchAll(/\b(spawnSync|writeFileSync|mkdirSync|process\.exit|console\.log)\(/g)].map((m) => m[1])
  return { hasRunGate: at >= 0, effects, guarded: /\nif \(IS_MAIN\) runGate\(\)\s*$/.test(code) }
}

test('G4: the gate has no effect at module scope, and runs only as the entry point', () => {
  const s = gateModuleScope(stripComments(readFileSync(`${ROOT}scripts/verify-all.mjs`, 'utf8'), 'js'))
  assert.ok(s.hasRunGate, 'verify-all.mjs has no runGate(), so the run is at module scope again')
  assert.deepEqual(s.effects, [], `effects before runGate() run on import: ${s.effects.join(', ')}`)
  assert.ok(s.guarded, 'the last statement must be `if (IS_MAIN) runGate()`, or an import runs the gate')
})

test('G4: the shape check fires on each way back to an import that runs', () => {
  const ok = 'const A = 1\nfunction runGate() {\n  spawnSync(x)\n}\n\nif (IS_MAIN) runGate()\n'
  assert.deepEqual(gateModuleScope(ok), { hasRunGate: true, effects: [], guarded: true }, 'healthy shape')
  assert.equal(gateModuleScope(ok.replace('if (IS_MAIN) runGate()', 'runGate()')).guarded, false, 'unguarded call')
  assert.deepEqual(gateModuleScope('spawnSync(y)\n' + ok).effects, ['spawnSync'], 'an effect at module scope')
  assert.equal(gateModuleScope('spawnSync(y)\n').hasRunGate, false, 'no runGate at all')
})
