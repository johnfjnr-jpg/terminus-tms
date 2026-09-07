// ── THE CENSUS, AS A TEST ────────────────────────────────────────────────
//
// The 34-row reconciliation governs this surface, so it is asserted rather
// than described. Round 6's lesson was that a field census can pass while two
// fifths of a surface is missing; this one at least cannot drift from the
// numbers Phase 0 measured.
import { describe, test, expect } from 'vitest'
import {
  testBedDescriptors, CENSUS_ROW_COUNT, PAYLOAD_ONLY_KEYS, NON_ROW_KEYS,
  CLIENT_BUYER_ROLES, buyerDescriptor, REGION_OPTIONS, SITE_OWNERSHIP_OPTIONS,
} from '../testbed/descriptors'
import { dateBounds, todayIso } from '../testbed/dateBounds'

const SRC = { payload: {}, staff: ['Brad Kerr', 'Ada Poh'] }
const rows = () => testBedDescriptors(SRC)

describe('the 34-row reconciliation', () => {
  test('28 plain field rows, which is the count both halves meet at', () => {
    expect(rows()).toHaveLength(CENSUS_ROW_COUNT)
    expect(CENSUS_ROW_COUNT).toBe(28)
  })

  test('the arithmetic: 34 DOM elements less the popup, three buyers and two controls', () => {
    // 34 - 1 (#tb-chevron-popup, a shell popup carrying a blank data-key)
    //    - 3 (buyer lookups) - 2 (installer, techTeam) = 28
    expect(34 - 1 - CLIENT_BUYER_ROLES.length - NON_ROW_KEYS.length).toBe(CENSUS_ROW_COUNT)
  })

  test('and the other half: 30 declared less the two that never render', () => {
    expect(30 - PAYLOAD_ONLY_KEYS.length).toBe(CENSUS_ROW_COUNT)
  })

  test('THE TWO SERVER-COMPUTED KEYS ARE NOT ROWS', () => {
    // Rendering them would put two editable fields on screen whose every save
    // the server rejects - the vanilla's own words.
    const names = rows().map((r) => r.name)
    for (const k of PAYLOAD_ONLY_KEYS) expect(names, `${k} is a row`).not.toContain(k)
  })

  test('and neither are the direct-write controls', () => {
    const names = rows().map((r) => r.name)
    for (const k of NON_ROW_KEYS) expect(names).not.toContain(k)
  })

  test('every row has a label and a string value', () => {
    for (const r of rows()) {
      expect(r.label, r.name).toBeTruthy()
      expect(typeof r.value, r.name).toBe('string')
    }
  })
})

describe('the editor kinds, four and no more', () => {
  const kindOf = (r: { options?: unknown, editor?: string }) =>
    r.editor ?? (r.options ? 'select' : 'text')

  test('text, select, date and textarea - the proven layers', () => {
    const kinds = new Set(rows().map(kindOf))
    expect([...kinds].sort()).toEqual(['date', 'select', 'text', 'textarea'])
  })

  test('the four authority fields are selects over TERMINUS STAFF', () => {
    // terminusStaffCache is a module-scope `let` no bundle can read, so the
    // surface fetches its own - Round 5's ruling, applied again.
    for (const n of ['terminusLead', 'commercialAuthority', 'technicalAuthority', 'terminusLegalOwner']) {
      const r = rows().find((x) => x.name === n)!
      expect(r.options, n).toEqual(SRC.staff)
    }
  })

  test('region and site ownership carry their own fixed lists', () => {
    expect(rows().find((r) => r.name === 'region')!.options).toEqual([...REGION_OPTIONS])
    expect(rows().find((r) => r.name === 'siteOwnership')!.options).toEqual([...SITE_OWNERSHIP_OPTIONS])
  })

  test('the duration carries its suffix, DISPLAY ONLY', () => {
    // A3: a suffix that reached the value would make draft !== orig wrong on
    // the first save.
    const r = rows().find((x) => x.name === 'testBedDuration')!
    expect(r.suffix).toBe('months')
    expect(r.value).not.toContain('months')
  })
})

describe('the buyer rows are LOOKUPS, so no new editor layer', () => {
  const CONTACTS = [{ id: 'c-1', name: 'Ada Poh' }, { id: 'c-2', name: 'Bo Tan' }]

  test('three roles, id-valued and name-labelled', () => {
    expect(CLIENT_BUYER_ROLES).toHaveLength(3)
    const d = buyerDescriptor(CLIENT_BUYER_ROLES[0], 'c-2', CONTACTS)
    expect(d.name).toBe('buyer-Client Commercial Buyer')
    expect(d.value).toBe('c-2')
    expect(d.options).toEqual(CONTACTS)
  })

  test('the role strings are the REAL values, not labels', () => {
    // They are written to record_contacts and named by three live
    // contact_role_linked gate rules. Renaming any would break those gates.
    expect([...CLIENT_BUYER_ROLES]).toEqual([
      'Client Commercial Buyer', 'Client Technical Buyer', 'Client Legal Buyer'])
  })
})

describe('the inter-date bounds', () => {
  const TODAY = '2026-09-07'

  test('the install date is never in the past', () => {
    expect(dateBounds('', '', TODAY).estimatedInstallationDate.min).toBe(TODAY)
  })

  test('and never after a SET go-live date', () => {
    expect(dateBounds('', '2027-01-31', TODAY).estimatedInstallationDate.max).toBe('2027-01-31')
  })

  test('an UNSET go-live imposes no ceiling at all', () => {
    // An empty string as `max` is a bound nobody can satisfy.
    expect(dateBounds('', '', TODAY).estimatedInstallationDate).not.toHaveProperty('max')
  })

  test('the go-live floor is the install date when that is in the future', () => {
    expect(dateBounds('2027-01-31', '', TODAY).estGoLiveDate.min).toBe('2027-01-31')
  })

  test('and today when the install date is in the past', () => {
    expect(dateBounds('2020-01-01', '', TODAY).estGoLiveDate.min).toBe(TODAY)
  })

  test('the bounds follow the DRAFT, which is why they are derived not stored', () => {
    const a = dateBounds('2027-01-31', '', TODAY).estGoLiveDate.min
    const b = dateBounds('2028-06-30', '', TODAY).estGoLiveDate.min
    expect(a).not.toBe(b)
  })

  test('todayIso is injectable, so a test is not a hostage to the clock', () => {
    expect(todayIso(new Date('2026-09-07T23:59:59Z'))).toBe('2026-09-07')
  })
})
