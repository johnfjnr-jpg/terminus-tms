// DEAL RADAR Phase 2: lensRollupAt and assessSeries, derived from the BRIEF.
//
// The behaviour list is DEAL_RADAR_BRIEF.md Phase 2 item 2 plus R-RAD1, R-RAD3
// and R-RAD4, and the asOf comparison ruled at the Phase 1 sign-off (instants).
// The fixture levels are the live "Deal evidence, five level" scale as read on
// 2026-11-14, so Unknown is the real Unknown: value 2, not satisfying, reason
// required.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lensRollupAt, assessSeries } from '../../src/lib/lens-rollup.js'

const EVIDENCE = [
  { value: 1, label: 'Not applicable', satisfies: true },
  { value: 2, label: 'Unknown', satisfies: false },
  { value: 3, label: 'Our hypothesis', satisfies: false },
  { value: 4, label: 'Buyer confirmed', satisfies: true },
  { value: 5, label: 'Verified', satisfies: true },
]
const crit = (key, lens, stages) => ({
  criterion_key: key, lens_id: lens, levels: EVIDENCE, stages: stages.map((stage) => ({ stage })),
})
const entry = (value, at) => ({ value, at, reason: 'r' })

// Lens L at Qualification asks a, b, c. d is the same lens at a later stage
// only; e is a different lens at the same stage. Neither may be counted.
const CRITERIA = [
  crit('a', 'L', ['Qualification']),
  crit('b', 'L', ['Qualification', 'Proposal']),
  crit('c', 'L', ['Qualification']),
  crit('d', 'L', ['Proposal']),
  crit('e', 'M', ['Qualification']),
]

test('an unscored criterion counts in total, and is neither met nor scored', () => {
  assert.deepEqual(lensRollupAt('L', CRITERIA, {}, 'Qualification'), { met: 0, total: 3, scored: 0 })
})

test('Unknown is scored and not met', () => {
  const payload = { a: [entry(2, '2026-08-01T00:00:00.000Z')] }
  assert.deepEqual(lensRollupAt('L', CRITERIA, payload, 'Qualification'), { met: 0, total: 3, scored: 1 })
})

test('met follows the level\'s satisfies flag, true and false', () => {
  const payload = {
    a: [entry(4, '2026-08-01T00:00:00.000Z')], // Buyer confirmed: satisfies
    b: [entry(3, '2026-08-01T00:00:00.000Z')], // Our hypothesis: does not
  }
  assert.deepEqual(lensRollupAt('L', CRITERIA, payload, 'Qualification'), { met: 1, total: 3, scored: 2 })
})

test('the LATEST entry decides met, whatever order the payload holds them in', () => {
  // Stored newest first on purpose: a reader taking [length - 1] of the raw
  // array would read the OLD level.
  const payload = { a: [entry(3, '2026-08-02T00:00:00.000Z'), entry(4, '2026-08-01T00:00:00.000Z')] }
  assert.equal(lensRollupAt('L', CRITERIA, payload, 'Qualification').met, 0)
})

test('a value with no matching level is scored and not met', () => {
  const payload = { a: [entry(9, '2026-08-01T00:00:00.000Z')] }
  assert.deepEqual(lensRollupAt('L', CRITERIA, payload, 'Qualification'), { met: 0, total: 3, scored: 1 })
})

test('asOf excludes a later entry, so latest means latest as at that moment', () => {
  const payload = { a: [entry(3, '2026-08-01T00:00:00.000Z'), entry(4, '2026-08-03T00:00:00.000Z')] }
  assert.deepEqual(lensRollupAt('L', CRITERIA, payload, 'Qualification', null), { met: 1, total: 3, scored: 1 })
  assert.deepEqual(lensRollupAt('L', CRITERIA, payload, 'Qualification', '2026-08-02T00:00:00.000Z'),
    { met: 0, total: 3, scored: 1 })
})

test('asOf is inclusive: an entry exactly at the stage change counts', () => {
  const payload = { a: [entry(4, '2026-08-02T00:00:00.000Z')] }
  assert.equal(lensRollupAt('L', CRITERIA, payload, 'Qualification', '2026-08-02T00:00:00.000Z').met, 1)
})

test('asOf before any entry: nothing is scored, total unchanged', () => {
  const payload = { a: [entry(4, '2026-08-01T00:00:00.000Z')], b: [entry(4, '2026-08-05T00:00:00.000Z')] }
  assert.deepEqual(lensRollupAt('L', CRITERIA, payload, 'Qualification', '2026-07-01T00:00:00.000Z'),
    { met: 0, total: 3, scored: 0 })
})

test('asOf compares INSTANTS: the audit log\'s microsecond +00:00 form against an entry\'s ms Z form', () => {
  // Both shapes as measured live in Phase 1. As strings, '...17.973Z' sorts
  // AFTER '...17.973982+00:00' and the entry would be wrongly excluded.
  const payload = { a: [entry(4, '2026-08-25T09:33:17.973Z')] }
  assert.equal(lensRollupAt('L', CRITERIA, payload, 'Qualification', '2026-08-25T09:33:17.973982+00:00').met, 1)
  // And the other side of it: a later entry by a millisecond is outside.
  const later = { a: [entry(4, '2026-08-25T09:33:17.974Z')] }
  assert.equal(lensRollupAt('L', CRITERIA, later, 'Qualification', '2026-08-25T09:33:17.973982+00:00').met, 0)
  // Same instant, a different offset spelling.
  const offset = { a: [entry(4, '2026-08-25T19:33:17.000+10:00')] }
  assert.equal(lensRollupAt('L', CRITERIA, offset, 'Qualification', '2026-08-25T09:33:17.000Z').met, 1)
})

test('an unparseable asOf throws rather than silently reading every entry', () => {
  assert.throws(() => lensRollupAt('L', CRITERIA, {}, 'Qualification', 'not a date'), /unparseable asOf/)
})

test('an empty lens at a stage: total 0, met 0, scored 0', () => {
  assert.deepEqual(lensRollupAt('Z', CRITERIA, { a: [entry(4, '2026-08-01T00:00:00.000Z')] }, 'Qualification'),
    { met: 0, total: 0, scored: 0 })
})

test('only this lens, only this stage', () => {
  // d is lens L at Proposal; e is lens M at Qualification. Both satisfied.
  const payload = { d: [entry(5, '2026-08-01T00:00:00.000Z')], e: [entry(5, '2026-08-01T00:00:00.000Z')] }
  assert.deepEqual(lensRollupAt('L', CRITERIA, payload, 'Qualification'), { met: 0, total: 3, scored: 0 })
  assert.deepEqual(lensRollupAt('L', CRITERIA, payload, 'Proposal'), { met: 1, total: 2, scored: 1 })
})

test('assessSeries sorts oldest first, copies, and answers [] for a non-array', () => {
  const raw = [entry(3, '2026-08-02T00:00:00.000Z'), entry(4, '2026-08-01T00:00:00.000Z')]
  const s = assessSeries(raw)
  assert.deepEqual(s.map((e) => e.value), [4, 3])
  assert.equal(raw[0].value, 3, 'the payload array itself is not reordered')
  for (const v of [undefined, null, 'x', {}]) assert.deepEqual(assessSeries(v), [])
})
