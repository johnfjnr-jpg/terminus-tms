// ── SUPERSESSION IS A PRICING QUESTION, NOT A REVISION COUNT ──────────────
//
// Round 41, 2026-09-02. Runs under `npm test` - pure functions, no database.
//
// An opportunity revision bumps on a contact, an exit tick, a score or a date.
// None of those is a price, and the old rule voided an approved version on every
// one of them. On TT-SGP-SMARTC-112 eleven revisions had landed since V1 was
// issued, NONE of them touched a pricing field, and one of them was the version's
// OWN issue 674ms later, so the version superseded itself at birth.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decisionState, pricingChanged, namedChangedKeys, FROZEN_RATE_KEYS }
  from '../../src/lib/version-pricing.js'
import { CATALOG_ONLY_RATE_KEYS, OVERRIDABLE_RATE_KEYS, ALL_RATE_KEYS }
  from '../../src/lib/rate-resolution.js'

// The 26 decision keys measured off every live version snapshot, plus the six
// frozen rates, is the 32 a version carries.
const SNAPSHOT = Object.freeze({
  targetMargin: 30, duration: 60, warrantyPct: 2, structure: 'twoPhase',
  ssUnitCost: 1200, aqUnitCost: 800, hemirUnitCost: 400,
  hoSafesight: 10, hoAqm: 8, hoHemir: 6,
})
const RECORD = Object.freeze({ targetMargin: 30, duration: 60, warrantyPct: 2, structure: 'twoPhase' })

// ─────────────────────────────────────────────────────────────
// The line, stated rather than implied
// ─────────────────────────────────────────────────────────────

test('the frozen set IS the resolver\'s catalog-only set, not a copy of it', () => {
  // Verification 20. Two lists of the same six would agree today and drift the
  // first time a catalog rate is added.
  assert.deepEqual([...FROZEN_RATE_KEYS], [...CATALOG_ONLY_RATE_KEYS])
})

test('the four OVERRIDABLE rates are decisions, because the record can own them', () => {
  // The whole line in one assertion: a rate the opportunity may override is a
  // price somebody chose, and changing it must supersede.
  for (const k of OVERRIDABLE_RATE_KEYS) {
    assert.equal(FROZEN_RATE_KEYS.includes(k), false, `${k} must stay inside the comparison`)
    const was = { ...RECORD, [k]: 100 }
    assert.equal(pricingChanged(was, { ...RECORD, [k]: 250 }).changed, true,
      `overriding ${k} is a pricing decision and must supersede`)
  }
})

test('every rate key is classified, so a new one cannot be silently uncategorised', () => {
  // The guard that makes the line self-maintaining. Add a rate to the resolver
  // and it must land on one side or the other of this comparison.
  for (const k of ALL_RATE_KEYS) {
    const frozen = FROZEN_RATE_KEYS.includes(k)
    const decision = OVERRIDABLE_RATE_KEYS.includes(k)
    assert.equal(frozen !== decision, true,
      `${k} is neither exactly frozen nor exactly a decision; classify it`)
  }
})

test('a catalog rate is IN the snapshot and OUT of the comparison', () => {
  assert.equal(Object.keys(SNAPSHOT).length, 10)
  assert.equal(Object.keys(decisionState(SNAPSHOT)).length, 4,
    'the six catalog rates are excluded and the four decisions remain')
  for (const k of FROZEN_RATE_KEYS) assert.equal(k in decisionState(SNAPSHOT), false)
})

// ─────────────────────────────────────────────────────────────
// Both directions, because a rule that fires one way is not a rule
// ─────────────────────────────────────────────────────────────

test('identical pricing is not a change', () => {
  const r = pricingChanged(SNAPSHOT, RECORD)
  assert.equal(r.changed, false)
  assert.deepEqual(r.keys, [])
})

test('a batch turnover moving every catalog rate is not a change', () => {
  // Ruled 2026-09-02: catalog rates are a default applied at creation. After
  // that the opportunity owns its price and a later batch does not supersede an
  // issued version.
  const turned = { ...SNAPSHOT }
  for (const k of FROZEN_RATE_KEYS) turned[k] = 99999
  assert.equal(pricingChanged(turned, RECORD).changed, false)
})

test('a decision change IS a change, and it is named', () => {
  const r = pricingChanged(SNAPSHOT, { ...RECORD, targetMargin: 37 })
  assert.equal(r.changed, true)
  assert.deepEqual(r.keys, ['targetMargin'])
})

test('a non-pricing key on the record is not a change', () => {
  // The revision that used to void an approval: an exit tick, a contact, a date.
  const r = pricingChanged(SNAPSHOT, { ...RECORD, estCloseDate: '2027-03-15', proposalIssued: 4 })
  assert.equal(r.changed, false, 'the record moving is not the deal being re-priced')
})

test('the issue\'s OWN revision does not supersede the version it issued', () => {
  // The 674ms self-supersede, stated as an assertion.
  assert.equal(pricingChanged(SNAPSHOT, { ...RECORD, proposalIssued: 4 }).changed, false)
})

// ─────────────────────────────────────────────────────────────
// The out-set, and what it costs
// ─────────────────────────────────────────────────────────────

test('the comparison is an OUT-set, so a NEW pricing key is automatically inside it', () => {
  // Deliberate. A key added to the snapshot and not to any list is compared,
  // so the failure mode is a false supersede - which somebody notices - rather
  // than a silent miss, which nobody does.
  const r = pricingChanged({ ...SNAPSHOT, someNewPricingKey: 5 }, RECORD)
  assert.equal(r.changed, true)
  assert.deepEqual(r.keys, ['someNewPricingKey'])
})

test('a key absent from the record reads as a difference, not as equal', () => {
  // Verification 14 in the direction that matters: absent on one side is not a
  // match. `decisionState` iterates the SNAPSHOT's keys, so a decision the
  // record has dropped is still asked about.
  const r = pricingChanged({ ...SNAPSHOT, warrantyPct: 2 }, { targetMargin: 30, duration: 60, structure: 'twoPhase' })
  assert.equal(r.changed, true)
  assert.equal(r.keys.includes('warrantyPct'), true)
})

// ─────────────────────────────────────────────────────────────
// It refuses to answer with nothing on one side
// ─────────────────────────────────────────────────────────────

test('a version with NO snapshot is uncomparable, not unchanged', () => {
  // Verification 14. The comparison runs over the snapshot's keys, so an empty
  // snapshot has none, and payloadsDiffer({}, {}) is false. Returning
  // "unchanged" there is a confident all-clear from an empty comparison, on the
  // screen where somebody approves a price.
  for (const empty of [undefined, null, {}]) {
    const r = pricingChanged(empty, RECORD)
    assert.equal(r.comparable, false, `${JSON.stringify(empty)} must not answer`)
    assert.equal(r.changed, false, 'and it must not claim a change either')
  }
})

test('NO current pricing is uncomparable too, from the other side', () => {
  for (const missing of [undefined, null]) {
    assert.equal(pricingChanged(SNAPSHOT, missing).comparable, false)
  }
})

test('a snapshot of ONLY frozen rates is uncomparable, because it holds no decision', () => {
  // The subtle one: 6 keys present, 0 of them decisions, so there is still
  // nothing to compare and the answer must not be "unchanged".
  const ratesOnly = Object.fromEntries(FROZEN_RATE_KEYS.map((k) => [k, 100]))
  assert.equal(pricingChanged(ratesOnly, RECORD).comparable, false)
})

test('a real pair IS comparable, so the flag is not always false', () => {
  // The calibration. A flag that never reads true would make every version
  // uncomparable and every gate refuse, which is a different silent failure.
  assert.equal(pricingChanged(SNAPSHOT, RECORD).comparable, true)
  assert.equal(pricingChanged(SNAPSHOT, { ...RECORD, targetMargin: 37 }).comparable, true)
})

// ─────────────────────────────────────────────────────────────
// One formatter
// ─────────────────────────────────────────────────────────────

test('the key phrase caps at three and counts the rest', () => {
  assert.equal(namedChangedKeys([]), '')
  assert.equal(namedChangedKeys(['a']), 'a')
  assert.equal(namedChangedKeys(['a', 'b', 'c']), 'a, b, c')
  assert.equal(namedChangedKeys(['a', 'b', 'c', 'd']), 'a, b, c and 1 more')
  assert.equal(namedChangedKeys(['a', 'b', 'c', 'd', 'e']), 'a, b, c and 2 more')
  assert.equal(namedChangedKeys(undefined), '', 'a missing list must not throw on a screen')
})
