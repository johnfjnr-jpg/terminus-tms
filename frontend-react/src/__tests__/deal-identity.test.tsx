// ── THE IDENTITY THE RENDER MUST CARRY ───────────────────────────────────
//
// D2d item 1. The swap removes frontend/opportunity-deal.js and the static
// markup it drove, so anything OUTSIDE the form that depended on that markup's
// identity now depends on React producing it: every style.css rule, every
// reader in app.js and opportunity-deal-versions.js, and every label[for] and
// aria-* target inside the form.
//
// The list is generated and provenance-checked in scripts/tests/adopted-identity.test.mjs.
// This test asserts the RENDER carries it, which is the half a source scan of
// the list cannot see.
import { describe, test, expect } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ShellProvider } from '../ShellContext'
import { shellServices } from '../shell-services'
import { DealPanel } from '../deal/DealPanel'
import { ADOPTED_IDS, ADOPTED_CLASSES } from '../deal/adopted-identity'
import type { UiState, Values } from '../deal/payload'

declare global {
  interface Window { api?: (m: string, p: string, b?: unknown) => Promise<unknown> }
}

const RATES = {
  ssUnitCost: 1000, aqUnitCost: 800, hemirUnitCost: 1200,
  hoSafesight: 10, hoAqm: 8, hoHemir: 12,
  inSsExisting: 100, inSsNew: 200, inAqm: 90, inHemir: 110,
}
// EVERY BRANCH THAT CARRIES IDENTITY MUST BE ABLE TO RENDER, so the fixtures
// sweep the visibility switches rather than sampling one shape. The census
// itself was wrong for exactly this reason: measured on one empty deal, it
// missed 40 ids and 30 classes.
const SHAPES: { name: string, ui: UiState, values: Values }[] = [
  { name: 'twoPhase / annual / client own',
    ui: { installResp: 'Client Own Installation Team', structure: 'twoPhase', invoicing: 'annual', grossUp: false, factoringEnabled: false, factoringMethod: 'straight' },
    values: { 'deal-ssExisting': '40', 'deal-ssNew': '25', 'deal-aqm': '12', 'deal-hemir': '8', 'deal-duration': '36', 'deal-targetMargin': '30', 'deal-warrantyPct': '12', 'deal-whtPct': '10', 'deal-gstPct': '9', 'deal-recoveryMonths': '24' } },
  { name: 'single / monthly / factoring / per unit',
    ui: { installResp: 'Terminus Contractor - Per Unit', structure: 'single', invoicing: 'monthly', grossUp: true, factoringEnabled: true, factoringMethod: 'straight' },
    values: { 'deal-ssExisting': '40', 'deal-aqm': '12', 'deal-duration': '24', 'deal-targetMargin': '30', 'deal-factoring-ratePct': '8', 'deal-factoring-termMonths': '6' } },
  { name: 'hybrid / declining / lump sum',
    ui: { installResp: 'Terminus Contractor - Lump Sum', structure: 'hybrid', invoicing: 'annual', grossUp: false, factoringEnabled: true, factoringMethod: 'declining' },
    values: { 'deal-ssExisting': '40', 'deal-aqm': '12', 'deal-duration': '36', 'deal-targetMargin': '30', 'deal-lumpCost': '250000' } },
]

async function renderShape(values: Values, ui: UiState): Promise<HTMLElement> {
  window.api = async (_m: string, path: string) =>
    path === '/api/base-costs' ? { ok: true, data: { rates: RATES } } : { ok: false, status: 404, data: {} }
  document.body.innerHTML = '<div id="host"></div>'
  const host = document.getElementById('host')!
  const root: Root = createRoot(host)
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  await act(async () => {
    root.render(
      <QueryClientProvider client={qc}>
        <ShellProvider services={shellServices}>
          <DealPanel initialValues={values} initialUi={ui} testBedCost={25000} />
        </ShellProvider>
      </QueryClientProvider>)
  })
  await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
  return host
}

async function seen(): Promise<{ ids: Set<string>, cls: Set<string> }> {
  const ids = new Set<string>(), cls = new Set<string>()
  for (const shape of SHAPES) {
    const host = await renderShape(shape.values, shape.ui)
    for (const el of host.querySelectorAll('*')) {
      if (el.id) ids.add(el.id)
      for (const c of el.classList) cls.add(c)
    }
  }
  return { ids, cls }
}

// ── THE GAP IS A RATCHET, NOT A SUPPRESSION ─────────────────────────────
//
// The swap cannot land on a partially-adopted render, so the adoption is done
// in passes and this list is what is still outstanding. It is asserted in BOTH
// directions: the render may not lose a name (the missing set can only shrink),
// and this list may not name something the render already carries (so it cannot
// rot into a list of things that were fixed years ago).
//
// When both lists are empty the two `toEqual([])` assertions below become the
// real coverage test and this comment goes with them.
const KNOWN_MISSING_IDS: readonly string[] = [
  'deal-detail-heading', 'deal-detail-panel', 'deal-factoring-fields',
  'deal-section-3', 'deal-section-5', 'deal-section-6', 'deal-sections-1-2',
]
const KNOWN_MISSING_CLASSES: readonly string[] = [
  'active', 'btn-ghost', 'btn-primary', 'btn-sm', 'btn-text', 'cashflow-scroll',
  'col-mono', 'data-row-label', 'deal-basis', 'deal-basis-age', 'deal-basis-label',
  'deal-basis-value', 'deal-cashflow-col', 'deal-detail-col', 'deal-intake-col',
  'deal-panel', 'deal-payment-col', 'deal-payment-region', 'deal-section--intake',
  'deal-summary-col', 'deal-summary-row', 'deal-toggle', 'detail-open',
  'disclose', 'disclose-chevron', 'doc-table', 'empty-state',
  'field-note', 'form-grid', 'form-group', 'help-dot', 'hidden', 'int-only',
  'is-computed', 'is-scrollable', 'latch', 'latch-all-row', 'latch-row--intake',
  'msg-error', 'msg-success', 'payment-card', 'payment-terms-panel', 'pg-card',
  'pg-card-title', 'pg-cards', 'pg-cost', 'pg-head', 'pg-item-name',
  'pg-item-note', 'pg-margin-input', 'pg-price', 'pg-row', 'pg-total',
  'po-factoring-panel', 'po-field', 'ring-radio', 'ring-radio-dot',
  'ring-radio-group', 'ring-radio-label', 'ring-radio-ring', 'section-save',
  'section-title', 'section-title-row',   'terms-achieved', 'terms-cards',
  'terms-field-row', 'unit-card', 'unit-cards', 'view-toggle',
  'view-toggle--stacked',
]

describe('the render adopts the vanilla identity', () => {
  test('the instrument can see the render at all', async () => {
    // Verification 13: a zero from an instrument never shown reaching one is
    // not a measurement. If this fails, everything below is vacuous.
    const { ids, cls } = await seen()
    expect(ids.size).toBeGreaterThan(20)
    expect(cls.size).toBeGreaterThan(20)
  })

  test('no adopted ID the render already carries is lost', async () => {
    const { ids } = await seen()
    const missing = ADOPTED_IDS.filter((id) => !ids.has(id))
    const regressed = missing.filter((id) => !KNOWN_MISSING_IDS.includes(id))
    expect(regressed, `ids the render used to carry and no longer does: ${regressed.join(', ')}`).toEqual([])
  })

  test('no adopted CLASS the render already carries is lost', async () => {
    const { cls } = await seen()
    const missing = ADOPTED_CLASSES.filter((c) => !cls.has(c))
    const regressed = missing.filter((c) => !KNOWN_MISSING_CLASSES.includes(c))
    expect(regressed, `classes the render used to carry and no longer does: ${regressed.join(', ')}`).toEqual([])
  })

  test('the outstanding list does not rot: nothing on it is already rendered', async () => {
    const { ids, cls } = await seen()
    const staleIds = KNOWN_MISSING_IDS.filter((id) => ids.has(id))
    const staleCls = KNOWN_MISSING_CLASSES.filter((c) => cls.has(c))
    expect([...staleIds, ...staleCls],
      'these are rendered now and must come off the outstanding list').toEqual([])
  })
})
