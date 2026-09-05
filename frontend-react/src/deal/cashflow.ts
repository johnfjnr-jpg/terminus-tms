import { closingCashPresentation } from '../../../src/lib/deal-inputs.js'
import { money } from './rows'

// ── THE CASH-FLOW GRID, AS A MODEL ───────────────────────────────────────
//
// Months across as columns, categories down as rows. The row SET is
// conditional - factoring, contractor staging and the missing-term state each
// change which rows exist - so the set is computed rather than fixed, and that
// is the part worth testing.

export interface CFCell { value: string; color: string }
export interface CFRow {
  label: string; cells: CFCell[]
  labelColor: string; weight: string; bg: string; total: boolean
}
export interface CashFlow {
  rows: { m: number; hardwareIn: number; hostingIn: number; advance: number; cashIn: number
    hwOut: number; contractorOut: number; hostOut: number; facP: number; facI: number
    cashOut: number; cashNet: number; cum: number }[]
  structure: string; annualInvoicing: boolean; factoringEnabled: boolean
  contractorStaged: boolean; factoringTermMissing: boolean
}

// ZERO RENDERS AS A DASH rather than "0". Cash-out categories are stored as
// positive magnitudes; `neg` controls the DISPLAY convention only.
const cellVal = (v: number, neg?: boolean): CFCell => {
  const r = Math.round(v)
  if (!r) return { value: '-', color: 'var(--muted-2)' }
  return { value: neg ? `-${money(r)}` : money(r), color: neg ? 'var(--muted)' : 'var(--white)' }
}

export function buildCashFlowRows(cf: CashFlow): CFRow[] {
  const cells = (fn: (r: CashFlow['rows'][0]) => number, neg?: boolean) => cf.rows.map((r) => cellVal(fn(r), neg))
  const blanks = (): CFCell[] => cf.rows.map(() => ({ value: '', color: 'var(--muted-2)' }))
  const list: CFRow[] = []
  const push = (label: string, rowCells: CFCell[], opts: { section?: boolean; total?: boolean } = {}) =>
    list.push({
      label, cells: rowCells,
      labelColor: opts.section ? 'var(--muted-2)' : 'var(--white)',
      weight: opts.total ? '500' : '400',
      bg: opts.section ? 'rgba(242,242,240,0.04)' : 'transparent',
      total: !!opts.total,
    })

  push('Cash in', blanks(), { section: true })
  push(cf.structure === 'hybrid' ? 'Milestone hardware payment'
    : (cf.annualInvoicing ? 'Hardware recovery, annual' : 'Hardware recovery'), cells((r) => r.hardwareIn))
  push(cf.annualInvoicing ? 'Hosting fee, annual in advance' : 'Hosting fee', cells((r) => r.hostingIn))
  if (cf.factoringEnabled) push('PO factoring advance', cells((r) => r.advance))
  push('Total cash in', cells((r) => r.cashIn), { total: true })

  push('Cash out', blanks(), { section: true })
  push(cf.contractorStaged ? 'Hardware and warranty' : 'Hardware, warranty and installation',
    cells((r) => r.hwOut, true))
  if (cf.contractorStaged) push('Contractor milestone payment', cells((r) => r.contractorOut, true))
  push('Hosting cost', cells((r) => r.hostOut, true))

  if (cf.factoringEnabled && cf.factoringTermMissing) {
    // THE THIRD SURFACE. With no term the schedule is empty, so principal and
    // interest would each print a full run of zeros for a facility that is
    // switched ON - a confident zero across the whole term. One row that says
    // so instead.
    push('Factoring, term not recorded', cf.rows.map(() => ({ value: '', color: 'var(--muted-2)' })))
  } else if (cf.factoringEnabled) {
    push('Factoring principal repayment', cells((r) => r.facP, true))
    push('Factoring interest', cells((r) => r.facI, true))
  }
  push('Total cash out', cells((r) => r.cashOut, true), { total: true })

  push('Net cash flow', cf.rows.map((r) => ({
    value: money(Math.round(r.cashNet)), color: r.cashNet < 0 ? '#e0824a' : 'var(--white)',
  })), { total: true })
  push('Cumulative cash position', cf.rows.map((r) => ({
    value: money(Math.round(r.cum)), color: r.cum < 0 ? '#e0824a' : 'var(--green)',
  })), { total: true })

  return list
}

// ── ONE READER FOR CLOSING CASH ─────────────────────────────────────────
// Round 41 W5: the grid computed its own and the two disagreed in four ways -
// no currency symbol, a bare minus, "0" for zero and "--" for absence against
// "not recorded". Both were invisible while a correct copy sat in the strip
// above. This asks the shared presenter.
export const closingCashText = (cf: CashFlow): string =>
  (closingCashPresentation(cf) as { text: string }).text
