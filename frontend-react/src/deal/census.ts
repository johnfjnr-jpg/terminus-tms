import { MARGIN_KEYS, MILESTONE_ROWS } from './payload'

// ── THE CENSUS, AS DATA ──────────────────────────────────────────────────
//
// From MIGRATION_ROUND_3_PHASE_0_REPORT.md item 3, measured rather than
// transcribed. Each entry carries the EMPTY-STATE CONTRACT its key is read
// under, because that is the fact the render must not normalise: an input does
// not decide what its empty value means, its reader does, and the census is
// where the two are held together so a new input cannot be added without
// stating which contract it joins.
export type Contract = 'numOrNull' | 'emptyToNull' | 'num' | 'numOrUndefined'

export interface CensusInput {
  id: string
  label: string
  contract: Contract
  section: string
  /** A catalog rate is DISPLAYED here, never recorded: the box is a readout. */
  readOnlyRate?: boolean
  placeholderFromCatalog?: string
}

export const DEAL_SECTIONS = [
  'units', 'structural', 'installation', 'risk', 'payment',
] as const

// ── THE LABELS ARE THE SCREEN'S OWN WORDS ────────────────────────────────
//
// Nine of these were written for the migration rather than taken from the
// vanilla, so the swapped screen quietly renamed nine fields: "Air Quality
// units" for "AQ Sensor", "FX contingency %" for "% Currency Contingency",
// "Recovery months" for "Recovery period (months)". Nothing failed - a label is
// not asserted anywhere - and the comparison against the vanilla is what found
// them. A display rename is a decision, and this round was not making one.
export const CENSUS: CensusInput[] = [
  { id: 'deal-ssExisting', label: 'SafeSight, existing infra', contract: 'numOrNull', section: 'units' },
  { id: 'deal-ssNew', label: 'SafeSight, new infra', contract: 'numOrNull', section: 'units' },
  { id: 'deal-aqm', label: 'AQ Sensor', contract: 'numOrNull', section: 'units' },
  { id: 'deal-hemir', label: 'HEMIR', contract: 'numOrNull', section: 'units' },

  { id: 'deal-duration', label: 'Contract duration (months)', contract: 'numOrNull', section: 'structural' },
  { id: 'deal-recoveryMonths', label: 'Recovery period (months)', contract: 'numOrNull', section: 'structural' },
  { id: 'deal-targetMargin', label: 'Target margin %', contract: 'numOrNull', section: 'structural' },

  { id: 'deal-lumpCost', label: 'Lump sum cost', contract: 'numOrNull', section: 'installation' },
  { id: 'deal-inSsExisting', label: 'SafeSight install, existing', contract: 'numOrNull', section: 'installation', placeholderFromCatalog: 'inSsExisting' },
  { id: 'deal-inSsNew', label: 'SafeSight install, new', contract: 'numOrNull', section: 'installation', placeholderFromCatalog: 'inSsNew' },
  { id: 'deal-inAqm', label: 'Air Quality install', contract: 'numOrNull', section: 'installation', placeholderFromCatalog: 'inAqm' },
  { id: 'deal-inHemir', label: 'HEMIR install', contract: 'numOrNull', section: 'installation', placeholderFromCatalog: 'inHemir' },

  { id: 'deal-warrantyPct', label: 'Warranty %', contract: 'numOrNull', section: 'risk' },
  { id: 'deal-whtPct', label: 'Withholding Tax %', contract: 'numOrNull', section: 'risk' },
  { id: 'deal-gstPct', label: 'GST %', contract: 'numOrNull', section: 'risk' },
  { id: 'deal-fxContingency', label: '% Currency Contingency', contract: 'numOrNull', section: 'risk' },
  { id: 'deal-bidCurrency', label: 'Bid Currency', contract: 'emptyToNull', section: 'risk' },
  { id: 'deal-proposalCurrency', label: 'Proposal Currency', contract: 'emptyToNull', section: 'risk' },

  // `num`: an empty box is a VALUE, zero. Not "not recorded".
  { id: 'deal-factoring-ratePct', label: 'Factoring rate %', contract: 'num', section: 'payment' },
  { id: 'deal-factoring-termMonths', label: 'Factoring term (months)', contract: 'num', section: 'payment' },

  // `numOrUndefined`: an empty box DROPS THE KEY, which the record reads as
  // deletion of that override. Eleven of them, and breaking this contract fails
  // 49 of the 97 parity tests - more than the other three combined.
  ...MARGIN_KEYS.map((k): CensusInput => ({
    id: `deal-margin-${k}`, label: `Margin override, ${k}`, contract: 'numOrUndefined', section: 'structural',
  })),
]

/** The seven catalog rates the panel DISPLAYS and never records. */
export const CATALOG_DISPLAYS = [
  { id: 'deal-ssUnitCost', label: 'SafeSight unit cost', rate: 'ssUnitCost' },
  { id: 'deal-aqUnitCost', label: 'Air Quality unit cost', rate: 'aqUnitCost' },
  { id: 'deal-hemirUnitCost', label: 'HEMIR unit cost', rate: 'hemirUnitCost' },
  { id: 'deal-hoSafesight', label: 'SafeSight hosting, per month', rate: 'hoSafesight' },
  { id: 'deal-hoAqm', label: 'Air Quality hosting, per month', rate: 'hoAqm' },
  { id: 'deal-hoHemir', label: 'HEMIR hosting, per month', rate: 'hoHemir' },
] as const

export const MILESTONE_INPUTS = Array.from({ length: MILESTONE_ROWS }, (_, i) => ({
  row: i,
  month: `deal-ms-${i}-month`, label: `deal-ms-${i}-label`,
  usd: `deal-ms-${i}-usd`, pct: `deal-ms-${i}-pct`,
}))
export const CONTRACTOR_INPUTS = Array.from({ length: MILESTONE_ROWS }, (_, i) => ({
  row: i,
  month: `deal-cm-${i}-month`, label: `deal-cm-${i}-label`,
  usd: `deal-cm-${i}-usd`, pct: `deal-cm-${i}-pct`,
}))

/** Every id the form renders a control for. The corpus's own denominator. */
export const ALL_INPUT_IDS = [
  ...CENSUS.map((c) => c.id),
  ...MILESTONE_INPUTS.flatMap((m) => [m.month, m.label, m.usd, m.pct]),
  ...CONTRACTOR_INPUTS.flatMap((m) => [m.month, m.label, m.usd, m.pct]),
]
