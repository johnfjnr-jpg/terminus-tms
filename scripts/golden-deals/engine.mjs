// ── ONE PIPELINE, SO THE DOCUMENT AND THE HARNESS CANNOT DISAGREE ────────
//
// Verification 20 by construction. The compute script that writes
// GOLDEN_DEALS.md and the acceptance harness that guards it both call this, so
// there is no second expression of "how a golden deal is priced" to drift.
//
// It is the LIVE path and nothing here restates it: resolveRates, then
// buildDealInputs, then calculateDeal, plus opexRows for an OPEX deal, exactly
// as the application does.
import { resolveRates } from '../../src/lib/rate-resolution.js'
import { buildDealInputs } from '../../src/lib/deal-inputs.js'
import { calculateDeal } from '../../src/lib/deal-calculator.js'
import { opexRows } from '../../src/lib/opex.js'
import { GOLDEN_CATALOG } from './deals.mjs'

/**
 * Prices one golden deal through the live engine.
 *
 * TEST BED COST IS ZERO ON ALL FOUR, deliberately and stated rather than
 * defaulted: it is a sunk cost carried from a converted Test Bed, it reaches
 * only total cost, and none of these four deals came from a conversion. A
 * non-zero value would make every achieved margin in the document depend on a
 * figure none of the inputs mentions.
 */
export function priceGoldenDeal(deal, catalog = GOLDEN_CATALOG) {
  const resolution = resolveRates(deal.payload, catalog)
  const inputs = buildDealInputs(deal.payload, { testBedCost: 0, rates: resolution.rates })
  const result = calculateDeal(inputs)
  // OPEX ONLY. `opexRows` is callable on any result, and on a CAPEX deal it
  // would report an all-in fee nobody is quoted, so it is not published there.
  const opex = String(deal.payload.paymentMode ?? 'capex') === 'opex'
    ? opexRows(result, deal.payload, resolution.rates)
    : null
  return { deal, resolution, inputs, result, opex }
}

/**
 * Every published figure of one deal, as a FLAT map of dotted path to value.
 *
 * The harness compares these maps, so a failure names the figure that moved
 * rather than reporting that a deal changed. Verification 14's shape applied to
 * a diff: a comparison has to be able to say WHICH side has what.
 *
 * Booleans and strings are included, not only numbers. A structure silently
 * becoming 'twoPhase', or `costIncomplete` flipping, is exactly the kind of
 * change a numbers-only comparison would wave through.
 */
export function flatten(priced) {
  const out = {}
  const walk = (prefix, v) => {
    if (v === null || v === undefined) { out[prefix] = v === undefined ? null : null; return }
    if (Array.isArray(v)) { v.forEach((x, i) => walk(`${prefix}[${i}]`, x)); return }
    if (typeof v === 'object') {
      for (const k of Object.keys(v).sort()) walk(prefix ? `${prefix}.${k}` : k, v[k])
      return
    }
    out[prefix] = v
  }

  const { resolution, result, opex } = priced
  // The resolved rates and WHERE EACH CAME FROM. A golden that pinned only the
  // effective number could not tell a quoted rate from a catalog one, and that
  // distinction is half of what an approver reads.
  for (const line of resolution.lines) {
    walk(`rates.${line.key}.value`, line.value)
    walk(`rates.${line.key}.source`, line.source)
  }
  walk('hardware', result.hardware)
  walk('groups', result.groups)
  walk('totals', result.totals)
  walk('tax', result.tax)
  walk('cashFlow', result.cashFlow)
  walk('financeCost', result.financeCost)
  walk('testBedCost', result.testBedCost)
  walk('totalDealCostAll', result.totalDealCostAll)
  walk('achievedMargin', result.achievedMargin)
  walk('costIncomplete', result.costIncomplete)
  if (opex) walk('opex', opex)
  return out
}
