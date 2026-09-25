import { toNumberOrNull } from '../../../src/lib/numeric-payload.js'
// ONE LIST, IMPORTED. The allowed override keys live with the pricing that
// honours them, so the form cannot offer a box the calculator will ignore.
import { PRICE_OVERRIDE_KEYS } from '../../../src/lib/deal-calculator.js'
// THE DERIVATION'S OWN LIST, imported rather than restated, so a fourth row
// added there reaches the store without anybody remembering.
import { OPEX_FEE_KEYS } from '../../../src/lib/opex.js'

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

// ── WALK 11 D3: `inLump` IS THE TWELFTH, AND ITS ABSENCE WAS INVISIBLE ───
//
// `marginFor('inLump')` has read `marginOverrides.inLump` since the lump-sum
// line existed. This list is what BUILDS `marginOverrides` from the screen,
// and it did not contain the key - so the override could never be written,
// and every lump-sum installation priced at the target margin with no control
// anywhere able to change it. Measured: all four live lump-sum opportunities
// carry no `inLump`, and TT-SGP-MANUFI-004's $285,714 is exactly
// round(200000 / (1 - 30/100)).
//
// ARCHITECTURE 9, and it is why the box and this line had to land together:
// an allowlist gives no feedback when it excludes something. A margin input
// added to the card with the id `deal-margin-inLump` would have rendered,
// accepted typing, and been discarded at save, with nothing failing.
//
// The list is read TWICE, by `readDealPayload` and by `hydrate`, so one entry
// serves the write and the read and they cannot disagree about the key set.
/**
 * R-REV: the inputs a change to which returns every ABSOLUTE override to the
 * derivation. John's ruling, 2026-09-25: the four unit counts, and any input
 * the derivation multiplies a quantity by.
 *
 * ── WHY THESE AND NOT OTHERS ────────────────────────────────────────────
 *
 * A price override is a FIGURE FOR A QUANTITY. Change the quantity and the
 * figure silently prices a different deal while its amber goes on claiming
 * somebody chose it. A MARGIN override is a RATIO, which survives the quantity
 * moving, so it is not in this list and does not clear.
 *
 *   the four counts          the quantity itself
 *   duration                 multiplies hosting months
 *   warrantyPct              multiplies the count to give warranty units
 *   inSsExisting, inSsNew,
 *   inAqm, inHemir           per-unit installation costs, multiplied by counts
 *
 * DELIBERATELY ABSENT, and reported rather than assumed: `lumpSumCost` is an
 * absolute the derivation does not multiply by anything, and `targetMargin`,
 * `whtPct`, `gstPct` and the currencies are ratios or are applied after the
 * quantity. Carried to John as the one judgement call in this list.
 */
export const FUNDAMENTAL_VALUE_IDS: readonly string[] = [
  'deal-ssExisting', 'deal-ssNew', 'deal-aqm', 'deal-hemir',
  'deal-duration', 'deal-warrantyPct',
  'deal-inSsExisting', 'deal-inSsNew', 'deal-inAqm', 'deal-inHemir',
]

export const MARGIN_KEYS = [
  'hwSs', 'hwAqm', 'hwHemir', 'hwWarranty', 'inSsEx', 'inSsNew',
  'inAqm', 'inHemir', 'inLump', 'hoSs', 'hoAqm', 'hoHemir',
] as const

export const COMMERCIALS_OWNED_KEYS = [
  'ssExisting', 'ssNew', 'aqm', 'hemir', 'installResp', 'lumpSumCost',
  'targetMargin', 'marginOverrides', 'inSsExisting', 'inSsNew', 'inAqm', 'inHemir',
  'warrantyPct', 'whtPct', 'gstPct', 'grossUp', 'bidCurrency', 'proposalCurrency',
  'fxContingency', 'duration', 'structure', 'recoveryMonths', 'invoicing',
  'milestones', 'contractorMilestones', 'factoring',
  // R-O7: the hosting price override. `hostingPriceMode` is 'margin' or
  // 'perUnit'; `hostingUnitFees` is the monthly fee for ONE unit of a type,
  // keyed by the same `hoSs`/`hoAqm`/`hoHemir` the calculator prices by.
  'hostingPriceMode', 'hostingUnitFees',
  // R-OX1 and R-OX4: the payment mode and the OPEX all-in per-unit overrides.
  // BOTH ALLOWLISTS, because there are two: this one and
  // SALESPERSON_WRITABLE_KEYS on the server, which is the drift the C2 round
  // found the hard way when the route refused a key this list already carried.
  'paymentMode', 'opexUnitFees', 'opexUnitMargins',
  // R-C2b: the either-or generalised. R-O7 gave hosting a price override;
  // this is the same act for the hardware and installation lines, keyed by
  // the calculator's own line keys. `hwWarranty` is absent by construction -
  // the allowed set lives in `PRICE_OVERRIDE_KEYS` in the calculator, so the
  // rule that the warranty reaches the customer at cost is enforced where the
  // pricing happens rather than remembered at each writer.
  'priceOverrides',
] as const

/** R-O7: the three hosting types, in the order the card lists them. */
export const HOSTING_FEE_KEYS = ['hoSs', 'hoAqm', 'hoHemir'] as const

/**
 * R-OX1: OPEX locks recovery to Single phase.
 *
 * ONE SOURCE, because the alternative is two. Setting `structure` on the click
 * alone left a record ALREADY in OPEX rendering `twoPhase`: the lock held for
 * the person who flipped the switch and not for the person who opened the deal
 * afterwards. Everything that reads the structure - the radios, the visibility,
 * the payload the record receives - reads it through here.
 */
export function effectiveStructure(ui: Pick<UiState, 'structure' | 'paymentMode'>): string {
  return ui.paymentMode === 'opex' ? 'single' : ui.structure
}

export const MILESTONE_ROWS = 5

export interface UiState {
  installResp: string
  structure: string
  invoicing: string
  grossUp: boolean
  factoringEnabled: boolean
  factoringMethod: string
  /**
   * R-O7: 'margin' or 'perUnit'. IN `UiState` BECAUSE IT IS A CONTROL THE
   * FORM HOLDS, and written to the payload by `readPayload` exactly as
   * `structure` and `invoicing` are. It is not a session-only latch: the mode
   * decides the price, so it has to survive a reload and reach an approver.
   */
  hostingPriceMode: string
  /**
   * R-OX1: 'capex' or 'opex'. In `UiState` for the same reason
   * `hostingPriceMode` is: it is a control the form holds, it decides the
   * price, and it has to survive a reload and reach an approver.
   *
   * CAPEX is the default and restores today's behaviour exactly, so a record
   * written before this round reads as CAPEX and prices as it always did.
   */
  paymentMode: string
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

/** R-N1: no `usd`. The dollars are derived from `pct` at every reader. */
export interface Milestone { month: number; label: string; pct: number | null }
export interface ContractorMilestone extends Milestone { incomplete: boolean }

// ── R-N1: THE PERCENTAGE IS WHAT IS RECORDED ─────────────────────────────
//
// Ruled by John 2026-09-21. A milestone is a percentage of the deal's one-off
// price and the dollars are derived at every reader, so the stored dollar
// figure is GONE FROM THE PAYLOAD rather than kept as a cache.
//
// REMOVED RATHER THAN CACHED, and the reason is this estate's own history.
// The defect was a second number that readers consulted; a cache is that same
// second number with a promise attached, and the promise is exactly what the
// comment at the grid cell used to make. A field no reader consults is also a
// field nothing can keep correct, and the next person to find it will read it.
// There is no longer a second number to read.
//
// MEASURED BEFORE REMOVING: zero live opportunities carry a customer
// milestone, and the six version rows that do are all drafts, so nothing in
// the estate depends on the stored figure today.
//
// A ROW COUNTS ON ITS MONTH AND ITS PERCENTAGE, the two things a person
// enters. It counted on `usd > 0` before, which is the derived figure, so a
// row was kept or dropped according to a number nobody typed.
export function readMilestones(values: Values): Milestone[] {
  const rows: Milestone[] = []
  for (let i = 0; i < MILESTONE_ROWS; i++) {
    const month = num(values, `deal-ms-${i}-month`)
    const label = values[`deal-ms-${i}-label`] ?? ''
    const pct = (toNumberOrNull(values[`deal-ms-${i}-pct`]) as number | null) ?? 0
    if (month > 0 && pct > 0) rows.push({ month, label, pct })
  }
  return rows
}

// ── THE CONTRACTOR READER, AND WHAT R-N1 CHANGED ABOUT IT ────────────────
//
// It read: "It counts a row on the AMOUNT alone, it does NOT default pct to
// 0, and it carries `incomplete` for a row with no month." The second and
// third still hold. THE FIRST DOES NOT, because the amount is no longer
// something a row carries.
//
// MEASURED: the contractor grid shares the defect in mirror image. With a
// lump sum of 200,000 a row typed at 50% stored 100,000; changing the lump
// sum to 400,000 left the row's own two figures saying 50% and $100,000,
// which against that base is 25% - and the total line read 25% while the
// input still read 50. One row, two answers.
//
// So it counts on the PERCENTAGE now, the same as the customer reader, and
// `incomplete` still fires for a row with money and no date - which is the
// row the schedule warning exists to surface and the reason a version cannot
// be taken from it.
export function readContractorMilestones(values: Values): ContractorMilestone[] {
  const rows: ContractorMilestone[] = []
  for (let i = 0; i < MILESTONE_ROWS; i++) {
    const month = num(values, `deal-cm-${i}-month`)
    const label = values[`deal-cm-${i}-label`] ?? ''
    const pct = toNumberOrNull(values[`deal-cm-${i}-pct`]) as number | null
    if ((pct ?? 0) > 0) rows.push({ month, label, pct, incomplete: !(month > 0) })
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

  // R-O7: THE SAME DELETION CONTRACT AS THE MARGIN BOXES. An absent fee drops
  // its key rather than writing a zero, because a cleared fee means the type
  // goes back to pricing from its margin and a zero means free hosting. Those
  // are two different decisions and the payload has to be able to hold both
  // (Architecture 11).
  // R-C2b: THE SAME DELETION CONTRACT AS THE MARGIN BOXES AND THE FEES. An
  // empty box DROPS the key, which is what returns the line to pricing from
  // its margin - the other half of the either-or. A zero would mean the line
  // is given away free, and the payload must be able to hold both.
  const priceOverrides: Record<string, number> = {}
  for (const key of PRICE_OVERRIDE_KEYS) {
    const v = numOrUndefined(values, `deal-price-${key}`)
    if (v !== undefined) priceOverrides[key] = v
  }

  const hostingUnitFees: Record<string, number> = {}
  for (const key of HOSTING_FEE_KEYS) {
    const v = numOrUndefined(values, `deal-hofee-${key}`)
    if (v !== undefined) hostingUnitFees[key] = v
  }

  // R-OX4: the same deletion contract as every other override family. An empty
  // box DROPS the key, which is what returns the row to the derivation, and a
  // zero means a fee of nothing rather than an absent one.
  const opexUnitFees: Record<string, number> = {}
  const opexUnitMargins: Record<string, number> = {}
  for (const key of OPEX_FEE_KEYS) {
    const f = numOrUndefined(values, `deal-opexfee-${key}`)
    if (f !== undefined) opexUnitFees[key] = f
    const m = numOrUndefined(values, `deal-opexmargin-${key}`)
    if (m !== undefined) opexUnitMargins[key] = m
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
    // R-OX1: through the one source, so the record cannot hold a structure the
    // screen is not showing.
    structure: effectiveStructure(ui),
    recoveryMonths: numOrNull(values, 'deal-recoveryMonths'),
    invoicing: ui.invoicing,
    hostingPriceMode: ui.hostingPriceMode,
    paymentMode: ui.paymentMode,
    opexUnitFees,
    opexUnitMargins,
    hostingUnitFees,
    priceOverrides,
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
  // R-C2b: hydrated from the same list the writer loops, so the read and the
  // write cannot disagree about the key set.
  const prices = (p.priceOverrides ?? {}) as Record<string, unknown>
  for (const k of PRICE_OVERRIDE_KEYS) out[`deal-price-${k}`] = str(prices[k])
  // R-O7: the fee boxes are seeded the same way, so a recorded fee comes back
  // on reload and a cleared one comes back EMPTY rather than as a zero.
  const opexFees = (p.opexUnitFees ?? {}) as Record<string, unknown>
  const opexMargins = (p.opexUnitMargins ?? {}) as Record<string, unknown>
  for (const k of OPEX_FEE_KEYS) {
    out[`deal-opexfee-${k}`] = str(opexFees[k])
    out[`deal-opexmargin-${k}`] = str(opexMargins[k])
  }
  const fees = (p.hostingUnitFees ?? {}) as Record<string, unknown>
  for (const k of HOSTING_FEE_KEYS) out[`deal-hofee-${k}`] = str(fees[k])

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
    // R-O7: absent means 'margin', which is how every deal priced before this
    // existed. That is an unrecorded state reading as the prior behaviour, not
    // a default written into a record nobody touched.
    hostingPriceMode: (p.hostingPriceMode as string) || 'margin',
    paymentMode: (p.paymentMode as string) || 'capex',
  }
}
