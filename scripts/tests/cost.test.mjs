// Round 7 Phase 1, section 1.1 - cost calculation.
//
// PURE ONLY. No database, no credentials, no network, no fixtures.
// This file is what `npm test` runs, and it must stay runnable on a
// clean checkout with zero environment setup - that property is what
// lets the GitHub Action run it on every push without CI secrets.
// Do not import anything that reaches a database into this file.
//
// Every expected figure below is stated literally, hand-computed from
// the documented arithmetic. None is produced by calling the function
// under test, which would assert only that the code equals itself.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildLoanSchedule,
  priceFromCost,
  buildCostGroup,
  calculateContractTotals,
  calculateTax,
  calculateHardwareAndWarranty,
  calculateTestBedCost,
  calculateDeal,
} from '../../src/lib/deal-calculator.js'

const near = (actual, expected, tol = 1e-9) =>
  assert.ok(Math.abs(actual - expected) < tol, `expected ${expected}, got ${actual}`)

// ---------------------------------------------------------------- 1.1a
test('buildLoanSchedule: straight method, non-zero rate', () => {
  // 1200 over 12 months at 1%/month. Principal portion is flat at 100.
  // Interest accrues on the *opening* balance each month: 1200, 1100, ...
  const s = buildLoanSchedule(1200, 0.01, 12, 'straight')
  assert.equal(s.length, 12)
  near(s[0].principal, 100)
  near(s[0].interest, 12)   // 1200 * 0.01
  near(s[1].interest, 11)   // 1100 * 0.01
  near(s[11].interest, 1)   // 100  * 0.01
  near(s.reduce((t, r) => t + r.principal, 0), 1200)
})

test('buildLoanSchedule: zero interest rate charges no interest', () => {
  // The zero-rate branch is a real path: declining divides by
  // (1 - (1+r)^-n), which is 0/0 at r = 0, so it must not be taken.
  for (const method of ['straight', 'declining']) {
    const s = buildLoanSchedule(1200, 0, 12, method)
    assert.equal(s.length, 12, method)
    near(s.reduce((t, r) => t + r.interest, 0), 0)
    near(s.reduce((t, r) => t + r.principal, 0), 1200)
  }
})

test('buildLoanSchedule: single-month term', () => {
  const straight = buildLoanSchedule(500, 0.02, 1, 'straight')
  assert.equal(straight.length, 1)
  near(straight[0].principal, 500)
  near(straight[0].interest, 10) // 500 * 0.02

  // Declining forces the final month's principal to the whole balance,
  // so a one-month term must fully amortise.
  const declining = buildLoanSchedule(500, 0.02, 1, 'declining')
  assert.equal(declining.length, 1)
  near(declining[0].principal, 500)
  near(declining[0].interest, 10)
})

test('buildLoanSchedule: declining amortises exactly to zero', () => {
  const s = buildLoanSchedule(1000, 0.01, 24, 'declining')
  near(s.reduce((t, r) => t + r.principal, 0), 1000, 1e-6)
  // Declining front-loads interest: month 1 must exceed the final month.
  assert.ok(s[0].interest > s[23].interest)
})

// ---------------------------------------------------------------- 1.1b
test('priceFromCost: 0% margin returns cost unchanged', () => {
  assert.equal(priceFromCost(1000, 0), 1000)
})

test('priceFromCost: margin is clamped at 99, the small-divisor edge', () => {
  // 1000 / (1 - 0.99) = 100000. Without the clamp, 100% would divide
  // by zero and yield Infinity.
  assert.equal(priceFromCost(1000, 99), 100000)
  assert.equal(priceFromCost(1000, 100), 100000)
  assert.equal(priceFromCost(1000, 150), 100000)
  assert.ok(Number.isFinite(priceFromCost(1000, 100)))
})

test('priceFromCost: missing margin is treated as zero, not NaN', () => {
  assert.equal(priceFromCost(1000, undefined), 1000)
  assert.equal(priceFromCost(1000, null), 1000)
})

// ---------------------------------------------------------------- 1.1c
test('buildCostGroup: empty group totals zero, not NaN', () => {
  const g = buildCostGroup([])
  assert.deepEqual(g.rows, [])
  assert.equal(g.rawTotalCost, 0)
  assert.equal(g.rawTotalPrice, 0)
  assert.ok(!Number.isNaN(g.rawTotalCost))
  assert.ok(!Number.isNaN(g.rawTotalPrice))
})

test('calculateContractTotals: all-empty groups produce zero, not NaN', () => {
  const empty = { rawTotalCost: 0, rawTotalPrice: 0 }
  const t = calculateContractTotals({
    hardwareGroup: empty, installGroup: empty, hostingGroup: empty, months: 0,
  })
  assert.equal(t.contractNet, 0)
  assert.equal(t.totalDealCost, 0)
  // Guarded against divide-by-zero on contractNet.
  assert.equal(t.achievedMarginPreFinance, 0)
  assert.ok(!Number.isNaN(t.achievedMarginPreFinance))
})

test('calculateContractTotals: hosting is per-month and multiplies by term', () => {
  const t = calculateContractTotals({
    hardwareGroup: { rawTotalCost: 17000, rawTotalPrice: 21000 },
    installGroup: { rawTotalCost: 4000, rawTotalPrice: 8000 },
    hostingGroup: { rawTotalCost: 500, rawTotalPrice: 1000 },
    months: 12,
  })
  assert.equal(t.oneOffPrice, 29000)      // 21000 + 8000
  assert.equal(t.hostingMonthPrice, 1000)
  assert.equal(t.hostingTermPrice, 12000) // 1000 * 12
  assert.equal(t.contractNet, 41000)      // 29000 + 12000
  assert.equal(t.totalDealCost, 27000)    // 17000 + 4000 + 500*12
  near(t.achievedMarginPreFinance, (14000 / 41000) * 100)
})

// ---------------------------------------------------------------- 1.1d
test('calculateTax: without grossUp, the contract net is the invoice base', () => {
  const r = calculateTax(100000, 10, 8, false)
  assert.equal(r.invoiceBase, 100000)
  assert.equal(r.whtAmount, 10000)
  assert.equal(r.gstAmount, 8000)
  assert.equal(r.whtBorne, 10000) // borne by us when not grossed up
})

test('calculateTax: grossUp reorders the arithmetic and shifts who bears WHT', () => {
  // invoiceBase = round(100000 / (1 - 0.10)) = round(111111.11) = 111111
  // wht  = round(111111 * 0.10) = round(11111.1)  = 11111
  // gst  = round(111111 * 0.08) = round(8888.88)  = 8889
  const r = calculateTax(100000, 10, 8, true)
  assert.equal(r.invoiceBase, 111111)
  assert.equal(r.whtAmount, 11111)
  assert.equal(r.gstAmount, 8889)
  assert.equal(r.whtBorne, 0) // grossed up, so the client bears it
})

test('calculateTax: grossUp at 100% WHT does not divide by zero', () => {
  const r = calculateTax(100000, 100, 0, true)
  assert.equal(r.invoiceBase, 100000) // guard: grossUp only applies below 100
  assert.ok(Number.isFinite(r.whtAmount))
})

// ---------------------------------------------------------------- 1.1e
test('calculateHardwareAndWarranty: warranty units round up', () => {
  // 10x1000 + 4x500 + 2x2000 = 16000 over 16 units, avg 1000/unit.
  // 5% of 16 units = 0.8 -> ceil -> 1 spare unit -> 1 * 1000 = 1000.
  const hw = calculateHardwareAndWarranty({
    ssUnitCost: 1000, ssUnits: 10,
    aqUnitCost: 500, aqUnits: 4,
    hemirUnitCost: 2000, hemirUnits: 2,
    warrantyPct: 5,
  })
  assert.equal(hw.totalUnits, 16)
  assert.equal(hw.hardwareCost, 16000)
  assert.equal(hw.warrantyUnits, 1)
  assert.equal(hw.avgHwCost, 1000)
  assert.equal(hw.warrantyCost, 1000)
})

test('calculateHardwareAndWarranty: zero units does not divide by zero', () => {
  const hw = calculateHardwareAndWarranty({
    ssUnitCost: 1000, ssUnits: 0, aqUnitCost: 0, aqUnits: 0,
    hemirUnitCost: 0, hemirUnits: 0, warrantyPct: 5,
  })
  assert.equal(hw.totalUnits, 0)
  assert.equal(hw.avgHwCost, 0)
  assert.equal(hw.warrantyCost, 0)
  assert.ok(!Number.isNaN(hw.avgHwCost))
})

test('calculateHardwareAndWarranty: an explicit 0 suppresses the default of 2', () => {
  // Round 7 Phase 8 depends on this exactly: the parameter default only
  // applies when the key is absent, so passing 0 genuinely zeroes the
  // warranty rather than falling back to 2%.
  const base = {
    ssUnitCost: 1000, ssUnits: 10, aqUnitCost: 500, aqUnits: 4,
    hemirUnitCost: 2000, hemirUnits: 2,
  }
  assert.equal(calculateHardwareAndWarranty({ ...base, warrantyPct: 0 }).warrantyCost, 0)
  // Omitted entirely -> default 2% -> ceil(16 * 0.02) = 1 unit -> 1000.
  assert.equal(calculateHardwareAndWarranty(base).warrantyCost, 1000)
})

// ---------------------------------------------------------------- 1.1f
test('calculateTestBedCost: fully worked example, cost only', () => {
  // Hardware  10x1000 + 4x500 + 2x2000            = 16000
  // Warranty  5% of 16 units = ceil(0.8) = 1 @ 1000 = 1000
  // Hardware group total                          = 17000
  // Install   3000 + 1000                         =  4000
  // Hosting   (200 + 100) per month x 6 months    =  1800
  // Total                                         = 22800
  const r = calculateTestBedCost({
    ssUnitCost: 1000, ssUnits: 10,
    aqUnitCost: 500, aqUnits: 4,
    hemirUnitCost: 2000, hemirUnits: 2,
    warrantyPct: 5,
    installLineItems: [{ key: 'inSs', cost: 3000 }, { key: 'inAq', cost: 1000 }],
    hostingLineItems: [{ key: 'hoSs', cost: 200 }, { key: 'hoAq', cost: 100 }],
    months: 6,
  })
  assert.equal(r.hardware.warrantyCost, 1000)
  assert.equal(r.groups.hardwareGroup.rawTotalCost, 17000)
  assert.equal(r.groups.installGroup.rawTotalCost, 4000)
  assert.equal(r.hostingMonthCost, 300)
  assert.equal(r.hostingTermCost, 1800)
  assert.equal(r.months, 6)
  assert.equal(r.totalCost, 22800)
})

test('calculateTestBedCost: warrantyPct 0 removes the warranty line entirely', () => {
  // The figure Round 7 Phase 8 is aiming at: 22800 - 1000 = 21800.
  const r = calculateTestBedCost({
    ssUnitCost: 1000, ssUnits: 10,
    aqUnitCost: 500, aqUnits: 4,
    hemirUnitCost: 2000, hemirUnits: 2,
    warrantyPct: 0,
    installLineItems: [{ key: 'inSs', cost: 3000 }, { key: 'inAq', cost: 1000 }],
    hostingLineItems: [{ key: 'hoSs', cost: 200 }, { key: 'hoAq', cost: 100 }],
    months: 6,
  })
  assert.equal(r.hardware.warrantyCost, 0)
  assert.equal(r.totalCost, 21800)
})

test('calculateTestBedCost: missing line items and zero months do not produce NaN', () => {
  const r = calculateTestBedCost({
    ssUnitCost: 0, ssUnits: 0, aqUnitCost: 0, aqUnits: 0,
    hemirUnitCost: 0, hemirUnits: 0, warrantyPct: 0,
    installLineItems: undefined, hostingLineItems: undefined, months: undefined,
  })
  assert.equal(r.totalCost, 0)
  assert.equal(r.months, 0)
  assert.ok(!Number.isNaN(r.totalCost))
})

// ---------------------------------------------------------------- 1.1g
// One fully worked end-to-end deal. Figures below are hand-derived:
//
//   Hardware cost   10x1000=10000, 4x500=2000, 2x2000=4000  -> 16000
//   Warranty        5% of 16 units = ceil(0.8) = 1 @ 1000    ->  1000
//   Hardware prices at 20% margin: round(10000/0.8)=12500,
//                                  round(2000/0.8) = 2500,
//                                  round(4000/0.8) = 5000,
//                   warranty at 0% margin           = 1000   -> 21000
//   Install         cost 4000, 50% margin -> price   8000
//   Hosting         cost  500/mo, 50% margin -> price 1000/mo
//   oneOffPrice     21000 + 8000                            = 29000
//   hostingTerm     1000 x 12                                = 12000
//   contractNet     29000 + 12000                            = 41000
//   totalDealCost   17000 + 4000 + (500 x 12)                = 27000
const DEAL = {
  ssUnitCost: 1000, ssUnits: 10,
  aqUnitCost: 500, aqUnits: 4,
  hemirUnitCost: 2000, hemirUnits: 2,
  warrantyPct: 5,
  hardwareMargins: { hwSs: 20, hwAqm: 20, hwHemir: 20, hwWarranty: 0 },
  installLineItems: [{ key: 'inSs', cost: 4000, marginPct: 50 }],
  hostingLineItems: [{ key: 'hoSs', cost: 500, marginPct: 50 }],
  months: 12,
  structure: 'single',
  annualInvoicing: true,
  lumpSumDeal: false,
  factoringEnabled: false,
  whtPct: 0, gstPct: 0, grossUp: false,
}

test('calculateDeal: fully worked example end to end', () => {
  const d = calculateDeal({ ...DEAL })
  assert.equal(d.hardware.warrantyCost, 1000)
  assert.equal(d.groups.hardwareGroup.rawTotalCost, 17000)
  assert.equal(d.groups.hardwareGroup.rawTotalPrice, 21000)
  assert.equal(d.totals.oneOffPrice, 29000)
  assert.equal(d.totals.hostingTermPrice, 12000)
  assert.equal(d.totals.contractNet, 41000)
  assert.equal(d.totals.totalDealCost, 27000)
  assert.equal(d.financeCost, 0) // factoring disabled
  assert.equal(d.totalDealCostAll, 27000)
  near(d.achievedMargin, (14000 / 41000) * 100)
})

test('calculateDeal: a carried Test Bed cost cuts margin without touching contractNet', () => {
  // Milestone 5 behaviour: sunk R&D, added to cost, never a priced line.
  const d = calculateDeal({ ...DEAL, testBedCost: 2500 })
  assert.equal(d.totals.contractNet, 41000, 'contractNet must be unchanged')
  assert.equal(d.testBedCost, 2500)
  assert.equal(d.totalDealCostAll, 29500) // 27000 + 2500
  near(d.achievedMargin, (11500 / 41000) * 100)
})

test('calculateDeal: a zero-value deal does not produce NaN margin', () => {
  const d = calculateDeal({
    ssUnitCost: 0, ssUnits: 0, aqUnitCost: 0, aqUnits: 0,
    hemirUnitCost: 0, hemirUnits: 0, warrantyPct: 0,
    hardwareMargins: {}, installLineItems: [], hostingLineItems: [],
    months: 0, structure: 'single', annualInvoicing: true,
    lumpSumDeal: false, factoringEnabled: false,
  })
  assert.equal(d.totals.contractNet, 0)
  assert.equal(d.achievedMargin, 0)
  assert.ok(!Number.isNaN(d.achievedMargin))
})
