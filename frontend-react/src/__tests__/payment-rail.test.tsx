// ── R-PT2: THE PAYMENT TERMS LEFT RAIL ──────────────────────────────────
//
// The panel splits into a control RAIL and a money CONTENT column. The money
// starts at the top of the panel in BOTH modes, which is the point: today the
// CAPEX tables begin below a block of radios and the OPEX ones do not.
//
// Geometry - top alignment, rail width, contrast - is the live probe's, because
// jsdom has no layout. What belongs here is STRUCTURE: what is in the rail,
// what is in the content, and what the radios are made of.
import { describe, test, expect } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { ShellProvider } from '../ShellContext'
import { shellServices } from '../shell-services'
import { DealPanel } from '../deal/DealPanel'
import type { UiState, Values } from '../deal/payload'
import { catalogApi } from './fixtures'

declare global { interface Window { api?: (m: string, p: string, b?: unknown) => Promise<unknown> } }

const UI: UiState = {
  installResp: 'Terminus Contractor - Per Unit', structure: 'twoPhase', invoicing: 'annual',
  grossUp: false, factoringEnabled: false, factoringMethod: 'straight',
  hostingPriceMode: 'margin', paymentMode: 'capex',
}
const VALUES: Values = {
  'deal-ssExisting': '20', 'deal-ssNew': '12', 'deal-aqm': '4', 'deal-hemir': '3',
  'deal-duration': '60', 'deal-targetMargin': '30', 'deal-warrantyPct': '2',
}
let host: HTMLElement
const mount = async (ui: Partial<UiState> = {}) => {
  window.api = catalogApi()
  document.body.innerHTML = '<div id="host"></div>'
  host = document.getElementById('host')!
  const root: Root = createRoot(host)
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  await act(async () => {
    root.render(
      <QueryClientProvider client={qc}>
        <ShellProvider services={shellServices}>
          <DealPanel initialValues={VALUES} initialUi={{ ...UI, ...ui }} testBedCost={0} />
        </ShellProvider>
      </QueryClientProvider>)
  })
  await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
}
const rail = () => host.querySelector('#deal-payment-rail')
const content = () => host.querySelector('#deal-payment-content')

describe('R-PT2: the rail and the content column', () => {
  test('P1: both exist, and the rail comes first', async () => {
    await mount()
    expect(rail()).not.toBeNull()
    expect(content()).not.toBeNull()
    // A RELATIONSHIP rather than a class: "left rail" is an order claim in the
    // document, and the live probe checks it is also an order on screen.
    expect(rail()!.compareDocumentPosition(content()!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  test('P2: the slider sits at the TOP of the rail', async () => {
    await mount()
    const s = rail()!.querySelector('[data-testid="deal-payment-mode-toggle"]')
    expect(s, 'the slider is not in the rail').not.toBeNull()
    // FIRST in the rail, which is what "top" means before any layout runs.
    expect(rail()!.firstElementChild!.contains(s!)).toBe(true)
  })

  // R-PT3, 2026-09-26: three radios became two. The claim is about WHERE they
  // live, which is what R-PT2 ruled and is unchanged.
  test('P3: under CAPEX the rail holds the radios and the content does not', async () => {
    await mount()
    const inRail = [...rail()!.querySelectorAll('[data-structure]')].map((e) => e.getAttribute('data-structure'))
    expect(inRail).toEqual(['twoPhase', 'hybrid'])
    expect(content()!.querySelectorAll('[data-structure]')).toHaveLength(0)
  })

  test('P4: each radio is a LABEL plus a secondary line, not one run-on string', async () => {
    await mount()
    const rows = [...rail()!.querySelectorAll('[data-structure]')]
    const read = rows.map((r) => ({
      label: r.querySelector('.ring-radio-label')!.textContent!.trim(),
      note: r.querySelector('.ring-radio-note')?.textContent?.trim() ?? null,
    }))
    // R-PT3 removed the Single phase row. The two that remain keep R-PT2's
    // shape: a label and a secondary line, never one run-on string.
    expect(read).toEqual([
      { label: 'Two-phase', note: 'hardware recovery then hosting' },
      { label: 'Hybrid', note: 'milestone + hosting' },
    ])
    // The parenthetical is GONE from the label, or the note is a duplicate.
    for (const r of read) expect(r.label).not.toContain('(')
  })

  test('P5: under OPEX the rail holds no radios, per L2', async () => {
    await mount({ paymentMode: 'opex' })
    expect(host.querySelector('#deal-structure-toggle')).toBeNull()
    expect(rail()!.querySelectorAll('[data-structure]')).toHaveLength(0)
    // and the slider is still there, in the same place
    expect(rail()!.querySelector('[data-testid="deal-payment-mode-toggle"]')).not.toBeNull()
  })

  test('P6: the money content is in the CONTENT column in both modes', async () => {
    await mount()
    expect(content()!.querySelector('#deal-capex-year-slot')?.children.length ?? 0).toBeGreaterThan(0)
    await mount({ paymentMode: 'opex' })
    expect(content()!.querySelector('#deal-opex-table')).not.toBeNull()
    expect(content()!.querySelector('#deal-opex-year-slot')?.children.length ?? 0).toBeGreaterThan(0)
  })

  test('P7: and the yearly table exists exactly ONCE, whichever mode', async () => {
    // Two mounts of one schedule would be two readers of one derivation, and
    // would satisfy every "it is in the content column" assertion above.
    for (const paymentMode of ['capex', 'opex']) {
      await mount({ paymentMode })
      // COUNTED BY THE VIEW'S OWN TEST ID, not by a guessed row class: the
      // schedule renders as `year-schedule` or `hybrid-schedule` depending on
      // the structure, and a selector that matches neither would report ZERO
      // and read as the table having vanished.
      // SCOPED TO THE SLOTS, and the first version was not. It counted every
      // schedule in the panel and read TWO - correctly, because `#deal-hybrid-
      // schedule` renders the same computed schedule in its own slot and hides
      // whichever does not apply. R-O4 rules that deliberate: one derivation,
      // two places to render it. The claim here is about the CONTENT COLUMN.
      const slots = [...host.querySelectorAll('#deal-capex-year-slot, #deal-opex-year-slot')]
      const filled = slots.filter((e) => e.children.length > 0)
      expect(filled, `${paymentMode}: the yearly table is in ${filled.length} slots`).toHaveLength(1)
      const views = filled[0].querySelectorAll('[data-testid="year-schedule"], [data-testid="hybrid-schedule"]')
      expect(views, `${paymentMode}: ${views.length} schedules in the content column`).toHaveLength(1)
    }
  })
})
