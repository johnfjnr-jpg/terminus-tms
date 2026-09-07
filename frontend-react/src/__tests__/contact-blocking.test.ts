// ── THE QUALIFY WORKFLOW'S blocking[] LIFECYCLE ──────────────────────────
//
// Round 6 Phase 1, derived from the Phase 0 enumeration and from the SERVER's
// rule, never from `frontend/contact-detail.js`.
//
// THE CALIBRATION CASE IS THE DEFECT ITSELF. C2: the gate names the Industry
// requirement `industry_id`, the vanilla's row carries `data-key="industry"`,
// and its renderer matches one against the other. 13 of 14 gated fields land
// and Industry does not, so a person blocked on it sees nothing.
import { describe, test, expect } from 'vitest'
import {
  clearResolved, forRecord, tintedRows, accountCardBlocked, unplaceable,
  type BlockingState,
} from '../contact/blocking'
import { contactDescriptors, gateKeyFor, GATED_NOT_A_ROW, CENSUS_FIELD_COUNT } from '../contact/descriptors'

const NAMES = contactDescriptors({ payload: {}, industryId: null, industries: [] })
  .map((f) => f.name)

/**
 * THE 14 FIELDS THAT GATE Qualified, read from the live `stage_gate_rules` at
 * Phase 0 and written down here because a unit test cannot reach the database.
 *
 * A HAND-COPIED LIST IS A SECOND READER (Verification 20), so its job is
 * narrow: it is the CALIBRATION POPULATION, and the agreement test that proves
 * it still matches the database lives in the database suite where the rows are.
 */
const GATED_AT_QUALIFY = [
  'name', 'parent_record_id', 'industry_id', 'email', 'mobile', 'jobRole',
  'address', 'city', 'postcode', 'country', 'region', 'linkedin', 'source', 'summary',
]

const state = (fields: string[], recordId = 'c-1'): BlockingState =>
  ({ recordId, blockers: fields.map((field) => ({ field })) })

describe('C2: every gated field reaches something on the screen', () => {
  test('all 14 gated fields are placeable - the 1 that was not is the reason this exists', () => {
    const missed = unplaceable(state(GATED_AT_QUALIFY), NAMES)
    expect(missed.map((b) => b.field),
      'a gated field tints nothing, which is what a person blocked on it sees').toEqual([])
  })

  test('and the mismatch is real: matching gate keys against ROW NAMES loses Industry', () => {
    // The vanilla's renderer, reproduced. This is the calibration: without it
    // the test above could pass because the mapping is trivially the identity.
    const naive = GATED_AT_QUALIFY.filter((f) => !NAMES.includes(f) && !GATED_NOT_A_ROW.has(f))
    expect(naive, 'the naive match now lands everything, so this test measures nothing')
      .toEqual(['industry_id'])
  })

  test('the 14 break down as 12 rows, 1 card, and 1 that needs its declaration', () => {
    // The Phase 0 report said "13 land, 1 does not", counting the Account card
    // among the 13. Stated exactly: TWELVE match a row by name,
    // parent_record_id is the card, and industry_id reaches its row only
    // through gateKeyFor. The arithmetic is asserted so the three groups
    // cannot drift into each other unnoticed.
    const byName = GATED_AT_QUALIFY.filter((f) => NAMES.includes(f))
    const asCard = GATED_AT_QUALIFY.filter((f) => GATED_NOT_A_ROW.has(f))
    const byDeclaration = GATED_AT_QUALIFY.filter(
      (f) => !NAMES.includes(f) && !GATED_NOT_A_ROW.has(f))
    expect(byName).toHaveLength(12)
    expect(asCard).toEqual(['parent_record_id'])
    expect(byDeclaration).toEqual(['industry_id'])
    expect(byName.length + asCard.length + byDeclaration.length).toBe(GATED_AT_QUALIFY.length)
    expect(gateKeyFor('industry')).toBe('industry_id')
  })

  test('parent_record_id is handled, and as the CARD rather than a row', () => {
    expect(accountCardBlocked(state(['parent_record_id']))).toBe(true)
    expect(tintedRows(state(['parent_record_id']), NAMES).size).toBe(0)
  })

  test('the census count is what the descriptors build', () => {
    expect(NAMES).toHaveLength(CENSUS_FIELD_COUNT)
  })
})

describe('the tint lands on the right row', () => {
  test('a blocked Industry tints the INDUSTRY row', () => {
    expect([...tintedRows(state(['industry_id']), NAMES)]).toEqual(['industry'])
  })

  test('a blocked ordinary field tints its own row', () => {
    expect([...tintedRows(state(['email']), NAMES)]).toEqual(['email'])
  })

  test('several at once tint several', () => {
    expect(tintedRows(state(['email', 'city', 'industry_id']), NAMES).size).toBe(3)
  })

  test('no blocking state tints nothing', () => {
    expect(tintedRows(null, NAMES).size).toBe(0)
    expect(accountCardBlocked(null)).toBe(false)
  })
})

describe('the lifecycle', () => {
  const rec = (o: Record<string, unknown> = {}) => ({ industry_id: null, parent_record_id: null, ...o })

  test('a resolved field DROPS, using the server rule for absence', () => {
    const s = state(['email', 'city'])
    const after = clearResolved(s, rec(), { email: 'a@b.c', city: '' })
    expect(after!.blockers.map((b) => b.field)).toEqual(['city'])
  })

  test('and the RECORD COLUMN is read from the record, not the payload', () => {
    // industry_id is a real column. Reading it from the payload would leave it
    // blocked for ever, because nothing ever writes it there.
    const s = state(['industry_id'])
    expect(clearResolved(s, rec({ industry_id: 'i-1' }), {})!.blockers).toEqual([])
    expect(clearResolved(s, rec(), { industry_id: 'i-1' })!.blockers).toHaveLength(1)
  })

  test('the server\'s emptiness rule is used, so `0` and `false` COUNT as present', () => {
    // Measured against the real evaluator in Round 11 Phase 0: false, 0, '0',
    // {} and [] all pass. A client copy that used truthiness would keep a field
    // blocked that the server considers satisfied, and the person could never
    // clear it.
    const s = state(['a', 'b', 'c'])
    const after = clearResolved(s, rec(), { a: 0, b: false, c: '' })
    expect(after!.blockers.map((x) => x.field)).toEqual(['c'])
  })

  test('an unchanged list is returned as the SAME object, so no render is forced', () => {
    const s = state(['city'])
    expect(clearResolved(s, rec(), { city: '' })).toBe(s)
  })

  test('a list belongs to its own record and no other', () => {
    const s = state(['email'], 'c-1')
    expect(forRecord(s, 'c-1')).toBe(s)
    expect(forRecord(s, 'c-2'), 'blocking state survived onto a different contact').toBeNull()
  })

  test('clearing is not a re-attempt: it never reports success, only fewer blockers', () => {
    // The vanilla's own reason, kept: re-attempting the transition would
    // qualify the contact as a side effect of saving a field.
    const s = state(['email'])
    const after = clearResolved(s, rec(), { email: 'a@b.c' })
    expect(after).not.toBeNull()
    expect(after!.blockers).toEqual([])
  })
})
