// ── THE TERM PRICING ENGINE ──────────────────────────────────────────────
//
// Implements docs/pricing-spec.md (Specification v1.9) exactly. CLAUDE.md
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
 *   TERMS: [12, 24, ...], ANCHOR_TERM: 36,
 *   ANCHOR_MARGIN: { safesight: '90', ... }, SHORT_TERM_MARGIN: { ... },
 *   PROFIT_STEP: '0.00',
 *   VOLUME_BANDS_BY_PRODUCT: { safesight: [{ from: 1, discountPct: '0' }, { from: 10, discountPct: '5' }, ...], ... },
 *   HW_UPFRONT_MARGIN: '20', MARGIN_FLOOR: '25', CURRENCY: 'USD',
 *   costs: { safesight: { hwCost: '8000.00', hostingMonthly: '200.00' }, ... },
 * }
 */
export function normaliseParams(params) {
  if (!params || typeof params !== 'object') throw new TermPricingError('NO_PARAMS', 'parameters are required')
  const terms = (params.TERMS ?? []).map((t) => safeInt(t, 'TERMS entry'))
  if (!terms.length) throw new TermPricingError('BAD_PARAM', 'TERMS must list at least one term')
  for (let i = 0; i < terms.length; i++) {
    if (terms[i] < 1) throw new TermPricingError('BAD_PARAM', 'every term must be at least 1 month')
    if (i && terms[i] <= terms[i - 1]) throw new TermPricingError('BAD_PARAM', 'TERMS must be strictly ascending')
  }
  const anchorTerm = safeInt(params.ANCHOR_TERM, 'ANCHOR_TERM')
  if (!terms.includes(anchorTerm)) throw new TermPricingError('BAD_PARAM', 'ANCHOR_TERM must be one of TERMS')

  const margins = (obj, what) => {
    const out = {}
    for (const [k, v] of Object.entries(obj ?? {})) {
      const r = pctToRatio(v, `${what}[${k}]`)
      if (cmp(r, ZERO) < 0 || cmp(r, ONE) >= 0) {
        throw new TermPricingError('BAD_PARAM', `${what}[${k}] must be at least 0% and below 100%`)
      }
      out[k] = r
    }
    return out
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
    anchorTerm,
    anchorMargin: margins(params.ANCHOR_MARGIN, 'ANCHOR_MARGIN'),
    shortTermMargin: margins(params.SHORT_TERM_MARGIN, 'SHORT_TERM_MARGIN'),
    profitStep: parseDecimal(params.PROFIT_STEP, 'PROFIT_STEP'),
    bandsByProduct,
    hwUpfrontMargin: hwUpfront,
    marginFloor: pctToRatio(params.MARGIN_FLOOR, 'MARGIN_FLOOR'),
    currency: params.CURRENCY,
    costs,
  }
}

const isNormalised = (p) => p && Array.isArray(p.terms) && p.bandsByProduct && typeof p.bandsByProduct === 'object'
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
  const am = p.anchorMargin[product]
  const sm = p.shortTermMargin[product]
  if (!am) throw new TermPricingError('NO_PARAM', `No ANCHOR_MARGIN for ${product}`)
  if (!sm) throw new TermPricingError('NO_PARAM', `No SHORT_TERM_MARGIN for ${product}`)
  // v1.8 (TB-1): the product's own bands. A product with none is refused, as a
  // missing margin is, rather than borrowing another product's.
  const bands = p.bandsByProduct[product]
  if (!bands) throw new TermPricingError('NO_PARAM', `No volume bands for ${product}`)
  return { cost, am, sm, bands }
}

// ── Section 4.1: the list fee per unit, full precision ───────────────────

const costAt = (c, T) => add(c.hw, mul(c.hosting, fromInt(T)))

function priceAt(p, product, T) {
  const { cost, am, sm } = productParams(p, product)
  if (T < p.anchorTerm) return div(costAt(cost, T), sub(ONE, sm))
  const anchorProfit = div(mul(costAt(cost, p.anchorTerm), am), sub(ONE, am))
  const stepsAbove = p.terms.indexOf(T) - p.terms.indexOf(p.anchorTerm)
  return add(add(costAt(cost, T), anchorProfit), mul(p.profitStep, fromInt(stepsAbove)))
}

const listFeeAt = (p, product, T) => div(priceAt(p, product, T), fromInt(T))

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
  return {
    product,
    termMonths: T,
    listFee,
    costCents,
    savingVsAnchor: sub(ONE, div(listFee, listFeeAt(p, product, p.anchorTerm))),
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
 * bandMarginGrid(product, bands, params): the margin check for one product on
 * the bands AS TYPED. Every band at every term in TERMS, each cell the 10.3
 * worst case (every unit at that band's fee), flagged by an EXACT comparison
 * with MARGIN_FLOOR. A breach warns; nothing here refuses.
 *
 * -> { ok: true, floor, terms, feeTerms, rows: [{ band, from, to, discountPct,
 *        cells: [{ termMonths, feeCents, margin, belowFloor }] }],
 *      breaches: [{ band, termMonths, feeCents, margin }] }
 * -> { ok: false, problems } while the set breaks a 3.2 rule: no figures.
 */
export function bandMarginGrid(product, bands, params) {
  const v = validateBands(bands)
  if (!v.ok) return { ok: false, problems: v.problems }
  const base = norm(params)
  const p = { ...base, bandsByProduct: { ...base.bandsByProduct, [product]: engineBands(v.bands, product) } }
  const rows = p.bandsByProduct[product].map((b, i) => ({
    band: i + 1, from: b.from, to: b.to, discountPct: b.discountPct, cells: [],
  }))
  for (const T of p.terms) {
    unitEconomics(product, T, p).bands.forEach((u, i) => {
      rows[i].cells.push({ termMonths: T, feeCents: u.feeCents, margin: u.margin, belowFloor: cmp(u.margin, p.marginFloor) < 0 })
    })
  }
  const breaches = rows.flatMap((r) => r.cells.filter((c) => c.belowFloor)
    .map((c) => ({ band: r.band, termMonths: c.termMonths, feeCents: c.feeCents, margin: c.margin })))
  return {
    ok: true, floor: p.marginFloor, terms: p.terms,
    feeTerms: FEE_TABLE_TERMS.filter((t) => p.terms.includes(t)),
    rows, breaches,
  }
}

// ── The quote: sections 4.3, 4.4, 6, 7, 8 ────────────────────────────────

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
    return {
      product, units, listFee,
      savingVsAnchor: sub(ONE, div(listFee, listFeeAt(p, product, p.anchorTerm))),
      costPerUnitCents,
      hwCostPerUnit: cost.hw,
      bands, monthlyByYear,
      tcvNetCents, costCents, grossProfitCents: tcvNetCents - costCents,
      grossMargin: tcvNetCents === 0n ? ZERO : frac(tcvNetCents - costCents, tcvNetCents),
    }
  })

  const monthlyTotalByYear = []
  for (let k = 0; k < years; k++) monthlyTotalByYear.push(lines.reduce((s, l) => s + l.monthlyByYear[k], 0n))

  // v1.6 (C-1): BASE TCV, the year-1 monthly total times T, in both
  // structures. It carries approval: the margin, the floor and the profit
  // table. The tie rule holds on it: the Base schedule's net invoices sum to
  // it exactly (checked below, and a break is refused, never shown).
  // SUPERSEDED, left visible: v1.5 summed each contract year's ESCALATED fee
  // here, so the margin rose with the escalator.
  const tcvNetCents = monthlyTotalByYear[0] * BigInt(T)

  const totalCostCents = lines.reduce((s, l) => s + BigInt(l.units) * l.costPerUnitCents, 0n)
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
  const opexRows = (feeByYear) => {
    const rows = []
    for (let k = 1; k <= years; k++) {
      const from = 12 * (k - 1) + 1
      const to = 12 * (k - 1) + monthsInYearOf(k)
      const last = rows[rows.length - 1]
      if (last && last.netCents === feeByYear[k - 1]) { last.toMonth = to; continue }
      const fee = feeByYear[k - 1]
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
      rows.push({ kind: 'monthly', fromMonth: from, toMonth: to, capexCents: 0n, subscriptionCents: fee, netCents: fee, parts })
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
    const remainder = tcvNetCents - capexCents
    const baseFeeCents = roundHalfUp(div(fromCents(remainder), fromInt(T)), 2)
    const lastBaseFeeCents = remainder - baseFeeCents * BigInt(T - 1)
    if (lastBaseFeeCents < 0n) {
      throw new TermPricingError('NEGATIVE_LAST_ITEM', 'The last month\'s subscription would be negative after rounding. Use a smaller CAPEX amount.')
    }
    const subOf = (base, k) => roundHalfUp(mul(fromCents(base), factor(k)), 2)

    // Section 6.4 (C-9): warnings, shown and never refused.
    const hardwareCostCents = roundHalfUp(lines.reduce((s, l) => add(s, mul(fromInt(l.units), l.hwCostPerUnit)), ZERO), 2)
    const hostingMonthlyCents = roundHalfUp(lines.reduce((s, l) => add(s, mul(fromInt(l.units), p.costs[l.product].hosting)), ZERO), 2)

    return {
      amountMode, structure: capexStructure, recoveryMonths,
      hardwareValueCents, hardwareCostCents, capexCents, payments,
      baseFeeCents, lastBaseFeeCents, allocation,
      // The Final subscription: each contract year's regular fee, and month T's.
      subscriptionByYear: Array.from({ length: years }, (_, i) => subOf(baseFeeCents, i + 1)),
      lastSubscriptionCents: subOf(lastBaseFeeCents, yearOf(T)),
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
      const subscriptionCents = m >= 1 ? roundHalfUp(mul(fromCents(base), f(yearOf(m))), 2) : 0n
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

  const quote = {
    termMonths: T,
    paymentStructure: structure,
    cpiMode,
    escalatorStartYear: startYear,
    whtSplit: split,
    currency: p.currency,
    lines,
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
 * The saving or premium compares year-1 OPEX fees with the anchor term's
 * (section 7: the client-facing saving always quotes year-1 fees).
 *
 * v1.5 section 4.5: each row carries the per-camera fee, the year-1 monthly
 * total of the line `input.perCameraProduct` names, divided by that line's
 * units and rounded half-up. The calculator names no product; the screen says
 * which line is the camera. Null when no product is named or the named line
 * has no units.
 */
export function termLadder(input, params) {
  const p = norm(params)
  const opexBase = { units: input?.units, paymentStructure: 'opex', cpiMode: 'none' }
  const anchor = priceQuote({ ...opexBase, termMonths: p.anchorTerm }, p)
  const perCameraOf = (q) => {
    if (!input?.perCameraProduct) return null
    const line = q.lines.find((l) => l.product === input.perCameraProduct)
    if (!line) return null
    return roundHalfUp(div(fromCents(line.monthlyByYear[0]), fromInt(line.units)), 2)
  }
  return p.terms.map((T) => {
    const q = priceQuote({ ...opexBase, termMonths: T }, p)
    return {
      perCameraCents: perCameraOf(q),
      termMonths: T,
      isAnchor: T === p.anchorTerm,
      monthlyTotalCents: q.monthlyTotalCents,
      savingVsAnchor: sub(ONE, frac(q.monthlyTotalCents, anchor.monthlyTotalCents)),
      tcvNetCents: q.tcvNetCents,
      grossMargin: q.grossMargin,
      belowMarginFloor: q.belowMarginFloor,
    }
  })
}


// ── Section 4.6: the manual ladder comparison (v1.9, TP_MANUAL) ──────────

const MANUAL_PRICE = /^\d+(\.\d{1,2})?$/
const MANUAL_REFUSAL = 'Enter a monthly price above 0, to the cent.'
// A percentage as an admin typed it: "25", "7.5", never "25.0" (the mockup's "25%").
const plainPct = (ratio) => formatPct(ratio, 6).replace(/\.?0+$/, '')
const termsText = (terms) => `${terms.length} term${terms.length === 1 ? '' : 's'} (${terms.join(', ')})`

/**
 * manualLadder({ product, prices }, params): COMPARISON ONLY (M-2). It never
 * prices a quote and changes nothing. One unit of `product` at every term in
 * TERMS, Base, no CPI. `prices` maps a term to the monthly price as typed
 * ("2,500.00"); blank or missing skips the term. The screen names the product
 * (C1), as it does for termLadder.
 *
 * "Calculated" is termLadder's per-camera fee at ONE camera (M-8, T31's basis),
 * not a new formula: one unit sits in the first band, so it is that band's fee.
 *
 * -> { product, anchorTerm, floor, hwCostCents, hostingMonthlyCents, firstBandDiscountPct,
 *      rows: [{ termMonths, calculatedCents, status: 'blank' | 'invalid' | 'priced',
 *               message?, priceCents?, totalCents?, costCents?, profitCents?,
 *               difference?, vsAnchor?: Fraction | 'list' | null, margin?,
 *               flags?: [{ kind: 'floor' | 'total' | 'profit', against?, message }] }],
 *      summary: { priced, floor, total, profit: { ok, terms, text } } }
 */
export function manualLadder(input, params) {
  const p = norm(params)
  const product = input?.product
  const { cost, bands } = productParams(p, product)
  const ladder = termLadder({ units: { [product]: 1 }, perCameraProduct: product }, p)
  const typed = input?.prices ?? {}

  const rows = ladder.map((l) => {
    const T = l.termMonths
    const raw = String(typed[T] ?? '').replace(/,/g, '').trim()
    if (raw === '') return { termMonths: T, calculatedCents: l.perCameraCents, status: 'blank' }
    const price = MANUAL_PRICE.test(raw) ? parseDecimal(raw) : null
    if (!price || cmp(price, ZERO) <= 0) {
      return { termMonths: T, calculatedCents: l.perCameraCents, status: 'invalid', message: MANUAL_REFUSAL }
    }
    const priceCents = roundHalfUp(price, 2)
    const totalCents = priceCents * BigInt(T)
    const costCents = roundHalfUp(costAt(cost, T), 2)
    const profitCents = totalCents - costCents
    return {
      termMonths: T, calculatedCents: l.perCameraCents, status: 'priced',
      priceCents, totalCents, costCents, profitCents,
      difference: sub(frac(priceCents, l.perCameraCents), ONE),
      margin: frac(profitCents, totalCents),
    }
  })

  const anchor = rows.find((r) => r.termMonths === p.anchorTerm)
  const anchorCents = anchor?.status === 'priced' ? anchor.priceCents : null
  let prev = null
  for (const r of rows) {
    if (r.status !== 'priced') continue
    r.vsAnchor = r.termMonths === p.anchorTerm ? 'list' : anchorCents === null ? null : sub(frac(r.priceCents, anchorCents), ONE)
    // The checks, in the order ruled (C2): floor, client total, profit. Each
    // against the previous row WITH a price; equal is not a fall.
    r.flags = []
    if (cmp(r.margin, p.marginFloor) < 0) r.flags.push({ kind: 'floor', message: 'Below the floor' })
    if (prev && r.totalCents < prev.totalCents) {
      r.flags.push({ kind: 'total', against: prev.termMonths, message: `Client total below ${prev.termMonths} months` })
    }
    if (prev && r.profitCents < prev.profitCents) {
      r.flags.push({ kind: 'profit', against: prev.termMonths, message: `Profit below ${prev.termMonths} months` })
    }
    prev = r
  }

  const priced = rows.filter((r) => r.status === 'priced')
  const flagged = (kind) => priced.filter((r) => r.flags.some((f) => f.kind === kind)).map((r) => r.termMonths)
  const floorPct = plainPct(p.marginFloor)
  const check = (kind, okText, failText) => {
    const terms = flagged(kind)
    return { ok: terms.length === 0, terms, text: terms.length === 0 ? okText : `${failText} ${termsText(terms)}` }
  }
  return {
    product,
    anchorTerm: p.anchorTerm,
    floor: p.marginFloor,
    hwCostCents: roundHalfUp(cost.hw, 2),
    hostingMonthlyCents: roundHalfUp(cost.hosting, 2),
    firstBandDiscountPct: bands[0].discountPct,
    rows,
    summary: {
      priced: priced.length,
      floor: check('floor', `At or above the ${floorPct}% floor at every priced term`, `Below the ${floorPct}% floor at`),
      total: check('total', 'Client total never falls with a longer term', 'Client total falls at'),
      profit: check('profit', 'Profit never falls with a longer term', 'Profit falls at'),
    },
  }
}

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
