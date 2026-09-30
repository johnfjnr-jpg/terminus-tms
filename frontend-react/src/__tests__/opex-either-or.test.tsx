// ── R-TL2: THE EITHER-OR, ENFORCED ON ENTRY ─────────────────────────────
//
// John's ruling 2026-09-30. Typing an OPEX fee clears that row's stored margin,
// and typing a margin clears that row's stored fee. The cleared cell then shows
// its DERIVED value at normal weight rather than an amber figure nobody chose.
//
// ── WHAT THIS IS FOR, MEASURED ──────────────────────────────────────────
//
// W-TL1 0.7. `TT-SGP-MANUFI-004` stores a fee of 500 AND a margin of 0 on the
// SafeSight row. R-O7's either-or was implemented as PRICING PRECEDENCE only -
// the absolute wins, which is correct - and the losing value was never cleared.
// So the margin cell went on rendering an amber 0, claiming somebody had chosen
// a margin, beside a fee that had overridden it. Measured: the stored 0 priced
// nothing at either fee.
//
// An amber cell asserts a decision. One that prices nothing is the estate's own
// wrong-green, on a pricing screen.
//
// ── ON ENTRY, IN `setValue`, NOT IN THE TABLE ───────────────────────────
//
// `setValue` already owns "typing this clears that": a fundamental input
// change clears every absolute override. R-TL2 is the same shape one row down,
// so it lives beside it rather than in the renderer, and it then holds for any
// surface that writes a value rather than only the one that has a table.
import { describe, test, expect } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { ShellProvider } from '../ShellContext'
import { shellServices } from '../shell-services'
import { DealPanel } from '../deal/DealPanel'
import type { UiState, Values } from '../deal/payload'
import { catalogApi } from './fixtures'

const UI: UiState = {
  installResp: 'Terminus Contractor - Lump Sum', structure: 'single', invoicing: 'monthly',
  grossUp: false, factoringEnabled: false, factoringMethod: 'straight',
  hostingPriceMode: 'margin', paymentMode: 'opex',
}

/** Both stored on the SafeSight row, which is the state the record carries. */
const VALUES: Values = {
  'deal-ssExisting': '11', 'deal-ssNew': '10', 'deal-aqm': '9', 'deal-hemir': '0',
  'deal-duration': '60', 'deal-targetMargin': '30', 'deal-warrantyPct': '0',
  'deal-lumpCost': '300000',
  'deal-ssUnitCost': '8000', 'deal-aqUnitCost': '2000', 'deal-hemirUnitCost': '100000',
  'deal-hoSafesight': '200', 'deal-hoAqm': '100', 'deal-hoHemir': '500',
  'deal-opexfee-ss': '500',
  'deal-opexmargin-ss': '0',
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
          <DealPanel initialValues={values} initialUi={UI} testBedCost={0} />
        </ShellProvider>
      </QueryClientProvider>)
  })
  await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
}

const cell = (id: string) => host.querySelector<HTMLInputElement>(`[data-testid="${id}"]`)
const valueOf = (id: string) => cell(id)?.value ?? '(absent)'
const overrideFlag = (id: string) => cell(id)?.dataset.override ?? '(absent)'

/** Drive the control the way a person does, through its own change handler. */
const type = async (id: string, v: string) => {
  const e = cell(id)
  if (!e) throw new Error(`no control ${id}`)
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  await act(async () => {
    setter.call(e, v)
    e.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

describe('R-TL2: a fee and a margin cannot both be stored on one row', () => {
  test('both are live before anything is typed, or this proves nothing', async () => {
    await mount()
    expect(valueOf('deal-opexfee-ss')).toBe('500')
    expect(valueOf('deal-opexmargin-ss')).toBe('0')
    expect(overrideFlag('deal-opexmargin-ss')).toBe('true')
  })

  /* ── WHAT "CLEARED" LOOKS LIKE ON SCREEN, AND WHAT IT DOES NOT ─────────
     A first draft of these tests asserted the cleared box renders EMPTY. It
     does not, and should not: the cell is `stored !== '' ? stored : derived`,
     so emptying the store makes it fall back to the DERIVED figure - which is
     exactly what the ruling asks for, "the cleared cell shows its derived value
     at normal weight".

     So the observable for "the store was cleared" is the OVERRIDE FLAG, which
     is set from `stored !== ''`, and the observable for "it still says what the
     margin is" is that a figure is rendered at all. Asserting an empty box
     would have been asserting the opposite of the ruling. */
  test('typing a FEE clears that row s stored margin', async () => {
    await mount()
    await type('deal-opexfee-ss', '700')
    expect(valueOf('deal-opexfee-ss')).toBe('700')
    expect(overrideFlag('deal-opexmargin-ss'), 'the margin is still stored').toBe('false')
  })

  test('and the cleared margin shows its DERIVED value at normal weight', async () => {
    await mount()
    const before = valueOf('deal-opexmargin-ss')
    await type('deal-opexfee-ss', '700')
    const after = valueOf('deal-opexmargin-ss')
    expect(before, 'the stored override was not live to begin with').toBe('0')
    expect(after, 'the cell went blank instead of showing the derived margin').not.toBe('')
    expect(after, 'the cell still shows the overridden figure').not.toBe('0')
    expect(Number(after), 'the derived margin is not a number').not.toBeNaN()
    expect(overrideFlag('deal-opexmargin-ss'), 'it is still dressed as an override').toBe('false')
  })

  test('typing a MARGIN clears that row s stored fee, the same way round', async () => {
    await mount()
    await type('deal-opexmargin-ss', '38')
    expect(valueOf('deal-opexmargin-ss')).toBe('38')
    expect(overrideFlag('deal-opexfee-ss'), 'the fee is still stored').toBe('false')
    expect(valueOf('deal-opexfee-ss'), 'the fee cell went blank').not.toBe('')
  })

  test('it is PER ROW: SafeSight s fee does not touch AQ Sensor s margin', async () => {
    await mount({ ...VALUES, 'deal-opexmargin-aq': '41' })
    expect(valueOf('deal-opexmargin-aq')).toBe('41')
    await type('deal-opexfee-ss', '700')
    expect(valueOf('deal-opexmargin-aq'), 'another row lost its override').toBe('41')
  })

  test('CLEARING a fee does not clear the margin', async () => {
    // Emptying a box is not choosing the other thing. A person deleting a fee
    // to go back to margin pricing must not lose the margin in the same motion.
    await mount()
    await type('deal-opexfee-ss', '')
    expect(valueOf('deal-opexmargin-ss'), 'clearing one box cleared the other').toBe('0')
  })
})
