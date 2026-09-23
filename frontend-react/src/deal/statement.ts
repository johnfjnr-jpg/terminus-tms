// ── THE DEAL SHEET STATEMENT (C1, READ-ONLY) ─────────────────────────────
//
// Option C: MONEY IN, MONEY OUT, RESULT, read top to bottom, with each line's
// drivers in a drawer underneath it.
//
// ── ITS ONE RULE: NO NEW ARITHMETIC ─────────────────────────────────────
//
// Every figure here is read from the SAME expression `buildDealRows` reads,
// out of the same `result` object. Nothing is recomputed, nothing is derived
// a second way, and where a helper already owns a derivation - the achieved
// margin's accent, a milestone's dollars, a line's implied margin - that
// helper is called rather than its rule restated.
//
// Phase 0 traced every figure on the current summary to one derivation, with
// ONE exception it did not cause: `rows.ts` multiplies the hosting group by
// the months itself, because `calculateContractTotals` exposes
// `hostingTermPrice` and no `hostingTermCost` on this path. THIS MODULE READS
// THE SAME TWO EXPRESSIONS, deliberately, so the count of readers stays at
// two rather than becoming three. Converging it is a new field on the
// calculator and belongs to the round that owns that function.
//
// The guard that makes the claim checkable is
// `deal-statement.test.tsx`: every statement figure is asserted EQUAL to the
// matching `buildDealRows` cell on a driven fixture, so the two presentations
// cannot drift.
import { money } from './rows'
import { milestoneUsdFor } from './milestones'
import {
  durationPresentation, whtPresentation, gstPresentation, marginPresentation,
} from '../../../src/lib/deal-inputs.js'
import { numericOrDefault } from '../../../src/lib/numeric-payload.js'

// ── R-C2a: WHICH CATALOG PRODUCT A LINE COSTS FROM ──────────────────────
//
// The boundary this round was stopped on: unit costs are the CATALOG's, one
// row per product in `base_cost_batches`, shared by every deal. The drawer
// says so, and names the batch and its effective date, so a reader can see
// which numbers belong to this deal and which do not.
//
// THE PRODUCTS ARE `PRODUCT_RATE_KEYS`' OWN KEYS and the map asserts its own
// completeness in `deal-statement.test.ts` - Verification 19, a list used as
// an enumeration fails by silent omission, so a product renamed in the
// catalog turns a test red rather than dropping a basis line quietly.
export const LINE_PRODUCT: Record<string, string> = {
  hwSs: 'safesight', hwAqm: 'air_quality', hwHemir: 'hemir',
  hoSs: 'safesight', hoAqm: 'air_quality', hoHemir: 'hemir',
}

export type Batches = Record<string, { batch_label?: string, effective_from?: string }>

type GroupRow = {
  key: string, rawCost: number, rawPrice: number,
  impliedMarginPct: number | null, overridden?: boolean,
}
type Group = { rawTotalPrice: number, rawTotalCost: number, rows?: GroupRow[] }
export type StatementResult = {
  groups: { hardwareGroup: Group, installGroup: Group, hostingGroup: Group }
  totals: { contractNet: number, oneOffPrice: number }
  tax: { invoiceBase: number, whtAmount: number, gstAmount: number, whtBorne: number }
  totalDealCostAll: number
  financeCost: number
  testBedCost: number
  achievedMargin: number
  costIncomplete?: boolean
}

export type DrawerRow = {
  cells: string[]
  sub?: string
  sum?: boolean
  /** R-C2a: the catalog batch a COST came from, rendered under it. */
  basis?: string
  /** R-C2a: this cost is a catalog value and is not editable on a deal. */
  costReadOnly?: boolean
  /**
   * C2: one entry per cell. A value id makes that cell an EDITOR bound to the
   * deal form's own store; null leaves it text.
   *
   * The ids are the ones the existing panels already use - `deal-margin-*`,
   * `deal-hofee-*`, `deal-ssExisting` - so an edit here and an edit there are
   * the same write. That is what makes "the statement, the strip and the old
   * panels all reflect an edit live" true by construction rather than by
   * three listeners agreeing.
   */
  editIds?: (string | null)[]
}
export type Drawer =
  | { kind: 'table', head: string[], rows: DrawerRow[], second?: { head: string[], rows: DrawerRow[] }, note?: string }
  | { kind: 'note', note: string }

export type StatementLine = {
  key: string
  label: string
  sub?: string
  hardware: string
  hosting: string
  installation: string
  total: string
  negative?: boolean
  drawer?: Drawer
}

export type Statement = {
  moneyIn: StatementLine[]
  revenue: StatementLine
  moneyOut: StatementLine[]
  totalCost: StatementLine
  profit: string
  margin: { text: string, state: string, note: string }
  strip: { revenue: string, cost: string, profit: string, margin: string, state: string, target: string }
}

const D = '-'
const m = (v: number) => `$${money(v)}`
const neg = (v: number) => `- $${money(v)}`
const pct = (v: number | null) => v === null ? D : `${v.toFixed(1)}%`

// The item names the pricing cards already use. Names only: every figure on
// the row beside them comes from the group's own rows.
const HW_NAMES: Record<string, string> = {
  hwSs: 'SafeSight', hwAqm: 'AQ Sensor', hwHemir: 'HEMIR',
  hwWarranty: 'Warranty provision',
}
const HO_NAMES: Record<string, string> = {
  hoSs: 'SafeSight', hoAqm: 'AQ Sensor', hoHemir: 'HEMIR',
}
const IN_NAMES: Record<string, string> = {
  inLump: 'Lump sum contractor', inSsEx: 'SafeSight, existing infra',
  inSsNew: 'SafeSight, new infra', inAqm: 'AQ Sensor', inHemir: 'HEMIR',
  inNone: 'No installation on this deal',
}

// R-C2a: `batches` is the catalog's own answer, product to batch. A line with
// no product in the map - the installation lines, which are quoted per deal -
// gets no basis note and is NOT marked read-only, because its rate genuinely
// is the deal's.
const basisFor = (key: string, batches: Batches): string | undefined => {
  const product = LINE_PRODUCT[key]
  if (!product) return undefined
  const b = batches[product]
  if (!b) return 'catalog, no batch recorded'
  const label = b.batch_label ?? 'catalog'
  return b.effective_from ? `${label}, from ${String(b.effective_from).slice(0, 10)}` : label
}

const lineRows = (
  g: Group, names: Record<string, string>, perMonth = false, batches: Batches = {},
): DrawerRow[] =>
  (g.rows ?? []).map((r) => ({
    basis: basisFor(r.key, batches),
    costReadOnly: !!LINE_PRODUCT[r.key],
    // C2: margin and price are editable; COST IS NOT, per R-C2a. The warranty
    // line is editable in neither: it prices at cost by rule, so a margin box
    // on it would be a margin the calculator refuses to read and a price box
    // would be that rule inverted.
    // ── R-C2b, THE EITHER-OR MADE VISIBLE ──────────────────────────────
    //
    // Type the price and the MARGIN derives; type the margin and the price
    // derives. So a line carrying a price override shows its margin as the
    // DERIVED figure rather than as an empty box: two editors both blank,
    // with the price driving, is the state a reader cannot account for - and
    // it is what the first build shipped until the screenshot showed it.
    //
    // Clearing the price returns the margin to an editor, which is what makes
    // this an either-or rather than a one-way door.
    editIds: r.key === 'hwWarranty' ? [null, null, null, null] : [
      null,
      null,
      r.overridden ? null : `deal-margin-${r.key}`,
      perMonth ? `deal-hofee-${r.key}` : `deal-price-${r.key}`,
    ],
    cells: [
      names[r.key] ?? r.key,
      perMonth ? `${m(r.rawCost)} / mo` : m(r.rawCost),
      // THE IMPLIED MARGIN IS THE GROUP'S OWN, returned beside the price it
      // priced. A display computing `1 - cost/price` here would be the second
      // reader Verification 20 is about, and would disagree the day a line is
      // priced by override rather than by margin - which is now exactly when
      // it is SHOWN, so it has to be the group's.
      r.overridden ? `${pct(r.impliedMarginPct)} derived` : pct(r.impliedMarginPct),
      perMonth ? `${m(r.rawPrice)} / mo` : m(r.rawPrice),
    ],
  }))

export function buildDealStatement(
  result: StatementResult, payload: Record<string, unknown>, grossUp: boolean,
  batches: Batches = {},
): Statement {
  const dur = durationPresentation(payload) as { months: number | null, recorded: boolean, value: string, priceLabel: string, costLabel: string }
  const months = dur.months ?? 0
  const { hardwareGroup, installGroup, hostingGroup } = result.groups
  const wht = whtPresentation(payload) as { pct: number | null, recorded: boolean, value: string, grossUpLabel: string, deductedLabel: string }
  const gst = gstPresentation(payload) as { recorded: boolean, pct: number, rowLabel: string }
  const { contractNet, oneOffPrice } = result.totals
  const { whtBorne, whtAmount, gstAmount, invoiceBase } = result.tax

  const hwPrice = hardwareGroup.rawTotalPrice
  const hwCost = hardwareGroup.rawTotalCost
  // BY KEY, NOT BY INDEX, exactly as rows.ts does it: the order inside the
  // group is the calculator's business.
  const warrantyCost = hardwareGroup.rows?.find((r) => r.key === 'hwWarranty')?.rawCost ?? 0
  const hwCostExWarranty = hwCost - warrantyCost
  const inPrice = installGroup.rawTotalPrice
  const inCost = installGroup.rawTotalCost
  // The carried second reader, read the same way rows.ts reads it. See the
  // module header: this round does not widen it.
  const hoPrice = hostingGroup.rawTotalPrice * months
  const hoCost = hostingGroup.rawTotalCost * months

  const milestones = (payload.milestones ?? []) as Array<{ month?: unknown, label?: unknown, pct?: unknown }>
  const scheduleRows: DrawerRow[] = milestones
    .filter((x) => x && (x.pct !== undefined && x.pct !== null && x.pct !== ''))
    .map((x) => ({
      cells: [
        String(x.month ?? D),
        String(x.label ?? ''),
        `${String(x.pct)}%`,
        // R-N1: THE ONE DERIVATION. A milestone is a percentage of the deal's
        // one-off price and its dollars are derived at every reader.
        milestoneUsdFor(String(x.pct), oneOffPrice) ? `$${money(Number(milestoneUsdFor(String(x.pct), oneOffPrice)))}` : D,
      ],
    }))

  const moneyIn: StatementLine[] = [
    {
      key: 'in-hardware',
      label: 'One-off price, hardware and warranty',
      sub: 'drivers: unit costs and per-line margin',
      hardware: m(hwPrice), hosting: D, installation: D, total: m(hwPrice),
      drawer: {
        kind: 'table',
        head: ['ITEM', 'COST', 'MARGIN %', 'PRICE'],
        rows: [
          ...lineRows(hardwareGroup, HW_NAMES, false, batches),
          { cells: ['Hardware price', m(hwCost), '', m(hwPrice)], sum: true },
        ],
        // R-C2a: SAID ON THE PANEL, not left to be inferred from a box that
        // will not accept typing. A cost here is the catalog's, one row per
        // product shared by every deal, so changing it would reprice the
        // estate rather than this deal. There is no link because there is no
        // Base Cost Data screen to link to: Product Management is a disabled
        // nav button, and a link to nothing is the escape route Verification 7
        // is about.
        // C2: the unit counts are the deal's own and are edited here, in the
        // drawer of the line they drive. SafeSight carries TWO, existing and
        // new infrastructure, because the calculator prices them from two
        // separate counts - collapsing them into one box would be a second
        // reader inventing a number neither field holds.
        second: {
          head: ['UNIT', 'COUNT'],
          rows: [
            { cells: ['SafeSight, existing infra', ''], editIds: [null, 'deal-ssExisting'] },
            { cells: ['SafeSight, new infra', ''], editIds: [null, 'deal-ssNew'] },
            { cells: ['AQ Sensor', ''], editIds: [null, 'deal-aqm'] },
            { cells: ['HEMIR', ''], editIds: [null, 'deal-hemir'] },
          ],
        },
        note: 'Unit costs are catalog values, shared by every deal, and are not'
          + ' editable here. The batch and its effective date are shown beneath'
          + ' each cost.',
      },
    },
    {
      key: 'in-installation',
      label: 'Installation',
      sub: 'drivers: contractor cost, margin, milestone schedule',
      hardware: D, hosting: D, installation: m(inPrice), total: m(inPrice),
      drawer: {
        kind: 'table',
        head: ['DRIVER', 'COST', 'MARGIN %', 'PRICE'],
        rows: [
          ...lineRows(installGroup, IN_NAMES),
          { cells: ['Installation price', m(inCost), '', m(inPrice)], sum: true },
        ],
        second: scheduleRows.length
          ? { head: ['MONTH', 'MILESTONE', '%', 'AMOUNT'], rows: scheduleRows }
          : undefined,
        note: scheduleRows.length ? undefined
          : 'No customer milestone schedule is recorded on this deal.',
      },
    },
    {
      key: 'in-hosting',
      label: dur.priceLabel,
      sub: 'drivers: per-unit monthly rates and margin',
      hardware: D, hosting: dur.recorded ? m(hoPrice) : dur.value, installation: D,
      total: dur.recorded ? m(hoPrice) : dur.value,
      drawer: {
        kind: 'table',
        head: ['ITEM', 'COST / MONTH', 'MARGIN %', 'PRICE / MONTH'],
        rows: [
          ...lineRows(hostingGroup, HO_NAMES, true, batches),
          { cells: [dur.recorded ? `Over ${months} months` : 'Over the term',
            dur.recorded ? m(hoCost) : dur.value, '',
            dur.recorded ? m(hoPrice) : dur.value], sum: true },
        ],
        note: 'Hosting costs are catalog values, shared by every deal, and are'
          + ' not editable here.',
      },
    },
  ]

  const revenue: StatementLine = {
    key: 'revenue', label: 'Revenue, contract value net',
    hardware: m(hwPrice), hosting: dur.recorded ? m(hoPrice) : dur.value,
    installation: m(inPrice), total: m(contractNet),
  }

  const moneyOut: StatementLine[] = [
    { key: 'out-hw', label: 'Hardware cost',
      hardware: neg(hwCostExWarranty), hosting: D, installation: D, total: neg(hwCostExWarranty), negative: true },
    { key: 'out-warranty', label: 'Warranty provision, at cost',
      hardware: neg(warrantyCost), hosting: D, installation: D, total: neg(warrantyCost), negative: true },
    { key: 'out-install', label: 'Installation cost',
      hardware: D, hosting: D, installation: neg(inCost), total: neg(inCost), negative: true },
    { key: 'out-hosting', label: dur.costLabel,
      hardware: D, hosting: dur.recorded ? neg(hoCost) : dur.value, installation: D,
      total: dur.recorded ? neg(hoCost) : dur.value, negative: true },
    {
      key: 'out-factoring', label: 'PO factoring interest',
      sub: 'drivers: factored receipts and rate',
      hardware: D, hosting: D, installation: D,
      // A dash means ZERO financing; "not recorded" means the facility is on
      // and nobody recorded its term. rows.ts's distinction, kept.
      total: result.costIncomplete ? 'not recorded' : (result.financeCost ? neg(result.financeCost) : D),
      negative: true,
      drawer: {
        kind: 'table',
        head: ['DRIVER', 'VALUE'],
        rows: [
          { cells: ['Facility', (payload.factoring as { enabled?: boolean })?.enabled ? 'On' : 'Off'] },
          { cells: ['Rate %', String((payload.factoring as { ratePct?: unknown })?.ratePct ?? 'not recorded')] },
          { cells: ['Term (months)', String((payload.factoring as { termMonths?: unknown })?.termMonths ?? 'not recorded')] },
          { cells: ['Method', String((payload.factoring as { method?: unknown })?.method ?? D)] },
          { cells: ['Interest', result.costIncomplete ? 'not recorded' : m(result.financeCost)], sum: true },
        ],
        note: 'The interest is computed by the engine from the same payment schedule the revenue lines carry.',
      },
    },
    { key: 'out-testbed', label: 'Test Bed cost, carried from conversion',
      hardware: D, hosting: D, installation: D,
      total: result.testBedCost ? neg(result.testBedCost) : D, negative: true },
    {
      key: 'out-wht',
      label: grossUp
        ? 'Withholding tax, grossed up and recovered from the customer'
        : 'Withholding tax absorbed by Terminus',
      sub: 'drivers: WHT %, gross-up, GST',
      hardware: D, hosting: D, installation: D,
      total: whtBorne ? neg(whtBorne) : D, negative: true,
      drawer: {
        kind: 'table',
        head: ['DRIVER', 'VALUE'],
        rows: [
          { cells: ['WHT %', wht.recorded ? `${wht.pct}%` : wht.value] },
          { cells: ['Gross up', grossUp ? 'On' : 'Off'] },
          { cells: ['GST', gst.recorded ? `${gst.pct}%` : gst.rowLabel] },
          { cells: ['Invoice base', m(invoiceBase)] },
          { cells: ['WHT deducted', whtAmount ? m(whtAmount) : D] },
          { cells: ['GST passed through', gstAmount ? m(gstAmount) : D] },
          { cells: ['Borne by Terminus', whtBorne ? m(whtBorne) : D], sum: true },
        ],
        note: grossUp
          ? 'Grossed up and recovered from the customer, so the net effect on the deal is nil.'
          : 'Absorbed by Terminus, so it is a cost of the deal.',
      },
    },
  ]

  const totalCost: StatementLine = {
    key: 'total-cost', label: 'Total cost',
    hardware: '', hosting: '', installation: '', total: neg(result.totalDealCostAll), negative: true,
  }
  const profitValue = contractNet - result.totalDealCostAll
  // THE ACCENT IS `marginPresentation`'S, not a comparison made here. It
  // rounds both sides to the displayed precision before comparing, which is
  // what makes "down 0.0 pts with no green" unreachable.
  const mp = marginPresentation(result.achievedMargin, payload) as { text: string, state: string, note: string }

  return {
    moneyIn, revenue, moneyOut, totalCost,
    profit: m(profitValue),
    margin: mp,
    strip: {
      revenue: m(contractNet), cost: m(result.totalDealCostAll), profit: m(profitValue),
      margin: mp.text, state: mp.state,
      target: `TARGET ${numericOrDefault(payload, 'targetMargin')}%`,
    },
  }
}
