// ── THE TERM PRICING ENGINE ──────────────────────────────────────────────
//
// Implements docs/pricing-spec.md (Specification v1.3) exactly. CLAUDE.md
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

// ── Parameters (spec section 3) ──────────────────────────────────────────

/**
 * Validates and converts the admin parameters and catalog costs.
 *
 * params = {
 *   TERMS: [12, 24, ...], ANCHOR_TERM: 36,
 *   ANCHOR_MARGIN: { safesight: '90', ... }, SHORT_TERM_MARGIN: { ... },
 *   PROFIT_STEP: '0.00',
 *   VOLUME_BANDS: [{ from: 1, discountPct: '0' }, { from: 10, discountPct: '5' }, ...],
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

  const bands = (params.VOLUME_BANDS ?? []).map((b, i) => ({
    from: safeInt(b.from, `VOLUME_BANDS[${i}].from`),
    discount: pctToRatio(b.discountPct, `VOLUME_BANDS[${i}].discountPct`),
    discountPct: b.discountPct,
  }))
  if (!bands.length || bands[0].from !== 1) throw new TermPricingError('BAD_PARAM', 'VOLUME_BANDS must start at unit 1')
  for (let i = 1; i < bands.length; i++) {
    if (bands[i].from <= bands[i - 1].from) throw new TermPricingError('BAD_PARAM', 'VOLUME_BANDS must be ascending')
  }
  bands.forEach((b, i) => { b.to = i + 1 < bands.length ? bands[i + 1].from - 1 : null })

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
    bands,
    hwUpfrontMargin: hwUpfront,
    marginFloor: pctToRatio(params.MARGIN_FLOOR, 'MARGIN_FLOOR'),
    currency: params.CURRENCY,
    costs,
  }
}

const isNormalised = (p) => p && Array.isArray(p.terms) && Array.isArray(p.bands)
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
  return { cost, am, sm }
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

function splitIntoBands(p, units) {
  return p.bands.map((b) => {
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
  const { cost } = productParams(p, product)
  const listFee = listFeeAt(p, product, T)
  const costCents = roundHalfUp(costAt(cost, T), 2)
  return {
    product,
    termMonths: T,
    listFee,
    costCents,
    savingVsAnchor: sub(ONE, div(listFee, listFeeAt(p, product, p.anchorTerm))),
    bands: p.bands.map((b) => {
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

// ── The quote: sections 4.3, 4.4, 6, 7, 8 ────────────────────────────────

/**
 * input = {
 *   units: { safesight: 120, ... },     integers >= 0, at least one >= 1
 *   termMonths: 60,                     one of TERMS
 *   paymentStructure: 'opex' | 'capex',
 *   escalatorPct: '3' | null,           blank or 0 means none
 *   escalatorStartYear: 2,              v1.3 (B6): the year it first applies, >= 2, default 2
 *   gstPct: '9', whtPct: '10', whtGrossUp: true,
 *   whtSplit: false,                    v1.3 (B4): on, whtHwPct and whtSaasPct replace whtPct
 *   whtHwPct: '5', whtSaasPct: '10',
 * }
 */
export function priceQuote(input, params) {
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

  const escalator = input.escalatorPct == null || input.escalatorPct === ''
    ? ZERO : pctToRatio(input.escalatorPct, 'escalator_pct')
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
    const { cost } = productParams(p, product)
    const listFee = listFeeAt(p, product, T)
    const bands = splitIntoBands(p, units).filter((x) => x.units > 0).map(({ band, units: bu }) => {
      const fee1 = bandFeeCents(listFee, band)
      const feeByYear = []
      for (let k = 1; k <= years; k++) feeByYear.push(roundHalfUp(mul(fromCents(fee1), factor(k)), 2))
      return { from: band.from, to: band.to, discountPct: band.discountPct, units: bu, feeByYear }
    })
    const monthlyByYear = []
    for (let k = 0; k < years; k++) monthlyByYear.push(bands.reduce((s, b) => s + BigInt(b.units) * b.feeByYear[k], 0n))
    return {
      product, units, listFee,
      savingVsAnchor: sub(ONE, div(listFee, listFeeAt(p, product, p.anchorTerm))),
      costPerUnitCents: roundHalfUp(costAt(cost, T), 2),
      hwCostPerUnit: cost.hw,
      bands, monthlyByYear,
    }
  })

  const monthlyTotalByYear = []
  for (let k = 0; k < years; k++) monthlyTotalByYear.push(lines.reduce((s, l) => s + l.monthlyByYear[k], 0n))

  // The tie rule: TCV is the invoiced fees times months, exactly.
  let tcvNetCents = 0n
  for (let k = 1; k <= years; k++) tcvNetCents += monthlyTotalByYear[k - 1] * BigInt(monthsInYear(k))

  const totalCostCents = lines.reduce((s, l) => s + BigInt(l.units) * l.costPerUnitCents, 0n)
  const grossProfitCents = tcvNetCents - totalCostCents
  const grossMargin = frac(grossProfitCents, tcvNetCents)

  // Section 6: the payment schedule, net of tax. Rows are runs of identical
  // invoices: month 0 is the CAPEX upfront invoice.
  //
  // Both structures bill one fee per contract year. Consecutive years with the
  // same fee (no escalator) merge into one run, so a flat deal reads as one row.
  const yearRows = (feeByYear) => {
    const rows = []
    for (let k = 1; k <= years; k++) {
      const from = 12 * (k - 1) + 1
      const to = 12 * (k - 1) + monthsInYear(k)
      const last = rows[rows.length - 1]
      if (last && last.netCents === feeByYear[k - 1]) last.toMonth = to
      else rows.push({ kind: 'monthly', fromMonth: from, toMonth: to, netCents: feeByYear[k - 1] })
    }
    return rows
  }
  // Section 6's hardware amount, at HW_UPFRONT_MARGIN. CAPEX invoices it
  // upfront; v1.3 section 8.1 also uses it for the OPEX hardware line.
  const hardwareUpfront = lines.reduce(
    (s, l) => add(s, div(mul(fromInt(l.units), l.hwCostPerUnit), sub(ONE, p.hwUpfrontMargin))), ZERO)
  let schedule
  let capex = null
  if (structure === 'opex') {
    schedule = yearRows(monthlyTotalByYear)
  } else {
    // v1.2.2 section 6: the service fee escalates like the OPEX fee and TCV is
    // the OPEX TCV. The weight is 12 x sum of the year factors in the spec; it
    // is written as months-in-year x factor, which is identical for every term
    // that is a whole number of years and stays consistent with section 7's
    // own year split if a TERMS entry ever is not.
    let weight = ZERO
    for (let k = 1; k <= years; k++) weight = add(weight, mul(fromInt(monthsInYear(k)), factor(k)))
    const s = div(sub(fromCents(tcvNetCents), hardwareUpfront), weight)
    const serviceByYear = []
    for (let k = 1; k <= years; k++) serviceByYear.push(roundHalfUp(mul(s, factor(k)), 2))
    const upfrontCents = tcvNetCents - serviceByYear.reduce((t, c, i) => t + c * BigInt(monthsInYear(i + 1)), 0n)
    capex = { hardwareUpfront, upfrontCents, monthlyServiceCents: serviceByYear[0], serviceByYear }
    schedule = [{ kind: 'upfront', fromMonth: 0, toMonth: 0, netCents: upfrontCents }, ...yearRows(serviceByYear)]
  }

  // Section 8: tax per invoice line, half-up to cents. WHT applies to the fee
  // before GST. With gross-up the line rises so Terminus receives its net.
  //
  // v1.3 section 8.1 (B3, B4): every WHT rate is typed, 0 up to but not
  // including 100, blank 0. With the split OFF one rate applies to every line
  // and an OPEX month is ONE line, which is what keeps T20 and T21 exact (two
  // lines round twice). With it ON, hardware takes whtHwPct and software as a
  // service whtSaasPct: under CAPEX the upfront and the monthly invoices, under
  // OPEX two lines on each monthly invoice.
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
  const taxLine = (netCents, r) => {
    const invoiceCents = grossUp && cmp(r, ZERO) > 0 ? roundHalfUp(div(fromCents(netCents), sub(ONE, r)), 2) : netCents
    const whtCents = roundHalfUp(mul(fromCents(invoiceCents), r), 2)
    const gstCents = roundHalfUp(mul(fromCents(invoiceCents), gst), 2)
    return { netCents, invoiceCents, gstCents, whtCents, receivedCents: invoiceCents - whtCents }
  }
  // Flat for the term (B4): an escalator raises the service line only.
  const hardwareLineCents = structure === 'opex' && split ? roundHalfUp(div(hardwareUpfront, fromInt(T)), 2) : null
  const totals = { invoicedCents: 0n, netCents: 0n, gstCents: 0n, whtCents: 0n, whtBorneCents: 0n, receivedCents: 0n }
  schedule = schedule.map((row) => {
    const count = BigInt(row.toMonth - row.fromMonth + 1)
    let parts
    if (hardwareLineCents !== null) {
      const serviceCents = row.netCents - hardwareLineCents
      if (serviceCents < 0n) {
        throw new TermPricingError('NEGATIVE_SERVICE_LINE',
          `The hardware line (${formatMoney(hardwareLineCents)} a month) is more than the month's fee (${formatMoney(row.netCents)}), so the service line would be negative. Turn Split WHT off, or review the hardware margin.`)
      }
      parts = [{ kind: 'hardware', ...taxLine(hardwareLineCents, whtHw) }, { kind: 'service', ...taxLine(serviceCents, whtSaas) }]
    } else {
      parts = [taxLine(row.netCents, row.kind === 'upfront' ? whtHw : whtSaas)]
    }
    const sum = (k) => parts.reduce((t, x) => t + x[k], 0n)
    const invoiceCents = sum('invoiceCents'), gstCents = sum('gstCents'), whtCents = sum('whtCents')
    const out = {
      ...row, count: Number(count),
      invoiceCents, gstCents, invoiceInclGstCents: invoiceCents + gstCents,
      whtCents, whtBorne: !grossUp, receivedCents: invoiceCents - whtCents,
      ...(parts.length > 1 ? { lines: parts.map((x) => ({ ...x, invoiceInclGstCents: x.invoiceCents + x.gstCents })) } : {}),
    }
    totals.invoicedCents += invoiceCents * count
    totals.netCents += row.netCents * count
    totals.gstCents += gstCents * count
    totals.whtCents += whtCents * count
    if (!grossUp) totals.whtBorneCents += whtCents * count
    totals.receivedCents += out.receivedCents * count
    return out
  })

  return {
    termMonths: T,
    paymentStructure: structure,
    escalatorStartYear: startYear,
    whtSplit: split,
    currency: p.currency,
    lines,
    monthlyTotalCents: monthlyTotalByYear[0],
    monthlyTotalByYear,
    tcvNetCents,
    totalCostCents,
    grossProfitCents,
    grossMargin,
    marginFloor: p.marginFloor,
    belowMarginFloor: cmp(grossMargin, p.marginFloor) < 0,
    // Q4 (John, 2026-10-01): shown whenever WHT is borne. Gross profit less the
    // WHT Terminus bears, over TCV net. Null when nothing is borne, so a screen
    // cannot show it by accident beside a gross-up or a zero rate.
    marginAfterWht: totals.whtBorneCents > 0n
      ? frac(grossProfitCents - totals.whtBorneCents, tcvNetCents) : null,
    capex,
    schedule,
    // L1 (John, layout approval): the WHT gross-up is what the invoices carry
    // above their nets, so TCV (net) + grossUpCents + GST = TCV incl. GST
    // exactly. Zero whenever gross-up is off.
    tax: {
      ...totals,
      grossUpCents: totals.invoicedCents - totals.netCents,
      tcvInclGstCents: totals.invoicedCents + totals.gstCents,
    },
  }
}

/**
 * The term ladder: the same inputs priced at every offered term, each row a
 * full quote, so a row's figures are the quote card's figures at that term.
 *
 * The saving or premium compares year-1 fees with the anchor term's (section
 * 7: the client-facing saving always quotes year-1 fees). Under OPEX that is
 * the monthly total; under CAPEX it is the monthly service fee, and the row
 * carries the upfront beside it (A1, John 2026-10-01).
 */
export function termLadder(input, params) {
  const p = norm(params)
  const feeOf = (q) => (q.capex ? q.capex.monthlyServiceCents : q.monthlyTotalCents)
  const anchor = priceQuote({ ...input, termMonths: p.anchorTerm }, p)
  return p.terms.map((T) => {
    const q = priceQuote({ ...input, termMonths: T }, p)
    return {
      termMonths: T,
      isAnchor: T === p.anchorTerm,
      paymentStructure: q.paymentStructure,
      monthlyTotalCents: q.monthlyTotalCents,
      upfrontCents: q.capex ? q.capex.upfrontCents : null,
      monthlyServiceCents: q.capex ? q.capex.monthlyServiceCents : null,
      savingVsAnchor: sub(ONE, frac(feeOf(q), feeOf(anchor))),
      tcvNetCents: q.tcvNetCents,
      grossMargin: q.grossMargin,
      belowMarginFloor: q.belowMarginFloor,
    }
  })
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
