// ── R-PT3 AND F5/F3 OPTION A ────────────────────────────────────────────
//
// R-PT3  Single phase is removed from CAPEX for all NEW pricing. The rail
//        offers Two-phase and Hybrid under CAPEX.
// F3/F5  Under Hybrid the milestones and the hosting breakdown sit side by
//        side at full card width below the rail row, and the hosting schedule
//        renders EXACTLY ONCE in EVERY structure and mode.
//
// Geometry is the live probe's; jsdom has no layout and loads no stylesheet.
// What belongs here is what the markup IS and HOW MANY of a thing there are,
// which is a document fact rather than a painted one.
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
const offered = () => [...host.querySelectorAll('#deal-structure-toggle [data-structure]')]
  .map((e) => (e as HTMLElement).dataset.structure)

describe('R-PT3: Single phase is not offered for new pricing', () => {
  test('R1: under CAPEX the rail offers exactly Two-phase and Hybrid', async () => {
    await mount({ paymentMode: 'capex', structure: 'twoPhase' })
    expect(offered()).toEqual(['twoPhase', 'hybrid'])
  })

  test('R2: Single phase is offered NOWHERE on the surface', async () => {
    // An enumeration by DECLARED PROPERTY rather than by the label's words:
    // a radio is a `[data-structure]`, whatever it is called.
    for (const paymentMode of ['capex', 'opex'] as const) {
      await mount({ paymentMode })
      const all = [...host.querySelectorAll('[data-structure]')]
        .map((e) => (e as HTMLElement).dataset.structure)
      expect(all, `single offered under ${paymentMode}`).not.toContain('single')
    }
  })

  test('R3: OPEX is still the single-phase mode, and still writes it', async () => {
    // THE OPTION LEAVES THE SCREEN AND THE VALUE DOES NOT LEAVE THE RECORD.
    // `effectiveStructure` is what makes the ruling a relabelling rather than
    // a repricing, so it is asserted here rather than trusted.
    const { effectiveStructure } = await import('../deal/payload')
    expect(effectiveStructure({ structure: 'twoPhase', paymentMode: 'opex' })).toBe('single')
    expect(effectiveStructure({ structure: 'hybrid', paymentMode: 'opex' })).toBe('single')
  })

  test('R4: under OPEX the recovery readout still reads the duration', async () => {
    await mount({ paymentMode: 'opex' })
    // Single phase recovers over the whole term. The readout is the proof the
    // MEANING survived the option being removed from the rail.
    const { buildYearSchedule } = await import('../deal/schedule')
    expect(buildYearSchedule({ rows: [] } as never, { duration: 60 }, 'single', 'annual')
      .recoveryReadonly).toBe('60 months')
  })
})

describe('F3: the hosting schedule renders exactly once', () => {
  // THE GUARD ASSERTS ONE RENDER IN EVERY STRUCTURE AND MODE, which is the
  // ruling's own wording. The previous round's comment claimed this was
  // already true and it was false under Hybrid from the moment the rail
  // round landed, so the claim is enumerated rather than spot-checked.
  const COMBOS: Array<[UiState['paymentMode'], string]> = [
    ['capex', 'twoPhase'], ['capex', 'hybrid'],
    ['opex', 'twoPhase'], ['opex', 'hybrid'],
  ]
  test('F3a: exactly one schedule element exists, in every mode and structure', async () => {
    for (const [paymentMode, structure] of COMBOS) {
      await mount({ paymentMode, structure })
      const n = host.querySelectorAll(
        '[data-testid="year-schedule"], [data-testid="hybrid-schedule"]').length
      expect(n, `${paymentMode}/${structure} rendered ${n} schedules`).toBe(1)
    }
  })

  test('F3b: under Hybrid the one render is inside the Hybrid grid', async () => {
    await mount({ paymentMode: 'capex', structure: 'hybrid' })
    const el = q('[data-testid="year-schedule"], [data-testid="hybrid-schedule"]')!
    expect(el.closest('#deal-hybrid-group')).not.toBeNull()
  })

  /* RE-TAKEN: M4 retires the rail and its content column, so "in the content
     column" has no subject. The claim was always that the ONE render is NOT in
     the Hybrid grid when the structure is not Hybrid, which is what decides
     which of the two slots rendered it. */
  test('F3c: outside Hybrid the one render is NOT in the Hybrid grid', async () => {
    await mount({ paymentMode: 'capex', structure: 'twoPhase' })
    const el = q('[data-testid="year-schedule"], [data-testid="hybrid-schedule"]')!
    expect(el.closest('#deal-hybrid-group')).toBeNull()
    expect(el.closest('.payment-card')).not.toBeNull()
  })

  test('F3d: the milestones and the schedule are siblings in the Hybrid grid', async () => {
    // OPTION A stated as a document fact: both columns of one grid. Whether
    // they PAINT side by side at full card width is the live probe's.
    await mount({ paymentMode: 'capex', structure: 'hybrid' })
    const grid = q('#deal-hybrid-group')!
    expect(grid.querySelector('#deal-milestones-tbody')).not.toBeNull()
    expect(grid.querySelector('[data-testid="hybrid-schedule"], [data-testid="year-schedule"]')).not.toBeNull()
  })
})
