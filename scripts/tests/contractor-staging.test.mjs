// ── THE FIRST TEST IN THE ESTATE TO EXECUTE THE STAGED CONTRACTOR BRANCH ──
//
// Measured at the golden deals round's Phase 0, and it is why this file exists:
// `buildCashFlowModel` appeared in NO test file in the repository. The only
// test touching `contractorStaged: true` (`deal-surfaces.test.ts:92`) hands the
// renderer a cash flow object built BY HAND, so it exercises the LABEL and
// never the model. `deal-inputs-golden.json` carries `contractorMilestones: []`
// on all fifteen shapes. The branch had never run.
//
// ── WHAT IT CAUGHT, AND WHY A COMPONENT TEST COULD NOT ───────────────────
//
// The cash flow filtered and summed contractor milestones on a `usd` field.
// R-N1 (John, 2026-09-21) stopped anything writing one, and
// `PATCH /opportunities/:id` now answers 400 if one arrives, so
// `contractorStaged` was false on every deal the system can save and the whole
// principal left in month 1 however the schedule read. Meanwhile
// `deal-sheet-versions.js` REFUSED to issue a version whose schedule did not
// sum to the lump sum. The gate enforced a schedule the engine ignored.
//
// Verification 47's clause: test the thing that HOLDS the value, not the screen
// that displays it. The defect is entirely inside the model, and every surface
// above it was rendering the model's own honest answer.
//
// ── THE FIXTURE IS THE SHAPE THE ROUTE ACCEPTS, DELIBERATELY ─────────────
//
// `pct` only. No `usd`, because that is what `readContractorMilestones` writes
// (payload.ts:266) and the only shape a save can produce. Giving a row a `usd`
// to make the arithmetic come out would be a fixture built to satisfy the
// broken join, which is the exact fault R-N1 was ruled about.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCashFlowModel } from '../../src/lib/deal-calculator.js';
import { milestoneUsd } from '../../src/lib/milestone-schedule.js';

/**
 * A lump sum deal whose contractor schedule totals 100% of the lump sum, in
 * the shape a save produces. Everything else is held still so the only thing
 * these tests can be measuring is the staging.
 */
const LUMP = 214000;
const SCHEDULE = [
  { month: 1, label: 'Contract start', pct: 40, incomplete: false },
  { month: 5, label: 'Installation complete', pct: 35, incomplete: false },
  { month: 9, label: 'Go live', pct: 25, incomplete: false },
];

const model = (over = {}) => buildCashFlowModel({
  months: 24,
  structure: 'twoPhase',
  recoveryMonths: 12,
  annualInvoicing: false,
  milestones: [],
  hardwarePriceAll: 1184714,
  hardwareCostAll: 835000,
  hostingMonthPrice: 9800,
  hostingMonthCost: 7000,
  lumpSumDeal: true,
  lumpCost: LUMP,
  contractorMilestones: SCHEDULE,
  factoringEnabled: false,
  ...over,
});

const contractorOutIn = (cf, m) => cf.rows[m - 1].contractorOut;
const totalContractorOut = (cf) => cf.rows.reduce((s, r) => s + r.contractorOut, 0);

test('the contractor schedule STAGES, from pct, with no stored dollar field', () => {
  const cf = model();
  assert.equal(cf.contractorStaged, true,
    'a schedule in the shape the route accepts must stage; false here is the Phase 0 defect');
  assert.equal(totalContractorOut(cf), LUMP,
    'the staged payments must sum to the lump sum they are a schedule of');
});

test('each milestone lands in ITS OWN month, at its own derived amount', () => {
  const cf = model();
  // Derived through the ONE function, not recomputed here. A hand-typed
  // expectation would be a second reader of the rule under test
  // (Verification 20).
  for (const row of SCHEDULE) {
    assert.equal(contractorOutIn(cf, row.month), milestoneUsd(row.pct, LUMP),
      `month ${row.month} must carry ${row.pct}% of the lump sum`);
  }
  // AND NOTHING IN THE MONTHS BETWEEN. Without this the schedule could pay
  // everything in month 1 and the three assertions above would still pass on
  // the first row.
  for (const m of [2, 3, 4, 6, 7, 8, 10, 11, 12]) {
    assert.equal(contractorOutIn(cf, m), 0, `month ${m} has no milestone and must pay nothing`);
  }
});

test('the month 1 outflow DROPS by what the schedule defers', () => {
  const staged = model();
  const unscheduled = model({ contractorMilestones: [] });
  // THE COUNTERFACTUAL, stated first: with no schedule the whole principal
  // leaves in month 1, which is the correct month-1 default for a lump sum
  // deal nobody has staged. The claim is that a schedule MOVES it.
  assert.equal(unscheduled.rows[0].hwOut, 835000,
    'with no schedule the whole principal leaves in month 1');
  assert.equal(unscheduled.contractorStaged, false,
    'no schedule is not a staged schedule');
  assert.equal(staged.rows[0].hwOut, 835000 - LUMP,
    'a staged schedule holds the lump sum back out of the month 1 outflow');
  assert.ok(staged.rows[0].cashOut < unscheduled.rows[0].cashOut,
    'staging must relieve month 1, or it is not staging');
});

test('STAGING MOVES CASH TIMING AND NOTHING ELSE. The pairwise property', () => {
  // The measurement that produced the Phase 0 finding, made permanent here as
  // well as on G2: the defect could never have moved a price, a cost or a
  // margin, and a fix that moved one would be a different change from the one
  // John ruled.
  const staged = model();
  const unscheduled = model({ contractorMilestones: [] });
  assert.equal(staged.totRev, unscheduled.totRev, 'revenue must not move');
  assert.equal(staged.totCost, unscheduled.totCost, 'total cost must not move');
  assert.equal(staged.marginAchieved, unscheduled.marginAchieved, 'margin must not move');
  assert.equal(staged.principal, unscheduled.principal, 'the principal must not move');
  // And the timing DOES move, so the four equalities above are not a
  // description of two identical runs (Verification 14).
  assert.notEqual(staged.rows[0].cum, unscheduled.rows[0].cum,
    'month 1 cumulative cash must differ, or these two models are the same model');
});

test('a row with no month is money committed and NOT a payment in month zero', () => {
  // W-C: a dateless payment counts toward the schedule's total and blocks a
  // version, and it must not become a cash movement. `month > 0` is what keeps
  // it out of the rows, and this is the test that would fail if the filter
  // were relaxed to `month >= 0`.
  const cf = model({
    contractorMilestones: [
      { month: 1, label: 'Contract start', pct: 60, incomplete: false },
      { month: 0, label: 'Date not yet known', pct: 40, incomplete: true },
    ],
  });
  assert.equal(totalContractorOut(cf), milestoneUsd(60, LUMP),
    'only the dated row moves cash');
  assert.equal(cf.contractorStaged, true, 'one dated row is still a staged schedule');
});

test('a zero-percent row is not a payment', () => {
  const cf = model({
    contractorMilestones: [
      { month: 1, label: 'Contract start', pct: 100, incomplete: false },
      { month: 6, label: 'Retention, waived', pct: 0, incomplete: false },
    ],
  });
  assert.equal(contractorOutIn(cf, 6), 0, 'a zero-percent milestone pays nothing');
  assert.equal(totalContractorOut(cf), LUMP, 'and the rest still sums to the lump sum');
});

test('a PER-UNIT installation deal has no contractor schedule at all', () => {
  // The schedule is a Lump Sum artefact. A payload left carrying rows after a
  // switch to per-unit must price nothing from them, which is what
  // `lumpSumDeal` guards.
  const cf = model({ lumpSumDeal: false });
  assert.equal(cf.contractorStaged, false, 'no lump sum, no contractor schedule');
  assert.equal(totalContractorOut(cf), 0, 'and no contractor cash movement');
  assert.equal(cf.rows[0].hwOut, 835000, 'the whole principal leaves in month 1');
});
