// ── THE FACTORING-OFF BASELINE (TERM_FACTORING Phase 2, Phase 1 item 2) ──
//
//   node scripts/term-pricing/capture-factoring-off-baseline.mjs
//
// Writes scripts/term-pricing/factoring-off-baseline.json: every output of the
// term engine over a fixed population of inputs, as the engine computed it
// BEFORE PO factoring was added (captured at 0f493ae, engine unchanged since
// TP_MANUAL). term-pricing.test.mjs then prices the same population with
// factoring absent AND with factoring switched off, and requires every field
// the baseline holds to be identical. A field the new engine ADDS must be one
// of the factoring fields it names, carrying its "off" value.
//
// Why a capture and not the 126 spec tests alone: those assert the figures the
// spec prints. A change can move a figure the spec never prints (a schedule
// run boundary, a per-band total under CPI, a refusal's wording) and still pass
// all 126. This population asks the engine about everything it returns.
//
// Verification 47: the capture is this committed script, named in the file's
// own `source` field, and staleness is measured by recapture. A refusal is an
// output too, so an input that throws is recorded with its code and message.
//
// ── v2.0 (TP_LADDER A8, and John's golden-figures ruling) ────────────────
//
// RECAPTURED THROUGH THE ORACLE, NOT THE ENGINE UNDER TEST. The baseline is
// now every output of the FROZEN v1.10 engine (e123cf6) with only its
// list-fee read swapped for the price ladder (scripts/term-pricing/
// v1-oracle.mjs), on the v2.0 fixture ladders below. FA-8 then asks the v2.0
// engine to reproduce it field by field with factoring off: the formula's
// removal and the price ladder, the deal adjustment and COMPARE_TERM must move
// nothing the engine returned. Capturing with the new engine would compare it
// with itself. SUPERSEDED, left visible: captured at 0f493ae, the engine as at
// TP_MANUAL, before PO factoring; that claim holds transitively, because
// v1.10 reproduced it.
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  priceQuote, capexAllocation, termLadder, unitEconomics, TermPricingError,
} from '../../src/lib/term-pricing.js'
import { buildOracle, ORACLE_COMMIT } from './v1-oracle.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
export const BASELINE_PATH = join(HERE, 'factoring-off-baseline.json')

const SEED = [
  { from: 1, discountPct: '0' }, { from: 10, discountPct: '5' },
  { from: 50, discountPct: '10' }, { from: 200, discountPct: '15' },
]
const P4 = (v) => ({ safesight: v, 'TEST-B': v, air_quality: v, hemir: v })
// v2.0: the fixture ladders of term-pricing.test.mjs (v1.x's list fees to the
// cent; their derivation is recorded there). SUPERSEDED, left visible:
// ANCHOR_TERM 36, ANCHOR_MARGIN and SHORT_TERM_MARGIN 90%, PROFIT_STEP 0.00.
const LADDER = (s) => Object.fromEntries(s.trim().split(/\s+/).map((x) => x.split(':')))
export const PARAMS = {
  TERMS: [12, 24, 36, 48, 60, 72, 84, 96, 108, 120],
  COMPARE_TERM: 36,
  PRICE_LADDER_BY_PRODUCT: {
    safesight: LADDER('12:8666.67 24:5333.33 36:4222.22 48:3216.67 60:2613.33 72:2211.11 84:1923.81 96:1708.33 108:1540.74 120:1406.67'),
    'TEST-B': LADDER('12:2166.67 24:1333.33 36:1055.56 48:804.17 60:653.33 72:552.78 84:480.95 96:427.08 108:385.19 120:351.67'),
    air_quality: LADDER('12:2666.67 24:1833.33 36:1555.56 48:1191.67 60:973.33 72:827.78 84:723.81 96:645.83 108:585.19 120:536.67'),
    hemir: LADDER('12:88333.33 24:46666.67 36:32777.78 48:24708.33 60:19866.67 72:16638.89 84:14333.33 96:12604.17 108:11259.26 120:10183.33'),
  },
  VOLUME_BANDS_BY_PRODUCT: P4(SEED),
  HW_UPFRONT_MARGIN: '20',
  MARGIN_FLOOR: '25',
  CURRENCY: 'USD',
  costs: {
    safesight: { hwCost: '8000.00', hostingMonthly: '200.00' },
    'TEST-B': { hwCost: '2000.00', hostingMonthly: '50.00' },
    air_quality: { hwCost: '2000.00', hostingMonthly: '100.00' },
    hemir: { hwCost: '100000.00', hostingMonthly: '500.00' },
  },
}

const UNITS = [
  { safesight: 1 }, { safesight: 9 }, { safesight: 10 }, { safesight: 120 },
  { safesight: 250 }, { 'TEST-B': 30 }, { safesight: 120, 'TEST-B': 30 },
  { safesight: 120, air_quality: 40, hemir: 2 },
]
const MS3 = [
  { key: 'a', month: 0, sharePct: '30' }, { key: 'b', month: 3, sharePct: '40' }, { key: 'c', month: 6, sharePct: '30' },
]
const VARIANTS = {
  opex: {},
  opexPublished: { cpiMode: 'published', escalatorPct: '3', escalatorStartYear: 3 },
  opexLocked: { cpiMode: 'locked', escalatorPct: '3' },
  opexGrossUp: { whtPct: '10', whtGrossUp: true },
  opexBorneGst: { whtPct: '10', whtGrossUp: false, gstPct: '9' },
  opexSplit: { whtSplit: true, whtHwPct: '5', whtSaasPct: '10', whtGrossUp: true, cpiMode: 'locked', escalatorPct: '3' },
  capexDefault: { paymentStructure: 'capex' },
  capexTwoPhase: { paymentStructure: 'capex', capexStructure: 'two_phase', recoveryMonths: 12, whtPct: '10' },
  capexHybridLocked: { paymentStructure: 'capex', capexAmount: 'custom', capexCustom: '100000.00', milestones: MS3,
    cpiMode: 'locked', escalatorPct: '3', whtSplit: true, whtHwPct: '5', whtSaasPct: '10', gstPct: '9' },
  capexCustomPublished: { paymentStructure: 'capex', capexAmount: 'custom', capexCustom: '2000000.00',
    cpiMode: 'published', escalatorPct: '2.5', escalatorStartYear: 2, whtPct: '10', whtGrossUp: true },
}
const PREVIEWS = {
  incomplete: { paymentStructure: 'capex', capexAmount: 'custom', capexCustom: '1000000.00',
    milestones: [{ key: 'a', month: 0, sharePct: '50' }, { key: 'b', month: 4, sharePct: '30' }] },
  over: { paymentStructure: 'capex', milestones: [{ key: 'a', month: 0, sharePct: '70' }, { key: 'b', month: 2, sharePct: '50' }] },
  blank: { paymentStructure: 'capex', milestones: [{ key: 'a', month: 0, sharePct: '60' }, { key: 'b', month: 2, sharePct: '' }] },
}

/** The population: [id, kind, input]. Exported so the test prices the SAME list. */
export function population() {
  const out = []
  UNITS.forEach((units, u) => {
    const terms = u === 0 ? [12, 36, 60, 120] : [60]
    for (const T of terms) {
      for (const [v, extra] of Object.entries(VARIANTS)) {
        out.push([`quote u${u} T${T} ${v}`, 'quote', { units, termMonths: T, paymentStructure: 'opex', ...extra }])
      }
    }
    out.push([`ladder u${u}`, 'ladder', { units, perCameraProduct: 'safesight' }])
  })
  for (const [v, extra] of Object.entries(PREVIEWS)) {
    out.push([`preview demo ${v}`, 'preview', { units: UNITS[7], termMonths: 60, ...extra }])
  }
  out.push(['preview demo complete', 'preview', { units: UNITS[7], termMonths: 60, paymentStructure: 'capex', milestones: MS3 }])
  for (const T of PARAMS.TERMS) out.push([`unit safesight T${T}`, 'unit', { product: 'safesight', termMonths: T }])
  return out
}

/** One engine call, by kind; a refusal is recorded rather than thrown. */
export function run(kind, input, engine = { priceQuote, capexAllocation, termLadder, unitEconomics, TermPricingError }) {
  try {
    if (kind === 'quote') return engine.priceQuote(input, PARAMS)
    if (kind === 'preview') return engine.capexAllocation(input, PARAMS)
    if (kind === 'ladder') return engine.termLadder(input, PARAMS)
    if (kind === 'unit') return engine.unitEconomics(input.product, input.termMonths, PARAMS)
    throw new Error(`unknown kind ${kind}`)
  } catch (e) {
    if (e instanceof engine.TermPricingError) return { refused: { code: e.code, message: e.message } }
    throw e
  }
}

/** BigInt and fraction aware, key-sorted, so two captures compare as text. */
export function canonical(v) {
  if (typeof v === 'bigint') return `${v}n`
  if (Array.isArray(v)) return v.map(canonical)
  if (v && typeof v === 'object') {
    const keys = Object.keys(v)
    if (keys.length === 2 && typeof v.n === 'bigint' && typeof v.d === 'bigint') return `${v.n}/${v.d}`
    return Object.fromEntries(keys.sort().map((k) => [k, canonical(v[k])]))
  }
  return v
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const oracle = await import(buildOracle(join(HERE, '../../.scratch/derive-v2/oracle-engine')))
  const cases = population().map(([id, kind, input]) => ({ id, kind, output: canonical(run(kind, input, oracle)) }))
  writeFileSync(BASELINE_PATH, JSON.stringify({
    source: 'scripts/term-pricing/capture-factoring-off-baseline.mjs',
    capturedAt: `the v1.10 engine at ${ORACLE_COMMIT.slice(0, 7)} with only its list-fee read swapped for the price ladder (scripts/term-pricing/v1-oracle.mjs), on the v2.0 fixture ladders`,
    cases,
  }, null, 1) + '\n')
  const refused = cases.filter((c) => c.output?.refused).length
  console.log(`captured ${cases.length} cases (${refused} refusals) to ${BASELINE_PATH}`)
}
