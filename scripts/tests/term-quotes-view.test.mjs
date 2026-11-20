// TERM_QUOTES V4, V5, CF2, CF3: what moved in a draft's settings, the
// approval page's Cash flow card and "what changed" table, and the method
// changed block's detail. Pure. Fixture params only (spec 11.7). Expected
// wording is the mockup's or the ruling's, typed, never produced by the code.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { whatMoved, whatMovedSentence, settingsChanged, cashFlowCard, whatChangedRows, quoteFigures, TERM_PARAM_KEYS, decimalMoney } from '../../src/lib/term-quote.js'
import { priceQuote } from '../../src/lib/term-pricing.js'
import { buildApprovalPage, buildFrozenFigures, withFrozenFigures, METHOD_CHANGED_SENTENCE } from '../../src/lib/approval-page.js'
import { tqParams, TQ1_INPUTS } from './fixtures/term-quote-params.mjs'

const FX = { enabled: true, ratePct: '1.0', termMonths: 24, method: 'straight', treatment: 'absorb' }

// ── V4 ───────────────────────────────────────────────────────────────────

test('V4: the ladder moving at one term is said in plain words (artboard 2)', () => {
  assert.deepEqual(whatMoved(tqParams('500.00'), tqParams('510.00')), ['the SafeSight price ladder at 120 months, 500.00 to 510.00'])
  assert.deepEqual(whatMoved(tqParams(), tqParams()), [])
})

test('V4: costs, bands and the floor likewise, each in its own words', () => {
  const t = tqParams()
  t.costs.safesight = { hwCost: '8400.00', hostingMonthly: '210.00' }
  t.VOLUME_BANDS_BY_PRODUCT.safesight = [{ from: 1, discountPct: '0' }, { from: 12, discountPct: '6' }, { from: 50, discountPct: '10' }, { from: 200, discountPct: '15' }]
  t.MARGIN_FLOOR = '30'
  assert.deepEqual(whatMoved(tqParams(), t), [
    'the SafeSight band 2 start, 10 units to 12',
    'the SafeSight band 2 discount, 5% to 6%',
    'the SafeSight hardware cost, 8,000.00 to 8,400.00',
    'the SafeSight hosting cost a month, 200.00 to 210.00',
    'the margin floor, 25% to 30%',
  ])
})

test('V4: at most three, then "and N more" (the three-plus case)', () => {
  const lines = ['a', 'b', 'c', 'd', 'e']
  assert.equal(whatMovedSentence(lines), 'a; b; c; and 2 more')
  assert.equal(whatMovedSentence(lines.slice(0, 3)), 'a; b; c')
  assert.equal(whatMovedSentence(lines.slice(0, 1)), 'a')
  assert.equal(whatMovedSentence([]), '')
  const t = tqParams('510.00'); t.MARGIN_FLOOR = '30'; t.HW_UPFRONT_MARGIN = '25'; t.CURRENCY = 'SGD'
  assert.equal(whatMovedSentence(whatMoved(tqParams(), t)),
    'the SafeSight price ladder at 120 months, 500.00 to 510.00; the margin floor, 25% to 30%; the hardware upfront margin, 20% to 25%; and 1 more')
})

test('V4: whatMoved and settingsChanged agree on every key: a change is never announced with nothing listed', () => {
  for (const k of TERM_PARAM_KEYS) {
    const t = structuredClone(tqParams())
    t[k] = k === 'TERMS' ? [12, 24] : k === 'costs' ? { safesight: { hwCost: '1.00', hostingMonthly: '1.00' } }
      : k === 'PRICE_LADDER_BY_PRODUCT' ? { safesight: { 120: '1.00' } } : k === 'VOLUME_BANDS_BY_PRODUCT' ? { safesight: [] } : '99'
    assert.equal(settingsChanged(tqParams(), t), true, k)
    assert.ok(whatMoved(tqParams(), t).length > 0, `${k} changed and whatMoved listed nothing`)
  }
  const extra = { ...tqParams(), SOMETHING_NEW: 1 }
  assert.equal(settingsChanged(tqParams(), extra), true)
  assert.deepEqual(whatMoved(tqParams(), extra), ['the setting SOMETHING_NEW'])
})

test('decimalMoney groups a decimal string without a float', () => {
  assert.equal(decimalMoney('8000.00'), '8,000.00')
  assert.equal(decimalMoney('1234567.5'), '1,234,567.50')
})

// ── CF2 ──────────────────────────────────────────────────────────────────

test('CF2: factoring on: peak funding need as a positive amount and its month, payback, cost, treatment', () => {
  const c = cashFlowCard(priceQuote({ ...TQ1_INPUTS, factoring: FX }, tqParams()))
  assert.equal(c.peakFunding.text, '128,750.00 in month 25')
  assert.equal(c.noFundingNeed, null)
  assert.equal(c.paybackText, 'Month 33')
  assert.equal(c.paybackSub, 'cash stays at or above zero from here')
  assert.deepEqual(c.factoring, { on: true, text: null, cost: '60,000.00', treatment: 'Absorb' })
})

test('CF2: factoring off: "PO factoring: off", no cost and no treatment (never 0.00, never Absorb)', () => {
  const c = cashFlowCard(priceQuote(TQ1_INPUTS, tqParams()))
  assert.deepEqual(c.factoring, { on: false, text: 'PO factoring: off', cost: null, treatment: null })
})

test('CF2: no funding need, and no payback, said as ruled', () => {
  const q = { cashFlow: { lowest: { balanceCents: 0n, month: 0 }, paybackMonth: null }, factoring: null }
  const c = cashFlowCard(q)
  assert.equal(c.peakFunding, null)
  assert.equal(c.noFundingNeed, 'No funding need: cash never falls below zero')
  assert.equal(c.paybackText, 'None within the term')
})

// ── D4, CF3: the "what changed" table ────────────────────────────────────

const snap = (inputs, params = tqParams()) => { const quote = priceQuote(inputs, params); return { inputs, quote, figures: quoteFigures(quote) } }

test('D4 and CF3: every row in order, unchanged ones marked so, Base TCV and margin with their difference', () => {
  const after = { ...TQ1_INPUTS, units: { safesight: 80 }, termMonths: 96, factoring: FX }
  const rows = whatChangedRows(snap(TQ1_INPUTS), snap(after))
  assert.deepEqual(rows.map((r) => r.label), ['SafeSight units', 'Air Quality units', 'HEMIR units', 'Term', 'Deal discount',
    'Payment basis', 'CPI', 'Peak funding need', 'PO factoring', 'Base TCV', 'Margin'])
  const by = Object.fromEntries(rows.map((r) => [r.key, r]))
  assert.deepEqual([by['units.safesight'].before, by['units.safesight'].after, by['units.safesight'].changed], ['60', '80', true])
  assert.deepEqual([by['units.hemir'].changed, by.deal.changed, by.cpi.changed, by.basis.changed], [false, false, false, false])
  assert.deepEqual([by.term.before, by.term.after], ['120 months', '96 months'])
  assert.deepEqual([by.factoring.before, by.factoring.after.startsWith('On, advance ')], ['Off', true])
  assert.equal(by.baseTcv.before, '3,414,000.00')
  assert.match(by.baseTcv.delta ?? '', /^\+\d/)
  assert.match(by.margin.delta ?? '', / pts$/)
  const none = whatChangedRows(snap(TQ1_INPUTS), snap(TQ1_INPUTS))
  assert.ok(none.every((r) => !r.changed && r.delta === null), 'two identical versions: every row unchanged, no difference')
})

// ── V5: the approval page carries them, and freezes the card ─────────────

const termV = (over = {}) => ({ id: 'v2', kind: 'term_quote', status: 'issued', major: 2, minor: 0, revision_number: 5, inputs: TQ1_INPUTS, rates: { params: tqParams() }, ...over })

test('V5: the term ask carries profit, the two chips in the mockup\'s words, and the Cash flow card', () => {
  const p = buildApprovalPage({ payload: { pricingMethod: 'term_quote', termQuote: TQ1_INPUTS }, version: termV(), record: {}, termParams: tqParams() })
  assert.equal(p.ask.profit, 1494000)
  assert.deepEqual(p.ask.chips, [{ ok: true, text: 'No deal discount: priced at list' }, { ok: true, text: 'Above the 25% floor' }])
  assert.equal(p.ask.cashFlow.factoring.text, 'PO factoring: off')
})

test('CF2: the card is FROZEN at submission: a submitted version reads its stored card, whatever today computes', () => {
  const v = termV({ inputs: { ...TQ1_INPUTS, factoring: FX } })
  const frozen = buildFrozenFigures({ payload: {}, version: v, record: {}, termParams: tqParams() }, 'engine-x')
  assert.equal(frozen.page.ask.cashFlow.peakFunding.text, '128,750.00 in month 25')
  // Today's engine on tampered stored settings computes a different card; the
  // page shows the frozen one.
  const today = buildApprovalPage({ payload: {}, version: { ...v, rates: { params: tqParams('510.00') } }, record: {}, termParams: tqParams('510.00') })
  assert.notEqual(today.ask.cashFlow.peakFunding.text, '128,750.00 in month 25', 'the tamper moved today\'s card, so the check can fail')
  const shown = withFrozenFigures(today, { ...v, frozen_figures: frozen })
  assert.equal(shown.ask.cashFlow.peakFunding.text, '128,750.00 in month 25')
})

test('V5: two term versions show the what-changed table, from the baseline\'s FROZEN figures', () => {
  const base = termV({ id: 'v1', major: 1, revision_number: 3 })
  // Frozen at 500.00, then its STORED settings tampered to 510.00: a submitted
  // baseline repriced on its own settings would read the same as its frozen
  // figure, so without the tamper this test could not tell the two apart (the
  // calibration's one SILENT injection said so).
  const baseline = { ...base, rates: { params: tqParams('510.00') }, frozen_figures: buildFrozenFigures({ payload: {}, version: base, record: {}, termParams: tqParams() }, 'e'), approval: { decidedAt: '2026-11-12T00:00:00Z' } }
  const now = termV({ inputs: { ...TQ1_INPUTS, units: { safesight: 80 } } })
  const p = buildApprovalPage({ payload: { pricingMethod: 'term_quote', termQuote: now.inputs }, version: now, baseline, record: {}, termParams: tqParams('510.00') })
  assert.equal(p.moved.bridge, null)
  const rows = Object.fromEntries(p.moved.whatChanged.rows.map((r) => [r.key, r]))
  assert.equal(rows.baseTcv.before, '3,414,000.00', 'the baseline\'s own frozen figure, not a reprice on today\'s 510.00')
  assert.equal(rows['units.safesight'].changed, true)
  assert.equal(p.moved.whatChanged.note, 'Unchanged inputs are greyed. Payment basis changes when the client pays, not the Base TCV.')
})

test('V5: the method-changed block names both methods, the real Commercials contract net, and the term side\'s summary', () => {
  const baseline = { id: 'c1', kind: 'commercials', status: 'issued', major: 1, minor: 0, revision_number: 2,
    inputs: { ssNew: 10, targetMargin: 30, duration: 36 }, rates: { rates: { ssUnitCost: 1200, inSsNew: 300, hoSafesight: 20 } },
    frozen_figures: { result: { totals: { contractNet: 123456.78 } } }, approval: { decidedAt: '2026-11-12T00:00:00Z' } }
  const p = buildApprovalPage({ payload: { pricingMethod: 'term_quote', termQuote: TQ1_INPUTS }, version: termV(), baseline, record: {}, termParams: tqParams() })
  const m = p.moved.methodChanged
  assert.equal(m.sentence, METHOD_CHANGED_SENTENCE)
  assert.equal(m.explanation, 'V1.0 was priced bottom-up in Commercials; V2.0 is a term quote. The two cannot be reconciled step by step, so both figures are shown as they were priced.')
  assert.equal(m.lastApproved.figure, 123456.78, 'the Commercials version\'s own frozen contract net')
  assert.equal(m.underReview.summary, 'SafeSight 60 units · 120 months · OPEX · margin 43.8%')
  assert.equal(m.underReview.chips.length, 2)
})
