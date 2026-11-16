// COMMERCIALS_FACTORING (John 2026-11-16): the statement and the cash flow grid,
// R-CF3 to R-CF5. G3 is priced as the goldens price it, its contract or rate
// changed; the sentences are the ruled wording, copied from the sign-off.
import { describe, it, expect } from 'vitest'
import { buildDealStatement } from '../deal/statement'
import type { StatementResult } from '../deal/statement'
import { buildCashFlowRows } from '../deal/cashflow'
import type { CashFlow } from '../deal/cashflow'
import { priceGoldenDeal } from '../../../scripts/golden-deals/engine.mjs'
import { G3 } from '../../../scripts/golden-deals/deals.mjs'

type Payload = Record<string, unknown> & { factoring: Record<string, unknown> }
const g3 = (over: Record<string, unknown> = {}, factoring: Record<string, unknown> = {}): Payload => {
  const base = (G3 as { payload: Payload }).payload
  return { ...base, ...over, factoring: { ...base.factoring, ...factoring } }
}
const price = (payload: Payload) =>
  (priceGoldenDeal({ ...(G3 as object), payload } as never) as { result: StatementResult & { cashFlow: CashFlow, factoringRateMissing: boolean } }).result
const factoringRow = (payload: Payload) => {
  const r = price(payload)
  const st = buildDealStatement(r, payload, false) as unknown as { moneyOut: Array<{ key: string, sub?: string, drawer?: { note?: string } }> }
  const row = st.moneyOut.find((x) => x.key === 'out-factoring')
  if (!row) throw new Error('no PO factoring interest row on the statement')
  return row
}
const PAST_END = 'Factoring repayments run past the contract end (month 25): the finance cost includes them; the cash flow and closing position do not.'

describe('the statement (R-CF3, R-CF5)', () => {
  it('D4: the sub-label names what the engine advances, cost, not receipts', () => {
    expect(factoringRow(g3()).sub).toBe('drivers: the advanced cost (hardware, warranty, installation), rate and term')
  })
  it('the drawer note names the loan schedule', () => {
    expect(factoringRow(g3()).drawer?.note).toBe('The interest is computed by the engine from the loan schedule.')
  })
  it('R-CF3: past the contract end, the visible sub-label AND the drawer note carry the flag', () => {
    const row = factoringRow(g3({ duration: 24 }))
    expect(row.sub).toBe(PAST_END)
    expect(row.drawer?.note).toBe(`${PAST_END} The interest is computed by the engine from the loan schedule.`)
  })
})

describe('the cash flow grid (R-CF4)', () => {
  const labels = (payload: Payload) => {
    const r = price(payload)
    return buildCashFlowRows({ ...r.cashFlow, factoringRateMissing: r.factoringRateMissing }).map((x) => x.label)
  }
  it('a blank rate gets the not-recorded row, not a run of zeros', () => {
    const l = labels(g3({}, { ratePct: null }))
    expect(l).toContain('Factoring, rate not recorded')
    expect(l).not.toContain('Factoring interest')
  })
  it('both blank name both; a priced facility keeps its two rows', () => {
    expect(labels(g3({}, { ratePct: null, termMonths: null }))).toContain('Factoring, rate and term not recorded')
    expect(labels(g3())).toContain('Factoring interest')
  })
})
