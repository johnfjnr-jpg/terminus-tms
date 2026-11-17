// FROZEN_FIGURES R-FF4: the Closed Won pricing refusal and the won-version
// headline. Pure: no database. The database half (the trigger, the INSERT
// refusal, the derived won version) is in frozen-figures-db.test.mjs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  COMMERCIALS_OWNED_KEYS, CLOSED_WON_PRICING_REFUSAL, WON_STAGE,
  changedPricingKeys, closedWonPricingRefusal,
} from '../../src/lib/pricing-keys.js'
import { wonHeadline, NO_WON_VERSION_NOTE, totalContractValue } from '../../src/lib/opportunity-headline.js'

const RATES = { hoAqm: 100, inAqm: 500, hoHemir: 500, inHemir: 5000, inSsNew: 20000, aqUnitCost: 2000,
  ssUnitCost: 8000, hoSafesight: 200, inSsExisting: 2000, hemirUnitCost: 100000 }
const INPUTS = { ssNew: 10, aqm: 2, duration: 36, targetMargin: 30, structure: 'singlePhase', installResp: 'terminus' }

test('the ruled sentence, verbatim', () => {
  assert.equal(CLOSED_WON_PRICING_REFUSAL, "This deal is Closed Won; its pricing is the won version's and cannot change.")
  assert.equal(WON_STAGE, 'Closed Won')
})

test('a Closed Won pricing CHANGE is refused; every other stage is not', () => {
  assert.equal(closedWonPricingRefusal('Closed Won', { ssNew: 5 }, { ssNew: 6 }), CLOSED_WON_PRICING_REFUSAL)
  for (const stage of ['Qualification', 'Proposal', 'Negotiation', 'Closed Lost']) {
    assert.equal(closedWonPricingRefusal(stage, { ssNew: 5 }, { ssNew: 6 }), null, stage)
  }
})

test('a non-pricing edit to a Closed Won record is allowed (both halves: the key exists and is not pricing)', () => {
  assert.ok(!COMMERCIALS_OWNED_KEYS.includes('notes') && !COMMERCIALS_OWNED_KEYS.includes('summary'))
  assert.equal(closedWonPricingRefusal('Closed Won', { ssNew: 5 }, { notes: 'x', summary: 'y' }), null)
})

test('resending a saved price beside a non-pricing edit is not a change (the Commercials form resends every key)', () => {
  const before = { ssNew: 5, factoring: { enabled: true, ratePct: 2 }, marginOverrides: { hwSs: 40 } }
  assert.equal(closedWonPricingRefusal('Closed Won', before, { ...before, notes: 'x' }), null)
  assert.deepEqual(changedPricingKeys(before, { ...before, factoring: { enabled: true, ratePct: 3 } }), ['factoring'])
})

test('every one of the 32 pricing keys is refused on a change (a list member cannot be skipped)', () => {
  assert.equal(COMMERCIALS_OWNED_KEYS.length, 32)
  for (const k of COMMERCIALS_OWNED_KEYS) {
    assert.equal(closedWonPricingRefusal('Closed Won', { [k]: 1 }, { [k]: 2 }), CLOSED_WON_PRICING_REFUSAL, k)
  }
})

test('the client and the server read ONE list: payload.ts re-exports it rather than restating it', () => {
  const src = readFileSync(new URL('../../frontend-react/src/deal/payload.ts', import.meta.url), 'utf8')
  assert.match(src, /from '\.\.\/\.\.\/\.\.\/src\/lib\/pricing-keys\.js'/)
  assert.doesNotMatch(src, /export const COMMERCIALS_OWNED_KEYS = \[/)
})

test('not Closed Won: today\'s figures and nothing to say', () => {
  assert.deepEqual(wonHeadline({ status: 'Proposal', wonVersion: { frozen_figures: {} }, liveTcv: 123 }),
    { tcv: 123, note: null, source: 'live' })
})

test('Closed Won with no won version: today\'s figures, with the ruled sentence', () => {
  assert.equal(NO_WON_VERSION_NOTE, "No approved version was won; these are today's figures.")
  assert.deepEqual(wonHeadline({ status: 'Closed Won', wonVersion: null, liveTcv: 123 }),
    { tcv: 123, note: NO_WON_VERSION_NOTE, source: 'live' })
})

test('Closed Won with a frozen won version: ITS stored figure, never today\'s, labelled as its', () => {
  const v = { major: 2, minor: 0, status: 'issued', frozen_figures: { result: { totals: { contractNet: 258493 } } } }
  const h = wonHeadline({ status: 'Closed Won', wonVersion: v, liveTcv: 999999 })
  assert.equal(h.tcv, 258493)
  assert.notEqual(h.tcv, 999999)
  assert.equal(h.source, 'won-version')
  assert.match(h.note, /^The won version's figures \(V2\.0\), frozen when it was submitted\.$/)
})

test('Closed Won with a legacy won version: its OWN inputs at its OWN frozen rates, not the live catalog', () => {
  const v = { major: 1, minor: 0, status: 'issued', inputs: INPUTS, rates: { rates: RATES }, frozen_figures: null }
  const own = totalContractValue(INPUTS, RATES, 0)
  const live = totalContractValue({ ...INPUTS, ssNew: 50 }, { ...RATES, hoSafesight: 900 }, 0)
  assert.ok(own > 0 && live > 0 && own !== live, 'the two sides differ, so the assertion can tell them apart')
  const h = wonHeadline({ status: 'Closed Won', wonVersion: v, liveTcv: live })
  assert.equal(h.tcv, own)
  assert.equal(h.source, 'won-version-legacy')
  assert.match(h.note, /recomputed by today's engine: it was submitted before figures were frozen\.$/)
})
