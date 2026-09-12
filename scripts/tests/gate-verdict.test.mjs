// F6 from the LEADS close: the gate summarised a SKIP as a PASS.
//
// These tests exist because the fault was in a line nobody could exercise
// without a seventeen-minute run, so it was never exercised.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gateVerdict } from '../lib/gate-verdict.mjs'

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
