// ── TERM PRICING SETTINGS: storage to engine, and an admin's change ───────
//
// TERM_PRICING Phase 3 (R-TP3, R-TP6). The rows below are the SHAPE the
// migration 20261001000002 seeds and the route reads (key, value jsonb), and
// the catalog rows are the shape the route reads with ::text casts. Built from
// the migration's own seed values, not from what this module happens to read
// (Verification 47).

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  settingsFromRows, costsFromCatalog, buildParams, mergeSettingsChange, SETTING_KEYS,
} from '../../src/lib/term-pricing-settings.js'
import { priceQuote, formatMoney, TermPricingError } from '../../src/lib/term-pricing.js'

const SEED_ROWS = [
  { key: 'TERMS', value: [12, 24, 36, 48, 60, 72, 84, 96, 120] },
  { key: 'ANCHOR_TERM', value: 36 },
  { key: 'ANCHOR_MARGIN', value: { safesight: '90', air_quality: '90', hemir: '90' } },
  { key: 'SHORT_TERM_MARGIN', value: { safesight: '90', air_quality: '90', hemir: '90' } },
  { key: 'PROFIT_STEP', value: '0.00' },
  { key: 'VOLUME_BANDS', value: [{ from: 1, discountPct: '0' }, { from: 10, discountPct: '5' }, { from: 50, discountPct: '10' }, { from: 200, discountPct: '15' }] },
  { key: 'HW_UPFRONT_MARGIN', value: '20' },
  { key: 'MARGIN_FLOOR', value: '25' },
  { key: 'CURRENCY', value: 'USD' },
]

// What the route reads: every batch, figures as text; and what
// resolveCurrentBatches returns for them (numbers, plus batch_id).
const RAW = [
  { id: 'b-ss', product: 'safesight', batch_label: 'Initial catalog', effective_from: '2026-08-27', unit_cost: '8000.00', hosting_cost_month: '200.00' },
  { id: 'b-aq', product: 'air_quality', batch_label: 'Initial catalog', effective_from: '2026-08-27', unit_cost: '2000.00', hosting_cost_month: '100.00' },
  { id: 'b-he', product: 'hemir', batch_label: 'Initial catalog', effective_from: '2026-08-27', unit_cost: '100000.00', hosting_cost_month: '500.00' },
]
const CURRENT = RAW.map((r) => ({ product: r.product, batch_id: r.id, batch_label: r.batch_label, effective_from: r.effective_from, unit_cost: Number(r.unit_cost), hosting_cost_month: Number(r.hosting_cost_month) }))

const settings = () => settingsFromRows(SEED_ROWS)
const costs = () => costsFromCatalog(CURRENT, RAW)

test('the seeded settings and the catalog price T6 exactly through the engine', () => {
  const q = priceQuote({ units: { safesight: 120 }, termMonths: 60, paymentStructure: 'opex' }, buildParams(settings(), costs()))
  assert.equal(formatMoney(q.tcvNetCents), '17,389,126.20')
})

test('catalog figures reach the engine as the TEXT the route read, never the resolver\'s numbers', () => {
  const c = costs()
  assert.equal(c.safesight.hwCost, '8000.00')
  assert.equal(typeof c.safesight.hostingMonthly, 'string')
  assert.equal(c.safesight.batchLabel, 'Initial catalog')
})

test('a missing setting is refused, by name', () => {
  assert.throws(() => settingsFromRows(SEED_ROWS.filter((r) => r.key !== 'MARGIN_FLOOR')),
    (e) => e instanceof TermPricingError && /MARGIN_FLOOR/.test(e.message))
  assert.equal(SETTING_KEYS.length, 9)
})

test('an admin change merges, and ANCHOR_MARGIN 80% flows to the quote (E3 at the module layer)', () => {
  const merged = mergeSettingsChange(settings(), { ANCHOR_MARGIN: { safesight: '80', air_quality: '90', hemir: '90' } }, costs())
  const q = priceQuote({ units: { safesight: 1 }, termMonths: 36, paymentStructure: 'opex' }, buildParams(merged, costs()))
  // Spec formulas: 15,200 x 0.8 / 0.2 = 60,800 profit; 76,000 / 36 = 2,111.11; x 36 = 75,999.96.
  assert.equal(formatMoney(q.tcvNetCents), '75,999.96')
})

test('an invalid change is refused with a message fit to show', () => {
  const bad = (patch, re) => assert.throws(() => mergeSettingsChange(settings(), patch, costs()),
    (e) => e instanceof TermPricingError && re.test(e.message), JSON.stringify(patch))
  bad({ NOT_A_KEY: '1' }, /unknown setting/)
  bad({}, /nothing to change/)
  bad({ MARGIN_FLOOR: 25 }, /decimal string/)                  // a float-shaped number is refused
  bad({ ANCHOR_MARGIN: { safesight: '100', air_quality: '90', hemir: '90' } }, /below 100%/)
  bad({ ANCHOR_MARGIN: { safesight: '90' } }, /air_quality, hemir/) // must cover the catalog
  bad({ TERMS: [12, 24, 48] }, /ANCHOR_TERM must be one of TERMS/)
  bad({ TERMS: [24, 12, 36] }, /ascending/)
  bad({ CURRENCY: 'usd' }, /three-letter/)
})
