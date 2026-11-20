// ── THE PRICING METHOD OF AN OPPORTUNITY, AND THE KIND OF A VERSION ───────
//
// docs/pricing-spec.md v2.1 section 14.1 (TERM_QUOTES, R-TQ1, R-TQ6, W).
// ONE reading of each, so no surface decides for itself what an absent value
// means (Verification 20). Pure; served to the browser at /lib/pricing-method.js.
//
// AN ABSENT pricingMethod IS COMMERCIALS, and that is a fact, not a fallback:
// every opportunity created before v2.1 was priced by Commercials, measured at
// TERM_QUOTES Phase 0 (all 31 live versions Commercials-shaped). A NEW
// opportunity is written term_quote at creation (Architecture 11: a default is
// an initial value written into the record, never a fallback in a reader).

export const PRICING_METHODS = Object.freeze(['term_quote', 'commercials'])

/** What a new opportunity is created with when its creator does not choose (R-TQ1). */
export const NEW_OPPORTUNITY_PRICING_METHOD = 'term_quote'

/** The record's method. Only an explicit term_quote is a term quote. */
export function pricingMethodOf(payload) {
  return payload?.pricingMethod === 'term_quote' ? 'term_quote' : 'commercials'
}

/** A version's kind. A row read without the column, or written before it, is Commercials. */
export function versionKindOf(version) {
  return version?.kind === 'term_quote' ? 'term_quote' : 'commercials'
}

/**
 * The initial value a creation route writes. The creator may choose either
 * method (implementation position, TERM_QUOTES: "the default" implies a
 * choice); nothing chosen is term_quote; anything else is null, which the
 * route refuses with 400 rather than coercing.
 */
export function creationPricingMethod(requested) {
  if (requested === undefined || requested === null) return NEW_OPPORTUNITY_PRICING_METHOD
  return PRICING_METHODS.includes(requested) ? requested : null
}

/** What each method is called in a sentence a person reads. */
export const PRICING_METHOD_LABELS = Object.freeze({ term_quote: 'Term quote', commercials: 'Commercials' })
