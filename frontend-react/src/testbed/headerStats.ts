// THE HEADER STRIP'S VALUES, DERIVED IN ONE PLACE.
//
// Pure: no DOM, no fetch, so the rules are testable without a browser and the
// component stays a renderer.
// The React tree's own map, not the server's UNIT_TYPE_COUNT_KEYS. The two
// exist and units.ts already records why, with a test proving them inverse:
// two hand-written tables agree today and drift later. This side reads the
// map that belongs to it.
import { COUNT_KEY_TO_UNIT_TYPE } from './units'
import { money } from './money'
import { formatDate as fmtDate } from '../../../src/lib/format-dates.js'

export interface StatCell { label: string, value: string, overdue?: boolean }

// Q2, ruled: ONE formatter. This was a module-local copy; the cost breakdown
// needed the same one, and two definitions of one format on one screen is the
// thing Verification 20 is about. Imported now, defined in `money.ts`.

// R7: this was a PASSTHROUGH - it returned the stored string unchanged, so
// Est. start and Contracted end rendered YYYY-MM-DD. A passthrough is a raw
// render wearing a function's name, which is why the census counted it.
const date = (s: unknown): string => fmtDate(s) || '--'

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
      // ── Q1-A, RULED 2026-09-15: THIS TOTAL SAYS IT IS THE SAVED ONE ────
      //
      // Restoring the cost breakdown puts a SECOND Total Cost on this screen,
      // in the Cost summary card, and the two are read from different places
      // on purpose: this one is `accumulated_cost`, the persisted mirror, and
      // that one is `costBreakdown.totalCost`, recomputed from whatever is
      // currently typed.
      //
      // WHILE AN EDIT IS OPEN THEY WILL LEGITIMATELY DIFFER, and that is the
      // point rather than a defect: one is what is stored and one is what is
      // being typed. What was wrong is that neither said which it was
      // (Verification 20, two readers of one value).
      //
      // The collision is NEW and this round created it. The header strip
      // landed 2026-09-10, after the breakdown had already been dropped at the
      // swap, so the two have never been on screen together until now - which
      // is build discipline 10's limit: a finding your own change creates is
      // part of the change.
      { label: 'Total cost (saved)', value: money(payload?.accumulated_cost) },
      { label: 'Duration', value: (months === undefined || months === null || months === '') ? '--' : `${months} months` },
      { label: 'Hardware', value: '' },
      { label: 'Est. start', value: date(payload?.estimatedInstallationDate) },
      { label: 'Contracted end', value: date(payload?.estGoLiveDate), overdue },
    ],
    hardware: hardwareCounts(payload ?? {}),
    overdue,
  }
}
