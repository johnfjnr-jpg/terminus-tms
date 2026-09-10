// THE HEADER STRIP'S VALUES, DERIVED IN ONE PLACE.
//
// Pure: no DOM, no fetch, so the rules are testable without a browser and the
// component stays a renderer.
// The React tree's own map, not the server's UNIT_TYPE_COUNT_KEYS. The two
// exist and units.ts already records why, with a test proving them inverse:
// two hand-written tables agree today and drift later. This side reads the
// map that belongs to it.
import { COUNT_KEY_TO_UNIT_TYPE } from './units'

export interface StatCell { label: string, value: string, overdue?: boolean }

const money = (n: unknown): string => {
  const v = Number(n)
  if (!Number.isFinite(v) || n === null || n === undefined || n === '') return '--'
  return `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

const date = (s: unknown): string =>
  (typeof s === 'string' && s.trim()) ? s : '--'

/** Today as an ISO date, injectable so the overdue rule is testable. */
export const todayIso = (now: Date = new Date()): string => now.toISOString().slice(0, 10)

/**
 * R10's READ side: the contracted end date is overdue when today is past it.
 * Nothing is stored and no flag is written - this is computed at render.
 */
export function isOverdue(estGoLiveDate: unknown, today = todayIso()): boolean {
  return typeof estGoLiveDate === 'string' && estGoLiveDate.trim() !== '' && estGoLiveDate < today
}

/**
 * R12: HM is SUPPRESSED. The cell shows SafeSight and Air Quality, and the
 * HEMIR slot renders ONLY when hemirSensors carries data - no zero is shown
 * for a field no live Test Bed uses.
 *
 * Read from UNIT_TYPE_COUNT_KEYS rather than naming three keys here, so a
 * fourth unit type is picked up instead of silently omitted.
 */
export function hardwareCounts(payload: Record<string, unknown>): Array<{ type: string, count: number }> {
  const rows: Array<{ type: string, raw: unknown }> =
    Object.entries(COUNT_KEY_TO_UNIT_TYPE).map(([key, type]) => ({ type, raw: payload?.[key] }))
  return rows
    .filter((r) => r.type !== 'HEMIR' || (r.raw !== undefined && r.raw !== null && r.raw !== ''))
    .map((r) => ({ type: r.type, count: Number(r.raw) || 0 }))
}

/** The five cells, in the order of record: cost, duration, hardware, start, end. */
export function headerStats(payload: Record<string, unknown>, today = todayIso()): {
  cells: StatCell[]
  hardware: Array<{ type: string, count: number }>
  overdue: boolean
} {
  const overdue = isOverdue(payload?.estGoLiveDate, today)
  const months = payload?.testBedDuration
  return {
    // `accumulated_cost` per R4: it is what the carry-forward already passes
    // to an Opportunity, so the header and the carry-forward read one field.
    cells: [
      { label: 'Total cost', value: money(payload?.accumulated_cost) },
      { label: 'Duration', value: (months === undefined || months === null || months === '') ? '--' : `${months} months` },
      { label: 'Hardware', value: '' },
      { label: 'Est. start', value: date(payload?.estimatedInstallationDate) },
      { label: 'Contracted end', value: date(payload?.estGoLiveDate), overdue },
    ],
    hardware: hardwareCounts(payload ?? {}),
    overdue,
  }
}
