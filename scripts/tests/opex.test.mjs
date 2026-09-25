// ── R-OX3: THE ALL-IN MONTHLY FEE, PER UNIT, OVER THE TERM ──────────────
//
// The OPEX table's fee is hardware, warranty share, installation AND hosting,
// amortised over the contract term and expressed per unit per month.
//
// IT IS A CALLER OF THE DERIVATION, NOT A SECOND PRICING PATH. Every figure
// below comes out of `calculateDeal`'s groups; this module reshapes them per
// product type and divides. A second computation of a price would be the fault
// the estate has recorded most often.
//
// PHASE 0 MEASURED THE TWO ALLOCATIONS RATHER THAN ASSUMING THEM:
//   - the warranty is SafeSight's ALONE. `warrantyBasisUnits` reads 32 on a
//     20 + 12 SafeSight deal and does not move when AQ goes to 400 or HEMIR to
//     300, so it is not spread across types.
//   - SafeSight spans TWO installation rows, existing and new infra.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildDealInputs } from '../../src/lib/deal-inputs.js'
import { resolveRates } from '../../src/lib/rate-resolution.js'
import { calculateDeal } from '../../src/lib/deal-calculator.js'
import { opexRows, OPEX_FEE_KEYS } from '../../src/lib/opex.js'

const RATES = {
  ssUnitCost: 8000, aqUnitCost: 2000, hemirUnitCost: 100000,
  hoSafesight: 200, hoAqm: 100, hoHemir: 500,
  inSsExisting: 2000, inSsNew: 20000, inAqm: 500, inHemir: 5000,
}
const P = {
  ssExisting: 20, ssNew: 12, aqm: 4, hemir: 3, duration: 60,
  targetMargin: 30, warrantyPct: 2,
  installResp: 'Terminus Contractor - Per Unit',
}
const run = (p) => calculateDeal(buildDealInputs(p, { testBedCost: 0, rates: resolveRates(p, RATES).rates }))
const ratesFor = (p) => resolveRates(p, RATES).rates
const rows = (p = P) => opexRows(run(p), p, ratesFor(p))
const byKey = (p = P) => Object.fromEntries(rows(p).map((r) => [r.key, r]))

test('X1: one row per product type, in the order the sketch lists them', () => {
  assert.deepEqual(rows().map((r) => r.key), [...OPEX_FEE_KEYS])
  assert.deepEqual(rows().map((r) => r.label), ['SafeSight', 'AQ Sensor', 'HEMIR'])
})

test('X2: the units column is the deal\'s own counts, SafeSight being both infras', () => {
  const r = byKey()
  assert.equal(r.ss.units, 32)
  assert.equal(r.aq.units, 4)
  assert.equal(r.hemir.units, 3)
})

test('X3: the fee is ALL-IN, so it exceeds the hosting fee alone', () => {
  const result = run(P)
  const r = byKey()
  const hostingPerUnitPerMonth = result.groups.hostingGroup.rows.find((x) => x.key === 'hoSs').rawPrice / 32
  assert.ok(r.ss.monthlyFee > hostingPerUnitPerMonth * 1.5,
    `the fee ${r.ss.monthlyFee} is not carrying hardware and installation over the term`)
})

test('X4: contract total is fee x units x term, which is what the column says', () => {
  const r = byKey()
  for (const row of Object.values(r)) {
    assert.ok(Math.abs(row.contractTotal - row.monthlyFee * row.units * 60) < 0.01,
      `${row.key}: ${row.contractTotal} is not ${row.monthlyFee} x ${row.units} x 60`)
  }
})

test('X5: the contract totals RECONCILE with the deal\'s own revenue', () => {
  // The whole point of being a caller. Everything the deal charges is in one of
  // the three rows, so the rows must add to the deal's contract net. A table
  // that cannot fail to add up is not a reconciliation, so this is asserted
  // against the calculator rather than against itself.
  const result = run(P)
  const total = rows().reduce((a, x) => a + x.contractTotal, 0)
  assert.ok(Math.abs(total - result.totals.contractNet) < 1,
    `rows total ${total} against contract net ${result.totals.contractNet}`)
})

test('X6: the warranty rides with SafeSight and nowhere else', () => {
  // Measured in Phase 0, asserted here: changing the warranty percentage moves
  // the SafeSight fee and leaves the other two exactly where they were.
  const a = byKey()
  const b = byKey({ ...P, warrantyPct: 20 })
  assert.ok(b.ss.monthlyFee > a.ss.monthlyFee, 'the warranty did not reach SafeSight')
  assert.equal(b.aq.monthlyFee, a.aq.monthlyFee, 'the warranty leaked into AQ Sensor')
  assert.equal(b.hemir.monthlyFee, a.hemir.monthlyFee, 'the warranty leaked into HEMIR')
})

test('X7: the margin is the BLENDED all-in line margin, not a component margin', () => {
  const r = byKey()
  // At a flat 30% target with no overrides every component prices at 30, so the
  // blend lands there too; the test that it is a BLEND is X8.
  for (const row of Object.values(r)) {
    assert.ok(Math.abs(row.marginPct - 30) < 0.6, `${row.key} blended margin ${row.marginPct}`)
  }
})

test('X8: and a component margin override moves the blend, which proves it is one', () => {
  const a = byKey()
  // The warranty carries NO margin by rule, so raising the warranty share pulls
  // the SafeSight blend DOWN below the 30% every component is priced at. A
  // per-component margin could not do that.
  const b = byKey({ ...P, warrantyPct: 20 })
  assert.ok(b.ss.marginPct < a.ss.marginPct - 0.5,
    `the blend did not move: ${a.ss.marginPct} to ${b.ss.marginPct}`)
})

test('X9: a type with no units has no row figures rather than a divide by zero', () => {
  const r = byKey({ ...P, hemir: 0 })
  assert.equal(r.hemir.units, 0)
  assert.equal(r.hemir.monthlyFee, null)
  assert.equal(r.hemir.contractTotal, 0)
  assert.equal(r.hemir.marginPct, null)
})

test('X10: with no term recorded the fee cannot be stated, and says so', () => {
  // Architecture 11: a cleared field is a state the screen must be able to SAY.
  // A missing duration is not a term of zero and must not divide.
  const p = { ...P }; delete p.duration
  const r = Object.fromEntries(opexRows(run(p), p, ratesFor(p)).map((x) => [x.key, x]))
  assert.equal(r.ss.monthlyFee, null)
  assert.equal(r.ss.contractTotal, null)
})

test('X11: LUMP SUM installation is allocated by the catalog\'s own per-unit rates', () => {
  // The one gap Phase 0 found in the design of record. A flat per-unit split
  // would overcharge an AQ Sensor install at 500 against a HEMIR at 5,000, so
  // the lump sum is distributed in the proportions the per-unit rates would
  // have produced. Position taken and reported, not buried.
  const L = { ...P, installResp: 'Terminus Contractor - Lump Sum', lumpSumCost: 297000 }
  const r = Object.fromEntries(opexRows(run(L), L, ratesFor(L)).map((x) => [x.key, x]))
  const perUnit = byKey()
  // The lump sum equals the per-unit total for this fixture, so the two must
  // agree to the penny: the allocation is a redistribution, not a reprice.
  for (const k of OPEX_FEE_KEYS) {
    assert.ok(Math.abs(r[k].contractTotal - perUnit[k].contractTotal) < 1,
      `${k}: lump ${r[k].contractTotal} against per-unit ${perUnit[k].contractTotal}`)
  }
})

test('X12: and the lump-sum rows still reconcile with the deal', () => {
  const L = { ...P, installResp: 'Terminus Contractor - Lump Sum', lumpSumCost: 200000 }
  const result = run(L)
  const total = opexRows(result, L, ratesFor(L)).reduce((a, x) => a + x.contractTotal, 0)
  assert.ok(Math.abs(total - result.totals.contractNet) < 1,
    `rows total ${total} against contract net ${result.totals.contractNet}`)
})

// ── R-OX4: ONE STORE, TWO VIEWS ─────────────────────────────────────────
//
// A stored monthly fee is not a label on a table: it is what the customer pays,
// so it has to reprice the deal. If it did not, the OPEX table's Contract Total
// would not add up to the deal's own contract net and the screen would be
// lying about the thing it exists to state - the class of defect the last three
// rounds were spent removing.
//
// A SCOPE DISCOVERY, REPORTED RATHER THAN ABSORBED. R-OX4 says "either-or per
// R-O7", and R-O7's either-or is ONE-TO-ONE: a hosting fee IS the hosting
// line's price. An all-in fee is ONE-TO-MANY - hardware, warranty, installation
// and hosting - so honouring it needs an INVERSE ALLOCATION back across those
// lines, which nothing in the estate did before this round. The mechanism is
// the calculator's own `priceFromCost`, so no second pricing rule is created.
const OPEX = { ...P, paymentMode: 'opex' }

test('X13: with no override, OPEX mode prices exactly as CAPEX does', () => {
  // The additive guarantee. Turning the switch on must not move a figure until
  // somebody edits something.
  const a = run(P)
  const b = run(OPEX)
  assert.equal(Math.round(b.totals.contractNet), Math.round(a.totals.contractNet))
})

test('X14: a stored monthly fee REPRICES the deal, not just the table', () => {
  const base = Object.fromEntries(opexRows(run(OPEX), OPEX, ratesFor(OPEX)).map((r) => [r.key, r]))
  const raised = { ...OPEX, opexUnitFees: { ss: base.ss.monthlyFee * 2 } }
  const r = run(raised)
  const rows2 = Object.fromEntries(opexRows(r, raised, ratesFor(raised)).map((x) => [x.key, x]))
  // THE TOLERANCE IS THE CALCULATOR'S OWN ROUNDING, not a number read off the
  // result. `buildCostGroup` rounds every line price to whole dollars, and the
  // hosting line is rounded once and then multiplied by the term - so up to one
  // dollar a month can be lost, which is 1/units on a per-unit fee.
  const tol = 1 / rows2.ss.units
  assert.ok(Math.abs(rows2.ss.monthlyFee - base.ss.monthlyFee * 2) < tol,
    `the table shows ${rows2.ss.monthlyFee}, not the stored ${base.ss.monthlyFee * 2}`)
  assert.ok(r.totals.contractNet > run(OPEX).totals.contractNet,
    'the deal did not reprice, so the table and the sheet are two stores')
})

test('X15: and the OTHER types are untouched by it', () => {
  const base = Object.fromEntries(opexRows(run(OPEX), OPEX, ratesFor(OPEX)).map((r) => [r.key, r]))
  const raised = { ...OPEX, opexUnitFees: { ss: base.ss.monthlyFee * 2 } }
  const rows2 = Object.fromEntries(opexRows(run(raised), raised, ratesFor(raised)).map((x) => [x.key, x]))
  assert.equal(rows2.aq.monthlyFee, base.aq.monthlyFee)
  assert.equal(rows2.hemir.monthlyFee, base.hemir.monthlyFee)
})

test('X16: the rows still reconcile with the deal AFTER an override', () => {
  const base = Object.fromEntries(opexRows(run(OPEX), OPEX, ratesFor(OPEX)).map((r) => [r.key, r]))
  const raised = { ...OPEX, opexUnitFees: { ss: base.ss.monthlyFee * 2 } }
  const result = run(raised)
  const total = opexRows(result, raised, ratesFor(raised)).reduce((a, x) => a + x.contractTotal, 0)
  assert.ok(Math.abs(total - result.totals.contractNet) < 1,
    `rows total ${total} against contract net ${result.totals.contractNet}`)
})

test('X17: a stored MARGIN reprices to that blended margin', () => {
  const m = { ...OPEX, opexUnitMargins: { hemir: 50 } }
  const rows2 = Object.fromEntries(opexRows(run(m), m, ratesFor(m)).map((x) => [x.key, x]))
  assert.ok(Math.abs(rows2.hemir.marginPct - 50) < 0.01,
    `the blended margin is ${rows2.hemir.marginPct}, not the stored 50`)
})

test('X18: the fee WINS over a margin on the same row, and says which is stored', () => {
  // The either-or needs a rule when both keys carry a value for one row, which
  // a save can produce. The absolute is the more specific statement.
  const base = Object.fromEntries(opexRows(run(OPEX), OPEX, ratesFor(OPEX)).map((r) => [r.key, r]))
  const both = { ...OPEX, opexUnitFees: { ss: base.ss.monthlyFee * 2 }, opexUnitMargins: { ss: 50 } }
  const rows2 = Object.fromEntries(opexRows(run(both), both, ratesFor(both)).map((x) => [x.key, x]))
  assert.ok(Math.abs(rows2.ss.monthlyFee - base.ss.monthlyFee * 2) < 1 / rows2.ss.units,
    `the margin won: ${rows2.ss.monthlyFee} against the stored fee ${base.ss.monthlyFee * 2}`)
})

test('X19: CAPEX ignores the OPEX keys entirely, so switching back restores the deal', () => {
  const base = Object.fromEntries(opexRows(run(OPEX), OPEX, ratesFor(OPEX)).map((r) => [r.key, r]))
  const withFee = { ...P, paymentMode: 'capex', opexUnitFees: { ss: base.ss.monthlyFee * 2 } }
  assert.equal(Math.round(run(withFee).totals.contractNet), Math.round(run(P).totals.contractNet))
})
