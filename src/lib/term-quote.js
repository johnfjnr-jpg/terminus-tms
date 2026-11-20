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

// ── THE PRODUCTS' NAMES, ONE LIST (TERM_QUOTES V4, V5) ──────────────────
//
// The words a person reads for each catalog product. The standalone screen's
// PRODUCTS list (TermPricingView.tsx) reads its labels from here, so the
// approval page, the banner and the screen cannot name a product two ways
// (Verification 20). "Air Quality" is the TP_TABS mockup's word.
export const TERM_PRODUCTS = Object.freeze([
  { key: 'safesight', label: 'SafeSight' },
  { key: 'air_quality', label: 'Air Quality' },
  { key: 'hemir', label: 'HEMIR' },
])
export const productLabel = (key) => TERM_PRODUCTS.find((p) => p.key === key)?.label ?? key

/** A decimal string as money is printed: "8000.00" -> "8,000.00". No float. */
export function decimalMoney(s) {
  if (s === null || s === undefined || s === '') return String(s ?? '')
  const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(String(s).trim())
  if (!m) return String(s)
  const frac = (m[3] ?? '').padEnd(2, '0')
  return `${m[1]}${m[2].replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${frac}`
}

/** Integer cents (bigint or string) as money is printed. */
export function centsMoney(cents) {
  if (cents === null || cents === undefined) return null
  let c
  try { c = BigInt(cents) } catch { return String(cents) }
  const neg = c < 0n
  const a = neg ? -c : c
  return `${neg ? '-' : ''}${(a / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${(a % 100n).toString().padStart(2, '0')}`
}

const pctWord = (s) => `${String(s).replace(/\.0+$/, '')}%`
const same = (a, b) => !payloadsDiffer({ v: a ?? null }, { v: b ?? null })

// ── V4: WHAT MOVED BETWEEN A DRAFT'S SETTINGS AND TODAY'S ────────────────
//
// A key-by-key diff of the stored snapshot against today's parameter object,
// each difference said in plain words ("the SafeSight price ladder at 120
// months, 500.00 to 510.00"). The SAME comparison settingsChanged makes, at a
// finer grain: every difference settingsChanged sees produces at least one
// line here, and a test holds the two together.
export function whatMoved(stored, today) {
  const out = []
  const a = stored ?? {}
  const b = today ?? {}
  const products = (x, y) => [...new Set([...Object.keys(x ?? {}), ...Object.keys(y ?? {})])]
    .sort((p, q) => TERM_PRODUCTS.findIndex((t) => t.key === p) - TERM_PRODUCTS.findIndex((t) => t.key === q))

  for (const p of products(a.PRICE_LADDER_BY_PRODUCT, b.PRICE_LADDER_BY_PRODUCT)) {
    const was = a.PRICE_LADDER_BY_PRODUCT?.[p], now = b.PRICE_LADDER_BY_PRODUCT?.[p]
    if (!was || !now) { out.push(`the ${productLabel(p)} price ladder, ${was ? 'removed' : 'added'}`); continue }
    const terms = [...new Set([...Object.keys(was), ...Object.keys(now)])].sort((x, y) => Number(x) - Number(y))
    for (const t of terms) {
      if (same(was[t], now[t])) continue
      out.push(`the ${productLabel(p)} price ladder at ${t} months, `
        + `${was[t] === undefined ? 'no price' : decimalMoney(was[t])} to ${now[t] === undefined ? 'no price' : decimalMoney(now[t])}`)
    }
  }
  for (const p of products(a.VOLUME_BANDS_BY_PRODUCT, b.VOLUME_BANDS_BY_PRODUCT)) {
    const was = a.VOLUME_BANDS_BY_PRODUCT?.[p] ?? [], now = b.VOLUME_BANDS_BY_PRODUCT?.[p] ?? []
    if (same(was, now)) continue
    if (was.length !== now.length) { out.push(`the ${productLabel(p)} volume bands, ${was.length} bands to ${now.length}`); continue }
    was.forEach((w, i) => {
      const n = now[i]
      if (!same(w.from, n.from)) out.push(`the ${productLabel(p)} band ${i + 1} start, ${w.from} units to ${n.from}`)
      if (!same(w.discountPct, n.discountPct)) out.push(`the ${productLabel(p)} band ${i + 1} discount, ${pctWord(w.discountPct)} to ${pctWord(n.discountPct)}`)
    })
  }
  for (const p of products(a.costs, b.costs)) {
    const was = a.costs?.[p], now = b.costs?.[p]
    if (!was || !now) { out.push(`the ${productLabel(p)} costs, ${was ? 'removed' : 'added'}`); continue }
    if (!same(was.hwCost, now.hwCost)) out.push(`the ${productLabel(p)} hardware cost, ${decimalMoney(was.hwCost)} to ${decimalMoney(now.hwCost)}`)
    if (!same(was.hostingMonthly, now.hostingMonthly)) out.push(`the ${productLabel(p)} hosting cost a month, ${decimalMoney(was.hostingMonthly)} to ${decimalMoney(now.hostingMonthly)}`)
  }
  if (!same(a.MARGIN_FLOOR, b.MARGIN_FLOOR)) out.push(`the margin floor, ${pctWord(a.MARGIN_FLOOR)} to ${pctWord(b.MARGIN_FLOOR)}`)
  if (!same(a.HW_UPFRONT_MARGIN, b.HW_UPFRONT_MARGIN)) out.push(`the hardware upfront margin, ${pctWord(a.HW_UPFRONT_MARGIN)} to ${pctWord(b.HW_UPFRONT_MARGIN)}`)
  if (!same(a.COMPARE_TERM, b.COMPARE_TERM)) out.push(`the comparison term, ${a.COMPARE_TERM} to ${b.COMPARE_TERM} months`)
  if (!same(a.TERMS, b.TERMS)) out.push(`the terms offered, ${(a.TERMS ?? []).join(', ')} to ${(b.TERMS ?? []).join(', ')} months`)
  if (!same(a.CURRENCY, b.CURRENCY)) out.push(`the currency, ${a.CURRENCY} to ${b.CURRENCY}`)
  // A key the engine does not read today, if one ever appears in either
  // object, is still a difference settingsChanged reports; it is named rather
  // than dropped, so the banner can never say "settings changed" with nothing
  // listed beneath it.
  for (const k of [...new Set([...Object.keys(a), ...Object.keys(b)])]) {
    if (TERM_PARAM_KEYS.includes(k) || same(a[k], b[k])) continue
    out.push(`the setting ${k}`)
  }
  return out
}

/** At most three, then "and N more" (V4). */
export function whatMovedSentence(lines, limit = 3) {
  if (!lines?.length) return ''
  const shown = lines.slice(0, limit)
  const more = lines.length - shown.length
  return shown.join('; ') + (more > 0 ? `; and ${more} more` : '')
}

// ── CF2: THE CASH FLOW CARD, FROM THE ENGINE'S OWN FIGURES ───────────────
//
// No new arithmetic (CF4, ruled (a)): spec 9.6's lowest balance and month of
// payback, and the factoring summary, read off the quote. Wording as ruled.
export function cashFlowCard(quote) {
  if (!quote?.cashFlow) return null
  const lowest = quote.cashFlow.lowest
  const low = lowest ? BigInt(lowest.balanceCents) : 0n
  const fx = quote.factoring ?? null
  return {
    peakFunding: low < 0n
      ? { amount: centsMoney(-low), month: lowest.month, text: `${centsMoney(-low)} in month ${lowest.month}` }
      : null,
    noFundingNeed: low < 0n ? null : 'No funding need: cash never falls below zero',
    paybackMonth: quote.cashFlow.paybackMonth ?? null,
    paybackText: quote.cashFlow.paybackMonth == null ? 'None within the term' : `Month ${quote.cashFlow.paybackMonth}`,
    paybackSub: 'cash stays at or above zero from here',
    factoring: fx
      ? { on: true, text: null, cost: centsMoney(fx.costCents), treatment: fx.treatment === 'pass_through' ? 'Pass through' : 'Absorb' }
      : { on: false, text: 'PO factoring: off', cost: null, treatment: null },
  }
}

/** The payment basis in words: "OPEX", or "CAPEX, hardware 800,000.00, Hybrid". */
export function paymentBasisText(quote) {
  if (!quote) return null
  if ((quote.paymentStructure ?? 'opex') !== 'capex' || !quote.capex) return 'OPEX'
  const amount = quote.capex.amountMode === 'custom' ? 'custom amount' : 'hardware'
  const structure = quote.capex.structure === 'two_phase' ? 'Two-phase' : 'Hybrid'
  return `CAPEX, ${amount} ${centsMoney(quote.capex.capexCents)}, ${structure}`
}

/** The deal adjustment in words, from the inputs as typed. */
function dealWords(inputs) {
  const d = inputs?.dealAdjustment
  if (!d) return 'None'
  if (d.discountPct !== undefined && d.discountPct !== null && String(d.discountPct).trim() !== '') return pctWord(d.discountPct)
  if (d.monthlyFee) return `Deal fee ${decimalMoney(String(d.monthlyFee).replace(/,/g, ''))} a month at ${d.termMonths} months`
  return 'None'
}

function cpiWords(inputs) {
  const mode = inputs?.cpiMode ?? 'none'
  if (mode === 'none') return 'None'
  const rate = inputs?.escalatorPct ?? '0'
  return `${mode === 'locked' ? 'Locked' : 'Published'} ${pctWord(rate)} from year ${inputs?.escalatorStartYear ?? 2}`
}

function factoringWords(inputs, quote) {
  const f = inputs?.factoring
  if (!f) return 'Off'
  const adv = quote?.factoring?.advanceCents
  return adv !== undefined && adv !== null ? `On, advance ${centsMoney(adv)}` : 'On'
}

/**
 * D4 and CF3: the "what changed" table between two TERM versions. Each row is
 * { key, label, before, after, changed, delta } with the figures already in
 * words; Base TCV and margin carry their difference. `before`/`after` are each
 * { inputs, quote, figures } where figures are the version's own (frozen when
 * submitted). Every product appears, quoted or not (artboard 4).
 */
export function whatChangedRows(before, after) {
  const rows = []
  const row = (key, label, b, a, delta = null) => rows.push({ key, label, before: b, after: a, changed: b !== a, delta: b !== a ? delta : null })
  for (const p of TERM_PRODUCTS) {
    row(`units.${p.key}`, `${p.label} units`, String(Number(before.inputs?.units?.[p.key] ?? 0)), String(Number(after.inputs?.units?.[p.key] ?? 0)))
  }
  row('term', 'Term', `${before.inputs?.termMonths} months`, `${after.inputs?.termMonths} months`)
  row('deal', 'Deal discount', dealWords(before.inputs), dealWords(after.inputs))
  row('basis', 'Payment basis', paymentBasisText(before.quote) ?? '-', paymentBasisText(after.quote) ?? '-')
  row('cpi', 'CPI', cpiWords(before.inputs), cpiWords(after.inputs))
  const peak = (q) => cashFlowCard(q)?.peakFunding?.text ?? 'None'
  row('peak', 'Peak funding need', peak(before.quote), peak(after.quote))
  row('factoring', 'PO factoring', factoringWords(before.inputs, before.quote), factoringWords(after.inputs, after.quote))
  const tb = before.figures?.baseTcv, ta = after.figures?.baseTcv
  const money = (n) => (n === null || n === undefined ? '--' : Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
  const diff = tb != null && ta != null ? Math.round((ta - tb) * 100) : null
  row('baseTcv', 'Base TCV', money(tb), money(ta),
    diff === null ? null : `${diff >= 0 ? '+' : '-'}${centsMoney(BigInt(Math.abs(diff)))}`)
  const mb = before.figures?.margin, ma = after.figures?.margin
  const pts = mb != null && ma != null ? (Number(ma) - Number(mb)) : null
  row('margin', 'Margin', mb != null ? `${mb}%` : '--', ma != null ? `${ma}%` : '--',
    pts === null ? null : `${pts >= 0 ? '+' : ''}${pts.toFixed(1)} pts`)
  return rows
}
