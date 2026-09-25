// ── F1, F2 AND F4: THE RAIL'S CONTROLS ──────────────────────────────────
//
// F1  the OPEX/CAPEX control IS the PO Factoring toggle: same component,
//     same dress, same size.
// F2  the recovery radios align on ONE gutter.
// F4  the Invoicing radios join the rail beneath the recovery radios, same
//     gutter, same alignment. Recovery period stays with them.
//
// WHAT IS HERE AND WHAT IS NOT. jsdom has no layout and does not load
// `frontend/style.css`, so a GUTTER is not measurable here and no assertion
// below pretends to measure one: F2's gutter and F1's size are the live
// probe's, stated as a relationship between two elements. What belongs here is
// what the markup IS - which component renders the control, what the rail
// contains, and the ORDER, which is a document fact rather than a painted one.
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
const q = (s: string) => host.querySelector(s)
const rail = () => host.querySelector('#deal-payment-rail')!
const mode = () => q('[data-testid="deal-payment-mode-toggle"]') as HTMLButtonElement
const factoring = () => q('[data-testid="deal-factoring-toggle"]') as HTMLButtonElement

describe('F1: one toggle component, worn twice', () => {
  // The claim is "same COMPONENT", so the assertion is a property the shared
  // component DECLARES rather than a class anybody can copy onto a button
  // (V19: enumerate by a declared property, never by a name).
  test('F1a: both controls are rendered by the shared toggle component', async () => {
    await mount()
    expect(mode().dataset.dealToggle).toBe('true')
    expect(factoring().dataset.dealToggle).toBe('true')
  })

  test('F1b: they wear the same dress, and the mode control carries no size override', async () => {
    await mount()
    const dress = (b: HTMLButtonElement) => [...b.classList].filter((c) => c !== 'is-on').sort().join(' ')
    expect(dress(mode())).toBe(dress(factoring()))
    // `.opex-slider` is what made it a different size: no padding and a fixed
    // 42px track. F1 removes the size difference, so it removes the class.
    expect(mode().classList.contains('opex-slider')).toBe(false)
  })

  test('F1c: the mode control names its state inside itself, as the factoring one does', async () => {
    /* EXACT, not a substring. The first version asserted `toMatch(/CAPEX/)`,
       and the calibration injection that renamed the label to `CAPEX mode`
       came back SILENT with ZERO failures - a substring that cannot fail
       (Verification 17), on the one claim this test exists for. The live probe
       compared exactly and would have caught it; the unit test would not. */
    await mount({ paymentMode: 'capex' })
    expect(mode().textContent!.trim()).toBe('CAPEX')
    await mount({ paymentMode: 'opex' })
    expect(mode().textContent!.trim()).toBe('OPEX')
    // SUPERSEDES L1's flanking labels. A label outside the button is exactly
    // the thing that made the two controls different sizes, so keeping them
    // and claiming "same size" would be a claim the screen contradicts.
    expect(q('[data-testid="deal-mode-label-opex"]')).toBeNull()
    expect(q('[data-testid="deal-mode-label-capex"]')).toBeNull()
  })

  test('F1d: it is still a switch and still says what a click will do', async () => {
    await mount({ paymentMode: 'opex' })
    expect(mode().getAttribute('role')).toBe('switch')
    expect(mode().getAttribute('aria-checked')).toBe('true')
    expect(mode().getAttribute('title')).toBeTruthy()
  })
})

describe('F4: the invoicing radios join the rail', () => {
  test('F4a: invoicing is INSIDE the rail, in every structure', async () => {
    for (const structure of ['twoPhase', 'single', 'hybrid'] as const) {
      await mount({ structure })
      const inv = q('#deal-invoicing-toggle')
      expect(inv, `invoicing missing under ${structure}`).not.toBeNull()
      expect(rail().contains(inv!), `invoicing outside the rail under ${structure}`).toBe(true)
    }
  })

  test('F4b: exactly ONE invoicing group exists, so there is one reader of the choice', async () => {
    for (const structure of ['twoPhase', 'single', 'hybrid'] as const) {
      await mount({ structure })
      const groups = host.querySelectorAll('[data-invoicing]')
      // two options, one group
      expect(groups.length, `${groups.length} invoicing radios under ${structure}`).toBe(2)
    }
  })

  test('F4c: it sits BENEATH the recovery radios, which is an order claim', async () => {
    await mount({ structure: 'twoPhase' })
    const radios = q('#deal-structure-toggle')!
    const inv = q('#deal-invoicing-toggle')!
    expect(radios.compareDocumentPosition(inv) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  test('F4d: the recovery period stays with them, in the rail', async () => {
    await mount({ structure: 'twoPhase' })
    expect(rail().contains(q('#deal-recovery-group'))).toBe(true)
    await mount({ structure: 'single' })
    expect(rail().contains(q('#deal-recovery-readonly'))).toBe(true)
  })
})

describe('F2: the radios share one gutter', () => {
  // The gutter itself is geometry and belongs to the live probe. What is
  // assertable here is that the rail's radio groups are built from ONE column
  // treatment, because two column classes would be two gutters by construction.
  test('F2a: recovery and invoicing use the same column treatment', async () => {
    await mount({ structure: 'twoPhase' })
    expect(q('#deal-structure-toggle')!.classList.contains('ring-radio-column')).toBe(true)
    expect(q('#deal-invoicing-toggle')!.classList.contains('ring-radio-column')).toBe(true)
  })
})
