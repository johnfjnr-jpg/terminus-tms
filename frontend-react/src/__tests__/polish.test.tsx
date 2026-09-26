// ── PAYMENT POLISH: M1, M3, M4, M5, M6, M7, M10, M11 ────────────────────
//
// Findings of THIS ROUND. `CLAUDE.md` carries method rulings under the same
// letters; these are the walk findings of 2026-09-26.
//
// Geometry is the live probe's: jsdom has no layout and loads no stylesheet,
// so "horizontal" and "sized for xx.x%" cannot be measured here and nothing
// below pretends to. What belongs here is what the markup IS, what is PRESENT
// and ABSENT, and document ORDER.
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
  'deal-recoveryMonths': '12',
}
let host: HTMLElement
const mount = async (ui: Partial<UiState> = {}, values: Partial<Values> = {}) => {
  window.api = catalogApi()
  document.body.innerHTML = '<div id="host"></div>'
  host = document.getElementById('host')!
  const root: Root = createRoot(host)
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  await act(async () => {
    root.render(
      <QueryClientProvider client={qc}>
        <ShellProvider services={shellServices}>
          <DealPanel initialValues={{ ...VALUES, ...values }} initialUi={{ ...UI, ...ui }} testBedCost={0} />
        </ShellProvider>
      </QueryClientProvider>)
  })
  await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
}
const q = (s: string) => host.querySelector(s)
const all = (s: string) => [...host.querySelectorAll(s)]
const mode = () => q('[data-testid="deal-payment-mode-toggle"]') as HTMLButtonElement

describe('M1: the mode control is CAPEX | toggle | OPEX', () => {
  test('M1a: three elements in that document order', async () => {
    await mount()
    const order = all('[data-testid="deal-mode-label-capex"], [data-testid="deal-payment-mode-toggle"],'
      + ' [data-testid="deal-mode-label-opex"]').map((e) => e.getAttribute('data-testid'))
    expect(order).toEqual([
      'deal-mode-label-capex', 'deal-payment-mode-toggle', 'deal-mode-label-opex'])
    expect(q('[data-testid="deal-mode-label-capex"]')!.textContent!.trim()).toBe('CAPEX')
    expect(q('[data-testid="deal-mode-label-opex"]')!.textContent!.trim()).toBe('OPEX')
  })

  test('M1b: OPEX active marks the RIGHT label, CAPEX active the LEFT', async () => {
    await mount({ paymentMode: 'opex' })
    expect((q('[data-testid="deal-mode-label-opex"]') as HTMLElement).dataset.active).toBe('true')
    expect((q('[data-testid="deal-mode-label-capex"]') as HTMLElement).dataset.active).toBe('false')
    await mount({ paymentMode: 'capex' })
    expect((q('[data-testid="deal-mode-label-capex"]') as HTMLElement).dataset.active).toBe('true')
    expect((q('[data-testid="deal-mode-label-opex"]') as HTMLElement).dataset.active).toBe('false')
  })

  test('M1c: `on` means OPEX, so the knob travels RIGHT for OPEX', async () => {
    // The knob's POSITION is the live probe's. What is assertable here is the
    // state the stylesheet keys off: `is-on` is OPEX, and OPEX is the right
    // label, so the estate's default travel (right when on) is already correct
    // and needs no inversion. The slider-direction round inverted it for a
    // control whose left label was the active one.
    await mount({ paymentMode: 'opex' })
    expect(mode().getAttribute('aria-checked')).toBe('true')
    expect(mode().classList.contains('is-on')).toBe(true)
    await mount({ paymentMode: 'capex' })
    expect(mode().getAttribute('aria-checked')).toBe('false')
    expect(mode().classList.contains('is-on')).toBe(false)
  })

  test('M1d: it is still the shared DealToggle, and the label is NOT inside it', async () => {
    await mount()
    expect(mode().dataset.dealToggle).toBe('true')
    expect(mode().textContent!.trim()).toBe('')
  })

  test('M1e: ON/OFF switches keep the label INSIDE', async () => {
    // The distinction John's ruling draws, asserted: a two-state selector takes
    // the flanking variant, an on/off switch does not.
    await mount()
    const fx = q('[data-testid="deal-factoring-toggle"]') as HTMLButtonElement
    expect(fx.dataset.dealToggle).toBe('true')
    expect(fx.textContent!.trim().length).toBeGreaterThan(0)
    expect(q('[data-testid="deal-factoring-label-left"]')).toBeNull()
  })
})

describe('M10: repayment method is the same two-sided control', () => {
  test('M10a: STRAIGHT-LINE | toggle | DECLINING BALANCE in that order', async () => {
    await mount({ factoringEnabled: true })
    const order = all('[data-testid="deal-method-label-straight"], [data-testid="deal-method-toggle"],'
      + ' [data-testid="deal-method-label-declining"]').map((e) => e.getAttribute('data-testid'))
    expect(order).toEqual([
      'deal-method-label-straight', 'deal-method-toggle', 'deal-method-label-declining'])
  })

  test('M10b: it is the shared DealToggle and marks the active side', async () => {
    await mount({ factoringEnabled: true, factoringMethod: 'declining' })
    const t = q('[data-testid="deal-method-toggle"]') as HTMLButtonElement
    expect(t.dataset.dealToggle).toBe('true')
    expect(t.getAttribute('aria-checked')).toBe('true')
    expect((q('[data-testid="deal-method-label-declining"]') as HTMLElement).dataset.active).toBe('true')
    expect((q('[data-testid="deal-method-label-straight"]') as HTMLElement).dataset.active).toBe('false')
    await mount({ factoringEnabled: true, factoringMethod: 'straight' })
    expect((q('[data-testid="deal-method-toggle"]') as HTMLButtonElement).getAttribute('aria-checked')).toBe('false')
    expect((q('[data-testid="deal-method-label-straight"]') as HTMLElement).dataset.active).toBe('true')
  })

  test('M10c: clicking it moves the stored method both ways', async () => {
    await mount({ factoringEnabled: true, factoringMethod: 'straight' })
    await act(async () => { (q('[data-testid="deal-method-toggle"]') as HTMLButtonElement).click() })
    expect((q('[data-testid="deal-method-label-declining"]') as HTMLElement).dataset.active).toBe('true')
    await act(async () => { (q('[data-testid="deal-method-toggle"]') as HTMLButtonElement).click() })
    expect((q('[data-testid="deal-method-label-straight"]') as HTMLElement).dataset.active).toBe('true')
  })
})

describe('M11: factoring fields are ABSENT when disabled', () => {
  test('M11a: disabled removes rate, term and method from the DOM', async () => {
    await mount({ factoringEnabled: false })
    // ABSENT is the claim, not disabled: a disabled control still answers a
    // query and still occupies the screen.
    expect(q('#deal-factoring-ratePct')).toBeNull()
    expect(q('#deal-factoring-termMonths')).toBeNull()
    expect(q('[data-testid="deal-method-toggle"]')).toBeNull()
    expect(q('#deal-factoring-fields')).toBeNull()
  })

  test('M11b: enabling restores all three with their values', async () => {
    await mount({ factoringEnabled: true, factoringMethod: 'declining' },
      { 'deal-factoring-ratePct': '2.5', 'deal-factoring-termMonths': '36' })
    expect((q('#deal-factoring-ratePct') as HTMLInputElement).value).toBe('2.5')
    expect((q('#deal-factoring-termMonths') as HTMLInputElement).value).toBe('36')
    expect((q('[data-testid="deal-method-label-declining"]') as HTMLElement).dataset.active).toBe('true')
  })
})

describe('M4, M6 and M3: the radios, the recovery period and the duration', () => {
  test('M4a: the vertical rail is retired', async () => {
    await mount()
    expect(q('#deal-payment-rail')).toBeNull()
    expect(q('#deal-payment-content')).toBeNull()
  })

  test('M4b: under CAPEX the radios are Two-phase and Hybrid, in one group', async () => {
    await mount()
    expect(all('#deal-structure-toggle [data-structure]').map((e) => (e as HTMLElement).dataset.structure))
      .toEqual(['twoPhase', 'hybrid'])
    // HORIZONTAL is geometry and is the live probe's. What is assertable is
    // that the column treatment is GONE, because a column class is a vertical
    // claim written into the markup.
    expect(q('#deal-structure-toggle')!.classList.contains('ring-radio-column')).toBe(false)
  })

  test('M6a: Recovery Period shows only when Two-phase is EXPLICITLY selected', async () => {
    await mount({ structure: 'twoPhase', structureChosen: true } as Partial<UiState>)
    expect(q('#deal-recovery-group')).not.toBeNull()
    expect(q('#deal-recovery-group')!.classList.contains('hidden')).toBe(false)
  })

  test('M6b: it is HIDDEN under Hybrid', async () => {
    await mount({ structure: 'hybrid', structureChosen: true } as Partial<UiState>)
    const g = q('#deal-recovery-group')
    expect(g === null || g.classList.contains('hidden')).toBe(true)
  })

  test('M6c: it is HIDDEN under the CAPEX default, until a selection is made', async () => {
    // M5 says the radio renders SELECTED under the default; M6 says the
    // recovery period stays hidden until somebody actually chooses. Those are
    // two different questions about one state and both are asserted.
    await mount({ structure: 'twoPhase', structureChosen: false } as Partial<UiState>)
    expect(all('#deal-structure-toggle .ring-radio.active')
      .map((e) => (e as HTMLElement).dataset.structure)).toEqual(['twoPhase'])
    const g = q('#deal-recovery-group')
    expect(g === null || g.classList.contains('hidden')).toBe(true)
  })

  test('M3a: under OPEX the period reads "Contract Duration", read-only', async () => {
    await mount({ paymentMode: 'opex' })
    const el = q('[data-testid="deal-contract-duration"]')
    expect(el).not.toBeNull()
    expect(el!.textContent).toMatch(/Contract Duration/i)
    // READ-ONLY: no input for it on this surface.
    expect(el!.querySelector('input')).toBeNull()
  })

  test('M3b: it reads the SAME stored field as Structural Terms, with no second store', async () => {
    await mount({ paymentMode: 'opex' }, { 'deal-duration': '48' })
    expect(q('[data-testid="deal-contract-duration-value"]')!.textContent).toMatch(/48/)
    // ONE STORE: `deal-duration` is the only control that writes it, and this
    // surface contributes no second one (Verification 20).
    expect(all('#deal-section-5 input#deal-duration, [data-testid="deal-contract-duration"] input').length).toBe(0)
  })

  test('M3c: under OPEX there is no recovery INPUT at all', async () => {
    await mount({ paymentMode: 'opex' })
    const g = q('#deal-recovery-group')
    expect(g === null || g.classList.contains('hidden')).toBe(true)
  })
})

describe('M7: the invoicing radios sit beneath the money', () => {
  test('M7a: under Two-phase invoicing follows the fee table in document order', async () => {
    await mount({ structure: 'twoPhase' })
    const sched = q('[data-testid="year-schedule"], [data-testid="hybrid-schedule"]')!
    const inv = q('#deal-invoicing-toggle')!
    expect(sched.compareDocumentPosition(inv) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  test('M7b: under Hybrid invoicing follows the hosting schedule', async () => {
    await mount({ structure: 'hybrid' })
    const sched = q('[data-testid="year-schedule"], [data-testid="hybrid-schedule"]')!
    const inv = q('#deal-invoicing-toggle')!
    expect(sched.compareDocumentPosition(inv) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  test('M7c: the ruled Option A survives, one hosting render per structure', async () => {
    for (const [paymentMode, structure] of [
      ['capex', 'twoPhase'], ['capex', 'hybrid'], ['opex', 'twoPhase'], ['opex', 'hybrid'],
    ] as const) {
      await mount({ paymentMode, structure })
      const n = all('[data-testid="year-schedule"], [data-testid="hybrid-schedule"]').length
      expect(n, `${paymentMode}/${structure} rendered ${n}`).toBe(1)
    }
    await mount({ structure: 'hybrid' })
    const grid = q('#deal-hybrid-group')!
    expect(grid.querySelector('#deal-milestones-tbody')).not.toBeNull()
    expect(grid.querySelector('[data-testid="hybrid-schedule"], [data-testid="year-schedule"]')).not.toBeNull()
  })
})

describe('M5: the CAPEX default, asserted rather than assumed', () => {
  test('M5a: both readers default an absent structure to twoPhase', async () => {
    // The default lives in TWO places. They agree, and this is what makes that
    // a fact rather than a coincidence of writing (Verification 20).
    const { uiFromPayload } = await import('../deal/payload')
    expect(uiFromPayload({}).structure).toBe('twoPhase')
    const { buildDealInputs } = await import('../../../src/lib/deal-inputs.js') as
      { buildDealInputs: (p: unknown, o: unknown) => { structure: string } }
    expect(buildDealInputs({}, { testBedCost: 0, rates: {} }).structure).toBe('twoPhase')
  })

  test('M5b: an absent structure renders Two-phase selected, never single', async () => {
    const { uiFromPayload } = await import('../deal/payload')
    const ui = uiFromPayload({})
    await mount({ ...ui, structureChosen: false } as Partial<UiState>)
    expect(all('#deal-structure-toggle .ring-radio.active')
      .map((e) => (e as HTMLElement).dataset.structure)).toEqual(['twoPhase'])
    expect(q('[data-structure="single"]')).toBeNull()
  })
})
