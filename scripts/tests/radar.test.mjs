// DEAL RADAR Phase 3: the radar's pure rules, derived from the BRIEF and the
// mockup of record rather than from the module.
//
// Geometry anchors are the mockup's own numbers (prototypes/deal-radar-option-b.html):
// outer ring "240,50 373.2,146.7 322.3,303.3 157.7,303.3 106.9,146.7", the 50%
// ring "240,120 306.6,168.4 281.1,246.6 198.9,246.6 173.4,168.4". R-RAD3's
// boundary at exactly 0.5 is covered here because no live record has a lens
// at exactly half (brief Phase 3 proof b).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { RADAR, radarPoints, radarLabelAt, lensShortLabel, isLowCoverage, lastStageChangeAt } from '../../src/lib/radar.js'

const near = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b}`)
const parse = (s) => s.split(' ').map((p) => p.split(',').map(Number))

test('R-RAD1/R-RAD2: five full axes land on the mockup\'s outer ring, first at the top, clockwise', () => {
  const want = parse('240,50 373.2,146.7 322.3,303.3 157.7,303.3 106.9,146.7')
  radarPoints([1, 1, 1, 1, 1]).forEach((p, i) => { near(p.x, want[i][0], 0.15, `x${i}`); near(p.y, want[i][1], 0.15, `y${i}`) })
})

test('R-RAD1: half on every axis lands on the mockup\'s 50% ring', () => {
  const want = parse('240,120 306.6,168.4 281.1,246.6 198.9,246.6 173.4,168.4')
  radarPoints([0.5, 0.5, 0.5, 0.5, 0.5]).forEach((p, i) => { near(p.x, want[i][0], 0.15, `x${i}`); near(p.y, want[i][1], 0.15, `y${i}`) })
})

test('R-RAD1: a vertex\'s distance from the centre is fraction x ring radius, per axis', () => {
  const f = [5 / 7, 6 / 8, 0, 7 / 7, 2 / 8]
  radarPoints(f).forEach((p, i) => near(Math.hypot(p.x - RADAR.cx, p.y - RADAR.cy), f[i] * RADAR.r, 1e-9, `axis ${i}`))
})

test('R-RAD2: the axis count follows the input, and the second of four is due right', () => {
  const p = radarPoints([1, 1, 1, 1])
  assert.equal(p.length, 4)
  near(p[1].x, RADAR.cx + RADAR.r, 1e-9, 'x'); near(p[1].y, RADAR.cy, 1e-9, 'y')
})

test('R-RAD7: a zero, a non-number and an out-of-range fraction stay inside the ring', () => {
  const [z, nan, big, neg] = radarPoints([0, NaN, 3, -1])
  for (const q of [z, nan, neg]) { near(q.x, RADAR.cx, 1e-9, 'x'); near(q.y, RADAR.cy, 1e-9, 'y') }
  near(Math.hypot(big.x - RADAR.cx, big.y - RADAR.cy), RADAR.r, 1e-9, 'clamped')
})

test('labels sit within 2px of the mockup\'s five, with its anchors', () => {
  const want = [[240, 34, 'middle'], [384, 146, 'start'], [330, 328, 'start'], [150, 328, 'end'], [96, 146, 'end']]
  want.forEach(([x, y, anchor], i) => {
    const l = radarLabelAt(i, 5)
    near(l.x, x, 2, `label ${i} x`); near(l.y, y, 2, `label ${i} y`); assert.equal(l.anchor, anchor)
  })
})

test('R-RAD6: the five live lens names give COM ORG TEC LEG DD', () => {
  assert.deepEqual(['Commercial', 'Organisational', 'Technical', 'Legal', 'Deal dynamics'].map(lensShortLabel),
    ['COM', 'ORG', 'TEC', 'LEG', 'DD'])
})

test('R-RAD6: derived, not listed: a new name labels itself, short words and stray spaces included', () => {
  assert.equal(lensShortLabel('Delivery risk and timing'), 'DRAT')
  assert.equal(lensShortLabel('  supply   chain '), 'SC')
  assert.equal(lensShortLabel('IT'), 'IT')
  // Any whitespace separates words, not only a space. Added when the
  // injection sweep's split(' ') came back SILENT: runs of spaces survive it.
  assert.equal(lensShortLabel('supply\tchain'), 'SC')
})

test('R-RAD3: strictly under half is low; exactly half is not', () => {
  assert.equal(isLowCoverage({ scored: 3, total: 7 }), true)
  assert.equal(isLowCoverage({ scored: 4, total: 8 }), false, 'exactly 0.5')
  assert.equal(isLowCoverage({ scored: 4, total: 7 }), false)
  assert.equal(isLowCoverage({ scored: 0, total: 4 }), true)
})

test('R-RAD3/R-RAD7: a lens with nothing at the stage is never low coverage', () => {
  assert.equal(isLowCoverage({ scored: 0, total: 0 }), false)
})

test('R-RAD4: no stage change gives null', () => {
  assert.equal(lastStageChangeAt([], []), null)
  assert.equal(lastStageChangeAt([{ action: 'update', timestamp: '2026-08-25T09:00:00Z' }],
    [{ kind: 'transition', status: 'open', closed_at: null }]), null)
})

test('R-RAD4: the LATER of an audit transition and an approved request wins, compared as instants', () => {
  // As strings the audit stamp sorts AFTER the request, as instants it is
  // EARLIER by one millisecond.
  const audit = [{ action: 'transition', timestamp: '2026-08-25T09:33:17.973982+00:00' }]
  const reqs = [{ kind: 'transition', status: 'approved', closed_at: '2026-08-25T09:33:17.974Z' }]
  assert.equal(lastStageChangeAt(audit, reqs), '2026-08-25T09:33:17.974Z')
  const later = [{ action: 'transition', timestamp: '2026-08-25T09:33:18.000001+00:00' }]
  assert.equal(lastStageChangeAt(later, reqs), '2026-08-25T09:33:18.000001+00:00')
  // A case where TEXT order and TIME order disagree. Added when the sweep's
  // string-compare injection came back SILENT: both cases above sort the same
  // either way. 19:00 at +10:00 is 09:00Z, an hour BEFORE 10:00Z.
  assert.equal(lastStageChangeAt([{ action: 'transition', timestamp: '2026-08-25T19:00:00+10:00' }],
    [{ kind: 'transition', status: 'approved', closed_at: '2026-08-25T10:00:00Z' }]), '2026-08-25T10:00:00Z')
})

test('R-RAD4: each source alone is enough', () => {
  assert.equal(lastStageChangeAt([{ action: 'transition', timestamp: '2026-08-24T22:50:57.59399+00:00' }], []),
    '2026-08-24T22:50:57.59399+00:00')
  assert.equal(lastStageChangeAt([], [{ kind: 'transition', status: 'approved', closed_at: '2026-11-14T01:00:00Z' }]),
    '2026-11-14T01:00:00Z')
})

test('R-RAD4: a review request, an open, rejected or withdrawn request, and other audit actions are not stage changes', () => {
  const audit = [{ action: 'update', timestamp: '2026-12-01T00:00:00Z' }, { action: 'transition', timestamp: '2026-08-01T00:00:00Z' }]
  const reqs = [
    { kind: 'review', status: 'approved', closed_at: '2026-12-02T00:00:00Z' },
    { kind: 'transition', status: 'rejected', closed_at: '2026-12-03T00:00:00Z' },
    { kind: 'transition', status: 'withdrawn', closed_at: '2026-12-04T00:00:00Z' },
    { kind: 'transition', status: 'open', closed_at: null },
  ]
  assert.equal(lastStageChangeAt(audit, reqs), '2026-08-01T00:00:00Z')
})

test('R-RAD4: backward moves count: the latest move wins whatever its direction', () => {
  const audit = [
    { action: 'transition', timestamp: '2026-08-01T00:00:00Z', detail: { from: 'Qualification', to: 'Solution Alignment' } },
    { action: 'transition', timestamp: '2026-08-05T00:00:00Z', detail: { from: 'Solution Alignment', to: 'Qualification', direction: 'backward' } },
  ]
  assert.equal(lastStageChangeAt(audit, []), '2026-08-05T00:00:00Z')
})

test('R-RAD4: an unparseable stamp never wins', () => {
  assert.equal(lastStageChangeAt([{ action: 'transition', timestamp: 'garbage' }, { action: 'transition', timestamp: '2026-08-01T00:00:00Z' }], []),
    '2026-08-01T00:00:00Z')
})
