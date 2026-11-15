// F6 from the LEADS close: the gate summarised a SKIP as a PASS.
//
// These tests exist because the fault was in a line nobody could exercise
// without a seventeen-minute run, so it was never exercised.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gateVerdict } from '../lib/gate-verdict.mjs'
import { stripComments } from '../lib/strip-comments.mjs'

const ROOT = new URL('../../', import.meta.url).pathname
const joined = (v) => v.lines.join('\n')

test('the healthy case still reads as it always did', () => {
  const v = gateVerdict({ stageCount: 22, failed: 0, skippedRequired: 0, skippedOther: 0 })
  assert.equal(v.exitCode, 0)
  assert.equal(joined(v), 'All 22 stages passed.')
})

test('THE FAULT: a skipped stage is never summarised as every stage passing', () => {
  // The exact shape of the LEADS close's first gate: 21 ran, the door stage
  // did not, nothing failed.
  const v = gateVerdict({ stageCount: 22, failed: 0, skippedRequired: 1, skippedOther: 0 })
  assert.doesNotMatch(joined(v), /All 22 stages passed/,
    'this is the defect: a run with an unanswered stage claiming every stage passed')
  assert.match(joined(v), /21 of 22 stages passed, 1 NOT RUN/)
  assert.match(joined(v), /UNANSWERED, not green/)
})

test('an ordinary run with a skipped required stage still exits 0', () => {
  // The recorded reason survives: puppeteer is not a dependency, and a gate
  // that goes red for a missing optional tool is one people learn to ignore.
  const v = gateVerdict({ stageCount: 22, failed: 0, skippedRequired: 1, skippedOther: 0 })
  assert.equal(v.exitCode, 0)
  assert.match(joined(v), /NOT valid for a round close/)
})

test('a ROUND CLOSE fails on a skipped required stage', () => {
  const v = gateVerdict({
    stageCount: 22, failed: 0, skippedRequired: 1, skippedOther: 0, roundClose: true })
  assert.equal(v.exitCode, 1, 'a round close may not rest on an unanswered stage')
  assert.match(joined(v), /A ROUND CLOSE MAY NOT REST ON THIS RUN/)
})

test('a round close does NOT fail on a skipped stage that is not required', () => {
  // The distinction is the whole point: required is a property of the stage,
  // not of how many skipped.
  const v = gateVerdict({
    stageCount: 22, failed: 0, skippedRequired: 0, skippedOther: 3, roundClose: true })
  assert.equal(v.exitCode, 0)
  assert.match(joined(v), /19 of 22 stages passed, 3 NOT RUN/)
  assert.doesNotMatch(joined(v), /MAY NOT REST/)
})

test('a real failure still reports as a failure, skips or not', () => {
  const a = gateVerdict({ stageCount: 22, failed: 1, skippedRequired: 0, skippedOther: 0 })
  assert.equal(a.exitCode, 1)
  assert.match(joined(a), /1 of 22 stages FAILED\. Do not merge\./)
  const b = gateVerdict({ stageCount: 22, failed: 1, skippedRequired: 1, skippedOther: 13 })
  assert.equal(b.exitCode, 1)
  assert.match(joined(b), /1 of 22 stages FAILED, 14 NOT RUN\. Do not merge\./)
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
