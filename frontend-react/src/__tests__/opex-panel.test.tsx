// ── R-OX1, R-OX2, R-OX4, R-OX5: THE OPEX TABLE ON THE SCREEN ────────────
//
// The switch, the table it reveals, the either-or, and R-REV.
// Written before the panel was built.
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
  'deal-ssUnitCost': '8000', 'deal-aqUnitCost': '2000', 'deal-hemirUnitCost': '100000',
  'deal-hoSafesight': '200', 'deal-hoAqm': '100', 'deal-hoHemir': '500',
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
          <DealPanel initialValues={values} initialUi={{ ...UI, ...ui }} testBedCost={0} />
        </ShellProvider>
      </QueryClientProvider>)
  })
  await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
}
const el = (id: string) => host.querySelector<HTMLElement>(`[data-testid="${id}"]`)
const must = (id: string) => { const e = el(id); if (!e) throw new Error(`no ${id}`); return e }
const box = (id: string) => must(id) as HTMLInputElement
const click = async (id: string) => { await act(async () => { must(id).click() }) }
const type = async (id: string, v: string) => {
  const e = box(id)
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  await act(async () => { set.call(e, v); e.dispatchEvent(new Event('input', { bubbles: true })) })
}

describe('R-OX1: the switch', () => {
  test('O1: it wears the same dress as the factoring toggle', async () => {
    await mount()
    const s = must('deal-payment-mode-toggle')
    const fx = must('deal-factoring-toggle')
    // The ROLE and the treatment, not a copied literal: a switch that looks
    // like a button is a different control to a screen reader.
    expect(s.getAttribute('role')).toBe('switch')
    expect(s.className).toBe(fx.className.replace(' is-on', ''))
    expect(s.getAttribute('title')?.length).toBeGreaterThan(0)
  })

  test('O2: it says its state, and a click changes it', async () => {
    await mount()
    expect(must('deal-payment-mode-toggle').textContent).toMatch(/CAPEX/i)
    await click('deal-payment-mode-toggle')
    expect(must('deal-payment-mode-toggle').textContent).toMatch(/OPEX/i)
    expect(must('deal-payment-mode-toggle').getAttribute('aria-checked')).toBe('true')
  })

  test('O3: CAPEX shows the recovery choice and no OPEX table', async () => {
    await mount()
    expect(el('deal-opex-table')).toBeNull()
    expect(host.querySelector('#deal-structure-toggle')).not.toBeNull()
  })

  test('O4: OPEX locks the structure to single phase', async () => {
    await mount({ paymentMode: 'opex' })
    const picked = host.querySelector('#deal-structure-toggle [aria-checked="true"], #deal-structure-toggle .is-on')
    expect(picked?.getAttribute('data-structure') ?? '').toBe('single')
  })
})

describe('R-OX2: the table', () => {
  test('O5: three rows, in the sketch\'s order, with the ruled headings', async () => {
    await mount({ paymentMode: 'opex' })
    const t = must('deal-opex-table')
    const heads = [...t.querySelectorAll('th')].map((h) => h.textContent!.trim())
    expect(heads).toEqual(['', '# of Units', 'Monthly Fee', 'Margin %', 'Contract Total'])
    const labels = [...t.querySelectorAll('tbody tr')].map((r) => r.querySelector('td')!.textContent!.trim())
    expect(labels).toEqual(['SafeSight', 'AQ Sensor', 'HEMIR'])
  })

  test('O6: the units column carries the deal\'s own counts', async () => {
    await mount({ paymentMode: 'opex' })
    // SafeSight's cell is a READOUT of the row total, because the row has two
    // stored counts and this column has one box. AQ and HEMIR edit theirs.
    expect(must('deal-opexunits-ss').textContent!.trim()).toBe('32')
    expect(box('deal-opexunits-aq').value).toBe('4')
    expect(box('deal-opexunits-hemir').value).toBe('3')
  })

  test('O7: every derived cell is populated, none blank', async () => {
    await mount({ paymentMode: 'opex' })
    for (const k of ['ss', 'aq', 'hemir']) {
      expect(box(`deal-opexfee-${k}`).value, `fee ${k}`).not.toBe('')
      expect(box(`deal-opexmargin-${k}`).value, `margin ${k}`).not.toBe('')
      expect(must(`deal-opextotal-${k}`).textContent!.trim(), `total ${k}`).not.toBe('')
    }
  })
})

describe('R-OX4 and R-OX5: the either-or, the amber, and the clear', () => {
  test('O8: a typed fee stores and wears both signals', async () => {
    await mount({ paymentMode: 'opex' })
    await type('deal-opexfee-ss', '2500')
    expect(box('deal-opexfee-ss').dataset.override).toBe('true')
    expect(box('deal-opexfee-ss').className).toContain('stmt-edit-override')
  })

  test('O9: and the MARGIN rederives from it rather than staying put', async () => {
    await mount({ paymentMode: 'opex' })
    const before = box('deal-opexmargin-ss').value
    await type('deal-opexfee-ss', '9999')
    expect(box('deal-opexmargin-ss').value).not.toBe(before)
  })

  test('O10: a typed margin rederives the fee, which is the other direction', async () => {
    await mount({ paymentMode: 'opex' })
    const before = box('deal-opexfee-ss').value
    await type('deal-opexmargin-ss', '55')
    expect(box('deal-opexfee-ss').value).not.toBe(before)
  })

  test('O11: R-REV clears the FEE on a count change and keeps the MARGIN', async () => {
    await mount({ paymentMode: 'opex' })
    await type('deal-opexfee-aq', '900')
    await type('deal-opexmargin-hemir', '44')
    await type('deal-ssExisting', '30')
    expect(box('deal-opexfee-aq').dataset.override).toBe('false')
    expect(box('deal-opexmargin-hemir').value).toBe('44')
  })

  test('O12: the units column edits the SAME store as the rest of the estate', async () => {
    await mount({ paymentMode: 'opex' })
    await type('deal-opexunits-aq', '9')
    const shared = host.querySelector<HTMLInputElement>('[id="deal-aqm"]')
    expect(shared?.value).toBe('9')
  })
})
