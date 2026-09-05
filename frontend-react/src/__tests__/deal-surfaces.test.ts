// ── THE FOUR REMAINING SURFACES ──────────────────────────────────────────
//
// Derived from the vanilla's STATED BEHAVIOURS - the rulings its comments
// record - and from the census. Not from its markup.
//
// THE NON-ZERO RULE, from Session A: every assertion about a difference uses a
// fixture where the difference is non-zero, and asserts that it is. Session A's
// fold injection passed on a deal where the folded quantity was zero.
import { describe, test, expect } from 'vitest'
import { buildCashFlowRows, closingCashText } from '../deal/cashflow'
import type { CashFlow } from '../deal/cashflow'
import { computeYearBuckets, buildYearSchedule } from '../deal/schedule'
import {
  CONTRACTOR_MILESTONES, milestoneOptions, pctToUsd, usdToPct,
  milestoneUsdFor, syncContractorRow, contractorReconciliation, customerScheduleWarning,
} from '../deal/milestones'
import {
  installVisibility, structureVisibility, grossUpToggle, factoringToggle,
} from '../deal/installation'
import type { UiState, Values } from '../deal/payload'

const UI: UiState = {
  installResp: 'Client Own Installation Team', structure: 'twoPhase', invoicing: 'annual',
  grossUp: false, factoringEnabled: false, factoringMethod: 'straight',
}

const month = (m: number, over: Partial<CashFlow['rows'][0]> = {}) => ({
  m, hardwareIn: 1000, hostingIn: 200, advance: 0, cashIn: 1200,
  hwOut: 500, contractorOut: 0, hostOut: 100, facP: 0, facI: 0,
  cashOut: 600, cashNet: 600, cum: 600 * m, ...over,
})
const cf = (over: Partial<CashFlow> = {}): CashFlow => ({
  rows: Array.from({ length: 26 }, (_, i) => month(i + 1)),
  structure: 'twoPhase', annualInvoicing: true, factoringEnabled: false,
  contractorStaged: false, factoringTermMissing: false, ...over,
})

// ─────────────────────────────────────────────────────────────────────────
describe('surface 1: the cash-flow grid', () => {
  test('a zero cell is a DASH, not "0"', () => {
    const rows = buildCashFlowRows(cf({ rows: [month(1, { hostingIn: 0 })] }))
    const hosting = rows.find((r) => r.label.startsWith('Hosting fee'))!
    expect(hosting.cells[0].value).toBe('-')
  })

  test('cash-out is stored positive and DISPLAYED with a leading minus', () => {
    const rows = buildCashFlowRows(cf({ rows: [month(1, { hwOut: 500 })] }))
    // The selector names the CASH-OUT row exactly. `includes('Hardware')`
    // matched "Hardware recovery, annual" - a cash-IN row - first.
    const hw = rows.find((r) => r.label === 'Hardware, warranty and installation')!
    expect(hw.cells[0].value).toBe('-500')
  })

  test('a negative cumulative position is coloured, and a positive one is not', () => {
    const rows = buildCashFlowRows(cf({ rows: [month(1, { cum: -900 }), month(2, { cum: 900 })] }))
    const cum = rows.find((r) => r.label === 'Cumulative cash position')!
    expect(cum.cells[0].color).toBe('#e0824a')
    expect(cum.cells[1].color).not.toBe('#e0824a')
    // NON-ZERO RULE: the two cells genuinely differ.
    expect(cum.cells[0].value).not.toBe(cum.cells[1].value)
  })

  test('factoring OFF omits the advance and both factoring rows', () => {
    const labels = buildCashFlowRows(cf()).map((r) => r.label)
    expect(labels).not.toContain('PO factoring advance')
    expect(labels).not.toContain('Factoring principal repayment')
    expect(labels).not.toContain('Factoring interest')
  })

  test('factoring ON adds three rows', () => {
    const labels = buildCashFlowRows(cf({ factoringEnabled: true })).map((r) => r.label)
    expect(labels).toContain('PO factoring advance')
    expect(labels).toContain('Factoring principal repayment')
    expect(labels).toContain('Factoring interest')
  })

  // THE THIRD SURFACE: a facility switched on with no term would otherwise
  // print a confident run of zeros across the whole schedule.
  test('factoring ON with NO TERM says so instead of printing zeros', () => {
    const rows = buildCashFlowRows(cf({ factoringEnabled: true, factoringTermMissing: true }))
    const labels = rows.map((r) => r.label)
    expect(labels).toContain('Factoring, term not recorded')
    expect(labels).not.toContain('Factoring principal repayment')
    expect(labels).not.toContain('Factoring interest')
    // And the row is BLANK, not zeros.
    expect(rows.find((r) => r.label === 'Factoring, term not recorded')!.cells.every((c) => c.value === '')).toBe(true)
  })

  test('contractor staging splits the hardware row and adds its own', () => {
    const plain = buildCashFlowRows(cf()).map((r) => r.label)
    const staged = buildCashFlowRows(cf({ contractorStaged: true })).map((r) => r.label)
    expect(plain).toContain('Hardware, warranty and installation')
    expect(staged).toContain('Hardware and warranty')
    expect(staged).toContain('Contractor milestone payment')
    expect(plain).not.toContain('Contractor milestone payment')
  })

  test('hybrid and annual invoicing rename the cash-in rows', () => {
    expect(buildCashFlowRows(cf({ structure: 'hybrid' })).map((r) => r.label))
      .toContain('Milestone hardware payment')
    expect(buildCashFlowRows(cf({ annualInvoicing: false })).map((r) => r.label))
      .toContain('Hardware recovery')
  })

  test('closing cash reads through the SHARED presenter, symbol included', () => {
    const text = closingCashText(cf())
    expect(text).toMatch(/^\$|^-\$|not recorded/)
    // The four disagreements W5 measured: never a bare number, never "--".
    expect(text).not.toBe('--')
  })
})

// ─────────────────────────────────────────────────────────────────────────
describe('surface 2: the year schedule', () => {
  test('26 months bucket into 3 years, the last one short', () => {
    const years = computeYearBuckets(cf(), (r) => r.hardwareIn)
    expect(years.map((y) => y.label)).toEqual(['Year 1', 'Year 2', 'Year 3'])
    expect(years[0].value).toBe(12000)
    expect(years[2].value).toBe(2000)          // 2 months only
    expect(years[2].monthly).toBe(1000)        // and its monthly reflects that
  })

  test('it is a RE-GROUPING: the buckets sum to the monthly rows', () => {
    const years = computeYearBuckets(cf(), (r) => r.hardwareIn + r.hostingIn)
    const fromRows = cf().rows.reduce((s, r) => s + r.hardwareIn + r.hostingIn, 0)
    expect(years.reduce((s, y) => s + y.value, 0)).toBe(fromRows)
  })

  test('monthly invoicing shows the MONTHLY figure, annual shows the year', () => {
    const annual = buildYearSchedule(cf(), {}, 'twoPhase', 'annual')
    const monthly = buildYearSchedule(cf(), {}, 'twoPhase', 'monthly')
    const y = annual.years[0]
    expect(annual.valueOf(y)).toBe(y.value)
    expect(monthly.valueOf(y)).toBe(y.monthly)
    // NON-ZERO RULE: the two readings genuinely differ on this fixture.
    expect(y.value).not.toBe(y.monthly)
  })

  test('hybrid schedules HOSTING ONLY, because hardware is milestone-driven', () => {
    const s = buildYearSchedule(cf({ structure: 'hybrid' }), {}, 'hybrid', 'annual')
    expect(s.kind).toBe('hybrid')
    const hostingOnly = computeYearBuckets(cf(), (r) => r.hostingIn)
    expect(s.years.map((y) => y.value)).toEqual(hostingOnly.map((y) => y.value))
    // And it is genuinely smaller than the non-hybrid schedule.
    expect(s.total).toBeLessThan(buildYearSchedule(cf(), {}, 'twoPhase', 'annual').total)
  })

  test('single shows a recovery READOUT, and an unset duration says so', () => {
    expect(buildYearSchedule(cf(), { duration: 24 }, 'single', 'annual').recoveryReadonly).toBe('24 months')
    expect(buildYearSchedule(cf(), {}, 'single', 'annual').recoveryReadonly).toBe('Contract duration not set')
  })

  test('no months at all is "none" rather than an empty table', () => {
    expect(buildYearSchedule(cf({ rows: [] }), {}, 'twoPhase', 'annual').kind).toBe('none')
  })

  test('the label states both the basis and the cadence', () => {
    expect(buildYearSchedule(cf(), {}, 'twoPhase', 'annual').label).toBe('Invoiced fee, annual in advance')
    expect(buildYearSchedule(cf(), {}, 'hybrid', 'monthly').label).toBe('Hosting, monthly')
  })
})

// ─────────────────────────────────────────────────────────────────────────
describe('surface 3: the two milestone grids', () => {
  test('the contractor list is the fixed six', () => {
    expect(CONTRACTOR_MILESTONES).toHaveLength(6)
    expect(CONTRACTOR_MILESTONES[0]).toBe('Contract start')
  })

  test('AN UNRECOGNISED STORED VALUE KEEPS ITS OWN OPTION', () => {
    const opts = milestoneOptions('Some free text nobody listed')
    const extra = opts.find((o) => o.unknown)
    expect(extra, 'a stored free-text value was silently discarded').toBeTruthy()
    expect(extra!.label).toContain('not in the list')
    expect(opts.find((o) => o.value === 'Contract start')).toBeTruthy()
  })

  test('and a recognised one adds nothing', () => {
    expect(milestoneOptions('Go live').filter((o) => o.unknown)).toHaveLength(0)
  })

  // L6: the customer grid computes USD from the percentage.
  test('the customer USD is computed from the percentage, to TWO DECIMALS', () => {
    // A percentage of a six-figure total lands on cents, and rounding it away
    // would make the column not sum.
    // COMPUTED, not hand-typed: 123456 x 33.33 / 100 = 41147.8848.
    // A first draft asserted 41147.29 from mental arithmetic and was wrong,
    // which is Verification 20's hand-typed-number shape arriving in a fixture.
    expect(milestoneUsdFor('33.33', 123456)).toBe(((33.33 / 100) * 123456).toFixed(2))
    expect(milestoneUsdFor('33.33', 123456)).toBe('41147.88')
    expect(milestoneUsdFor('', 123456)).toBe('')
    expect(milestoneUsdFor('25', 0)).toBe('')
  })

  test('THE PCT/USD ROUND TRIP: typing on one side fills the other', () => {
    const base = 200000
    const v: Values = { 'deal-cm-0-pct': '25' }
    expect(syncContractorRow(v, 0, 'pct', base)).toEqual({ id: 'deal-cm-0-usd', value: '50000' })
    const v2: Values = { 'deal-cm-0-usd': '50000' }
    expect(syncContractorRow(v2, 0, 'usd', base)).toEqual({ id: 'deal-cm-0-pct', value: '25' })
  })

  test('an exact 25% reads "25", not "25.0000"', () => {
    expect(syncContractorRow({ 'deal-cm-0-usd': '50000' }, 0, 'usd', 200000)!.value).toBe('25')
  })

  test('and enough places that a near-miss cannot print as exact', () => {
    // 100.008% must not become "100". NON-ZERO RULE: the discrepancy is real.
    const r = syncContractorRow({ 'deal-cm-0-usd': '200016' }, 0, 'usd', 200000)!
    expect(r.value).not.toBe('100')
    expect(Number(r.value)).toBeGreaterThan(100)
  })

  test('a zero base does NOTHING rather than writing zeros over what is there', () => {
    expect(syncContractorRow({ 'deal-cm-0-pct': '25' }, 0, 'pct', 0)).toBeNull()
  })

  test('pctToUsd and usdToPct invert each other on exact figures', () => {
    expect(pctToUsd(25, 200000)).toBe(50000)
    expect(usdToPct(50000, 200000)).toBe(25)
    expect(usdToPct(50000, 0)).toBeNull()
  })
})

describe('surface 3: reconciliation rendering', () => {
  const rows = (specs: [number, number][]): Values => {
    const v: Values = {}
    specs.forEach(([m, usd], i) => { v[`deal-cm-${i}-month`] = String(m); v[`deal-cm-${i}-usd`] = String(usd) })
    return v
  }

  test('an exact schedule reads 100% and states nothing', () => {
    const view = contractorReconciliation(rows([[1, 50000], [2, 150000]]), 200000)
    expect(view.totalPct).toBe('100%')
    expect(view.off).toBe(false)
    expect(view.statement).toBeNull()
    expect(view.warning).toBeNull()
  })

  // THE TOTAL MAY NOT ROUND ITSELF INTO AGREEMENT. Verification 21.
  test('a $16 overrun does NOT print as 100%', () => {
    const view = contractorReconciliation(rows([[1, 50000], [2, 150016]]), 200000)
    expect(view.totalPct).not.toBe('100%')
    expect(view.off).toBe(true)
    expect(view.statement).toBeTruthy()
    // NON-ZERO RULE: the overrun is real and is asserted as such.
    expect(view.totalUsd).toBe('$200,016')
  })

  test('A DATELESS ROW COUNTS TOWARD THE TOTAL and blocks a version', () => {
    const view = contractorReconciliation(rows([[0, 50000], [2, 150000]]), 200000)
    // It counts: the money is committed whatever the date says.
    expect(view.totalUsd).toBe('$200,000')
    // And it blocks: a version is a commercial commitment.
    expect(view.warning).toContain('no month')
  })

  test('and the two refusals are SEPARATE, incomplete leading', () => {
    const view = contractorReconciliation(rows([[0, 50000], [2, 150016]]), 200000)
    expect(view.warning).toContain('no month')          // incomplete leads
    expect(view.statement).toBeTruthy()                  // the arithmetic is stated too
  })

  test('no schedule and no base is an empty form, not a discrepancy', () => {
    const view = contractorReconciliation({}, 0)
    expect(view.off).toBe(false)
    expect(view.warning).toBeNull()
  })

  test('the CUSTOMER schedule warns against the one-off price', () => {
    const warn = customerScheduleWarning([{ month: 1, usd: 90000, pct: 0 }], 100000)
    expect(warn).toContain('Customer milestones total $90,000')
    expect(warn).toContain('hardware and installation price of $100,000')
    expect(customerScheduleWarning([{ month: 1, usd: 100000, pct: 0 }], 100000)).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────
describe('surface 4: the installation tab and the button machinery', () => {
  const withResp = (r: string) => ({ ...UI, installResp: r })

  test('per unit shows the table, the signpost and the see-table link', () => {
    const v = installVisibility(withResp('Terminus Contractor - Per Unit'))
    expect(v).toEqual({ table: true, signpost: true, seeTable: true,
      lumpCostGroup: false, contractorGroup: false, notApplicable: false })
  })

  // THE SIGNPOST APPEARS EXACTLY WHEN THE ROWS IT POINTS AT DO. One condition.
  test('the signpost and the table are never out of step', () => {
    for (const r of ['Terminus Contractor - Per Unit', 'Terminus Contractor - Lump Sum',
      'Client Own Installation Team', 'Terminus - Reseller Installation']) {
      const v = installVisibility(withResp(r))
      expect(v.signpost, r).toBe(v.table)
    }
  })

  test('lump sum shows the cost group and the contractor group', () => {
    const v = installVisibility(withResp('Terminus Contractor - Lump Sum'))
    expect(v.lumpCostGroup).toBe(true)
    expect(v.contractorGroup).toBe(true)
    expect(v.table).toBe(false)
  })

  test('anything else shows the not-applicable note and nothing else', () => {
    const v = installVisibility(withResp('Client Own Installation Team'))
    expect(v.notApplicable).toBe(true)
    expect(v.table || v.lumpCostGroup || v.contractorGroup).toBe(false)
  })

  test('hybrid replaces the recovery row and the invoicing radios', () => {
    const h = structureVisibility({ ...UI, structure: 'hybrid' })
    expect(h).toEqual({ topScheduleRow: false, invoicingToggle: false,
      recoveryGroup: false, recoveryReadonly: false, hybridGroup: true })
  })

  test('two-phase shows recovery as an INPUT, single as a READOUT', () => {
    expect(structureVisibility({ ...UI, structure: 'twoPhase' }).recoveryGroup).toBe(true)
    expect(structureVisibility({ ...UI, structure: 'twoPhase' }).recoveryReadonly).toBe(false)
    expect(structureVisibility({ ...UI, structure: 'single' }).recoveryReadonly).toBe(true)
    expect(structureVisibility({ ...UI, structure: 'single' }).recoveryGroup).toBe(false)
  })

  // W-E: the two toggles are the same control and must behave identically.
  test('gross up and factoring are the same SWITCH, state carried by the label', () => {
    for (const [get, on, off] of [
      [grossUpToggle, 'Gross up enabled', 'Gross up disabled'],
      [factoringToggle, 'PO factoring enabled', 'PO factoring disabled'],
    ] as const) {
      const key = get === grossUpToggle ? 'grossUp' : 'factoringEnabled'
      const onState = get({ ...UI, [key]: true } as UiState)
      const offState = get({ ...UI, [key]: false } as UiState)
      expect(onState.label).toBe(on)
      expect(offState.label).toBe(off)
      expect(onState.ariaChecked).toBe('true')
      expect(offState.ariaChecked).toBe('false')
      // The title SAYS WHAT CLICKING DOES, in both states.
      expect(onState.title).toContain('turn it off')
      expect(offState.title).toContain('turn it on')
    }
  })
})
