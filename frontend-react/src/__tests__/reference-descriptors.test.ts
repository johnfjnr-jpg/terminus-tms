// ── ROUND 5 PHASE 1 ITEM 2: THE DESCRIPTORS, AGAINST THE CENSUS ─────────
//
// The census is the oracle, not the vanilla source. Numbers here are the ones
// scripts/round5/field-census.mjs measured on an initialised, exercised
// record, with a second instrument agreeing exactly.
import { describe, test, expect } from 'vitest'
import {
  referenceFields, referenceReadOnly, accountHasShipping,
  REGION_OPTIONS, OPP_TYPE_OPTIONS, SAME_AS_ACCOUNT, todayIso,
} from '../reference/descriptors'
import type { ReferenceSource } from '../reference/descriptors'

const NOW = new Date('2026-09-06T00:00:00.000Z')

const src = (o: Partial<ReferenceSource> = {}): ReferenceSource => ({
  payload: { name: 'Changi T5', country: 'Singapore', duration: '36', ...o.payload },
  details: { forecast_close_date: '2026-11-30', ...o.details },
  account: o.account === undefined ? { id: 'a1', name: 'Changi Airport Group' } : o.account,
  staff: o.staff ?? ['Brad Kerr', 'John Fryatt', 'Neil Baynham'],
  reference: o.reference ?? 'TT-SGP-AIRPRT-2610',
  status: o.status ?? 'Qualification',
  createdAt: o.createdAt ?? '2026-03-04',
})

describe('C: the census counts, both branches', () => {
  test('C1 same-as-account OFF renders 21 editable rows', () => {
    const f = referenceFields(src(), false, NOW)
    expect(f, 'the census counted 21').toHaveLength(21)
    expect(f.filter((x) => x.readOnly), 'none of the 21 is read-only with the flag off')
      .toHaveLength(0)
  })

  test('C2 same-as-account ON: 15 editable and 6 of them turn read-only', () => {
    const f = referenceFields(src(), true, NOW)
    expect(f, 'the row COUNT does not change; six of them change shape').toHaveLength(21)
    expect(f.filter((x) => x.readOnly), 'the six proposal-address rows must go read-only')
      .toHaveLength(6)
    expect(f.filter((x) => !x.readOnly), 'leaving 15 editable, per the census').toHaveLength(15)
  })

  test('C3 and the five read-only rows are separate from the 21', () => {
    expect(referenceReadOnly(src(), 0)).toHaveLength(5)
    expect(referenceReadOnly(src(), 0).map((r) => r.label)).toEqual([
      'Terminus Reference', 'Stage', 'Account', 'Date Created', 'Est. Close Date Moves'])
  })

  test('C4 21 + 5 off, 15 + 11 on: the addendum\'s table, computed', () => {
    const off = referenceFields(src(), false, NOW)
    const on = referenceFields(src(), true, NOW)
    const ro = referenceReadOnly(src(), 0)
    expect([off.filter((f) => !f.readOnly).length, ro.length]).toEqual([21, 5])
    expect([on.filter((f) => !f.readOnly).length,
      ro.length + on.filter((f) => f.readOnly).length]).toEqual([15, 11])
  })
})

describe('E: the editor kinds the census measured', () => {
  const kinds = (f: ReturnType<typeof referenceFields>) => {
    const out: Record<string, number> = {}
    for (const x of f) {
      const k = x.editor ?? (x.options ? 'select' : 'text')
      out[k] = (out[k] ?? 0) + 1
    }
    return out
  }
  test('E1 8 text, 7 select, 4 date, 1 textarea, and duration is numeric text', () => {
    const k = kinds(referenceFields(src(), false, NOW))
    expect(k).toEqual({ text: 9, select: 7, date: 4, textarea: 1 })
    // The census reported "8 text + 1 numeric-text": duration is a text editor
    // that declares inputMode, which is exactly the Round 1 keying.
    const dur = referenceFields(src(), false, NOW).find((f) => f.name === 'duration')!
    expect(dur.inputMode).toBe('numeric')
    expect(dur.editor, 'duration is a TEXT editor with a declared inputMode').toBeUndefined()
  })

  test('E2 the four staff pickers offer the shell\'s staff names', () => {
    const f = referenceFields(src(), false, NOW)
    for (const n of ['lead', 'commercial', 'technical', 'legal']) {
      expect(f.find((x) => x.name === n)!.options, `${n} lost its staff options`)
        .toEqual(['Brad Kerr', 'John Fryatt', 'Neil Baynham'])
    }
  })

  test('E3 the two region rows and oppType carry their fixed options', () => {
    const f = referenceFields(src(), false, NOW)
    expect(f.find((x) => x.name === 'region')!.options).toEqual(REGION_OPTIONS)
    expect(f.find((x) => x.name === 'commRegion')!.options).toEqual(REGION_OPTIONS)
    expect(f.find((x) => x.name === 'oppType')!.options).toEqual(OPP_TYPE_OPTIONS)
  })
})

describe('M: A4, `min` reaches every field that declares it', () => {
  test('M1 BOTH no-past dates carry min, which is Phase 0 finding 1 inverted', () => {
    const f = referenceFields(src(), false, NOW)
    expect(f.find((x) => x.name === 'estClose')!.min).toBe('2026-09-06')
    expect(f.find((x) => x.name === 'estGoLive')!.min,
      'estGoLive lost its min again - the vanilla defect has been reproduced')
      .toBe('2026-09-06')
  })

  test('M2 and the two actual dates carry none, because a past actual is normal', () => {
    const f = referenceFields(src(), false, NOW)
    expect(f.find((x) => x.name === 'actualClose')!.min).toBeUndefined()
    expect(f.find((x) => x.name === 'actualGoLive')!.min).toBeUndefined()
  })

  test('M3 todayIso is the date only', () => {
    expect(todayIso(new Date('2026-09-06T23:59:59.000Z'))).toBe('2026-09-06')
  })
})

describe('A: A5, estClose reads from details and not from the payload', () => {
  test('A1 its value is forecast_close_date', () => {
    const f = referenceFields(src({
      payload: { estClose: 'WRONG-from-payload' },
      details: { forecast_close_date: '2026-11-30' },
    }), false, NOW)
    expect(f.find((x) => x.name === 'estClose')!.value).toBe('2026-11-30')
  })
})

describe('S: item 5, same-as-account', () => {
  test('S1 B5: ON renders the ACCOUNT\'s values, live and read-only', () => {
    const f = referenceFields(src({
      payload: { commAddress: 'the opportunity own line 1' },
      account: { id: 'a1', name: 'Acme', shippingAddress: 'the ACCOUNT line 1', shippingCity: 'Singapore' },
    }), true, NOW)
    const a1 = f.find((x) => x.name === 'commAddress')!
    expect(a1.readOnly).toBe(true)
    expect(a1.value, 'the row showed the opportunity payload, not the account')
      .toBe('the ACCOUNT line 1')
    expect(f.find((x) => x.name === 'commCity')!.value).toBe('Singapore')
  })

  test('S2 B5: and NOTHING is copied - OFF shows the opportunity\'s own values again', () => {
    const s = src({
      payload: { commAddress: 'the opportunity own line 1' },
      account: { id: 'a1', name: 'Acme', shippingAddress: 'the ACCOUNT line 1' },
    })
    expect(referenceFields(s, false, NOW).find((x) => x.name === 'commAddress')!.value)
      .toBe('the opportunity own line 1')
    // The payload is untouched by the flip in either direction.
    expect(s.payload.commAddress).toBe('the opportunity own line 1')
  })

  test('S3 the flag is NOT one of the 21 rows (A7)', () => {
    expect(referenceFields(src(), false, NOW).map((f) => f.name))
      .not.toContain(SAME_AS_ACCOUNT)
  })

  test('S4 B6: whether the account has a shipping address to stand in for', () => {
    expect(accountHasShipping({ shippingCity: 'Singapore' })).toBe(true)
    expect(accountHasShipping({ shippingCity: '   ' }), 'whitespace is not an address').toBe(false)
    expect(accountHasShipping({ name: 'Acme' })).toBe(false)
    expect(accountHasShipping(null)).toBe(false)
  })
})

describe('V: values are always strings, per finding 1', () => {
  test('V1 a numeric payload value arrives as a string', () => {
    const f = referenceFields(src({ payload: { duration: 36 } }), false, NOW)
    expect(f.find((x) => x.name === 'duration')!.value).toBe('36')
  })
  test('V2 null and undefined arrive as the empty string, never "null"', () => {
    const f = referenceFields(src({ payload: { country: null, region: undefined } }), false, NOW)
    expect(f.find((x) => x.name === 'country')!.value).toBe('')
    expect(f.find((x) => x.name === 'region')!.value).toBe('')
  })
  test('V3 an absent account gives read-only rows an empty value, not a crash', () => {
    const f = referenceFields(src({ account: null }), true, NOW)
    expect(f.find((x) => x.name === 'commAddress')!.value).toBe('')
    expect(referenceReadOnly(src({ account: null }), null)
      .find((r) => r.label === 'Account')!.value).toBe('Not linked')
  })
})
