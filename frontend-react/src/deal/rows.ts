import { durationPresentation, whtPresentation, gstPresentation } from '../../../src/lib/deal-inputs.js'

// ── ONE PANEL, ONE ARITHMETIC STORY: THE UNFOLD RULING, PORTED ───────────
//
// Round 41 item 4, ruled by the business, and this module is the ruling made
// testable. It is PURE - result and payload in, rows out - so the ruling can be
// asserted without rendering anything, which is what the vanilla's string
// concatenation made hard.
//
// THE RULING. Finance cost, test bed carried and absorbed WHT are their OWN
// UNSPLIT FULL-WIDTH ROWS, and Total cost is the VISIBLE SUM of the six cost
// rows directly above it. The old matrix folded all three into the Hardware
// column before computing Total and Margin, so the panel footed without an
// approver being able to follow it. The business's reason: on an approval
// surface a column an approver can sum and match beats a compact fold.
//
// THE DEAD CELLS CEASE TO EXIST. A full-width row carries NO group cells rather
// than three dashes. A dash because a value is zero is a fact about the deal; a
// dash because the code has no expression for it is a hole in a grid.
//
// AND THE PER-COLUMN MARGIN CHANGES MEANING, SO IT CHANGES LABEL. Left called
// "Margin" it would name a different number from the one it named before the
// unfold - Architecture 9's fourth variant, a string that stopped being true
// when the thing under it moved. It is also placed AFTER the total so it cannot
// be read as part of the sum.

export interface DealRow {
  label: string
  total: string
  hardware?: string
  hosting?: string
  installation?: string
  fullWidth?: boolean
  memo?: boolean
  emphasis?: 'revenue' | 'sum' | 'margin' | 'price' | 'receipt'
}

export const money = (v: unknown): string =>
  Number((v as number) || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })

type Result = {
  groups: { hardwareGroup: G; installGroup: G; hostingGroup: G }
  tax: { invoiceBase: number; whtAmount: number; gstAmount: number; whtBorne: number }
  totals: { contractNet: number }
  totalDealCostAll: number
  financeCost: number
  costIncomplete?: boolean
  testBedCost?: number
  hardware: { totalUnits: number }
}
// R-O8 added `rows`: the sheet needs the warranty line on its own, and that
// figure is a ROW of the hardware group rather than a total of it.
type G = {
  rawTotalPrice: number
  rawTotalCost: number
  rows?: Array<{ key: string, rawCost: number, rawPrice: number }>
}

export function buildDealRows(
  result: Result, payload: Record<string, unknown>, grossUp: boolean,
): DealRow[] {
  const dur = durationPresentation(payload) as { months: number | null; recorded: boolean; value: string; priceLabel: string; costLabel: string }
  const months = dur.months ?? 0
  const { hardwareGroup, installGroup, hostingGroup } = result.groups
  const wht = whtPresentation(payload) as { pct: number | null; recorded: boolean; value: string; grossUpLabel: string; deductedLabel: string }
  const whtPct = wht.pct ?? 0
  const gst = gstPresentation(payload) as { recorded: boolean; pct: number; rowLabel: string; priceLabel: string }
  const { invoiceBase, whtAmount, gstAmount, whtBorne } = result.tax
  const { contractNet } = result.totals
  const { totalDealCostAll, financeCost } = result

  // THE THREE GROUPS, RAW. No folding, and hosting over the TERM rather than per
  // month, which is the period this panel works in and says so in every label.
  const hwPrice = hardwareGroup.rawTotalPrice
  const hwCost = hardwareGroup.rawTotalCost

  // ── R-O8: THE WARRANTY PROVISION IS ITS OWN LINE ────────────────────────
  //
  // Ruled by John, 2026-09-20, and it is PRESENTATION ONLY: `hwWarranty` has
  // been its own keyed row in the calculation since the 2026-09-16 correction,
  // priced at `marginPct: 0` so it reaches the customer at exactly what it
  // cost. Nothing about the arithmetic changes here. What changed is that the
  // figure was folded into "Hardware and warranty cost" and could not be read
  // on its own, on a sheet whose whole purpose is that the parts are legible.
  //
  // READ BY KEY, NOT BY POSITION. The row order inside the group is the
  // calculator's business, and an index would be a second reader of it that
  // agrees until somebody inserts a line.
  const warrantyCost = hardwareGroup.rows?.find((r) => r.key === 'hwWarranty')?.rawCost ?? 0
  const hwCostExWarranty = hwCost - warrantyCost
  const inPrice = installGroup.rawTotalPrice
  const inCost = installGroup.rawTotalCost
  // ── COST_CALC_AUDIT.md F8: THIS IS A SECOND SITE COMPUTING THE TERM ─────
  //
  // The engine already does `hostingGroup.rawTotalCost * months` inside
  // calculateContractTotals (deal-calculator.js:135) and exposes the price half
  // as `totals.hostingTermPrice`. These two lines repeat that multiplication,
  // over a `months` derived HERE by durationPresentation rather than the one the
  // engine was handed. They agree today by carrying the same formula, not by
  // sharing a value, which is CLAUDE.md Verification 20's shape.
  //
  // NOT CONVERGED, and the reason is scope rather than preference. Taking the
  // price half from `totals.hostingTermPrice` is one line, but there is no
  // `hostingTermCost` on the deal side to take the cost half from, so the fix is
  // a new field on calculateContractTotals. That function is inside the
  // Opportunity calculation currently being reconciled against the deal sheet
  // (COST_CALCULATIONS.md section 2), and adding a field to it now would land a
  // change in the middle of a comparison that has not been ruled on.
  //
  // Recorded rather than done, on John's "note or converge, low priority".
  const hoPrice = hostingGroup.rawTotalPrice * months
  const hoCost = hostingGroup.rawTotalCost * months

  const m = (v: number) => `$${money(v)}`
  const neg = (v: number) => `- $${money(v)}`
  const D = '-'
  const split = (label: string, h: string, ho: string, i: string, t: string, opts: Partial<DealRow> = {}): DealRow =>
    ({ label, hardware: h, hosting: ho, installation: i, total: t, ...opts })
  const full = (label: string, t: string, opts: Partial<DealRow> = {}): DealRow =>
    ({ label, total: t, fullWidth: true, ...opts })

  const grossOf = (p: number) => (grossUp && whtPct < 100) ? Math.round(p / (1 - whtPct / 100)) : p

  return [
    split('One-off price, hardware, warranty and installation', m(hwPrice), D, m(inPrice), m(hwPrice + inPrice)),
    split(dur.priceLabel, D, dur.recorded ? m(hoPrice) : dur.value, D, dur.recorded ? m(hoPrice) : dur.value),
    split('Revenue, contract value net', m(hwPrice), m(hoPrice), m(inPrice), m(contractNet), { emphasis: 'revenue' }),

    // ── THE SEVEN COST ROWS, CONTIGUOUS, SUMMING TO THE ROW BELOW THEM ───
    //
    // SIX UNTIL R-O8 SPLIT THE WARRANTY OUT. The count is stated because the
    // rows summing to `Total cost` is the property that matters, and it
    // survives the split by construction: hardware ex-warranty plus the
    // warranty provision is the same figure the single row carried.
    split('Hardware cost', neg(hwCostExWarranty), D, D, neg(hwCostExWarranty)),
    split('Warranty provision, at cost', neg(warrantyCost), D, D, neg(warrantyCost)),
    split('Installation cost', D, D, neg(inCost), neg(inCost)),
    split(dur.costLabel, D, dur.recorded ? neg(hoCost) : dur.value, D, dur.recorded ? neg(hoCost) : dur.value),
    // A dash here means ZERO financing. "not recorded" means the facility is on
    // and nobody recorded its term, which is a different fact and must not
    // borrow the dash.
    full('PO factoring interest', result.costIncomplete ? 'not recorded' : (financeCost ? neg(financeCost) : '-')),
    full('Test Bed cost, carried from conversion', result.testBedCost ? neg(result.testBedCost) : '-'),
    full(grossUp ? 'Withholding tax, grossed up and recovered from the customer' : 'Withholding tax absorbed by Terminus',
      whtBorne ? neg(whtBorne) : '-'),
    full('Total cost', neg(totalDealCostAll), { emphasis: 'sum' }),

    full('Gross margin', m(contractNet - totalDealCostAll), { emphasis: 'margin' }),
    split('Margin before financing, test bed and withholding',
      m(hwPrice - hwCost), m(hoPrice - hoCost), m(inPrice - inCost), m(contractNet - (hwCost + hoCost + inCost)),
      { memo: true }),

    // ── THE INVOICE WALK ────────────────────────────────────────────────
    full('Invoice reconciliation, from revenue', m(contractNet), { memo: true }),
    full(grossUp ? wht.grossUpLabel : 'No gross up, WHT absorbed',
      grossUp ? `+ ${m(invoiceBase - contractNet)}` : '-'),
    full(gst.recorded ? `GST at ${gst.pct}%, passed through` : gst.rowLabel,
      gst.recorded ? (gstAmount ? `+ ${m(gstAmount)}` : '-') : 'not recorded'),
    full(`${gst.priceLabel}${grossUp ? ', grossed up for WHT' : ''}`, m(invoiceBase + gstAmount), { emphasis: 'price' }),
    // The one row in this block with a real per-group figure: each group's own
    // price times the rate, not an apportionment of a total.
    wht.recorded
      ? split(wht.deductedLabel,
        neg(Math.round(grossOf(hwPrice) * whtPct / 100)),
        neg(Math.round(grossOf(hoPrice) * whtPct / 100)),
        neg(Math.round(grossOf(inPrice) * whtPct / 100)),
        whtAmount ? neg(whtAmount) : '-')
      : full(wht.deductedLabel, wht.value),
    full('Net receipt after WHT', m(invoiceBase - whtAmount), { emphasis: 'receipt' }),
  ]
}

// ── DELETED AT C2's STEP 0, AND THE PROPERTY MOVED TO A TEST ─────────────
//
// They were:
//
//     /** The six cost rows the ruling says Total cost is the visible sum of. */
//     export const COST_ROW_LABELS_FROM = 3
//     export const COST_ROW_COUNT = 6
//
// `COST_ROW_COUNT` said SIX against SEVEN actual cost rows - R-O8 split the
// warranty out and the comment forty lines above already says "SEVEN cost
// rows, contiguous" - and BOTH were exported and read by nobody. A false
// number nothing consults is Architecture 9's fourth variant sitting on
// Verification 9's dead guard: it cannot be falsified by anything, and the
// next reader would have trusted it.
//
// MADE TRUE RATHER THAN MERELY DELETED. The ruling behind them is real: the
// cost rows are contiguous and Total cost is their visible sum. A constant
// could only ever restate that; `deal-statement.test.ts` now ASSERTS it, by
// adding the money-out lines up and comparing with the total. A property that
// can go red is worth more than a number that agrees.
