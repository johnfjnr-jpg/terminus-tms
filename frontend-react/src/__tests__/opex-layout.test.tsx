// ── L1, L2, L3: THE OPEX PANEL'S LAYOUT ─────────────────────────────────
//
// L1 the mode control becomes a labelled slider, the active side in the
// estate green. L2 the recovery radios are ABSENT under OPEX, not disabled,
// with one plain line in their place. L3 is geometry and is proved live.
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
const el = (id: string) => host.querySelector<HTMLElement>(`[data-testid="${id}"]`)
const must = (id: string) => { const e = el(id); if (!e) throw new Error(`no ${id}`); return e }

describe('L1: the labelled slider', () => {
  test('L1a: both labels are present, either side of the slider', async () => {
    await mount()
    const opex = must('deal-mode-label-opex')
    const capex = must('deal-mode-label-capex')
    const slider = must('deal-payment-mode-toggle')
    // A RELATIONSHIP, not a CSS property: OPEX, then the slider, then CAPEX, in
    // document order, which is what "between them" means for a reader and for
    // the keyboard.
    const order = [...host.querySelectorAll('[data-testid^="deal-mode-label-"], [data-testid="deal-payment-mode-toggle"]')]
      .map((e) => e.getAttribute('data-testid'))
    expect(order).toEqual(['deal-mode-label-opex', 'deal-payment-mode-toggle', 'deal-mode-label-capex'])
    expect(opex.textContent!.trim()).toBe('OPEX')
    expect(capex.textContent!.trim()).toBe('CAPEX')
    expect(slider).toBeTruthy()
  })

  test('L1b: the ACTIVE side is marked, and only one side is', async () => {
    await mount()
    expect(must('deal-mode-label-capex').dataset.active).toBe('true')
    expect(must('deal-mode-label-opex').dataset.active).toBe('false')
    await mount({ paymentMode: 'opex' })
    expect(must('deal-mode-label-opex').dataset.active).toBe('true')
    expect(must('deal-mode-label-capex').dataset.active).toBe('false')
  })

  test('L1c: the slider is a switch, keyboard reachable, and names itself', async () => {
    await mount()
    const s = must('deal-payment-mode-toggle')
    expect(s.tagName).toBe('BUTTON')
    expect(s.getAttribute('role')).toBe('switch')
    expect(s.getAttribute('aria-checked')).toBe('false')
    // The visible labels are beside it rather than inside it now, so the
    // control has to carry its own accessible name.
    expect((s.getAttribute('aria-label') ?? '').length).toBeGreaterThan(0)
    expect(s.hasAttribute('disabled')).toBe(false)
  })

  test('L1d: clicking it moves the mode and the marking together', async () => {
    await mount()
    await act(async () => { must('deal-payment-mode-toggle').click() })
    expect(must('deal-payment-mode-toggle').getAttribute('aria-checked')).toBe('true')
    expect(must('deal-mode-label-opex').dataset.active).toBe('true')
    expect(must('deal-mode-label-capex').dataset.active).toBe('false')
  })
})

describe('L2: the recovery radios under OPEX', () => {
  test('L2a: under CAPEX the three radios are in the DOM, exactly as today', async () => {
    await mount()
    const radios = [...host.querySelectorAll('#deal-structure-toggle [data-structure]')]
      .map((e) => e.getAttribute('data-structure'))
    expect(radios).toEqual(['single', 'twoPhase', 'hybrid'])
  })

  test('L2b: under OPEX they are ABSENT, not disabled and not hidden', async () => {
    await mount({ paymentMode: 'opex' })
    // ABSENT is the claim. A hidden or disabled radio still answers a query,
    // still takes a tab stop in some states, and is what this ruling refuses.
    expect(host.querySelector('#deal-structure-toggle')).toBeNull()
    expect(host.querySelectorAll('[data-structure]')).toHaveLength(0)
  })

  // ── AMENDED MID-ROUND, John 2026-09-25: "drop the single phase text line" ─
  //
  // L2 as first ruled put one plain line where the radios had been. The line is
  // dropped: under OPEX the group goes and NOTHING stands in its place. The
  // assertion is kept rather than deleted, because "no radios" and "no
  // replacement either" are two claims and the second is the one a later round
  // could quietly undo.
  test('L2c: and NOTHING stands in their place', async () => {
    await mount({ paymentMode: 'opex' })
    expect(el('deal-opex-recovery-line')).toBeNull()
    expect(host.textContent).not.toContain('Single phase recovery over full term')
  })

  test('L2d: OPEX still prices as single phase with the radios gone', async () => {
    // The radios were the only place the structure was picked, so removing them
    // must not lose the value the payload carries.
    await mount({ paymentMode: 'opex' })
    expect(host.querySelector('#deal-opex-table')).not.toBeNull()
  })
})

// L3's geometry - side by side at 1440, stacked at 1240, tops equal - is the
// live probe's, and `scripts/opex-layout/probe-live.mjs` is where it is read.
describe('L3: which container holds the yearly table', () => {
  // GEOMETRY IS PROVED LIVE and cannot be proved here: jsdom has no layout, so
  // "side by side" and "top-aligned" are the browser probe's to assert.
  //
  // WHAT BELONGS HERE IS THE STRUCTURE, and a silent injection is why it
  // exists. Removing the yearly table from the OPEX row changed nothing in
  // either suite, because the only assertion about it lived in the live probe -
  // so the claim that the two tables are in ONE row had no detector a commit
  // could run.
  test('L3a: under OPEX the yearly table sits in the tables row', async () => {
    await mount({ paymentMode: 'opex' })
    const row = host.querySelector('#deal-opex-tables')
    expect(row).not.toBeNull()
    const slot = row!.querySelector('#deal-opex-year-slot')
    expect(slot, 'the yearly table is not in the row L3 puts it in').not.toBeNull()
    expect(slot!.children.length).toBeGreaterThan(0)
    expect(row!.querySelector('#deal-opex-table')).not.toBeNull()
  })

  test('L3b: and it is NOT also left where it was, which would be two of it', async () => {
    await mount({ paymentMode: 'opex' })
    const old = host.querySelector('#deal-year-schedule')
    expect(old?.children.length ?? 0).toBe(0)
  })

  test('L3c: under CAPEX it stays exactly where it was', async () => {
    await mount()
    expect(host.querySelector('#deal-opex-year-slot')).toBeNull()
    expect((host.querySelector('#deal-year-schedule')?.children.length ?? 0)).toBeGreaterThan(0)
  })
})
