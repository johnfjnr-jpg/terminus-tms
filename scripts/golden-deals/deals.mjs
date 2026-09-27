// ── THE FOUR GOLDEN DEALS: THEIR INPUTS, AND NOTHING ELSE ────────────────
//
// Step 1 of the pricing verification. These are the reference deals John
// checks by hand in Excel; every figure published about them is computed from
// here by the LIVE engine, never typed.
//
// ── THE CATALOG IS DECLARED HERE, NOT READ FROM THE DATABASE ─────────────
//
// A golden deal has to mean the same thing next year as it does today. The
// live catalog is a batch with an effective date and it moves, so a suite
// pinned to it would go red the first time somebody publishes a price change
// and the red would say nothing about the engine. These rates are therefore
// part of the fixture, and they are the numbers John reproduces in Excel.
//
// ── CHOSEN ROUND ENOUGH TO CHECK, NOT SO ROUND THAT ERRORS CANCEL ───────
//
// No 0% margin anywhere: a zero margin makes price equal cost, which would
// hide the division rule the whole document is about. No repeated margin
// across the lines of one deal, so a line reading another line's margin shows
// up. No zero-unit lines except G3, where one is the point. Counts are not
// multiples of each other, so an allocation that divided by the wrong total
// would not land on the right answer anyway.

/** The rate card every golden deal prices against. */
export const GOLDEN_CATALOG = {
  // The six catalog-only rates.
  ssUnitCost: 8000,
  aqUnitCost: 2000,
  hemirUnitCost: 100000,
  hoSafesight: 200,
  hoAqm: 100,
  hoHemir: 500,
  // The four overridable installation rates.
  inSsExisting: 1500,
  inSsNew: 2500,
  inAqm: 400,
  inHemir: 3000,
};

/**
 * G1: OPEX, single phase.
 *
 * OPEX is the single-phase mode: `effectiveStructure` returns 'single' for
 * every OPEX deal, so the recovery period spans the whole term. The customer
 * is quoted an all-in monthly fee per unit and the engine works BACKWARDS
 * from it, scaling each line's price so the type's contract total lands on
 * the fee. SafeSight carries an absolute fee; AQ Sensor carries a target
 * margin instead, so both halves of the either-or are exercised.
 */
export const G1 = {
  id: 'G1',
  title: 'OPEX single-phase: all-in monthly fee and blended margin',
  payload: {
    paymentMode: 'opex',
    // `structure: 'single'` IS IN THE RECORD, NOT DERIVED AT PRICING TIME, and
    // the fixture has to carry it (Verification 47: build the state the way the
    // SYSTEM produces it). `readDealPayload` saves `effectiveStructure(ui)`
    // (payload.ts:365), which returns 'single' for every OPEX deal, so that is
    // what a saved OPEX record holds. `buildDealInputs` reads
    // `payload.structure ?? 'twoPhase'` and applies no OPEX rule of its own, so
    // omitting it here would have priced G1 as TWO-PHASE and the document would
    // have described a shape no saved record has.
    structure: 'single',
    ssExisting: 18, ssNew: 6, aqm: 9, hemir: 2,
    duration: 48,
    targetMargin: 32,
    warrantyPct: 5,
    installResp: 'Terminus Contractor - Per Unit',
    invoicing: 'annual',
    whtPct: 0, gstPct: 0, grossUp: false,
    // The either-or, both ways: an absolute fee on SafeSight, a target margin
    // on AQ Sensor, and HEMIR left to price from the deal's own margins.
    //
    // 650, NOT 425, AND THE FIRST RUN IS WHY. At 425 the allocation priced
    // SafeSight at a 1.3% blended margin, because the fee barely covered the
    // type's own cost over the term. That is the near-zero margin this fixture
    // set exists to avoid: at 1.3% the division rule and a flat markup give
    // almost the same answer, so the figure cannot check the rule. 650 lands
    // the blend near 35%, clear of the deal's 32% and of AQ's 38%, so a line
    // reading another line's rate is visible.
    opexUnitFees: { ss: 650 },
    opexUnitMargins: { aq: 38 },
  },
};

/**
 * G2: CAPEX, two-phase.
 *
 * The hardware and installation price is recovered evenly over the recovery
 * period, then hosting runs for the rest of the term. Annual invoicing, so
 * each 12-month block bills in its first month.
 */
export const G2 = {
  id: 'G2',
  title: 'CAPEX two-phase: recovery period and milestone payments',
  payload: {
    paymentMode: 'capex',
    structure: 'twoPhase',
    ssExisting: 22, ssNew: 14, aqm: 7, hemir: 3,
    duration: 60,
    recoveryMonths: 18,
    targetMargin: 30,
    warrantyPct: 4,
    installResp: 'Terminus Contractor - Lump Sum',
    lumpSumCost: 214000,
    invoicing: 'annual',
    whtPct: 0, gstPct: 0, grossUp: false,
    // ── PHASE 0 FINDING, AND G2'S CASH FLOW IS ON HOLD FOR IT ────────────
    //
    // The contractor is paid in stages, and MEASURED, THE ENGINE DOES NOT SEE
    // IT. The cash flow filters contractor milestones on a `usd` field that no
    // writer supplies and the route REFUSES, so `contractorStaged` is false on
    // every deal the system can save and the whole principal leaves in month 1.
    //
    // Rows carry `pct` only, which is what `readContractorMilestones` writes,
    // so this fixture is the state the SYSTEM produces rather than the shape the
    // cash flow happens to read (Verification 47). It is deliberately NOT given
    // a `usd` to make the figures come out: that would be a fixture built to
    // satisfy a broken join, which is the exact fault R-N1 was ruled about.
    //
    // See GOLDEN_DEALS_PHASE0_FINDING.md. The detector is
    // scripts/golden-deals/subkey-census.mjs.
    contractorMilestones: [
      { month: 1, label: 'Contract start', pct: 40 },
      { month: 5, label: 'Installation complete', pct: 35 },
      { month: 9, label: 'Go live', pct: 25 },
    ],
    marginOverrides: { hoSs: 41, hoAqm: 37, hoHemir: 44 },
  },
};

/**
 * G3: hybrid, with PO factoring and withholding tax.
 *
 * Hybrid has NO recovery period: the hardware arrives by customer milestone
 * instead. Factoring advances the cost principal in month one and repays it
 * on a declining-balance schedule. WHT is borne by Terminus because gross-up
 * is off, so it lands in cost rather than in price.
 *
 * ONE ZERO-UNIT LINE ON PURPOSE: HEMIR is absent, so the document can show
 * what a line with no units does to the groups and to the OPEX-style
 * allocations that are not running here.
 */
export const G3 = {
  id: 'G3',
  title: 'Hybrid with PO factoring and withholding tax',
  payload: {
    paymentMode: 'capex',
    structure: 'hybrid',
    ssExisting: 26, ssNew: 11, aqm: 5, hemir: 0,
    duration: 36,
    targetMargin: 34,
    warrantyPct: 3,
    installResp: 'Terminus Contractor - Per Unit',
    invoicing: 'monthly',
    whtPct: 15, gstPct: 8, grossUp: false,
    milestones: [
      { month: 2, label: 'Contract start', pct: 45 },
      { month: 7, label: 'Installation complete', pct: 35 },
      { month: 13, label: 'Go live', pct: 20 },
    ],
    factoring: { enabled: true, ratePct: 1.4, termMonths: 24, method: 'declining' },
  },
};

/**
 * G4: CAPEX two-phase with overrides present.
 *
 * One ABSOLUTE price override (the HEMIR hardware line is quoted at a figure
 * rather than priced from a margin) and one MARGIN override (SafeSight
 * hardware prices at its own rate, not the deal's). The effective values are
 * published beside the derivation they replaced, so the reader can see both.
 */
export const G4 = {
  id: 'G4',
  title: 'CAPEX two-phase with an absolute price override and a margin override',
  payload: {
    paymentMode: 'capex',
    structure: 'twoPhase',
    ssExisting: 15, ssNew: 9, aqm: 6, hemir: 4,
    duration: 54,
    recoveryMonths: 24,
    targetMargin: 29,
    warrantyPct: 6,
    installResp: 'Terminus Contractor - Per Unit',
    invoicing: 'annual',
    whtPct: 12, gstPct: 0, grossUp: true,
    // THE MARGIN OVERRIDE: SafeSight hardware prices at 45, not the deal's 29.
    marginOverrides: { hwSs: 45 },
    // THE ABSOLUTE PRICE OVERRIDE: the HEMIR hardware line is quoted at this
    // price whatever its cost and margin would have given.
    priceOverrides: { hwHemir: 612000 },
    // An installation rate quoted for this job, overriding the catalog's 1500.
    inSsExisting: 1650,
  },
};

export const GOLDEN_DEALS = [G1, G2, G3, G4];
