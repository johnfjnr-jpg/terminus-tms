// ── L1: THE COST BREAKDOWN'S ROWS, TESTED WITHOUT A BROWSER ──────────────
//
// The card CONTENTS are pure, which is the whole reason `costBreakdown.ts` is
// separate from the renderer. What needs a browser - that the figures on
// screen match what the route actually returned, live, on a keystroke - is a
// probe, and it is a different claim.
import { describe, it, expect } from 'vitest'
import { breakdownCards, isBreakdown, type TestBedCostBreakdown } from '../testbed/costBreakdown'

/** The engine's real return shape, from `calculateTestBedCost`. */
const B: TestBedCostBreakdown = {
  hardware: {
    totalUnits: 19, hardwareCost: 158400,
    // Always 0 for a Test Bed: `buildTestBedCostBreakdown` passes
    // `warrantyPct: 0`. Present on the wire, never rendered.
    warrantyUnits: 0, warrantyCost: 0,
    avgHwCost: 8336.84,
  },
  groups: {
    hardwareGroup: {
      rows: [
        { key: 'hwSs', rawCost: 50400, rawPrice: 63000 },
        { key: 'hwAqm', rawCost: 12000, rawPrice: 15000 },
        { key: 'hwHemir', rawCost: 96000, rawPrice: 120000 },
        { key: 'hwWarranty', rawCost: 0, rawPrice: 0 },
      ],
      rawTotalCost: 158400, rawTotalPrice: 198000,
    },
    installGroup: {
      rows: [
        { key: 'inSs', rawCost: 6000, rawPrice: 7500 },
        { key: 'inAqm', rawCost: 1800, rawPrice: 2250 },
        { key: 'inHemir', rawCost: 4000, rawPrice: 5000 },
      ],
      rawTotalCost: 11800, rawTotalPrice: 14750,
    },
    hostingGroup: {
      rows: [
        { key: 'hoSs', rawCost: 600, rawPrice: 750 },
        { key: 'hoAqm', rawCost: 180, rawPrice: 225 },
        { key: 'hoHemir', rawCost: 400, rawPrice: 500 },
      ],
      rawTotalCost: 1180, rawTotalPrice: 1475,
    },
  },
  hostingMonthCost: 1180,
  hostingTermCost: 42480,
  months: 36,
  totalCost: 212680,
}

const DRAFTS: Record<string, string> = {
  safesightCameras: '12', ssUnitCost: '4200',
  airQualitySensors: '6', aqUnitCost: '2000',
  hemirSensors: '1', hemirUnitCost: '96000',
}
const input = (k: string) => DRAFTS[k] ?? ''
const cards = () => breakdownCards(B, input)
const byId = (id: string) => cards().find((c) => c.testId === id)!
const labels = (id: string) => byId(id).rows.map((r) => r.label)

describe('the four cards', () => {
  it('renders exactly four, in the vanilla\'s order', () => {
    expect(cards().map((c) => c.title))
      .toEqual(['Cost summary', 'Hardware', 'Installation', 'Hosting (per month)'])
  })

  it('TOTAL COST IS THE FIRST ROW of the summary card', () => {
    // Not the conventional read, and measured rather than chosen: total-LAST
    // costs 185px of fold because the three category rows push it down,
    // total-FIRST costs 45px, which is the card's own chrome. Total-last put
    // the one figure this tab exists to produce below the fold at 1240 AND
    // 1920. A `toContain` would pass on either arrangement, so this asserts
    // the INDEX.
    expect(labels('tb-cost-card-summary')[0]).toBe('Total Cost')
    expect(byId('tb-cost-card-summary').rows[0].weight).toBe('total')
  })

  it('reads every summary figure off the engine, never re-adding the lines', () => {
    const rows = byId('tb-cost-card-summary').rows
    expect(rows.map((r) => r.value)).toEqual([212680, 158400, 11800, 42480])
    // And the engine's own total is the sum of exactly the three beneath it,
    // which is what makes re-adding them here a second computation path.
    expect(rows[1].value + rows[2].value + rows[3].value).toBe(rows[0].value)
  })

  it('names the hosting term in months, pluralised', () => {
    expect(labels('tb-cost-card-summary')[3]).toBe('Hosting × 36 months')
    expect(breakdownCards({ ...B, months: 1 }, input)[0].rows[3].label)
      .toBe('Hosting × 1 month')
  })
})

describe('the hardware labels quote their own inputs', () => {
  it('quotes the DRAFT count and rate, not the computed figure', () => {
    // Otherwise a row reads `SafeSight (12 × $4,200)` beside a figure computed
    // from 14 - a row that contradicts itself.
    expect(labels('tb-cost-card-hardware')).toEqual([
      'SafeSight (12 × $4,200)',
      'Air Quality (6 × $2,000)',
      'HEMIR (1 × $96,000)',
      'Hardware subtotal',
    ])
  })

  it('follows the draft when the draft changes, on the SAME breakdown', () => {
    // The discriminating case: same figures, different inputs. A label built
    // from the breakdown rather than from the drafts would not move.
    const other = breakdownCards(B, (k) => (k === 'safesightCameras' ? '14' : DRAFTS[k] ?? ''))
    expect(other[1].rows[0].label).toBe('SafeSight (14 × $4,200)')
  })

  it('reads a missing input as 0 rather than NaN or blank', () => {
    const none = breakdownCards(B, () => '')
    expect(none[1].rows[0].label).toBe('SafeSight (0 × $0)')
  })
})

describe('WARRANTY IS DROPPED, not hidden', () => {
  it('renders no warranty row anywhere, on any input', () => {
    // Ruled 2026-09-15: warranty is irrelevant to a Test Bed, not merely
    // always-zero. The brief proposed porting the vanilla's conditional; the
    // business's answer was to delete it, so there is no branch to fire.
    const all = cards().flatMap((c) => c.rows.map((r) => r.label))
    expect(all.filter((l) => /warrant/i.test(l))).toEqual([])
  })

  it('renders none even when the engine reports a warranty cost', () => {
    // THE DISCRIMINATING CASE. A test against the real `warrantyPct: 0` data
    // would be true by absence (Verification 14): it passes on a renderer that
    // still carries the conditional. This feeds a NON-ZERO warranty - a state
    // the Test Bed route cannot produce today - and the row must still not
    // appear, which is the difference between dropped and merely unreachable.
    const withWarranty = breakdownCards({
      ...B,
      hardware: { ...B.hardware, warrantyUnits: 2, warrantyCost: 16674 },
      groups: {
        ...B.groups,
        hardwareGroup: {
          ...B.groups.hardwareGroup,
          rows: B.groups.hardwareGroup.rows.map((r) =>
            r.key === 'hwWarranty' ? { ...r, rawCost: 16674, rawPrice: 16674 } : r),
        },
      },
    }, input)
    const all = withWarranty.flatMap((c) => c.rows.map((r) => r.label))
    expect(all.filter((l) => /warrant/i.test(l))).toEqual([])
    expect(withWarranty[1].rows).toHaveLength(4)
  })
})

describe('COST ONLY, never price', () => {
  it('renders no *Price figure anywhere', () => {
    // A Test Bed has no price or margin concept. `buildCostGroup` computes
    // rawPrice as a side effect of being shared with the PRICED Opportunity
    // path, and the fixture above gives every price a value DIFFERENT from its
    // cost so that reading the wrong field cannot coincide.
    const prices = [63000, 15000, 120000, 198000, 7500, 2250, 5000, 14750, 750, 225, 500, 1475]
    const values = cards().flatMap((c) => c.rows.map((r) => r.value))
    for (const p of prices) expect(values).not.toContain(p)
  })
})

describe('the weights, which decide what reads first', () => {
  it('gives the summary card NO dividing subtotals', () => {
    // Every row in that card IS a total, so there is nothing to divide it
    // from. Round 15 Phase 4's own note, and the reason `summary` and
    // `subtotal` are two weights rather than one.
    expect(byId('tb-cost-card-summary').rows.map((r) => r.weight))
      .toEqual(['total', 'summary', 'summary', 'summary'])
  })
  it('closes each detail card with a subtotal and nothing else', () => {
    for (const id of ['tb-cost-card-hardware', 'tb-cost-card-install', 'tb-cost-card-hosting']) {
      const ws = byId(id).rows.map((r) => r.weight)
      expect(ws.slice(0, -1).every((w) => w === 'item')).toBe(true)
      expect(ws[ws.length - 1]).toBe('subtotal')
    }
  })
  it('gives the hosting card its PER MONTH subtotal, not the term', () => {
    const last = byId('tb-cost-card-hosting').rows.slice(-1)[0]
    expect(last.label).toBe('Hosting subtotal / month')
    expect(last.value).toBe(1180)
    expect(last.value).not.toBe(B.hostingTermCost)
  })
})

describe('isBreakdown narrows what the route sent', () => {
  it('accepts the real shape', () => {
    expect(isBreakdown(B)).toBe(true)
  })
  it('refuses the shapes a broken or absent response produces', () => {
    for (const bad of [null, undefined, {}, [], 'x', 0, { totalCost: 1 },
      { totalCost: 1, groups: {} },
      { totalCost: 1, groups: { hardwareGroup: {}, installGroup: {}, hostingGroup: {} } }]) {
      expect(isBreakdown(bad), `accepted ${JSON.stringify(bad)}`).toBe(false)
    }
  })
})
