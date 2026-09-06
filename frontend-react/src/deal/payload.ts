import { toNumberOrNull } from '../../../src/lib/numeric-payload.js'

// ── THE DEAL FORM'S PAYLOAD READER ───────────────────────────────────────
//
// Migration Round 3. The round's central proof reduces to one claim: FOR
// IDENTICAL VISIBLE INPUTS, THIS PRODUCES A PAYLOAD DEEP-EQUAL TO
// `readPayload()`'s. Everything downstream - resolveRates, buildDealInputs,
// calculateDeal - is imported from src/lib untouched by both implementations,
// so if the payloads match the arithmetic cannot diverge.
//
// IT TAKES VALUES, NOT A DOM. The vanilla reads `document.getElementById(id).value`
// because the DOM is its state. React's state is not the DOM, and a reader that
// went looking for elements would be testing the render rather than the read.
// So the interface is the visible input space itself: id -> string, exactly what
// a person has typed.
//
// THE FOUR EMPTY-STATE CONTRACTS ARE PRESERVED PER INPUT, NEVER NORMALISED.
// They are four different promises about what an empty box means, and Phase 0
// measured that flattening any of them changes what gets written:
//
//   num             empty -> 0          an empty box is a VALUE, zero
//   emptyToNull     empty -> null       an empty box is "not recorded"
//   numOrNull       empty -> null       same, through the shared coercion
//   numOrUndefined  empty -> undefined  the key is ABSENT, which the record
//                                       reads as DELETION. Eleven margin keys.

export const MARGIN_KEYS = [
  'hwSs', 'hwAqm', 'hwHemir', 'hwWarranty', 'inSsEx', 'inSsNew',
  'inAqm', 'inHemir', 'hoSs', 'hoAqm', 'hoHemir',
] as const

export const COMMERCIALS_OWNED_KEYS = [
  'ssExisting', 'ssNew', 'aqm', 'hemir', 'installResp', 'lumpSumCost',
  'targetMargin', 'marginOverrides', 'inSsExisting', 'inSsNew', 'inAqm', 'inHemir',
  'warrantyPct', 'whtPct', 'gstPct', 'grossUp', 'bidCurrency', 'proposalCurrency',
  'fxContingency', 'duration', 'structure', 'recoveryMonths', 'invoicing',
  'milestones', 'contractorMilestones', 'factoring',
] as const

export const MILESTONE_ROWS = 5

export interface UiState {
  installResp: string
  structure: string
  invoicing: string
  grossUp: boolean
  factoringEnabled: boolean
  factoringMethod: string
}

export interface CatalogRates {
  ssUnitCost?: number; aqUnitCost?: number; hemirUnitCost?: number
  hoSafesight?: number; hoAqm?: number; hoHemir?: number
  [k: string]: number | undefined
}

/** id -> the string the box holds. An absent id is an absent element. */
export type Values = Record<string, string | undefined>

// ── THE FOUR HELPERS, PORTED EXACTLY ─────────────────────────────────────
// `?.value` on a missing element yields undefined in the vanilla, and each
// helper treats that differently. The `v === undefined` branches below are
// that behaviour, not defensive padding.

export function num(values: Values, id: string): number {
  const v = parseFloat(values[id] as string)
  return Number.isFinite(v) ? v : 0
}

export function emptyToNull(values: Values, id: string): string | null {
  const v = values[id]
  return v === '' || v === undefined ? null : v
}

export function numOrNull(values: Values, id: string): number | null {
  return toNumberOrNull(values[id]) as number | null
}

export function numOrUndefined(values: Values, id: string): number | undefined {
  const raw = values[id]
  if (raw === '' || raw == null) return undefined
  const v = parseFloat(raw)
  return Number.isFinite(v) ? v : undefined
}

export interface Milestone { month: number; label: string; usd: number; pct: number | null }
export interface ContractorMilestone extends Milestone { incomplete: boolean }

// A milestone row counts only when it has BOTH a month and an amount.
export function readMilestones(values: Values): Milestone[] {
  const rows: Milestone[] = []
  for (let i = 0; i < MILESTONE_ROWS; i++) {
    const month = num(values, `deal-ms-${i}-month`)
    const label = values[`deal-ms-${i}-label`] ?? ''
    const usd = num(values, `deal-ms-${i}-usd`)
    const pct = (toNumberOrNull(values[`deal-ms-${i}-pct`]) as number | null) ?? 0
    if (month > 0 && usd > 0) rows.push({ month, label, usd, pct })
  }
  return rows
}

// ── AND THE CONTRACTOR READER IS DELIBERATELY DIFFERENT IN THREE WAYS ────
// It counts a row on the AMOUNT alone, it does NOT default pct to 0, and it
// carries `incomplete` for a row with no month. A reader that treated the two
// alike would silently drop a contractor row somebody had half-entered, which
// is the row the schedule warning exists to surface.
export function readContractorMilestones(values: Values): ContractorMilestone[] {
  const rows: ContractorMilestone[] = []
  for (let i = 0; i < MILESTONE_ROWS; i++) {
    const month = num(values, `deal-cm-${i}-month`)
    const label = values[`deal-cm-${i}-label`] ?? ''
    const usd = num(values, `deal-cm-${i}-usd`)
    const pct = toNumberOrNull(values[`deal-cm-${i}-pct`]) as number | null
    if (usd > 0) rows.push({ month, label, usd, pct, incomplete: !(month > 0) })
  }
  return rows
}

export function readDealPayload(
  values: Values, ui: UiState, catalogRates: CatalogRates,
): Record<string, unknown> {
  // An absent margin box drops its key. That is the deletion contract, and the
  // vanilla records that rebuilding this object from a screen without the boxes
  // would have emptied the overrides on 33 opportunities at their first save.
  const marginOverrides: Record<string, number> = {}
  for (const key of MARGIN_KEYS) {
    const v = numOrUndefined(values, `deal-margin-${key}`)
    if (v !== undefined) marginOverrides[key] = v
  }

  return {
    ssExisting: numOrNull(values, 'deal-ssExisting'),
    ssNew: numOrNull(values, 'deal-ssNew'),
    aqm: numOrNull(values, 'deal-aqm'),
    hemir: numOrNull(values, 'deal-hemir'),

    // Rates come from the CATALOG, never from the form. The readonly inputs
    // exist so the note lines can read "N units x $rate"; they are a display of
    // a rate, not a record of one.
    ssUnitCost: catalogRates.ssUnitCost ?? 0,
    aqUnitCost: catalogRates.aqUnitCost ?? 0,
    hemirUnitCost: catalogRates.hemirUnitCost ?? 0,

    installResp: ui.installResp,
    lumpSumCost: numOrNull(values, 'deal-lumpCost'),

    // These four ARE read from the box, and an empty box is null: no override,
    // use the catalog. Copying the catalog figure onto them would record a
    // per-deal override of the catalog on every deal, silently, on all four.
    inSsExisting: numOrNull(values, 'deal-inSsExisting'),
    inSsNew: numOrNull(values, 'deal-inSsNew'),
    inAqm: numOrNull(values, 'deal-inAqm'),
    inHemir: numOrNull(values, 'deal-inHemir'),

    hoSafesight: catalogRates.hoSafesight ?? 0,
    hoAqm: catalogRates.hoAqm ?? 0,
    hoHemir: catalogRates.hoHemir ?? 0,

    targetMargin: numOrNull(values, 'deal-targetMargin'),
    marginOverrides,

    warrantyPct: numOrNull(values, 'deal-warrantyPct'),
    whtPct: numOrNull(values, 'deal-whtPct'),
    gstPct: numOrNull(values, 'deal-gstPct'),
    grossUp: ui.grossUp,

    bidCurrency: emptyToNull(values, 'deal-bidCurrency'),
    proposalCurrency: emptyToNull(values, 'deal-proposalCurrency'),
    fxContingency: numOrNull(values, 'deal-fxContingency'),

    duration: numOrNull(values, 'deal-duration'),
    structure: ui.structure,
    recoveryMonths: numOrNull(values, 'deal-recoveryMonths'),
    invoicing: ui.invoicing,
    milestones: readMilestones(values),

    contractorMilestones: readContractorMilestones(values),

    factoring: {
      enabled: ui.factoringEnabled,
      ratePct: num(values, 'deal-factoring-ratePct'),
      termMonths: num(values, 'deal-factoring-termMonths'),
      method: ui.factoringMethod,
    },
  }
}

// ── THE SALESPERSON-WRITABLE PROJECTION ──────────────────────────────────
// undefined becomes null here, deliberately: an owned key must always be
// PRESENT in the projection, or the save would read as a deletion of it.
// The undefined-drops-the-key contract lives one level down, inside
// marginOverrides, and this does not undo it.
export function pickSalespersonWritable(payload: Record<string, unknown>): Record<string, unknown> {
  const owned: Record<string, unknown> = {}
  for (const key of COMMERCIALS_OWNED_KEYS) {
    owned[key] = payload[key] === undefined ? null : payload[key]
  }
  return owned
}

// ── THE REVERSE READER: A SAVED PAYLOAD BACK INTO FORM VALUES ────────────
//
// The mount and `populateForm` both need this, and the panel had it inline in
// one of them, over CENSUS ids only. That version could not restore the
// milestone rows, the contractor rows, the margin overrides or the UI state,
// which is most of what the vanilla's populateForm does.
//
// THE KEY MAP IS THE INVERSE OF readDealPayload's, taken from it line by line
// rather than guessed from the id: `deal-lumpCost` carries `lumpSumCost`, and
// the four install rates carry `inSsExisting`-style keys, so a rule like
// "strip deal-" would have silently dropped five values.
const VALUE_KEYS: [string, string][] = [
  ['deal-ssExisting', 'ssExisting'], ['deal-ssNew', 'ssNew'],
  ['deal-aqm', 'aqm'], ['deal-hemir', 'hemir'],
  ['deal-lumpCost', 'lumpSumCost'],
  ['deal-inSsExisting', 'inSsExisting'], ['deal-inSsNew', 'inSsNew'],
  ['deal-inAqm', 'inAqm'], ['deal-inHemir', 'inHemir'],
  ['deal-targetMargin', 'targetMargin'], ['deal-warrantyPct', 'warrantyPct'],
  ['deal-whtPct', 'whtPct'], ['deal-gstPct', 'gstPct'],
  ['deal-bidCurrency', 'bidCurrency'], ['deal-proposalCurrency', 'proposalCurrency'],
  ['deal-fxContingency', 'fxContingency'],
  ['deal-duration', 'duration'], ['deal-recoveryMonths', 'recoveryMonths'],
]

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v))

export function valuesFromPayload(payload: Record<string, unknown> | null | undefined): Values {
  const p = payload ?? {}
  const out: Values = {}
  for (const [id, key] of VALUE_KEYS) out[id] = str(p[key])

  const overrides = (p.marginOverrides ?? {}) as Record<string, unknown>
  for (const k of MARGIN_KEYS) out[`deal-margin-${k}`] = str(overrides[k])

  const rows = (p.milestones ?? []) as Record<string, unknown>[]
  const crows = (p.contractorMilestones ?? []) as Record<string, unknown>[]
  for (let i = 0; i < MILESTONE_ROWS; i++) {
    for (const [prefix, src] of [['ms', rows], ['cm', crows]] as const) {
      const r = (src[i] ?? {}) as Record<string, unknown>
      out[`deal-${prefix}-${i}-month`] = str(r.month)
      out[`deal-${prefix}-${i}-label`] = str(r.label)
      out[`deal-${prefix}-${i}-pct`] = str(r.pct)
      out[`deal-${prefix}-${i}-usd`] = str(r.usd)
    }
  }

  const f = (p.factoring ?? {}) as Record<string, unknown>
  out['deal-factoring-ratePct'] = str(f.ratePct)
  out['deal-factoring-termMonths'] = str(f.termMonths)
  return out
}

/** The UI half, which lives outside `values` and is not derivable from it. */
export function uiFromPayload(payload: Record<string, unknown> | null | undefined): UiState {
  const p = payload ?? {}
  const f = (p.factoring ?? {}) as Record<string, unknown>
  // The vanilla's own fallbacks, at the same three places it applies them.
  return {
    installResp: (p.installResp as string) || 'Client Own Installation Team',
    structure: (p.structure as string) || 'twoPhase',
    invoicing: (p.invoicing as string) || 'annual',
    grossUp: !!p.grossUp,
    factoringEnabled: !!f.enabled,
    factoringMethod: (f.method as string) || 'straight',
  }
}
