// ── R-TF9: THE TERM ENGINE'S LOAN SCHEDULE AGREES WITH COMMERCIALS', TO THE CENT ──
//
// TERM_FACTORING, ruled by John 2026-11-15/16. The cash flow and the loan
// schedule are RE-IMPLEMENTED in the term engine in exact arithmetic (R-TP1:
// it imports nothing; Architecture 14: no floats for money). Two
// implementations of one formula drift (Verification 20), so this file holds
// them together: the same loan through both, both methods.
//
// This file is the one place allowed to import BOTH engines. It is on the
// isolation test's ALLOWED_IMPORTERS with its reason; the term engine itself
// still imports nothing. Commercials code is read, never changed.
//
// ── HOW CENTS MEET FLOATS HONESTLY ──────────────────────────────────────────
//
//   1. Per month, interest and principal: the engine's cents equal Commercials'
//      float rounded half-up to cents. The last principal is excepted, because
//      it carries the remainder (spec 9.2), and is covered by 2.
//   2. The engine repays exactly the advance; Commercials' float principal
//      sums to it within n x 0.005.
//   3. Total interest: the engine's F equals the SUM OF Commercials' monthly
//      interest rounded to cents, exactly (the same schedule, summed), and the
//      float total within n x 0.005 (Verification 21: the most rounding can
//      legitimately reach, refused above it).
//   4. Timing: the term cash flow's advance and repayment rows match
//      buildCashFlowModel's advance, facP and facI, month by month (advance in
//      month 1, repayments months 2 to n + 1), which is what "as Commercials"
//      means for R-TF4 and R-TF10.
//
// THE TIE CASE. Where the exact interest sits on a half cent, a float can land
// a hair either side and round the other way, so a cent agreement there would
// be a coin toss. Every month is checked against the engine's EXACT fraction:
// the float must be within 1e-6 of it, and no month of any input may sit
// within 1e-6 cents of a half cent. An input that ever does is named here
// rather than passing or failing on luck.
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildLoanSchedule, buildCashFlowModel } from '../../src/lib/deal-calculator.js'
import { loanSchedule, priceQuote } from '../../src/lib/term-pricing.js'

const CASES = [
  // [advance cents, rate % per month, term months]
  [96000000n, '1.0', 12],
  [124000000n, '1.4', 24], // G3's rate and term
  [10000000n, '1.5', 36],
  [1234567n, '0.75', 7], // an odd principal and term
  [50000000n, '0', 12], // no interest
  [100000000n, '2.0', 1], // a one-month term
]
const METHODS = ['straight', 'declining']

// An exact fraction (dollars) scaled to an integer number of billionths of a
// cent, so a huge declining-balance fraction never meets a float on the way.
const SCALE = 10n ** 9n
const nanoCents = (f) => (f.n * 100n * SCALE) / f.d
const toDollars = (f) => Number(nanoCents(f)) / 1e11
const halfCentDistance = (f) => {
  const r = ((nanoCents(f) % SCALE) + SCALE) % SCALE
  const d = r - SCALE / 2n
  return d < 0n ? -d : d
}
const floatCents = (x) => Math.round(x * 100)

for (const method of METHODS) {
  for (const [advance, rate, n] of CASES) {
    const label = `${method}, ${Number(advance) / 100} at ${rate}%/month over ${n} months`
    const engine = loanSchedule(advance, rate, n, method)
    const commercials = buildLoanSchedule(Number(advance) / 100, Number(rate) / 100, n, method)

    test(`R-TF9 parity, ${label}: the same schedule, month by month`, () => {
      assert.equal(engine.months.length, n)
      assert.equal(commercials.length, n, 'Commercials built the same number of months')
      engine.months.forEach((e, i) => {
        const c = commercials[i]
        assert.ok(Math.abs(c.interest - toDollars(e.interestExact)) < 1e-6, `month ${i + 1}: float interest strays from exact`)
        assert.ok(halfCentDistance(e.interestExact) > 1000n, `month ${i + 1}: interest sits on a half cent; this input cannot discriminate`)
        assert.equal(Number(e.interestCents), floatCents(c.interest), `month ${i + 1}: interest`)
        if (i < n - 1) {
          assert.ok(halfCentDistance(e.principalExact) > 1000n, `month ${i + 1}: principal sits on a half cent`)
          assert.equal(Number(e.principalCents), floatCents(c.principal), `month ${i + 1}: principal`)
        }
      })
    })

    test(`R-TF9 parity, ${label}: principal repaid and total interest, to the cent`, () => {
      assert.equal(engine.months.reduce((s, x) => s + x.principalCents, 0n), advance, 'the engine repays exactly the advance')
      const tolerance = n * 0.005
      assert.ok(Math.abs(commercials.reduce((s, x) => s + x.principal, 0) - Number(advance) / 100) <= tolerance)
      assert.equal(Number(engine.interestCents), commercials.reduce((s, x) => s + floatCents(x.interest), 0),
        'F is Commercials\' schedule rounded per month and summed')
      assert.ok(Math.abs(Number(engine.interestCents) / 100 - commercials.reduce((s, x) => s + x.interest, 0)) <= tolerance,
        'and the float total within n x 0.005')
    })

    test(`R-TF9/R-TF10 timing, ${label}: advance in month 1, repayments months 2 to ${n + 1}, as buildCashFlowModel`, () => {
      const T = 60
      const q = priceQuote({ units: { safesight: 120 }, termMonths: T, paymentStructure: 'opex',
        factoring: { enabled: true, advance: `${advance / 100n}.${String(advance % 100n).padStart(2, '0')}`, ratePct: rate, termMonths: n, method } }, PARAMS)
      const cf = buildCashFlowModel({ months: T, structure: 'single', recoveryMonths: T, annualInvoicing: false,
        hardwarePriceAll: 0, hardwareCostAll: Number(advance) / 100, hostingMonthPrice: 0, hostingMonthCost: 0,
        factoringEnabled: true, factoringRatePct: Number(rate), factoringTermMonths: n, factoringMethod: method })
      let repaymentMonths = 0
      for (let m = 1; m <= T; m++) {
        const e = q.cashFlow.rows.find((r) => r.month === m)
        const c = cf.rows.find((r) => r.m === m)
        assert.equal(Number(e.advanceCents), floatCents(c.advance), `month ${m}: advance`)
        assert.equal(Number(-e.interestCents), floatCents(c.facI), `month ${m}: interest`)
        if (m !== n + 1) assert.equal(Number(-e.principalCents), floatCents(c.facP), `month ${m}: principal`)
        if (c.facP > 0) repaymentMonths++
      }
      assert.equal(repaymentMonths, n, 'Commercials repaid over the same months, so the comparison reached them')
    })
  }
}

const SEED = [{ from: 1, discountPct: '0' }, { from: 10, discountPct: '5' }, { from: 50, discountPct: '10' }, { from: 200, discountPct: '15' }]
const PARAMS = {
  TERMS: [12, 24, 36, 48, 60, 72, 84, 96, 108, 120], ANCHOR_TERM: 36,
  ANCHOR_MARGIN: { safesight: '90' }, SHORT_TERM_MARGIN: { safesight: '90' }, PROFIT_STEP: '0.00',
  VOLUME_BANDS_BY_PRODUCT: { safesight: SEED }, HW_UPFRONT_MARGIN: '20', MARGIN_FLOOR: '25', CURRENCY: 'USD',
  costs: { safesight: { hwCost: '8000.00', hostingMonthly: '200.00' } },
}
