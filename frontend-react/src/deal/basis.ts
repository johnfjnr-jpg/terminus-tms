// ── THE COST BASIS BLOCK ─────────────────────────────────────────────────
//
// Derived from renderCatalogNotice (opportunity-deal.js:445-550) and reading
// through the SAME `ageInDays` and `stalenessBand` the vanilla calls, so the
// two surfaces cannot disagree about when a catalog is stale.
//
// THE VALUE READS AT FULL WEIGHT AND THE AGE DOES NOT: the basis is a fact
// about this deal, the age is a warning that only sometimes applies.
import { ageInDays, stalenessBand } from '../../../src/lib/cost-basis.js'

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

export function buildBasis(
  batchMap: Record<string, Batch>,
  missing: string[],
  asOf: string | null,
  error: string | null,
  bidCurrency: unknown,
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
