// ── A TERM QUOTE ON AN OPPORTUNITY (docs/pricing-spec.md v2.1, section 14) ──
//
// THE ONE GATEWAY from the opportunity to the term pricing engine. The
// headline, the approval page and the version routes import THIS, never the
// engine, so R-TP1's importer allowlist names one module for the whole round
// (scripts/tests/term-pricing-isolation.test.mjs). Neither engine imports the
// other; this module and the dispatchers that call it are where the two
// methods meet, and nothing below prices a Commercials deal.
//
// Pure: no database, no network. The settings it prices on are handed in
// (src/lib/term-params.js reads today's on the server).
import { priceQuote, TermPricingError, formatPct } from './term-pricing.js'
import { centsToDollars, contractValueOfCents } from './contract-value.js'
import { payloadsDiffer } from './payload-diff.js'

/** The engine's parameter object: the seven settings and costs (spec 14.3). */
export const TERM_PARAM_KEYS = Object.freeze([
  'TERMS', 'COMPARE_TERM', 'PRICE_LADDER_BY_PRODUCT', 'VOLUME_BANDS_BY_PRODUCT',
  'HW_UPFRONT_MARGIN', 'MARGIN_FLOOR', 'CURRENCY', 'costs',
])

/**
 * The quote's value, or why there is none (spec 14.4).
 *
 * NO QUOTE, NO UNITS AND AN ENGINE REFUSAL ARE ALL UNPRICED, and each says
 * which it is: `tcv` is null and `refusal` carries the engine's own code and
 * sentence, so the Term quote tab can say why and the headline reads '--'.
 * Only a TermPricingError is an answer; anything else is a fault and throws.
 *
 * @returns {{ tcv: number|null, quote: object|null, refusal: {code: string, message: string}|null }}
 */
export function termQuoteValue(termQuote, params) {
  if (!termQuote || typeof termQuote !== 'object') {
    return { tcv: null, quote: null, refusal: { code: 'NO_QUOTE', message: 'No term quote has been entered.' } }
  }
  let quote
  try {
    quote = priceQuote(termQuote, params)
  } catch (e) {
    if (e instanceof TermPricingError) return { tcv: null, quote: null, refusal: { code: e.code, message: e.message } }
    throw e
  }
  return { tcv: contractValueOfCents(quote.tcvNetCents), quote, refusal: null }
}

/**
 * "Settings changed since saved" (spec 14.5): the stored snapshot against
 * today's parameters, VALUE BY VALUE. Never a timestamp: a batch takes effect by
 * date with no write, and a save of an unchanged value moves a timestamp
 * (TERM_QUOTES Phase 0, 0-4). Key order is not a difference; a key one side
 * holds and the other does not is.
 */
export function settingsChanged(stored, today) {
  return payloadsDiffer({ params: stored ?? null }, { params: today ?? null })
}

/**
 * Which settings price a version (spec 14.3, 14.5, 14.6): a SUBMITTED version
 * prices on the settings stored with it, whatever they have become; a DRAFT
 * reprices on today's (R-TQ2) and says when they differ from its own.
 */
export function priceTermVersion(version, todayParams) {
  const issued = version?.status === 'issued'
  const stored = version?.rates?.params ?? null
  const params = issued ? stored : todayParams
  return {
    ...termQuoteValue(version?.inputs, params),
    params,
    settingsChanged: issued ? false : settingsChanged(stored, todayParams),
  }
}

/** The quote as the database can hold it: cents and fractions as decimal strings. */
export function serialiseQuote(quote) {
  return JSON.parse(JSON.stringify(quote, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)))
}

/** A margin ratio as the screen prints it: "43.8". Takes the engine's
 *  fraction or its stored form (serialiseQuote writes n and d as strings). */
export function marginPct(ratio) {
  if (!ratio || ratio.n === undefined || ratio.d === undefined) return null
  return formatPct({ n: BigInt(ratio.n), d: BigInt(ratio.d) }, 1)
}

/** The figures a person reads from a priced quote, in dollars (one adapter, 14.4). */
export function quoteFigures(quote) {
  if (!quote) return { baseTcv: null, monthly: null, margin: null, units: null, months: null }
  return {
    baseTcv: contractValueOfCents(quote.tcvNetCents),
    monthly: centsToDollars(quote.monthlyTotalCents),
    margin: marginPct(quote.grossMargin),
    units: (quote.lines ?? []).reduce((n, l) => n + (Number(l.units) || 0), 0),
    months: quote.termMonths ?? null,
  }
}

/**
 * R-TQ3's two signals, in the Term Pricing screen's own words
 * (TermPricingView.tsx: "Approval signal: N% below list", "Below the N% margin
 * floor"), so the approver reads what the salesperson saw. Null when absent.
 */
export function quoteSignals(quote) {
  if (!quote) return { dealDiscount: null, belowFloor: null }
  const d = quote.dealDiscount
  const floor = marginPct(quote.marginFloor)?.replace(/\.0$/, '') ?? null
  return {
    dealDiscount: d?.approvalSignal ? `Approval signal: ${marginPct(d.ratio)}% below list` : null,
    belowFloor: quote.belowMarginFloor ? `Below the ${floor}% margin floor` : null,
  }
}
