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
export function buildDealInputs(payload, { testBedCost = 0 } = {}) {
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
    { key: 'inSsEx', cost: (payload.inSsExisting ?? 0) * ssExisting, marginPct: marginFor('inSsEx') },
    { key: 'inSsNew', cost: (payload.inSsNew ?? 0) * ssNew, marginPct: marginFor('inSsNew') },
    { key: 'inAqm', cost: (payload.inAqm ?? 0) * aqmUnits, marginPct: marginFor('inAqm') },
    { key: 'inHemir', cost: (payload.inHemir ?? 0) * hemirUnits, marginPct: marginFor('inHemir') },
  ] : [
    { key: 'inNone', cost: 0, marginPct: marginFor('inNone') },
  ]

  const hostingLineItems = [
    { key: 'hoSs', cost: (payload.hoSafesight ?? 0) * (ssExisting + ssNew), marginPct: marginFor('hoSs') },
    { key: 'hoAqm', cost: (payload.hoAqm ?? 0) * aqmUnits, marginPct: marginFor('hoAqm') },
    { key: 'hoHemir', cost: (payload.hoHemir ?? 0) * hemirUnits, marginPct: marginFor('hoHemir') },
  ]

  const factoring = payload.factoring ?? {}

  return {
    ssUnitCost: payload.ssUnitCost ?? 0,
    ssUnits: ssExisting + ssNew,
    aqUnitCost: payload.aqUnitCost ?? 0,
    aqUnits: aqmUnits,
    hemirUnitCost: payload.hemirUnitCost ?? 0,
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
    factoringRatePct: factoring.ratePct ?? 1.5,
    factoringTermMonths: factoring.termMonths,
    factoringMethod: factoring.method ?? 'straight',
    whtPct: numericOrDefault(payload, 'whtPct'),
    gstPct: numericOrDefault(payload, 'gstPct'),
    grossUp: payload.grossUp ?? false,
    testBedCost,
  }
}
