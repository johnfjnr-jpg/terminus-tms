// ── TP_LADDER: AN INDEPENDENT PRICER FOR THE PRICE-ARITHMETIC GOLDENS ─────
//
// John's ruling, Phase 1 (2026-11-17): the golden figures that are PRICE
// ARITHMETIC are re-derived by an independent integer-cents script. This is
// that script. It is written from docs/pricing-spec.md sections 3.1, 4.2, 4.3,
// 4.5 and 10.4 alone, in integer cents and integer ratios, and imports nothing
// from the engine. It prices OPEX, Base, no CPI, no tax, no factoring: the
// figures a price-arithmetic case asserts, and nothing else. Anything else
// throws, so a case that strays into mechanics cannot be scored by it.
//
//   list fee      = the price ladder's price, in cents (prices are to the cent)
//   band fee      = round_half_up(list x (1 - discount), cents)          (4.2)
//   line monthly  = sum over bands of units_in_band x band fee           (4.3)
//   Base TCV      = monthly x T
//   cost per unit = round_half_up(HW_COST + HOSTING_MONTHLY x T, cents)
//   line cost     = units x cost per unit; profit = TCV - cost; margin = profit / TCV
//   per camera    = round_half_up(SafeSight monthly / SafeSight units)  (4.5)
//
// It exports the engine's names so the golden test file can be pointed at it
// by derive-v2-goldens.mjs; the formatters are its own. UNWIRED: a derivation
// tool, recorded as such.

export class TermPricingError extends Error {}
const no = (what) => () => { throw new Error(`independent pricer: ${what} is mechanics, not price arithmetic`) }
export const normaliseParams = no('normaliseParams')
export const articleFor = no('articleFor')
export const capexAllocation = no('capexAllocation')
export const loanSchedule = no('loanSchedule')
export const validateBands = no('validateBands')

const gcd = (a, b) => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a }
const ratio = (n, d) => { const g = gcd(n, d) || 1n; return d < 0n ? { n: -n / g, d: -d / g } : { n: n / g, d: d / g } }
/** Round num / den half away from zero, to an integer. */
const roundDiv = (num, den) => {
  const neg = (num < 0n) !== (den < 0n)
  const a = num < 0n ? -num : num, b = den < 0n ? -den : den
  let q = a / b
  if ((a % b) * 2n >= b) q += 1n
  return neg ? -q : q
}
/** A decimal string to [integer, scale]: "7.5" -> [75n, 10n]. */
const dec = (s) => {
  const t = String(s).replace(/,/g, '').trim()
  if (!/^\d+(\.\d+)?$/.test(t)) throw new Error(`not a decimal: ${s}`)
  const [w, f = ''] = t.split('.')
  return [BigInt(w + f), 10n ** BigInt(f.length)]
}
const cents = (s) => { const [n, sc] = dec(s); return roundDiv(n * 100n, sc) }

function bandsOf(params, product) {
  const list = params.VOLUME_BANDS_BY_PRODUCT?.[product]
  if (!list) throw new Error(`no bands for ${product}`)
  return list.map((b, i, a) => ({ from: Number(b.from), to: i + 1 < a.length ? Number(a[i + 1].from) - 1 : null, discountPct: String(b.discountPct) }))
}
const bandFee = (listCents, discountPct) => { const [n, sc] = dec(discountPct); return roundDiv(listCents * (100n * sc - n), 100n * sc) }
const listCentsOf = (params, product, T) => {
  const p = params.PRICE_LADDER_BY_PRODUCT?.[product]?.[String(T)]
  if (p == null) throw new Error(`no price ladder price for ${product} at ${T}`)
  return cents(p)
}
const costCentsOf = (params, product, T) => {
  const c = params.costs?.[product]
  if (!c) throw new Error(`no catalog cost for ${product}`)
  const [hw, hs] = dec(c.hwCost), [ho, os] = dec(c.hostingMonthly)
  return roundDiv((hw * os + ho * hs * BigInt(T)) * 100n, hs * os)
}
const margin = (profit, tcv) => (tcv === 0n ? ratio(0n, 1n) : ratio(profit, tcv))

export function unitEconomics(product, T, params) {
  const list = listCentsOf(params, product, T)
  const costCents = costCentsOf(params, product, T)
  const cmpT = params.COMPARE_TERM
  const cmpList = params.PRICE_LADDER_BY_PRODUCT?.[product]?.[String(cmpT)] != null ? listCentsOf(params, product, cmpT) : null
  return {
    product, termMonths: T, costCents,
    listFee: ratio(list, 100n),
    savingVsCompare: cmpList === null ? null : ratio(cmpList - list, cmpList),
    bands: bandsOf(params, product).map((b) => {
      const feeCents = bandFee(list, b.discountPct)
      const tcvCents = feeCents * BigInt(T)
      return { from: b.from, to: b.to, discountPct: b.discountPct, feeCents, tcvCents, profitCents: tcvCents - costCents, margin: margin(tcvCents - costCents, tcvCents) }
    }),
  }
}

export function priceQuote(input, params) {
  const T = input.termMonths
  for (const k of ['paymentStructure', 'cpiMode', 'escalatorPct', 'gstPct', 'whtPct', 'factoring', 'dealAdjustment', 'whtSplit']) {
    const v = input[k]
    if (v != null && v !== 'opex' && v !== 'none' && v !== false && v !== '') throw new Error(`independent pricer: ${k} is mechanics`)
  }
  const lines = Object.entries(input.units).filter(([, u]) => u >= 1).map(([product, units]) => {
    const list = listCentsOf(params, product, T)
    const cpu = costCentsOf(params, product, T)
    const bands = bandsOf(params, product).map((b) => {
      const top = b.to === null ? units : Math.min(units, b.to)
      const bu = Math.max(0, top - b.from + 1)
      const fee = bandFee(list, b.discountPct)
      const monthlyCents = BigInt(bu) * fee
      const tcvNetCents = monthlyCents * BigInt(T)
      const costCents = BigInt(bu) * cpu
      return { from: b.from, to: b.to, discountPct: b.discountPct, units: bu, feeByYear: [fee], monthlyCents, tcvNetCents, costCents,
        grossProfitCents: tcvNetCents - costCents, grossMargin: margin(tcvNetCents - costCents, tcvNetCents) }
    }).filter((b) => b.units > 0)
    const monthly = bands.reduce((s, b) => s + b.monthlyCents, 0n)
    const tcvNetCents = monthly * BigInt(T)
    const costCents = BigInt(units) * cpu
    return { product, units, listFee: ratio(list, 100n), costPerUnitCents: cpu, bands, monthlyByYear: [monthly], listMonthlyCents: monthly,
      tcvNetCents, costCents, grossProfitCents: tcvNetCents - costCents, grossMargin: margin(tcvNetCents - costCents, tcvNetCents) }
  })
  if (!lines.length) throw new Error('no units')
  const monthlyTotalCents = lines.reduce((s, l) => s + l.monthlyByYear[0], 0n)
  const tcvNetCents = monthlyTotalCents * BigInt(T)
  const totalCostCents = lines.reduce((s, l) => s + l.costCents, 0n)
  const grossMargin = margin(tcvNetCents - totalCostCents, tcvNetCents)
  const [fn, fs] = dec(params.MARGIN_FLOOR)
  return {
    termMonths: T, lines, monthlyTotalCents, tcvNetCents, totalCostCents, grossProfitCents: tcvNetCents - totalCostCents, grossMargin,
    belowMarginFloor: grossMargin.n * 100n * fs < fn * grossMargin.d,
  }
}

export function termLadder(input, params) {
  const terms = params.TERMS
  const cmpQ = priceQuote({ units: input.units, termMonths: params.COMPARE_TERM }, params)
  return terms.map((T) => {
    const q = priceQuote({ units: input.units, termMonths: T }, params)
    const line = input.perCameraProduct ? q.lines.find((l) => l.product === input.perCameraProduct) : null
    return {
      termMonths: T, priced: true, isCompare: T === params.COMPARE_TERM,
      perCameraCents: line ? roundDiv(line.monthlyByYear[0], BigInt(line.units)) : null,
      listMonthlyCents: q.monthlyTotalCents, monthlyTotalCents: q.monthlyTotalCents,
      savingVsCompare: ratio(cmpQ.monthlyTotalCents - q.monthlyTotalCents, cmpQ.monthlyTotalCents),
      tcvNetCents: q.tcvNetCents, grossMargin: q.grossMargin, belowMarginFloor: q.belowMarginFloor,
    }
  })
}

export function bandMarginGrid(product, bands, params) {
  const p = { ...params, VOLUME_BANDS_BY_PRODUCT: { ...params.VOLUME_BANDS_BY_PRODUCT, [product]: bands } }
  const [fn, fs] = dec(params.MARGIN_FLOOR)
  const rows = bandsOf(p, product).map((b, i) => ({ band: i + 1, from: b.from, to: b.to, discountPct: b.discountPct, cells: [] }))
  for (const T of params.TERMS) {
    unitEconomics(product, T, p).bands.forEach((b, i) => rows[i].cells.push({
      termMonths: T, priced: true, feeCents: b.feeCents, tcvCents: b.tcvCents, profitCents: b.profitCents, margin: b.margin,
      belowFloor: b.margin.n * 100n * fs < fn * b.margin.d,
    }))
  }
  return { ok: true, terms: params.TERMS, rows, breaches: rows.flatMap((r) => r.cells.filter((c) => c.belowFloor).map((c) => ({ band: r.band, termMonths: c.termMonths, feeCents: c.feeCents, margin: c.margin }))) }
}

export function formatMoney(c) {
  const neg = c < 0n, a = neg ? -c : c
  return `${neg ? '-' : ''}${(a / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${(a % 100n).toString().padStart(2, '0')}`
}
export function formatPct(r, places = 1) {
  const s = 10n ** BigInt(places)
  const v = roundDiv(r.n * 100n * s, r.d)
  const neg = v < 0n, a = neg ? -v : v
  return `${neg ? '-' : ''}${places ? `${a / s}.${(a % s).toString().padStart(places, '0')}` : a}`
}
