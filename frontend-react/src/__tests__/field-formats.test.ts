// ── S1: THE REGISTRY, TESTED WITHOUT A BROWSER ──────────────────────────
//
// The registry states the formats and the ONE arithmetic rule; the live guard
// checks what the screen does with them. This file is the half that needs no
// font, so it can say things the probe cannot: that the rule is the rule, that
// every declared field resolves, and that an undeclared one resolves to
// NOTHING rather than to a default.
import { describe, test, expect } from 'vitest'
import {
  FORMATS, FIELD_PADDING_PX, widthFor, widestValueFor, formatFor, NAMED_IDS,
} from '../../../src/lib/field-formats.js'

describe('S1: the format registry', () => {
  test('S1a: every format is a string, and the five John ruled are present', () => {
    expect(Object.keys(FORMATS).sort())
      .toEqual(['count', 'money-large', 'money-small', 'months', 'percent'])
    expect(FORMATS['money-large']).toBe('xxx,xxx.xx')
    expect(FORMATS['money-small']).toBe('x,xxx.xx')
    expect(FORMATS.percent).toBe('xx.x')
    expect(FORMATS.months).toBe('XXX')
    expect(FORMATS.count).toBe('XX')
  })

  test('S1b: the widest value substitutes the widest digit for every placeholder', () => {
    // This is what makes a format string mean something measurable rather than
    // being a picture of one. A digit is wider than an `x` in a proportional
    // font, so sizing to the picture clips the number.
    expect(widestValueFor('money-large')).toBe('999,999.99')
    expect(widestValueFor('percent')).toBe('99.9')
    expect(widestValueFor('count')).toBe('99')
    // the separators are literal and survive
    expect(widestValueFor('money-small')).toBe('9,999.99')
  })

  test('S1c: the width is the wider of the two, plus the fixed padding', () => {
    // A stand-in measure, so the ARITHMETIC is tested rather than a font.
    const measure = (s: string) => s.length * 10
    // `XXX` and `999` are the same length, so months is length-driven
    expect(widthFor('months', measure)).toBe(30 + FIELD_PADDING_PX)
    // a measure that makes the VALUE wider than the spec must win
    const lopsided = (s: string) => (/\d/.test(s) ? 100 : 10)
    expect(widthFor('percent', lopsided)).toBe(100 + FIELD_PADDING_PX)
    // and a measure that makes the SPEC wider must win the other way
    const inverted = (s: string) => (/\d/.test(s) ? 10 : 100)
    expect(widthFor('percent', inverted)).toBe(100 + FIELD_PADDING_PX)
  })

  test('S1d: an unknown format is a throw, not a default', () => {
    expect(() => widthFor('not-a-format', (s: string) => s.length)).toThrow(/no format named/)
  })

  test('S1e: every named id resolves to a format that exists', () => {
    expect(NAMED_IDS.length).toBeGreaterThan(15)
    for (const id of NAMED_IDS) {
      const f = formatFor(id)
      expect(f, id).toBeTruthy()
      expect((FORMATS as Record<string, string>)[f as string], `${id} -> ${f}`).toBeTruthy()
    }
  })

  test('S1f: the generated grids resolve by pattern', () => {
    expect(formatFor('deal-ms-3-usd')).toBe('money-large')
    expect(formatFor('deal-cm-0-month')).toBe('months')
    expect(formatFor('deal-ms-4-pct')).toBe('percent')
    expect(formatFor('deal-margin-hwSs')).toBe('percent')
    expect(formatFor('deal-opexfee-ss')).toBe('money-small')
    expect(formatFor('deal-opexunits-aq')).toBe('count')
  })

  test('S1g: a field the registry does not name resolves to NOTHING', () => {
    // NOT a default. A default here would be the per-site literal the standard
    // removes, hidden one level down where nothing could see it; the guard
    // reports an unnamed field by name instead.
    expect(formatFor('deal-name')).toBeNull()
    expect(formatFor('deal-bidCurrency')).toBeNull()
    expect(formatFor('')).toBeNull()
    expect(formatFor(undefined)).toBeNull()
  })

  test('S1h: N3 - Cost (USD) inputs are money-large and Margin is percent', () => {
    for (const id of ['deal-lumpCost', 'deal-inSsExisting', 'deal-inSsNew', 'deal-inAqm', 'deal-inHemir']) {
      expect(formatFor(id), id).toBe('money-large')
    }
    for (const id of ['deal-margin-inSsEx', 'deal-margin-hwSs', 'deal-targetMargin', 'deal-warrantyPct']) {
      expect(formatFor(id), id).toBe('percent')
    }
  })
})
