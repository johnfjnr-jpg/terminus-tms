// Types for src/lib/term-pricing.js, for the React screen. The engine stays
// plain JavaScript; this file only describes what it returns.

export interface Fraction { n: bigint; d: bigint }

export class TermPricingError extends Error {
  code: string
  constructor(code: string, message: string)
}

export interface EngineParamsInput {
  TERMS: number[]
  /** v2.0 (Q1): sets the "vs N months" column; derives no price. */
  COMPARE_TERM: number
  /** v2.0 (A1): the LIST price per unit per month, by term, per product. */
  PRICE_LADDER_BY_PRODUCT: Record<string, Record<string, string>>
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

export interface GridFlag { kind: 'floor' | 'total' | 'profit'; against?: number; message: string }
/** v2.0 (A6): `priced` false is a term with no price; it carries no figures. */
export interface BandGridCell {
  termMonths: number; priced: boolean
  feeCents?: bigint; tcvCents?: bigint; costCents?: bigint; profitCents?: bigint
  margin?: Fraction; belowFloor?: boolean; flags?: GridFlag[]
}
export interface BandGridRow { band: number; from: number; to: number | null; discountPct: string; cells: BandGridCell[] }
export interface GridCheck { ok: boolean; cells: Array<{ band: number; termMonths: number }> }
export type BandGrid =
  | { ok: true; floor: Fraction; terms: number[]; feeTerms: number[]; compareTerm: number; rows: BandGridRow[]
      breaches: Array<{ band: number; termMonths: number; feeCents: bigint; margin: Fraction }>
      unpriced: number[]; checks: { floor: GridCheck; total: GridCheck; profit: GridCheck } }
  | { ok: false; problems: BandProblem[] }

export interface LadderProblem { termMonths: number | string; message: string }
export interface LadderValidation { ok: boolean; problems: LadderProblem[]; ladder: Record<string, string> | null }

export interface NormalisedParams {
  terms: number[]
  compareTerm: number
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
  /** v1.10 (spec 2, 9.2 to 9.4). Absent or enabled false: every v1.9 figure. */
  factoring?: FactoringInput | null
  /** v1.10 (9.5, R-TF12), engine level: default one entry, month 1, the hardware cost. */
  vendorPayments?: Array<{ month: number; amount: string }>
  /** v2.0 (A4): either-or. A fee is typed at `termMonths`; other terms keep its discount. */
  dealAdjustment?: DealAdjustmentInput | null
}

export type DealAdjustmentInput =
  | { discountPct: string; monthlyFee?: undefined }
  | { monthlyFee: string; termMonths: number; discountPct?: undefined }

/** v2.0 (A4): list, the deal adjustment and the approval signal. */
export interface DealDiscount {
  mode: 'discount' | 'fee' | null
  /** The exact discount off the banded list. */
  ratio: Fraction
  atTerm: number | null
  listMonthlyCents: bigint; dealMonthlyCents: bigint; discountMonthlyCents: bigint
  listTcvCents: bigint; discountValueCents: bigint
  approvalSignal: boolean
}

/** v2.0 (amended L-8): why a term or product prices nothing. */
export interface MissingPrice { code: 'NO_PRICE_LADDER' | 'NO_PRICE_LADDER_PRICE'; product: string; termMonths: number | null; message: string }

export interface FactoringInput {
  enabled: boolean
  /** Percent PER MONTH, as Commercials. Blank is refused while on. */
  ratePct?: string | null
  /** 1 to T - 1. Blank is refused while on. */
  termMonths?: number | null
  method?: 'straight' | 'declining'
  treatment?: 'absorb' | 'pass_through'
  /** Blank means the hardware cost (R-TF3). */
  advance?: string | null
  /** R-TF12, engine level: each entry is its own facility. */
  advanceSchedule?: Array<{ month: number; amount: string }>
}
export interface LoanMonth { i: number; principalCents: bigint; interestCents: bigint; principalExact: Fraction; interestExact: Fraction }
export interface LoanSchedule { advanceCents: bigint; ratePct: string; termMonths: number; method: 'straight' | 'declining'; interestCents: bigint; months: LoanMonth[] }
export interface PassThrough { totalCents: bigint; perUnitMonthlyCents: bigint; remainderCents: bigint }
export interface Factoring {
  treatment: 'absorb' | 'pass_through'; method: 'straight' | 'declining'; ratePct: string; termMonths: number
  advanceCents: bigint; hardwareCostCents: bigint; advanceAboveHardwareCost: boolean
  facilities: Array<{ month: number; advanceCents: bigint; interestCents: bigint; months: LoanMonth[] }>
  /** F: the sum of the monthly interest cents (spec 9.2). */
  costCents: bigint
  allocation: Array<{ product: string; costCents: bigint; passThrough: PassThrough | null }>
  passThroughCents: bigint; passThroughMonthlyCents: bigint; passThroughLastExtraCents: bigint
  /** Absorb only (9.3); null under Pass through. */
  profitBeforeFinanceCents: bigint | null; marginBeforeFinance: Fraction | null
  profitAfterFinanceCents: bigint; marginAfterFinance: Fraction
  /** The same quote with factoring off (9.6). */
  without: { monthlyTotalCents: bigint; tcvNetCents: bigint; grossProfitCents: bigint; grossMargin: Fraction
    lowest: { balanceCents: bigint; month: number }; paybackMonth: number | null; closingBalanceCents: bigint }
}
/** Signed cents: in positive, out negative (spec 9.5). */
export interface CashFlowRow {
  month: number; procurementCents: bigint; advanceCents: bigint; clientCents: bigint; hostingCents: bigint
  principalCents: bigint; interestCents: bigint; netCents: bigint; balanceCents: bigint
}
export interface CashFlow { rows: CashFlowRow[]; lowest: { balanceCents: bigint; month: number }; paybackMonth: number | null; closingBalanceCents: bigint }

export type CpiMode = 'none' | 'published' | 'locked'

export interface QuoteBand {
  from: number; to: number | null; discountPct: string; units: number; feeByYear: bigint[]
  /** v1.7 (C1): the band's own totals on Base, from its year-1 fee; they sum to the line exactly. */
  monthlyCents: bigint; tcvNetCents: bigint; costCents: bigint; grossProfitCents: bigint; grossMargin: Fraction
}
export interface QuoteLine {
  product: string; units: number; listFee: Fraction
  /** v2.0: always 'ladder'; the formula is gone. */
  priceSource: 'ladder'
  /** v2.0 (Q1): against COMPARE_TERM; null when that term has no price. */
  savingVsCompare: Fraction | null
  /** v2.0 (A4): the banded year-1 monthly before the deal discount, and the line's share of it. */
  listMonthlyCents: bigint; dealDiscountMonthlyCents: bigint
  costPerUnitCents: bigint; bands: QuoteBand[]; monthlyByYear: bigint[]
  // v1.4: per-product totals; they sum to the deal exactly. No WHT field: WHT is never per product.
  tcvNetCents: bigint; costCents: bigint; grossProfitCents: bigint; grossMargin: Fraction
  /** v1.10: both bases; the factoring cost allocated to the line (both treatments) and, under Pass through, its price component. */
  hardwareCostCents: bigint; hostingMonthlyCents: bigint; factoringCostCents: bigint; passThrough: PassThrough | null
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
  dealDiscount: DealDiscount
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
  /** v1.10 (TERM_FACTORING) */
  hardwareCostCents: bigint
  hostingMonthlyCents: bigint
  factoring: Factoring | null
  cashFlow: CashFlow
  /** v1.6 (Q10): net invoices, months 0 to 12, on the Final schedule. */
  cashYear1Cents: bigint
  opexCashYear1Cents: bigint
  /** The Final schedule: what the client is invoiced. */
  schedule: ScheduleRow[]
  tax: Tax
  /** The Base schedule (no CPI): approval's WHT and the Base tie. */
  base: { tcvNetCents: bigint; schedule: ScheduleRow[]; tax: Tax }
}
/** v1.6 (C-10): every row is the OPEX Base row, in both structures. v2.0: a term with no price is a row that prices nothing. */
export type LadderRow = PricedLadderRow | MissingLadderRow
export interface PricedLadderRow {
  termMonths: number; priced: true; isCompare: boolean
  /** v2.0 (A4): banded, before the deal discount; and the deal fee. */
  listMonthlyCents: bigint; monthlyTotalCents: bigint
  /** v2.0 (Q1): list against COMPARE_TERM's list; null when it has no price. */
  savingVsCompare: Fraction | null
  listTcvCents: bigint; tcvNetCents: bigint; grossMargin: Fraction; belowMarginFloor: boolean
  /** v1.5 section 4.5: LIST, per camera. Null with no product named, or no units. */
  perCameraCents: bigint | null
}
export interface MissingLadderRow { termMonths: number; priced: false; isCompare: boolean; missing: MissingPrice }

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
/** v1.8 (spec 10.4, TB-7), v2.0 (A6): the margin check on the bands, and optionally the price ladder, as typed. */
export function bandMarginGrid(product: string, bands: unknown, params: EngineParamsInput | NormalisedParams, prices?: Record<string | number, string | undefined>): BandGrid
/** v2.0 (spec 3.3, L-5): never throws; every broken rule, in term order. */
export function validateLadder(prices: unknown, terms: number[]): LadderValidation
export const NO_LADDER_CODES: readonly ['NO_PRICE_LADDER', 'NO_PRICE_LADDER_PRICE']
export function formatMoney(cents: bigint): string
export function loanSchedule(advanceCents: bigint, ratePct: string, termMonths: number, method?: 'straight' | 'declining'): LoanSchedule
export function formatPct(ratio: Fraction, places?: number): string
