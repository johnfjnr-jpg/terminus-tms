// ── FROZEN_FIGURES R-FF2 AND R-FF6, RENDERED ─────────────────────────────
//
// Derived from the rulings, not from ApprovalBlocks.tsx: a submitted version
// shows its STORED figures; where today's engine prices a displayed figure
// differently, the ruled sentence sits beside it and NEVER substitutes; a
// version submitted before figures were frozen carries the ruled head line;
// a draft carries neither. The page is assembled the way the route does it
// (withFrozenFigures over the builder), and every assertion reads RENDERED TEXT.
import { describe, test, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { AskBlock, ExposuresBlock } from '../ApprovalBlocks'
import { build, payload, version, RATES } from './fixtures'
import { money } from '../approval-format'
import { buildFrozenFigures, withFrozenFigures } from '../../../src/lib/approval-page.js'
import type { ApprovalPage } from '../approval-types'

const asText = (html: string) =>
  html.replace(/<[^>]*>/g, ' ').replace(/&#x27;/g, "'").replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ').trim()

const LEGACY = "Submitted before figures were frozen. Every figure below is today's engine's, from this version's frozen inputs and rates."
const p0 = payload()
// The version's frozen rates in the shape the save route writes them: the
// rates it priced at, and the batches as an OBJECT keyed by product.
const FROZEN_RATES = {
  as_of: '2026-09-05', missing: [], rates: RATES,
  batches: { safesight: { batch_id: 'b-ss', batch_label: 'SS batch 3', effective_from: '2026-06-01' } },
}
const v = (over: Record<string, unknown> = {}) => version({ inputs: p0, rates: FROZEN_RATES, ...over })
const args = { payload: p0, version: v() }
const ask = (p: ApprovalPage) => {
  const f = p.frozen
  return asText(renderToStaticMarkup(<AskBlock ask={p.ask}
    today={f?.state === 'frozen' ? f.today : undefined}
    legacyHeadLine={f?.state === 'legacy' ? f.headLine : null} />))
}
// The component's own formatter, never a restated one (Verification 20).
const fmt = (n: number | null) => `$${money(n)}`

describe('R-FF2: a submitted version with stored figures', () => {
  const today = build(args)
  // The snapshot an EARLIER engine took: the same page, a contract net $1,000
  // higher. Built the system's way (buildFrozenFigures), then aged.
  const snap = buildFrozenFigures(args, { commit: 'old' }, '2026-08-01T00:00:00Z')
  const STORED = snap.page.ask.contractNet + 1000
  snap.page.ask.contractNet = STORED
  const page = withFrozenFigures(today, { ...v(), frozen_figures: snap }) as unknown as ApprovalPage
  const t = ask(page)

  test('the two figures differ and neither is zero, so the assertions can tell them apart', () => {
    expect(today.ask.contractNet).toBeGreaterThan(0)
    expect(fmt(today.ask.contractNet)).not.toBe(fmt(STORED))
  })
  test("the STORED contract net is the figure shown (the row's value follows its note)", () => {
    expect(t).toContain(`Contract net Today's engine prices this at ${fmt(today.ask.contractNet)}; the approved figure stands. ${fmt(STORED)} Total cost`)
  })
  test("today's figure appears only inside the ruled sentence", () => {
    expect(t.split(`prices this at ${fmt(today.ask.contractNet)};`).length - 1).toBe(1)
    expect(t).not.toContain(`Contract net ${fmt(today.ask.contractNet)}`)
  })
  test('a figure that agrees carries no sentence (exactly one sentence on the block)', () => {
    expect(t.split('the approved figure stands').length - 1).toBe(1)
  })
  test('no legacy head line on a frozen version', () => {
    expect(t).not.toContain('Submitted before figures were frozen')
  })
  test('an exposure that differs carries the sentence too', () => {
    const e = today.exposures[0]
    expect(e).toBeTruthy()
    const html = renderToStaticMarkup(<ExposuresBlock exposures={page.exposures} today={{ [`exposures.${e.key}`]: e.amount + 7 }} />)
    expect(asText(html)).toMatch(/Today's engine prices this at .*; the approved figure stands\./)
  })
})

describe('R-FF6: a version submitted before figures were frozen', () => {
  const page = withFrozenFigures(build(args), { ...v(), frozen_figures: null }) as unknown as ApprovalPage
  const t = ask(page)
  test('the ruled head line, first', () => {
    expect(t.startsWith(LEGACY)).toBe(true)
  })
  test("and no today sentence (every figure already is today's)", () => {
    expect(t).not.toContain('the approved figure stands')
  })
})

describe('a draft says neither', () => {
  const page = withFrozenFigures(build(args), { ...v({ status: 'draft' }), frozen_figures: null }) as unknown as ApprovalPage
  const t = ask(page)
  test('no head line, no sentence', () => {
    expect(page.frozen).toBeNull()
    expect(t).not.toContain('Submitted before figures were frozen')
    expect(t).not.toContain('the approved figure stands')
  })
})
