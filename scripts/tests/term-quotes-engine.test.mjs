// TERM_QUOTES: the pricing method, the term quote's value, and the goldens
// TQ-1 to TQ-3 (docs/pricing-spec.md v2.1, sections 11.8 and 14). Pure.
// FIXTURE PARAMS ONLY (scripts/tests/fixtures/term-quote-params.mjs); TQ-4 is
// the database's and lives in term-quotes-db.test.mjs (e).
//
// Every expected figure is the SPEC's, typed from section 11.8, never computed
// by the code under test (spec section 12).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatMoney } from '../../src/lib/term-pricing.js'
// RED FIRST, AND VISIBLE (John's SEQUENCE: tests fail first in their own
// commit). The hook refuses a red pure suite and suite-names-resolve refuses an
// unrun test file, so the honest form is node:test's todo: every test RUNS, its
// failure prints as todo, and the engine commit deletes this marker.
const RED_FIRST = { todo: 'TERM_QUOTES red first: built in the engine commit' }
// Until the engine commit the two new modules do not exist; a missing module
// is a todo failure inside each test, not a crash that hides every test.
const load = async (p) => { try { return await import(p) } catch (err) { if (err.code === 'ERR_MODULE_NOT_FOUND') return {}; throw err } }
const { PRICING_METHODS, NEW_OPPORTUNITY_PRICING_METHOD, pricingMethodOf, versionKindOf, creationPricingMethod } = await load('../../src/lib/pricing-method.js')
const { termQuoteValue, settingsChanged, priceTermVersion, TERM_PARAM_KEYS } = await load('../../src/lib/term-quote.js')
const { contractValueOfCents, contractValueOf } = await load('../../src/lib/contract-value.js')
const { headlineTcv, totalContractValue } = await load('../../src/lib/opportunity-headline.js')
import { tqParams, TQ1_INPUTS } from './fixtures/term-quote-params.mjs'

// ── 14.1 the pricing method ──────────────────────────────────────────────

test('14.1: two methods; a new opportunity is term_quote; an absent method reads as commercials (W)', RED_FIRST, () => {
  assert.deepEqual([...PRICING_METHODS].sort(), ['commercials', 'term_quote'])
  assert.equal(NEW_OPPORTUNITY_PRICING_METHOD, 'term_quote')
  assert.equal(pricingMethodOf({}), 'commercials')
  assert.equal(pricingMethodOf(null), 'commercials')
  assert.equal(pricingMethodOf({ pricingMethod: 'term_quote' }), 'term_quote')
  assert.equal(pricingMethodOf({ pricingMethod: 'commercials' }), 'commercials')
  assert.equal(versionKindOf({}), 'commercials', 'a row with no kind is Commercials')
  assert.equal(versionKindOf({ kind: 'term_quote' }), 'term_quote')
})

test('14.1: the creator may choose the initial method; nothing chosen is term_quote; anything else is refused', RED_FIRST, () => {
  assert.equal(creationPricingMethod(undefined), 'term_quote')
  assert.equal(creationPricingMethod(null), 'term_quote')
  assert.equal(creationPricingMethod('commercials'), 'commercials')
  assert.equal(creationPricingMethod('term_quote'), 'term_quote')
  assert.equal(creationPricingMethod('cost-up'), null)
})

// ── 14.4 one cents-to-dollars adapter, one unpriced definition ───────────

test('14.4: cents become dollars in ONE adapter, and zero is unpriced through contractValueOf', RED_FIRST, () => {
  assert.equal(contractValueOfCents(341400000n), 3414000)
  assert.equal(contractValueOfCents('348228000'), 3482280)
  assert.equal(contractValueOfCents(2845050n), 28450.5)
  assert.equal(contractValueOfCents(0n), null)
  assert.equal(contractValueOfCents(null), null)
  assert.equal(contractValueOf(0), null, 'the one definition is unchanged')
})

// ── TQ-1 ─────────────────────────────────────────────────────────────────

test('TQ-1: a new term opportunity, SafeSight 60 at 120 months: headline Base TCV 3,414,000.00 (monthly 28,450.00)', RED_FIRST, () => {
  const v = termQuoteValue(TQ1_INPUTS, tqParams())
  assert.equal(v.refusal, null)
  assert.equal(formatMoney(v.quote.tcvNetCents), '3,414,000.00')
  assert.equal(formatMoney(v.quote.monthlyTotalCents), '28,450.00')
  assert.equal(v.tcv, 3414000)
  const record = { pricingMethod: 'term_quote', termQuote: TQ1_INPUTS }
  assert.equal(headlineTcv(record, { termParams: tqParams(), catalog: { ssUnitCost: 1 } }), 3414000)
})

test('14.4: no units, no quote, or a quote the engine refuses, is unpriced, never 0.00', RED_FIRST, () => {
  const p = tqParams()
  for (const [why, q] of [
    ['no units', { ...TQ1_INPUTS, units: { safesight: 0 } }],
    ['no quote at all', undefined],
    ['a term the settings do not offer', { ...TQ1_INPUTS, termMonths: 7 }],
  ]) {
    const v = termQuoteValue(q, p)
    assert.equal(v.tcv, null, why)
    assert.ok(v.refusal?.code, `${why}: the refusal says why`)
    assert.equal(headlineTcv({ pricingMethod: 'term_quote', termQuote: q }, { termParams: p, catalog: {} }), null, why)
  }
})

test('14.4: a Commercials record\'s headline is the deal-sheet engine over the record, unchanged, whatever termQuote holds', RED_FIRST, () => {
  const payload = { ssNew: 10, targetMargin: 30, duration: 36 }
  const catalog = { ssUnitCost: 1200, inSsNew: 300, hoSafesight: 20 }
  const before = totalContractValue(payload, catalog, 0)
  assert.equal(headlineTcv(payload, { catalog, termParams: tqParams() }), before)
  assert.equal(headlineTcv({ ...payload, termQuote: TQ1_INPUTS }, { catalog, termParams: tqParams() }), before,
    'the method decides; a stray termQuote on a Commercials record is not priced')
})

// ── TQ-2: a draft reprices on today's settings ───────────────────────────

test('TQ-2: a draft saved at 500.00 reopens at 3,482,280.00 when the ladder moves to 510.00, and says settings changed', RED_FIRST, () => {
  const draft = { kind: 'term_quote', status: 'draft', inputs: TQ1_INPUTS, rates: { params: tqParams('500.00') } }
  const r = priceTermVersion(draft, tqParams('510.00'))
  assert.equal(formatMoney(r.quote.tcvNetCents), '3,482,280.00')
  assert.deepEqual(r.quote.lines[0].bands.map((b) => formatMoney(b.feeByYear[0])), ['510.00', '484.50', '459.00'])
  assert.equal(formatMoney(r.quote.monthlyTotalCents), '29,019.00')
  assert.equal(r.settingsChanged, true)
  const same = priceTermVersion(draft, tqParams('500.00'))
  assert.equal(same.settingsChanged, false)
  assert.equal(same.tcv, 3414000)
})

// ── TQ-3: a submitted version's figures stand ────────────────────────────

test('TQ-3: a version submitted at 500.00 still prices at 3,414,000.00 after the ladder moves', RED_FIRST, () => {
  const issued = { kind: 'term_quote', status: 'issued', inputs: TQ1_INPUTS, rates: { params: tqParams('500.00') } }
  const r = priceTermVersion(issued, tqParams('510.00'))
  assert.equal(r.tcv, 3414000)
  assert.equal(r.settingsChanged, false, 'a submitted version is not a draft: the question does not arise')
})

// ── 14.5: settings changed is a deep compare, never a timestamp ──────────

test('14.5: "settings changed" compares every value, and is blind to key order and to timestamps', RED_FIRST, () => {
  const a = tqParams()
  assert.equal(settingsChanged(a, tqParams()), false)
  const reordered = Object.fromEntries(Object.entries(tqParams()).reverse())
  assert.equal(settingsChanged(a, reordered), false, 'the same values in another order have not changed')
  assert.equal(settingsChanged(a, { ...tqParams(), updatedAt: '2026-11-20' }), true,
    'a key the snapshot does not hold is a difference, so a timestamp cannot ride along unnoticed')
  for (const k of TERM_PARAM_KEYS) {
    const moved = structuredClone(tqParams())
    moved[k] = k === 'TERMS' ? [12, 24] : k === 'costs' ? { safesight: { hwCost: '1.00', hostingMonthly: '1.00' } } : { changed: true }
    assert.equal(settingsChanged(a, moved), true, `${k} moving is a change`)
  }
  assert.equal(TERM_PARAM_KEYS.length, 8, 'the seven settings and costs')
})
