// ── ROUND 5 PHASE 1 ITEM 2: THE REFERENCE TAB'S DESCRIPTORS ─────────────
//
// FROM THE CENSUS, not from the vanilla's constants. `scripts/round5/
// field-census.mjs` read these off an initialised, exercised record and a
// second instrument agreed exactly: 21 keys in source, 21 rows rendered, none
// in either direction alone.
//
// The vanilla's own constants are `const` at module scope in a classic script,
// so a bundle cannot read them at all (Phase 0 item 1's declaration table).
// That makes this a redesign rather than an accessor, which is what Round 2
// did for `terminusStaffCache`.
import type { FieldDescriptor } from '../field-row/types'

export const REGION_OPTIONS = ['Americas', 'Europe & UK', 'Middle East', 'APAC', 'Africa']
export const OPP_TYPE_OPTIONS = ['Terminus Led', 'Tender']

/** A7: the flag is a DIRECT INPUT on the surface, not one of the 21 rows. */
export const SAME_AS_ACCOUNT = 'commAddressSameAsAccount'

/**
 * The account's shipping keys, in the order the six proposal-address rows
 * display them. Item 5's B5: when the flag is on, the read-only rows render
 * the ACCOUNT's values live. Nothing is copied into the opportunity payload,
 * so an account address change is reflected without a re-save.
 */
export const ACCOUNT_SHIPPING_KEYS = [
  'shippingAddress', 'shippingAddress2', 'shippingCity',
  'shippingPostcode', 'shippingCountry', 'shippingRegion',
] as const

export interface ReferenceSource {
  payload: Record<string, unknown>
  /** `opportunity_details`. `estClose` reads from here, not from the payload. */
  details: Record<string, unknown>
  account: (Record<string, unknown> & { id?: string, name?: string }) | null
  /** Staff names for the four staff pickers, from the shell's own cache. */
  staff: string[]
  reference: string | null
  status: string | null
  createdAt: string | null
}

const str = (v: unknown): string => (v == null ? '' : String(v))

/**
 * A stored timestamp is not a date a person reads. The vanilla runs
 * `formatDate(opp.created_at)` here; rendering the raw column gave
 * "2026-09-06T14:12:05.80658+00:00" on the Date Created row, which the
 * capture showed and no assertion could.
 */
export const asDate = (v: unknown): string => {
  const s = str(v)
  if (!s) return ''
  const t = Date.parse(s)
  // The shell's own format, so the two surfaces read the same while both
  // exist: app.js formatDate uses en-GB day / short month / 2-digit year.
  return Number.isNaN(t)
    ? s
    : new Date(t).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
}

/** Today, as the native `min` for a field that declares no past. A4. */
export const todayIso = (now: Date): string => now.toISOString().slice(0, 10)

/**
 * The 21 click-to-edit rows, in render order, per section.
 *
 * `sameAsAccount` decides the shape: with it ON the six proposal-address rows
 * become read-only and render the account's values (census: 15 editable and 11
 * read-only, against 21 and 5 with it off).
 */
export function referenceFields(
  src: ReferenceSource, sameAsAccount: boolean, now: Date,
): FieldDescriptor[] {
  const p = src.payload
  const staffField = (name: string, label: string): FieldDescriptor =>
    ({ name, label, value: str(p[name]), options: src.staff })

  const addressRow = (name: string, label: string, i: number): FieldDescriptor =>
    sameAsAccount
      // B5: the ACCOUNT's value, live, and read-only. Not copied.
      ? { name, label, value: str(src.account?.[ACCOUNT_SHIPPING_KEYS[i]]), readOnly: true }
      : { name, label, value: str(p[name]),
          ...(name === 'commRegion' ? { options: REGION_OPTIONS } : {}) }

  return [
    // The header. Rendered by its own markup in the vanilla; a row here.
    { name: 'name', label: 'Opportunity Name', value: str(p.name) },

    // ref-terminus-rows
    staffField('lead', 'Opportunity owner'),
    staffField('commercial', 'Comm. Auth'),
    staffField('technical', 'Tech. Auth'),
    staffField('legal', 'Legal Auth'),
    { name: 'region', label: 'Region', value: str(p.region), options: REGION_OPTIONS },
    { name: 'country', label: 'Country', value: str(p.country) },

    // ref-customer-rows
    { name: 'customerLead', label: 'Client Lead', value: str(p.customerLead) },
    addressRow('commAddress', 'Address Line 1', 0),
    addressRow('commAddress2', 'Address Line 2', 1),
    addressRow('commCity', 'City', 2),
    addressRow('commPostcode', 'Postcode / Zip', 3),
    addressRow('commCountry', 'Country', 4),
    addressRow('commRegion', 'Region', 5),

    // ref-dates-rows. A4: `min` is declared here, so every field that wants
    // the constraint gets it - Phase 0 finding 1 fixed by construction.
    { name: 'estClose', label: 'Est. Close Date', editor: 'date',
      // NOT a payload key (A5): opportunity_details.forecast_close_date.
      value: str(src.details.forecast_close_date), min: todayIso(now) },
    { name: 'actualClose', label: 'Actual Close Date', editor: 'date', value: str(p.actualClose) },
    { name: 'estGoLive', label: 'Est. Go Live', editor: 'date',
      value: str(p.estGoLive), min: todayIso(now) },
    { name: 'actualGoLive', label: 'Actual Go Live', editor: 'date', value: str(p.actualGoLive) },
    { name: 'duration', label: 'Contract Duration (months)',
      value: str(p.duration), inputMode: 'numeric', suffix: 'months' },

    // ref-opptype-row and the summary
    { name: 'oppType', label: 'Opportunity Type', value: str(p.oppType), options: OPP_TYPE_OPTIONS },
    { name: 'summary', label: 'Executive Summary', editor: 'textarea',
      value: str(p.summary), rows: 3, placeholder: 'No summary captured yet.' },
  ]
}

/**
 * The five read-only rows, which are NOT `FieldRow`s with `readOnly` set on a
 * field the surface owns - they are values from elsewhere on the record.
 *
 * Behaviour 7, and the 2026-09-06 addendum's ruling on it: no opener and NO
 * TAB STOP. The vanilla's five carry `tabindex="0"` because `app.js`'s
 * ownership sweep lists `.ref-field-display` with no `:not(.readonly)`; that
 * is a side effect of a selector written about editable rows, and the contract
 * is what this follows.
 */
export function referenceReadOnly(src: ReferenceSource, closeMoves: unknown): FieldDescriptor[] {
  return [
    { name: 'ro-reference', label: 'Terminus Reference', value: str(src.reference), readOnly: true },
    { name: 'ro-stage', label: 'Stage', value: str(src.status), readOnly: true },
    { name: 'ro-account', label: 'Account', value: src.account?.name || 'Not linked', readOnly: true },
    { name: 'ro-created', label: 'Date Created', value: asDate(src.createdAt), readOnly: true },
    { name: 'ro-moves', label: 'Est. Close Date Moves', value: str(closeMoves ?? 0), readOnly: true },
  ]
}

/** Does the linked account have a shipping address to stand in for? B6. */
export function accountHasShipping(account: ReferenceSource['account']): boolean {
  return ACCOUNT_SHIPPING_KEYS.some((k) => String(account?.[k] ?? '').trim() !== '')
}
