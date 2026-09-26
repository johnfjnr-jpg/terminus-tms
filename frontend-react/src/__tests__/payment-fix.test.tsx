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

  /* ── RE-TAKEN BY M1, 2026-09-26, AND THE OLD CLAIM IS QUOTED ────────────
     F1b read: "they wear the same dress", comparing the two class lists
     exactly, and "the mode control carries no size override".

     The second half stands and is kept: `.opex-slider` is gone and stays gone.
     The FIRST half cannot survive John's ruling, because the ruling is that
     these are two KINDS of control: a two-state selector carries
     `deal-toggle--flanked` and an on/off switch does not. An identical class
     list would now mean the distinction had not been made.

     So the claim becomes what it was always reaching for: ONE COMPONENT, one
     base dress, and the only difference between them is the variant. */
  test('F1b: one base dress, and the only difference is the declared variant', async () => {
    await mount()
    const base = (b: HTMLButtonElement) =>
      [...b.classList].filter((c) => c !== 'is-on' && c !== 'deal-toggle--flanked').sort().join(' ')
    expect(base(mode())).toBe(base(factoring()))
    expect(mode().classList.contains('opex-slider')).toBe(false)
    // and the variant IS declared, rather than the two differing by accident
    expect(mode().classList.contains('deal-toggle--flanked')).toBe(true)
    expect(factoring().classList.contains('deal-toggle--flanked')).toBe(false)
  })

  /* ── SUPERSEDED BY M1, 2026-09-26. The claim is INVERTED, deliberately ──
     F1c asserted the state was named INSIDE the button and that the flanking
     labels were absent, on the reasoning that flanking labels are what made
     the two controls different sizes. That reasoning was correct and is no
     longer decisive: John's ruling separates a two-state SELECTOR, which names
     both states outside, from an on/off SWITCH, which names its one state
     inside. The polish round's M1a to M1e assert the new shape in full; what is
     kept here is the half of F1c that survives, which is that the factoring
     toggle still names its state inside itself. */
  test('F1c, as superseded by M1: the ON/OFF switch still names its state inside', async () => {
    /* EXACT, not a substring. The first version asserted `toMatch(/FACTORING/)`
       and a calibration injection renaming the label came back SILENT with
       ZERO failures - a substring that cannot fail (Verification 17). */
    await mount({ factoringEnabled: false })
    expect(factoring().textContent!.trim()).toBe('Factoring disabled')
    await mount({ factoringEnabled: true })
    expect(factoring().textContent!.trim()).toBe('Factoring enabled')
    // and it takes NO flanking labels, which is the distinction M1 draws
    expect(q('[data-testid="deal-factoring-label-left"]')).toBeNull()
  })

  test('F1d: it is still a switch and still says what a click will do', async () => {
    await mount({ paymentMode: 'opex' })
    expect(mode().getAttribute('role')).toBe('switch')
    expect(mode().getAttribute('aria-checked')).toBe('true')
    expect(mode().getAttribute('title')).toBeTruthy()
  })
})

describe('F4: the invoicing radios join the rail', () => {
  /* ── RE-TAKEN BY M7, 2026-09-26. The rail is retired, so "inside the rail"
     has no subject. F4's real claim was that there is ONE invoicing group and
     it is on this surface; M7 then rules WHERE, which is beneath the money.
     The position is asserted in the polish round's M7a and M7b; what stands
     here is that the group exists, once, in every structure. */
  test('F4a, as re-taken by M7: one invoicing group, in every structure', async () => {
    for (const structure of ['twoPhase', 'single', 'hybrid'] as const) {
      await mount({ structure })
      const inv = q('#deal-invoicing-toggle')
      expect(inv, `invoicing missing under ${structure}`).not.toBeNull()
      expect(host.querySelectorAll('#deal-invoicing-toggle').length).toBe(1)
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

  /* ── RE-TAKEN BY M6 AND M3. The rail is gone; both readouts are in the card.
     M6 then adds that the recovery INPUT appears only on a CHOSEN Two-phase,
     and M3 renames the single-phase readout to Contract Duration, because that
     is what it always showed. */
  test('F4d, as re-taken by M6 and M3: both live in the payment card', async () => {
    const card = () => host.querySelector('.payment-card')!
    await mount({ structure: 'twoPhase' })
    expect(card().contains(q('#deal-recovery-group'))).toBe(true)
    await mount({ structure: 'single' })
    expect(card().contains(q('[data-testid="deal-contract-duration"]'))).toBe(true)
  })
})

describe('F2: the radios share one gutter', () => {
  // The gutter itself is geometry and belongs to the live probe. What is
  // assertable here is that the rail's radio groups are built from ONE column
  // treatment, because two column classes would be two gutters by construction.
  /* ── SUPERSEDED BY M4: the radios return to HORIZONTAL. F2's gutter was a
     property of the vertical COLUMN - three labels of three widths centred by
     an inherited `align-items: center` gave three left edges. A horizontal row
     has no such gutter to share, so the claim does not survive its subject.

     What replaces it is the same intent one level up: both groups are the SAME
     treatment, so a change to one cannot leave the other behind. */
  test('F2a, as superseded by M4: both groups are the same (horizontal) treatment', async () => {
    await mount({ structure: 'twoPhase' })
    for (const id of ['#deal-structure-toggle', '#deal-invoicing-toggle']) {
      expect(q(id)!.classList.contains('ring-radio-group'), id).toBe(true)
      expect(q(id)!.classList.contains('ring-radio-column'), id).toBe(false)
    }
  })
})
