// ── ONE DEFINITION OF WHAT A LEAD IS MADE OF ─────────────────────────────
//
// R1 merged with R6, and John's reason is the reason: the seven fields R6
// adds to the New Lead grid are the SAME seven the Qualify completion popup
// needs, and "two implementations of the same fields is the drift this
// project keeps catching".
//
// So the FIELD SET lives here and the two surfaces render it differently:
//
//   the New Lead grid          every field, as columns in a table
//   the completion popup       only the fields the SERVER says are missing
//
// What is shared is the DEFINITION, not the layout. A field added here
// appears in both without either being edited, which is the same derivation
// that made `jobRole` reach the grid's markers with no grid edit.
//
// ── THE KEYS ARE THE SERVER'S KEYS ───────────────────────────────────────
//
// Every `key` below is what `POST /api/contacts` accepts and what
// `computeBlocking` names in its blocking list, so the popup can match the
// server's missing-field list against this set by key with no translation
// table in between. A translation table would be a second reader.
export type LeadFieldKind = 'text' | 'textarea' | 'industry' | 'source'

export type LeadField = {
  key: string
  label: string
  kind: LeadFieldKind
  /** Wider in the grid; these are the ones that hold real sentences. */
  wide?: boolean
}

/**
 * ALL FIFTEEN. The grid carried eight before R6; the seven added are
 * linkedin and the six address fields.
 *
 * `industry_id` is a REAL COLUMN on `records` rather than a payload key -
 * `RECORD_COLUMN_FIELDS` says so and the gate reads the row for it. It is in
 * this list because it is a field a person fills in; where it LANDS is the
 * route's business, not this file's.
 */
export const LEAD_FIELDS: LeadField[] = [
  { key: 'name', label: 'Name', kind: 'text', wide: true },
  { key: 'company', label: 'Company Name', kind: 'text', wide: true },
  { key: 'jobRole', label: 'Job Title', kind: 'text' },
  { key: 'industry_id', label: 'Industry', kind: 'industry' },
  { key: 'email', label: 'Email', kind: 'text', wide: true },
  { key: 'mobile', label: 'Mobile', kind: 'text' },
  { key: 'source', label: 'Lead Source', kind: 'source' },
  { key: 'linkedin', label: 'LinkedIn', kind: 'text' },
  { key: 'address', label: 'Address', kind: 'text', wide: true },
  { key: 'address2', label: 'Address 2', kind: 'text', wide: true },
  { key: 'city', label: 'City', kind: 'text' },
  { key: 'postcode', label: 'Postcode', kind: 'text' },
  { key: 'country', label: 'Country', kind: 'text' },
  { key: 'region', label: 'Region', kind: 'text' },
  { key: 'summary', label: 'Summary', kind: 'textarea', wide: true },
]

/** The six the address popup edits (R2), derived rather than retyped. */
export const ADDRESS_KEYS = ['address', 'address2', 'city', 'postcode', 'country', 'region']
export const ADDRESS_FIELDS = LEAD_FIELDS.filter((f) => ADDRESS_KEYS.includes(f.key))

/** Look one up by the key the server used. */
export const fieldFor = (key: string): LeadField | undefined =>
  LEAD_FIELDS.find((f) => f.key === key)
