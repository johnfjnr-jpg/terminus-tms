// ── C1: THE STATEMENT READS THE DERIVATION LAYER, NOT A COPY OF IT ──────
//
// The claim the whole round rests on: every figure on the statement is the
// SAME NUMBER the existing Deal Sheet renders, because both read one
// derivation. So it is asserted as an EQUALITY against `buildDealRows`
// rather than against constants typed into this file - a hand-typed
// expectation would be a second reader of the calculator and would agree
// today (Verification 20).
//
// THE FIXTURE IS BUILT THE WAY THE SYSTEM BUILDS IT (Verification 47):
// `buildDealInputs` then `calculateDeal`, the same two calls `useDealForm`
// makes, rather than a hand-shaped `result` object in the shape the code
// under test happens to read.
//
// DRIVEN, not static: the deal carries hardware, a lump-sum installation
// with a milestone schedule, hosting over a term, factoring, a Test Bed cost
// and withholding tax, so every line the statement renders has a non-zero
// figure behind it and no assertion can pass by being about nothing.
import { describe, test, expect } from 'vitest'
import { buildDealInputs } from '../../../src/lib/deal-inputs.js'
import { calculateDeal } from '../../../src/lib/deal-calculator.js'
import { buildDealRows } from '../deal/rows'
import { buildDealStatement, type StatementResult } from '../deal/statement'

const RATES = {
  ssUnitCost: 8000, aqUnitCost: 2000, hemirUnitCost: 100000,
  hoSafesight: 200, hoAqm: 100, hoHemir: 500,
  inSsExisting: 1500, inSsNew: 2500, inAqm: 400, inHemir: 3000,
}
const PAYLOAD: Record<string, unknown> = {
  ssExisting: 20, ssNew: 0, aqm: 2, hemir: 2,
  duration: 60, targetMargin: 30, warrantyPct: 2,
  installResp: 'Terminus Contractor - Lump Sum', lumpSumCost: 200000,
  whtPct: 15, gstPct: 9, grossUp: true,
  structure: 'hybrid', invoicing: 'annual', recoveryMonths: 24,
  milestones: [
    { month: 2, label: 'Contract start', pct: 40 },
    { month: 6, label: 'Installation complete', pct: 40 },
    { month: 12, label: 'Go live', pct: 20 },
  ],
  factoring: { enabled: true, ratePct: 1.2, termMonths: 6, method: 'straight' },
}

const build = (over: Record<string, unknown> = {}, grossUp = true, testBedCost = 25000) => {
  const payload = { ...PAYLOAD, ...over }
  // THE CAST IS ABOUT THE JSDoc, NOT ABOUT THE CALL. `buildDealInputs` is
  // plain JS and its `@param` names only `testBedCost`, so TypeScript infers
  // an options type without `rates` - while the function THROWS without it.
  // Casting the options rather than the result keeps the call honest and
  // leaves the returned shape checked.
  const inputs = buildDealInputs(payload,
    { testBedCost, rates: RATES } as unknown as { testBedCost?: number })
  const result = calculateDeal(inputs)
  return {
    payload, result,
    rows: buildDealRows(result as never, payload, grossUp),
    st: buildDealStatement(result as unknown as StatementResult, payload, grossUp),
  }
}
const cellOf = (rows: ReturnType<typeof buildDealRows>, label: string) => {
  const r = rows.find((x) => x.label === label)
  if (!r) throw new Error(`no row labelled "${label}" - the statement is being compared against nothing`)
  return r
}

describe('C1: the statement equals the derivation layer', () => {
  test('the fixture is DRIVEN: every headline figure is non-zero', () => {
    const { result } = build()
    // Without this the equalities below could all be "0 === 0". A driven
    // fixture is what makes an equality a measurement.
    expect(result.totals.contractNet).toBeGreaterThan(0)
    expect(result.totalDealCostAll).toBeGreaterThan(0)
    expect(result.financeCost).toBeGreaterThan(0)
    expect(result.testBedCost).toBeGreaterThan(0)
    expect(result.groups.installGroup.rawTotalPrice).toBeGreaterThan(0)
    expect(result.groups.hostingGroup.rawTotalPrice).toBeGreaterThan(0)
  })

  test('MONEY IN equals the one-off and hosting rows', () => {
    const { rows, st } = build()
    const oneOff = cellOf(rows, 'One-off price, hardware, warranty and installation')
    expect(st.moneyIn[0].total).toBe(oneOff.hardware)
    expect(st.moneyIn[1].total).toBe(oneOff.installation)
    const hosting = rows[1]
    expect(st.moneyIn[2].total).toBe(hosting.total)
  })

  test('REVENUE equals the revenue row, in every column', () => {
    const { rows, st } = build()
    const rev = cellOf(rows, 'Revenue, contract value net')
    expect(st.revenue.total).toBe(rev.total)
    expect(st.revenue.hardware).toBe(rev.hardware)
    expect(st.revenue.hosting).toBe(rev.hosting)
    expect(st.revenue.installation).toBe(rev.installation)
  })

  test('every MONEY OUT line equals its row, and the Test Bed line is present', () => {
    const { rows, st } = build()
    const pairs: Array<[string, string]> = [
      ['out-hw', 'Hardware cost'],
      ['out-warranty', 'Warranty provision, at cost'],
      ['out-install', 'Installation cost'],
      ['out-factoring', 'PO factoring interest'],
      ['out-testbed', 'Test Bed cost, carried from conversion'],
    ]
    for (const [key, label] of pairs) {
      const line = st.moneyOut.find((l) => l.key === key)!
      expect(line, `the statement has no ${key}`).toBeTruthy()
      expect(line.total, `${key} disagrees with "${label}"`).toBe(cellOf(rows, label).total)
    }
    // The hosting cost row's label is the duration presentation's, so it is
    // matched by position within the contiguous cost block rather than by a
    // literal this file would have to keep in step.
    expect(st.moneyOut.find((l) => l.key === 'out-hosting')!.total).toBe(rows[6].total)
  })

  test('TOTAL COST equals the Total cost row, which the money-out lines sum to', () => {
    const { rows, st } = build()
    expect(st.totalCost.total).toBe(cellOf(rows, 'Total cost').total)
  })

  // ── C2 STEP 0: THE PROPERTY THE DELETED CONSTANTS ONLY DESCRIBED ──────
  //
  // `COST_ROW_COUNT = 6` claimed the cost rows sum to Total cost and said SIX
  // against seven, exported and read by nobody. The claim was right and the
  // number was wrong, which is the worst combination: nothing could fail on
  // it. Asserted here instead, where it can.
  //
  // Verification 21: a reconciliation that cannot fail is not a
  // reconciliation. This one can - drop a line from `moneyOut` and it goes
  // red, which is exactly the accident a statement must not have.
  test('STEP 0: the MONEY OUT lines add up to Total cost', () => {
    const { st } = build()
    const num = (s: string) => Number(s.replace(/[^0-9.]/g, '')) || 0
    const sum = st.moneyOut.reduce((a, l) => a + num(l.total), 0)
    // Non-zero first, or "0 === 0" would pass on an empty statement.
    expect(sum).toBeGreaterThan(0)
    expect(sum).toBe(num(st.totalCost.total))
    // And every line is accounted for: seven, not the six the constant said.
    expect(st.moneyOut).toHaveLength(7)
  })

  test('PROFIT equals the Gross margin row', () => {
    const { rows, st } = build()
    expect(st.profit).toBe(cellOf(rows, 'Gross margin').total)
  })

  test('the WHT line follows gross-up, both ways', () => {
    const on = build({}, true)
    expect(on.st.moneyOut.find((l) => l.key === 'out-wht')!.label)
      .toBe('Withholding tax, grossed up and recovered from the customer')
    // BOTH DIRECTIONS: an assertion that only ever sees one branch of a
    // switch has not been shown to read the switch (Verification 24).
    const off = build({ grossUp: false }, false)
    expect(off.st.moneyOut.find((l) => l.key === 'out-wht')!.label)
      .toBe('Withholding tax absorbed by Terminus')
    expect(off.st.moneyOut.find((l) => l.key === 'out-wht')!.total)
      .toBe(cellOf(off.rows, 'Withholding tax absorbed by Terminus').total)
  })

  test('the STRIP carries the same four figures the statement does', () => {
    const { st } = build()
    expect(st.strip.revenue).toBe(st.revenue.total)
    expect(st.strip.cost).toBe(st.totalCost.total.replace('- ', ''))
    expect(st.strip.profit).toBe(st.profit)
    expect(st.strip.margin).toBe(st.margin.text)
  })

  test('the margin accent is marginPresentation\'s own state, both directions', () => {
    // THE STATE NAMES ARE THE ESTATE'S, not the mockup's. The mockup calls
    // them `good` and `low`; `marginPresentation` has returned `on-target`
    // and `under-target` since Round 39, and it is the calibrated owner of
    // the comparison - it rounds both sides to the displayed precision first,
    // which is what makes "down 0.0 pts with no green" unreachable.
    //
    // Asserting the mockup's names here would have been a second vocabulary
    // for one decision, and the first run of this test caught exactly that.
    // THE TARGET CANNOT SIMPLY BE LOWERED TO REACH `on-target`, and finding
    // that out is worth the comment: `targetMargin` is what every unpriced
    // line is PRICED at, so lowering it lowers revenue by the same move. The
    // driven fixture reads 25.9% against a 30% target because factoring and
    // the carried Test Bed cost sit below the pricing line.
    //
    // So the on-target case has to strip THREE things, and the third was
    // found by measuring rather than by reasoning: the WARRANTY PROVISION is
    // priced at cost, so it drags the blended margin below target even with
    // no factoring and no Test Bed cost. 29.7753% against 30% - under, and
    // correctly so.
    //
    // At `warrantyPct: 0` with neither overhead the deal reads 30.0014% and
    // is on target. Recorded because "lower the target" is the obvious move
    // and every version of it fails.
    const low = build()
    expect(low.st.margin.state).toBe('under-target')
    expect(low.st.strip.state).toBe('under-target')
    const good = build({ factoring: { enabled: false }, warrantyPct: 0 }, true, 0)
    expect(good.st.margin.state).toBe('on-target')
    expect(good.st.strip.state).toBe('on-target')

    // ── THE NOTE IS WHAT PROVES WHOSE RULE THIS IS ──────────────────────
    //
    // A CALIBRATION INJECTION CAME BACK SILENT HERE. Replacing
    // `marginPresentation` with a local `achievedMargin >= 30` passed every
    // assertion above, because both fixtures carry a target of 30 - so the
    // test proved the two STATES were right for one threshold and nothing at
    // all about where the rule came from.
    //
    // The note is `marginPresentation`'s alone: it names the target, and at
    // the boundary it says "at target" rather than a movement of zero, which
    // is the rounding rule Round 39 calibrated. A second implementation
    // cannot produce it by coincidence.
    expect(low.st.margin.note).toMatch(/against target 30%, down [\d.]+ pts/)
    expect(good.st.margin.note).toMatch(/target 1?30?%/)
    // And the TARGET on the strip is read from the payload, not from the
    // accent, so a deal with a different target says so.
    const other = build({ targetMargin: 45 })
    expect(other.st.strip.target).toBe('TARGET 45%')
  })

  test('the drawers carry the GROUP\'s own implied margin, not a recomputation', () => {
    const { result, st } = build()
    const hw = st.moneyIn[0].drawer as { kind: 'table', rows: Array<{ cells: string[] }> }
    const rows = result.groups.hardwareGroup.rows as Array<{ key: string, impliedMarginPct: number | null }>
    const ss = rows.find((r) => r.key === 'hwSs')
    // BOTH SIDES MUST EXIST BEFORE THEY ARE COMPARED (Verification 14): two
    // undefineds comparing equal is what a probe reports when it has found
    // nothing at all.
    expect(ss, 'no hwSs row in the hardware group').toBeTruthy()
    expect(ss!.impliedMarginPct, 'hwSs priced at zero, so there is no margin to show').not.toBeNull()
    const shown = hw.rows.find((r) => r.cells[0] === 'SafeSight')!
    expect(shown.cells[2]).toBe(`${ss!.impliedMarginPct!.toFixed(1)}%`)
  })

  // ── R-C2b: THE EITHER-OR, GENERALISED TO HARDWARE AND INSTALLATION ────
  test('R-C2b: an overridden hardware PRICE moves the line and derives the margin', () => {
    const base = build()
    const ssBefore = base.result.groups.hardwareGroup.rows.find((r: { key: string }) => r.key === 'hwSs')
    const target = Math.round(ssBefore.rawPrice * 2)
    const over = build({ priceOverrides: { hwSs: target } })
    const ssAfter = over.result.groups.hardwareGroup.rows.find((r: { key: string }) => r.key === 'hwSs')
    expect(ssAfter.rawPrice).toBe(target)
    expect(ssAfter.overridden).toBe(true)
    // R-O7 semantics: type the price, the MARGIN derives. Expressed from the
    // two figures rather than restated, so it cannot agree by coincidence.
    expect(ssAfter.impliedMarginPct)
      .toBeCloseTo((1 - ssAfter.rawCost / target) * 100, 6)
    // And the statement shows the derived margin rather than the target.
    const hw = over.st.moneyIn[0].drawer as { rows: Array<{ cells: string[] }> }
    expect(hw.rows.find((r) => r.cells[0] === 'SafeSight')!.cells[2])
      .toBe(`${ssAfter.impliedMarginPct.toFixed(1)}%`)
  })

  test('R-C2b: THE WARRANTY PROVISION IS UNTOUCHED by a hardware override', () => {
    // The ruling's own requirement. The warranty reaches the customer at
    // exactly what it cost, and an overridable warranty price would be a
    // margin on it by another name.
    const base = build()
    const wBefore = base.result.groups.hardwareGroup.rows.find((r: { key: string }) => r.key === 'hwWarranty')
    const over = build({ priceOverrides: { hwSs: 999999, hwAqm: 888888 } })
    const wAfter = over.result.groups.hardwareGroup.rows.find((r: { key: string }) => r.key === 'hwWarranty')
    expect(wBefore.rawCost).toBeGreaterThan(0)          // not vacuous
    expect(wAfter.rawCost).toBe(wBefore.rawCost)
    expect(wAfter.rawPrice).toBe(wBefore.rawPrice)
    expect(wAfter.rawPrice).toBe(wAfter.rawCost)        // still at cost
    expect(wAfter.overridden).toBe(false)
  })

  test('R-C2b: a warranty override is REFUSED BY THE PRICING, not merely unasked', () => {
    // The second layer. Even a payload that carries it - however it got there
    // - cannot price with it, which is the catalog boundary's shape applied
    // to a rule the business ruled.
    const base = build()
    const wBefore = base.result.groups.hardwareGroup.rows.find((r: { key: string }) => r.key === 'hwWarranty')
    const sneaky = build({ priceOverrides: { hwWarranty: 500000 } })
    const wAfter = sneaky.result.groups.hardwareGroup.rows.find((r: { key: string }) => r.key === 'hwWarranty')
    expect(wAfter.rawPrice).toBe(wBefore.rawPrice)
    expect(wAfter.overridden).toBe(false)
  })

  test('R-C2b: an overridden INSTALLATION line prices at the override', () => {
    const base = build()
    const inBefore = base.result.groups.installGroup.rawTotalPrice
    expect(inBefore).toBeGreaterThan(0)
    const over = build({ priceOverrides: { inLump: 400000 } })
    expect(over.result.groups.installGroup.rawTotalPrice).toBe(400000)
    expect(over.st.moneyIn[1].total).toBe('$400,000')
  })

  test('R-C2b: clearing the override returns the line to its margin', () => {
    // The other half of the either-or: an absent key is the state that means
    // "price from the margin", which is why the writer drops it rather than
    // sending a zero.
    const withOver = build({ priceOverrides: { hwSs: 999999 } })
    const cleared = build({ priceOverrides: {} })
    const plain = build()
    const ss = (b: typeof plain) => b.result.groups.hardwareGroup.rows
      .find((r: { key: string }) => r.key === 'hwSs').rawPrice
    expect(ss(withOver)).toBe(999999)
    expect(ss(cleared)).toBe(ss(plain))
  })

  // ── R-C2a: THE CATALOG BOUNDARY, ON THE STATEMENT ─────────────────────
  test('R-C2a: a catalog cost carries its batch and is marked read-only', () => {
    const { st } = build()
    const hw = st.moneyIn[0].drawer as {
      rows: Array<{ cells: string[], basis?: string, costReadOnly?: boolean }>, note?: string }
    const ss = hw.rows.find((r) => r.cells[0] === 'SafeSight')!
    expect(ss.costReadOnly).toBe(true)
    expect(ss.basis).toBeTruthy()
    expect(hw.note).toMatch(/catalog values.*not.*editable here/i)
    // The warranty is NOT a catalog line - it is derived from the deal's own
    // unit count and warranty percentage - so it must not claim a batch.
    const w = hw.rows.find((r) => r.cells[0] === 'Warranty provision')!
    expect(w.costReadOnly).toBeFalsy()
    expect(w.basis).toBeUndefined()
  })

  test('the installation drawer carries the milestone schedule, derived per R-N1', () => {
    const { st } = build()
    const dr = st.moneyIn[1].drawer as { kind: 'table', second?: { rows: Array<{ cells: string[] }> } }
    expect(dr.second, 'the schedule is missing').toBeTruthy()
    expect(dr.second!.rows).toHaveLength(3)
    expect(dr.second!.rows[0].cells[1]).toBe('Contract start')
    // A percentage of the ONE-OFF price, which is what R-N1 made authoritative.
    expect(dr.second!.rows[0].cells[3]).not.toBe('-')
  })
})
