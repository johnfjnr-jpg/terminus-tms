// ── THE COST BASIS BLOCK ─────────────────────────────────────────────────
//
// Derived from renderCatalogNotice (opportunity-deal.js:445-550) and reading
// through the SAME `ageInDays` and `stalenessBand` the vanilla calls, so the
// two surfaces cannot disagree about when a catalog is stale.
//
// THE VALUE READS AT FULL WEIGHT AND THE AGE DOES NOT: the basis is a fact
// about this deal, the age is a warning that only sometimes applies.
import { ageInDays, stalenessBand } from '../../../src/lib/cost-basis.js'
import { PRODUCT_RATE_KEYS } from '../../../src/lib/base-costs.js'

export interface Batch { batch_label?: string, effective_from?: string }
export interface BasisView {
  text: string
  absent: boolean
  age: string
  ageBand: string
  warning: string
}

const PRODUCT_LABELS: Record<string, string> = {
  safesight: 'SafeSight', air_quality: 'AQ Sensor', hemir: 'HEMIR',
}

// ── THE PER-KEY GAP, COST_CALC_AUDIT.md F4 ───────────────────────────────
//
// `missing` above is per PRODUCT: it fires when a product has no current batch
// at all. A product row that EXISTS but carries a null install or hosting
// column is NOT missing, so that warning cannot see it, while the line it feeds
// still prices at $0 through the `?? 0` in buildDealInputs.
//
// Measured: a SafeSight row present with a null install_cost_new produced
// `missing: ["air_quality","hemir"]` and a total $4,000 light. The warning named
// the two products that were not the problem.
//
// resolveRates already computed this per-KEY absence and NOTHING READ IT. This
// reads it rather than deriving a second answer to the same question.
const RATE_LABELS: Record<string, string> = {
  ssUnitCost: 'SafeSight unit cost', aqUnitCost: 'AQ Sensor unit cost', hemirUnitCost: 'HEMIR unit cost',
  hoSafesight: 'SafeSight hosting', hoAqm: 'AQ Sensor hosting', hoHemir: 'HEMIR hosting',
  inSsExisting: 'SafeSight installation, existing infrastructure',
  inSsNew: 'SafeSight installation, new infrastructure',
  inAqm: 'AQ Sensor installation', inHemir: 'HEMIR installation',
}
const RATE_OWNER: Record<string, string> = Object.fromEntries(
  Object.entries(PRODUCT_RATE_KEYS as Record<string, Record<string, string>>)
    .flatMap(([product, keys]) => Object.values(keys).map((k) => [k, product])),
)

export function buildBasis(
  batchMap: Record<string, Batch>,
  missing: string[],
  asOf: string | null,
  error: string | null,
  bidCurrency: unknown,
  absentRateKeys: string[] = [],
): BasisView {
  const problems: string[] = []
  // The zero has a wording: $0 because no rate could be read, not because
  // anything is free.
  if (error) {
    problems.push(`${error} Every cost below is $0 because no rate could be read, not because anything is free.`)
  } else if (missing.length) {
    problems.push(
      `Base Cost Data has no current batch for ${missing.map((m) => PRODUCT_LABELS[m] ?? m).join(' and ')}. `
      + `${missing.length === 1 ? 'That product’s cost' : 'Those products’ costs'} reads $0 because no rate exists, not because it is free.`)
  }
  // Keys whose own product is already named above would say the same thing
  // twice, so only the ones that warning CANNOT see are reported here.
  const unseen = absentRateKeys.filter((k) => RATE_LABELS[k] && !missing.includes(RATE_OWNER[k] ?? ''))
  if (!error && unseen.length) {
    const names = unseen.map((k) => RATE_LABELS[k])
    problems.push(
      `Base Cost Data has no rate for ${names.join(', ')}. `
      + `${names.length === 1 ? 'That line reads' : 'Those lines read'} $0 because no rate exists, not because it is free.`)
  }
  const bid = bidCurrency as string | undefined
  if (bid && bid !== 'USD') {
    problems.push(`Bid Currency is ${bid}, and Base Cost Data is held in USD. `
      + 'The costs below are USD figures and have not been converted.')
  }

  const batches = Object.values(batchMap ?? {})
  if (!batches.length) {
    return { text: 'not recorded', absent: true, age: '', ageBand: '', warning: problems.join(' ') }
  }

  const dates = [...new Set(batches.map((b) => b.effective_from))]
  const names = [...new Set(batches.map((b) => b.batch_label))]
  const said = (d?: string) => (d || 'date not recorded')
  const sorted = dates.slice().filter(Boolean).sort() as string[]
  const text = dates.length === 1 && names.length === 1
    ? `${names[0]} · effective ${said(dates[0])}`
    : sorted.length
      ? `${batches.length} current batches · effective ${sorted[0]} to ${sorted[sorted.length - 1]}`
      : `${batches.length} current batches · effective date not recorded`

  const ages = batches
    .map((b) => ageInDays(b.effective_from ?? '', asOf ?? '') as number)
    .filter((d) => Number.isFinite(d))
  const band = stalenessBand(ages.length ? Math.max(...ages) : null) as { band: string, statement: string }
  return {
    text,
    absent: false,
    age: band.band === 'current' ? '' : band.statement,
    ageBand: band.band === 'current' ? '' : `deal-catalog-${band.band}`,
    warning: problems.join(' '),
  }
}
