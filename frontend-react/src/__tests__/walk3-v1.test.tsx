// ── V1: the detail header carries what the list row already shows ───────
//
// John: "We could have the company, source and created after the qualified
// status, and move the qualify and nurture buttons to the right to accommodate
// it."
import { describe, test, expect } from 'vitest'
import { leadSummaryLine } from '../leads/leadSummary'

describe('V1: one derivation for the summary line', () => {
  test('company, source and created, in that order', () => {
    expect(leadSummaryLine({
      payload: { company: 'Acme Holdings', source: 'Referral' },
      createdAt: '2026-09-13T08:12:23.841057+00:00',
    })).toBe('Acme Holdings · Referral · 13/09/2026')
  })

  test('the RESOLVED account name wins over the typed company, as the list has it', () => {
    expect(leadSummaryLine({
      accountName: 'Acme Pte Ltd',
      payload: { company: 'acme holdings', source: 'Web' },
      createdAt: '2026-09-13T08:12:23.841057+00:00',
    })).toBe('Acme Pte Ltd · Web · 13/09/2026')
  })

  test('absence is per PART, so a line is never empty', () => {
    expect(leadSummaryLine({ payload: {}, createdAt: null })).toBe('-- · -- · --')
    expect(leadSummaryLine({ payload: { company: 'Acme' } })).toBe('Acme · -- · --')
  })

  test('and the date is the estate format, four-digit year per W2', () => {
    expect(leadSummaryLine({ payload: {}, createdAt: '2026-01-02T00:00:00.000Z' }))
      .toMatch(/^-- · -- · \d{2}\/\d{2}\/\d{4}$/)
  })
})
