// ── TERM PRICING GOLDENS: docs/pricing-spec.md v1.3, sections 10 and 11 ──
//
// Every expected figure below is COPIED from the spec as a string, never
// computed by the code under test (spec section 12, brief Phase 1). Where a
// parameter-flow case needs a figure the spec does not print, the derivation
// is written beside it from the spec's own formulas, so a reader can check it
// without running anything.
//
// The engine is src/lib/term-pricing.js. It must reproduce these exactly, to
// the cent, and margins and savings to 1 dp.

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  priceQuote, unitEconomics, termLadder, normaliseParams,
  formatMoney, formatPct, TermPricingError, articleFor,
} from '../../src/lib/term-pricing.js'

// Spec section 3, as written. Costs: SafeSight at the reference figures of
// section 10, and TEST-B, the section 11 fixture (NOT a real product).
// v1.3 (B1): the default TERMS runs every year to ten. 108 is new.
const SPEC_PARAMS = Object.freeze({
  TERMS: [12, 24, 36, 48, 60, 72, 84, 96, 108, 120],
  ANCHOR_TERM: 36,
  ANCHOR_MARGIN: { safesight: '90', 'TEST-B': '90' },
  SHORT_TERM_MARGIN: { safesight: '90', 'TEST-B': '90' },
  PROFIT_STEP: '0.00',
  VOLUME_BANDS: [
    { from: 1, discountPct: '0' },
    { from: 10, discountPct: '5' },
    { from: 50, discountPct: '10' },
    { from: 200, discountPct: '15' },
  ],
  HW_UPFRONT_MARGIN: '20',
  MARGIN_FLOOR: '25',
  CURRENCY: 'USD',
  costs: {
    safesight: { hwCost: '8000.00', hostingMonthly: '200.00' },
    'TEST-B': { hwCost: '2000.00', hostingMonthly: '50.00' },
  },
})

const withParams = (over) => ({ ...SPEC_PARAMS, ...over })
const quote = (units, termMonths, extra = {}, params = SPEC_PARAMS) =>
  priceQuote({ units, termMonths, paymentStructure: 'opex', ...extra }, params)
// v1.6 (TP_CAPEX, C-3): the escalator is the CPI, and it has a mode.
const PUB = (rate, S) => ({ cpiMode: 'published', escalatorPct: rate, ...(S ? { escalatorStartYear: S } : {}) })
const LOCK = (rate, S) => ({ cpiMode: 'locked', escalatorPct: rate, ...(S ? { escalatorStartYear: S } : {}) })
const money = (c) => formatMoney(c)
const pct = (r) => formatPct(r, 1)
// The spec prints a premium as "+105.3%" and a saving as "−23.8%" (U+2212).
const vsAnchor = (saving) => {
  const premium = formatPct({ n: -saving.n, d: saving.d }, 1)
  return premium.startsWith('-') ? `−${premium.slice(1)}%` : `+${premium}%`
}

// ── 10.1 Per unit, 1 to 9 units ──────────────────────────────────────────

const T10_1 = [
  // term, monthly fee, vs 36, TCV per unit, cost per unit, profit per unit, margin
  [12, '8,666.67', '+105.3%', '104,000.04', '10,400.00', '93,600.04', '90.0'],
  [24, '5,333.33', '+26.3%', '127,999.92', '12,800.00', '115,199.92', '90.0'],
  [36, '4,222.22', 'list', '151,999.92', '15,200.00', '136,799.92', '90.0'],
  [48, '3,216.67', '−23.8%', '154,400.16', '17,600.00', '136,800.16', '88.6'],
  [60, '2,613.33', '−38.1%', '156,799.80', '20,000.00', '136,799.80', '87.2'],
  [72, '2,211.11', '−47.6%', '159,199.92', '22,400.00', '136,799.92', '85.9'],
  [84, '1,923.81', '−54.4%', '161,600.04', '24,800.00', '136,800.04', '84.7'],
  [96, '1,708.33', '−59.5%', '163,999.68', '27,200.00', '136,799.68', '83.4'],
  [108, '1,540.74', '−63.5%', '166,399.92', '29,600.00', '136,799.92', '82.2'],
  [120, '1,406.67', '−66.7%', '168,800.40', '32,000.00', '136,800.40', '81.0'],
]

for (const [T, fee, vs, tcv, cost, profit, margin] of T10_1) {
  test(`10.1 per unit at ${T} months`, () => {
    const u = unitEconomics('safesight', T, SPEC_PARAMS)
    const b = u.bands[0]
    assert.equal(money(b.feeCents), fee, 'monthly fee')
    assert.equal(T === 36 ? 'list' : vsAnchor(u.savingVsAnchor), vs, 'vs 36-month fee')
    assert.equal(money(b.tcvCents), tcv, 'TCV per unit')
    assert.equal(money(u.costCents), cost, 'cost per unit')
    assert.equal(money(b.profitCents), profit, 'profit per unit')
    assert.equal(pct(b.margin), margin, 'margin')
    // The same row through the quote path, 1 unit: the two paths must agree.
    const q = quote({ safesight: 1 }, T)
    assert.equal(money(q.tcvNetCents), tcv, 'quote TCV, 1 unit')
    assert.equal(pct(q.grossMargin), margin, 'quote margin, 1 unit')
  })
}

// ── 10.2 Band fees ───────────────────────────────────────────────────────

const T10_2 = [
  [12, '8,666.67', '8,233.33', '7,800.00', '7,366.67'],
  [24, '5,333.33', '5,066.67', '4,800.00', '4,533.33'],
  [36, '4,222.22', '4,011.11', '3,800.00', '3,588.89'],
  [48, '3,216.67', '3,055.83', '2,895.00', '2,734.17'],
  [60, '2,613.33', '2,482.67', '2,352.00', '2,221.33'],
  [72, '2,211.11', '2,100.56', '1,990.00', '1,879.44'],
  [84, '1,923.81', '1,827.62', '1,731.43', '1,635.24'],
  [96, '1,708.33', '1,622.92', '1,537.50', '1,452.08'],
  [108, '1,540.74', '1,463.70', '1,386.67', '1,309.63'],
  [120, '1,406.67', '1,336.33', '1,266.00', '1,195.67'],
]

for (const [T, ...fees] of T10_2) {
  test(`10.2 band fees at ${T} months`, () => {
    const u = unitEconomics('safesight', T, SPEC_PARAMS)
    assert.deepEqual(u.bands.map((b) => money(b.feeCents)), fees)
  })
}

// ── 10.3 Worst-case margin ───────────────────────────────────────────────

const T10_3 = [
  [36, '90.0', '89.5', '88.9', '88.2'],
  [60, '87.2', '86.6', '85.8', '85.0'],
  [84, '84.7', '83.8', '82.9', '81.9'],
  [120, '81.0', '80.0', '78.9', '77.7'],
]

for (const [T, ...margins] of T10_3) {
  test(`10.3 worst-case margin at ${T} months`, () => {
    const u = unitEconomics('safesight', T, SPEC_PARAMS)
    assert.deepEqual(u.bands.map((b) => pct(b.margin)), margins)
  })
}

// ── Section 11: T1 to T21 ────────────────────────────────────────────────

test('T1 1 unit, 36: TCV 151,999.92, margin 90.0%', () => {
  const q = quote({ safesight: 1 }, 36)
  assert.equal(money(q.tcvNetCents), '151,999.92')
  assert.equal(pct(q.grossMargin), '90.0')
})

test('T2 9 units, 36: TCV 1,367,999.28', () => {
  assert.equal(money(quote({ safesight: 9 }, 36).tcvNetCents), '1,367,999.28')
})

test('T3 10 units, 36: TCV 1,512,399.24, margin 89.9%', () => {
  const q = quote({ safesight: 10 }, 36)
  assert.equal(money(q.tcvNetCents), '1,512,399.24')
  assert.equal(pct(q.grossMargin), '89.9')
})

test('T4 and T5: 49 then 50 units at 60, no cliff', () => {
  const t4 = quote({ safesight: 49 }, 60)
  const t5 = quote({ safesight: 50 }, 60)
  assert.equal(money(t4.tcvNetCents), '7,369,606.20')
  assert.equal(money(t5.tcvNetCents), '7,510,726.20')
  assert.ok(t5.tcvNetCents > t4.tcvNetCents, 'T5 must be MORE than T4')
})

test('T6 120 units, 60: TCV 17,389,126.20, margin 86.2%', () => {
  const q = quote({ safesight: 120 }, 60)
  assert.equal(money(q.tcvNetCents), '17,389,126.20')
  assert.equal(pct(q.grossMargin), '86.2')
})

test('T7 and T8: 199 then 200 units at 84, no cliff', () => {
  const t7 = quote({ safesight: 199 }, 84)
  const t8 = quote({ safesight: 200 }, 84)
  assert.equal(money(t7.tcvNetCents), '29,411,221.56')
  assert.equal(money(t8.tcvNetCents), '29,548,581.72')
  assert.ok(t8.tcvNetCents > t7.tcvNetCents, 'T8 must be MORE than T7')
})

test('T9 250 units, 120: TCV 38,039,088.00, margin 79.0%', () => {
  const q = quote({ safesight: 250 }, 120)
  assert.equal(money(q.tcvNetCents), '38,039,088.00')
  assert.equal(pct(q.grossMargin), '79.0')
})

test('T10 1 unit, 12: TCV 104,000.04', () => {
  assert.equal(money(quote({ safesight: 1 }, 12).tcvNetCents), '104,000.04')
})

test('T11 5 units, 24: TCV 639,999.60', () => {
  assert.equal(money(quote({ safesight: 5 }, 24).tcvNetCents), '639,999.60')
})

test('T12 TEST-B 1 unit, 36: TCV 38,000.16, monthly fee 1,055.56', () => {
  const q = quote({ 'TEST-B': 1 }, 36)
  assert.equal(money(q.tcvNetCents), '38,000.16')
  assert.equal(money(q.monthlyTotalCents), '1,055.56')
})

test('T13 TEST-B 30 units, 60: TCV 1,134,842.40, margin 86.8%', () => {
  const q = quote({ 'TEST-B': 30 }, 60)
  assert.equal(money(q.tcvNetCents), '1,134,842.40')
  assert.equal(pct(q.grossMargin), '86.8')
})

test('T14 T6 + T13 on one deal: TCV 18,523,968.60, bands count per line', () => {
  const q = quote({ safesight: 120, 'TEST-B': 30 }, 60)
  assert.equal(money(q.tcvNetCents), '18,523,968.60')
  // Bands per line: TEST-B's 30 units sit in bands 1 and 2 only, not in band 3
  // as they would if the 150 units were pooled.
  const testB = q.lines.find((l) => l.product === 'TEST-B')
  assert.deepEqual(testB.bands.map((b) => [b.from, b.units]), [[1, 9], [10, 21]])
})

// v1.6: T15's figures are unchanged. The CAPEX amount is the Hardware figure
// (C-4), paid by the default Hybrid row (Contract start, month 0, 100%), and
// the subscription carries no residue because 16,189,126.20 / 60 is exact.
test('T15 T6 as capex: CAPEX 1,200,000.00 + 269,818.77 x 60 = 17,389,126.20', () => {
  const q = quote({ safesight: 120 }, 60, { paymentStructure: 'capex' })
  assert.equal(money(q.capex.capexCents), '1,200,000.00')
  assert.equal(money(q.capex.baseFeeCents), '269,818.77')
  assert.equal(money(q.capex.lastBaseFeeCents), '269,818.77', 'no residue in month 60')
  assert.equal(money(q.tcvNetCents), '17,389,126.20')
  assert.equal(q.capex.capexCents + q.capex.baseFeeCents * 59n + q.capex.lastBaseFeeCents, q.tcvNetCents, 'ties to Base TCV exactly')
  assert.equal(q.finalTcvCents, q.tcvNetCents, 'no CPI: Final = Base')
  assert.deepEqual(q.schedule.map((r) => [r.fromMonth, r.toMonth, money(r.capexCents), money(r.subscriptionCents), money(r.netCents)]),
    [[0, 0, '1,200,000.00', '0.00', '1,200,000.00'], [1, 60, '0.00', '269,818.77', '269,818.77']])
})

test('T16 1 unit, 60, CPI published 3%: Base 156,799.80 at 87.2%, Final (projected) 166,494.36, deal value Base', () => {
  const q = quote({ safesight: 1 }, 60, PUB('3'))
  assert.deepEqual(q.monthlyTotalByYear.map(money),
    ['2,613.33', '2,691.73', '2,772.48', '2,855.66', '2,941.33'], 'year fees unchanged')
  assert.equal(money(q.tcvNetCents), '156,799.80', 'Base TCV')
  assert.equal(pct(q.grossMargin), '87.2', 'margin on Base')
  assert.equal(money(q.finalTcvCents), '166,494.36', 'Final TCV (projected)')
  assert.equal(q.cpiMode, 'published')
  assert.equal(money(q.dealValueCents), '156,799.80', 'deal value = Base under Published')
})

test('T17 1 unit, 18 months: error, term not offered', () => {
  assert.throws(() => quote({ safesight: 1 }, 18),
    (e) => e instanceof TermPricingError && e.code === 'TERM_NOT_OFFERED'
      // A3 (John, 2026-10-01): the copy, with the article chosen by the number.
      // The list is TERMS (v1.3 default, B1), which is why 108 appears.
      && e.message === 'An 18-month term is not offered. Choose one of: 12, 24, 36, 48, 60, 72, 84, 96, 108, 120 months.')
})

test('A3: the article is chosen by how the number is said, not hard-coded', () => {
  // "an" for eight..., eleven and eighteen; "a" otherwise.
  for (const n of [8, 11, 18, 80, 86, 800, 8000, 11000, 18000]) assert.equal(articleFor(n), 'an', String(n))
  for (const n of [1, 12, 13, 24, 36, 110, 180, 1000, 12000]) assert.equal(articleFor(n), 'a', String(n))
  // And the refusal uses it both ways: "A 30-month", not "An".
  assert.throws(() => quote({ safesight: 1 }, 30), (e) => e.message.startsWith('A 30-month term is not offered.'))
})

test('T18 all units 0: error, no units', () => {
  assert.throws(() => quote({ safesight: 0, 'TEST-B': 0 }, 36),
    (e) => e instanceof TermPricingError && e.code === 'NO_UNITS')
})

test('T19 T6 with MARGIN_FLOOR 90%: flag shown, quote still prices', () => {
  const q = quote({ safesight: 120 }, 60, {}, withParams({ MARGIN_FLOOR: '90' }))
  assert.equal(q.belowMarginFloor, true)
  assert.equal(money(q.tcvNetCents), '17,389,126.20')
  // And the flag is OFF at the spec's own floor, so the flag is not constant.
  assert.equal(quote({ safesight: 120 }, 60).belowMarginFloor, false)
})

test('T20 T6, WHT 10%, gross-up ON', () => {
  const q = quote({ safesight: 120 }, 60, { whtPct: '10', whtGrossUp: true })
  const m = q.schedule[0]
  assert.equal(money(m.invoiceCents), '322,020.86', 'monthly invoice')
  assert.equal(money(m.whtCents), '32,202.09', 'WHT')
  assert.equal(money(m.receivedCents), '289,818.77', 'Terminus receives')
  assert.equal(m.receivedCents, q.monthlyTotalCents, '= T6 monthly total')
  assert.equal(m.whtBorne, false)
})

test('T21 T6, WHT 10%, gross-up OFF', () => {
  const q = quote({ safesight: 120 }, 60, { whtPct: '10', whtGrossUp: false })
  const m = q.schedule[0]
  assert.equal(money(m.invoiceCents), '289,818.77', 'monthly invoice')
  assert.equal(money(m.whtCents), '28,981.88', 'WHT')
  assert.equal(m.whtBorne, true, 'WHT borne')
  assert.equal(money(m.receivedCents), '260,836.89', 'Terminus receives')
})

test('T22 T6 as capex, CPI locked 3% (S 2): the subscription escalates, CAPEX does not', () => {
  const q = quote({ safesight: 120 }, 60, { paymentStructure: 'capex', ...LOCK('3', 2) })
  assert.equal(money(q.capex.capexCents), '1,200,000.00')
  assert.deepEqual(q.capex.payments.map((p) => [p.month, money(p.cents)]), [[0, '1,200,000.00']], 'CAPEX month 0')
  assert.deepEqual(q.capex.subscriptionByYear.map(money),
    ['269,818.77', '277,913.33', '286,250.73', '294,838.26', '303,683.40'])
  assert.equal(money(q.capex.lastSubscriptionCents), '303,683.40', 'month 60, no residue')
  assert.equal(money(q.tcvNetCents), '17,389,126.20', 'Base TCV')
  assert.equal(pct(q.grossMargin), '86.2', 'margin on Base')
  assert.equal(money(q.finalTcvCents), '18,390,053.88', 'Final TCV')
  assert.equal(money(q.dealValueCents), '18,390,053.88', 'deal value = Final under Locked')
  assert.deepEqual(q.schedule.map((r) => [r.fromMonth, r.toMonth]),
    [[0, 0], [1, 12], [13, 24], [25, 36], [37, 48], [49, 60]])
})

test('T23 SafeSight 120 + AQ 30, 60 months, on the catalog AQ costs', () => {
  // AQ at the catalog figures the spec's T23 row states. SafeSight's line is
  // T6; the AQ line and the deal figures are copied from the spec.
  const p = withParams({
    ANCHOR_MARGIN: { ...SPEC_PARAMS.ANCHOR_MARGIN, air_quality: '90' },
    SHORT_TERM_MARGIN: { ...SPEC_PARAMS.SHORT_TERM_MARGIN, air_quality: '90' },
    costs: { ...SPEC_PARAMS.costs, air_quality: { hwCost: '2000.00', hostingMonthly: '100.00' } },
  })
  const q = quote({ safesight: 120, air_quality: 30 }, 60, {}, p)
  const aq = q.lines.find((l) => l.product === 'air_quality')
  assert.deepEqual(aq.bands.map((b) => [b.from, b.units, money(b.feeByYear[0])]), [[1, 9, '973.33'], [10, 21, '924.67']])
  assert.equal(money(aq.monthlyByYear[0] * 60n), '1,690,682.40', 'AQ line')
  assert.equal(money(q.tcvNetCents), '19,079,808.60')
  assert.equal(money(q.totalCostCents), '2,640,000.00')
  assert.equal(pct(q.grossMargin), '86.2')
})

test('POSITION (Q4, not a spec figure): margin on price after WHT, only when WHT is borne', () => {
  // T21 basis: profit 17,389,126.20 - 120 x 20,000.00 = 14,989,126.20; WHT borne
  // 28,981.88 x 60 = 1,738,912.80; after WHT 13,250,213.40 / 17,389,126.20 = 76.197..%.
  const borne = quote({ safesight: 120 }, 60, { whtPct: '10', whtGrossUp: false })
  assert.equal(money(borne.tax.whtBorneCents), '1,738,912.80')
  assert.equal(pct(borne.marginAfterWht), '76.2')
  assert.equal(pct(borne.grossMargin), '86.2', 'the section 4.3 margin is unchanged')
  assert.equal(quote({ safesight: 120 }, 60, { whtPct: '10', whtGrossUp: true }).marginAfterWht, null, 'gross-up: nothing borne')
  assert.equal(quote({ safesight: 120 }, 60).marginAfterWht, null, 'no WHT')
})

// ── Section 8, the parts T20 and T21 do not reach ────────────────────────

test('GST is added on top, outside TCV net, and WHT is on the fee before GST', () => {
  const q = quote({ safesight: 120 }, 60, { gstPct: '9', whtPct: '10', whtGrossUp: false })
  const m = q.schedule[0]
  assert.equal(q.tcvNetCents, 1738912620n, 'TCV net unchanged by tax')
  // GST 9% of 289,818.77 = 26,083.6893, half-up 26,083.69.
  assert.equal(money(m.gstCents), '26,083.69')
  // WHT unchanged by GST: still 10% of the fee alone.
  assert.equal(money(m.whtCents), '28,981.88')
  assert.equal(q.tax.tcvInclGstCents, q.tax.invoicedCents + q.tax.gstCents)
  assert.equal(money(q.tax.gstCents), '1,565,021.40', '26,083.69 x 60')
})

test('POSITION (Phase 1, not a spec figure): with gross-up on, GST is charged on the grossed-up invoice', () => {
  // The spec says GST is added on top of every invoice and WHT applies to the
  // fee before GST; it does not say which fee GST is on when grossed up. The
  // invoice is the grossed-up fee, so GST is 9% of 322,020.86 = 28,981.8774,
  // half-up 28,981.88. Pinned so a change to this position is a visible diff.
  const q = quote({ safesight: 120 }, 60, { gstPct: '9', whtPct: '10', whtGrossUp: true })
  assert.equal(money(q.schedule[0].gstCents), '28,981.88')
  assert.equal(money(q.schedule[0].whtCents), '32,202.09', 'WHT still on the fee before GST')
})

// ── Section 11, last line: parameters flow through with no code change ──

test('flow: ANCHOR_MARGIN 80% reprices the anchor', () => {
  // 15,200 cost; profit 15,200 x 0.8 / 0.2 = 60,800; price 76,000;
  // fee 76,000 / 36 = 2,111.111..., half-up 2,111.11; TCV x 36 = 75,999.96.
  const p = withParams({ ANCHOR_MARGIN: { safesight: '80', 'TEST-B': '90' } })
  const q = quote({ safesight: 1 }, 36, {}, p)
  assert.equal(money(q.monthlyTotalCents), '2,111.11')
  assert.equal(money(q.tcvNetCents), '75,999.96')
})

test('flow: ANCHOR_MARGIN is per product (one product changed, the other untouched)', () => {
  const p = withParams({ ANCHOR_MARGIN: { safesight: '90', 'TEST-B': '80' } })
  const q = quote({ safesight: 120, 'TEST-B': 30 }, 60, {}, p)
  const ss = q.lines.find((l) => l.product === 'safesight')
  const base = quote({ safesight: 120 }, 60)
  assert.equal(ss.monthlyByYear[0], base.monthlyTotalCents, 'SafeSight line unchanged')
  assert.notEqual(q.tcvNetCents, 1852396860n, 'TEST-B line moved, so the deal moved')
})

test('flow: SHORT_TERM_MARGIN per product reprices only short terms', () => {
  // 12 months at 80%: cost 10,400 / 0.2 = 52,000; fee 52,000 / 12 = 4,333.333..., 4,333.33.
  const p = withParams({ SHORT_TERM_MARGIN: { safesight: '80', 'TEST-B': '90' } })
  assert.equal(money(quote({ safesight: 1 }, 12, {}, p).monthlyTotalCents), '4,333.33')
  assert.equal(money(quote({ safesight: 1 }, 36, {}, p).tcvNetCents), '151,999.92', '36 unchanged')
})

test('flow: PROFIT_STEP 1,000.00 adds per step above the anchor, nothing at it', () => {
  // 60 is 2 steps above 36: price 20,000 + 136,800 + 2 x 1,000 = 158,800;
  // fee 158,800 / 60 = 2,646.666..., 2,646.67; TCV x 60 = 158,800.20.
  const p = withParams({ PROFIT_STEP: '1000.00' })
  assert.equal(money(quote({ safesight: 1 }, 60, {}, p).tcvNetCents), '158,800.20')
  assert.equal(money(quote({ safesight: 1 }, 36, {}, p).tcvNetCents), '151,999.92', 'anchor unchanged')
})

test('flow: TERMS decides what is offered and where the steps fall', () => {
  // 18 offered: cost 8,000 + 3,600 = 11,600; / 0.1 = 116,000; / 18 = 6,444.444..., 6,444.44.
  const p = withParams({ TERMS: [12, 18, 24, 36, 48, 60, 72, 84, 96, 120] })
  assert.equal(money(quote({ safesight: 1 }, 18, {}, p).monthlyTotalCents), '6,444.44')
  // A term inserted ABOVE the anchor moves steps_above for everything after it:
  // with 42 added and PROFIT_STEP 1,000, 48 is 2 steps up, not 1.
  // price 17,600 + 136,800 + 2,000 = 156,400; / 48 = 3,258.333..., 3,258.33.
  const q = withParams({ TERMS: [12, 24, 36, 42, 48, 60, 72, 84, 96, 120], PROFIT_STEP: '1000.00' })
  assert.equal(money(quote({ safesight: 1 }, 48, {}, q).monthlyTotalCents), '3,258.33')
  // A term inserted BELOW the anchor moves the anchor's own position, and 48 is
  // still exactly 1 step up: price 17,600 + 136,800 + 1,000 = 155,400; / 48 = 3,237.50.
  // (Calibration J4 came back SILENT without this case: hard-coding the anchor's
  // index survived every list in which the anchor sat third.)
  const r = withParams({ TERMS: [12, 18, 24, 36, 48, 60, 72, 84, 96, 120], PROFIT_STEP: '1000.00' })
  assert.equal(money(quote({ safesight: 1 }, 48, {}, r).monthlyTotalCents), '3,237.50')
})

test('flow: VOLUME_BANDS change the banded fees', () => {
  // Band 2 at 10% instead of 5%: 9 x 4,222.22 + 1 x round(4,222.222... x 0.9) = 3,800.00;
  // monthly 37,999.98 + 3,800.00 = 41,799.98.
  const bands = SPEC_PARAMS.VOLUME_BANDS.map((b) => (b.from === 10 ? { ...b, discountPct: '10' } : b))
  const q = quote({ safesight: 10 }, 36, {}, withParams({ VOLUME_BANDS: bands }))
  assert.equal(money(q.monthlyTotalCents), '41,799.98')
})

test('flow: HW_UPFRONT_MARGIN 0 puts the CAPEX Hardware amount at cost', () => {
  // 120 x 8,000 = 960,000.00; subscription (17,389,126.20 - 960,000) / 60 = 273,818.77.
  const q = quote({ safesight: 120 }, 60, { paymentStructure: 'capex' }, withParams({ HW_UPFRONT_MARGIN: '0' }))
  assert.equal(money(q.capex.capexCents), '960,000.00')
  assert.equal(money(q.capex.baseFeeCents), '273,818.77')
})

test('flow: catalog costs are inputs, not constants', () => {
  // HW 9,000: cost(36) 16,200; price 162,000; / 36 = 4,500.00 exactly.
  const p = withParams({ costs: { ...SPEC_PARAMS.costs, safesight: { hwCost: '9000.00', hostingMonthly: '200.00' } } })
  assert.equal(money(quote({ safesight: 1 }, 36, {}, p).monthlyTotalCents), '4,500.00')
})

// ── RETIRED, QUOTED NOT DELETED (v1.6, C-10, Q12) ─────────────────────────
// "A1: under CAPEX each ladder row IS the CAPEX quote at that term, and vs 36
// compares the service fee." The CAPEX ladder columns (upfront, service fee)
// are gone: under CAPEX the ladder shows the term and the OPEX per-camera fee
// only, so a ladder row is the OPEX Base row at that term in both structures.
test('v1.6 (C-10): under CAPEX each ladder row is the OPEX Base row, and CAPEX inputs cannot refuse it', () => {
  // A Custom CAPEX of 50,000,000.00 is above T9's 38,039,088.00 for 250 units
  // at 120 months, so for 120 units it is above Base TCV at EVERY term and every
  // CAPEX quote here is refused; R = 60 is also above a 12-month term. Neither
  // reaches the ladder (asserted below: the quote refuses, the ladder prices).
  const capexIn = { units: { safesight: 120 }, paymentStructure: 'capex', capexAmount: 'custom', capexCustom: '50000000.00',
    capexStructure: 'two_phase', recoveryMonths: 60, ...LOCK('3'), perCameraProduct: 'safesight' }
  const opexIn = { units: { safesight: 120 }, paymentStructure: 'opex', perCameraProduct: 'safesight' }
  const c = termLadder(capexIn, SPEC_PARAMS), o = termLadder(opexIn, SPEC_PARAMS)
  assert.equal(c.length, SPEC_PARAMS.TERMS.length)
  for (let i = 0; i < c.length; i++) {
    assert.ok(c[i].perCameraCents !== null && c[i].tcvNetCents > 0n, `${c[i].termMonths}: a figure, so equal is not null against null`)
    assert.equal(c[i].perCameraCents, o[i].perCameraCents, `${c[i].termMonths}: per camera`)
    assert.equal(c[i].monthlyTotalCents, o[i].monthlyTotalCents, `${c[i].termMonths}: OPEX fee`)
    assert.equal(c[i].tcvNetCents, o[i].tcvNetCents, `${c[i].termMonths}: Base TCV`)
    assert.equal(Object.keys(c[i]).filter((k) => /upfront|service/i.test(k)).length, 0, 'no CAPEX column on a ladder row')
  }
  // The 60-month row is T6, Base: no CPI on the ladder.
  assert.equal(money(c.find((r) => r.termMonths === 60).tcvNetCents), '17,389,126.20')
  // And the same inputs as a quote ARE refused, so the ladder's survival is not vacuous.
  assert.throws(() => priceQuote({ ...capexIn, termMonths: 60 }, SPEC_PARAMS), (e) => e.code === 'CAPEX_RANGE')
})

// ── R-TP2: no float reaches the engine ───────────────────────────────────

test('money and percentages given as JS numbers are refused', () => {
  const bad = withParams({ costs: { safesight: { hwCost: 8000, hostingMonthly: '200.00' } } })
  assert.throws(() => normaliseParams(bad), (e) => e.code === 'NOT_A_DECIMAL')
  assert.throws(() => quote({ safesight: 1 }, 36, { gstPct: 9 }), (e) => e.code === 'NOT_A_DECIMAL')
})

// ── The ladder ───────────────────────────────────────────────────────────

test('the ladder prices every offered term from the same units', () => {
  const ladder = termLadder({ units: { safesight: 1 }, paymentStructure: 'opex' }, SPEC_PARAMS)
  assert.deepEqual(ladder.map((r) => r.termMonths), SPEC_PARAMS.TERMS)
  // For 1 unit the ladder reads 10.1 row for row.
  assert.deepEqual(ladder.map((r) => money(r.monthlyTotalCents)), T10_1.map((r) => r[1]))
  assert.deepEqual(ladder.map((r) => money(r.tcvNetCents)), T10_1.map((r) => r[3]))
  assert.deepEqual(ladder.map((r) => pct(r.grossMargin)), T10_1.map((r) => r[6]))
  assert.deepEqual(ladder.map((r) => (r.isAnchor ? 'list' : vsAnchor(r.savingVsAnchor))), T10_1.map((r) => r[2]))
})

// ── v1.3 (TERM_PRICING_2): B1, B3, B4 and B6 ─────────────────────────────
//
// T24 to T28 are COPIED from spec section 11. A "POSITION" test carries a
// figure the spec does not print; its derivation is written beside it from
// the spec's own formulas, never from the engine.

const T6_CAPEX = { paymentStructure: 'capex' }
const SPLIT = (hw, saas, grossUp) => ({ whtSplit: true, whtHwPct: hw, whtSaasPct: saas, whtGrossUp: grossUp })

test('T24 T6 as capex, split WHT hardware 5% / service 10%, gross-up OFF', () => {
  const q = quote({ safesight: 120 }, 60, { ...T6_CAPEX, ...SPLIT('5', '10', false) })
  const [up, svc] = q.schedule
  assert.equal(up.fromMonth, 0, 'the CAPEX invoice, month 0')
  assert.equal(money(up.whtCents), '60,000.00', 'WHT on upfront')
  assert.equal(money(up.receivedCents), '1,140,000.00', 'Terminus receives, upfront')
  assert.equal(money(svc.whtCents), '26,981.88', 'WHT per service invoice')
  assert.equal(money(svc.receivedCents), '242,836.89', 'Terminus receives, per service invoice')
  assert.equal(money(q.tax.whtBorneCents), '1,678,912.80', 'total WHT borne')
})

test('T25 T6 as opex, split WHT hardware 5% / service 10%, gross-up ON, GST 0', () => {
  const q = quote({ safesight: 120 }, 60, { gstPct: '0', ...SPLIT('5', '10', true) })
  const row = q.schedule[0]
  const [hw, svc] = row.lines
  assert.equal(hw.kind, 'hardware'); assert.equal(svc.kind, 'service')
  assert.equal(money(hw.netCents), '20,000.00', 'hardware line')
  assert.equal(money(hw.invoiceCents), '21,052.63', 'hardware invoice')
  assert.equal(money(hw.whtCents), '1,052.63', 'hardware WHT')
  assert.equal(money(hw.receivedCents), '20,000.00', 'hardware receives')
  assert.equal(money(svc.netCents), '269,818.77', 'service line')
  assert.equal(money(svc.invoiceCents), '299,798.63', 'service invoice')
  assert.equal(money(svc.whtCents), '29,979.86', 'service WHT')
  assert.equal(money(svc.receivedCents), '269,818.77', 'service receives')
  assert.equal(money(row.invoiceCents), '320,851.26', 'invoice total')
})

test('T26 1 unit, 108: TCV 166,399.92, margin 82.2%', () => {
  const q = quote({ safesight: 1 }, 108)
  assert.equal(money(q.tcvNetCents), '166,399.92')
  assert.equal(pct(q.grossMargin), '82.2')
})

test('T27 1 unit, 60, CPI locked 3% from year 3: Base 156,799.80 at 87.2%, Final 162,558.36 = deal value', () => {
  const q = quote({ safesight: 1 }, 60, LOCK('3', 3))
  assert.deepEqual(q.monthlyTotalByYear.map(money), ['2,613.33', '2,613.33', '2,691.73', '2,772.48', '2,855.66'])
  assert.equal(money(q.tcvNetCents), '156,799.80', 'Base TCV')
  assert.equal(pct(q.grossMargin), '87.2', 'margin on Base')
  assert.equal(money(q.finalTcvCents), '162,558.36', 'Final TCV')
  assert.equal(money(q.dealValueCents), '162,558.36', 'deal value = Final under Locked')
})

test('T28 T6 as capex, CPI published 3% from year 3: Final (projected) 17,983,678.32, deal value Base', () => {
  const q = quote({ safesight: 120 }, 60, { ...T6_CAPEX, ...PUB('3', 3) })
  assert.equal(money(q.capex.capexCents), '1,200,000.00')
  assert.deepEqual(q.capex.subscriptionByYear.map(money),
    ['269,818.77', '269,818.77', '277,913.33', '286,250.73', '294,838.26'])
  assert.equal(money(q.tcvNetCents), '17,389,126.20', 'Base TCV')
  assert.equal(money(q.finalTcvCents), '17,983,678.32', 'Final TCV (projected)')
  assert.equal(money(q.dealValueCents), '17,389,126.20', 'deal value = Base under Published')
})

test('B6: start year 2 is the v1.2 escalator exactly (T16 and T22 with S given)', () => {
  const t16 = quote({ safesight: 1 }, 60, PUB('3', 2))
  assert.equal(money(t16.finalTcvCents), '166,494.36')
  assert.equal(t16.finalTcvCents, quote({ safesight: 1 }, 60, PUB('3')).finalTcvCents, 'S 2 is the default')
  const t22 = quote({ safesight: 120 }, 60, { ...T6_CAPEX, ...LOCK('3', 2) })
  assert.equal(money(t22.finalTcvCents), '18,390,053.88')
})

test('B6: a 12-month term has no year 2, so the escalator has no effect', () => {
  const q = quote({ safesight: 1 }, 12, PUB('3', 2))
  assert.equal(money(q.finalTcvCents), '104,000.04')
  assert.equal(q.finalTcvCents, q.tcvNetCents)
})

test('B6 (POSITION): a start year past the last year never applies within the term', () => {
  // The ladder prices every term from the same inputs, so S = 4 meets a
  // 36-month term. factor(k) = 1 for every k < 4, i.e. every year of it: T1.
  assert.equal(money(quote({ safesight: 1 }, 36, PUB('3', 4)).finalTcvCents), '151,999.92')
})

test('B6: a start year below 2, or not a whole number, is refused', () => {
  for (const s of [1, 0, 2.5, '3']) {
    assert.throws(() => quote({ safesight: 1 }, 60, { cpiMode: 'published', escalatorPct: '3', escalatorStartYear: s }),
      (e) => e instanceof TermPricingError, `S = ${JSON.stringify(s)}`)
  }
})

test('B1 (POSITION): steps_above counts positions in the v1.3 TERMS (108 is 6, 120 is 7)', () => {
  // PROFIT_STEP 1,000.00. 108: 29,600 + 136,800 + 6 x 1,000 = 172,400; / 108
  // = 1,596.296..., 1,596.30. 120: 32,000 + 136,800 + 7,000 = 175,800; / 120 = 1,465.00.
  const p = withParams({ PROFIT_STEP: '1000.00' })
  assert.equal(money(quote({ safesight: 1 }, 108, {}, p).monthlyTotalCents), '1,596.30')
  assert.equal(money(quote({ safesight: 1 }, 120, {}, p).monthlyTotalCents), '1,465.00')
})

test('B4: with Split WHT OFF the OPEX invoice stays ONE line, so T20 and T21 are untouched', () => {
  const on = quote({ safesight: 120 }, 60, { whtPct: '10', whtGrossUp: true })
  assert.equal(on.schedule[0].lines, undefined, 'no line split')
  assert.equal(money(on.schedule[0].invoiceCents), '322,020.86')
  const off = quote({ safesight: 120 }, 60, { whtPct: '10', whtGrossUp: true, whtSplit: false, whtHwPct: '5', whtSaasPct: '7' })
  assert.equal(money(off.schedule[0].invoiceCents), '322,020.86', 'the split rates are ignored while the split is off')
})

test('B4 (POSITION): CAPEX split at one rate equals the unsplit CAPEX quote', () => {
  const one = quote({ safesight: 120 }, 60, { ...T6_CAPEX, whtPct: '10', whtGrossUp: true })
  const two = quote({ safesight: 120 }, 60, { ...T6_CAPEX, ...SPLIT('10', '10', true) })
  assert.deepEqual(two.schedule.map((r) => [r.invoiceCents, r.whtCents]), one.schedule.map((r) => [r.invoiceCents, r.whtCents]))
})

test('B4 (POSITION): with an escalator the hardware line is flat and the service line carries the increase', () => {
  // The hardware line is T15's upfront basis, 1,200,000.00 / 60 = 20,000.00,
  // every year; the service line is that year's OPEX fee less it.
  const q = quote({ safesight: 120 }, 60, { ...PUB('3'), ...SPLIT('5', '10', false) })
  assert.equal(q.schedule.length, 5, 'one run per contract year')
  q.schedule.forEach((row, i) => {
    assert.equal(money(row.lines[0].netCents), '20,000.00', `year ${i + 1} hardware`)
    assert.equal(row.lines[1].netCents, q.monthlyTotalByYear[i] - 2000000n, `year ${i + 1} service = fee - hardware`)
  })
})

test('B4 (POSITION): GST is added per line on the line invoice', () => {
  // T25 at GST 9%: 21,052.63 x 0.09 = 1,894.7367, 1,894.74; 299,798.63 x 0.09
  // = 26,981.8767, 26,981.88; the invoice's GST is their sum, 28,876.62.
  const q = quote({ safesight: 120 }, 60, { gstPct: '9', ...SPLIT('5', '10', true) })
  const [hw, svc] = q.schedule[0].lines
  assert.equal(money(hw.gstCents), '1,894.74')
  assert.equal(money(svc.gstCents), '26,981.88')
  assert.equal(money(q.schedule[0].gstCents), '28,876.62')
})

test('B4 (POSITION, spec 13): a split OPEX service line below zero is refused, never invoiced', () => {
  // HW_UPFRONT_MARGIN 99%: 8,000 / 0.01 = 800,000 upfront; / 12 = 66,666.67 a
  // month of hardware against a 12-month fee of 8,666.67.
  const p = withParams({ HW_UPFRONT_MARGIN: '99' })
  assert.throws(() => quote({ safesight: 1 }, 12, SPLIT('5', '10', false), p), (e) => e.code === 'NEGATIVE_SERVICE_LINE')
  assert.doesNotThrow(() => quote({ safesight: 1 }, 12, { whtPct: '5' }, p), 'unsplit, nothing to refuse')
})

test('B3: every WHT rate is 0 up to but not including 100', () => {
  for (const extra of [{ whtPct: '100' }, { whtPct: '-1' }, SPLIT('100', '0', false), SPLIT('0', '-0.5', false)]) {
    assert.throws(() => quote({ safesight: 1 }, 36, extra), (e) => e.code === 'BAD_TAX', JSON.stringify(extra))
  }
  assert.equal(money(quote({ safesight: 1 }, 36, { whtPct: '' }).tax.whtCents), '0.00', 'blank is 0')
  assert.equal(money(quote({ safesight: 1 }, 36, SPLIT('', '', false)).tax.whtCents), '0.00', 'blank split rates are 0')
})

// ── L1 (John, layout approval): the quote tiles foot ─────────────────────

test('L1 the split-on capture, both schedules: Final 162,558.36 / 17,477.04 / 16,203.36 / 196,238.76; Base 156,799.80 / 16,837.20 / 15,627.60 / 189,264.60', () => {
  // Copied from the rulings (spec v1.6 11.1): 1 unit, 60 months, CPI
  // published 3% from year 3, split WHT 5% / 10%, gross-up ON, GST 9%.
  const q = quote({ safesight: 1 }, 60, { ...PUB('3', 3), gstPct: '9', ...SPLIT('5', '10', true) })
  assert.equal(money(q.finalTcvCents), '162,558.36')
  assert.equal(money(q.tax.grossUpCents), '17,477.04')
  assert.equal(money(q.tax.gstCents), '16,203.36')
  assert.equal(money(q.tax.tcvInclGstCents), '196,238.76')
  assert.equal(money(q.tcvNetCents), '156,799.80')
  assert.equal(money(q.base.tax.grossUpCents), '16,837.20')
  assert.equal(money(q.base.tax.gstCents), '15,627.60')
  assert.equal(money(q.base.tax.tcvInclGstCents), '189,264.60')
})

test('L1 TCV (net) + WHT gross-up + GST = TCV incl. GST in every structure and WHT state', () => {
  const cases = [
    {}, { whtPct: '10', whtGrossUp: true }, { whtPct: '10', whtGrossUp: false },
    SPLIT('5', '10', true), SPLIT('5', '10', false), { whtPct: '0', whtGrossUp: true },
  ]
  // v1.6 (Q5): the tie holds on EACH schedule separately, Final against Final
  // TCV and Base against Base TCV.
  for (const structure of ['opex', 'capex']) for (const c of cases) for (const esc of [{}, PUB('3', 3), LOCK('3', 2)]) {
    const q = quote({ safesight: 120 }, 60, { paymentStructure: structure, gstPct: '9', ...c, ...esc })
    const what = JSON.stringify({ structure, ...c, ...esc })
    assert.equal(q.finalTcvCents + q.tax.grossUpCents + q.tax.gstCents, q.tax.tcvInclGstCents, `Final foots: ${what}`)
    assert.equal(q.tcvNetCents + q.base.tax.grossUpCents + q.base.tax.gstCents, q.base.tax.tcvInclGstCents, `Base foots: ${what}`)
    if (!c.whtGrossUp) assert.equal(q.tax.grossUpCents, 0n, `no gross-up without the switch: ${what}`)
    if (esc.cpiMode) assert.ok(q.finalTcvCents > q.tcvNetCents, `the CPI case moved Final, so the two ties are two: ${what}`)
  }
  // T20 basis: (322,020.86 - 289,818.77) x 60 = 32,202.09 x 60 = 1,932,125.40.
  assert.equal(money(quote({ safesight: 120 }, 60, { whtPct: '10', whtGrossUp: true }).tax.grossUpCents), '1,932,125.40')
})

// ── v1.4 (QUOTE_PANEL): per-product totals ──────────────────────────────
//
// T29 and T30 are COPIED from spec section 11. AQ and HEMIR take the catalog
// costs the Term Pricing screen reads (AQ 2,000.00 and 100.00 as T23 states;
// HEMIR 100,000.00 and 500.00), with 90% margins as section 3.
const CATALOG = withParams({
  ANCHOR_MARGIN: { ...SPEC_PARAMS.ANCHOR_MARGIN, air_quality: '90', hemir: '90' },
  SHORT_TERM_MARGIN: { ...SPEC_PARAMS.SHORT_TERM_MARGIN, air_quality: '90', hemir: '90' },
  costs: { ...SPEC_PARAMS.costs,
    air_quality: { hwCost: '2000.00', hostingMonthly: '100.00' },
    hemir: { hwCost: '100000.00', hostingMonthly: '500.00' } },
})
const DEMO = { safesight: 120, air_quality: 40, hemir: 2 }
const row = (q, p) => { const l = q.lines.find((x) => x.product === p); return [money(l.tcvNetCents), money(l.costCents), money(l.grossProfitCents), pct(l.grossMargin)] }

test('T29 per product, 60 months, OPEX, no escalator', () => {
  const q = quote(DEMO, 60, {}, CATALOG)
  assert.deepEqual(row(q, 'safesight'), ['17,389,126.20', '2,400,000.00', '14,989,126.20', '86.2'])
  assert.deepEqual(row(q, 'air_quality'), ['2,245,484.40', '320,000.00', '1,925,484.40', '85.7'])
  assert.deepEqual(row(q, 'hemir'), ['2,384,000.40', '260,000.00', '2,124,000.40', '89.1'])
  assert.deepEqual([money(q.tcvNetCents), money(q.totalCostCents), money(q.grossProfitCents), pct(q.grossMargin)],
    ['22,018,611.00', '2,980,000.00', '19,038,611.00', '86.5'])
})

test('T30 per product on Base, the Final schedule, CAPEX Hardware Hybrid m0, CPI locked 3% (S 2), WHT 10% borne', () => {
  const q = quote(DEMO, 60, { paymentStructure: 'capex', ...LOCK('3', 2), whtPct: '10', whtGrossUp: false }, CATALOG)
  const pick = (p) => { const r = row(q, p); return [r[0], r[3]] }
  // Base, per product.
  assert.deepEqual(pick('safesight'), ['17,389,126.20', '86.2'])
  assert.deepEqual(pick('air_quality'), ['2,245,484.40', '85.7'])
  assert.deepEqual(pick('hemir'), ['2,384,000.40', '89.1'])
  assert.equal(money(q.tcvNetCents), '22,018,611.00')
  assert.equal(money(q.grossProfitCents), '19,038,611.00')
  assert.equal(pct(q.grossMargin), '86.5')
  // Base schedule: WHT borne and the margin after it.
  assert.equal(money(q.base.tax.whtBorneCents), '2,201,860.98')
  assert.equal(money(q.grossProfitCents - q.base.tax.whtBorneCents), '16,836,750.02')
  assert.equal(pct(q.marginAfterWht), '76.5')
  // Final schedule.
  assert.equal(money(q.capex.capexCents), '1,550,000.00')
  assert.deepEqual(q.capex.payments.map((p) => [p.month, money(p.cents)]), [[0, '1,550,000.00']])
  assert.deepEqual(q.schedule.map((r) => [r.fromMonth, r.toMonth, money(r.capexCents), money(r.subscriptionCents)]), [
    [0, 0, '1,550,000.00', '0.00'], [1, 12, '0.00', '341,143.52'], [13, 24, '0.00', '351,377.83'], [25, 36, '0.00', '361,919.16'],
    [37, 48, '0.00', '372,776.74'], [49, 59, '0.00', '383,960.04'], [60, 60, '0.00', '383,959.81']])
  assert.equal(money(q.finalTcvCents), '23,284,127.25')
  assert.equal(money(q.dealValueCents), '23,284,127.25', 'deal value = Final under Locked')
  assert.equal(money(q.cpiUpliftCents), '1,265,516.25')
  assert.equal(money(q.tax.whtCents), '2,328,412.62', 'WHT on Final invoices')
  assert.deepEqual([money(q.schedule[0].whtCents), money(q.schedule[0].receivedCents)], ['155,000.00', '1,395,000.00'], 'month 0')
  assert.deepEqual([money(q.schedule[1].whtCents), money(q.schedule[1].receivedCents)], ['34,114.35', '307,029.17'], 'year-1 subscription invoice')
})

test('T30 with GST 9% (the --qp picture): Final GST 2,095,571.38, incl 25,379,698.63; Base GST 1,981,675.18, incl 24,000,286.18', () => {
  const q = quote(DEMO, 60, { paymentStructure: 'capex', ...LOCK('3', 2), whtPct: '10', whtGrossUp: false, gstPct: '9' }, CATALOG)
  assert.equal(money(q.tax.gstCents), '2,095,571.38')
  assert.equal(money(q.tax.tcvInclGstCents), '25,379,698.63')
  assert.equal(money(q.base.tax.gstCents), '1,981,675.18')
  assert.equal(money(q.base.tax.tcvInclGstCents), '24,000,286.18')
})

test('v1.4: the products sum to the deal EXACTLY, in every structure, escalator and WHT state', () => {
  for (const extra of [{}, { paymentStructure: 'capex' }, PUB('3', 3),
    { paymentStructure: 'capex', ...LOCK('3'), whtPct: '10' }, SPLIT('5', '10', true)]) {
    for (const T of [12, 36, 60, 120]) {
      const q = quote(DEMO, T, extra, CATALOG)
      const sum = (k) => q.lines.reduce((t, l) => t + l[k], 0n)
      const what = `${T} ${JSON.stringify(extra)}`
      assert.equal(sum('tcvNetCents'), q.tcvNetCents, `TCV ${what}`)
      assert.equal(sum('costCents'), q.totalCostCents, `cost ${what}`)
      assert.equal(sum('grossProfitCents'), q.grossProfitCents, `profit ${what}`)
    }
  }
})

// v1.6 (Q5): restated on Base TCV, where it holds. Final TCV is deal-level
// and is NOT the same under OPEX and CAPEX (the CPI misses the CAPEX share).
test('v1.4 (restated v1.6): a product Base TCV is the same under OPEX and CAPEX', () => {
  const o = quote(DEMO, 60, LOCK('3'), CATALOG), c = quote(DEMO, 60, { paymentStructure: 'capex', ...LOCK('3') }, CATALOG)
  assert.notEqual(o.finalTcvCents, c.finalTcvCents, 'Final differs, so equal Base is a claim and not a coincidence of no CPI')
  // Both sides must EXIST: this test passed against the old engine, undefined
  // against undefined (Verification 14).
  assert.ok(o.lines.length === 3 && [...o.lines, ...c.lines].every((l) => typeof l.tcvNetCents === 'bigint' && l.tcvNetCents > 0n), 'no product TCV to compare')
  assert.deepEqual(c.lines.map((l) => l.tcvNetCents), o.lines.map((l) => l.tcvNetCents))
})

test('v1.4: WHT is never allocated to a product', () => {
  // With WHT borne, the products still sum to the deal's gross profit BEFORE
  // WHT, and no product carries a WHT figure of its own.
  const q = quote(DEMO, 60, { whtPct: '10', whtGrossUp: false }, CATALOG)
  assert.ok(q.tax.whtBorneCents > 0n, 'the case has WHT borne, so the claim is not vacuous')
  assert.equal(q.lines.reduce((t, l) => t + l.grossProfitCents, 0n), q.grossProfitCents)
  for (const l of q.lines) assert.deepEqual(Object.keys(l).filter((k) => /wht/i.test(k)), [], `${l.product} carries a WHT field`)
})

// ── v1.5 (PER_CAMERA_AND_CAPEX_P0): the OPEX per-camera fee ─────────────
//
// T31 is COPIED from spec section 11. The engine names no product: the
// screen says which line is "per camera" (perCameraProduct), so the figure
// is a property of the input, not a constant in the calculator (CLAUDE.md
// Architecture 14).

const PER_CAMERA = { perCameraProduct: 'safesight' }
const perCamera = (units, extra = {}, params = CATALOG) =>
  termLadder({ units, paymentStructure: 'opex', ...PER_CAMERA, ...extra }, params).map((r) => [r.termMonths, r.perCameraCents === null ? null : money(r.perCameraCents)])

test('T31 per camera, OPEX, SafeSight 120 + AQ 40 + HEMIR 2, every term', () => {
  assert.deepEqual(perCamera(DEMO), [
    [12, '8,009.44'], [24, '4,928.89'], [36, '3,902.04'], [48, '2,972.74'], [60, '2,415.16'],
    [72, '2,043.44'], [84, '1,777.92'], [96, '1,578.79'], [108, '1,423.90'], [120, '1,299.99'],
  ])
})

test('v1.5: per camera divides the SafeSight line only; AQ and HEMIR do not move it', () => {
  const alone = perCamera({ safesight: 120 })
  assert.ok(alone.every(([, v]) => v !== null), 'every row has a figure, so the comparison is not null against null')
  assert.deepEqual(perCamera(DEMO), alone)
})

// v1.6 (C-10): FLIPPED. Under CAPEX the ladder shows the OPEX per-camera fee,
// T31 unchanged. v1.5 read "null under CAPEX".
test('v1.6: per camera is null ("-") with no SafeSight units; under CAPEX it is the OPEX figure, T31', () => {
  assert.ok(perCamera({ safesight: 0, air_quality: 40 }).every(([, v]) => v === null))
  assert.deepEqual(perCamera(DEMO, { paymentStructure: 'capex' }), perCamera(DEMO))
  assert.equal(perCamera(DEMO, { paymentStructure: 'capex' }).find(([t]) => t === 60)[1], '2,415.16', 'T31 at 60')
  // Nothing names the product: no perCameraProduct, no figure.
  assert.ok(termLadder({ units: DEMO, paymentStructure: 'opex' }, CATALOG).every((r) => r.perCameraCents === null))
})

test('v1.5 (Verification 24): a second product follows its OWN line, rounded half-up', () => {
  // AQ 40 at 60 months, from T23's band fees: (9 x 973.33 + 31 x 924.67) / 40
  // = 37,424.74 / 40 = 935.6185, half-up 935.62.
  const r = termLadder({ units: DEMO, paymentStructure: 'opex', perCameraProduct: 'air_quality' }, CATALOG).find((x) => x.termMonths === 60)
  assert.equal(money(r.perCameraCents), '935.62')
})

test('v1.5: per camera is year 1 (after the discount) with an escalator', () => {
  const flat = perCamera(DEMO), esc = perCamera(DEMO, LOCK('3'))
  assert.deepEqual(esc, flat)
})

// ── v1.6 (TP_CAPEX): the CAPEX amount, Two-phase and Hybrid, CPI modes ─────
//
// G-C1 to G-C6 are COPIED from spec v1.6 section 11.1 (issued in the rulings),
// never computed here. The demo deal on the spec's settings: Base TCV
// 22,018,611.00 in every case. Milestone keys are opaque to the engine (Q4);
// the names below are the shared vocabulary's, used here only as tokens.

const CAPEX = (extra = {}) => ({ paymentStructure: 'capex', ...extra })
const HYBRID = (...rows) => ({ capexStructure: 'hybrid', milestones: rows.map(([key, month, sharePct]) => ({ key, month, sharePct })) })
const runs = (q) => q.schedule.map((r) => [r.fromMonth, r.toMonth, money(r.capexCents), money(r.subscriptionCents), money(r.netCents)])

test('G-C1 the default: Hardware, Hybrid Contract start m0 100%', () => {
  const q = quote(DEMO, 60, CAPEX(), CATALOG)
  assert.equal(money(q.tcvNetCents), '22,018,611.00')
  assert.equal(money(q.capex.capexCents), '1,550,000.00')
  assert.equal(q.capex.amountMode, 'hardware', 'Hardware is the default')
  assert.equal(q.capex.structure, 'hybrid', 'Hybrid is the default')
  // Q4: the engine never sees a milestone NAME. With no rows given it pays one
  // row, month 0, 100%, carrying no key; the screen's default row is the
  // vocabulary's "Contract start" (asserted by the screen probe).
  assert.deepEqual(q.capex.payments.map((p) => [p.key, p.month, money(p.cents)]), [[null, 0, '1,550,000.00']])
  assert.deepEqual(quote(DEMO, 60, CAPEX(HYBRID(['Contract start', 0, '100'])), CATALOG).capex.payments.map((p) => [p.key, money(p.cents)]),
    [['Contract start', '1,550,000.00']], 'a given key is carried through as an opaque token')
  assert.deepEqual(runs(q), [
    [0, 0, '1,550,000.00', '0.00', '1,550,000.00'], [1, 59, '0.00', '341,143.52', '341,143.52'], [60, 60, '0.00', '341,143.32', '341,143.32']])
  assert.equal(money(q.finalTcvCents), '22,018,611.00')
  assert.equal(q.dealValueCents, q.tcvNetCents, 'deal value = Base TCV')
  assert.equal(money(q.cashYear1Cents), '5,643,722.24')
  assert.equal(money(q.opexCashYear1Cents), '4,403,722.20')
  assert.equal(q.capex.warnings.hardwareFundedCents, null, 'CAPEX is above hardware cost')
  // The schedule's Total row (the approved picture, state 1): 1,550,000.00 /
  // 20,468,611.00 / 22,018,611.00.
  assert.deepEqual([money(q.tax.capexCents), money(q.tax.subscriptionCents), money(q.tax.netCents)],
    ['1,550,000.00', '20,468,611.00', '22,018,611.00'])
})

test('G-C2 Custom 1,000,000.00, Hybrid 30 / 40 / 30 at months 0, 3, 6', () => {
  const q = quote(DEMO, 60, CAPEX({ capexAmount: 'custom', capexCustom: '1000000.00',
    ...HYBRID(['Contract start', 0, '30'], ['Hardware delivered to site', 3, '40'], ['Commissioning', 6, '30']) }), CATALOG)
  assert.deepEqual(q.capex.payments.map((p) => [p.month, money(p.cents)]), [[0, '300,000.00'], [3, '400,000.00'], [6, '300,000.00']])
  assert.deepEqual(runs(q), [
    [0, 0, '300,000.00', '0.00', '300,000.00'], [1, 2, '0.00', '350,310.18', '350,310.18'],
    [3, 3, '400,000.00', '350,310.18', '750,310.18'], [4, 5, '0.00', '350,310.18', '350,310.18'],
    [6, 6, '300,000.00', '350,310.18', '650,310.18'], [7, 59, '0.00', '350,310.18', '350,310.18'],
    [60, 60, '0.00', '350,310.38', '350,310.38']])
  assert.equal(money(q.capex.warnings.hardwareFundedCents), '240,000.00', 'Terminus funds 240,000.00')
  assert.equal(money(q.cashYear1Cents), '5,203,722.16')
})

test('G-C3 Two-phase, Hardware, R = 12', () => {
  const q = quote(DEMO, 60, CAPEX({ capexStructure: 'two_phase', recoveryMonths: 12 }), CATALOG)
  assert.deepEqual(runs(q), [
    [1, 11, '129,166.67', '341,143.52', '470,310.19'], [12, 12, '129,166.63', '341,143.52', '470,310.15'],
    [13, 59, '0.00', '341,143.52', '341,143.52'], [60, 60, '0.00', '341,143.32', '341,143.32']])
  assert.equal(money(q.cashYear1Cents), '5,643,722.24')
})

test('G-C4 refusals, each for its own reason', () => {
  const refuses = (extra, code, what) => assert.throws(() => quote(DEMO, 60, CAPEX(extra), CATALOG),
    (e) => e instanceof TermPricingError && e.code === code, `${what}: expected ${code}`)
  refuses({ capexAmount: 'custom', capexCustom: '0' }, 'CAPEX_RANGE', 'CAPEX 0')
  refuses({ capexAmount: 'custom', capexCustom: '22018611.00' }, 'CAPEX_RANGE', 'CAPEX = Base TCV')
  refuses(HYBRID(['Contract start', 0, '50'], ['Go live', 6, '49.9']), 'SHARES_TOTAL', '99.9%')
  refuses(HYBRID(['Contract start', 0, '50'], ['Go live', 6, '50.1']), 'SHARES_TOTAL', '100.1%')
  refuses(HYBRID(['Go live', 0, '50'], ['Go live', 6, '50']), 'DUPLICATE_MILESTONE', 'duplicate milestone')
  refuses(HYBRID(['Contract start', 61, '100']), 'MILESTONE_MONTH', 'month > T')
  refuses(HYBRID(['Contract start', 6, '50'], ['Go live', 3, '50']), 'MILESTONE_ORDER', 'months decreasing')
  refuses({ capexStructure: 'two_phase', recoveryMonths: 0 }, 'RECOVERY_MONTHS', 'R = 0')
  refuses({ capexStructure: 'two_phase', recoveryMonths: 61 }, 'RECOVERY_MONTHS', 'R > T')
  // The healthy neighbours of each refusal price, so no refusal above is the
  // quote refusing everything (Verification 14's companion clause).
  for (const ok of [{ capexAmount: 'custom', capexCustom: '0.01' }, { capexAmount: 'custom', capexCustom: '22018610.99' },
    HYBRID(['Contract start', 0, '50'], ['Go live', 6, '50']), HYBRID(['Contract start', 60, '100']),
    HYBRID(['Contract start', 3, '50'], ['Go live', 3, '50']), { capexStructure: 'two_phase', recoveryMonths: 1 },
    { capexStructure: 'two_phase', recoveryMonths: 60 }]) {
    assert.doesNotThrow(() => quote(DEMO, 60, CAPEX(ok), CATALOG), JSON.stringify(ok))
  }
})

test('G-C5 CPI locked 3% (S 2) on G-C1, no WHT: as T30\'s Final schedule, Final TCV 23,284,127.25', () => {
  const q = quote(DEMO, 60, CAPEX(LOCK('3', 2)), CATALOG)
  assert.deepEqual(runs(q).map((r) => [r[0], r[1], r[2], r[3]]), [
    [0, 0, '1,550,000.00', '0.00'], [1, 12, '0.00', '341,143.52'], [13, 24, '0.00', '351,377.83'], [25, 36, '0.00', '361,919.16'],
    [37, 48, '0.00', '372,776.74'], [49, 59, '0.00', '383,960.04'], [60, 60, '0.00', '383,959.81']])
  assert.equal(money(q.finalTcvCents), '23,284,127.25')
  assert.equal(money(q.tcvNetCents), '22,018,611.00', 'Base TCV unmoved by the CPI')
  // The Base schedule is G-C1's: the CPI touches the Final schedule only.
  assert.deepEqual(q.base.schedule.map((r) => [r.fromMonth, r.toMonth, money(r.netCents)]),
    [[0, 0, '1,550,000.00'], [1, 59, '341,143.52'], [60, 60, '341,143.32']])
})

test('G-C6 split WHT straddling the hardware value: Custom 2,000,000.00, 5% / 10%, gross-up OFF', () => {
  const q = quote(DEMO, 60, CAPEX({ capexAmount: 'custom', capexCustom: '2000000.00', gstPct: '0', ...SPLIT('5', '10', false) }), CATALOG)
  const m0 = q.schedule[0]
  assert.equal(m0.fromMonth, 0)
  assert.deepEqual(m0.lines.map((l) => [l.kind, money(l.netCents), money(l.whtCents)]),
    [['hardware', '1,550,000.00', '77,500.00'], ['service', '450,000.00', '45,000.00']])
  assert.deepEqual([money(m0.whtCents), money(m0.receivedCents)], ['122,500.00', '1,877,500.00'])
  assert.deepEqual(q.schedule.slice(1).map((r) => [r.fromMonth, r.toMonth, money(r.subscriptionCents), money(r.whtCents)]),
    [[1, 59, '333,643.52', '33,364.35'], [60, 60, '333,643.32', '33,364.33']])
  assert.equal(money(q.tax.whtCents), '2,124,360.98')
  assert.equal(q.capex.warnings.hardwareFundedCents, null, 'warning (a) does not fire')
})

test('v1.6 (C-3): a CPI rate with no mode is refused; under None the rate is ignored', () => {
  assert.throws(() => quote({ safesight: 1 }, 60, { escalatorPct: '3' }), (e) => e.code === 'CPI_MODE_REQUIRED')
  assert.throws(() => quote({ safesight: 1 }, 60, { cpiMode: 'projected', escalatorPct: '3' }), (e) => e.code === 'BAD_CPI_MODE')
  const none = quote({ safesight: 1 }, 60, { cpiMode: 'none', escalatorPct: '3' })
  assert.equal(none.finalTcvCents, none.tcvNetCents, 'None: Final = Base')
  assert.deepEqual(none.monthlyTotalByYear.map(money), ['2,613.33', '2,613.33', '2,613.33', '2,613.33', '2,613.33'])
  // A mode with a zero rate is no CPI either.
  const zero = quote({ safesight: 1 }, 60, LOCK('0'))
  assert.equal(zero.finalTcvCents, zero.tcvNetCents)
})

test('v1.6 (C-9 b): the base subscription fee below the deal\'s monthly hosting cost warns, never refuses', () => {
  // POSITION, from the spec's own formula: hosting is 120 x 200 + 40 x 100 + 2
  // x 500 = 29,000.00 a month. Custom 21,000,000.00 leaves (22,018,611.00 -
  // 21,000,000.00) / 60 = 16,976.85, below it; G-C1's 341,143.52 is above it.
  const low = quote(DEMO, 60, CAPEX({ capexAmount: 'custom', capexCustom: '21000000.00' }), CATALOG)
  assert.equal(money(low.capex.baseFeeCents), '16,976.85')
  assert.equal(money(low.capex.warnings.hostingMonthlyCents), '29,000.00')
  assert.equal(low.capex.warnings.subscriptionBelowHosting, true)
  assert.equal(quote(DEMO, 60, CAPEX(), CATALOG).capex.warnings.subscriptionBelowHosting, false)
})

test('v1.6 (POSITION, C-6): a milestone share must be above 0 and at most 100; 1 to 5 rows', () => {
  const refuses = (extra, code) => assert.throws(() => quote(DEMO, 60, CAPEX(extra), CATALOG), (e) => e.code === code, code)
  refuses(HYBRID(['Contract start', 0, '100'], ['Go live', 6, '0']), 'MILESTONE_SHARE')
  refuses(HYBRID(), 'MILESTONE_COUNT')
  refuses(HYBRID(['a', 0, '20'], ['b', 1, '20'], ['c', 2, '20'], ['d', 3, '20'], ['e', 4, '10'], ['f', 5, '10']), 'MILESTONE_COUNT')
  refuses(HYBRID(['', 0, '100']), 'MILESTONE_KEY')
  assert.doesNotThrow(() => quote(DEMO, 60, CAPEX(HYBRID(['a', 0, '20'], ['b', 1, '20'], ['c', 2, '20'], ['d', 3, '20'], ['e', 4, '20'])), CATALOG), 'five rows')
})

test('v1.6 (C-4, C-7): Custom is kept exactly; the LAST milestone carries the rounding', () => {
  // POSITION from the spec's formulas: 1,000,000.01 x 1/3 = 333,333.336..,
  // half-up 333,333.34 for each of the first two rows; the last is
  // 1,000,000.01 - 666,666.68 = 333,333.33.
  const q = quote(DEMO, 60, CAPEX({ capexAmount: 'custom', capexCustom: '1000000.01',
    ...HYBRID(['Contract start', 0, '33.3333333333'], ['Go live', 1, '33.3333333333'], ['Final acceptance', 2, '33.3333333334']) }), CATALOG)
  assert.equal(money(q.capex.capexCents), '1,000,000.01', 'kept exactly as entered')
  assert.deepEqual(q.capex.payments.map((p) => money(p.cents)), ['333,333.34', '333,333.34', '333,333.33'])
  assert.throws(() => quote(DEMO, 60, CAPEX({ capexAmount: 'custom', capexCustom: '1000000.001' }), CATALOG), (e) => e.code === 'CAPEX_CUSTOM', 'more than 2 decimals is refused, never rounded')
})

test('v1.6 (POSITION): a last instalment or last month that would be negative is refused, never invoiced', () => {
  // From the spec's formulas. Custom 0.11 over R = 20: round_half_up(0.0055) =
  // 0.01 for months 1 to 19 = 0.19, so month 20 would be 0.11 - 0.19 = -0.08.
  assert.throws(() => quote(DEMO, 60, CAPEX({ capexAmount: 'custom', capexCustom: '0.11', capexStructure: 'two_phase', recoveryMonths: 20 }), CATALOG),
    (e) => e.code === 'NEGATIVE_LAST_ITEM')
  // Base TCV - CAPEX = 0.35: round_half_up(0.35 / 60) = 0.01 for months 1 to
  // 59 = 0.59, so month 60 would be 0.35 - 0.59 = -0.24.
  assert.throws(() => quote(DEMO, 60, CAPEX({ capexAmount: 'custom', capexCustom: '22018610.65' }), CATALOG),
    (e) => e.code === 'NEGATIVE_LAST_ITEM')
})

test('v1.6 (C-4, POSITION): the hardware value is rounded ONCE, at deal level, never per product', () => {
  // From the spec's formula: HW_UPFRONT_MARGIN 30%, SafeSight 3 + TEST-B 1:
  // (3 x 8,000 + 2,000) / 0.7 = 26,000 / 0.7 = 37,142.857.., half-up 37,142.86.
  // Rounded per product it would read 34,285.71 + 2,857.14 = 37,142.85.
  const q = quote({ safesight: 3, 'TEST-B': 1 }, 60, { paymentStructure: 'capex' }, withParams({ HW_UPFRONT_MARGIN: '30' }))
  assert.equal(money(q.capex.hardwareValueCents), '37,142.86')
  assert.equal(money(q.capex.capexCents), '37,142.86')
})

test('v1.6 (C-5): CAPEX payments never escalate, even a milestone in a CPI year', () => {
  // G-C2's schedule with a year-2 milestone, under CPI locked 3% (S 2): the
  // month-13 payment is its share of CAPEX, unchanged, and the invoice is that
  // payment plus the year-2 subscription.
  const rows = HYBRID(['Contract start', 0, '50'], ['Go live', 13, '50'])
  const flat = quote(DEMO, 60, CAPEX({ capexAmount: 'custom', capexCustom: '1000000.00', ...rows }), CATALOG)
  const cpi = quote(DEMO, 60, CAPEX({ capexAmount: 'custom', capexCustom: '1000000.00', ...rows, ...LOCK('3', 2) }), CATALOG)
  assert.deepEqual(cpi.capex.payments.map((p) => money(p.cents)), ['500,000.00', '500,000.00'])
  assert.deepEqual(cpi.capex.payments, flat.capex.payments, 'the CPI does not touch the payments')
  const m13 = cpi.schedule.find((r) => r.fromMonth === 13)
  assert.ok(m13 && m13.subscriptionCents > flat.schedule.find((r) => r.fromMonth === 13).subscriptionCents, 'year 2 subscription did escalate')
  assert.equal(money(m13.capexCents), '500,000.00')
  assert.equal(m13.netCents, m13.capexCents + m13.subscriptionCents, 'invoice = unescalated CAPEX + escalated subscription')
})

test('v1.6: with no CPI the OPEX schedule is one run and the Base schedule IS the Final one', () => {
  const q = quote({ safesight: 120 }, 60)
  assert.deepEqual(q.schedule.map((r) => [r.fromMonth, r.toMonth, money(r.netCents)]), [[1, 60, '289,818.77']])
  assert.equal(q.base.schedule, q.schedule, 'one schedule, not two that agree')
})

test('v1.6 (Verification 24): a recovery period other than the default 12 is used', () => {
  // POSITION: 1,550,000.00 / 24 = 64,583.333.., half-up 64,583.33 for months 1
  // to 23; month 24 = 1,550,000.00 - 23 x 64,583.33 = 64,583.41.
  const q = quote(DEMO, 60, CAPEX({ capexStructure: 'two_phase', recoveryMonths: 24 }), CATALOG)
  assert.deepEqual(q.schedule.slice(0, 2).map((r) => [r.fromMonth, r.toMonth, money(r.capexCents)]),
    [[1, 23, '64,583.33'], [24, 24, '64,583.41']])
  // And the default IS 12 (G-C3 without R given).
  const d = quote(DEMO, 60, CAPEX({ capexStructure: 'two_phase' }), CATALOG)
  assert.deepEqual([d.schedule[1].fromMonth, money(d.schedule[1].capexCents)], [12, '129,166.63'])
})

