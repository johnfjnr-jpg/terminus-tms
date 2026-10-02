// ── TERM PRICING GOLDENS: docs/pricing-spec.md v1.2.1, sections 10 and 11 ──
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
const SPEC_PARAMS = Object.freeze({
  TERMS: [12, 24, 36, 48, 60, 72, 84, 96, 120],
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

test('T15 T6 as capex: upfront 1,200,000.00 + 269,818.77 x 60 = 17,389,126.20', () => {
  const q = quote({ safesight: 120 }, 60, { paymentStructure: 'capex' })
  assert.equal(money(q.capex.upfrontCents), '1,200,000.00')
  assert.equal(money(q.capex.monthlyServiceCents), '269,818.77')
  assert.equal(money(q.tcvNetCents), '17,389,126.20')
  assert.equal(q.capex.upfrontCents + q.capex.monthlyServiceCents * 60n, q.tcvNetCents, 'ties to TCV exactly')
  assert.deepEqual(q.schedule.map((r) => [r.kind, r.fromMonth, r.toMonth, money(r.netCents)]),
    [['upfront', 0, 0, '1,200,000.00'], ['monthly', 1, 60, '269,818.77']])
})

test('T16 1 unit, 60, escalator 3%: year fees, TCV 166,494.36, margin 88.0%', () => {
  const q = quote({ safesight: 1 }, 60, { escalatorPct: '3' })
  assert.deepEqual(q.monthlyTotalByYear.map(money),
    ['2,613.33', '2,691.73', '2,772.48', '2,855.66', '2,941.33'])
  assert.equal(money(q.tcvNetCents), '166,494.36')
  assert.equal(pct(q.grossMargin), '88.0')
})

test('T17 1 unit, 18 months: error, term not offered', () => {
  assert.throws(() => quote({ safesight: 1 }, 18),
    (e) => e instanceof TermPricingError && e.code === 'TERM_NOT_OFFERED'
      // A3 (John, 2026-10-01): the copy, with the article chosen by the number.
      && e.message === 'An 18-month term is not offered. Choose one of: 12, 24, 36, 48, 60, 72, 84, 96, 120 months.')
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

test('T22 T6 as capex with escalator 3%: the service fee escalates and TCV is the OPEX TCV', () => {
  const q = quote({ safesight: 120 }, 60, { paymentStructure: 'capex', escalatorPct: '3' })
  assert.equal(money(q.tcvNetCents), '18,464,248.32')
  assert.equal(money(q.capex.upfrontCents), '1,200,000.00')
  assert.deepEqual(q.capex.serviceByYear.map(money),
    ['270,983.34', '279,112.84', '287,486.23', '296,110.81', '304,994.14'])
  assert.equal(q.capex.upfrontCents + q.capex.serviceByYear.reduce((t, c) => t + 12n * c, 0n), q.tcvNetCents,
    'upfront + sum = TCV')
  const opex = quote({ safesight: 120 }, 60, { escalatorPct: '3' })
  assert.equal(q.tcvNetCents, opex.tcvNetCents, 'TCV identical to the OPEX TCV')
  assert.deepEqual(q.schedule.map((r) => [r.kind, r.fromMonth, r.toMonth]),
    [['upfront', 0, 0], ['monthly', 1, 12], ['monthly', 13, 24], ['monthly', 25, 36], ['monthly', 37, 48], ['monthly', 49, 60]])
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

test('flow: HW_UPFRONT_MARGIN 0 puts the CAPEX upfront at cost', () => {
  // 120 x 8,000 = 960,000.00; service (17,389,126.20 - 960,000) / 60 = 273,818.77.
  const q = quote({ safesight: 120 }, 60, { paymentStructure: 'capex' }, withParams({ HW_UPFRONT_MARGIN: '0' }))
  assert.equal(money(q.capex.upfrontCents), '960,000.00')
  assert.equal(money(q.capex.monthlyServiceCents), '273,818.77')
})

test('flow: catalog costs are inputs, not constants', () => {
  // HW 9,000: cost(36) 16,200; price 162,000; / 36 = 4,500.00 exactly.
  const p = withParams({ costs: { ...SPEC_PARAMS.costs, safesight: { hwCost: '9000.00', hostingMonthly: '200.00' } } })
  assert.equal(money(quote({ safesight: 1 }, 36, {}, p).monthlyTotalCents), '4,500.00')
})

test('A1: under CAPEX each ladder row IS the CAPEX quote at that term, and vs 36 compares the service fee', () => {
  const input = { units: { safesight: 120 }, paymentStructure: 'capex', escalatorPct: '3' }
  const ladder = termLadder(input, SPEC_PARAMS)
  for (const r of ladder) {
    const q = priceQuote({ ...input, termMonths: r.termMonths }, SPEC_PARAMS)
    assert.equal(r.upfrontCents, q.capex.upfrontCents, `${r.termMonths}: upfront`)
    assert.equal(r.monthlyServiceCents, q.capex.monthlyServiceCents, `${r.termMonths}: service fee`)
    assert.equal(r.tcvNetCents, q.tcvNetCents, `${r.termMonths}: TCV`)
    assert.equal(pct(r.grossMargin), pct(q.grossMargin), `${r.termMonths}: margin`)
  }
  // The 60-month row reads T22.
  const r60 = ladder.find((r) => r.termMonths === 60)
  assert.equal(money(r60.upfrontCents), '1,200,000.00')
  assert.equal(money(r60.monthlyServiceCents), '270,983.34')
  // vs 36 is the service fee against the 36-month service fee, not the OPEX fee.
  const r36 = ladder.find((r) => r.isAnchor)
  const expected = { n: r36.monthlyServiceCents - r60.monthlyServiceCents, d: r36.monthlyServiceCents }
  assert.equal(pct(r60.savingVsAnchor), pct(expected))
  const opexSaving = termLadder({ ...input, paymentStructure: 'opex' }, SPEC_PARAMS).find((r) => r.termMonths === 60).savingVsAnchor
  assert.notEqual(pct(r60.savingVsAnchor), pct(opexSaving), 'the CAPEX comparison is not the OPEX one')
  // Under OPEX the CAPEX columns are absent.
  assert.equal(termLadder({ ...input, paymentStructure: 'opex' }, SPEC_PARAMS)[0].upfrontCents, null)
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
