// Types for src/lib/term-pricing.js, for the React screen. The engine stays
// plain JavaScript; this file only describes what it returns.

export interface Fraction { n: bigint; d: bigint }

export class TermPricingError extends Error {
  code: string
  constructor(code: string, message: string)
}

export interface EngineParamsInput {
  TERMS: number[]
  ANCHOR_TERM: number
  ANCHOR_MARGIN: Record<string, string>
  SHORT_TERM_MARGIN: Record<string, string>
  PROFIT_STEP: string
  /** v1.8 (TB-1): one ordered list per product. */
  VOLUME_BANDS_BY_PRODUCT: Record<string, StoredBand[]>
  HW_UPFRONT_MARGIN: string
  MARGIN_FLOOR: string
  CURRENCY: string
  costs: Record<string, { hwCost: string; hostingMonthly: string }>
}

/** A band as stored: a start and a discount; "To" is derived (TB-3). */
export interface StoredBand { from: number; discountPct: string }

export interface BandProblem { band: number | null; field: 'count' | 'from' | 'discountPct'; message: string }

export interface BandValidation {
  ok: boolean
  problems: BandProblem[]
  /** `to` is null for the last band and "?" while the next band's start is invalid. */
  rows: Array<{ band: number; from: unknown; to: number | null | '?' }>
  bands: StoredBand[] | null
}

export interface BandGridCell { termMonths: number; feeCents: bigint; margin: Fraction; belowFloor: boolean }
export interface BandGridRow { band: number; from: number; to: number | null; discountPct: string; cells: BandGridCell[] }
export type BandGrid =
  | { ok: true; floor: Fraction; terms: number[]; feeTerms: number[]; rows: BandGridRow[]; breaches: Array<{ band: number; termMonths: number; feeCents: bigint; margin: Fraction }> }
  | { ok: false; problems: BandProblem[] }

export interface NormalisedParams {
  terms: number[]
  anchorTerm: number
  marginFloor: Fraction
  currency: string
  [k: string]: unknown
}

export interface QuoteInput {
  units: Record<string, number>
  termMonths: number
  paymentStructure?: 'opex' | 'capex'
  /** v1.6 (C-3): default none; a non-zero rate with no mode is refused. */
  cpiMode?: CpiMode
  escalatorPct?: string | null
  escalatorStartYear?: number
  gstPct?: string | null
  whtPct?: string | null
  whtGrossUp?: boolean
  whtSplit?: boolean
  whtHwPct?: string | null
  whtSaasPct?: string | null
  /** v1.6 (C-4, C-6), capex only. A milestone key is an opaque token to the engine (Q4). */
  capexAmount?: 'hardware' | 'custom'
  capexCustom?: string | null
  capexStructure?: 'hybrid' | 'two_phase'
  /** v1.7 (T-4): in capexAllocation a share may be null or blank, meaning not yet typed. */
  milestones?: Array<{ key: string; month: number; sharePct: string | null }>
  recoveryMonths?: number
}

export type CpiMode = 'none' | 'published' | 'locked'

export interface QuoteBand {
  from: number; to: number | null; discountPct: string; units: number; feeByYear: bigint[]
  /** v1.7 (C1): the band's own totals on Base, from its year-1 fee; they sum to the line exactly. */
  monthlyCents: bigint; tcvNetCents: bigint; costCents: bigint; grossProfitCents: bigint; grossMargin: Fraction
}
export interface QuoteLine {
  product: string; units: number; listFee: Fraction; savingVsAnchor: Fraction
  costPerUnitCents: bigint; bands: QuoteBand[]; monthlyByYear: bigint[]
  // v1.4: per-product totals; they sum to the deal exactly. No WHT field: WHT is never per product.
  tcvNetCents: bigint; costCents: bigint; grossProfitCents: bigint; grossMargin: Fraction
}
export interface ScheduleRow {
  /** 'monthly' under OPEX; 'invoice' under CAPEX (v1.6). A row is a run of identical invoices. */
  kind: 'monthly' | 'invoice'; fromMonth: number; toMonth: number; count: number
  /** v1.6: the CAPEX payment and the subscription in each invoice of the run (OPEX: 0 and the fee). */
  capexCents: bigint; subscriptionCents: bigint
  netCents: bigint; invoiceCents: bigint; gstCents: bigint; invoiceInclGstCents: bigint
  whtCents: bigint; whtBorne: boolean; receivedCents: bigint
  lines?: ScheduleLine[]
}
export interface ScheduleLine {
  kind: 'hardware' | 'service' | 'invoice'
  netCents: bigint; invoiceCents: bigint; gstCents: bigint; invoiceInclGstCents: bigint
  whtCents: bigint; receivedCents: bigint
}
export interface Tax { capexCents: bigint; subscriptionCents: bigint; invoicedCents: bigint; netCents: bigint; grossUpCents: bigint; gstCents: bigint; whtCents: bigint; whtBorneCents: bigint; receivedCents: bigint; tcvInclGstCents: bigint }
export interface CapexPlan {
  amountMode: 'hardware' | 'custom'
  structure: 'hybrid' | 'two_phase'
  recoveryMonths: number | null
  hardwareValueCents: bigint
  hardwareCostCents: bigint
  capexCents: bigint
  payments: Array<{ key: string | null; month: number; cents: bigint }>
  baseFeeCents: bigint
  lastBaseFeeCents: bigint
  subscriptionByYear: bigint[]
  lastSubscriptionCents: bigint
  warnings: { hardwareFundedCents: bigint | null; hostingMonthlyCents: bigint; subscriptionBelowHosting: boolean }
  allocation: Allocation
}
/** v1.7 (T-4): how far CAPEX has been allocated. Only a complete allocation prices a quote. */
export interface Allocation {
  status: 'complete' | 'incomplete' | 'over'
  rows: Array<{ key: string | null; month: number; cents: bigint | null }>
  allocated: { share: Fraction; cents: bigint }
  unallocated: { share: Fraction; cents: bigint }
  excess: { share: Fraction; cents: bigint } | null
}
export interface BreakdownRow {
  fromMonth: number; toMonth: number; keys: string[]
  capexCents: bigint; subscriptionCents: bigint; netCents: bigint
}
export interface AllocationPreview extends Allocation {
  baseTcvCents: bigint
  capexCents: bigint
  amountMode: 'hardware' | 'custom'
  structure: 'hybrid' | 'two_phase'
  hardwareValueCents: bigint
  hardwareCostCents: bigint
  baseFeeCents: bigint
  lastBaseFeeCents: bigint
  warnings: CapexPlan['warnings']
  /** The Base schedule (no CPI), with milestone keys; null when over 100%. */
  breakdown: BreakdownRow[] | null
  /** The breakdown's Total row, the unscheduled amount included; null when over. */
  breakdownTotals: { capexCents: bigint; subscriptionCents: bigint; netCents: bigint } | null
  /** The "not yet scheduled" amount: 0 when complete, null when over. */
  unscheduledCents: bigint | null
  /** priceQuote's own result when complete, otherwise null. */
  quote: Quote | null
}
export interface Quote {
  termMonths: number
  paymentStructure: 'opex' | 'capex'
  cpiMode: CpiMode
  escalatorStartYear: number
  whtSplit: boolean
  currency: string
  lines: QuoteLine[]
  monthlyTotalCents: bigint
  monthlyTotalByYear: bigint[]
  /** v1.6: BASE TCV (no CPI). It carries approval: margin, floor, profit table. */
  tcvNetCents: bigint
  /** v1.6: Final TCV, the Final schedule's net invoices (with CPI). */
  finalTcvCents: bigint
  cpiUpliftCents: bigint
  /** v1.6 (C-3): Final under Locked, Base otherwise. */
  dealValueCents: bigint
  totalCostCents: bigint
  grossProfitCents: bigint
  grossMargin: Fraction
  marginFloor: Fraction
  belowMarginFloor: boolean
  marginAfterWht: Fraction | null
  capex: CapexPlan | null
  hardwareValueCents: bigint
  /** v1.6 (Q10): net invoices, months 0 to 12, on the Final schedule. */
  cashYear1Cents: bigint
  opexCashYear1Cents: bigint
  /** The Final schedule: what the client is invoiced. */
  schedule: ScheduleRow[]
  tax: Tax
  /** The Base schedule (no CPI): approval's WHT and the Base tie. */
  base: { tcvNetCents: bigint; schedule: ScheduleRow[]; tax: Tax }
}
/** v1.6 (C-10): every row is the OPEX Base row, in both structures. */
export interface LadderRow {
  termMonths: number; isAnchor: boolean
  monthlyTotalCents: bigint
  savingVsAnchor: Fraction; tcvNetCents: bigint; grossMargin: Fraction; belowMarginFloor: boolean
  /** v1.5 section 4.5, v1.6 C-10: null with no product named, or no units. */
  perCameraCents: bigint | null
}

export function parseDecimal(value: string | bigint, what?: string): Fraction
export function roundHalfUp(x: Fraction, places?: number): bigint
export function normaliseParams(params: EngineParamsInput | NormalisedParams): NormalisedParams
export function articleFor(n: number): 'a' | 'an'
export function unitEconomics(product: string, termMonths: number, params: EngineParamsInput | NormalisedParams): unknown
export function priceQuote(input: QuoteInput, params: EngineParamsInput | NormalisedParams): Quote
export function capexAllocation(input: QuoteInput, params: EngineParamsInput | NormalisedParams): AllocationPreview
export function termLadder(input: Omit<QuoteInput, 'termMonths'> & { termMonths?: number; perCameraProduct?: string }, params: EngineParamsInput | NormalisedParams): LadderRow[]
/** v1.8 (spec 3.2, TB-6): never throws; every broken rule, in band order. */
export function validateBands(bands: unknown): BandValidation
/** v1.8 (spec 10.4, TB-7): the margin check on the bands as typed. */
export function bandMarginGrid(product: string, bands: unknown, params: EngineParamsInput | NormalisedParams): BandGrid
/** v1.9 (spec 4.6, TP_MANUAL): a check on one priced row, in the order floor, total, profit. */
export interface ManualFlag { kind: 'floor' | 'total' | 'profit'; against?: number; message: string }
export interface ManualRow {
  termMonths: number
  /** termLadder's per-camera fee at one unit (M-8). */
  calculatedCents: bigint | null
  status: 'blank' | 'invalid' | 'priced'
  /** 'invalid' only: the field error (C9). */
  message?: string
  priceCents?: bigint; totalCents?: bigint; costCents?: bigint; profitCents?: bigint
  difference?: Fraction
  /** 'list' at ANCHOR_TERM; null when the anchor term has no price (MG-3). */
  vsAnchor?: Fraction | 'list' | null
  margin?: Fraction
  flags?: ManualFlag[]
}
export interface ManualCheck { ok: boolean; terms: number[]; text: string }
export interface ManualLadder {
  product: string; anchorTerm: number; floor: Fraction
  hwCostCents: bigint; hostingMonthlyCents: bigint; firstBandDiscountPct: string
  rows: ManualRow[]
  summary: { priced: number; floor: ManualCheck; total: ManualCheck; profit: ManualCheck }
}
/** v1.9 (spec 4.6): comparison only; it prices nothing and changes nothing. */
export function manualLadder(input: { product: string; prices: Record<number, string | undefined> }, params: EngineParamsInput | NormalisedParams): ManualLadder
export function formatMoney(cents: bigint): string
export function formatPct(ratio: Fraction, places?: number): string
