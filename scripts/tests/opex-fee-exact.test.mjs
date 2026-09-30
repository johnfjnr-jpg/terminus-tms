// ── R-TL1 / R-TL1a: A STORED FEE IS THE ROW'S CONTRACT TOTAL, EXACTLY ────
//
// John's rulings 2026-09-30, and the second reversed the first's tolerance.
//
//   R-TL1   the all-in fee ABSORBS the type's lump-sum installation share, and
//           ONE function computes a type's installation price for both the
//           allocation and the table.
//   R-TL1a  with a stored fee, row Contract Total = units x fee x term EXACTLY,
//           computed directly and never re-summed from rounded components.
//
// ── WHAT THIS CATCHES, MEASURED BEFORE IT WAS WRITTEN ────────────────────
//
// W-TL1. On a LUMP SUM deal the row total ran $423,798 above units x fee x term
// on John's own record, at every fee, because two functions disagreed about
// what a type's installation price is:
//
//   deal-inputs.js  OPEX_LINES[type].in = ['inSsEx','inSsNew']  -> absent on a
//                   lump sum deal, so the allocation scaled a row with NO
//                   installation in it and hit a target that excluded it
//   opex.js         lumpShare[type]  -> the type's share of `inLump`, added to
//                   the row the allocation had just priced without it
//
// Verification 20: two readers of one value. Per-unit they agreed exactly;
// lump sum they differed by the whole installation share.
//
// ── AND THE PER-UNIT CASE WAS NEVER EXACT EITHER ─────────────────────────
//
// It missed by tens of dollars from whole-dollar rounding, dominated by the
// hosting line, which is rounded per month and then multiplied by the term. The
// first Phase 0 declared a tolerance for that and John reversed it: the LINES
// cannot express an arbitrary fee, but the TOTAL need not be re-summed from
// them.
import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveRates } from '../../src/lib/rate-resolution.js'
import { buildDealInputs } from '../../src/lib/deal-inputs.js'
import { calculateDeal } from '../../src/lib/deal-calculator.js'
import { opexRows, installShares } from '../../src/lib/opex.js'

const CATALOG = {
  ssUnitCost: 8000, aqUnitCost: 2000, hemirUnitCost: 100000,
  hoSafesight: 200, hoAqm: 100, hoHemir: 500,
  inSsExisting: 1500, inSsNew: 2500, inAqm: 400, inHemir: 3000,
}

/** John's own deal's shape: 21 SafeSight over two counts, 60 months. */
const BASE = {
  paymentMode: 'opex', structure: 'single',
  ssExisting: 11, ssNew: 10, aqm: 9, hemir: 0,
  duration: 60, targetMargin: 30, warrantyPct: 0, invoicing: 'monthly',
}
const N = BASE.ssExisting + BASE.ssNew
const T = BASE.duration

const MODES = {
  'per unit': { installResp: 'Terminus Contractor - Per Unit' },
  'lump sum': { installResp: 'Terminus Contractor - Lump Sum', lumpSumCost: 300000 },
}

const price = (over) => {
  const payload = { ...BASE, ...over }
  const { rates } = resolveRates(payload, CATALOG)
  const inputs = buildDealInputs(payload, { testBedCost: 0, rates })
  const result = calculateDeal(inputs)
  return { payload, inputs, result, rows: opexRows(result, payload, rates), rates }
}

for (const [mode, over] of Object.entries(MODES)) {
  test(`R-TL1a: ${mode} - the row total is units x fee x term EXACTLY`, () => {
    for (const fee of [500, 800, 1234]) {
      const { rows } = price({ ...over, opexUnitFees: { ss: fee } })
      const ss = rows.find((r) => r.key === 'ss')
      assert.equal(ss.contractTotal, fee * N * T,
        `${mode} at a $${fee} fee: ${ss.contractTotal} against ${fee * N * T}`)
    }
  })

  test(`R-TL1a: ${mode} - and the reported fee is the fee that was typed`, () => {
    // The table divides the total back out to show a per-unit fee. If the total
    // is exact the division must return the typed figure, or the screen shows a
    // fee nobody entered beside a total that came from one.
    const { rows } = price({ ...over, opexUnitFees: { ss: 777 } })
    assert.equal(rows.find((r) => r.key === 'ss').monthlyFee, 777)
  })
}

test('R-TL1: the two installation modes now AGREE about what the fee buys', () => {
  // The defect in one line: the same fee, the same units, the same term, and
  // two totals that differed by the whole installation share.
  const perUnit = price({ ...MODES['per unit'], opexUnitFees: { ss: 500 } })
  const lumpSum = price({ ...MODES['lump sum'], opexUnitFees: { ss: 500 } })
  const t = (p) => p.rows.find((r) => r.key === 'ss').contractTotal
  assert.equal(t(perUnit), t(lumpSum),
    'the installation ARRANGEMENT changed the all-in fee, which is what W-TL1 reported')
  assert.equal(t(perUnit), 500 * N * T)
})

test('R-TL1a: the breakdown FOOTS to the exact total', () => {
  // The residue has to land somewhere, and a total that does not equal its own
  // lines is the defect wearing different clothes. Whichever line absorbs it,
  // the lines must sum to what the row reports.
  for (const [mode, over] of Object.entries(MODES)) {
    const { result, rows, payload, rates } = price({ ...over, opexUnitFees: { ss: 900 } })
    const ss = rows.find((r) => r.key === 'ss')
    const g = result.groups
    const px = (grp, k) => grp.rows.find((r) => r.key === k)?.rawPrice ?? 0
    // Every term the row is built from, by source key.
    const oneOff = px(g.hardwareGroup, 'hwSs') + px(g.hardwareGroup, 'hwWarranty')
      + (over.lumpSumCost !== undefined
        ? lumpShareOf(result, payload, rates, 'ss')
        : px(g.installGroup, 'inSsEx') + px(g.installGroup, 'inSsNew'))
    const monthly = px(g.hostingGroup, 'hoSs')
    assert.equal(oneOff + monthly * T, ss.contractTotal,
      `${mode}: the lines do not foot to the row total`)
  }
})

/**
 * The type's share of a lump sum.
 *
 * IT CALLS THE ONE FUNCTION rather than restating the weighting. A first draft
 * of this file carried its own copy, and it went red the moment the shares
 * became whole-dollar - **correctly**, because a test that restates the rule is
 * the second reader R-TL1 exists to delete, arriving inside the test for R-TL1.
 */
function lumpShareOf(result, payload, rates, type) {
  const units = {
    ss: (Number(payload.ssExisting) || 0) + (Number(payload.ssNew) || 0),
    aq: Number(payload.aqm) || 0, hemir: Number(payload.hemir) || 0,
  }
  const shares = installShares(result.groups.installGroup.rows, payload, rates, units)
  return shares ? shares[type].price : 0
}

test('a row with NO stored fee still derives its fee from its own price', () => {
  // The other half of the either-or, and the guard against a fix that makes
  // every row report a typed figure. AQ has no fee: its figure must still come
  // from what the deal prices, and must not become zero or a default.
  const { rows } = price({ ...MODES['lump sum'], opexUnitFees: { ss: 500 } })
  const aq = rows.find((r) => r.key === 'aq')
  assert.ok(aq.monthlyFee > 0, 'the derived fee vanished')
  assert.equal(aq.contractTotal, aq.monthlyFee * aq.units * T)
})

test('a type with NO units reports no fee rather than dividing by zero', () => {
  const { rows } = price({ ...MODES['lump sum'], opexUnitFees: { ss: 500 } })
  const hemir = rows.find((r) => r.key === 'hemir')
  assert.equal(hemir.units, 0)
  assert.equal(hemir.monthlyFee, null)
})
