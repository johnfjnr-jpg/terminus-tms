// ── THE YEAR SCHEDULE ────────────────────────────────────────────────────
//
// A RE-GROUPING of the already-computed monthly cash-flow rows into 12-month
// buckets, never a fresh accrual calculation. The prototype re-derived it
// independently through a second helper that duplicated the finance model's
// logic - real drift risk in the source, deliberately not inherited.
import type { CashFlow } from './cashflow'

export interface YearBucket { label: string; value: number; monthly: number }

export function computeYearBuckets(
  cf: CashFlow, fieldFn: (r: CashFlow['rows'][0]) => number,
): YearBucket[] {
  const months = cf.rows.length
  const years: YearBucket[] = []
  for (let y = 0; y * 12 < months; y++) {
    const slice = cf.rows.slice(y * 12, Math.min((y + 1) * 12, months))
    const total = slice.reduce((s, r) => s + fieldFn(r), 0)
    years.push({
      label: `Year ${y + 1}`,
      value: Math.round(total),
      monthly: slice.length ? Math.round(total / slice.length) : 0,
    })
  }
  return years
}

export interface YearSchedule {
  kind: 'nonHybrid' | 'hybrid' | 'none'
  label: string
  years: YearBucket[]
  total: number
  /** `monthly` when invoicing is monthly, else the year's own total. */
  valueOf(y: YearBucket): number
  recoveryReadonly?: string
}

export function buildYearSchedule(
  cf: CashFlow, payload: Record<string, unknown>, structure: string, invoicing: string,
): YearSchedule {
  const scheduleLabel = (structure === 'hybrid' ? 'Hosting' : 'Invoiced fee')
    + (invoicing === 'annual' ? ', annual in advance' : ', monthly')
  const valueOf = (y: YearBucket) => (invoicing === 'monthly' ? y.monthly : y.value)

  // Single: the recovery row is a readout of the contract duration, and an
  // unset duration SAYS SO rather than showing a bare number.
  const recoveryReadonly = structure === 'single'
    ? (payload.duration ? `${payload.duration} months` : 'Contract duration not set')
    : undefined

  if (structure === 'hybrid') {
    // Hosting ONLY: hardware is milestone-driven under hybrid and would be
    // double-counted by a schedule that included it.
    const years = computeYearBuckets(cf, (r) => r.hostingIn)
    return { kind: 'hybrid', label: scheduleLabel, years,
      total: years.reduce((s, y) => s + y.value, 0), valueOf, recoveryReadonly }
  }
  const years = computeYearBuckets(cf, (r) => r.hardwareIn + r.hostingIn)
  if (!years.length) return { kind: 'none', label: scheduleLabel, years: [], total: 0, valueOf, recoveryReadonly }
  return { kind: 'nonHybrid', label: scheduleLabel, years,
    total: years.reduce((s, y) => s + y.value, 0), valueOf, recoveryReadonly }
}
