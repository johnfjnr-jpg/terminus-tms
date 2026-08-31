// The Opportunity's dates, one rule set. Round 41, walk finding 5. PURE.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateDates, closedWonGoLive, DATE_FIELDS, isIsoDate } from '../../src/lib/opportunity-dates.js'

const NOW = '2026-08-31'
const v = (before, after, opts = {}) => validateDates(before, after, { now: NOW, ...opts })
const open = { status: 'Solution Alignment' }

test('all four fields are mapped, and one is not a payload key', () => {
  assert.deepEqual(Object.keys(DATE_FIELDS), ['estClose', 'actualClose', 'estGoLive', 'actualGoLive'])
  assert.equal(DATE_FIELDS.estClose.payloadKey, null,
    'estClose lives in opportunity_details.forecast_close_date, not the payload')
  assert.equal(DATE_FIELDS.estClose.stored, 'opportunity_details.forecast_close_date')
  for (const k of ['actualClose', 'estGoLive', 'actualGoLive']) {
    assert.equal(DATE_FIELDS[k].stored, 'payload')
  }
})

test('a date must be a real one, and 30 February is not', () => {
  assert.equal(isIsoDate('2026-09-14'), true)
  assert.equal(isIsoDate('2027-02-30'), false, 'Date would silently coerce this')
  assert.equal(isIsoDate('14/09/2026'), false)
  assert.equal(isIsoDate(''), false)
})

test('a. estimated close cannot be SET to the past, and a passed one WARNS', () => {
  // The whole finding: validation on ENTRY AND EDIT, never on a value merely
  // still there. The old rule validated an event and the defect was a state.
  assert.match(v({ ...open, estClose: '2026-12-01' }, { ...open, estClose: '2026-07-01' }).errors[0],
    /cannot be set to a date in the past/)
  assert.deepEqual(v({ ...open, estClose: '2026-12-01' }, { ...open, estClose: '2026-12-02' }).errors, [])

  // UNCHANGED AND ALREADY PAST: no error, and a warning that names the date.
  // This is the case that made a deal unsaveable from the Reference tab, which
  // sends the whole payload and re-sent a since-passed date on every save.
  const stale = v({ ...open, estClose: '2026-07-29' }, { ...open, estClose: '2026-07-29' })
  assert.deepEqual(stale.errors, [], 'a date that merely went stale must not block a save')
  assert.match(stale.warnings[0], /passed on 2026-07-29.*overdue against its own estimate/)

  // And a closed deal is not overdue against anything.
  assert.deepEqual(v({ status: 'Closed Won', estClose: '2026-07-29' },
    { status: 'Closed Won', estClose: '2026-07-29' }).warnings, [])
})

test('b. actual close is set at the transition, and never in the future', () => {
  // NOT WRITABLE ELSEWHERE. The live data carries one on a deal in Solution
  // Alignment, which is how this was found.
  assert.match(v(open, { ...open, actualClose: '2026-08-01' }).errors[0],
    /is set when the deal closes, not before/)

  // At the transition it is allowed, and defaults to the transition date.
  assert.deepEqual(v(open, { ...open, actualClose: NOW }, { closingTo: 'Closed Won' }).errors, [])
  // An earlier date may be entered.
  assert.deepEqual(v(open, { ...open, actualClose: '2026-08-20' }, { closingTo: 'Closed Won' }).errors, [])
  // A FUTURE ONE IS REFUSED. The live data carries 2026-10-14 on a Closed Won
  // deal, six weeks out, because nothing checked.
  assert.match(v(open, { ...open, actualClose: '2026-10-14' }, { closingTo: 'Closed Won' }).errors[0],
    /cannot be in the future. It records what happened/)
  // And an already-closed deal may correct it without a transition.
  assert.deepEqual(v({ status: 'Closed Won', actualClose: '2026-08-01' },
    { status: 'Closed Won', actualClose: '2026-08-02' }).errors, [])
})

test('c. estimated go live cannot be SET to the past, and Closed Won has rules', () => {
  assert.match(v({ ...open, estGoLive: '2026-12-01' }, { ...open, estGoLive: '2026-01-01' }).errors[0],
    /cannot be set to a date in the past/)
  // Unchanged and past does not block, which is the Reference-tab trap closed.
  assert.deepEqual(v({ ...open, estGoLive: '2026-01-01' }, { ...open, estGoLive: '2026-01-01' }).errors, [])

  // PRESENT AND BEFORE THE CLOSE DATE: invalid, and the transition asks for a
  // new one rather than silently moving it.
  const bad = v(open, { ...open, actualClose: '2026-08-20', estGoLive: '2026-08-10' }, { closingTo: 'Closed Won' })
  assert.ok(bad.errors.some(e => /before the close date of 2026-08-20. Give it a new one/.test(e)))
  // Present and on or after the close: untouched.
  assert.deepEqual(
    v(open, { ...open, actualClose: '2026-08-20', estGoLive: '2026-09-20' }, { closingTo: 'Closed Won' }).errors, [])

  // AND THE CASE THAT CAUGHT MY OWN FIRST TEST. A go live already SET and now
  // past is left alone, because `changed` is false: the entry-and-edit rule and
  // the close-date rule are different questions and only the second applies at
  // a transition. My first version of this test set both dates to a past day
  // and read the entry rule's refusal as a failure of the close-date rule.
  assert.deepEqual(
    v({ ...open, actualClose: '2026-08-20', estGoLive: '2026-08-25' },
      { status: 'Closed Won', actualClose: '2026-08-20', estGoLive: '2026-08-25' },
      { closingTo: 'Closed Won' }).errors, [],
    'a stored go live that has merely gone past is not re-validated at the transition')
})

test('c. ABSENT at Closed Won gets close plus one month, as an INITIAL VALUE', () => {
  // Architecture 11: written when the field comes into existence, and the
  // transition is that moment. Never a fallback.
  assert.deepEqual(closedWonGoLive({ actualClose: '2026-08-20' }), { estGoLive: '2026-09-20' })
  assert.deepEqual(closedWonGoLive({ actualClose: '2026-01-31' }), { estGoLive: '2026-03-03' },
    'month arithmetic overflows the way the platform does, and the test says which')
  // ALREADY SET IS LEFT ALONE, which is what makes it an initial value.
  assert.deepEqual(closedWonGoLive({ actualClose: '2026-08-20', estGoLive: '2026-11-01' }), {})
  // Nothing to compute from is nothing written, not a guess.
  assert.deepEqual(closedWonGoLive({}), {})
})

test('d. actual go live is on or after actual close, and early delivery is fine', () => {
  assert.match(v(open, { ...open, actualClose: '2026-08-20', actualGoLive: '2026-08-19' }).errors.at(-1),
    /cannot be before Actual Close Date/)
  assert.deepEqual(
    v({ status: 'Closed Won', actualClose: '2026-08-20', actualGoLive: '2026-08-20' },
      { status: 'Closed Won', actualClose: '2026-08-20', actualGoLive: '2026-08-20' }).errors, [])

  // NO CONSTRAINT AGAINST THE ESTIMATE. Delivering early is real and recording
  // it must not need a lie.
  assert.deepEqual(
    v({ status: 'Closed Won', actualClose: '2026-08-01', estGoLive: '2026-12-01' },
      { status: 'Closed Won', actualClose: '2026-08-01', estGoLive: '2026-12-01', actualGoLive: '2026-09-01' }).errors,
    [])
})

test('THE THREE STORED VIOLATIONS are what these rules would have refused', () => {
  // Reported for John rather than fixed: nothing re-validates what is already
  // stored, and these were all written before the rule that forbids them.
  const now = NOW

  // 1. an estimated close 33 days past, on an OPEN deal
  const one = validateDates({ status: 'Solution Alignment', estClose: '2026-07-29' },
    { status: 'Solution Alignment', estClose: '2026-07-29' }, { now })
  assert.deepEqual(one.errors, [], 'it does not block the save')
  assert.equal(one.warnings.length, 1, 'it warns, which is the ruling')

  // 2. an actual close six weeks in the FUTURE on a Closed Won deal
  const two = validateDates({ status: 'Closed Won' }, { status: 'Closed Won', actualClose: '2026-10-14' }, { now })
  assert.ok(two.errors.some(e => /cannot be in the future/.test(e)))

  // 3. a go live BEFORE its own close, in the live data
  const three = validateDates({ status: 'Closed Won' },
    { status: 'Closed Won', actualClose: '2026-10-14', actualGoLive: '2026-08-30' }, { now })
  assert.ok(three.errors.some(e => /cannot be before Actual Close Date/.test(e)))
})
