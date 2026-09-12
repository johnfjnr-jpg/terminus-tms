// R7's contract, derived from the BRIEF rather than from the module.
//
// The tms-round-method rule: tests for a replacement come from the contract,
// never from the code. R7 states the two formats, that a date site uses one
// and a timestamp site the other, and that no site renders raw. Everything
// below follows from that sentence plus Phase 0's measured absence behaviour.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatDate, formatTimestamp } from '../../src/lib/format-dates.js'

// The exact string Phase 0 photographed on the lead card, so the test is
// anchored on the real defect rather than on an invented sample.
const RAW_ON_THE_CARD = '2026-09-12T06:14:09.321Z'

test('R7: a timestamp renders DD/MM/YY HH:MM:SS', () => {
  assert.match(formatTimestamp(RAW_ON_THE_CARD), /^\d{2}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/)
})

test('R7: a date renders DD/MM/YY and carries no time', () => {
  assert.match(formatDate(RAW_ON_THE_CARD), /^\d{2}\/\d{2}\/\d{2}$/)
  assert.equal(formatDate('2026-09-12'), '12/09/26')
})

test('R7: no output is a raw ISO string', () => {
  for (const f of [formatDate, formatTimestamp]) {
    const out = f(RAW_ON_THE_CARD)
    assert.ok(!out.includes('T'), `${f.name} left a T in "${out}"`)
    assert.ok(!out.includes('Z'), `${f.name} left a Z in "${out}"`)
    assert.ok(!/\d{4}-\d{2}-\d{2}/.test(out), `${f.name} left an ISO date in "${out}"`)
  }
})

test('absence is the CALLER\'s to name, so the module returns empty', () => {
  // Phase 0 measured the sites disagreeing: '--' in app.js, AccountView,
  // headerStats and KeyContacts; '' in descriptors and stageTracks. Unifying
  // the shape must not silently unify the absence.
  for (const v of [null, undefined, '', '   ']) {
    assert.equal(formatDate(v), '')
    assert.equal(formatTimestamp(v), '')
  }
})

test('an unparseable value is returned as it stands, not blanked', () => {
  // descriptors.ts did this deliberately: showing what is stored beats showing
  // nothing, because the person can then see what is in the field.
  assert.equal(formatDate('not a date'), 'not a date')
  assert.equal(formatTimestamp('not a date'), 'not a date')
})

test('a date-only value does not shift a day, in ANY timezone', () => {
  // `new Date('2026-09-12')` is UTC midnight, so west of UTC getDate() gives
  // the 11th. Every formatter this module replaces had that hazard. Asserted
  // by construction rather than by trusting the runner's own zone: the day
  // field must equal the day in the string.
  for (const iso of ['2026-01-01', '2026-09-12', '2026-12-31']) {
    const [, , dd] = iso.split('-')
    assert.equal(formatDate(iso).slice(0, 2), dd, `${iso} shifted`)
  }
})

test('a date-only value given to formatTimestamp does not acquire 00:00:00', () => {
  // Architecture 11's reasoning: a value nobody entered is not displayed as
  // though it were. There is no time in the stored value, so none is shown.
  assert.equal(formatTimestamp('2026-09-12'), '12/09/26')
})

test('the time shown is the reader\'s own, not UTC', () => {
  const d = new Date(RAW_ON_THE_CARD)
  const out = formatTimestamp(RAW_ON_THE_CARD)
  const hh = String(d.getHours()).padStart(2, '0')
  assert.equal(out.slice(9, 11), hh)
})
