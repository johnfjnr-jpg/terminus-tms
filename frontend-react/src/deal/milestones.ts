import { toNumberOrNull } from '../../../src/lib/numeric-payload.js'
import { scheduleReconciliation, milestoneUsd } from '../../../src/lib/milestone-schedule.js'
import { money } from './rows'
import { readContractorMilestones } from './payload'
import type { Values } from './payload'

// ── THE TWO MILESTONE GRIDS ──────────────────────────────────────────────
//
// CORRECTED AT R-W12, 2026-09-20, AND THE FALSE SENTENCE IS KEPT SO THE NEXT
// READER CAN SEE WHAT IT CLAIMED. It read:
//
//   "They are the SAME COMPONENT with different bases."
//
// They were not, and had not been for some time: `MilestoneGrid` rendered
// four inputs and `ContractorGrid` rendered a table with a `<select>` in its
// second column. Nothing could have failed on the sentence - it describes
// two components and is checked by neither - which is why it survived.
//
// THEY ARE TWO COMPONENTS WITH ONE VOCABULARY AND ONE SHAPE. Both read
// Month | Milestone | % | Amount, both take their milestone names from the
// list below, and in both the money is COMPUTED from the percentage, because
// a schedule is negotiated in percentages on both sides of the deal. The
// customer grid's base is the one-off price; the contractor grid's is the raw
// lump sum cost.

/**
 * A fixed list, and it is a census fact carried as data.
 *
 * THESE ARE THE PROTOTYPE'S OWN SIX, in its own order, from the
 * `projectMilestone` picklist at `Terminus Ops.dc.html:5592`. Phase 0 measured
 * the live data against them: 13 of 13 named contractor rows are one of these
 * and none is anything else.
 *
 * QUEUED, NOT BUILT (John, R-W12): this could be a vocabulary TABLE, the way
 * `contact_roles`, `contact_stances`, `industries` and `closed_lost_reasons`
 * already are - a small table with `id, label, sort_order` and a GET route.
 * That is a schema change and a configuration decision; the constant is
 * neither, and it is what both grids read today.
 */
export const CONTRACTOR_MILESTONES = [
  'Contract start',
  'Hardware delivered to site',
  'Installation complete',
  'Commissioning',
  'Go live',
  'Final acceptance',
] as const

export interface MilestoneOption { value: string; label: string; unknown: boolean }

/**
 * AN UNRECOGNISED STORED VALUE KEEPS ITS OWN OPTION rather than being silently
 * reset to blank. Existing deals hold free text, and a dropdown that quietly
 * discarded it would lose what somebody entered.
 */
export function milestoneOptions(selected?: string | null): MilestoneOption[] {
  const chosen = selected ?? ''
  const known = (CONTRACTOR_MILESTONES as readonly string[]).includes(chosen)
  const extra = chosen && !known ? [chosen] : []
  return [
    { value: '', label: 'Select milestone', unknown: false },
    ...CONTRACTOR_MILESTONES.map((m) => ({ value: m, label: m, unknown: false })),
    ...extra.map((m) => ({ value: m, label: `${m} (not in the list)`, unknown: true })),
  ]
}

/** R-N1: the shared derivation. It computed its own copy of the same rule. */
export const pctToUsd = (pct: number, base: number): number => milestoneUsd(pct, base)
export const usdToPct = (usd: number, base: number): number | null => (base ? (usd / base) * 100 : null)

/**
 * The CUSTOMER grid: the percentage is typed and the dollars follow, from the
 * hardware and installation total.
 *
 * TWO DECIMALS, because a percentage of a six-figure total lands on cents and
 * rounding it away would make the column not sum.
 */
export function milestoneUsdFor(pctRaw: string | undefined, oneOffPrice: number): string {
  const pct = toNumberOrNull(pctRaw) as number | null
  // R-N1: THE SHARED DERIVATION, FORMATTED. It computed its own
  // `(pct / 100) * oneOffPrice` here, which is a second reader of the rule
  // even while it agreed. The cell now formats the one derivation the
  // reconciliation and the cash flow read.
  return (pct === null || !oneOffPrice) ? '' : milestoneUsd(pct, oneOffPrice).toFixed(2)
}

/**
 * The CONTRACTOR grid's round trip. Which side the person typed on decides
 * which side follows, and a zero base does nothing at all rather than writing
 * zeros over what is there.
 *
 * ENOUGH PLACES THAT 100.008% CANNOT PRINT AS 100.0%, with trailing zeroes
 * trimmed so an exact 25% reads as "25" rather than "25.0000".
 */
export function syncContractorRow(
  values: Values, i: number, typed: 'pct' | 'usd', base: number,
): { id: string; value: string } | null {
  if (!base) return null
  if (typed === 'pct') {
    const pct = toNumberOrNull(values[`deal-cm-${i}-pct`]) as number | null
    return { id: `deal-cm-${i}-usd`, value: pct === null ? '' : String(pctToUsd(pct, base)) }
  }
  const usd = toNumberOrNull(values[`deal-cm-${i}-usd`]) as number | null
  const pct = usd === null ? null : usdToPct(usd, base)
  return { id: `deal-cm-${i}-pct`, value: pct === null ? '' : String(Number(pct.toFixed(4))) }
}

export interface ReconciliationView {
  /** Kept for any reader that wants the whole sentence. W10 renders the pair. */
  baseLine: string
  baseLabel: string
  baseFigure: string
  totalUsd: string
  totalPct: string
  statement: string | null
  off: boolean
  warning: string | null
}

/**
 * THE TOTAL PERCENTAGE MAY NOT ROUND ITSELF INTO AGREEMENT.
 *
 * `.toFixed(1)` printed 100.008% as "100.0%" - the one number whose job is to
 * say the schedule does not add up, rounded until it said it did, and a $20
 * overrun saved without a word. Verification 21.
 *
 * AND THE TWO REFUSALS ARE SEPARATE because they are fixed differently: an
 * INCOMPLETE row wants a date, a non-reconciling total wants the numbers to add
 * up. Incomplete leads, because a dateless row also skews the sum and reporting
 * only the arithmetic would send somebody to the wrong column.
 */
export function contractorReconciliation(values: Values, lumpCost: number): ReconciliationView {
  const rec = scheduleReconciliation(readContractorMilestones(values), lumpCost) as {
    base: number; totalUsd: number; exact: boolean; reconciles: boolean
    statement: string | null; hasSchedule: boolean; issuable: boolean; incomplete: number
  }
  const totalPct = rec.base ? (rec.totalUsd / rec.base) * 100 : 0
  return {
    // W10, ruled 2026-09-20: the LABEL and the FIGURE are separate, so the
    // figure can sit in the Amount column with the money it belongs to. It
    // was one sentence with the number inside it - "Lump sum contractor
    // price, $250,000" - left-aligned across the whole panel, so there was no
    // figure to align and nothing to align it to.
    baseLine: `Lump sum contractor price, $${money(lumpCost)}`,
    baseLabel: 'Lump sum contractor price',
    baseFigure: `$${money(lumpCost)}`,
    totalUsd: `$${money(rec.totalUsd)}`,
    totalPct: rec.exact ? '100%' : `${Number(totalPct.toFixed(4))}%`,
    statement: rec.statement,
    off: !rec.reconciles,
    warning: rec.hasSchedule && !rec.issuable
      ? (rec.incomplete > 0
        ? `${rec.incomplete} contractor milestone${rec.incomplete === 1 ? '' : 's'} carry an amount and no month. A version cannot be taken until every row has a month.`
        : 'This schedule does not reconcile, so a version cannot be taken from it.')
      : null,
  }
}

/** The CUSTOMER schedule's warning, against the one-off price. */
export function customerScheduleWarning(
  milestones: { month?: number; usd?: number; pct?: number | null }[], oneOffPrice: number,
): string | null {
  const rec = scheduleReconciliation(milestones, oneOffPrice) as {
    hasSchedule: boolean; exact: boolean; totalUsd: number; base: number; statement: string | null
  }
  if (!rec.hasSchedule || rec.exact) return null
  return `Customer milestones total $${money(rec.totalUsd)} against a `
    + `hardware and installation price of $${money(rec.base)}. ${rec.statement}`
}
