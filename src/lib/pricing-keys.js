// ── THE PRICING INPUTS, AND THE CLOSED WON REFUSAL (FROZEN_FIGURES R-FF4) ──
//
// Served at /lib/pricing-keys.js and imported by the server and the React
// bundle, so the client's refusal and the server's are ONE rule (the R-CF2
// shape), and the key list is ONE list.
//
// THE LIST MOVED HERE FROM frontend-react/src/deal/payload.ts, which now
// re-exports it. It is the Commercials form's own keys: everything that form
// writes is a pricing input, and nothing else is. The server had no copy;
// version-pricing.js's PRICING_KEY_LABELS is a label map, not a definition,
// and lags it by six keys (paymentMode, priceOverrides and the hosting and
// OPEX overrides), which is recorded in the round report rather than relied on.
import { payloadsDiffer } from './payload-diff.js'

// ── TERM_QUOTES (John's P2 ruling, 2026-11-20): TWO LISTS, BECAUSE THERE ARE
//    TWO JOBS ─────────────────────────────────────────────────────────────
//
// The ruling renames COMMERCIALS_OWNED_KEYS to PRICING_OWNED_KEYS and adds
// termQuote and pricingMethod to it. The list did two jobs, and adding the two
// keys is right for one and destructive for the other:
//
//   - the Closed Won key set and the server's pricing keys: EVERY pricing key,
//     both methods. That is PRICING_OWNED_KEYS.
//   - what the Commercials FORM writes: `pickSalespersonWritable`
//     (frontend-react/src/deal/payload.ts) sends every key in its list on every
//     save, null when the form holds no value, BECAUSE an omitted owned key
//     reads as a deletion. Given termQuote, every Commercials save would send
//     termQuote: null and wipe the record's term quote (CLAUDE.md Verification
//     20: a control that edits a value is also what supplies it on save). That
//     is COMMERCIALS_FORM_KEYS, the form's own 32, unchanged.
//
// So the form keeps its list under a name that says what it is, and the
// pricing set is that list plus the term keys. One definition of each member.
export const COMMERCIALS_FORM_KEYS = Object.freeze([
  'ssExisting', 'ssNew', 'aqm', 'hemir', 'installResp', 'lumpSumCost',
  'targetMargin', 'marginOverrides', 'inSsExisting', 'inSsNew', 'inAqm', 'inHemir',
  'warrantyPct', 'whtPct', 'gstPct', 'grossUp', 'bidCurrency', 'proposalCurrency',
  'fxContingency', 'duration', 'structure', 'recoveryMonths', 'invoicing',
  'milestones', 'contractorMilestones', 'factoring',
  // R-O7: the hosting price override. `hostingPriceMode` is 'margin' or
  // 'perUnit'; `hostingUnitFees` is the monthly fee for ONE unit of a type,
  // keyed by the same `hoSs`/`hoAqm`/`hoHemir` the calculator prices by.
  'hostingPriceMode', 'hostingUnitFees',
  // R-OX1 and R-OX4: the payment mode and the OPEX all-in per-unit overrides.
  // BOTH ALLOWLISTS, because there are two: this one and
  // SALESPERSON_WRITABLE_KEYS on the server, which is the drift the C2 round
  // found the hard way when the route refused a key this list already carried.
  'paymentMode', 'opexUnitFees', 'opexUnitMargins',
  // R-C2b: the either-or generalised. R-O7 gave hosting a price override;
  // this is the same act for the hardware and installation lines, keyed by
  // the calculator's own line keys. `hwWarranty` is absent by construction -
  // the allowed set lives in `PRICE_OVERRIDE_KEYS` in the calculator, so the
  // rule that the warranty reaches the customer at cost is enforced where the
  // pricing happens rather than remembered at each writer.
  'priceOverrides',
])

/** The term quote's keys on the record (spec v2.1, 14.2): the quote and the method. */
export const TERM_QUOTE_KEYS = Object.freeze(['termQuote', 'pricingMethod'])

/** Every pricing key on an opportunity, both methods (P2, P7). */
export const PRICING_OWNED_KEYS = Object.freeze([...COMMERCIALS_FORM_KEYS, ...TERM_QUOTE_KEYS])

/** The won stage, by name, as opportunity-dates.js already names it. */
export const WON_STAGE = 'Closed Won'

/** R-FF4, as ruled. */
export const CLOSED_WON_PRICING_REFUSAL = "This deal is Closed Won; its pricing is the won version's and cannot change."

/**
 * The pricing keys a save CHANGES. A key resent with its saved value is not an
 * edit (R-CF2's lesson: a refusal fires only on a change, so a record saves
 * for everything else).
 */
export function changedPricingKeys(before, after) {
  return PRICING_OWNED_KEYS.filter((k) => k in (after ?? {}) && payloadsDiffer({ v: before?.[k] ?? null }, { v: after[k] ?? null }))
}

/** The refusal sentence, or null. One rule for the client and the server. */
export function closedWonPricingRefusal(status, before, after) {
  if (status !== WON_STAGE) return null
  return changedPricingKeys(before, after).length ? CLOSED_WON_PRICING_REFUSAL : null
}
