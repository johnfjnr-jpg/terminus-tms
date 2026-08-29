// Cost basis ageing, its bands, and the clock it uses. Round 38.
// Runs under `npm test` - pure, no database.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { COST_BASIS_STALENESS, stalenessBand, ageInDays } from '../../src/lib/cost-basis.js'

// ─────────────────────────────────────────────────────────────
// The clock is as_of, not today
// ─────────────────────────────────────────────────────────────

test('AGE FOLLOWS as_of, so a historical query does not read as stale', () => {
  // as_of is a settable parameter: a historical question asks the catalog what
  // it held on a past day. Ageing against today would make every batch in that
  // query look stale when it was current, turning a legitimate read into a page
  // of false warnings.
  const batch = '2026-02-01'
  assert.equal(ageInDays(batch, '2026-03-01'), 28)
  assert.equal(ageInDays(batch, '2026-08-29'), 209)
  assert.equal(ageInDays(batch, '2027-06-01'), 485)
})

test('and the BAND follows with it', () => {
  // The discriminating half: one batch, three answers, because the question is
  // "how old was this on that day" rather than "how old is it now".
  const batch = '2026-02-01'
  assert.equal(stalenessBand(ageInDays(batch, '2026-03-01')).band, 'current')
  assert.equal(stalenessBand(ageInDays(batch, '2026-08-29')).band, 'ageing')
  assert.equal(stalenessBand(ageInDays(batch, '2027-06-01')).band, 'stale')
})

test('a missing date on either side is null, not a silent zero', () => {
  // A zero age would read as brand new, which is the most reassuring possible
  // answer to a question that has no answer.
  assert.equal(ageInDays(null, '2026-08-29'), null)
  assert.equal(ageInDays('2026-02-01', null), null)
  assert.equal(ageInDays('not a date', '2026-08-29'), null)
  assert.equal(stalenessBand(null).band, 'undated')
})

// ─────────────────────────────────────────────────────────────
// The bands, and the words
// ─────────────────────────────────────────────────────────────

test('the boundaries are where the business put them', () => {
  assert.equal(stalenessBand(182).band, 'current')
  assert.equal(stalenessBand(183).band, 'ageing')
  assert.equal(stalenessBand(365).band, 'ageing')
  assert.equal(stalenessBand(366).band, 'stale')
})

test('EVERY BAND SAYS SOMETHING DIFFERENT', () => {
  // A three-band policy where two bands carry the same words is two bands
  // wearing three names, and it would pass every other check in this file.
  const statements = [...COST_BASIS_STALENESS.bands.map((b) => b.statement), stalenessBand(null).statement]
  assert.equal(new Set(statements).size, statements.length,
    'two bands share a sentence: ' + statements.join(' | '))
  for (const s of statements) assert.ok(s && s.length > 20, `a band statement is missing or trivial: ${s}`)
})

test('the words live in ONE place, so the reference panel inherits them', () => {
  // The Commercials reference panel shows a salesperson the same rates before
  // any approver sees them, and they are the first person who could act on an
  // ageing basis. Verification 20: it reads these, it does not write its own.
  for (const b of COST_BASIS_STALENESS.bands) {
    assert.equal(stalenessBand(b.maxDays === Infinity ? 10000 : b.maxDays).statement, b.statement)
  }
})

// ─────────────────────────────────────────────────────────────
// The thresholds are judgement, and they are recorded as judgement
// ─────────────────────────────────────────────────────────────

test('the thresholds are locked to the date they were set', () => {
  const golden = JSON.parse(readFileSync(
    new URL('./fixtures/staleness-golden.json', import.meta.url), 'utf8'))
  assert.equal(COST_BASIS_STALENESS.setOn, golden.setOn)
  assert.deepEqual(
    COST_BASIS_STALENESS.bands.map((b) => ({ band: b.band, maxDays: b.maxDays === Infinity ? 'Infinity' : b.maxDays })),
    golden.bands,
    'a threshold moved without its date moving')
})

test('and they carry what replaces them, and what has to exist first', () => {
  // These are commercial judgement with no evidence behind them, and the thing
  // that stops that hardening is the successor being written down beside them.
  assert.match(COST_BASIS_STALENESS.basis, /judgement/)
  assert.match(COST_BASIS_STALENESS.basis, /no price history/)
  assert.match(COST_BASIS_STALENESS.replacedWhen, /second batch/,
    'the trigger is a data event that arrives on its own, not a date nobody is holding')
})
