// ── THE TERM PRICING ENGINE ──────────────────────────────────────────────
//
// Implements docs/pricing-spec.md (Specification v2.0) exactly. CLAUDE.md
// Architecture rule 14: no hard-coded parameters, no floats for money. That
// rule does not govern the deal-sheet engine, and this file is not part of it.
//
// ── R-TP1: ISOLATION ─────────────────────────────────────────────────────
//
// A pure module. No UI, no database, no network, and NO IMPORTS AT ALL. The
// isolation guard (scripts/tests/term-pricing-isolation.test.mjs) asserts the
// import list is empty and that nothing outside an allowlist imports this file,
// so the deal-sheet pricing code and this engine cannot reach each other. The
// R-TP1 exception list for tax and rounding helpers is EMPTY (Phase 0, 0.3):
// the only existing one, calculateTax, is float and whole-dollar.
//
// ── R-TP2: MONEY ─────────────────────────────────────────────────────────
//
// Every quantity is an exact fraction of two BigInts. Parameters and costs
// enter as DECIMAL STRINGS ("8000.00", "90") and never as JS numbers, so no
// float exists even in transit. Rounding happens only where the spec says:
// band fees and invoiced figures to cents (sections 4.2, 5, 6, 7, 8), margins
// and savings to 1 dp for display. Rounding is half-up, applied to magnitude
// (half away from zero), which only matters for a negative saving.
//
// Money results are BigInt CENTS. Ratios (margins, savings) are fractions and
// are formatted at the edge by formatPct.

export class TermPricingError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'TermPricingError'
    this.code = code
  }
}

// ── Exact fractions ──────────────────────────────────────────────────────

const abs = (a) => (a < 0n ? -a : a)
const gcd = (a, b) => {
  a = abs(a); b = abs(b)
  while (b) [a, b] = [b, a % b]
  return a
}
function frac(n, d = 1n) {
  if (d === 0n) throw new TermPricingError('DIVIDE_BY_ZERO', 'division by zero')
  if (d < 0n) { n = -n; d = -d }
  const g = gcd(n, d) || 1n
  return { n: n / g, d: d / g }
}
const ZERO = frac(0n)
const ONE = frac(1n)
const HUNDRED = frac(100n)
const add = (a, b) => frac(a.n * b.d + b.n * a.d, a.d * b.d)
const sub = (a, b) => frac(a.n * b.d - b.n * a.d, a.d * b.d)
const mul = (a, b) => frac(a.n * b.n, a.d * b.d)
const div = (a, b) => frac(a.n * b.d, a.d * b.n)
const cmp = (a, b) => {
  const l = a.n * b.d
  const r = b.n * a.d
  return l < r ? -1 : l > r ? 1 : 0
}
const fromInt = (i) => frac(BigInt(i))
const fromCents = (c) => frac(c, 100n)
function pow(a, k) {
  let r = ONE
  for (let i = 0; i < k; i++) r = mul(r, a)
  return r
}

/** A decimal string ("8000.00", "-1.5", "90") to an exact fraction. */
export function parseDecimal(value, what = 'value') {
  if (typeof value === 'bigint') return frac(value)
  if (typeof value !== 'string' || !/^-?\d+(\.\d+)?$/.test(value.trim())) {
    throw new TermPricingError('NOT_A_DECIMAL',
      `${what} must be a decimal string, got ${typeof value === 'string' ? JSON.stringify(value) : typeof value}`)
  }
  const s = value.trim()
  const neg = s.startsWith('-')
  const [whole, part = ''] = (neg ? s.slice(1) : s).split('.')
  const n = BigInt(whole + part) * (neg ? -1n : 1n)
  return frac(n, 10n ** BigInt(part.length))
}

/** Round a fraction half-up (away from zero on a tie) to `places` decimals,
 *  returned as a BigInt scaled by 10^places (places = 2 gives cents). */
export function roundHalfUp(x, places = 2) {
  const scale = 10n ** BigInt(places)
  const num = abs(x.n) * scale
  let q = num / x.d
  if ((num % x.d) * 2n >= x.d) q += 1n
  return x.n < 0n ? -q : q
}

const pctToRatio = (s, what) => div(parseDecimal(s, what), HUNDRED)

function safeInt(v, what) {
  if (typeof v === 'bigint') return Number(v)
  if (typeof v !== 'number' || !Number.isSafeInteger(v)) {
    throw new TermPricingError('NOT_AN_INTEGER', `${what} must be a whole number`)
  }
  return v
}

// ── Volume bands: the rules a set must meet (spec 3.2, v1.8) ─────────────
//
// ONE FUNCTION FOR THE EDITOR AND THE SERVER (TB-6). The editor runs it as an
// admin types; normaliseParams runs it for every product, so the route's 400
// carries the sentence the editor showed. It never throws: it reports EVERY
// broken rule, one line each, in band order, each naming the fix.
//
// 2 and 6 are rulings (TB-2), not pricing parameters, so they are constants
// here rather than settings.

const MIN_BANDS = 2
const MAX_BANDS = 6

/** A start as a whole number of units, or null. The editor may send text. */
function wholeStart(v) {
  if (typeof v === 'number') return Number.isSafeInteger(v) && v >= 0 ? v : null
  if (typeof v === 'string' && /^\d+$/.test(v.trim())) {
    const n = Number(v.trim())
    return Number.isSafeInteger(n) ? n : null
  }
  return null
}

/** "10" -> "10.0", "7.5" -> "7.5": a discount as the 3.2 messages print it. */
function oneDecimal(text) {
  const [whole, part = ''] = text.split('.')
  return `${BigInt(whole)}.${(part + '0')[0]}`
}

/**
 * validateBands(bands) -> { ok, problems: [{ band, field, message }], rows, bands }
 *
 * `rows` is one entry per band as typed: { band, from, to }, where `to` is the
 * next band's start less 1, null for the last band ("and above"), and "?"
 * while the next band's start is invalid (3.2). `bands` is the set in its
 * stored shape ({ from: number, discountPct: string }) when ok, else null.
 */
export function validateBands(bands) {
  const list = Array.isArray(bands) ? bands : []
  const problems = []
  const say = (band, field, message) => problems.push({ band, field, message })
  if (list.length < MIN_BANDS) say(null, 'count', `A product needs at least ${MIN_BANDS} bands. Add a band to save.`)
  if (list.length > MAX_BANDS) say(null, 'count', `A product can have at most ${MAX_BANDS} bands. Remove a band to save.`)

  const starts = []
  const texts = []
  let lastStart = null
  let lastDiscount = null
  list.forEach((b, i) => {
    const n = i + 1
    const from = wholeStart(b?.from)
    let startOk = false
    if (i === 0) {
      if (from === 1) startOk = true
      else say(n, 'from', 'Band 1 always starts at 1. Fix this to save.')
    } else if (from === null) {
      say(n, 'from', `Band ${n} must start at a whole number of units. Fix this to save.`)
    } else if (lastStart && from <= lastStart.from) {
      say(n, 'from', `Band ${n} must start above ${lastStart.from}, where band ${lastStart.band} starts. Bands cannot overlap. Fix this to save.`)
    } else {
      startOk = true
    }
    if (startOk) lastStart = { band: n, from }
    starts.push(startOk ? from : null)

    const raw = b?.discountPct
    const text = typeof raw === 'number' ? String(raw) : typeof raw === 'string' ? raw.trim() : ''
    texts.push(text)
    if (/^\d+(\.\d+)?$/.test(text) && cmp(parseDecimal(text), HUNDRED) >= 0) {
      say(n, 'discountPct', `Band ${n}'s discount must be below 100%. Fix this to save.`)
    } else if (!/^\d+(\.\d)?$/.test(text)) {
      say(n, 'discountPct', `Band ${n}'s discount must be a number from 0 to below 100, with at most one decimal place. Fix this to save.`)
    } else {
      const value = parseDecimal(text)
      if (lastDiscount && cmp(value, lastDiscount.value) < 0) {
        say(n, 'discountPct', `Band ${n}'s discount must be at least ${oneDecimal(lastDiscount.text)}%, band ${lastDiscount.band}'s. Discounts never fall as volume rises. Fix this to save.`)
      } else {
        lastDiscount = { band: n, value, text }
      }
    }
  })

  const rows = list.map((b, i) => {
    const from = wholeStart(b?.from) ?? b?.from
    if (i + 1 >= list.length) return { band: i + 1, from, to: null }
    return { band: i + 1, from, to: starts[i + 1] === null ? '?' : starts[i + 1] - 1 }
  })
  const ok = problems.length === 0
  return { ok, problems, rows, bands: ok ? list.map((_, i) => ({ from: starts[i], discountPct: texts[i] })) : null }
}

// ── The price ladder: the rules a set must meet (spec 3.3, v2.0) ─────────
//
// TP_LADDER A1 (John, 2026-11-17): THE FORMULA IS REMOVED. Every product
// prices from its price ladder, the LIST price per unit per month at each
// term. ONE FUNCTION FOR THE EDITOR AND THE SERVER (L-5, as TB-6 for bands):
// the editor runs it as an admin types, the route runs it before writing, so
// the 400 carries the sentence the editor showed. It never throws.
//
// Refused: a term in TERMS with no price, a price that is not above 0 to the
// cent, and a price for a term NOT in TERMS (a stray term is a typo; Phase 0
// P3, revisitable). Commas are allowed as typed ("2,500.00").

const LADDER_PRICE = /^\d+(\.\d{1,2})?$/

/** A price as typed or stored to its plain text ("2500.00"), or null. */
function ladderPriceText(v) {
  const s = typeof v === 'number' ? String(v) : typeof v === 'string' ? v.replace(/,/g, '').trim() : ''
  return LADDER_PRICE.test(s) && cmp(parseDecimal(s), ZERO) > 0 ? s : null
}

/** "2500" -> "2500.00", "7.5" -> "7.50": the stored shape, two decimals. */
const twoDp = (s) => {
  const [whole, part = ''] = s.split('.')
  return `${BigInt(whole)}.${(part + '00').slice(0, 2)}`
}

/**
 * validateLadder(prices, terms) -> { ok, problems: [{ termMonths, message }], ladder }
 *
 * `prices` maps a term to a price as typed or stored. `ladder` is the set in
 * its stored shape ({ "12": "2500.00", ... }, every term in TERMS) when ok,
 * else null. Problems are in term order, strays last.
 */
export function validateLadder(prices, terms) {
  const given = prices && typeof prices === 'object' && !Array.isArray(prices) ? prices : {}
  const list = Array.isArray(terms) ? terms : []
  const problems = []
  const ladder = {}
  for (const T of list) {
    const raw = given[T] ?? given[String(T)]
    const blankRaw = raw == null || (typeof raw === 'string' && raw.trim() === '')
    const s = blankRaw ? null : ladderPriceText(raw)
    if (blankRaw) problems.push({ termMonths: T, message: `Enter a price for ${T} months. Every offered term needs one. Fix this to save.` })
    else if (s === null) problems.push({ termMonths: T, message: `The ${T}-month price must be above 0, to the cent, for example 1080.00. Fix this to save.` })
    else ladder[String(T)] = twoDp(s)
  }
  for (const k of Object.keys(given)) {
    if (!list.includes(Number(k)) || !/^\d+$/.test(k)) {
      problems.push({ termMonths: /^\d+$/.test(k) ? Number(k) : k, message: `${k} months is not an offered term. Remove its price, or add the term to TERMS first. Fix this to save.` })
    }
  }
  const ok = problems.length === 0
  return { ok, problems, ladder: ok ? ladder : null }
}

/** A validated set, in the stored shape, to the engine's bands with "To" derived. */
function engineBands(stored, product) {
  return stored.map((b, i, a) => ({
    from: b.from,
    to: i + 1 < a.length ? a[i + 1].from - 1 : null,
    discount: pctToRatio(b.discountPct, `VOLUME_BANDS_BY_PRODUCT[${product}][${i}].discountPct`),
    discountPct: b.discountPct,
  }))
}

// ── Parameters (spec section 3) ──────────────────────────────────────────

/**
 * Validates and converts the admin parameters and catalog costs.
 *
 * params = {
 *   TERMS: [12, 24, ...], COMPARE_TERM: 36,
 *   PRICE_LADDER_BY_PRODUCT: { safesight: { '12': '2500.00', '24': '1500.00', ... }, ... },
 *   VOLUME_BANDS_BY_PRODUCT: { safesight: [{ from: 1, discountPct: '0' }, { from: 10, discountPct: '5' }, ...], ... },
 *   HW_UPFRONT_MARGIN: '20', MARGIN_FLOOR: '25', CURRENCY: 'USD',
 *   costs: { safesight: { hwCost: '8000.00', hostingMonthly: '200.00' }, ... },
 * }
 *
 * v2.0 (TP_LADDER A1, Q1): SUPERSEDED, left visible: v1.x took ANCHOR_TERM,
 * ANCHOR_MARGIN, SHORT_TERM_MARGIN and PROFIT_STEP and derived every price from
 * them (section 4.1's formula). They are gone. COMPARE_TERM replaces
 * ANCHOR_TERM and DERIVES NO PRICE: it only sets the "vs N months" column.
 * A product with no price ladder, or no price at a term, prices nothing
 * (amended L-8); a stored price that is not above 0 to the cent is refused,
 * but a missing or stray term is not, because TERMS can change after a save.
 */
export function normaliseParams(params) {
  if (!params || typeof params !== 'object') throw new TermPricingError('NO_PARAMS', 'parameters are required')
  const terms = (params.TERMS ?? []).map((t) => safeInt(t, 'TERMS entry'))
  if (!terms.length) throw new TermPricingError('BAD_PARAM', 'TERMS must list at least one term')
  for (let i = 0; i < terms.length; i++) {
    if (terms[i] < 1) throw new TermPricingError('BAD_PARAM', 'every term must be at least 1 month')
    if (i && terms[i] <= terms[i - 1]) throw new TermPricingError('BAD_PARAM', 'TERMS must be strictly ascending')
  }
  const compareTerm = safeInt(params.COMPARE_TERM, 'COMPARE_TERM')
  if (!terms.includes(compareTerm)) throw new TermPricingError('BAD_PARAM', 'COMPARE_TERM must be one of TERMS')

  const priceLadder = {}
  for (const [k, ladder] of Object.entries(params.PRICE_LADDER_BY_PRODUCT ?? {})) {
    if (!ladder || typeof ladder !== 'object' || Array.isArray(ladder)) {
      throw new TermPricingError('BAD_PARAM', `PRICE_LADDER_BY_PRODUCT[${k}] must map terms to prices`)
    }
    const out = {}
    for (const [t, v] of Object.entries(ladder)) {
      if (!/^\d+$/.test(t)) throw new TermPricingError('BAD_PARAM', `PRICE_LADDER_BY_PRODUCT[${k}] has a term that is not a whole number: ${t}`)
      const s = ladderPriceText(v)
      if (s === null) throw new TermPricingError('BAD_PARAM', `PRICE_LADDER_BY_PRODUCT[${k}][${t}] must be a price above 0, to the cent`)
      out[Number(t)] = parseDecimal(s)
    }
    priceLadder[k] = out
  }

  // v1.8 (TP_BANDS, TB-1): bands are PER PRODUCT. Each product's list is held
  // to the 3.2 rules by the same validator the editor runs, so the server
  // refuses with the editor's sentence (TB-6). SUPERSEDED, left visible: v1.7
  // read one list, VOLUME_BANDS, for every product, checked only that it began
  // at 1 and ascended.
  const bandsByProduct = {}
  for (const [k, list] of Object.entries(params.VOLUME_BANDS_BY_PRODUCT ?? {})) {
    const v = validateBands(list)
    if (!v.ok) throw Object.assign(new TermPricingError('BAD_PARAM', v.problems[0].message), { product: k, problems: v.problems })
    bandsByProduct[k] = engineBands(v.bands, k)
  }

  const costs = {}
  for (const [k, c] of Object.entries(params.costs ?? {})) {
    costs[k] = {
      hw: parseDecimal(c.hwCost, `HW_COST[${k}]`),
      hosting: parseDecimal(c.hostingMonthly, `HOSTING_MONTHLY[${k}]`),
    }
  }

  const hwUpfront = pctToRatio(params.HW_UPFRONT_MARGIN, 'HW_UPFRONT_MARGIN')
  if (cmp(hwUpfront, ONE) >= 0) throw new TermPricingError('BAD_PARAM', 'HW_UPFRONT_MARGIN must be below 100%')

  return {
    terms,
    compareTerm,
    priceLadder,
    bandsByProduct,
    hwUpfrontMargin: hwUpfront,
    marginFloor: pctToRatio(params.MARGIN_FLOOR, 'MARGIN_FLOOR'),
    currency: params.CURRENCY,
    costs,
  }
}

const isNormalised = (p) => p && Array.isArray(p.terms) && p.bandsByProduct && typeof p.bandsByProduct === 'object' && p.priceLadder && typeof p.priceLadder === 'object'
const norm = (p) => (isNormalised(p) ? p : normaliseParams(p))

/**
 * "a" or "an" before a number as it is SAID (A3, John 2026-10-01): "an 18",
 * "an 8", "an 11", "an 80", "a 12". The sound is set by the leading group of
 * three digits: eight..., eleven and eighteen take "an"; everything else "a".
 */
export function articleFor(n) {
  const digits = String(n)
  const lead = Number(digits.slice(0, ((digits.length - 1) % 3) + 1))
  return digits.startsWith('8') || lead === 11 || lead === 18 ? 'an' : 'a'
}

function requireTerm(p, T) {
  if (!p.terms.includes(T)) {
    const a = articleFor(T)
    throw new TermPricingError('TERM_NOT_OFFERED',
      `${a[0].toUpperCase()}${a.slice(1)} ${T}-month term is not offered. Choose one of: ${p.terms.join(', ')} months.`)
  }
}

function productParams(p, product) {
  const cost = p.costs[product]
  if (!cost) throw new TermPricingError('NO_COST', `No catalog cost for ${product}`)
  // v1.8 (TB-1): the product's own bands. A product with none is refused
  // rather than borrowing another product's.
  const bands = p.bandsByProduct[product]
  if (!bands) throw new TermPricingError('NO_PARAM', `No volume bands for ${product}`)
  return { cost, bands }
}

// ── Section 4.1 (v2.0): the list fee per unit is the price ladder's ──────
//
// SUPERSEDED, left visible: v1.x computed it here from ANCHOR_MARGIN,
// SHORT_TERM_MARGIN and PROFIT_STEP (priceAt). TP_LADDER A1 removed that
// formula; the list fee is now READ, never derived, and an absent one is not
// substituted (amended L-8, R-CF4's principle): the error names what is
// missing, and termLadder turns it into a row that prices nothing.

const costAt = (c, T) => add(c.hw, mul(c.hosting, fromInt(T)))

export const NO_LADDER_CODES = Object.freeze(['NO_PRICE_LADDER', 'NO_PRICE_LADDER_PRICE'])

function listFeeAt(p, product, T) {
  const ladder = p.priceLadder[product]
  if (!ladder) {
    throw Object.assign(new TermPricingError('NO_PRICE_LADDER', `No price ladder for ${product}`), { product, termMonths: null })
  }
  const price = ladder[T]
  if (!price) {
    throw Object.assign(new TermPricingError('NO_PRICE_LADDER_PRICE', `No price ladder price for ${T} months`), { product, termMonths: T })
  }
  return price
}

/** The list fee at the compare term, or null when it has no price. */
const compareFeeOf = (p, product) => p.priceLadder[product]?.[p.compareTerm] ?? null

// ── Section 4.2: band fees, rounded to cents FIRST ───────────────────────

const bandFeeCents = (listFee, band) => roundHalfUp(mul(listFee, sub(ONE, band.discount)), 2)

function splitIntoBands(bands, units) {
  return bands.map((b) => {
    const top = b.to === null ? units : Math.min(units, b.to)
    return { band: b, units: Math.max(0, top - b.from + 1) }
  })
}

/**
 * Per-unit economics of one product at one term, one entry per volume band:
 * every unit at that band's fee. Spec tables 10.1, 10.2 and 10.3.
 */
export function unitEconomics(product, termMonths, params) {
  const p = norm(params)
  const T = safeInt(termMonths, 'term_months')
  requireTerm(p, T)
  const { cost, bands } = productParams(p, product)
  const listFee = listFeeAt(p, product, T)
  const costCents = roundHalfUp(costAt(cost, T), 2)
  const compareFee = compareFeeOf(p, product)
  return {
    product,
    termMonths: T,
    listFee,
    priceSource: 'ladder',
    costCents,
    savingVsCompare: compareFee ? sub(ONE, div(listFee, compareFee)) : null,
    bands: bands.map((b) => {
      const feeCents = bandFeeCents(listFee, b)
      const tcvCents = feeCents * BigInt(T)
      const profitCents = tcvCents - costCents
      return {
        from: b.from, to: b.to, discountPct: b.discountPct,
        feeCents, tcvCents, profitCents,
        margin: tcvCents === 0n ? ZERO : frac(profitCents, tcvCents),
      }
    }),
  }
}

// ── The margin check (spec 10.4, v1.8, TB-7) ─────────────────────────────

// The fee table's terms, as ruled (TB-7). A term an admin has removed from
// TERMS is not shown.
const FEE_TABLE_TERMS = [36, 60, 84, 120]

/**
 * bandMarginGrid(product, bands, params, prices?): the margin check for one
 * product on the bands AS TYPED and, when `prices` is given, on the price
 * ladder AS TYPED (the price ladder editor, A6); otherwise the saved one.
 * Every band at every term in TERMS, each cell the 10.3 worst case (every unit
 * at that band's fee).
 *
 * v2.0 (TP_LADDER A6, L-7): THREE CHECKS, ON EVERY CELL, in the order floor,
 * client total, profit. The floor is an EXACT comparison with MARGIN_FLOOR;
 * client total and profit compare each cell with the same band's previous
 * term WITH a price; equal is not a fall. SUPERSEDED, left visible: v1.8
 * flagged the floor only, and Phase 0's 74-case PROFIT_STEP finding is moot
 * because the formula is gone. A warning never refuses.
 *
 * A term with no price (blank or invalid as typed, or missing from the saved
 * ladder) is a cell with `priced: false` and no figures; it is skipped by the
 * checks, which then compare across it.
 *
 * -> { ok: true, floor, terms, feeTerms, compareTerm, rows: [{ band, from, to, discountPct,
 *        cells: [{ termMonths, priced, feeCents?, tcvCents?, costCents?, profitCents?, margin?,
 *                  belowFloor?, flags?: [{ kind, against?, message }] }] }],
 *      breaches: [{ band, termMonths, feeCents, margin }],
 *      checks: { floor, total, profit: { ok, cells: [{ band, termMonths }] } },
 *      unpriced: [termMonths] }
 * -> { ok: false, problems } while the bands break a 3.2 rule: no figures.
 */
export function bandMarginGrid(product, bands, params, prices) {
  const v = validateBands(bands)
  if (!v.ok) return { ok: false, problems: v.problems }
  const base = norm(params)
  let ladder = base.priceLadder[product]
  if (prices !== undefined) {
    ladder = {}
    for (const T of base.terms) {
      const s = ladderPriceText(prices?.[T] ?? prices?.[String(T)])
      if (s !== null) ladder[T] = parseDecimal(s)
    }
  }
  const p = {
    ...base,
    bandsByProduct: { ...base.bandsByProduct, [product]: engineBands(v.bands, product) },
    priceLadder: { ...base.priceLadder, [product]: ladder ?? {} },
  }
  const rows = p.bandsByProduct[product].map((b, i) => ({
    band: i + 1, from: b.from, to: b.to, discountPct: b.discountPct, cells: [],
  }))
  const unpriced = []
  for (const T of p.terms) {
    if (!p.priceLadder[product][T]) {
      unpriced.push(T)
      rows.forEach((r) => r.cells.push({ termMonths: T, priced: false }))
      continue
    }
    const u = unitEconomics(product, T, p)
    u.bands.forEach((b, i) => {
      rows[i].cells.push({
        termMonths: T, priced: true, feeCents: b.feeCents, tcvCents: b.tcvCents, costCents: u.costCents,
        profitCents: b.profitCents, margin: b.margin, belowFloor: cmp(b.margin, p.marginFloor) < 0, flags: [],
      })
    })
  }
  // The editor's "vs N months" column (frame C), on the price as typed: each
  // cell's fee against the SAME band's fee at COMPARE_TERM; null when that term
  // has no price. Here so the screen does no arithmetic on money.
  for (const r of rows) {
    const cmpCell = r.cells.find((c) => c.termMonths === p.compareTerm && c.priced)
    for (const c of r.cells) if (c.priced) c.vsCompare = cmpCell ? frac(c.feeCents - cmpCell.feeCents, cmpCell.feeCents) : null
  }
  const checks = { floor: [], total: [], profit: [] }
  for (const r of rows) {
    let prev = null
    for (const c of r.cells) {
      if (!c.priced) continue
      if (c.belowFloor) { c.flags.push({ kind: 'floor', message: 'Below the floor' }); checks.floor.push({ band: r.band, termMonths: c.termMonths }) }
      if (prev && c.tcvCents < prev.tcvCents) {
        c.flags.push({ kind: 'total', against: prev.termMonths, message: `Client total below ${prev.termMonths} months` })
        checks.total.push({ band: r.band, termMonths: c.termMonths })
      }
      if (prev && c.profitCents < prev.profitCents) {
        c.flags.push({ kind: 'profit', against: prev.termMonths, message: `Profit below ${prev.termMonths} months` })
        checks.profit.push({ band: r.band, termMonths: c.termMonths })
      }
      prev = c
    }
  }
  const breaches = rows.flatMap((r) => r.cells.filter((c) => c.belowFloor)
    .map((c) => ({ band: r.band, termMonths: c.termMonths, feeCents: c.feeCents, margin: c.margin })))
  const summary = (list) => ({ ok: list.length === 0, cells: list })
  return {
    ok: true, floor: p.marginFloor, terms: p.terms, compareTerm: p.compareTerm,
    feeTerms: FEE_TABLE_TERMS.filter((t) => p.terms.includes(t)),
    rows, breaches, unpriced,
    checks: { floor: summary(checks.floor), total: summary(checks.total), profit: summary(checks.profit) },
  }
}

// ── Section 9.2: the loan schedule (v1.10, TERM_FACTORING) ───────────────
//
// Commercials' arithmetic (deal-calculator `buildLoanSchedule`), RE-IMPLEMENTED
// here in exact fractions, because R-TP1 forbids importing it and Architecture
// 14 forbids its floats (R-TF9). Interest is charged on the balance BEFORE the
// month's repayment; declining balance is a level annuity payment whose last
// month clears the balance, exactly as Commercials.
//
// The schedule is held exactly. Each month's interest is rounded half-up to
// cents on its own, and so is each month's principal, the LAST month carrying
// the remainder so the principal repaid is the advance to the cent (spec 9.2,
// C-7). The factoring cost F is the sum of the interest cents, which is what
// the facility charges. scripts/tests/term-factoring-parity.test.mjs holds
// this to Commercials' own schedule, month by month, both methods.

const MONEY_2DP = /^\d+(\.\d{1,2})?$/
const blank = (v) => v == null || (typeof v === 'string' && v.trim() === '')

/**
 * loanSchedule(advanceCents, ratePct, termMonths, method)
 *   advanceCents  BigInt cents, at least 0
 *   ratePct       decimal string, percent PER MONTH, 0 up to but not including 100
 *   termMonths    whole number, at least 1
 *   method        'straight' | 'declining'
 * -> { advanceCents, ratePct, termMonths, method, interestCents,
 *      months: [{ i, principalCents, interestCents, principalExact, interestExact }] }
 * `i` is the repayment's position, 1 to n; the cash flow places it in month
 * (drawn month + i). The exact fractions are exposed for the parity test.
 */
export function loanSchedule(advanceCents, ratePct, termMonths, method = 'straight') {
  const n = safeInt(termMonths, 'factoring term')
  if (n < 1) throw new TermPricingError('FACTORING_TERM', 'The factoring term must be at least 1 month.')
  if (method !== 'straight' && method !== 'declining') {
    throw new TermPricingError('FACTORING_METHOD', 'Repayment is Straight-line or Declining balance.')
  }
  const r = pctToRatio(ratePct, 'factoring rate')
  if (cmp(r, ZERO) < 0 || cmp(r, ONE) >= 0) {
    throw new TermPricingError('FACTORING_RATE', 'The factoring rate must be at least 0% and below 100% per month.')
  }
  const cents = typeof advanceCents === 'bigint' ? advanceCents : BigInt(safeInt(advanceCents, 'advance'))
  if (cents < 0n) throw new TermPricingError('FACTORING_ADVANCE', 'The advance cannot be negative.')
  const A = fromCents(cents)
  const exact = []
  let balance = A
  if (method === 'declining') {
    // A × r / (1 − (1 + r)^−n), written as A × r × g / (g − 1) with g = (1 + r)^n
    // so the power stays a whole exponent; A / n when there is no interest.
    const g = pow(add(ONE, r), n)
    const payment = cmp(r, ZERO) === 0 ? div(A, fromInt(n)) : div(mul(mul(A, r), g), sub(g, ONE))
    for (let i = 0; i < n; i++) {
      const interest = mul(balance, r)
      let principal = sub(payment, interest)
      if (i === n - 1 || cmp(principal, balance) > 0) principal = balance
      balance = sub(balance, principal)
      exact.push([principal, interest])
    }
  } else {
    const principal = div(A, fromInt(n))
    for (let i = 0; i < n; i++) {
      exact.push([principal, mul(balance, r)])
      balance = sub(balance, principal)
    }
  }
  let repaid = 0n
  const months = exact.map(([principal, interest], i) => {
    const principalCents = i < n - 1 ? roundHalfUp(principal, 2) : cents - repaid
    repaid += principalCents
    return { i: i + 1, principalCents, interestCents: roundHalfUp(interest, 2), principalExact: principal, interestExact: interest }
  })
  return {
    advanceCents: cents, ratePct, termMonths: n, method,
    interestCents: months.reduce((s, x) => s + x.interestCents, 0n),
    months,
  }
}

/** A money amount as typed: from 0, at most 2 decimals, to BigInt cents. */
function moneyCents(v, code, message) {
  const s = typeof v === 'string' ? v.trim() : ''
  if (!MONEY_2DP.test(s)) throw new TermPricingError(code, message)
  return roundHalfUp(parseDecimal(s), 2)
}

/**
 * Section 2 and 9.2 (v1.10): the factoring inputs, refused where blank or out
 * of range rather than given a value nobody entered (Phase 1 ruling 6,
 * Architecture 11). Null when factoring is off, which is what keeps every
 * v1.9 figure unchanged (FA-8).
 *
 * raw = { enabled, ratePct, termMonths, method, treatment,
 *         advance (money string; blank = the hardware cost),
 *         advanceSchedule ([{ month, amount }], engine level, R-TF12) }
 */
function factoringPlan(raw, T, hardwareCostCents) {
  if (raw == null) return null
  if (typeof raw !== 'object') throw new TermPricingError('BAD_FACTORING', 'factoring must be an object')
  if (raw.enabled !== true && raw.enabled !== false && raw.enabled !== undefined) {
    throw new TermPricingError('BAD_FACTORING', 'factoring.enabled must be true or false')
  }
  if (raw.enabled !== true) return null

  if (blank(raw.ratePct)) throw new TermPricingError('FACTORING_RATE', 'Enter the factoring rate, % per month. A blank rate is not 0.')
  if (typeof raw.ratePct !== 'string' || !/^\d+(\.\d+)?$/.test(raw.ratePct.trim())) {
    throw new TermPricingError('FACTORING_RATE', 'Enter the factoring rate as a percentage per month, for example 1.5.')
  }
  if (blank(raw.termMonths)) throw new TermPricingError('FACTORING_TERM', 'Enter the factoring term in months.')
  const n = raw.termMonths
  if (typeof n !== 'number' || !Number.isSafeInteger(n) || n < 1 || n > T - 1) {
    throw new TermPricingError('FACTORING_TERM',
      `The factoring term must be a whole number of months from 1 to ${T - 1}, so every repayment falls inside the ${T}-month contract.`)
  }
  const method = raw.method ?? 'straight'
  if (method !== 'straight' && method !== 'declining') {
    throw new TermPricingError('FACTORING_METHOD', 'Repayment is Straight-line or Declining balance.')
  }
  const treatment = raw.treatment ?? 'absorb'
  if (treatment !== 'absorb' && treatment !== 'pass_through') {
    throw new TermPricingError('FACTORING_TREATMENT', 'The factoring cost is Absorbed or Passed through.')
  }

  // R-TF12: the advance is a SCHEDULE, one entry today. The screen gives one
  // amount (or none, meaning the hardware cost); a schedule is engine level.
  const advanceMessage = 'Enter the advance in USD from 0, with at most two decimals, for example 960000.00.'
  let entries
  if (raw.advanceSchedule != null) {
    if (!blank(raw.advance)) throw new TermPricingError('FACTORING_ADVANCE', 'Give the advance or an advance schedule, not both.')
    if (!Array.isArray(raw.advanceSchedule) || raw.advanceSchedule.length < 1) {
      throw new TermPricingError('FACTORING_SCHEDULE', 'An advance schedule has at least one entry.')
    }
    entries = raw.advanceSchedule.map((e) => ({ month: e?.month, cents: moneyCents(e?.amount, 'FACTORING_ADVANCE', advanceMessage) }))
  } else {
    entries = [{ month: 1, cents: blank(raw.advance) ? hardwareCostCents : moneyCents(raw.advance, 'FACTORING_ADVANCE', advanceMessage) }]
  }
  const facilities = entries.map((e) => {
    const d = e.month
    if (typeof d !== 'number' || !Number.isSafeInteger(d) || d < 1 || d + n > T) {
      throw new TermPricingError('FACTORING_SCHEDULE',
        `An advance in month ${d} repaid over ${n} months would run past month ${T}. Draw it from month 1 to ${T - n}.`)
    }
    return { month: d, advanceCents: e.cents, loan: loanSchedule(e.cents, raw.ratePct.trim(), n, method) }
  })
  const advanceCents = facilities.reduce((s, f) => s + f.advanceCents, 0n)
  return {
    treatment, method, ratePct: raw.ratePct.trim(), termMonths: n,
    facilities, advanceCents,
    costCents: facilities.reduce((s, f) => s + f.loan.interestCents, 0n),
    advanceAboveHardwareCost: advanceCents > hardwareCostCents,
  }
}

/**
 * Vendor payments (spec 9.5, R-TF12): a schedule, one entry today, month 1,
 * the hardware cost. Engine level: the screen shows one amount.
 */
function vendorPlan(raw, T, hardwareCostCents) {
  if (raw == null) return [{ month: 1, cents: hardwareCostCents }]
  if (!Array.isArray(raw) || raw.length < 1) throw new TermPricingError('VENDOR_SCHEDULE', 'A vendor payment schedule has at least one entry.')
  return raw.map((e) => {
    if (typeof e?.month !== 'number' || !Number.isSafeInteger(e.month) || e.month < 0 || e.month > T) {
      throw new TermPricingError('VENDOR_SCHEDULE', `A vendor payment month must be a whole number from 0 to ${T}.`)
    }
    return { month: e.month, cents: moneyCents(e.amount, 'VENDOR_SCHEDULE', 'A vendor payment is an amount in USD from 0, with at most two decimals.') }
  })
}

// ── The quote: sections 4.3, 4.4, 6, 7, 8, 9 ────────────────────────────────

/**
 * input = {
 *   units: { safesight: 120, ... },     integers >= 0, at least one >= 1
 *   termMonths: 60,                     one of TERMS
 *   paymentStructure: 'opex' | 'capex',
 *   cpiMode: 'none' | 'published' | 'locked',   v1.6 (C-3): default none; a rate with no mode is refused
 *   escalatorPct: '3' | null,           the CPI rate; blank or 0 means none; ignored under none
 *   escalatorStartYear: 2,              v1.3 (B6): the year it first applies, >= 2, default 2
 *   gstPct: '9', whtPct: '10', whtGrossUp: true,
 *   whtSplit: false,                    v1.3 (B4): on, whtHwPct and whtSaasPct replace whtPct
 *   whtHwPct: '5', whtSaasPct: '10',
 *   v1.6 (C-4, C-6), capex only:
 *   capexAmount: 'hardware' | 'custom', capexCustom: '1000000.00',
 *   capexStructure: 'hybrid' | 'two_phase',
 *   milestones: [{ key, month, sharePct }],   key is an OPAQUE token (Q4): never a name to this file
 *   recoveryMonths: 12,
 * }
 *
 * v1.6 (C-1, C-2, Q5): TWO SCHEDULES. `tcvNetCents` is BASE TCV (no CPI) and
 * carries approval: margin, the floor, the per-product totals, and the margin
 * after WHT (on the Base schedule's WHT). `schedule` and `tax` are the FINAL
 * schedule, what the client is invoiced; `base` holds the Base schedule. With
 * no CPI the two are the same schedule.
 */
export function priceQuote(input, params) {
  return quoteCore(input, params, false)
}

/**
 * v1.7 section 6.2 (T-4): the milestone allocation preview, beside the quote.
 * Same input as priceQuote, under `capex` only. While a Hybrid schedule's
 * shares are still being entered it reports each row's amount, what is
 * allocated and what is not, the subscription, and the Base breakdown with a
 * "not yet scheduled" amount, so the breakdown ties to Base TCV to the cent.
 * Once complete it IS the quote: `quote` is priceQuote's own result and the
 * amounts are its own, so every v1.6 refusal holds by construction (one
 * computation path, Architecture rule 3).
 *
 * Returns { status: 'complete' | 'incomplete' | 'over', baseTcvCents,
 *   capexCents, amountMode, structure, hardwareValueCents, hardwareCostCents,
 *   rows: [{ key, month, cents | null }], allocated: { share, cents },
 *   unallocated: { share, cents }, excess: { share, cents } | null,
 *   baseFeeCents, lastBaseFeeCents, warnings,
 *   breakdown: [{ fromMonth, toMonth, keys, capexCents, subscriptionCents, netCents }] | null,
 *   unscheduledCents, quote | null }
 */
export function capexAllocation(input, params) {
  if ((input?.paymentStructure ?? 'opex') !== 'capex') {
    throw new TermPricingError('NOT_CAPEX', 'The allocation preview is for a CAPEX payment basis.')
  }
  return quoteCore(input, params, true)
}

// ── v2.0 section 4.7: the deal adjustment (TP_LADDER A4) ─────────────────
//
// Either-or (R-O7): a deal discount %, or a deal fee per month typed at a
// term. Order: list, then volume band, then the deal discount, applied at
// DEAL level to the year-1 banded monthly total, so a typed fee is kept to the
// cent (a per-band discount would round each unit's fee and drift by up to a
// cent a unit). The discount is the of-record value: a fee typed at T0
// becomes the exact ratio 1 - fee / banded(T0), and every other term applies
// that ratio, so switching term keeps the discount. 0 to 99.9%; a fee above
// list is refused (no premiums this round). Screen-only: nothing is stored.

const DEAL_PCT = /^\d+(\.\d)?$/
const MAX_DEAL_DISCOUNT = frac(999n, 1000n)

/** The year-1 banded monthly total of these units at T, from the price ladder. */
function bandedMonthlyCents(p, entries, T) {
  let total = 0n
  for (const [product, units] of entries) {
    if (units < 1) continue
    const { bands } = productParams(p, product)
    const listFee = listFeeAt(p, product, T)
    for (const { band, units: bu } of splitIntoBands(bands, units)) if (bu > 0) total += BigInt(bu) * bandFeeCents(listFee, band)
  }
  return total
}

/**
 * -> null (no adjustment) or { mode: 'discount' | 'fee', ratio, atTerm }
 * `ratio` is the EXACT discount, so a fee typed at `atTerm` prices back to
 * itself there to the cent.
 */
function dealAdjustmentOf(raw, p, entries) {
  if (raw == null) return null
  if (typeof raw !== 'object') throw new TermPricingError('DEAL_ADJUSTMENT', 'The deal adjustment must be a discount or a deal fee.')
  const hasPct = !blank(raw.discountPct)
  const hasFee = !blank(raw.monthlyFee)
  if (hasPct && hasFee) throw new TermPricingError('DEAL_ADJUSTMENT', 'Give a deal discount or a deal fee, not both.')
  if (!hasPct && !hasFee) return null
  if (hasPct) {
    const s = typeof raw.discountPct === 'string' ? raw.discountPct.trim() : ''
    const message = 'Enter the deal discount as a percentage from 0 to 99.9, with at most one decimal place.'
    if (!DEAL_PCT.test(s)) throw new TermPricingError('DEAL_DISCOUNT', message)
    const ratio = div(parseDecimal(s), HUNDRED)
    if (cmp(ratio, MAX_DEAL_DISCOUNT) > 0) throw new TermPricingError('DEAL_DISCOUNT', message)
    return cmp(ratio, ZERO) === 0 ? null : { mode: 'discount', ratio, atTerm: null }
  }
  const atTerm = safeInt(raw.termMonths, 'the deal fee\'s term')
  requireTerm(p, atTerm)
  const s = typeof raw.monthlyFee === 'string' ? raw.monthlyFee.replace(/,/g, '').trim() : ''
  const feeCents = moneyCents(s, 'DEAL_FEE', 'Enter the deal fee per month in USD, to the cent, for example 1436.40.')
  const listCents = bandedMonthlyCents(p, entries, atTerm)
  if (feeCents > listCents) {
    throw new TermPricingError('DEAL_FEE_ABOVE_LIST',
      `A deal fee of ${formatMoney(feeCents)} a month is above the list fee of ${formatMoney(listCents)} at ${atTerm} months. A deal fee can be at or below list, not above it.`)
  }
  const ratio = sub(ONE, frac(feeCents, listCents))
  if (cmp(ratio, MAX_DEAL_DISCOUNT) > 0) {
    throw new TermPricingError('DEAL_FEE', `A deal fee of ${formatMoney(feeCents)} a month is more than 99.9% below the list fee of ${formatMoney(listCents)}.`)
  }
  return cmp(ratio, ZERO) === 0 ? null : { mode: 'fee', ratio, atTerm }
}

function quoteCore(input, params, preview) {
  const p = norm(params)
  const T = safeInt(input?.termMonths, 'term_months')
  requireTerm(p, T)

  const entries = Object.entries(input?.units ?? {}).map(([product, u]) => {
    const n = safeInt(u, `units[${product}]`)
    if (n < 0) throw new TermPricingError('BAD_UNITS', `units[${product}] cannot be negative`)
    return [product, n]
  })
  if (!entries.some(([, n]) => n >= 1)) {
    throw new TermPricingError('NO_UNITS', 'Enter at least one unit of at least one product.')
  }

  const structure = input.paymentStructure ?? 'opex'
  if (structure !== 'opex' && structure !== 'capex') {
    throw new TermPricingError('BAD_STRUCTURE', 'payment structure must be opex or capex')
  }

  // v1.6 section 7 (C-3): the escalator is the CPI, and it has a mode. A rate
  // with no mode is REFUSED rather than given one, so a caller written before
  // v1.6 cannot be quietly priced as Published or Locked. Under none the rate
  // is ignored: Final = Base.
  const rate = input.escalatorPct == null || input.escalatorPct === ''
    ? ZERO : pctToRatio(input.escalatorPct, 'escalator_pct')
  let cpiMode = input.cpiMode
  if (cpiMode == null) {
    if (cmp(rate, ZERO) !== 0) {
      throw new TermPricingError('CPI_MODE_REQUIRED', 'Choose how the CPI applies: Published CPI or Locked rate.')
    }
    cpiMode = 'none'
  }
  if (!['none', 'published', 'locked'].includes(cpiMode)) {
    throw new TermPricingError('BAD_CPI_MODE', 'The CPI mode must be None, Published CPI or Locked rate.')
  }
  const escalator = cpiMode === 'none' ? ZERO : rate
  const years = Math.ceil(T / 12)
  // v1.3 section 7 (B6): factor(k) = 1 before the start year S, then
  // (1 + e)^(k - S + 1). S = 2 is the v1.2 formula, (1 + e)^(k - 1). An S past
  // the term's last year is not refused: the ladder prices every term from the
  // same inputs, and for a shorter term the formula already gives no increase.
  const startYear = input.escalatorStartYear ?? 2
  if (typeof startYear !== 'number' || !Number.isSafeInteger(startYear) || startYear < 2) {
    throw new TermPricingError('BAD_ESCALATOR', 'The escalator start year must be a whole number, year 2 or later.')
  }
  const factor = (k) => (k < startYear ? ONE : pow(add(ONE, escalator), k - startYear + 1))
  const monthsInYear = (k) => Math.min(12, T - 12 * (k - 1))

  // Per line, per band: the year-1 fee, then each contract year's fee from it
  // (section 7: compounded from year 1 and rounded per band, never chained).
  const lines = entries.filter(([, n]) => n >= 1).map(([product, units]) => {
    const { cost, bands: productBands } = productParams(p, product)
    const listFee = listFeeAt(p, product, T)
    const costPerUnitCents = roundHalfUp(costAt(cost, T), 2)
    const bands = splitIntoBands(productBands, units).filter((x) => x.units > 0).map(({ band, units: bu }) => {
      const fee1 = bandFeeCents(listFee, band)
      const feeByYear = []
      for (let k = 1; k <= years; k++) feeByYear.push(roundHalfUp(mul(fromCents(fee1), factor(k)), 2))
      // v1.7 section 4.3, per band (C1): the band's own totals on Base, from
      // its year-1 invoiced fee, so the price breakdown does no arithmetic on
      // money. Display only: nothing else reads them, and they sum to the
      // product's figures exactly because both are built from the same cents.
      const monthlyCents = BigInt(bu) * fee1
      const tcvNetCents = monthlyCents * BigInt(T)
      const costCents = BigInt(bu) * costPerUnitCents
      return {
        from: band.from, to: band.to, discountPct: band.discountPct, units: bu, feeByYear,
        monthlyCents, tcvNetCents, costCents, grossProfitCents: tcvNetCents - costCents,
        grossMargin: tcvNetCents === 0n ? ZERO : frac(tcvNetCents - costCents, tcvNetCents),
      }
    })
    const monthlyByYear = []
    for (let k = 0; k < years; k++) monthlyByYear.push(bands.reduce((s, b) => s + BigInt(b.units) * b.feeByYear[k], 0n))
    // v1.4 section 4.3, per product: the line's own invoiced fees over the
    // term, its cost and its profit. Summed from the same cents as the deal,
    // so the products add to the deal exactly. No WHT here: WHT is withheld
    // per invoice and is never allocated to a product.
    //
    // v1.6 (C-1, Q5): ON BASE. Year-1 fees times T; no CPI uplift is ever
    // allocated to a product. SUPERSEDED, left visible: v1.4 summed the
    // escalated fee of each contract year here.
    const tcvNetCents = monthlyByYear[0] * BigInt(T)
    const costCents = BigInt(units) * costPerUnitCents
    const compareFee = compareFeeOf(p, product)
    return {
      product, units, listFee, priceSource: 'ladder',
      savingVsCompare: compareFee ? sub(ONE, div(listFee, compareFee)) : null,
      // v2.0 (A4): the line's banded year-1 monthly BEFORE the deal discount.
      listMonthlyCents: monthlyByYear[0],
      dealDiscountMonthlyCents: 0n,
      costPerUnitCents,
      hwCostPerUnit: cost.hw,
      bands, monthlyByYear,
      tcvNetCents, costCents, grossProfitCents: tcvNetCents - costCents,
      grossMargin: tcvNetCents === 0n ? ZERO : frac(tcvNetCents - costCents, tcvNetCents),
    }
  })

  // ── v2.0 (A4): the deal adjustment, on the banded lines, before factoring ──
  //
  // The discount comes off the year-1 banded monthly total and is allocated to
  // the lines by their banded monthly (the last line takes the remainder), so
  // the deal is still the exact sum of its lines. Each later contract year's
  // discount is the line's year-1 discount times that year's CPI factor,
  // rounded once. With no adjustment every amount here is 0n and no v1.x
  // figure moves. The band rows stay LIST figures.
  const listMonthlyCents = lines.reduce((s, l) => s + l.listMonthlyCents, 0n)
  const adj = dealAdjustmentOf(input.dealAdjustment, p, entries)
  let dealMonthlyCents = listMonthlyCents
  if (adj) {
    // A typed fee needs no branch of its own: the ratio is exactly
    // 1 - fee / list(T0), so at T0 this IS the fee, to the cent. A branch that
    // returned the typed fee there was written first and removed when its
    // calibration came back SILENT: removing it could change nothing.
    dealMonthlyCents = roundHalfUp(mul(fromCents(listMonthlyCents), sub(ONE, adj.ratio)), 2)
    const discountCents = listMonthlyCents - dealMonthlyCents
    let allocated = 0n
    lines.forEach((l, i) => {
      const share = i < lines.length - 1
        ? roundHalfUp(div(mul(fromCents(discountCents), fromCents(l.listMonthlyCents)), fromCents(listMonthlyCents)), 2)
        : discountCents - allocated
      allocated += share
      l.dealDiscountMonthlyCents = share
      l.monthlyByYear = l.monthlyByYear.map((c, k) => c - (k === 0 ? share : roundHalfUp(mul(fromCents(share), factor(k + 1)), 2)))
      l.tcvNetCents = l.monthlyByYear[0] * BigInt(T)
      l.grossProfitCents = l.tcvNetCents - l.costCents
      l.grossMargin = l.tcvNetCents === 0n ? ZERO : frac(l.grossProfitCents, l.tcvNetCents)
    })
  }
  const dealDiscount = {
    mode: adj?.mode ?? null,
    ratio: adj?.ratio ?? ZERO,
    atTerm: adj?.atTerm ?? null,
    listMonthlyCents,
    dealMonthlyCents,
    discountMonthlyCents: listMonthlyCents - dealMonthlyCents,
    listTcvCents: listMonthlyCents * BigInt(T),
    discountValueCents: (listMonthlyCents - dealMonthlyCents) * BigInt(T),
    // "Approval signal: N% below list" (A4): any discount off list.
    approvalSignal: !!adj,
  }

  // ── v1.10 (TERM_FACTORING): hardware and hosting cost, under BOTH bases ──
  //
  // Phase 1 item 1: these were computed only inside capexPlan, so OPEX had no
  // hardware total. They are the deal's now, computed once, and capexPlan
  // reads them (one path, Architecture 3). The deal figures are rounded ONCE
  // at deal level, exactly as capexPlan did, so CAPEX's warnings cannot move.
  for (const l of lines) {
    l.hardwareCostCents = roundHalfUp(mul(fromInt(l.units), l.hwCostPerUnit), 2)
    l.hostingMonthlyCents = roundHalfUp(mul(fromInt(l.units), p.costs[l.product].hosting), 2)
    l.factoringCostCents = 0n
    l.passThrough = null
  }
  const hardwareCostCents = roundHalfUp(lines.reduce((s, l) => add(s, mul(fromInt(l.units), l.hwCostPerUnit)), ZERO), 2)
  const hostingMonthlyCents = roundHalfUp(lines.reduce((s, l) => add(s, mul(fromInt(l.units), p.costs[l.product].hosting)), ZERO), 2)

  // ── v1.10 sections 9.2 to 9.4: PO factoring ──────────────────────────────
  //
  // Null when off, and then every amount below is 0n, so each addition is an
  // addition of zero and no v1.9 figure moves (FA-8, measured against the
  // captured baseline in term-pricing.test.mjs).
  //
  // Phase 1 ruling 1, THE SHAPE: the factoring cost is allocated to the
  // product LINES by hardware cost (by units if every hardware cost is 0), the
  // last line taking the remainder. It is a cost of the line under BOTH
  // treatments, so the line's profit shows it under Absorb (R-TF7). Under Pass
  // through it is also a price component BESIDE the line's bands: per unit per
  // month to the cent, remainder on the last invoice, never banded and never
  // escalated. The bands are untouched, and the deal is still the exact sum of
  // its lines.
  const fx = factoringPlan(input.factoring, T, hardwareCostCents)
  let ptMonthlyCents = 0n
  let ptLastExtraCents = 0n
  let ptTotalCents = 0n
  if (fx) {
    const hw = (l) => mul(fromInt(l.units), l.hwCostPerUnit)
    const byUnits = lines.every((l) => cmp(hw(l), ZERO) === 0)
    const weight = (l) => (byUnits ? fromInt(l.units) : hw(l))
    const totalWeight = lines.reduce((s, l) => add(s, weight(l)), ZERO)
    let allocated = 0n
    lines.forEach((l, i) => {
      const share = i < lines.length - 1
        ? roundHalfUp(div(mul(fromCents(fx.costCents), weight(l)), totalWeight), 2)
        : fx.costCents - allocated
      allocated += share
      l.factoringCostCents = share
      l.costCents += share
      if (fx.treatment === 'pass_through') {
        const unitMonths = BigInt(l.units) * BigInt(T)
        const perUnitMonthlyCents = roundHalfUp(div(fromCents(share), frac(unitMonths)), 2)
        const remainderCents = share - perUnitMonthlyCents * unitMonths
        l.passThrough = { totalCents: share, perUnitMonthlyCents, remainderCents }
        l.monthlyByYear = l.monthlyByYear.map((c) => c + BigInt(l.units) * perUnitMonthlyCents)
        l.tcvNetCents += share
        ptMonthlyCents += BigInt(l.units) * perUnitMonthlyCents
        ptLastExtraCents += remainderCents
        ptTotalCents += share
      }
      l.grossProfitCents = l.tcvNetCents - l.costCents
      l.grossMargin = l.tcvNetCents === 0n ? ZERO : frac(l.grossProfitCents, l.tcvNetCents)
    })
  }

  const monthlyTotalByYear = []
  for (let k = 0; k < years; k++) monthlyTotalByYear.push(lines.reduce((s, l) => s + l.monthlyByYear[k], 0n))

  // v1.6 (C-1): BASE TCV, the year-1 monthly total times T, in both
  // structures. It carries approval: the margin, the floor and the profit
  // table. The tie rule holds on it: the Base schedule's net invoices sum to
  // it exactly (checked below, and a break is refused, never shown).
  // SUPERSEDED, left visible: v1.5 summed each contract year's ESCALATED fee
  // here, so the margin rose with the escalator.
  const tcvNetCents = monthlyTotalByYear[0] * BigInt(T) + ptLastExtraCents

  // v1.10: the deal's cost is the sum of its lines' costs, which carry the
  // factoring cost under both treatments. So under Absorb the gross profit
  // and margin are AFTER finance (the floor reads it, Phase 1 ruling 2) and
  // under Pass through they are the unchanged profit over the higher price.
  // The before-finance figures are reported on `factoring` (spec 9.3).
  const totalCostCents = lines.reduce((s, l) => s + l.costCents, 0n)
  const grossProfitCents = tcvNetCents - totalCostCents
  const grossMargin = frac(grossProfitCents, tcvNetCents)

  // Section 8: the tax inputs. Every WHT rate is typed, 0 up to but not
  // including 100, blank 0 (v1.3, B3, B4).
  const gst = input.gstPct == null || input.gstPct === '' ? ZERO : pctToRatio(input.gstPct, 'gst_pct')
  const whtRate = (v, what) => {
    const r = v == null || v === '' ? ZERO : pctToRatio(v, what)
    if (cmp(r, ZERO) < 0 || cmp(r, ONE) >= 0) throw new TermPricingError('BAD_TAX', `${what} must be at least 0% and below 100%`)
    return r
  }
  const split = !!input.whtSplit
  const wht = whtRate(input.whtPct, 'WHT')
  const whtHw = split ? whtRate(input.whtHwPct, 'WHT on hardware') : wht
  const whtSaas = split ? whtRate(input.whtSaasPct, 'WHT on software as a service') : wht
  const grossUp = !!input.whtGrossUp

  // v1.6 section 6.1 (C-4): the hardware value, at HW_UPFRONT_MARGIN, rounded
  // ONCE at deal level. It is CAPEX's default amount, the boundary of split WHT
  // on CAPEX payments (C-8), and (Q9) the basis of the OPEX hardware line.
  const hardwareUpfront = lines.reduce(
    (s, l) => add(s, div(mul(fromInt(l.units), l.hwCostPerUnit), sub(ONE, p.hwUpfrontMargin))), ZERO)
  const hardwareValueCents = roundHalfUp(hardwareUpfront, 2)

  // A schedule is a list of runs of identical invoices. Each run carries its
  // invoice LINES before tax as `parts`: [kind, net], where kind is
  // 'hardware' or 'service' with Split WHT on, and 'invoice' (one line at the
  // single rate) with it off. One line per rate per invoice, so a single rate
  // rounds once (what keeps T20 and T21 exact).
  const yearOf = (m) => Math.ceil(m / 12)
  const monthsInYearOf = monthsInYear

  // OPEX: one fee per contract year; consecutive equal years merge into one
  // run. v1.3 section 8.1 (B4), kept by Q9: with Split WHT on, each month is a
  // flat hardware line and a service line carrying the rest.
  const opexHardwareLineCents = structure === 'opex' && split
    ? roundHalfUp(div(fromCents(hardwareValueCents), fromInt(T)), 2) : null
  const opexRow = (from, to, fee) => {
    let parts
    if (opexHardwareLineCents !== null) {
      const serviceCents = fee - opexHardwareLineCents
      if (serviceCents < 0n) {
        throw new TermPricingError('NEGATIVE_SERVICE_LINE',
          `The hardware line (${formatMoney(opexHardwareLineCents)} a month) is more than the month's fee (${formatMoney(fee)}), so the service line would be negative. Turn Split WHT off, or review the hardware margin.`)
      }
      parts = [['hardware', opexHardwareLineCents], ['service', serviceCents]]
    } else {
      parts = [['invoice', fee]]
    }
    return { kind: 'monthly', fromMonth: from, toMonth: to, capexCents: 0n, subscriptionCents: fee, netCents: fee, parts }
  }
  const opexRows = (feeByYear) => {
    const rows = []
    for (let k = 1; k <= years; k++) {
      const from = 12 * (k - 1) + 1
      const to = 12 * (k - 1) + monthsInYearOf(k)
      const last = rows[rows.length - 1]
      if (last && last.netCents === feeByYear[k - 1]) { last.toMonth = to; continue }
      rows.push(opexRow(from, to, feeByYear[k - 1]))
    }
    // v1.10 (9.4): the pass-through remainder goes on the LAST invoice, so
    // month T becomes a run of its own. 0n with factoring off or under Absorb,
    // and then nothing here runs.
    if (ptLastExtraCents !== 0n) {
      const last = rows[rows.length - 1]
      const fee = last.netCents + ptLastExtraCents
      if (last.fromMonth === last.toMonth) rows[rows.length - 1] = opexRow(T, T, fee)
      else { last.toMonth -= 1; rows.push(opexRow(T, T, fee)) }
    }
    return rows
  }

  const noCpi = cmp(escalator, ZERO) === 0
  let capex = null
  let finalRows
  let baseRows
  if (structure === 'opex') {
    finalRows = opexRows(monthlyTotalByYear)
    baseRows = noCpi ? finalRows : opexRows(monthlyTotalByYear.map(() => monthlyTotalByYear[0]))
  } else {
    capex = capexPlan()
    // v1.7 (T-4): an allocation still being entered prices no quote. The
    // preview reports it on the Base schedule; the quote refuses it, naming
    // the total (and, over 100%, the excess).
    if (capex.allocation.status !== 'complete') {
      if (preview) return allocationPreview()
      const { status, allocated, excess } = capex.allocation
      const shown = (r) => formatPct(r, 6).replace(/\.?0+$/, '')
      throw new TermPricingError('SHARES_TOTAL', status === 'over'
        ? `The milestone shares total ${shown(allocated.share)}%, ${shown(excess.share)}% (${formatMoney(excess.cents)}) over. They must total exactly 100%.`
        : `The milestone shares total ${shown(allocated.share)}%. They must total exactly 100%.`)
    }
    finalRows = capexRows(factor)
    baseRows = noCpi ? finalRows : capexRows(() => ONE)
  }

  // v1.7 (T-4): the preview's view of the plan. The breakdown is the BASE
  // schedule (C4: it ties to Base TCV), run by run, each milestone run
  // carrying its keys; while incomplete, the unallocated amount is the
  // "not yet scheduled" row, so the two together tie to Base TCV exactly.
  function allocationPreview(quote = null) {
    const a = capex.allocation
    let breakdown = null
    let unscheduledCents = null
    let breakdownTotals = null
    if (a.status !== 'over') {
      breakdown = capexRows(() => ONE, true).map(({ fromMonth, toMonth, keys, capexCents, subscriptionCents, netCents }) =>
        ({ fromMonth, toMonth, keys, capexCents, subscriptionCents, netCents }))
      unscheduledCents = a.unallocated.cents
      // The Total row: the unscheduled amount is CAPEX not yet given a month,
      // so it counts in the CAPEX and invoice columns and not the subscription.
      const total = (k) => breakdown.reduce((s, r) => s + r[k] * BigInt(r.toMonth - r.fromMonth + 1), 0n)
      breakdownTotals = {
        capexCents: total('capexCents') + unscheduledCents,
        subscriptionCents: total('subscriptionCents'),
        netCents: total('netCents') + unscheduledCents,
      }
      if (breakdownTotals.netCents !== tcvNetCents) {
        throw new TermPricingError('TIE_BROKEN', `The breakdown and the unscheduled amount (${formatMoney(breakdownTotals.netCents)}) do not tie to Base TCV (${formatMoney(tcvNetCents)}).`)
      }
    }
    return {
      status: a.status,
      baseTcvCents: tcvNetCents,
      capexCents: capex.capexCents,
      amountMode: capex.amountMode,
      structure: capex.structure,
      hardwareValueCents: capex.hardwareValueCents,
      hardwareCostCents: capex.hardwareCostCents,
      rows: a.rows,
      allocated: a.allocated,
      unallocated: a.unallocated,
      excess: a.excess,
      baseFeeCents: capex.baseFeeCents,
      lastBaseFeeCents: capex.lastBaseFeeCents,
      warnings: capex.warnings,
      breakdown,
      breakdownTotals,
      unscheduledCents,
      quote,
    }
  }

  // v1.6 sections 6.1 to 6.4: the CAPEX amount, how it is paid, the
  // subscription, and the warnings. Every refusal names what to change.
  function capexPlan() {
    const amountMode = input.capexAmount ?? 'hardware'
    if (amountMode !== 'hardware' && amountMode !== 'custom') {
      throw new TermPricingError('BAD_CAPEX_AMOUNT', 'The CAPEX amount must be Hardware or Custom.')
    }
    let capexCents
    if (amountMode === 'hardware') {
      capexCents = hardwareValueCents
    } else {
      // Kept EXACTLY as entered (C-4): more than two decimals is refused,
      // never rounded, because a rounded budget figure is not the client's.
      const s = typeof input.capexCustom === 'string' ? input.capexCustom.trim() : ''
      if (!/^\d+(\.\d{1,2})?$/.test(s)) {
        throw new TermPricingError('CAPEX_CUSTOM', 'Enter the CAPEX amount in USD with at most two decimals, for example 1000000.00.')
      }
      capexCents = roundHalfUp(parseDecimal(s, 'CAPEX'), 2)
    }
    if (capexCents <= 0n || capexCents >= tcvNetCents) {
      throw new TermPricingError('CAPEX_RANGE', `The CAPEX amount must be above 0 and below Base TCV (${formatMoney(tcvNetCents)}).`)
    }

    const capexStructure = input.capexStructure ?? 'hybrid'
    if (capexStructure !== 'hybrid' && capexStructure !== 'two_phase') {
      throw new TermPricingError('BAD_CAPEX_STRUCTURE', 'CAPEX is paid Two-phase or Hybrid.')
    }
    const payments = []
    let recoveryMonths = null
    let allocation = null
    if (capexStructure === 'hybrid') {
      // Q4: a milestone is an OPAQUE KEY here. This file never holds a
      // milestone name; with no rows given it pays one row, month 0, 100%,
      // carrying no key, and the screen supplies its default row by name.
      const given = input.milestones
      const rows = given == null ? [{ key: null, month: 0, sharePct: '100' }] : given
      if (!Array.isArray(rows) || rows.length < 1 || rows.length > 5) {
        throw new TermPricingError('MILESTONE_COUNT', 'A Hybrid schedule has 1 to 5 milestones.')
      }
      const seen = new Set()
      let total = ZERO
      let prev = -1
      const shares = rows.map((r, i) => {
        const n = i + 1
        if (given != null) {
          if (typeof r?.key !== 'string' || r.key.trim() === '') {
            throw new TermPricingError('MILESTONE_KEY', `Choose a milestone for row ${n}.`)
          }
          if (seen.has(r.key)) {
            throw new TermPricingError('DUPLICATE_MILESTONE', `${r.key} appears twice. A milestone may appear once per schedule.`)
          }
          seen.add(r.key)
        }
        if (typeof r.month !== 'number' || !Number.isSafeInteger(r.month) || r.month < 0 || r.month > T) {
          throw new TermPricingError('MILESTONE_MONTH', `Row ${n}: the month must be a whole number from 0 to ${T}.`)
        }
        if (r.month < prev) {
          throw new TermPricingError('MILESTONE_ORDER', 'Milestone months must not decrease down the rows.')
        }
        prev = r.month
        // v1.7 (T-4): in the PREVIEW a share not yet typed is no share: the
        // row has no amount and counts 0%. The quote still refuses it below.
        if (preview && (r.sharePct == null || (typeof r.sharePct === 'string' && r.sharePct.trim() === ''))) return null
        let share
        try { share = pctToRatio(r.sharePct, 'share') } catch {
          throw new TermPricingError('MILESTONE_SHARE', `Row ${n}: the share must be a percentage, for example 30.`)
        }
        if (cmp(share, ZERO) <= 0 || cmp(share, ONE) > 0) {
          throw new TermPricingError('MILESTONE_SHARE', `Row ${n}: the share must be above 0% and at most 100%.`)
        }
        total = add(total, share)
        return share
      })
      // v1.7 (T-4): complete, incomplete or over. Complete is exactly 100%
      // with every row's share entered; only then does the last row carry the
      // rounding (C-7). Otherwise every entered row is rounded on its own.
      const blank = shares.some((s) => s === null)
      const status = cmp(total, ONE) > 0 ? 'over' : cmp(total, ONE) < 0 || blank ? 'incomplete' : 'complete'
      const own = (s) => (s === null ? null : roundHalfUp(mul(fromCents(capexCents), s), 2))
      const amounts = status === 'complete' ? [] : shares.map(own)
      if (status === 'complete') {
        let paid = 0n
        rows.forEach((r, i) => {
          const cents = i < rows.length - 1 ? own(shares[i]) : capexCents - paid
          if (cents < 0n) {
            throw new TermPricingError('NEGATIVE_LAST_ITEM', 'The last milestone would be negative after rounding. Review the shares.')
          }
          paid += cents
          amounts.push(cents)
        })
      }
      rows.forEach((r, i) => {
        if (amounts[i] !== null) payments.push({ key: given == null ? null : r.key, month: r.month, cents: amounts[i] })
      })
      const allocatedCents = amounts.reduce((s, c) => s + (c ?? 0n), 0n)
      allocation = {
        status,
        rows: rows.map((r, i) => ({ key: given == null ? null : r.key, month: r.month, cents: amounts[i] })),
        allocated: { share: total, cents: allocatedCents },
        unallocated: status === 'incomplete'
          ? { share: sub(ONE, total), cents: capexCents - allocatedCents } : { share: ZERO, cents: 0n },
        excess: status === 'over' ? { share: sub(total, ONE), cents: allocatedCents - capexCents } : null,
      }
    } else {
      recoveryMonths = input.recoveryMonths ?? 12
      if (typeof recoveryMonths !== 'number' || !Number.isSafeInteger(recoveryMonths) || recoveryMonths < 1 || recoveryMonths > T) {
        throw new TermPricingError('RECOVERY_MONTHS', `The recovery period must be a whole number of months from 1 to ${T}.`)
      }
      const R = recoveryMonths
      const instalment = roundHalfUp(div(fromCents(capexCents), fromInt(R)), 2)
      const lastInstalment = capexCents - instalment * BigInt(R - 1)
      if (lastInstalment < 0n) {
        throw new TermPricingError('NEGATIVE_LAST_ITEM', `The last instalment would be negative after rounding. Use a shorter recovery period or a larger CAPEX amount.`)
      }
      for (let m = 1; m <= R; m++) payments.push({ key: null, month: m, cents: m < R ? instalment : lastInstalment })
    }
    // Two-phase (and a Hybrid that completed) report a complete allocation.
    allocation ??= {
      status: 'complete',
      rows: payments.map(({ key, month, cents }) => ({ key, month, cents })),
      allocated: { share: ONE, cents: capexCents },
      unallocated: { share: ZERO, cents: 0n },
      excess: null,
    }

    // Section 6.3 (C-5, Q2): month T carries the rounding.
    // v1.10 (6.3): the subscription is built on the BANDED remainder, so CPI
    // never reaches the pass-through, which is added to sub(m) after it.
    const remainder = tcvNetCents - capexCents - ptTotalCents
    const baseFeeCents = roundHalfUp(div(fromCents(remainder), fromInt(T)), 2)
    const lastBaseFeeCents = remainder - baseFeeCents * BigInt(T - 1)
    if (lastBaseFeeCents < 0n) {
      throw new TermPricingError('NEGATIVE_LAST_ITEM', 'The last month\'s subscription would be negative after rounding. Use a smaller CAPEX amount.')
    }
    const subOf = (base, k) => roundHalfUp(mul(fromCents(base), factor(k)), 2)

    // Section 6.4 (C-9): warnings, shown and never refused.
    // v1.10: hardwareCostCents and hostingMonthlyCents are the deal's, computed
    // once above for both bases, by the same expressions (Architecture 3).

    return {
      amountMode, structure: capexStructure, recoveryMonths,
      hardwareValueCents, hardwareCostCents, capexCents, payments,
      baseFeeCents, lastBaseFeeCents, allocation,
      // The Final subscription: each contract year's regular fee, and month T's.
      subscriptionByYear: Array.from({ length: years }, (_, i) => subOf(baseFeeCents, i + 1) + ptMonthlyCents),
      lastSubscriptionCents: subOf(lastBaseFeeCents, yearOf(T)) + ptMonthlyCents + ptLastExtraCents,
      warnings: {
        hardwareFundedCents: capexCents < hardwareCostCents ? hardwareCostCents - capexCents : null,
        hostingMonthlyCents,
        subscriptionBelowHosting: baseFeeCents < hostingMonthlyCents,
      },
    }
  }

  // One CAPEX schedule, Base (factor 1) or Final (section 7's factor). CAPEX
  // payments never escalate. v1.6 section 8.1 (C-8, Q8): with Split WHT on,
  // CAPEX payments take the hardware rate up to the hardware value, in
  // payment order; CAPEX above it and every subscription amount take the SaaS
  // rate. A payment that straddles the boundary splits across the two lines.
  // v1.7 (T-4): `byKey` is the allocation breakdown's grouping: each month
  // carries its milestones' keys, and a run never spans two milestones, so a
  // milestone row keeps its name. The quote's own schedule groups as before.
  function capexRows(f, byKey = false) {
    const months = []
    let hardwareLeft = hardwareValueCents
    for (let m = 0; m <= T; m++) {
      const pays = capex.payments.filter((x) => x.month === m)
      if (m === 0 && !pays.length) continue
      let capexCents = 0n
      let hw = 0n
      let above = 0n
      for (const x of pays) {
        const h = x.cents < hardwareLeft ? x.cents : hardwareLeft
        hardwareLeft -= h
        hw += h
        above += x.cents - h
        capexCents += x.cents
      }
      const base = m === T ? capex.lastBaseFeeCents : capex.baseFeeCents
      // v1.10 (6.3, 9.4): the pass-through is added AFTER the CPI factor.
      const subscriptionCents = m >= 1
        ? roundHalfUp(mul(fromCents(base), f(yearOf(m))), 2) + ptMonthlyCents + (m === T ? ptLastExtraCents : 0n)
        : 0n
      const netCents = capexCents + subscriptionCents
      let parts
      if (split) {
        parts = [['hardware', hw], ['service', above + subscriptionCents]].filter(([, c]) => c !== 0n)
        if (!parts.length) parts = [['service', 0n]]
      } else {
        parts = [['invoice', netCents]]
      }
      const keys = pays.map((x) => x.key).filter((k) => k != null)
      months.push({ m, capexCents, subscriptionCents, netCents, parts, keys })
    }
    const rows = []
    const same = (a, b) => a.capexCents === b.capexCents && a.subscriptionCents === b.subscriptionCents
      && a.parts.length === b.parts.length && a.parts.every(([k, c], i) => b.parts[i][0] === k && b.parts[i][1] === c)
      && (!byKey || (!a.keys.length && !b.keys.length))
    for (const x of months) {
      const last = rows[rows.length - 1]
      if (last && last.toMonth === x.m - 1 && same(last, x)) { last.toMonth = x.m; continue }
      rows.push({ kind: 'invoice', fromMonth: x.m, toMonth: x.m, capexCents: x.capexCents, subscriptionCents: x.subscriptionCents, netCents: x.netCents, parts: x.parts,
        ...(byKey ? { keys: x.keys } : {}) })
    }
    return rows
  }

  // Section 8: tax per invoice line, half-up to cents. WHT applies to the fee
  // before GST. With gross-up the line rises so Terminus receives its net.
  const rateOf = (kind) => (kind === 'hardware' ? whtHw : kind === 'service' ? whtSaas : wht)
  const taxLine = (netCents, r) => {
    const invoiceCents = grossUp && cmp(r, ZERO) > 0 ? roundHalfUp(div(fromCents(netCents), sub(ONE, r)), 2) : netCents
    const whtCents = roundHalfUp(mul(fromCents(invoiceCents), r), 2)
    const gstCents = roundHalfUp(mul(fromCents(invoiceCents), gst), 2)
    return { netCents, invoiceCents, gstCents, whtCents, receivedCents: invoiceCents - whtCents }
  }
  const applyTax = (rows) => {
    // capexCents and subscriptionCents total the schedule's two leading
    // columns (C-13), so the screen's Total row reads the engine and adds
    // nothing itself: capexCents + subscriptionCents = netCents, exactly.
    const totals = { capexCents: 0n, subscriptionCents: 0n, invoicedCents: 0n, netCents: 0n, gstCents: 0n, whtCents: 0n, whtBorneCents: 0n, receivedCents: 0n }
    const out = rows.map(({ parts: rawParts, ...row }) => {
      const count = BigInt(row.toMonth - row.fromMonth + 1)
      const parts = rawParts.map(([kind, net]) => ({ kind, ...taxLine(net, rateOf(kind)) }))
      const sum = (k) => parts.reduce((t, x) => t + x[k], 0n)
      const invoiceCents = sum('invoiceCents'), gstCents = sum('gstCents'), whtCents = sum('whtCents')
      const r = {
        ...row, count: Number(count),
        invoiceCents, gstCents, invoiceInclGstCents: invoiceCents + gstCents,
        whtCents, whtBorne: !grossUp, receivedCents: invoiceCents - whtCents,
        ...(parts.length > 1 ? { lines: parts.map((x) => ({ ...x, invoiceInclGstCents: x.invoiceCents + x.gstCents })) } : {}),
      }
      totals.capexCents += row.capexCents * count
      totals.subscriptionCents += row.subscriptionCents * count
      totals.invoicedCents += invoiceCents * count
      totals.netCents += row.netCents * count
      totals.gstCents += gstCents * count
      totals.whtCents += whtCents * count
      if (!grossUp) totals.whtBorneCents += whtCents * count
      totals.receivedCents += r.receivedCents * count
      return r
    })
    // L1 (John, layout approval): the WHT gross-up is what the invoices carry
    // above their nets, so TCV (net) + grossUpCents + GST = TCV incl. GST
    // exactly, on each schedule. Zero whenever gross-up is off.
    return {
      schedule: out,
      tax: { ...totals, grossUpCents: totals.invoicedCents - totals.netCents, tcvInclGstCents: totals.invoicedCents + totals.gstCents },
    }
  }
  const final = applyTax(finalRows)
  const base = baseRows === finalRows ? final : applyTax(baseRows)
  // The tie rule, on Base: the Base schedule's net invoices ARE Base TCV. A
  // break is a defect in this file, refused rather than shown.
  if (base.tax.netCents !== tcvNetCents) {
    throw new TermPricingError('TIE_BROKEN', `The Base schedule (${formatMoney(base.tax.netCents)}) does not tie to Base TCV (${formatMoney(tcvNetCents)}).`)
  }
  const finalTcvCents = final.tax.netCents

  // v1.6 section 9 (Q10): cash in year 1 is the net invoices of months 0 to
  // 12 on the schedule displayed (the Final one), before GST and WHT.
  const cashYear1 = (rows) => rows.reduce((t, r) => {
    const lo = Math.max(r.fromMonth, 0)
    const hi = Math.min(r.toMonth, 12)
    return hi >= lo ? t + r.netCents * BigInt(hi - lo + 1) : t
  }, 0n)

  // ── v1.10 sections 9.5 and 9.6: the cash flow and its headline ──────────
  //
  // Months 0 to T; month 0 only when something happens in it. Client payments
  // are each FINAL invoice as Terminus receives it, after WHT and excluding
  // GST (R-TF8). Procurement and the advance are schedules, one entry today
  // in month 1 (R-TF10, R-TF12); each advance is its own facility, repaid
  // from the month after it is drawn. Amounts are signed: in positive, out
  // negative.
  const vendor = vendorPlan(input.vendorPayments, T, hardwareCostCents)
  const cashFlow = (() => {
    const byMonth = new Map()
    const at = (m) => {
      if (!byMonth.has(m)) {
        byMonth.set(m, { month: m, procurementCents: 0n, advanceCents: 0n, clientCents: 0n, hostingCents: 0n, principalCents: 0n, interestCents: 0n })
      }
      return byMonth.get(m)
    }
    for (const r of final.schedule) for (let m = r.fromMonth; m <= r.toMonth; m++) at(m).clientCents += r.receivedCents
    for (let m = 1; m <= T; m++) at(m).hostingCents -= hostingMonthlyCents
    for (const v of vendor) at(v.month).procurementCents -= v.cents
    for (const f of fx?.facilities ?? []) {
      at(f.month).advanceCents += f.advanceCents
      for (const x of f.loan.months) {
        const row = at(f.month + x.i)
        row.principalCents -= x.principalCents
        row.interestCents -= x.interestCents
      }
    }
    let balance = 0n
    const rows = [...byMonth.values()].sort((a, b) => a.month - b.month).map((r) => {
      const netCents = r.procurementCents + r.advanceCents + r.clientCents + r.hostingCents + r.principalCents + r.interestCents
      balance += netCents
      return { ...r, netCents, balanceCents: balance }
    })
    // 9.6: the lowest balance and its month (the earliest, on a tie), and
    // payback: the first month from which the balance stays at or above 0.
    let lowest = null
    for (const r of rows) if (lowest === null || r.balanceCents < lowest.balanceCents) lowest = { balanceCents: r.balanceCents, month: r.month }
    let paybackMonth = rows[0].month
    rows.forEach((r, i) => { if (r.balanceCents < 0n) paybackMonth = i + 1 < rows.length ? rows[i + 1].month : null })
    return { rows, lowest, paybackMonth, closingBalanceCents: balance }
  })()

  // 9.3 and 9.6: the factoring summary, and the same quote run with factoring
  // OFF for the "without" headline. Under Pass through that is also the price
  // without the pass-through.
  let factoring = null
  if (fx) {
    const absorb = fx.treatment === 'absorb'
    const without = quoteCore({ ...input, factoring: null }, p, false)
    factoring = {
      treatment: fx.treatment, method: fx.method, ratePct: fx.ratePct, termMonths: fx.termMonths,
      advanceCents: fx.advanceCents, hardwareCostCents, advanceAboveHardwareCost: fx.advanceAboveHardwareCost,
      facilities: fx.facilities.map((f) => ({ month: f.month, advanceCents: f.advanceCents, interestCents: f.loan.interestCents, months: f.loan.months })),
      costCents: fx.costCents,
      allocation: lines.map((l) => ({ product: l.product, costCents: l.factoringCostCents, passThrough: l.passThrough })),
      passThroughCents: ptTotalCents,
      passThroughMonthlyCents: ptMonthlyCents,
      passThroughLastExtraCents: ptLastExtraCents,
      profitBeforeFinanceCents: absorb ? grossProfitCents + fx.costCents : null,
      marginBeforeFinance: absorb ? frac(grossProfitCents + fx.costCents, tcvNetCents) : null,
      profitAfterFinanceCents: grossProfitCents,
      marginAfterFinance: grossMargin,
      without: {
        monthlyTotalCents: without.monthlyTotalCents,
        tcvNetCents: without.tcvNetCents,
        grossProfitCents: without.grossProfitCents,
        grossMargin: without.grossMargin,
        lowest: without.cashFlow.lowest,
        paybackMonth: without.cashFlow.paybackMonth,
        closingBalanceCents: without.cashFlow.closingBalanceCents,
      },
    }
  }

  const quote = {
    termMonths: T,
    paymentStructure: structure,
    cpiMode,
    escalatorStartYear: startYear,
    whtSplit: split,
    currency: p.currency,
    lines,
    // v2.0 (A4): list, the deal adjustment, and the approval signal.
    dealDiscount,
    monthlyTotalCents: monthlyTotalByYear[0],
    // The OPEX fee of each contract year with the CPI (Final); year 1 is Base's.
    monthlyTotalByYear,
    // v1.6 (C-1, C-2, C-3): Base carries approval; Final is what is invoiced.
    tcvNetCents,
    finalTcvCents,
    cpiUpliftCents: finalTcvCents - tcvNetCents,
    dealValueCents: cpiMode === 'locked' ? finalTcvCents : tcvNetCents,
    totalCostCents,
    grossProfitCents,
    grossMargin,
    marginFloor: p.marginFloor,
    belowMarginFloor: cmp(grossMargin, p.marginFloor) < 0,
    // Q4 (John, 2026-10-01): shown whenever WHT is borne. Gross profit less the
    // WHT Terminus bears, over TCV net. Null when nothing is borne, so a screen
    // cannot show it by accident beside a gross-up or a zero rate. v1.6 (Q5):
    // on the BASE schedule, the same basis as the margin it reduces.
    marginAfterWht: base.tax.whtBorneCents > 0n
      ? frac(grossProfitCents - base.tax.whtBorneCents, tcvNetCents) : null,
    capex,
    hardwareValueCents,
    // v1.10 (TERM_FACTORING): both bases; the factoring summary (null when
    // off); and the cash flow of this quote (spec 9.5, 9.6).
    hardwareCostCents,
    hostingMonthlyCents,
    factoring,
    cashFlow,
    cashYear1Cents: cashYear1(final.schedule),
    opexCashYear1Cents: monthlyTotalByYear[0] * BigInt(monthsInYear(1)),
    // The Final schedule: what the client is invoiced.
    schedule: final.schedule,
    tax: final.tax,
    // The Base schedule: approval's WHT and the Base tie.
    base: { tcvNetCents, schedule: base.schedule, tax: base.tax },
  }
  // v1.7 (T-4): a complete allocation IS the quote, this one.
  return preview ? allocationPreview(quote) : quote
}

/**
 * The term ladder: the same units priced at every offered term.
 *
 * v1.6 (C-10, Q12): EVERY ROW IS THE OPEX BASE ROW, in both structures. Under
 * CAPEX the screen shows the term and the per-camera fee only; there is no
 * per-camera CAPEX figure. The ladder takes the units alone, so a CAPEX
 * amount, a schedule or a tax rate that suits one term (or none) cannot
 * refuse it. SUPERSEDED, left visible: v1.5 priced each row as the full quote
 * at that term and, under CAPEX, carried the upfront and the service fee.
 *
 * v2.0 (TP_LADDER Q1): the saving or premium compares year-1 LIST fees (banded,
 * before any deal discount) with COMPARE_TERM's, which derives no price.
 * SUPERSEDED, left visible: v1.x compared with ANCHOR_TERM, the formula's
 * anchor. A term with no price ladder price is a row that prices nothing and
 * says why (amended L-8); every other row still prices. With no price at
 * COMPARE_TERM the column is null on every row.
 *
 * v2.0 (A4): `dealAdjustment` applies to every row (a discount is kept across
 * terms); the per-camera fee is LIST.
 *
 * v1.5 section 4.5: each row carries the per-camera fee, the year-1 monthly
 * total of the line `input.perCameraProduct` names, divided by that line's
 * units and rounded half-up. The calculator names no product; the screen says
 * which line is the camera. Null when no product is named or the named line
 * has no units.
 */
export function termLadder(input, params) {
  const p = norm(params)
  const opexBase = { units: input?.units, paymentStructure: 'opex', cpiMode: 'none', dealAdjustment: input?.dealAdjustment ?? null }
  const priced = new Map(p.terms.map((T) => {
    try {
      return [T, { q: priceQuote({ ...opexBase, termMonths: T }, p) }]
    } catch (e) {
      if (!NO_LADDER_CODES.includes(e?.code)) throw e
      return [T, { missing: { code: e.code, product: e.product, termMonths: e.termMonths, message: e.message } }]
    }
  }))
  const compare = priced.get(p.compareTerm).q ?? null
  const perCameraOf = (q) => {
    if (!input?.perCameraProduct) return null
    const line = q.lines.find((l) => l.product === input.perCameraProduct)
    if (!line) return null
    return roundHalfUp(div(fromCents(line.listMonthlyCents), fromInt(line.units)), 2)
  }
  return p.terms.map((T) => {
    const { q, missing } = priced.get(T)
    const isCompare = T === p.compareTerm
    if (!q) return { termMonths: T, priced: false, isCompare, missing }
    return {
      termMonths: T,
      priced: true,
      isCompare,
      perCameraCents: perCameraOf(q),
      listMonthlyCents: q.dealDiscount.listMonthlyCents,
      monthlyTotalCents: q.monthlyTotalCents,
      savingVsCompare: compare ? sub(ONE, frac(q.dealDiscount.listMonthlyCents, compare.dealDiscount.listMonthlyCents)) : null,
      listTcvCents: q.dealDiscount.listTcvCents,
      tcvNetCents: q.tcvNetCents,
      grossMargin: q.grossMargin,
      belowMarginFloor: q.belowMarginFloor,
    }
  })
}


// ── Section 4.6: the manual ladder comparison, RETIRED (v2.0, TP_LADDER A5) ──
//
// SUPERSEDED, left visible in the spec rather than here: v1.9's manualLadder
// compared a typed price per term with "Calculated", the formula's fee at one
// camera. A1 removed the formula, so "Calculated" has nothing to read, and the
// price ladder editor (A6) now holds what the comparison was for: a typed
// price per term, its client total, profit and margin, and the three checks
// (bandMarginGrid, above). The compare card retires with it.

// ── Formatting at the edge ───────────────────────────────────────────────

/** BigInt cents to "1,234.56". */
export function formatMoney(cents) {
  const neg = cents < 0n
  const a = abs(cents)
  const whole = (a / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const part = (a % 100n).toString().padStart(2, '0')
  return `${neg ? '-' : ''}${whole}.${part}`
}

/** A ratio fraction to a percentage string at `places` dp, half-up: "90.0". */
export function formatPct(ratio, places = 1) {
  const scaled = roundHalfUp(mul(ratio, HUNDRED), places)
  const neg = scaled < 0n
  const a = abs(scaled)
  const s = 10n ** BigInt(places)
  const body = places ? `${a / s}.${(a % s).toString().padStart(places, '0')}` : `${a}`
  return `${neg ? '-' : ''}${body}`
}
