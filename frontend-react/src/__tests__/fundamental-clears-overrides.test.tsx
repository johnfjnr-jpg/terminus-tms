// ── H3 (R-REV): A FUNDAMENTAL INPUT CHANGE RETURNS LINES TO THE DERIVATION ─
//
// Phase 0 measured the defect on the live screen: a price override and a
// hosting fee override both SURVIVED a unit count change, and kept their amber,
// so the screen went on claiming somebody had chosen a figure for a quantity
// that had changed underneath it.
//
// John's ruling: the ABSOLUTE overrides clear, the MARGIN overrides persist,
// because a ratio remains a decision when the quantity moves and a figure does
// not.
//
// Written before the fix, red first.
import { describe, test, expect } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { ShellProvider } from '../ShellContext'
import { shellServices } from '../shell-services'
import { DealPanel } from '../deal/DealPanel'
import type { UiState, Values } from '../deal/payload'
import { catalogApi } from './fixtures'
import { useDealForm } from '../deal/useDealForm'

let writeSame: (() => void) | null = null

declare global {
  interface Window { api?: (m: string, p: string, b?: unknown) => Promise<unknown> }
}

const UI: UiState = {
  installResp: 'Terminus Contractor - Lump Sum', structure: 'twoPhase', invoicing: 'annual',
  grossUp: false, factoringEnabled: false, factoringMethod: 'straight',
  hostingPriceMode: 'margin', paymentMode: 'capex',
}
// THREE OVERRIDES STORED: one absolute price, one absolute fee, one margin.
// All three non-empty, so "it cleared" cannot pass by the box having been
// empty to begin with.
const VALUES: Values = {
  'deal-ssExisting': '40', 'deal-ssNew': '25', 'deal-aqm': '12', 'deal-hemir': '8',
  'deal-duration': '36', 'deal-targetMargin': '30', 'deal-warrantyPct': '12',
  'deal-lumpCost': '200000',
  'deal-ssUnitCost': '1000', 'deal-aqUnitCost': '800', 'deal-hemirUnitCost': '1200',
  'deal-hoSafesight': '10', 'deal-hoAqm': '8', 'deal-hoHemir': '12',
  'deal-price-hwSs': '500000',
  'deal-hofee-hoSs': '99',
  'deal-margin-hwAqm': '44',
}

let host: HTMLElement
const mount = async (values: Values = VALUES) => {
  window.api = catalogApi()
  document.body.innerHTML = '<div id="host"></div>'
  host = document.getElementById('host')!
  const root: Root = createRoot(host)
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  await act(async () => {
    root.render(
      <QueryClientProvider client={qc}>
        <ShellProvider services={shellServices}>
          <DealPanel initialValues={values} initialUi={UI} testBedCost={25000} />
        </ShellProvider>
      </QueryClientProvider>)
  })
  await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
}

/** Drive a control the way the form does, through its own change handler. */
const setInput = async (id: string, v: string) => {
  const e = host.querySelector<HTMLInputElement>(`[id="${id}"]`)
    ?? host.querySelector<HTMLInputElement>(`[data-testid="stmt-edit-${id}"]`)
  if (!e) throw new Error(`no control ${id}`)
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  await act(async () => {
    setter.call(e, v)
    e.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
const boxValue = (id: string) => {
  const e = host.querySelector<HTMLInputElement>(`[data-testid="stmt-edit-${id}"]`)
    ?? host.querySelector<HTMLInputElement>(`[id="${id}"]`)
  return e ? e.value : '(absent)'
}
const overrideFlag = (id: string) =>
  host.querySelector<HTMLInputElement>(`[data-testid="stmt-edit-${id}"]`)?.dataset.override ?? '(absent)'

describe('H3: a fundamental input change clears the ABSOLUTE overrides', () => {
  test('H3a: the three overrides are live before anything is touched', async () => {
    await mount()
    // Verification 14: a test that only ever asserts absence would pass just as
    // well on a panel that never held an override at all.
    expect(boxValue('deal-price-hwSs')).toBe('500000')
    expect(boxValue('deal-hofee-hoSs')).toBe('99')
    expect(boxValue('deal-margin-hwAqm')).toBe('44')
    expect(overrideFlag('deal-price-hwSs')).toBe('true')
  })

  test('H3b: a unit count change clears the price and the fee', async () => {
    await mount()
    await setInput('deal-ssExisting', '55')
    expect(boxValue('deal-price-hwSs')).not.toBe('500000')
    expect(boxValue('deal-hofee-hoSs')).not.toBe('99')
  })

  test('H3c: and the MARGIN override survives, because a ratio is still a decision', async () => {
    await mount()
    await setInput('deal-ssExisting', '55')
    expect(boxValue('deal-margin-hwAqm')).toBe('44')
  })

  test('H3d: the amber goes out on the cleared lines, immediately', async () => {
    await mount()
    expect(overrideFlag('deal-price-hwSs')).toBe('true')
    await setInput('deal-ssExisting', '55')
    expect(overrideFlag('deal-price-hwSs')).toBe('false')
    expect(overrideFlag('deal-hofee-hoSs')).toBe('false')
    // and stays on the margin
    expect(overrideFlag('deal-margin-hwAqm')).toBe('true')
  })

  test('H3e: every one of the four counts is fundamental', async () => {
    for (const id of ['deal-ssExisting', 'deal-ssNew', 'deal-aqm', 'deal-hemir']) {
      await mount()
      await setInput(id, '77')
      expect(boxValue('deal-price-hwSs'), `${id} did not clear the price`).not.toBe('500000')
    }
  })

  test('H3f: so is an input the derivation multiplies a quantity by', async () => {
    // Duration multiplies hosting months; the warranty percentage multiplies
    // the unit count to produce warranty units. Both move a derived price for
    // a quantity, which is what the ruling names.
    for (const id of ['deal-duration', 'deal-warrantyPct']) {
      await mount()
      await setInput(id, '48')
      expect(boxValue('deal-price-hwSs'), `${id} did not clear the price`).not.toBe('500000')
    }
  })

  test('H3g: a NON-fundamental edit clears nothing', async () => {
    // The other direction, and the one that makes the rule a rule: a rate, a
    // tax or a target margin is not a quantity, so an override stays a
    // decision.
    await mount()
    await setInput('deal-targetMargin', '35')
    expect(boxValue('deal-price-hwSs')).toBe('500000')
    expect(boxValue('deal-hofee-hoSs')).toBe('99')
    expect(boxValue('deal-margin-hwAqm')).toBe('44')
  })

  test('H3h: and writing back the SAME count clears nothing', async () => {
    // ── THIS TEST WAS DECORATIVE AND A SILENT INJECTION SAID SO ──────────
    //
    // Written first against the panel, it dispatched a synthetic input event
    // carrying the value the box already held. React's per-input value tracker
    // DEDUPES exactly that, so the change handler was never called and the
    // guard under test was never reached: removing the guard altogether left
    // this green.
    //
    // The claim is about what `setValue` does with an unchanged value, and the
    // thing that holds the value is the FORM, not the box. So it is driven
    // there - which is also the only place the real hazard lives, a caller
    // writing back a value nobody edited.
    const seen: string[] = []
    function Probe() {
      const form = useDealForm(VALUES, {} as never, 0, UI)
      writeSame = () => form.setValue('deal-ssExisting', VALUES['deal-ssExisting']!)
      seen.push(form.values['deal-price-hwSs'] ?? '')
      return null
    }
    document.body.innerHTML = '<div id="h2"></div>'
    const r = createRoot(document.getElementById('h2')!)
    await act(async () => { r.render(<Probe />) })
    expect(seen.at(-1)).toBe('500000')
    await act(async () => { writeSame!() })
    expect(seen.at(-1), 'writing the value it already held threw the override away').toBe('500000')
  })
})
