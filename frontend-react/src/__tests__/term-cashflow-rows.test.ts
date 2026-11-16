// TERM_FACTORING Phase 3: the term screen's cash flow rows, in the CFRow shape
// Commercials' CashFlowGrid takes. Derived from the brief (R-TF8), Phase 1
// ruling 4 (principal and interest are two rows) and the mockup's sign
// convention ("−100,000.00", U+2212), never from the builder.
import { describe, it, expect } from 'vitest'
import { buildTermCashFlowRows, CASH_FLOW_LABELS, type TermCashFlowRow } from '../term-pricing/factoring'

// A stand-in formatter: this file may not import the term engine (R-TP1's
// importer allowlist), and the builder takes `money` as a parameter for that reason.
const money = (c: bigint) => (Number(c) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const month = (m: number, over: Partial<TermCashFlowRow> = {}): TermCashFlowRow => ({
  month: m, procurementCents: 0n, advanceCents: 0n, clientCents: 0n, hostingCents: 0n,
  principalCents: 0n, interestCents: 0n, netCents: 0n, balanceCents: 0n, ...over,
})
// FA-7's months 1 and 2 (spec 11.6).
const FA7 = [
  month(1, { procurementCents: -96000000n, advanceCents: 96000000n, clientCents: 28981877n, hostingCents: -2400000n, netCents: 26581877n, balanceCents: 26581877n }),
  month(2, { clientCents: 28981877n, hostingCents: -2400000n, principalCents: -8000000n, interestCents: -960000n, netCents: 17621877n, balanceCents: 44203754n }),
]

describe('the term cash flow rows (R-TF8)', () => {
  it('with factoring on: the eight rows, in the mockup order, principal and interest separate (ruling 4)', () => {
    expect(buildTermCashFlowRows(FA7, true, money).map((r) => r.label)).toEqual([
      'Hardware procurement', 'Factoring advance', 'Client payments', 'Hosting and service costs',
      'Factoring principal', 'Factoring interest', 'Net', 'Running balance',
    ])
  })

  it('with factoring off: no advance, principal or interest row, and the others unchanged', () => {
    const labels = buildTermCashFlowRows(FA7, false, money).map((r) => r.label)
    expect(labels).toEqual(['Hardware procurement', 'Client payments', 'Hosting and service costs', 'Net', 'Running balance'])
    // Verification 14: the absent rows exist in the vocabulary, so their absence is a choice.
    expect(Object.values(CASH_FLOW_LABELS)).toContain('Factoring advance')
  })

  it('cents, signed with U+2212, a zero as a dash: FA-7 month by month', () => {
    const rows = buildTermCashFlowRows(FA7, true, money)
    const at = (label: string) => rows.find((r) => r.label === label)!.cells.map((c) => c.value)
    expect(at('Hardware procurement')).toEqual(['−960,000.00', '-'])
    expect(at('Factoring advance')).toEqual(['960,000.00', '-'])
    expect(at('Factoring principal')).toEqual(['-', '−80,000.00'])
    expect(at('Factoring interest')).toEqual(['-', '−9,600.00'])
    expect(at('Net')).toEqual(['265,818.77', '176,218.77'])
    expect(at('Running balance')).toEqual(['265,818.77', '442,037.54'])
  })

  it('a negative running balance is marked, as Commercials marks it', () => {
    const rows = buildTermCashFlowRows([month(1, { netCents: -69418123n, balanceCents: -69418123n })], false, money)
    const balance = rows.find((r) => r.label === 'Running balance')!
    expect(balance.cells[0]).toEqual({ value: '−694,181.23', color: '#e0824a' })
    expect(balance.total).toBe(true)
  })
})
