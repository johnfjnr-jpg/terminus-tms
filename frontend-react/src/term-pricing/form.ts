// ── THE TERM QUOTE'S INPUTS, AS THE SCREEN HOLDS THEM (TERM_QUOTES P2, V3) ──
//
// Bound mode lifts the view's input state into ONE value object, so the
// opportunity's Term quote tab can hand the view a quote and receive every
// edit (John's P2: "lift the 28 inputs into one value object with optional
// { value, onChange }"). The standalone screen keeps its own copy of the same
// object and is otherwise unchanged.
//
// Two shapes, deliberately: `TermQuoteForm` is what the CONTROLS hold
// (strings as typed, a mode per choice); the engine input is what the RECORD
// holds (`termQuote`, spec v2.1 section 14.2: "what the screen shows but the
// engine does not read is not stored"). `inputFromForm` is the ONE place the
// first becomes the second, used by the view to price and by the tab to save,
// so the figures on screen and the figures saved are one derivation
// (Architecture 3). `formFromInput` reopens a saved quote.
import type { CpiMode } from '../../../src/lib/term-pricing.js'
import { MILESTONE_NAMES } from '../../../src/lib/milestone-vocabulary.js'
import { TERM_PRODUCTS } from '../../../src/lib/term-quote.js'

export type CapexAmount = 'hardware' | 'custom'
export type CapexStructure = 'hybrid' | 'two_phase'
export type WhtMode = 'none' | 'single' | 'split'
export interface MilestoneDraft { key: string; month: string; share: string }
export const DEFAULT_MILESTONE: MilestoneDraft = { key: MILESTONE_NAMES[0], month: '0', share: '100' }

export interface TermQuoteForm {
  units: Record<string, string>
  term: number
  structure: 'opex' | 'capex'
  cpiMode: CpiMode
  escalator: string
  startYear: number
  gst: string
  whtMode: WhtMode
  whtPct: string
  grossUp: boolean
  whtHw: string
  whtSaas: string
  capexAmount: CapexAmount
  capexCustom: string
  capexStructure: CapexStructure
  milestones: MilestoneDraft[]
  recovery: string
  factoringOn: boolean
  fxAdvance: string | null
  fxRate: string
  fxTerm: string
  fxMethod: 'straight' | 'declining'
  fxTreatment: 'absorb' | 'pass_through'
  dealMode: 'none' | 'discount' | 'fee'
  dealPct: string
  dealFee: string
  dealFeeTerm: number
}

/** The standalone screen's opening values, unchanged by this round. */
export const DEFAULT_TERM_FORM: TermQuoteForm = Object.freeze({
  units: { safesight: '1', air_quality: '0', hemir: '0' },
  term: 36,
  structure: 'opex',
  cpiMode: 'none',
  escalator: '',
  startYear: 2,
  gst: '9',
  whtMode: 'none',
  whtPct: '',
  grossUp: false,
  whtHw: '',
  whtSaas: '',
  capexAmount: 'hardware',
  capexCustom: '',
  capexStructure: 'hybrid',
  milestones: [DEFAULT_MILESTONE],
  recovery: '12',
  factoringOn: false,
  fxAdvance: null,
  fxRate: '',
  fxTerm: '12',
  fxMethod: 'straight',
  fxTreatment: 'absorb',
  dealMode: 'none',
  dealPct: '',
  dealFee: '',
  dealFeeTerm: 36,
}) as TermQuoteForm

const isWhole = (s: string) => /^\d+$/.test(s.trim())
const blankNull = (v: string) => (v.trim() === '' ? null : v.trim())
const whole = (v: string) => (isWhole(v) ? Number(v) : v) as number

/** Units as the engine counts them: blank is 0. */
export function unitCountsOf(units: Record<string, string>): Record<string, number> {
  return Object.fromEntries(TERM_PRODUCTS.map((p) => [p.key, (units[p.key] ?? '').trim() === '' ? 0 : Number(units[p.key])]))
}

export function dealAdjustmentOf(f: TermQuoteForm) {
  return f.dealMode === 'discount'
    ? { discountPct: f.dealPct.trim() }
    : f.dealMode === 'fee' ? { monthlyFee: f.dealFee.replace(/,/g, '').trim(), termMonths: f.dealFeeTerm } : null
}

export function factoringOf(f: TermQuoteForm) {
  return f.factoringOn ? {
    enabled: true,
    ratePct: f.fxRate.trim() === '' ? null : f.fxRate.trim(),
    termMonths: (f.fxTerm.trim() === '' ? null : isWhole(f.fxTerm) ? Number(f.fxTerm) : f.fxTerm.trim()) as number | null,
    method: f.fxMethod,
    treatment: f.fxTreatment,
    advance: f.fxAdvance === null || f.fxAdvance.trim() === '' ? null : f.fxAdvance.replace(/,/g, '').trim(),
  } : null
}

/** The engine input, and so the record's termQuote and a version's inputs. */
export function inputFromForm(f: TermQuoteForm) {
  const cpiOn = f.cpiMode !== 'none'
  const capex = f.structure === 'capex'
  return {
    units: unitCountsOf(f.units),
    termMonths: f.term,
    paymentStructure: f.structure,
    cpiMode: f.cpiMode,
    escalatorPct: cpiOn ? blankNull(f.escalator) : null,
    escalatorStartYear: f.startYear,
    gstPct: blankNull(f.gst),
    whtPct: f.whtMode === 'single' ? blankNull(f.whtPct) : null,
    whtGrossUp: f.whtMode !== 'none' && f.grossUp,
    whtSplit: f.whtMode === 'split',
    whtHwPct: f.whtMode === 'split' ? blankNull(f.whtHw) : null,
    whtSaasPct: f.whtMode === 'split' ? blankNull(f.whtSaas) : null,
    factoring: factoringOf(f),
    dealAdjustment: dealAdjustmentOf(f),
    ...(capex ? {
      capexAmount: f.capexAmount,
      capexCustom: f.capexAmount === 'custom' ? f.capexCustom.replace(/,/g, '').trim() : null,
      capexStructure: f.capexStructure,
      ...(f.capexStructure === 'hybrid'
        ? { milestones: f.milestones.map((m) => ({ key: m.key, month: whole(m.month), sharePct: m.share.trim() })) }
        : { recoveryMonths: whole(f.recovery) }),
    } : {}),
  }
}

type Input = Partial<ReturnType<typeof inputFromForm>> & Record<string, unknown>
const str = (v: unknown, fallback = '') => (v === null || v === undefined ? fallback : String(v))

/**
 * A saved quote back into the controls. Values the engine does not read and
 * the record does not keep (an escalator typed while CPI was off, a custom
 * CAPEX figure under Hardware) come back as the defaults: they were never
 * saved, which is spec 14.2's rule, not a loss.
 */
export function formFromInput(input: Input | null | undefined): TermQuoteForm {
  if (!input || typeof input !== 'object') return { ...DEFAULT_TERM_FORM, units: { ...DEFAULT_TERM_FORM.units } }
  const d = DEFAULT_TERM_FORM
  const units = Object.fromEntries(TERM_PRODUCTS.map((p) => [p.key, str((input.units as Record<string, unknown> | undefined)?.[p.key], '0')]))
  const deal = input.dealAdjustment as { discountPct?: string, monthlyFee?: string, termMonths?: number } | null | undefined
  const fx = input.factoring as { ratePct?: string | null, termMonths?: number | string | null, method?: 'straight' | 'declining', treatment?: 'absorb' | 'pass_through', advance?: string | null } | null | undefined
  const ms = input.milestones as Array<{ key: string, month: number | string, sharePct: string }> | undefined
  const whtMode: WhtMode = input.whtSplit ? 'split' : input.whtPct !== null && input.whtPct !== undefined ? 'single' : 'none'
  return {
    units,
    term: Number(input.termMonths ?? d.term),
    structure: input.paymentStructure === 'capex' ? 'capex' : 'opex',
    cpiMode: (input.cpiMode as CpiMode) ?? 'none',
    escalator: str(input.escalatorPct),
    startYear: Number(input.escalatorStartYear ?? d.startYear),
    gst: str(input.gstPct),
    whtMode,
    whtPct: str(input.whtPct),
    grossUp: !!input.whtGrossUp,
    whtHw: str(input.whtHwPct),
    whtSaas: str(input.whtSaasPct),
    capexAmount: (input.capexAmount as CapexAmount) ?? d.capexAmount,
    capexCustom: str(input.capexCustom),
    capexStructure: (input.capexStructure as CapexStructure) ?? d.capexStructure,
    milestones: ms?.length ? ms.map((m) => ({ key: m.key, month: str(m.month, '0'), share: str(m.sharePct) })) : [DEFAULT_MILESTONE],
    recovery: str(input.recoveryMonths, d.recovery),
    factoringOn: !!fx,
    fxAdvance: fx?.advance ?? null,
    fxRate: str(fx?.ratePct),
    fxTerm: str(fx?.termMonths, d.fxTerm),
    fxMethod: fx?.method ?? d.fxMethod,
    fxTreatment: fx?.treatment ?? d.fxTreatment,
    dealMode: deal?.discountPct !== undefined && deal?.discountPct !== null ? 'discount' : deal?.monthlyFee ? 'fee' : 'none',
    dealPct: str(deal?.discountPct),
    dealFee: str(deal?.monthlyFee),
    dealFeeTerm: Number(deal?.termMonths ?? input.termMonths ?? d.dealFeeTerm),
  }
}
