// ── THE OPPORTUNITY COST CONTRACT ────────────────────────────────────────
//
// Enforces COST_CALCULATIONS.md section 2, the Opportunity cost model as ruled
// by John on 2026-09-16. Companion to test-bed-cost-contract.test.mjs, and the
// same standard: the worked examples are the acceptance cases, and a change
// that moves any of them fails here.
//
// WHY IT EXISTS. The Opportunity calculation was compared against the deal
// sheet (`old - terminus-deal-sheet.html`) and six divergences were measured,
// recorded in OPPORTUNITY_CALC_DIVERGENCES.md. John ruled on each: two were
// bugs and are fixed, three were deliberate and the deal sheet is stale, one is
// defence in depth. Nothing is written down twice; this file pins the ruled
// model so the next person does not re-derive it.
//
// EVERY EXPECTATION IS EXPRESSED, NEVER RESTATED. `3 * 2000 + 7 * 20000` beats
// `146000`. A hand-typed total is a second reader of the calculation and this
// estate has been caught by one (CLAUDE.md Verification 20).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calculateDeal, calculateHardwareAndWarranty, priceFromCost } from '../../src/lib/deal-calculator.js'
import { buildDealInputs } from '../../src/lib/deal-inputs.js'
import { resolveRates } from '../../src/lib/rate-resolution.js'

/** The catalog the worked examples price against. */
const CAT = {
  ssUnitCost: 8000, aqUnitCost: 2000, hemirUnitCost: 25000,
  inSsExisting: 2000, inSsNew: 20000, inAqm: 500, inHemir: 5000,
  hoSafesight: 200, hoAqm: 100, hoHemir: 500,
}
const deal = (over = {}) => {
  const p = {
    ssExisting: 3, ssNew: 7, aqm: 5, hemir: 2, duration: 12,
    targetMargin: 30, warrantyPct: 2, installResp: 'Terminus, Per Unit',
    structure: 'single', invoicing: 'annual', ...over,
  }
  return calculateDeal(buildDealInputs(p, { rates: resolveRates(p, CAT).rates }))
}

// ── A. WARRANTY ─────────────────────────────────────────────────────────
// count = ceil(SafeSight units x warranty %)
// cost  = count x (SafeSight unit cost + existing-infrastructure install)
// no margin, and it reaches the customer price at cost.

test('A. WARRANTY: the count is a percentage of SAFESIGHT units, rounded UP', () => {
  const hw = calculateHardwareAndWarranty({
    ssUnitCost: 8000, ssUnits: 100, aqUnitCost: 2000, aqUnits: 0,
    hemirUnitCost: 0, hemirUnits: 0, warrantyPct: 2, ssInstallExistingCost: 2000,
  })
  assert.equal(hw.warrantyBasisUnits, 100)
  assert.equal(hw.warrantyUnits, Math.ceil(100 * 2 / 100))
  assert.equal(hw.warrantyCost, Math.ceil(100 * 2 / 100) * (8000 + 2000))
})

test('A. WARRANTY: rounds UP, so any fraction of a unit provisions a whole one', () => {
  const at = (units, pct) => calculateHardwareAndWarranty({
    ssUnitCost: 8000, ssUnits: units, aqUnitCost: 0, aqUnits: 0,
    hemirUnitCost: 0, hemirUnits: 0, warrantyPct: pct, ssInstallExistingCost: 2000,
  }).warrantyUnits
  assert.equal(at(10, 2), 1, 'ceil(0.2) is one whole spare')
  assert.equal(at(50, 2), 1, 'ceil(1.0) is one')
  assert.equal(at(51, 2), 2, 'ceil(1.02) is two')
  assert.equal(at(10, 0), 0, 'zero per cent provisions nothing')
})

test('A. WARRANTY: AQ and HEMIR do not enter the count, however many there are', () => {
  const only = (aq, hemir) => calculateHardwareAndWarranty({
    ssUnitCost: 8000, ssUnits: 10, aqUnitCost: 2000, aqUnits: aq,
    hemirUnitCost: 25000, hemirUnits: hemir, warrantyPct: 2, ssInstallExistingCost: 2000,
  })
  assert.equal(only(0, 0).warrantyUnits, only(500, 500).warrantyUnits,
    'a warranty provision is a spare SafeSight; other products do not create one')
  assert.equal(only(500, 500).warrantyCost, 1 * (8000 + 2000),
    'nor may they change what a spare is worth')
})

test('A. WARRANTY: valued at a SafeSight unit PLUS its existing-infra install', () => {
  const hw = calculateHardwareAndWarranty({
    ssUnitCost: 8000, ssUnits: 10, aqUnitCost: 0, aqUnits: 0,
    hemirUnitCost: 0, hemirUnits: 0, warrantyPct: 2, ssInstallExistingCost: 2000,
  })
  assert.equal(hw.warrantyUnitCost, 8000 + 2000)
  assert.notEqual(hw.warrantyUnitCost, 8000, 'the install half must be in there')
  // AND THE COST IS COMPUTED FROM IT. Added after a calibration: an injection
  // swapping the valuation back to the mix average left `warrantyUnitCost`
  // untouched and this test still passed, so it was asserting a derived field
  // nobody prices from rather than the price itself.
  assert.equal(hw.warrantyCost, hw.warrantyUnits * hw.warrantyUnitCost,
    'the figure charged must be the unit value times the count, not some other basis')
  const mixAverage = (8000 * 10) / 10
  assert.equal(hw.warrantyCost, 1 * 10000)
  assert.notEqual(hw.warrantyCost, 1 * mixAverage, 'the mix average must not price it')
})

test('A. WARRANTY: carries NO MARGIN, so its price equals its cost', () => {
  const d = deal()
  const line = d.groups.hardwareGroup.rows.find((r) => r.key === 'hwWarranty')
  assert.equal(line.rawPrice, line.rawCost, 'the warranty is a cost pass-through')
  assert.ok(line.rawCost > 0, 'and this deal genuinely has one, or the claim is vacuous')
})

test('A. WARRANTY: a margin override on the warranty key cannot reintroduce margin', () => {
  const d = deal({ marginOverrides: { hwWarranty: 50 } })
  const line = d.groups.hardwareGroup.rows.find((r) => r.key === 'hwWarranty')
  assert.equal(line.rawPrice, line.rawCost, 'margin applies to everything EXCEPT the warranty')
})

test('A. WARRANTY: it IS included in the price to the customer, at cost', () => {
  const withW = deal({ warrantyPct: 2 })
  const without = deal({ warrantyPct: 0 })
  const w = withW.hardware.warrantyCost
  assert.ok(w > 0)
  assert.equal(withW.totals.contractNet - without.totals.contractNet, w,
    'the customer pays the warranty, and pays exactly its cost')
  assert.equal(withW.totals.totalDealCost - without.totals.totalDealCost, w)
})

// ── B. INSTALLATION SPLIT ───────────────────────────────────────────────
// SafeSight: existing x existing-rate + new x new-rate, new = total - existing.
// AQ and HEMIR: units x their own rate.

test('B. INSTALL SPLIT: SafeSight splits existing and new, each at its own rate', () => {
  const d = deal()
  const row = (k) => d.groups.installGroup.rows.find((r) => r.key === k).rawCost
  assert.equal(row('inSsEx'), 3 * 2000, 'three existing at the existing rate')
  assert.equal(row('inSsNew'), 7 * 20000, 'seven new at the new rate')
  assert.equal(row('inAqm'), 5 * 500)
  assert.equal(row('inHemir'), 2 * 5000)
  assert.equal(d.groups.installGroup.rawTotalCost,
    3 * 2000 + 7 * 20000 + 5 * 500 + 2 * 5000)
})

test('B. INSTALL SPLIT: NEW IS THE REMAINDER of the SafeSight total', () => {
  // The record holds existing and new; their sum IS the total, so new is the
  // remainder by construction. Proven by holding the total at 10 and moving the
  // split: the unit count cannot move, and only the install mix may.
  for (const existing of [0, 3, 10]) {
    const d = deal({ ssExisting: existing, ssNew: 10 - existing })
    assert.equal(d.hardware.warrantyBasisUnits, 10, `the total is 10 at existing=${existing}`)
    assert.equal(d.groups.installGroup.rows.find((r) => r.key === 'inSsEx').rawCost, existing * 2000)
    assert.equal(d.groups.installGroup.rows.find((r) => r.key === 'inSsNew').rawCost, (10 - existing) * 20000)
  }
})

// ── C. THE FULL DEAL ────────────────────────────────────────────────────

test('C. FULL DEAL: every group and the total, expressed from the inputs', () => {
  const d = deal()
  const hardwareExWarranty = 10 * 8000 + 5 * 2000 + 2 * 25000
  const warranty = Math.ceil(10 * 2 / 100) * (8000 + 2000)
  const install = 3 * 2000 + 7 * 20000 + 5 * 500 + 2 * 5000
  const hostingMonth = 10 * 200 + 5 * 100 + 2 * 500
  const months = 12

  assert.equal(d.hardware.hardwareCost, hardwareExWarranty)
  assert.equal(d.hardware.warrantyCost, warranty)
  assert.equal(d.groups.hardwareGroup.rawTotalCost, hardwareExWarranty + warranty)
  assert.equal(d.groups.installGroup.rawTotalCost, install)
  assert.equal(d.groups.hostingGroup.rawTotalCost, hostingMonth)
  assert.equal(d.totals.totalDealCost,
    hardwareExWarranty + warranty + install + hostingMonth * months)
})

test('C. FULL DEAL: the margin uplifts everything except the warranty', () => {
  const d = deal()
  const m = 30
  const priced = (cost) => priceFromCost(cost, m)
  const row = (g, k) => d.groups[g].rows.find((r) => r.key === k)
  assert.equal(row('hardwareGroup', 'hwSs').rawPrice, priced(10 * 8000))
  assert.equal(row('hardwareGroup', 'hwHemir').rawPrice, priced(2 * 25000))
  assert.equal(row('installGroup', 'inSsNew').rawPrice, priced(7 * 20000))
  assert.equal(row('hostingGroup', 'hoSs').rawPrice, priced(10 * 200))
  assert.equal(row('hardwareGroup', 'hwWarranty').rawPrice, Math.ceil(10 * 2 / 100) * (8000 + 2000),
    'the warranty alone is unmarked up')
})

test('C. FULL DEAL: achieved margin sits BELOW target because the warranty is unmarked', () => {
  const d = deal()
  assert.ok(d.achievedMargin < 30, 'a cost carried at cost must dilute the achieved margin')
  assert.ok(d.achievedMargin > 29, 'and only by the warranty, not by something larger')
})

// ── D. TERM, HEMIR, AND THE CLAMP ───────────────────────────────────────

test('D. TERM IS MONTHS, used directly, with no twelve-times and no floor', () => {
  const one = deal({ duration: 1 })
  const twelve = deal({ duration: 12 })
  const hostingMonth = 10 * 200 + 5 * 100 + 2 * 500
  assert.equal(one.totals.totalDealCost - deal({ duration: 0 }).totals.totalDealCost, hostingMonth,
    'a duration of 1 buys ONE month of hosting, not twelve')
  assert.equal(twelve.totals.totalDealCost - one.totals.totalDealCost, hostingMonth * 11)
})

test('D. HEMIR is a real third hardware type, priced like the others', () => {
  const d = deal()
  assert.equal(d.groups.hardwareGroup.rows.find((r) => r.key === 'hwHemir').rawCost, 2 * 25000)
  assert.equal(d.groups.installGroup.rows.find((r) => r.key === 'inHemir').rawCost, 2 * 5000)
  assert.equal(d.groups.hostingGroup.rows.find((r) => r.key === 'hoHemir').rawCost, 2 * 500)
})

test('D. THE TOOL CANNOT PRICE BELOW COST, whatever margin it is handed', () => {
  for (const m of [-50, -1, 0]) {
    assert.ok(priceFromCost(1000, m) >= 1000, `a margin of ${m} priced below cost`)
  }
  assert.equal(priceFromCost(1000, -50), 1000, 'a negative margin clamps to zero, it does not discount')
  assert.equal(priceFromCost(1000, 30), Math.round(1000 / 0.7), 'and a real margin still uplifts')
})
