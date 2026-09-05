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
type G = { rawTotalPrice: number; rawTotalCost: number }

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
  const inPrice = installGroup.rawTotalPrice
  const inCost = installGroup.rawTotalCost
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

    // ── THE SIX COST ROWS, CONTIGUOUS, SUMMING TO THE ROW BELOW THEM ─────
    split('Hardware and warranty cost', neg(hwCost), D, D, neg(hwCost)),
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

/** The six cost rows the ruling says Total cost is the visible sum of. */
export const COST_ROW_LABELS_FROM = 3
export const COST_ROW_COUNT = 6
