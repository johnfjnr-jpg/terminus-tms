// The numeric payload boundary. Round 38, before the Phase 2 reshape.
// Runs under `npm test` - pure functions, no database, no DOM.
//
// This file exists because the same defect has now appeared three times on the
// Commercials tab: a blank input coerced to 0 and then indistinguishable from a
// real zero. The tests below are the thing that stops it returning, so they
// assert the CAUSE is gone rather than that one symptom is absent.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  toNumberOrNull, isStorableNumeric, normaliseNumericPayload,
  numericOrDefault, WRITABLE_NUMERIC_KEYS, NUMERIC_DEFAULTS,
} from '../../src/lib/numeric-payload.js'
import { calculateDeal } from '../../src/lib/deal-calculator.js'

// ─────────────────────────────────────────────────────────────
// The read boundary
// ─────────────────────────────────────────────────────────────

test('toNumberOrNull: a blank box is null, never 0', () => {
  for (const blank of ['', '   ', null, undefined]) {
    assert.equal(toNumberOrNull(blank), null,
      `${JSON.stringify(blank)} must read as null, because 0 is a real business value and this is not it`)
  }
})

test('toNumberOrNull: a real zero survives as zero', () => {
  // The negative half. Without it the function could return null for everything
  // and every assertion above would still pass.
  assert.equal(toNumberOrNull(0), 0)
  assert.equal(toNumberOrNull('0'), 0)
  assert.equal(toNumberOrNull('0.00'), 0)
})

test('toNumberOrNull: absorbs the numeric strings already in the store', () => {
  // The seven distinct string values measured across all 17,618 revisions on
  // 2026-08-28. History is never rewritten, so these must read correctly for
  // as long as the records exist.
  for (const [stored, expected] of [['4', 4], ['6', 6], ['12', 12], ['12.75', 12.75], ['18', 18], ['24', 24], ['36', 36]]) {
    assert.equal(toNumberOrNull(stored), expected, `stored ${JSON.stringify(stored)} must read as ${expected}`)
  }
})

test('toNumberOrNull: junk is null rather than NaN', () => {
  for (const junk of ['abc', '12abc', {}, [], true, NaN, Infinity]) {
    assert.equal(toNumberOrNull(junk), null, `${JSON.stringify(junk)} must not become a number`)
  }
})

// ─────────────────────────────────────────────────────────────
// The write boundary
// ─────────────────────────────────────────────────────────────

test('isStorableNumeric: only a number or null may be stored', () => {
  for (const ok of [0, 36, 12.75, -1, null]) assert.equal(isStorableNumeric(ok), true, `${ok} should be storable`)
  for (const no of ['36', '', '  ', undefined, NaN, Infinity, {}, [], true]) {
    assert.equal(isStorableNumeric(no), false,
      `${JSON.stringify(no)} must be refused: an empty string errors on ::numeric and a numeric string is a second representation`)
  }
})

test('normaliseNumericPayload: every writable numeric is normalised, nothing else is touched', () => {
  const before = {
    ssExisting: '4', duration: '36', targetMargin: '', warrantyPct: 2, gstPct: null,
    installResp: 'Terminus Contractor - Per Unit', notes: [{ text: '12.75' }],
  }
  const after = normaliseNumericPayload(before)
  assert.equal(after.ssExisting, 4)
  assert.equal(after.duration, 36)
  assert.equal(after.targetMargin, null, 'a blank percentage is null, not 0')
  assert.equal(after.warrantyPct, 2)
  assert.equal(after.gstPct, null)
  assert.equal(after.installResp, 'Terminus Contractor - Per Unit', 'a non-numeric key is untouched')
  assert.deepEqual(after.notes, [{ text: '12.75' }], 'a numeric-looking string elsewhere is untouched')
  assert.deepEqual(before.ssExisting, '4', 'the input is not mutated')
})

test('normaliseNumericPayload: a key that was absent stays absent', () => {
  // Absent and null are different: absent leaves the record's value alone on
  // the merge, null clears it. Normalising must not invent the key.
  const after = normaliseNumericPayload({ ssExisting: 4 })
  assert.equal('duration' in after, false)
})

// ─────────────────────────────────────────────────────────────
// THE ONE THAT MATTERS: absent takes the default, not zero
// ─────────────────────────────────────────────────────────────

test('numericOrDefault: an absent PERCENTAGE takes the configured default', () => {
  assert.equal(numericOrDefault({}, 'targetMargin'), 30)
  assert.equal(numericOrDefault({ targetMargin: null }, 'targetMargin'), 30)
  assert.equal(numericOrDefault({ targetMargin: '' }, 'targetMargin'), 30)
  assert.equal(numericOrDefault({}, 'warrantyPct'), 2)
})

test('numericOrDefault: an explicit ZERO is honoured and is not the default', () => {
  // The discriminating half. If the function returned the default for anything
  // falsy, both of these would read 30 and 2 and the test above would still pass.
  assert.equal(numericOrDefault({ targetMargin: 0 }, 'targetMargin'), 0)
  assert.equal(numericOrDefault({ targetMargin: '0' }, 'targetMargin'), 0)
  assert.equal(numericOrDefault({ warrantyPct: 0 }, 'warrantyPct'), 0)
})

test('numericOrDefault: an absent COUNT is zero, not a default', () => {
  for (const key of ['ssExisting', 'ssNew', 'aqm', 'hemir', 'lumpSumCost', 'duration', 'recoveryMonths']) {
    assert.equal(numericOrDefault({}, key), 0, `${key} absent means none`)
  }
})

test('a null targetMargin prices at the default, not at zero margin', () => {
  // The point of the whole change, asserted through the real calculator rather
  // than through the helper: a deal that never had a margin set is not a deal
  // sold at cost.
  const inputs = (targetMargin) => ({
    ssUnitCost: 8000, ssUnits: 10, aqUnitCost: 0, aqUnits: 0, hemirUnitCost: 0, hemirUnits: 0,
    warrantyPct: numericOrDefault({ warrantyPct: null }, 'warrantyPct'),
    installLineItems: [], hostingLineItems: [],
    hardwareMargins: {
      hwSs: numericOrDefault({ targetMargin }, 'targetMargin'),
      hwAqm: 0, hwHemir: 0, hwWarranty: 0,
    },
    months: 0, structure: 'single',
  })

  const absent = calculateDeal(inputs(null))
  const explicitZero = calculateDeal(inputs(0))

  const hwSs = (r) => r.groups.hardwareGroup.rows.find((x) => x.key === 'hwSs')
  assert.equal(hwSs(absent).rawCost, 80000)
  assert.equal(hwSs(absent).rawPrice, 114286,
    'an absent margin must price at the 30% default: 80000 / (1 - 0.30)')
  assert.equal(hwSs(explicitZero).rawPrice, 80000,
    'an explicit zero margin must price at cost, which is a different answer')
  assert.notEqual(hwSs(absent).rawPrice, hwSs(explicitZero).rawPrice,
    'if these are equal the default has been swallowed and the defect is back')
})

test('the substitution is never written back', () => {
  // numericOrDefault reads. A payload that arrived without targetMargin still
  // has no targetMargin afterwards, so a version taken from it records what the
  // user set rather than what the calculator assumed.
  const payload = { ssExisting: 4 }
  numericOrDefault(payload, 'targetMargin')
  numericOrDefault(payload, 'warrantyPct')
  assert.deepEqual(payload, { ssExisting: 4 })
})

// ─────────────────────────────────────────────────────────────
// The manifest itself
// ─────────────────────────────────────────────────────────────

test('every writable numeric key has a default, and no default is a string', () => {
  for (const key of WRITABLE_NUMERIC_KEYS) {
    assert.equal(typeof NUMERIC_DEFAULTS[key], 'number',
      `${key} is writable and numeric, so it needs a default here rather than a literal at each reader`)
  }
})

test('no writable numeric can be silently coerced: the round trip refuses every non-number', () => {
  // The standing assertion the third occurrence of this defect earned. For each
  // of the twelve keys, a blank input normalises to null and null is storable,
  // while every string form is refused at the write boundary.
  for (const key of WRITABLE_NUMERIC_KEYS) {
    const normalised = normaliseNumericPayload({ [key]: '' })
    assert.equal(normalised[key], null, `${key}: blank must normalise to null`)
    assert.equal(isStorableNumeric(normalised[key]), true, `${key}: null must be storable`)
    assert.equal(isStorableNumeric(''), false, `${key}: a raw empty string must never be storable`)
    assert.equal(isStorableNumeric('36'), false, `${key}: a numeric string must never be storable`)
    assert.notEqual(normalised[key], 0, `${key}: blank must NOT become 0, which is the defect this file exists for`)
  }
})
