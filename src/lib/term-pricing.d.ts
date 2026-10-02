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
  escalatorPct?: string | null
  escalatorStartYear?: number
  gstPct?: string | null
  whtPct?: string | null
  whtGrossUp?: boolean
  whtSplit?: boolean
  whtHwPct?: string | null
  whtSaasPct?: string | null
}

export interface QuoteBand { from: number; to: number | null; discountPct: string; units: number; feeByYear: bigint[] }
export interface QuoteLine {
  product: string; units: number; listFee: Fraction; savingVsAnchor: Fraction
  costPerUnitCents: bigint; bands: QuoteBand[]; monthlyByYear: bigint[]
}
export interface ScheduleRow {
  kind: 'upfront' | 'monthly'; fromMonth: number; toMonth: number; count: number
  netCents: bigint; invoiceCents: bigint; gstCents: bigint; invoiceInclGstCents: bigint
  whtCents: bigint; whtBorne: boolean; receivedCents: bigint
  lines?: ScheduleLine[]
}
export interface ScheduleLine {
  kind: 'hardware' | 'service'
  netCents: bigint; invoiceCents: bigint; gstCents: bigint; invoiceInclGstCents: bigint
  whtCents: bigint; receivedCents: bigint
}
export interface Quote {
  termMonths: number
  paymentStructure: 'opex' | 'capex'
  escalatorStartYear: number
  whtSplit: boolean
  currency: string
  lines: QuoteLine[]
  monthlyTotalCents: bigint
  monthlyTotalByYear: bigint[]
  tcvNetCents: bigint
  totalCostCents: bigint
  grossProfitCents: bigint
  grossMargin: Fraction
  marginFloor: Fraction
  belowMarginFloor: boolean
  marginAfterWht: Fraction | null
  capex: { hardwareUpfront: Fraction; upfrontCents: bigint; monthlyServiceCents: bigint; serviceByYear: bigint[] } | null
  schedule: ScheduleRow[]
  tax: { invoicedCents: bigint; netCents: bigint; grossUpCents: bigint; gstCents: bigint; whtCents: bigint; whtBorneCents: bigint; receivedCents: bigint; tcvInclGstCents: bigint }
}
export interface LadderRow {
  termMonths: number; isAnchor: boolean; paymentStructure: 'opex' | 'capex'
  monthlyTotalCents: bigint; upfrontCents: bigint | null; monthlyServiceCents: bigint | null
  savingVsAnchor: Fraction; tcvNetCents: bigint; grossMargin: Fraction; belowMarginFloor: boolean
}

export function parseDecimal(value: string | bigint, what?: string): Fraction
export function roundHalfUp(x: Fraction, places?: number): bigint
export function normaliseParams(params: EngineParamsInput | NormalisedParams): NormalisedParams
export function articleFor(n: number): 'a' | 'an'
export function unitEconomics(product: string, termMonths: number, params: EngineParamsInput | NormalisedParams): unknown
export function priceQuote(input: QuoteInput, params: EngineParamsInput | NormalisedParams): Quote
export function termLadder(input: Omit<QuoteInput, 'termMonths'> & { termMonths?: number }, params: EngineParamsInput | NormalisedParams): LadderRow[]
export function formatMoney(cents: bigint): string
export function formatPct(ratio: Fraction, places?: number): string
