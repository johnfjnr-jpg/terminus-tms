// R7. Derived from CONTACT_SURFACE_CONTRACT.md C2 - a lookup field shows the
// NAME and an id never reaches the screen - and from the measured cause: the
// picker can only show a name if it is given the record's value at all.
//
// The live defect this closes: `industry_id` is a COLUMN (17 of 17 rows carry
// it at the top level, none inside `payload`), the surface was handed the raw
// payload, so the Industry picker read `--` on every record forever.
import { describe, test, expect } from 'vitest'
import { fieldValuesFor, CONTACT_KEYS } from '../leads/leadFields'

describe('R7: the surface is given the record value for every key its fields name', () => {
  test('the industry COLUMN arrives under the key the fields use', () => {
    const v = fieldValuesFor({ payload: { name: 'Ada' }, industry_id: 'i-7' })
    expect(v.industry_id).toBe('i-7')
  })

  test('and the key it arrives under is one the fields actually name', () => {
    // Guards the seam Phase 0 measured: the leads fields call it `industry_id`
    // and the contact descriptors call it `industry`. A mapper writing the
    // other spelling would pass every test above and prefill nothing.
    expect(CONTACT_KEYS).toContain('industry_id')
  })

  test('payload keys survive untouched', () => {
    const v = fieldValuesFor({ payload: { name: 'Ada', city: 'KL' }, industry_id: 'i-7' })
    expect(v.name).toBe('Ada')
    expect(v.city).toBe('KL')
  })

  test('an unset industry is EMPTY STRING, not undefined', () => {
    // The picker compares against `str(current[k])`. `undefined` and `''` both
    // render the placeholder, but only `''` makes "unchanged" comparable, so
    // the distinction is asserted rather than left to chance.
    expect(fieldValuesFor({ payload: {} }).industry_id).toBe('')
    expect(fieldValuesFor({ payload: {}, industry_id: null }).industry_id).toBe('')
  })

  test('THE COLUMN WINS over a stale payload key of the same name', () => {
    // No live row carries `industry_id` inside its payload today. If one ever
    // does, the column is the record's truth and the gate reads the column.
    const v = fieldValuesFor({ payload: { industry_id: 'stale' }, industry_id: 'i-7' })
    expect(v.industry_id).toBe('i-7')
  })

  test('a record with no payload at all does not throw', () => {
    expect(fieldValuesFor({ industry_id: 'i-7' }).industry_id).toBe('i-7')
  })
})
