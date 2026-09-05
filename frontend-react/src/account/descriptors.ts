import type { FieldDescriptor } from '../field-row'

// ── THE ACCOUNT SURFACE'S FIELDS ─────────────────────────────────────────
//
// From the Phase 0 enumeration, measured against the rendered surface rather
// than transcribed from the vanilla arrays.
//
// NO inputMode ON ANY OF THEM, and that is a measurement, not an omission.
// src/lib/field-validation.js exports nine TYPE validators, contains no object
// keyed by field name, and is imported by contacts.js, test-beds.js and
// opportunities.js - NOT by accounts.js. The only validation on the Account
// route is validateParentAccountId, a referential check on the link.
//
// websiteUrl is plain text on both sides today. Declaring `inputMode: 'url'`
// would be a NEW constraint rather than a port, so it is left alone and named
// in the Phase 0 report.
export const ACCT_REGION_OPTIONS = ['Americas', 'Europe & UK', 'Middle East', 'APAC', 'Africa']

const ADDRESS_SUFFIXES: { suffix: string; label: string; options?: string[] }[] = [
  { suffix: 'Address', label: 'Address Line 1' },
  { suffix: 'Address2', label: 'Address Line 2' },
  { suffix: 'City', label: 'City' },
  { suffix: 'Postcode', label: 'Postcode / Zip' },
  { suffix: 'Country', label: 'Country' },
  { suffix: 'Region', label: 'Region', options: ACCT_REGION_OPTIONS },
]

export const ACCT_NAME_KEY = 'name'

/** The 14 click-to-edit rows, in render order. The name header is NOT here. */
export function accountFieldDescriptors(
  payload: Record<string, unknown>,
  staffNames: string[],
): { detail: FieldDescriptor[]; billing: FieldDescriptor[]; shipping: FieldDescriptor[] } {
  const val = (k: string) => String(payload[k] ?? '')
  return {
    detail: [
      // The staff picker the contract named as out of scope for the ROW and
      // which the editor slot now carries as data.
      { name: 'terminusLead', label: 'Terminus Lead', value: val('terminusLead'), options: staffNames },
      { name: 'websiteUrl', label: 'Website URL', value: val('websiteUrl') },
    ],
    billing: ADDRESS_SUFFIXES.map((f) => ({
      name: `billing${f.suffix}`, label: f.label, value: val(`billing${f.suffix}`), options: f.options,
    })),
    shipping: ADDRESS_SUFFIXES.map((f) => ({
      name: `shipping${f.suffix}`, label: f.label, value: val(`shipping${f.suffix}`), options: f.options,
    })),
  }
}

/** Every editable key including the name, which shares the surface draft store. */
export function accountEditableKeys(): string[] {
  return [ACCT_NAME_KEY, 'terminusLead', 'websiteUrl',
    ...ADDRESS_SUFFIXES.map((f) => `billing${f.suffix}`),
    ...ADDRESS_SUFFIXES.map((f) => `shipping${f.suffix}`)]
}
