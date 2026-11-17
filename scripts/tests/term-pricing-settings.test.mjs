// ── TERM PRICING SETTINGS: storage to engine, and an admin's change ───────
//
// TERM_PRICING Phase 3 (R-TP3, R-TP6). The rows below are the SHAPE the
// migrations seed and the route reads (key, value jsonb), and the catalog rows
// are the shape the route reads with ::text casts. Built from the migrations'
// own seed values, not from what this module happens to read (Verification 47).
//
// v2.0 (TP_LADDER A1, A2, Q1): the rows are what 20261117000001 leaves: the
// formula's three keys dropped, ANCHOR_TERM renamed COMPARE_TERM with its
// value kept, and the three price ladders John set (A2), as written there.

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  settingsFromRows, costsFromCatalog, buildParams, mergeSettingsChange, SETTING_KEYS,
} from '../../src/lib/term-pricing-settings.js'
// v1.8 (TP_BANDS): through the namespace, so before the export exists only the
// tests that need it fail.
import * as SETTINGS from '../../src/lib/term-pricing-settings.js'
const PER_PRODUCT_KEYS = SETTINGS.PER_PRODUCT_KEYS
const mergeBandsChange = (...a) => SETTINGS.mergeBandsChange(...a)
const mergeLadderChange = (...a) => SETTINGS.mergeLadderChange(...a)
import { priceQuote, formatMoney, formatPct, TermPricingError } from '../../src/lib/term-pricing.js'

const LADDER = (s) => Object.fromEntries(s.trim().split(/\s+/).map((x) => x.split(':')))
// A2, as the migration writes them: USD per unit per month, two decimals.
const A2 = {
  safesight: LADDER('12:2500.00 24:1500.00 36:1080.00 48:875.00 60:750.00 72:665.00 84:605.00 96:560.00 108:525.00 120:500.00'),
  air_quality: LADDER('12:1000.00 24:600.00 36:432.00 48:350.00 60:300.00 72:266.00 84:242.00 96:224.00 108:210.00 120:200.00'),
  hemir: LADDER('12:15000.00 24:9000.00 36:6480.00 48:5250.00 60:4500.00 72:3990.00 84:3630.00 96:3360.00 108:3150.00 120:3000.00'),
}
const SEED_BANDS = [{ from: 1, discountPct: '0' }, { from: 10, discountPct: '5' }, { from: 50, discountPct: '10' }, { from: 200, discountPct: '15' }]
const SEED_ROWS = [
  { key: 'TERMS', value: [12, 24, 36, 48, 60, 72, 84, 96, 108, 120] },
  // Q1: ANCHOR_TERM renamed, value kept.
  { key: 'COMPARE_TERM', value: 36 },
  { key: 'PRICE_LADDER_BY_PRODUCT', value: A2 },
  // 20261012000001's seed: every product on the v1.7 bands.
  { key: 'VOLUME_BANDS_BY_PRODUCT', value: { safesight: SEED_BANDS, air_quality: SEED_BANDS, hemir: SEED_BANDS } },
  { key: 'HW_UPFRONT_MARGIN', value: '20' },
  { key: 'MARGIN_FLOOR', value: '25' },
  { key: 'CURRENCY', value: 'USD' },
]

// What the route reads: every batch, figures as text; and what
// resolveCurrentBatches returns for them (numbers, plus batch_id). v2.0 (A3):
// the catalog as John's batch leaves it, Air Quality and HEMIR hosting at
// 50.00 and 200.00.
const RAW = [
  { id: 'b-ss', product: 'safesight', batch_label: 'Initial catalog', effective_from: '2026-08-27', unit_cost: '8000.00', hosting_cost_month: '200.00' },
  { id: 'b-aq', product: 'air_quality', batch_label: 'John 2026-11-17, TP_LADDER', effective_from: '2026-11-17', unit_cost: '2000.00', hosting_cost_month: '50.00' },
  { id: 'b-he', product: 'hemir', batch_label: 'John 2026-11-17, TP_LADDER', effective_from: '2026-11-17', unit_cost: '100000.00', hosting_cost_month: '200.00' },
]
const CURRENT = RAW.map((r) => ({ product: r.product, batch_id: r.id, batch_label: r.batch_label, effective_from: r.effective_from, unit_cost: Number(r.unit_cost), hosting_cost_month: Number(r.hosting_cost_month) }))

const settings = () => settingsFromRows(SEED_ROWS)
const costs = () => costsFromCatalog(CURRENT, RAW)
const quote = (units, T, s = settings()) => priceQuote({ units, termMonths: T, paymentStructure: 'opex' }, buildParams(s, costs()))

test('the seeded settings and the catalog price through the engine (A2 seed, LG-4 shape)', () => {
  // 120 SafeSight at 60: band fees 750.00 / 712.50 / 675.00 (A2's 750.00 at 0%,
  // 5%, 10%); 9 x 750.00 + 40 x 712.50 + 71 x 675.00 = 83,175.00 a month;
  // x 60 = 4,990,500.00.
  assert.equal(formatMoney(quote({ safesight: 120 }, 60).tcvNetCents), '4,990,500.00')
  // A7: every catalog product prices from its own ladder. 1 Air Quality at 36:
  // 432.00 x 36 = 15,552.00; cost 2,000 + 50 x 36 = 3,800.00; margin 75.6%.
  const aq = quote({ air_quality: 1 }, 36)
  assert.equal(formatMoney(aq.tcvNetCents), '15,552.00')
  assert.equal(formatPct(aq.grossMargin, 1), '75.6')
})

test('catalog figures reach the engine as the TEXT the route read, never the resolver\'s numbers', () => {
  const c = costs()
  assert.equal(c.safesight.hwCost, '8000.00')
  assert.equal(typeof c.safesight.hostingMonthly, 'string')
  assert.equal(c.safesight.batchLabel, 'Initial catalog')
})

test('a missing setting is refused, by name; the price ladder is REQUIRED (A1)', () => {
  assert.throws(() => settingsFromRows(SEED_ROWS.filter((r) => r.key !== 'MARGIN_FLOOR')),
    (e) => e instanceof TermPricingError && /MARGIN_FLOOR/.test(e.message))
  assert.throws(() => settingsFromRows(SEED_ROWS.filter((r) => r.key !== 'PRICE_LADDER_BY_PRODUCT')),
    (e) => e instanceof TermPricingError && e.code === 'SETTINGS_MISSING' && /PRICE_LADDER_BY_PRODUCT/.test(e.message))
  assert.deepEqual(SETTING_KEYS, ['TERMS', 'COMPARE_TERM', 'PRICE_LADDER_BY_PRODUCT', 'VOLUME_BANDS_BY_PRODUCT', 'HW_UPFRONT_MARGIN', 'MARGIN_FLOOR', 'CURRENCY'])
})

test('A1, Q1: the formula keys are gone; rows left over before the migration are carried and never read', () => {
  for (const k of ['ANCHOR_TERM', 'ANCHOR_MARGIN', 'SHORT_TERM_MARGIN', 'PROFIT_STEP']) assert.ok(!SETTING_KEYS.includes(k), k)
  // HW_UPFRONT_MARGIN stays: CAPEX's hardware value reads it.
  assert.ok(SETTING_KEYS.includes('HW_UPFRONT_MARGIN'))
  const withOld = settingsFromRows([...SEED_ROWS, { key: 'ANCHOR_MARGIN', value: { safesight: '10' } }, { key: 'PROFIT_STEP', value: '5000.00' }])
  const p = buildParams(withOld, costs())
  for (const k of ['ANCHOR_TERM', 'ANCHOR_MARGIN', 'SHORT_TERM_MARGIN', 'PROFIT_STEP']) assert.equal(p[k], undefined, `${k} does not reach the engine`)
  assert.equal(formatMoney(quote({ safesight: 120 }, 60, withOld).tcvNetCents), '4,990,500.00', 'and prices nothing')
  assert.throws(() => mergeSettingsChange(settings(), { ANCHOR_MARGIN: { safesight: '80' } }, costs()),
    (e) => e instanceof TermPricingError && /unknown setting: ANCHOR_MARGIN/.test(e.message))
})

test('Q1: a COMPARE_TERM change merges and moves only the "vs" column, never a price', () => {
  const merged = mergeSettingsChange(settings(), { COMPARE_TERM: 48 }, costs())
  const q = quote({ safesight: 1 }, 36, merged)
  // 1,080.00 against 875.00: 1 - 1,080 / 875 = -0.23428..., a 23.4% premium.
  assert.equal(formatPct(q.lines[0].savingVsCompare, 1), '-23.4')
  assert.equal(formatMoney(q.tcvNetCents), '38,880.00', '36 months still prices at 1,080.00 x 36')
})

test('an invalid change is refused with a message fit to show', () => {
  const bad = (patch, re) => assert.throws(() => mergeSettingsChange(settings(), patch, costs()),
    (e) => e instanceof TermPricingError && re.test(e.message), JSON.stringify(patch))
  bad({ NOT_A_KEY: '1' }, /unknown setting/)
  bad({}, /nothing to change/)
  bad({ MARGIN_FLOOR: 25 }, /decimal string/)                  // a float-shaped number is refused
  bad({ TERMS: [12, 24, 48] }, /COMPARE_TERM must be one of TERMS/)
  bad({ COMPARE_TERM: 18 }, /COMPARE_TERM must be one of TERMS/)
  bad({ TERMS: [24, 12, 36] }, /ascending/)
  bad({ CURRENCY: 'usd' }, /three-letter/)
  // P3: the price ladder has one write path, its own route.
  bad({ PRICE_LADDER_BY_PRODUCT: A2 }, /PRICE_LADDER_BY_PRODUCT is saved by its own editor/)
})

// ── v1.8 (TP_BANDS) ─────────────────────────────────────────────────────

const SIX = [[1, '0'], [10, '5'], [50, '10'], [200, '15'], [500, '20'], [1000, '30']].map(([from, discountPct]) => ({ from, discountPct }))

test('TB-1: the settings carry bands per product, and the single list is retired from the keys', () => {
  assert.ok(SETTING_KEYS.includes('VOLUME_BANDS_BY_PRODUCT'))
  assert.ok(!SETTING_KEYS.includes('VOLUME_BANDS'))
  assert.ok(PER_PRODUCT_KEYS.includes('VOLUME_BANDS_BY_PRODUCT'))
  const p = buildParams(settings(), costs())
  assert.equal(p.VOLUME_BANDS, undefined, 'the old key does not reach the engine')
  assert.deepEqual(Object.keys(p.VOLUME_BANDS_BY_PRODUCT).sort(), ['air_quality', 'hemir', 'safesight'])
  // A change naming the retired key is refused as unknown.
  assert.throws(() => mergeSettingsChange(settings(), { VOLUME_BANDS: SIX }, costs()),
    (e) => e instanceof TermPricingError && /unknown setting: VOLUME_BANDS/.test(e.message))
})

test('TB-1: every catalog product must have bands', () => {
  const s = settings()
  const { hemir, ...rest } = s.VOLUME_BANDS_BY_PRODUCT
  assert.ok(hemir)
  assert.throws(() => mergeSettingsChange(s, { VOLUME_BANDS_BY_PRODUCT: rest }, costs()),
    (e) => e instanceof TermPricingError && /VOLUME_BANDS_BY_PRODUCT needs a value for: hemir/.test(e.message))
})

test('TB-8, 0.5: saving one product\'s bands changes that product only', () => {
  const before = settings()
  const merged = mergeBandsChange(before, 'safesight', SIX, costs())
  assert.deepEqual(merged.VOLUME_BANDS_BY_PRODUCT.safesight, SIX)
  assert.deepEqual(merged.VOLUME_BANDS_BY_PRODUCT.hemir, before.VOLUME_BANDS_BY_PRODUCT.hemir)
  assert.deepEqual(merged.VOLUME_BANDS_BY_PRODUCT.air_quality, before.VOLUME_BANDS_BY_PRODUCT.air_quality)
  // Every other key is untouched.
  for (const k of SETTING_KEYS.filter((x) => x !== 'VOLUME_BANDS_BY_PRODUCT')) assert.deepEqual(merged[k], before[k], k)
  // 1,000 SafeSight at 60 on the six bands, A2's 750.00: fees 750.00, 712.50,
  // 675.00, 637.50, 600.00, 525.00 for 9, 40, 150, 300, 500 and 1 units:
  // 6,750 + 28,500 + 101,250 + 191,250 + 300,000 + 525 = 628,275.00 a month;
  // x 60 = 37,696,500.00.
  assert.equal(formatMoney(quote({ safesight: 1000 }, 60, merged).tcvNetCents), '37,696,500.00')
})

test('TB-6: an invalid band set is refused with every problem, in the 3.2 wording', () => {
  const overlap = [[1, '0'], [2, '5'], [5, '10'], [4, '15']].map(([from, discountPct]) => ({ from, discountPct }))
  assert.throws(() => mergeBandsChange(settings(), 'hemir', overlap, costs()), (e) =>
    e instanceof TermPricingError && e.code === 'BAD_BANDS'
    && e.message === 'Band 4 must start above 5, where band 3 starts. Bands cannot overlap. Fix this to save.'
    && Array.isArray(e.problems) && e.problems.length === 1)
  assert.throws(() => mergeBandsChange(settings(), 'not_a_product', SIX, costs()),
    (e) => e instanceof TermPricingError && e.code === 'BAD_PRODUCT')
})

test('TB-3: a start the editor sent as text is stored as a whole number', () => {
  const typed = [{ from: '1', discountPct: '0' }, { from: '25', discountPct: '7.5' }]
  const merged = mergeBandsChange(settings(), 'air_quality', typed, costs())
  assert.deepEqual(merged.VOLUME_BANDS_BY_PRODUCT.air_quality, [{ from: 1, discountPct: '0' }, { from: 25, discountPct: '7.5' }])
})

// ── v2.0 (TP_LADDER A6, A7): one product's price ladder ─────────────────

const TYPED_AQ = { 12: '1,100', 24: '650.5', 36: '440', 48: '355', 60: '305', 72: '270', 84: '245', 96: '226', 108: '212', 120: '201.25' }

test('A7, ruling 10: an admin saves Air Quality\'s price ladder, and only that product changes', () => {
  const before = settings()
  const merged = mergeLadderChange(before, 'air_quality', TYPED_AQ, costs())
  // The stored shape: two decimals, commas gone, every term in TERMS.
  assert.deepEqual(merged.PRICE_LADDER_BY_PRODUCT.air_quality, {
    12: '1100.00', 24: '650.50', 36: '440.00', 48: '355.00', 60: '305.00', 72: '270.00', 84: '245.00', 96: '226.00', 108: '212.00', 120: '201.25',
  })
  assert.deepEqual(merged.PRICE_LADDER_BY_PRODUCT.safesight, before.PRICE_LADDER_BY_PRODUCT.safesight)
  assert.deepEqual(merged.PRICE_LADDER_BY_PRODUCT.hemir, before.PRICE_LADDER_BY_PRODUCT.hemir)
  for (const k of SETTING_KEYS.filter((x) => x !== 'PRICE_LADDER_BY_PRODUCT')) assert.deepEqual(merged[k], before[k], k)
  // The saved price prices: 1 Air Quality at 36, 440.00 x 36 = 15,840.00.
  assert.equal(formatMoney(quote({ air_quality: 1 }, 36, merged).tcvNetCents), '15,840.00')
})

test('A6, 3.3: an invalid price ladder is refused with every problem in the editor\'s wording; no removal (ruling 3)', () => {
  const refused = (prices, first, n) => assert.throws(() => mergeLadderChange(settings(), 'hemir', prices, costs()), (e) =>
    e instanceof TermPricingError && e.code === 'BAD_PRICE_LADDER' && e.message === first && e.problems.length === n, JSON.stringify(prices))
  const { 36: _, ...no36 } = A2.hemir
  refused(no36, 'Enter a price for 36 months. Every offered term needs one. Fix this to save.', 1)
  refused({ ...A2.hemir, 60: '0' }, 'The 60-month price must be above 0, to the cent, for example 1080.00. Fix this to save.', 1)
  refused({ ...A2.hemir, 60: '4500.005' }, 'The 60-month price must be above 0, to the cent, for example 1080.00. Fix this to save.', 1)
  refused({ ...A2.hemir, 18: '9000.00' }, '18 months is not an offered term. Remove its price, or add the term to TERMS first. Fix this to save.', 1)
  refused({}, 'Enter a price for 12 months. Every offered term needs one. Fix this to save.', 10)
  assert.throws(() => mergeLadderChange(settings(), 'not_a_product', A2.hemir, costs()),
    (e) => e instanceof TermPricingError && e.code === 'BAD_PRODUCT')
})
