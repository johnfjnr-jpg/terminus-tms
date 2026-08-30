/**
 * The stored payload, translated into the shape calculateDeal() takes.
 *
 * Round 38, block 2's prerequisite (b). ONE translation, used by three callers
 * that could not previously share one:
 *
 *   the Commercials tab, pricing what is on screen
 *   POST /api/deals/submit, recomputing authoritatively before a snapshot
 *   the approval page, recomputing a HISTORICAL version at its own rates
 *
 * It existed twice before this: buildDealInputs in frontend/opportunity-deal.js
 * and inline inside loadDealInputsFromOpportunity in src/routes/deals.js, whose
 * comment claimed the two were "kept identical". MEASURED BEFORE MERGING, across
 * eight payload shapes including every installResp branch, blanks-as-null and
 * numeric strings: they agreed on all eight. The claim held, which is not the
 * same as it being safe to keep relying on, and Architecture rule 3 is the
 * reason - a second path that agrees today will disagree later.
 *
 * ─────────────────────────────────────────────────────────────
 * RATES COME FROM THE PAYLOAD, AND THAT IS THE WHOLE INTERFACE
 * ─────────────────────────────────────────────────────────────
 *
 * This function reads ssUnitCost, inSsExisting, hoSafesight and the rest as
 * ordinary payload keys. It never looks up a catalog. That is what makes the
 * third caller possible at all: a version's `inputs` already carries the rates
 * it was priced at, so recomputing a historical version means calling this with
 * that payload and nothing else.
 *
 * The two live callers merge today's catalog into the payload first, which is
 * what readPayload() on the tab has done since Round 36. Choosing WHICH rates
 * apply is the caller's decision and it is a real one; doing the arithmetic is
 * this function's job and it is the same every time.
 */

import { numericOrDefault } from './numeric-payload.js';

/**
 * @param {object} payload - a record payload, with catalog rates merged in
 * @param {{ testBedCost?: number }} [opts] - testBedCost comes from
 *   opportunity_details, not from the payload, so it is passed rather than read.
 * @returns {object} the calculateDeal() input shape
 */
/**
 * WHERE EACH DEAL VALUE LIVES, in one place, read by everything.
 *
 * CLAUDE.md Verification 20: a second reader of the same value always drifts.
 * The approval page reported `factoringRatePct` as an unset default on every
 * deal, because it read `payload.factoringRatePct` while the calculator reads
 * `payload.factoring.ratePct`. Both readers were correct in isolation and they
 * disagreed about where the value is, which is the whole failure.
 *
 * So a display surface never invents its own read. `RAW_READERS` is what
 * buildDealInputs itself uses below, and it is what the approval page uses to
 * decide whether a person set a value or a default is standing in for one. A
 * value it reports as unset is unset by the calculator's own definition.
 *
 * RAW, deliberately: these return what the payload holds, before any default is
 * applied, because "is this set" and "what does it come to" are different
 * questions and only the first one can be answered after a default has been
 * substituted.
 */
export const RAW_READERS = {
  ssExisting: (p) => p?.ssExisting,
  ssNew: (p) => p?.ssNew,
  aqm: (p) => p?.aqm,
  hemir: (p) => p?.hemir,
  targetMargin: (p) => p?.targetMargin,
  warrantyPct: (p) => p?.warrantyPct,
  whtPct: (p) => p?.whtPct,
  gstPct: (p) => p?.gstPct,
  fxContingency: (p) => p?.fxContingency,
  duration: (p) => p?.duration,
  recoveryMonths: (p) => p?.recoveryMonths,
  lumpSumCost: (p) => p?.lumpSumCost,
  // The one that started this rule. Nested, and nothing about the key name says so.
  factoringRatePct: (p) => p?.factoring?.ratePct,
  // NESTED, like the rate beside it. Round 41 ruling 4 put factoringTermMonths
  // in ZERO_IS_NOT_A_VALUE and isSet THROWS for a key with no reader, so the
  // list and this map have to move together. That throw is the guard working:
  // it refused the key rather than silently reporting it as absent on every
  // deal, which is what a permissive lookup would have done.
  factoringTermMonths: (p) => p?.factoring?.termMonths,
};

/**
 * How many units of each catalog product this deal carries.
 *
 * ONE MAPPING, for the same reason RAW_READERS exists. The approval page needs
 * it to answer "does a product with no cost basis actually appear in this
 * deal", and inventing a second product-to-units mapping there is precisely
 * Verification 20. These read through numericOrDefault exactly as
 * buildDealInputs does below.
 *
 * Keyed by base_cost_batches.product, so it lines up with PRODUCT_RATE_KEYS
 * rather than with anything the UI calls things.
 */
export const PRODUCT_UNITS = {
  safesight: (p) => numericOrDefault(p ?? {}, 'ssExisting') + numericOrDefault(p ?? {}, 'ssNew'),
  air_quality: (p) => numericOrDefault(p ?? {}, 'aqm'),
  hemir: (p) => numericOrDefault(p ?? {}, 'hemir'),
};

/**
 * Is this value set by a person, or is a default standing in for it?
 * @param {object} payload
 * @param {string} key - a key of RAW_READERS
 */
export function isSet(payload, key) {
  const reader = RAW_READERS[key];
  if (!reader) throw new Error(`isSet: no reader for ${key}. Add it to RAW_READERS rather than reading the payload directly.`);
  const v = reader(payload);
  return v !== undefined && v !== null && v !== '';
}

// ── AN ABSENT GST RATE IS AN ABSENCE, NOT A ZERO ──────────────────────
//
// Round 39. 406 of 467 opportunities carry no gstPct at all. The calculator
// defaults it to 0, which is right for arithmetic and wrong for a screen: with
// no rate recorded, gstAmount is 0 and Price to customer equals the contract
// net, so the page showed a complete, confident, GST-free price with nothing on
// it saying a tax had never been recorded. A salesperson reads that number out.
//
// That is zero-versus-missing in the one place it reaches a customer, so the
// page states the absence and keeps showing the figure. It stops pretending to
// be complete rather than going blank.
//
// AND IT SAYS WHICH SIDE OF GST THE CONTRACT PRICE SITS ON. Prices are quoted
// GST-EXCLUSIVE, which is the region's standard B2B practice and what the
// calculator already does: gstAmount is added to the invoice base and
// contractNet excludes it, so the rate cannot touch margin. "Price to customer"
// reads as the whole number to anyone who has not been told that, so the label
// says it rather than assuming it.
//
// ONE READER, because two would drift (Verification 20). Both matrices and the
// approval page's GST exposure row all ask this, and it asks isSet(), which is
// the calculator's own reader. An explicit 0 is a recorded decision, a
// zero-rated supply, and reads as "GST at 0%" - only a missing value reads as
// not recorded.
// ── WHERE A ZERO IS NOT A VALUE A PERSON WOULD DELIBERATELY ENTER ─────────
//
// Set by the business, Round 39, correcting my own split. I had bucketed these
// as RATES versus COUNTS, which put `duration` on the wrong side: it is a count,
// so it stayed with the unit counts and kept its prefilled zero.
//
// The real test is not what kind of number it is. It is whether a person would
// ever mean zero:
//
//   zero AQ sensors is a deal          -> a zero is a value, prefill it
//   zero SafeSight units is a deal     -> a zero is a value, prefill it
//   ZERO CONTRACT MONTHS IS NOT A DEAL -> a zero is an unset field
//
// And duration is worse than a display fault, because hosting revenue over a
// zero term is zero, so a prefilled 0 does not only erase the absence, it
// prices the deal.
//
// Membership is by that question, so adding a key here is answering it rather
// than matching a type. The test in commercials-wiring reads THIS list, not a
// second one written beside it.
export const ZERO_IS_NOT_A_VALUE = [
  'targetMargin', 'warrantyPct', 'whtPct', 'gstPct', 'fxContingency', 'factoringRatePct',
  'duration',
  // ── ADDED ROUND 41, on the business's rulings from the Phase 1 enumeration ──
  //
  // recoveryMonths. Zero recovery months on a structure whose purpose is
  // recovering hardware is a contradiction, not an aggressive position. It was
  // missed in Round 40 Phase 1b, and the miss is finding 1: NUMERIC_DEFAULTS
  // held 0 and the calculator read `recoveryMonths || 0`, so a blank field
  // priced a two-phase deal at zero months and never invoiced $492,858.
  'recoveryMonths',
  // factoring.termMonths. A facility with a zero-month term is not a facility.
  // Ruling 5 makes it an editable field with an admin default; until then a
  // blank falls back to defaultTerm, which is the same fallback shape.
  'factoringTermMonths',
  // lumpSumCost. Ruled in AFTER the Phase 1 exclusion was found to rest on a
  // false premise. I ruled it out because the field is hidden on three of four
  // installation types and including it would make the sheet say "not
  // recorded" on those; measured, buildNotRecorded ALREADY reports it on all
  // four, so the premise was wrong. With applicability handled separately, the
  // ruling is on the one installation type where the field exists, and there
  // zero is not a value anybody deliberately enters.
  'lumpSumCost',
];

// ONE DECISION FOR EVERY RATE, and the wording per rate on top of it.
//
// Round 39 shipped this for GST alone, and the business's own reading of the
// capture is why it now covers three: fixing GST made the Tax Adjustments card
// DISAGREE WITH ITSELF, a bright zero and a dim zero four lines apart meaning a
// value and a placeholder. That is worse than the uniform wrongness it
// replaced, and it is worse because of what this round did.
//
// Their rule, written beside build-discipline rule 10: a finding that your own
// change created is part of the change, not a new item.
export function ratePresentation(payload, key) {
  const recorded = isSet(payload, key);
  const pct = recorded ? Number(RAW_READERS[key](payload)) : null;
  return {
    recorded,
    pct,
    // What a figure cell shows instead of a computed zero.
    value: recorded ? null : 'not recorded',
    basis: recorded
      ? `${pct}% of the invoice base`
      : 'Not recorded. Priced at 0%, which is an absent rate rather than a rate somebody set to zero.',
  };
}

export function gstPresentation(payload) {
  const r = ratePresentation(payload, 'gstPct');
  return {
    ...r,
    rowLabel: r.recorded ? `GST at ${r.pct}%, added to the invoice` : 'GST, not recorded',
    priceLabel: r.recorded ? 'Price to customer, contract price plus GST' : 'Price to customer, excludes GST',
  };
}

// Duration is not a rate and gets no percentage, but it takes the same
// recorded-or-not decision: the hosting lines say what term they cover, and
// with no term recorded they say that rather than naming a zero-month contract.
export function durationPresentation(payload) {
  const r = ratePresentation(payload, 'duration');
  const months = r.recorded ? r.pct : null;
  return {
    ...r,
    months,
    priceLabel: r.recorded ? `Hosting price over ${months} months` : 'Hosting price, contract duration not recorded',
    costLabel: r.recorded ? `Hosting cost over ${months} months` : 'Hosting cost, contract duration not recorded',
  };
}

// WHT is not GST-shaped and does not get GST's words. It reaches MARGIN through
// whtBorne rather than only the price line, so an absent rate is understating a
// cost rather than only understating an invoice.
export function whtPresentation(payload) {
  const r = ratePresentation(payload, 'whtPct');
  return {
    ...r,
    deductedLabel: r.recorded
      ? `Withholding tax at ${r.pct}%, deducted by the customer`
      : 'Withholding tax, not recorded',
    grossUpLabel: r.recorded ? `Grossed up for WHT at ${r.pct}%` : 'Grossed up for WHT, rate not recorded',
  };
}

// ── RATES COME IN RESOLVED. Round 40 Phase 1b ──────────────────────────────
//
// The business's ruling: "where does this rate come from" is POLICY, not
// arithmetic, and policy in here would mean every caller must supply a catalog
// AND the right catalog for that deal's as_of. So resolveRates() answers it
// once, before this, and this function is handed numbers.
//
// REQUIRED, not defaulted. A default would let a caller forget and silently get
// the old behaviour, which is exactly the shape Verification 24 names: the
// parameter and the constant agree on every path that runs, and the omission is
// invisible until somebody wants the other value. Two call sites were merging
// { ...payload, ...catalogRates } by hand before this existed, which is the
// second-reader risk this deletes.
export function buildDealInputs(payload, { testBedCost = 0, rates } = {}) {
  if (!rates) {
    throw new Error(
      'buildDealInputs requires resolved rates. Call resolveRates(payload, catalog) '
      + 'and pass its .rates, rather than merging catalog figures into the payload.')
  }
  const targetMargin = numericOrDefault(payload, 'targetMargin')
  const overrides = payload.marginOverrides ?? {}
  const marginFor = (key) => overrides[key] ?? targetMargin

  const ssExisting = numericOrDefault(payload, 'ssExisting')
  const ssNew = numericOrDefault(payload, 'ssNew')
  const aqmUnits = numericOrDefault(payload, 'aqm')
  const hemirUnits = numericOrDefault(payload, 'hemir')

  const lumpSumDeal = (payload.installResp ?? '').includes('Lump Sum')

  // isPerUnit used to be a separately-stored boolean, computed once via
  // uiState.installResp === 'Terminus Installation Team' - an invented
  // string that never matched the real 4-option picklist (Terminus
  // Ops.dc.html:5569-5570/5703: Client Own Installation Team / Terminus
  // Contractor - Per Unit / Terminus Contractor - Lump Sum / Terminus -
  // Reseller Installation), so it was always false and Reseller
  // Installation had no option at all. Derived fresh from installResp
  // here instead, same substring-match mechanism as lumpSumDeal above,
  // so there's no separate flag left to drift out of sync with the
  // string it's meant to describe.
  const isPerUnit = (payload.installResp ?? '').includes('Per Unit')

  // Lump Sum must be its own branch, not folded into the isPerUnit check -
  // it was previously falling through to the zero-cost 'inNone' line,
  // meaning installGroup (and everything downstream: the Deal Summary
  // matrix's Installation column, the Deal sheet's installation cost
  // line) silently priced Lump Sum installation at $0.
  const installLineItems = lumpSumDeal ? [
    { key: 'inLump', cost: numericOrDefault(payload, 'lumpSumCost'), marginPct: marginFor('inLump') },
  ] : isPerUnit ? [
    // rates[...] and no ?? 0: an absent rate is absent, and resolveRates omits
    // the key entirely rather than inventing a zero. A line whose rate is
    // missing prices at nothing and the missing-batch warning says so.
    { key: 'inSsEx', cost: (rates.inSsExisting ?? 0) * ssExisting, marginPct: marginFor('inSsEx') },
    { key: 'inSsNew', cost: (rates.inSsNew ?? 0) * ssNew, marginPct: marginFor('inSsNew') },
    { key: 'inAqm', cost: (rates.inAqm ?? 0) * aqmUnits, marginPct: marginFor('inAqm') },
    { key: 'inHemir', cost: (rates.inHemir ?? 0) * hemirUnits, marginPct: marginFor('inHemir') },
  ] : [
    { key: 'inNone', cost: 0, marginPct: marginFor('inNone') },
  ]

  const hostingLineItems = [
    { key: 'hoSs', cost: (rates.hoSafesight ?? 0) * (ssExisting + ssNew), marginPct: marginFor('hoSs') },
    { key: 'hoAqm', cost: (rates.hoAqm ?? 0) * aqmUnits, marginPct: marginFor('hoAqm') },
    { key: 'hoHemir', cost: (rates.hoHemir ?? 0) * hemirUnits, marginPct: marginFor('hoHemir') },
  ]

  const factoring = payload.factoring ?? {}

  return {
    ssUnitCost: rates.ssUnitCost ?? 0,
    ssUnits: ssExisting + ssNew,
    aqUnitCost: rates.aqUnitCost ?? 0,
    aqUnits: aqmUnits,
    hemirUnitCost: rates.hemirUnitCost ?? 0,
    hemirUnits,
    warrantyPct: numericOrDefault(payload, 'warrantyPct'),
    installLineItems,
    hostingLineItems,
    hardwareMargins: {
      hwSs: marginFor('hwSs'),
      hwAqm: marginFor('hwAqm'),
      hwHemir: marginFor('hwHemir'),
      hwWarranty: marginFor('hwWarranty'),
    },
    months: numericOrDefault(payload, 'duration'),
    structure: payload.structure ?? 'twoPhase',
    recoveryMonths: numericOrDefault(payload, 'recoveryMonths'),
    annualInvoicing: (payload.invoicing ?? 'annual') === 'annual',
    milestones: payload.milestones ?? [],
    lumpSumDeal,
    lumpCost: numericOrDefault(payload, 'lumpSumCost'),
    contractorMilestones: payload.contractorMilestones ?? [],
    factoringEnabled: factoring.enabled ?? false,
    // Through RAW_READERS, so the calculator and the approval page cannot
    // disagree about where this lives. See the note above.
    factoringRatePct: RAW_READERS.factoringRatePct(payload) ?? 1.5,
    factoringTermMonths: factoring.termMonths,
    factoringMethod: factoring.method ?? 'straight',
    whtPct: numericOrDefault(payload, 'whtPct'),
    gstPct: numericOrDefault(payload, 'gstPct'),
    grossUp: payload.grossUp ?? false,
    testBedCost,
  }
}
