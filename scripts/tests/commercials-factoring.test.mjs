// ── COMMERCIALS FACTORING FIXES: R-CF1 to R-CF5, as ruled by John 2026-11-16 ──
//
// Expected figures are COPIED from the round's Phase 1 measurement (G3 priced
// as the goldens price it, its contract shortened) or WRITTEN AS RELATIONS to
// the loan schedule, never re-derived by the code under test. Sentences are the
// ruled wording, copied from the Phase 1 sign-off.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildLoanSchedule, buildCashFlowModel } from '../../src/lib/deal-calculator.js'
import { factoringPastEndSentence } from '../../src/lib/deal-inputs.js'
import { buildDealInputs } from '../../src/lib/deal-inputs.js'
import { NUMERIC_DEFAULTS } from '../../src/lib/numeric-payload.js'
import { buildExposures, ABSENCE_NOT_SUBSTITUTED } from '../../src/lib/approval-page.js'
import { validateFactoringTermAgainstDuration } from '../../src/lib/system-defaults.js'
import { readCode } from '../lib/strip-comments.mjs'
import { priceGoldenDeal } from '../golden-deals/engine.mjs'
import { G3 } from '../golden-deals/deals.mjs'

const price = (payload) => priceGoldenDeal({ ...G3, payload }).result
const g3 = (over = {}, factoring = {}) => ({ ...G3.payload, ...over, factoring: { ...G3.payload.factoring, ...factoring } })
const wholeLoan = (r, f) => buildLoanSchedule(r.cashFlow.principal, f.ratePct / 100, f.termMonths, f.method)
  .reduce((s, x) => s + x.interest, 0)
const PAST_END = (when) => `Factoring repayments run past the contract end (${when}): the finance cost includes them; the cash flow and closing position do not.`

// ── R-CF1: the finance cost is the whole loan's interest ─────────────────

for (const method of ['declining', 'straight']) {
  test(`R-CF1 ${method}: G3 on a 12-month contract carries the WHOLE 24-month loan's interest`, () => {
    const payload = g3({ duration: 12 }, { method })
    const r = price(payload)
    // Phase 1 measured 49,426.62 (declining) / 47,974.21 (straight) here before
    // the fix, against 72,525.69 / 68,862.50 for the whole loan.
    const whole = wholeLoan(r, payload.factoring)
    assert.equal(r.cashFlow.facInterest, whole, 'facInterest is the schedule summed, every repayment')
    assert.equal(r.financeCost, Math.round(whole))
    assert.equal(r.financeCost, method === 'declining' ? 72526 : 68863, 'Phase 1: 72,525.69 and 68,862.50 for the whole loan')
    assert.equal(r.cashFlow.rows.length, 12, 'the cash flow still runs to the contract\'s last month')
  })
}

test('R-CF1: a loan inside its contract is unchanged (G3 as pinned)', () => {
  const r = price(G3.payload)
  assert.equal(r.financeCost, 72526)
  assert.equal(r.factoringPastEnd, null)
})

// ── R-CF3: the months past the end, and the sentence ──────────────────────

test('R-CF3: factoringPastEnd names the months after the contract, one month or a range', () => {
  assert.deepEqual(price(g3({ duration: 12 })).factoringPastEnd, { from: 13, to: 25 })
  assert.deepEqual(price(g3({ duration: 24 })).factoringPastEnd, { from: 25, to: 25 })
  assert.equal(price(g3({ duration: 25 })).factoringPastEnd, null, 'a last repayment IN the last month is inside')
})

test('R-CF3: the ruled sentence, "month 37" for one month and "months 37 to 40" for a range', () => {
  assert.equal(factoringPastEndSentence({ from: 37, to: 37 }), PAST_END('month 37'))
  assert.equal(factoringPastEndSentence({ from: 37, to: 40 }), PAST_END('months 37 to 40'))
  assert.equal(factoringPastEndSentence(null), null)
})

test('R-CF3: the approval page finance note carries the flag', () => {
  const payload = g3({ duration: 24 })
  const finance = buildExposures(payload, price(payload)).find((x) => x.key === 'finance')
  assert.ok(finance.note.includes(PAST_END('month 25')), finance.note)
  const inside = buildExposures(G3.payload, price(G3.payload)).find((x) => x.key === 'finance')
  assert.ok(!inside.note.includes('past the contract end'), 'and only when it applies')
})

// ── R-CF4: a blank rate prices nothing and is flagged ─────────────────────

for (const blank of [null, undefined, '']) {
  test(`R-CF4: a blank rate (${JSON.stringify(blank)}) prices NOTHING and is flagged, never 1.5 and never 0`, () => {
    const r = price(g3({}, { ratePct: blank }))
    assert.equal(r.financeCost, null, 'Phase 1 measured 77,983 here, the 1.5% price')
    assert.equal(r.costIncomplete, true)
    assert.equal(r.factoringRateMissing, true)
    assert.equal(r.cashFlow.facInterest, 0)
    assert.ok(r.cashFlow.rows.every((x) => x.advance === 0 && x.facP === 0), 'no advance and no repayment for an unpriced facility')
  })
}

test('R-CF4: the three 1.5 defaults are gone', () => {
  assert.ok(!('factoringRatePct' in NUMERIC_DEFAULTS), 'numeric-payload.js')
  assert.equal(buildDealInputs({ factoring: { enabled: true, termMonths: 12 } }, { rates: {} }).factoringRatePct, null, 'deal-inputs.js')
  const cf = buildCashFlowModel({ months: 24, structure: 'single', recoveryMonths: 24, annualInvoicing: false,
    hardwarePriceAll: 0, hardwareCostAll: 100000, hostingMonthPrice: 0, hostingMonthCost: 0,
    factoringEnabled: true, factoringTermMonths: 12, factoringMethod: 'straight' })
  assert.equal(cf.facInterest, 0, 'deal-calculator.js: no rate passed is no rate, not 1.5')
  assert.ok('factoringRatePct' in ABSENCE_NOT_SUBSTITUTED, 'its absence is reported, as the term\'s is (Round 41 ruling 5)')
})

test('R-CF4: the approval page names the missing rate, and assumes none', () => {
  const payload = g3({}, { ratePct: null })
  const finance = buildExposures(payload, price(payload)).find((x) => x.key === 'finance')
  assert.match(finance.basis, /a rate nobody has recorded/)
  assert.doesNotMatch(finance.basis, /1\.5/)
  assert.match(finance.note, /its rate is not recorded/)
  const both = g3({}, { ratePct: null, termMonths: null })
  assert.match(buildExposures(both, price(both)).find((x) => x.key === 'finance').note, /its rate and term are not recorded/)
})

// ── R-CF2: the term ends inside the contract, refused only when changed ───

const DEAL = (duration, termMonths, enabled = true) => ({ duration, factoring: { enabled, termMonths, ratePct: 2 } })
const REFUSAL = 'The factoring term must be a whole number of months from 1 to 35, so every repayment falls inside the 36-month contract.'

test('R-CF2: a save that CHANGES the term past the limit is refused, in the term screen\'s words', () => {
  assert.equal(validateFactoringTermAgainstDuration(DEAL(36, 12), DEAL(36, 36)), REFUSAL)
  assert.equal(validateFactoringTermAgainstDuration(DEAL(36, 12), DEAL(36, 35)), null, '35 is the longest')
})

test('R-CF2: a shorter contract, or switching factoring on, is refused the same way', () => {
  assert.equal(validateFactoringTermAgainstDuration(DEAL(48, 36), DEAL(36, 36)), REFUSAL)
  assert.equal(validateFactoringTermAgainstDuration(DEAL(36, 36, false), DEAL(36, 36, true)), REFUSAL)
})

test('R-CF2 narrowed: a record ALREADY over the limit stays saveable on every other field', () => {
  // TT-SGP-SMARTC-003's shape: 36 on 36.
  const before = { ...DEAL(36, 36), notes: 'old' }
  assert.equal(validateFactoringTermAgainstDuration(before, { ...before, notes: 'new' }), null)
  assert.equal(validateFactoringTermAgainstDuration(DEAL(36, 36), DEAL('36', '36')), null, 'a number and its string are the same value')
})

test('R-CF2: absence is not a violation (the not-recorded path reports it)', () => {
  assert.equal(validateFactoringTermAgainstDuration(DEAL(36, 12), DEAL(36, null)), null)
  assert.equal(validateFactoringTermAgainstDuration(DEAL(36, 12), DEAL('', 36)), null)
  assert.equal(validateFactoringTermAgainstDuration(DEAL(36, 12), DEAL(36, 40, false)), null, 'factoring off')
})

test('R-CF2: the server and the client both call the ONE rule, the client before its write', () => {
  const route = readCode(new URL('../../src/routes/opportunities.js', import.meta.url))
  assert.match(route, /validateFactoringTermAgainstDuration\(before, \{ \.\.\.before, \.\.\.payload \}\)/)
  const main = readCode(new URL('../../frontend-react/src/main.tsx', import.meta.url))
  const check = main.indexOf('validateFactoringTermAgainstDuration(payload, { ...payload, ...p })')
  const write = main.indexOf('await saveDeal(opp.id, p, window.oppPatch!)')
  assert.ok(check > 0 && write > check, 'the client refuses BEFORE the write')
})
