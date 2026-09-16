// ── THE TEST BED COST CONTRACT ───────────────────────────────────────────
//
// Enforces COST_CALCULATIONS.md section 1, which is the standing statement of
// how a Test Bed's cost is computed, verified against the deal sheet at
// `old - terminus-deal-sheet.html` computeModel() lines 530-556.
//
// WHY THIS EXISTS. An audit on 2026-09-16 found that no document in the estate
// stated any cost formula, and the only executable statement of the Test Bed
// arithmetic was a worked example buried in cost.test.mjs. A formula that lives
// only in code is re-derived by the next person to touch it, and re-derived
// wrong is exactly the failure this file is here to make impossible.
//
// IT TESTS THE ROUTE'S MAPPING, NOT THE ENGINE ALONE. The per-unit
// multiplication and the warranty zeroing both live in
// buildTestBedCostBreakdown, not in calculateTestBedCost, so a test that
// imports only the engine cannot see the two rules most likely to be broken by
// a well-meaning edit.
//
// THE ENV PLACEHOLDERS. src/routes/test-beds.js imports src/supabase.js, which
// constructs a client at module load and throws on a missing URL. Nothing here
// makes a network call; the placeholders exist so this contract can live in the
// FAST pure suite rather than behind the database suite's network dependency.
import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.SUPABASE_URL ??= 'http://placeholder.invalid'
process.env.SUPABASE_PUBLISHABLE_KEY ??= 'placeholder'
process.env.SUPABASE_SECRET_KEY ??= 'placeholder'

const { buildTestBedCostBreakdown } = await import('../../src/routes/test-beds.js')

/** John's acceptance case, COST_CALCULATIONS.md section 1. */
const ACCEPTANCE = {
  safesightCameras: 2, airQualitySensors: 0, hemirSensors: 0,
  ssUnitCost: 8000, aqUnitCost: 0, hemirUnitCost: 0,
  ssInstallCost: 2000, aqInstallCost: 0, hemirInstallCost: 0,
  ssHostingCost: 200, aqHostingCost: 0, hemirHostingCost: 0,
  testBedDuration: 6,
}

// Expressed, never restated. CLAUDE.md Verification 20: a hand-typed number is
// a second reader of the calculation, and this estate has been caught by one.
const UNITS = 2, UNIT_COST = 8000, INSTALL_RATE = 2000, HOSTING_RATE = 200, MONTHS = 6

test('ACCEPTANCE CASE: 2 SafeSight at $8,000, $2,000 install, $200/mo, 6 months', () => {
  const r = buildTestBedCostBreakdown(ACCEPTANCE)
  assert.equal(r.groups.hardwareGroup.rawTotalCost, UNITS * UNIT_COST, 'Hardware must be $16,000')
  assert.equal(r.groups.installGroup.rawTotalCost, UNITS * INSTALL_RATE, 'Install must be $4,000')
  assert.equal(r.hostingTermCost, UNITS * HOSTING_RATE * MONTHS, 'Hosting over the term must be $2,400')
  assert.equal(r.totalCost, UNITS * UNIT_COST + UNITS * INSTALL_RATE + UNITS * HOSTING_RATE * MONTHS,
    'Total must be $22,400')
})

test('the total is exactly the three groups and nothing else', () => {
  const r = buildTestBedCostBreakdown(ACCEPTANCE)
  assert.equal(r.totalCost,
    r.groups.hardwareGroup.rawTotalCost + r.groups.installGroup.rawTotalCost + r.hostingTermCost)
})

test('a number typed as a STRING computes the same, which is what the DOM saves', () => {
  const asStrings = Object.fromEntries(Object.entries(ACCEPTANCE).map(([k, v]) => [k, String(v)]))
  assert.equal(buildTestBedCostBreakdown(asStrings).totalCost, buildTestBedCostBreakdown(ACCEPTANCE).totalCost)
})

// ── THE STRUCTURAL RULES, each able to fail on its own ───────────────────

test('INSTALL IS PER UNIT: doubling the units doubles the installation cost', () => {
  const one = buildTestBedCostBreakdown({ ...ACCEPTANCE, safesightCameras: 1 })
  const two = buildTestBedCostBreakdown({ ...ACCEPTANCE, safesightCameras: 2 })
  assert.equal(one.groups.installGroup.rawTotalCost, INSTALL_RATE)
  assert.equal(two.groups.installGroup.rawTotalCost, 2 * INSTALL_RATE)
})

test('HOSTING IS PER UNIT PER MONTH: it scales with both units and duration', () => {
  const base = buildTestBedCostBreakdown(ACCEPTANCE)
  const twiceLong = buildTestBedCostBreakdown({ ...ACCEPTANCE, testBedDuration: MONTHS * 2 })
  const twiceWide = buildTestBedCostBreakdown({ ...ACCEPTANCE, safesightCameras: UNITS * 2 })
  assert.equal(base.hostingMonthCost, UNITS * HOSTING_RATE, 'the monthly figure is units x rate')
  assert.equal(twiceLong.hostingTermCost, 2 * base.hostingTermCost, 'doubling the duration doubles the term cost')
  assert.equal(twiceWide.hostingMonthCost, 2 * base.hostingMonthCost, 'doubling the units doubles the monthly cost')
})

test('ALL THREE PRODUCT TYPES contribute, on the same per-unit rule', () => {
  const r = buildTestBedCostBreakdown({
    safesightCameras: 2, airQualitySensors: 3, hemirSensors: 4,
    ssUnitCost: 100, aqUnitCost: 10, hemirUnitCost: 1,
    ssInstallCost: 1000, aqInstallCost: 100, hemirInstallCost: 10,
    ssHostingCost: 7, aqHostingCost: 5, hemirHostingCost: 3,
    testBedDuration: 1,
  })
  assert.equal(r.groups.hardwareGroup.rawTotalCost, 2 * 100 + 3 * 10 + 4 * 1)
  assert.equal(r.groups.installGroup.rawTotalCost, 2 * 1000 + 3 * 100 + 4 * 10)
  assert.equal(r.hostingMonthCost, 2 * 7 + 3 * 5 + 4 * 3)
})

// ── NO WARRANTY, and the discriminating case is a NON-ZERO one ───────────
//
// A test against the real data, where warrantyPct is absent, would be true by
// absence: it passes on a mapping that still reads the key. CLAUDE.md
// Verification 14. So the payload carries a warranty the route must ignore.

test('NO WARRANTY: a payload carrying warrantyPct is ignored, not honoured', () => {
  const withWarranty = buildTestBedCostBreakdown({ ...ACCEPTANCE, warrantyPct: 10 })
  assert.equal(withWarranty.hardware.warrantyCost, 0, 'a Test Bed carries no warranty provision')
  assert.equal(withWarranty.totalCost, buildTestBedCostBreakdown(ACCEPTANCE).totalCost,
    'the total must not move when a stray warrantyPct is present')
})

test('NO WARRANTY: the warranty line is present in the group and always zero', () => {
  const rows = buildTestBedCostBreakdown({ ...ACCEPTANCE, warrantyPct: 50 }).groups.hardwareGroup.rows
  const warranty = rows.find((r) => r.key === 'hwWarranty')
  assert.ok(warranty, 'the shared engine still emits the line, which is how it stays one engine')
  assert.equal(warranty.rawCost, 0)
})

// ── DURATION ─────────────────────────────────────────────────────────────
//
// John's ruling, 2026-09-16: a duration of zero means a cost of zero. That is
// correct behaviour and the remedy is to enter a duration. Pinned as INTENDED
// so a later round does not "fix" it into a default.

test('a duration of zero means zero hosting, which is intended and not a defect', () => {
  const r = buildTestBedCostBreakdown({ ...ACCEPTANCE, testBedDuration: '' })
  assert.equal(r.months, 0)
  assert.equal(r.hostingTermCost, 0)
  assert.equal(r.totalCost, UNITS * UNIT_COST + UNITS * INSTALL_RATE,
    'hardware and install still stand; only the hosting term falls away')
})

test('an empty Test Bed produces zero, never NaN', () => {
  const r = buildTestBedCostBreakdown({})
  assert.equal(r.totalCost, 0)
  assert.equal(Number.isNaN(r.totalCost), false)
})
