// ── THE CONTACT SURFACE'S FIELDS, FROM THE CENSUS ────────────────────────
//
// Round 6 Phase 1. Built from the Phase 0 census and its live second
// instrument, not from `CD_ALL_FIELDS`: those constants are `const` at the top
// level of a classic script, which is a LEXICAL name no bundle can read. Round
// 2's rule - that is not a coupling to carry over, it is a coupling that was
// never possible.
//
// THE CENSUS: 15 fields in FOUR editor kinds - 11 text, 2 select, 1 lookup,
// 1 textarea. The fourth was found by the live instrument: `summary` is a
// TEXTAREA declared in static markup, which the source instrument cannot see
// and the Phase 0 report recorded as text by assuming the row renderer.
import type { FieldDescriptor, LookupOption } from '../field-row/types'

/** What the surface needs to build its rows. */
export interface ContactSource {
  payload: Record<string, unknown>
  /** `records.industry_id`, a real column rather than a payload key. */
  industryId: string | null
  industries: LookupOption[]
}

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v))

export const SOURCE_OPTIONS = [
  'Web', 'Email Inquiry', 'Referral', 'Direct Outreach', 'Marketing Campaign',
] as const

export const REGION_OPTIONS = [
  'Americas', 'Europe & UK', 'Middle East', 'APAC', 'Africa',
] as const

/**
 * THE GATE KEY A ROW ANSWERS TO, where it differs from the field name.
 *
 * ── C2, AND IT IS THE DEFECT THIS DECLARATION EXISTS TO STOP ─────────────
 *
 * `stage_gate_rules` names the Industry requirement `industry_id`, because that
 * is the column. The vanilla's row carries `data-key="industry"` and its tint
 * renderer does `querySelector('[data-key="${b.field}"]')`, so the selector
 * asks for `[data-key="industry_id"]` and NOTHING MATCHES. Measured across all
 * 14 fields that gate Qualified: 13 land and this one does not.
 *
 * A person blocked on Industry is told the transition failed and shown nothing.
 *
 * The mapping is DECLARED here rather than derived by stripping `_id`, because
 * a rule that strips a suffix is a guess about names the database chooses.
 */
const GATE_KEY: Record<string, string> = {
  industry: 'industry_id',
}

/** The gate key a field answers to. Its own name unless declared otherwise. */
export const gateKeyFor = (name: string): string => GATE_KEY[name] ?? name

/**
 * `parent_record_id` is gated and is NOT a row: it is the Account card, which
 * the vanilla tints separately and correctly. Named here so the reconciliation
 * test can tell "handled elsewhere" from "missed".
 */
export const GATED_NOT_A_ROW = new Set(['parent_record_id'])

export function contactDescriptors(src: ContactSource): FieldDescriptor[] {
  const p = src.payload
  return [
    // `name` and `summary` are ordinary rows here. In the vanilla they are
    // static markup populated by id, which is what hid summary's kind from the
    // source census. Nothing in the census made them special; only the markup
    // did, and the same was true of the Reference tab.
    { name: 'name', label: 'Name', value: str(p.name) },

    { name: 'company', label: 'Company', value: str(p.company) },
    { name: 'jobRole', label: 'Job Role', value: str(p.jobRole) },
    { name: 'email', label: 'Email', value: str(p.email), inputMode: 'email' },
    { name: 'mobile', label: 'Mobile', value: str(p.mobile), inputMode: 'tel' },
    { name: 'linkedin', label: 'LinkedIn', value: str(p.linkedin), inputMode: 'url' },

    // THE LOOKUP. A8: the value is the id and the label is the name, and the
    // display half resolves through this same list rather than a second one.
    {
      name: 'industry', label: 'Industry',
      value: str(src.industryId), options: src.industries,
    },

    { name: 'source', label: 'Source', value: str(p.source), options: [...SOURCE_OPTIONS] },

    { name: 'address', label: 'Address Line 1', value: str(p.address) },
    { name: 'address2', label: 'Address Line 2', value: str(p.address2) },
    { name: 'city', label: 'City', value: str(p.city) },
    { name: 'postcode', label: 'Postcode / Zip', value: str(p.postcode) },
    { name: 'country', label: 'Country', value: str(p.country) },
    { name: 'region', label: 'Region', value: str(p.region), options: [...REGION_OPTIONS] },

    { name: 'summary', label: 'Summary', value: str(p.summary), editor: 'textarea',
      placeholder: 'No summary captured yet.' },
  ]
}

/** The census's own count, asserted rather than trusted. */
export const CENSUS_FIELD_COUNT = 15
