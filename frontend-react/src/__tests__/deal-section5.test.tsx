// ── SECTION 5: PAYMENT TERMS ─────────────────────────────────────────────
//
// Behaviours enumerated from the vanilla before anything was built:
// updateStructureButtons (:1686), updateStructureVisibility (:1697),
// updateInvoicingButtons (:1706), updateFactoringButtons (:1712) and the
// recovery readonly value (:912).
//
//  P1  a ring radio carries `active` when its data-structure is the choice
//  P2  the top schedule row is hidden under hybrid
//  P3  so is the invoicing group: hybrid brings its own
//  P4  the recovery INPUT shows only under twoPhase
//  P5  the recovery READONLY shows only under single, and reads the duration
//      or says it is not set, because a blank duration is not zero months
//  P6  the hybrid group shows only under hybrid
//  P7  both invoicing groups mark the same choice
//  P8  the factoring switch says its state and what a click will do
//  P9  the factoring fields are hidden until factoring is on
//  P10 the repayment method toggle marks the chosen method
import { describe, test, expect } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ShellProvider } from '../ShellContext'
import { shellServices } from '../shell-services'
import { DealPanel } from '../deal/DealPanel'
import { catalogApi } from './fixtures'
import type { UiState, Values } from '../deal/payload'

declare global {
  interface Window { api?: (m: string, p: string, b?: unknown) => Promise<unknown> }
}
const UI: UiState = {
  installResp: 'Terminus Contractor - Per Unit', structure: 'twoPhase', invoicing: 'annual',
  grossUp: false, factoringEnabled: false, factoringMethod: 'straight',
  hostingPriceMode: 'margin',
}
const VALUES: Values = {
  'deal-ssExisting': '40', 'deal-aqm': '12', 'deal-duration': '36',
  'deal-targetMargin': '30', 'deal-recoveryMonths': '24',
}
let host: HTMLElement
const mount = async (ui: Partial<UiState> = {}, values: Values = VALUES) => {
  window.api = catalogApi()
  document.body.innerHTML = '<div id="host"></div>'
  host = document.getElementById('host')!
  const root: Root = createRoot(host)
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  await act(async () => {
    root.render(
      <QueryClientProvider client={qc}>
        <ShellProvider services={shellServices}>
          <DealPanel initialValues={values} initialUi={{ ...UI, ...ui }} testBedCost={25000} />
        </ShellProvider>
      </QueryClientProvider>)
  })
  await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
}
const el = (id: string) => host.querySelector(`#${id}`) as HTMLElement | null
const must = (id: string) => { const e = el(id); if (!e) throw new Error(`no #${id}`); return e }
const hidden = (id: string) => must(id).classList.contains('hidden')

describe('the payment terms structure', () => {
  test('the region, the column and the card exist', async () => {
    await mount()
    expect(host.querySelector('.deal-payment-region')).not.toBeNull()
    const col = host.querySelector('.deal-payment-col')!
    expect(col.classList.contains('payment-terms-panel')).toBe(true)
    expect(col.querySelector('.payment-card')).not.toBeNull()
    expect(host.querySelector('.po-factoring-panel')).not.toBeNull()
  })

  test('a ring radio is a ring, a dot and a label, three times over', async () => {
    await mount()
    const radios = [...must('deal-structure-toggle').querySelectorAll('.ring-radio')]
    expect(radios).toHaveLength(3)
    for (const r of radios) {
      expect(r.querySelector('.ring-radio-ring')).not.toBeNull()
      expect(r.querySelector('.ring-radio-ring .ring-radio-dot')).not.toBeNull()
      expect(r.querySelector('.ring-radio-label')!.textContent).not.toBe('')
    }
    expect(radios.map((r) => (r as HTMLElement).dataset.structure))
      .toEqual(['single', 'twoPhase', 'hybrid'])
  })
})

describe('the choices mark themselves', () => {
  test('P1: exactly the chosen structure is active, and clicking moves it', async () => {
    await mount({ structure: 'twoPhase' })
    const active = () => [...must('deal-structure-toggle').querySelectorAll('.ring-radio.active')]
      .map((r) => (r as HTMLElement).dataset.structure)
    expect(active()).toEqual(['twoPhase'])
    await act(async () => {
      (must('deal-structure-toggle').querySelector('[data-structure="hybrid"]') as HTMLElement).click()
    })
    expect(active()).toEqual(['hybrid'])
  })

  test('P7: BOTH invoicing groups mark the same choice', async () => {
    await mount({ structure: 'hybrid', invoicing: 'monthly' })
    for (const group of ['deal-invoicing-toggle', 'deal-hybrid-invoicing-toggle']) {
      const active = [...must(group).querySelectorAll('.ring-radio.active')]
        .map((r) => (r as HTMLElement).dataset.invoicing)
      expect(active, group).toEqual(['monthly'])
    }
  })

  test('P10: the repayment method toggle marks the chosen method', async () => {
    await mount({ factoringEnabled: true, factoringMethod: 'declining' })
    const btns = [...must('deal-factoring-method-toggle').querySelectorAll('button')]
    expect(btns.map((b) => b.dataset.method)).toEqual(['straight', 'declining'])
    expect(btns.filter((b) => b.classList.contains('active')).map((b) => b.dataset.method))
      .toEqual(['declining'])
  })
})

describe('what each structure shows', () => {
  test('P2/P3/P4/P6: twoPhase shows the recovery input and the invoicing radios', async () => {
    await mount({ structure: 'twoPhase' })
    expect(hidden('deal-top-schedule-row')).toBe(false)
    expect(hidden('deal-invoicing-toggle')).toBe(false)
    expect(hidden('deal-recovery-group')).toBe(false)
    expect(hidden('deal-recovery-readonly')).toBe(true)
    expect(hidden('deal-hybrid-group')).toBe(true)
  })

  test('hybrid brings its own schedule and hides the top row', async () => {
    await mount({ structure: 'hybrid' })
    expect(hidden('deal-top-schedule-row')).toBe(true)
    expect(hidden('deal-invoicing-toggle')).toBe(true)
    expect(hidden('deal-hybrid-group')).toBe(false)
  })

  test('P5: single shows the recovery as a READOUT, and it reads the duration', async () => {
    await mount({ structure: 'single' })
    expect(hidden('deal-recovery-group')).toBe(true)
    expect(hidden('deal-recovery-readonly')).toBe(false)
    expect(must('deal-recovery-readonly-value').textContent).toBe('36 months')
  })

  test('and says the duration is not set rather than showing zero months', async () => {
    // A blank duration is not zero months. The readout has its own wording for
    // the absence, because the figure it replaces is one somebody prices on.
    await mount({ structure: 'single' }, { ...VALUES, 'deal-duration': '' })
    expect(must('deal-recovery-readonly-value').textContent).toBe('Contract duration not set')
  })
})

describe('the factoring switch', () => {
  test('P8/P9: off says so, and hides its fields', async () => {
    await mount({ factoringEnabled: false })
    const sw = must('deal-factoring-toggle')
    expect(sw.textContent).toBe('Factoring disabled')
    expect(sw.getAttribute('role')).toBe('switch')
    expect(sw.getAttribute('aria-checked')).toBe('false')
    expect(sw.classList.contains('is-on')).toBe(false)
    expect(sw.title).toContain('Click to turn it on')
    expect(hidden('deal-factoring-fields')).toBe(true)
  })

  test('and on says so, and shows them', async () => {
    await mount({ factoringEnabled: true })
    const sw = must('deal-factoring-toggle')
    expect(sw.textContent).toBe('Factoring enabled')
    expect(sw.getAttribute('aria-checked')).toBe('true')
    expect(sw.classList.contains('is-on')).toBe(true)
    expect(sw.title).toContain('Click to turn it off')
    expect(hidden('deal-factoring-fields')).toBe(false)
    // The two labelled inputs live inside the revealed field, and their labels
    // point at them: an input that loses its id stops being focused by its
    // label, silently.
    for (const id of ['deal-factoring-ratePct', 'deal-factoring-termMonths']) {
      expect(must(id).closest('#deal-factoring-fields'), id).not.toBeNull()
      expect(host.querySelector(`label[for="${id}"]`), id).not.toBeNull()
    }
  })
})

// ──────────────────────────────────────────────────────────────────────
// R-W12: THE CUSTOMER MILESTONE COLUMN IS THE PROTOTYPE'S DROPDOWN
//
// Written from the ruling: "the customer payment-terms milestone column
// becomes the prototype's dropdown, sourced from the SAME constant the
// contractor grid uses (one source, both grids), including the keep-unknown-
// stored-value behaviour."
//
// ONE SOURCE IS ASSERTED AS AN EQUALITY BETWEEN THE TWO GRIDS, not as each
// matching a list typed into this file. A test carrying its own copy of the
// six names would be a third reader of the vocabulary and would agree with
// nothing when somebody changed it.
// ──────────────────────────────────────────────────────────────────────

describe('R-W12: the customer milestone column', () => {
  const HYBRID = { structure: 'hybrid' }

  test('it is a SELECT, not a free-text box', async () => {
    await mount(HYBRID)
    const cell = must('deal-ms-0-label')
    expect(cell.tagName).toBe('SELECT')
  })

  test('and it offers the prototype\'s six names plus the placeholder', async () => {
    await mount(HYBRID)
    const opts = [...(must('deal-ms-0-label') as HTMLSelectElement).options].map((o) => o.text)
    expect(opts[0]).toBe('Select milestone')
    expect(opts).toContain('Contract start')
    expect(opts).toContain('Hardware delivered to site')
    expect(opts).toContain('Final acceptance')
    expect(opts).toHaveLength(7)
  })

  test('ONE SOURCE: the customer grid offers exactly what the contractor grid offers', async () => {
    await mount({ ...HYBRID, installResp: 'Terminus Contractor - Lump Sum' })
    const cust = [...(must('deal-ms-0-label') as HTMLSelectElement).options].map((o) => o.text)
    const cont = [...(must('deal-cm-0-label') as HTMLSelectElement).options].map((o) => o.text)
    expect(cust, 'the two grids offer different milestone names').toEqual(cont)
    // Non-vacuous: both lists must actually hold something.
    expect(cust.length).toBeGreaterThan(1)
  })

  test('a stored value outside the list KEEPS ITS OWN OPTION rather than vanishing', async () => {
    // The behaviour that makes this safe on deals entered before the dropdown
    // existed. Without it the select would show the placeholder and the next
    // save would quietly discard what somebody typed.
    await mount(HYBRID, { ...VALUES, 'deal-ms-0-label': 'Something nobody standardised' })
    const sel = must('deal-ms-0-label') as HTMLSelectElement
    expect(sel.value).toBe('Something nobody standardised')
    const opts = [...sel.options].map((o) => o.text)
    expect(opts.some((t) => /Something nobody standardised/.test(t)),
      'the stored value lost its option').toBe(true)
    expect(opts.some((t) => /not in the list/.test(t)),
      'the unknown option does not say it is unknown').toBe(true)
  })

  test('and a recognised stored value does NOT get the unknown marker', async () => {
    // The pair that makes the test above mean something: without it, a marker
    // on every option would pass it just as well.
    await mount(HYBRID, { ...VALUES, 'deal-ms-0-label': 'Go live' })
    const opts = [...(must('deal-ms-0-label') as HTMLSelectElement).options].map((o) => o.text)
    expect(opts.some((t) => /not in the list/.test(t))).toBe(false)
    expect(opts).toHaveLength(7)
  })
})
