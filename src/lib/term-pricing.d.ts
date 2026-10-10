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
  VOLUME_BANDS: Array<{ from: number; discountPct: string }>
  HW_UPFRONT_MARGIN: string
  MARGIN_FLOOR: string
  CURRENCY: string
  costs: Record<string, { hwCost: string; hostingMonthly: string }>
}

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
  milestones?: Array<{ key: string; month: number; sharePct: string }>
  recoveryMonths?: number
}

export type CpiMode = 'none' | 'published' | 'locked'

export interface QuoteBand { from: number; to: number | null; discountPct: string; units: number; feeByYear: bigint[] }
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
export function termLadder(input: Omit<QuoteInput, 'termMonths'> & { termMonths?: number; perCameraProduct?: string }, params: EngineParamsInput | NormalisedParams): LadderRow[]
export function formatMoney(cents: bigint): string
export function formatPct(ratio: Fraction, places?: number): string
