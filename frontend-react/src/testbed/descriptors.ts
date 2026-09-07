// ── THE TEST BED SURFACE'S FIELDS, FROM THE CENSUS ──────────────────────
//
// Round 7 Phase 1a. Built from the Phase 0 census and its live second
// instrument, not from the `TB_*` constants: those are `const` at the top level
// of a classic script, which is a LEXICAL name no bundle can read.
//
// ── THE 34-ROW RECONCILIATION, WHICH GOVERNS THIS FILE ──────────────────
//
//   34  elements carrying [data-key] in the live DOM
//   -1  #tb-chevron-popup, which is a shell popup and not a field row at all
//       (measured; it carries data-key with no value)
//   -3  buyer-<role> lookups, direct-write controls rather than batched rows
//   -1  installer, a search-and-set control
//   -1  techTeam, a direct-write control
//   = 28 plain field rows
//
//   30  declared in TB_ALL_EDITABLE_FIELDS
//   -2  estCostPerUnit and indicativeCost, server-computed and NEVER RENDERED
//   = 28
//
// The two halves meet at 28, which is what makes this a census rather than a
// list.
import type { FieldDescriptor, LookupOption } from '../field-row/types'

export interface TestBedSource {
  payload: Record<string, unknown>
  /** Terminus staff names, fetched by the surface: see below. */
  staff: string[]
}

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v))

export const REGION_OPTIONS = [
  'Americas', 'Europe & UK', 'Middle East', 'APAC', 'Africa',
] as const

export const SITE_OWNERSHIP_OPTIONS = [
  'Local Authority', 'Port Authority', 'National Highways',
  'Central Government', 'Private', 'Other',
] as const

export const INSTALLATION_ENVIRONMENT_OPTIONS = ['Indoor', 'Outdoor', 'Both'] as const

/**
 * ── THE TWO KEYS THAT ARE PAYLOAD KEYS AND NOT ROWS ─────────────────────
 *
 * `estCostPerUnit` and `indicativeCost` are declared in `TB_SITE_FIELDS` and
 * rendered NOWHERE. Round 5 Phase 6 made them server-computed and removed them
 * from `TEST_BED_WRITABLE_KEYS`, and the vanilla's own comment says rendering
 * them *"would put two editable fields on screen whose every save the server
 * rejects."*
 *
 * They stay in the array there because it is also the batched-save field list.
 * Here the two jobs are separated: `testBedDescriptors` is what RENDERS, and
 * this is what the save may carry. **A migration that treated the declaration
 * as the census would create two rows the server refuses**, which is precisely
 * why the accounting instrument runs before the census.
 */
export const PAYLOAD_ONLY_KEYS = ['estCostPerUnit', 'indicativeCost'] as const

/**
 * Controls that carry a `data-key` and are NOT batched field rows.
 *
 * Named so the reconciliation above is checkable rather than asserted: a row
 * that stops being one of these, or starts, fails the census test.
 */
export const NON_ROW_KEYS = ['installer', 'techTeam'] as const

/** The 28. */
export function testBedDescriptors(src: TestBedSource): FieldDescriptor[] {
  const p = src.payload
  const staff = [...src.staff]
  return [
    { name: 'name', label: 'Test Bed Name', value: str(p.name) },

    // ── TERMINUS DETAILS ─────────────────────────────────────────────────
    //
    // The four authority fields are selects over TERMINUS STAFF, which the
    // vanilla reads from `terminusStaffCache` - a module-scope `let` in app.js
    // that no bundle can reach. Round 5's ruling applies again: the surface
    // fetches its own, one fewer shell global rather than one more accessor.
    { name: 'terminusLead', label: 'Terminus Lead', value: str(p.terminusLead), options: staff },
    { name: 'commercialAuthority', label: 'Comm. Auth', value: str(p.commercialAuthority), options: staff },
    { name: 'technicalAuthority', label: 'Tech. Auth', value: str(p.technicalAuthority), options: staff },
    { name: 'terminusLegalOwner', label: 'Legal Auth', value: str(p.terminusLegalOwner), options: staff },
    { name: 'region', label: 'Region', value: str(p.region), options: [...REGION_OPTIONS] },
    { name: 'country', label: 'Country', value: str(p.country) },

    // ── CUSTOMER ─────────────────────────────────────────────────────────
    { name: 'initialLead', label: 'Client Lead', value: str(p.initialLead) },

    // ── SITE ─────────────────────────────────────────────────────────────
    { name: 'siteOwnership', label: 'Site Ownership', value: str(p.siteOwnership),
      options: [...SITE_OWNERSHIP_OPTIONS] },
    { name: 'installationEnvironment', label: 'Inst. Env.', value: str(p.installationEnvironment),
      options: [...INSTALLATION_ENVIRONMENT_OPTIONS] },
    { name: 'siteAddress', label: 'Site Address', value: str(p.siteAddress) },
    { name: 'city', label: 'City', value: str(p.city) },

    // ── SENSOR COUNTS ────────────────────────────────────────────────────
    { name: 'safesightCameras', label: 'No. of SafeSight Cameras',
      value: str(p.safesightCameras), inputMode: 'numeric' },
    { name: 'airQualitySensors', label: 'No. of Air Quality Sensors',
      value: str(p.airQualitySensors), inputMode: 'numeric' },
    { name: 'hemirSensors', label: 'No. of HEMIR Sensors',
      value: str(p.hemirSensors), inputMode: 'numeric' },

    // ── DATES ────────────────────────────────────────────────────────────
    //
    // A4: `min` is DESCRIPTOR DATA. The bounds are recomputed from the live
    // drafts by `dateBounds.ts` and handed back in here, because on this
    // surface a bound depends on another field's draft rather than on a
    // constant - which is the widening Phase 0 named as a question.
    { name: 'estimatedInstallationDate', label: 'Estimated Installation Date',
      value: str(p.estimatedInstallationDate), editor: 'date' },
    { name: 'estGoLiveDate', label: 'Est. Go Live',
      value: str(p.estGoLiveDate), editor: 'date' },
    { name: 'testBedDuration', label: 'Test Bed Duration',
      value: str(p.testBedDuration), inputMode: 'numeric', suffix: 'months' },

    // ── COSTS ────────────────────────────────────────────────────────────
    { name: 'ssUnitCost', label: 'SafeSight Unit Cost', value: str(p.ssUnitCost), inputMode: 'decimal' },
    { name: 'aqUnitCost', label: 'Air Quality Unit Cost', value: str(p.aqUnitCost), inputMode: 'decimal' },
    { name: 'hemirUnitCost', label: 'HEMIR Unit Cost', value: str(p.hemirUnitCost), inputMode: 'decimal' },
    { name: 'ssInstallCost', label: 'SafeSight Install Cost', value: str(p.ssInstallCost), inputMode: 'decimal' },
    { name: 'aqInstallCost', label: 'Air Quality Install Cost', value: str(p.aqInstallCost), inputMode: 'decimal' },
    { name: 'hemirInstallCost', label: 'HEMIR Install Cost', value: str(p.hemirInstallCost), inputMode: 'decimal' },
    { name: 'ssHostingCost', label: 'SafeSight Hosting Cost', value: str(p.ssHostingCost), inputMode: 'decimal' },
    { name: 'aqHostingCost', label: 'Air Quality Hosting Cost', value: str(p.aqHostingCost), inputMode: 'decimal' },
    { name: 'hemirHostingCost', label: 'HEMIR Hosting Cost', value: str(p.hemirHostingCost), inputMode: 'decimal' },

    // ── SUMMARY ──────────────────────────────────────────────────────────
    { name: 'summary', label: 'Summary', value: str(p.summary), editor: 'textarea',
      placeholder: 'No summary captured yet.' },
  ]
}

/** The census's own count, asserted rather than trusted. */
export const CENSUS_ROW_COUNT = 28

/** The three client buyer roles, as LOOKUPS over the Account's contacts. */
export const CLIENT_BUYER_ROLES = [
  'Client Commercial Buyer', 'Client Technical Buyer', 'Client Legal Buyer',
] as const

/**
 * A buyer row's descriptor. The value is a contact id and the label is a name,
 * which is exactly the lookup Round 6's A8-A11 built - so no new editor layer.
 */
export function buyerDescriptor(role: string, value: string, contacts: LookupOption[]): FieldDescriptor {
  return { name: `buyer-${role}`, label: role, value, options: contacts }
}
