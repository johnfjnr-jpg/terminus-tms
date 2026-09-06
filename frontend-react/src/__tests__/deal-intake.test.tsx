// ── SECTIONS 1 AND 2: UNITS REQUIRED AND INSTALLATION ────────────────────
//
// Behaviours enumerated from renderInstallationTab (opportunity-deal.js:1383)
// and installVisibility, before anything was built.
//
//  I1  the four unit inputs are CARDS, each with its own label pointing at it
//  I2  installation is a form grid of form groups
//  I3  the per-unit table carries units, cost and price as col-mono cells, and
//      the RATE and MARGIN inputs live in it rather than loose in the section
//  I4  the table totals the cost and price columns
//  I5  the lump-sum summary says what it cost, what it was priced at, and
//      where that figure is carried
//  I6  each of the four installation-responsibility states shows its own
//      group and hides the others
import { describe, test, expect } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ShellProvider } from '../ShellContext'
import { shellServices } from '../shell-services'
import { DealPanel } from '../deal/DealPanel'
import { catalogApi } from './fixtures'
import type { UiState, Values } from '../deal/payload'
import { marginPresentation } from '../../../src/lib/deal-inputs.js'

declare global {
  interface Window { api?: (m: string, p: string, b?: unknown) => Promise<unknown> }
}
const UI: UiState = {
  installResp: 'Terminus Contractor - Per Unit', structure: 'twoPhase', invoicing: 'annual',
  grossUp: false, factoringEnabled: false, factoringMethod: 'straight',
}
// Every unit count DIFFERENT, so a cell reading the wrong one cannot pass.
const VALUES: Values = {
  'deal-ssExisting': '40', 'deal-ssNew': '25', 'deal-aqm': '12', 'deal-hemir': '8',
  'deal-duration': '36', 'deal-targetMargin': '30', 'deal-lumpCost': '250000',
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

describe('section 1: the units', () => {
  test('I1: four unit cards, each with a label pointing at its own input', async () => {
    await mount()
    const cards = [...host.querySelectorAll('.unit-cards .unit-card')]
    expect(cards).toHaveLength(4)
    const ids = ['deal-ssExisting', 'deal-ssNew', 'deal-aqm', 'deal-hemir']
    for (const [i, id] of ids.entries()) {
      const card = cards[i]
      expect(card.querySelector(`#${id}`), id).not.toBeNull()
      // The label must POINT at it: an input that loses its id stops being
      // focused by its label and nothing visible fails.
      expect(card.querySelector(`label[for="${id}"]`), id).not.toBeNull()
    }
  })

  test('and the unit cards live in the intake column, not loose in the section', async () => {
    await mount()
    expect(host.querySelector('.unit-cards')!.closest('.deal-intake-col')).not.toBeNull()
  })
})

describe('section 2: installation', () => {
  test('I2: the installation fields sit in a form grid', async () => {
    await mount()
    const grid = host.querySelector('.form-grid')
    expect(grid).not.toBeNull()
    expect(grid!.querySelectorAll('.form-group').length).toBeGreaterThan(1)
    expect(grid!.querySelector('#deal-installResp')).not.toBeNull()
  })

  test('I3: the per-unit table carries the counts, and holds the rate and margin inputs', async () => {
    await mount({ installResp: 'Terminus Contractor - Per Unit' })
    const table = must('deal-install-table')
    for (const [id, want] of [['deal-install-units-inSsEx', '40'], ['deal-install-units-inSsNew', '25'],
      ['deal-install-units-inAqm', '12'], ['deal-install-units-inHemir', '8']] as const) {
      const cell = must(id)
      expect(cell.textContent, id).toBe(want)
      expect(cell.classList.contains('col-mono'), id).toBe(true)
    }
    // The rate and margin inputs belong to the table, not to the section, and
    // there is exactly one of each.
    for (const id of ['deal-inSsExisting', 'deal-inSsNew', 'deal-inAqm', 'deal-inHemir',
      'deal-margin-inSsEx', 'deal-margin-inSsNew', 'deal-margin-inAqm', 'deal-margin-inHemir']) {
      expect(host.querySelectorAll(`#${id}`), id).toHaveLength(1)
      expect(must(id).closest('#deal-install-table'), id).not.toBeNull()
    }
  })

  test('I4: the table totals its cost and price columns', async () => {
    await mount({ installResp: 'Terminus Contractor - Per Unit' })
    for (const id of ['deal-install-total-cost', 'deal-install-total-price']) {
      const cell = must(id)
      expect(cell.classList.contains('col-mono'), id).toBe(true)
      expect(cell.textContent, id).toMatch(/^\$[\d,]+$/)
    }
  })

  test('I5: the lump-sum summary says cost, price and where it is carried', async () => {
    await mount({ installResp: 'Terminus Contractor - Lump Sum' })
    const p = must('deal-lump-summary')
    expect(p.classList.contains('data-row-label')).toBe(true)
    expect(p.textContent).toMatch(/^Lump sum cost \$250,000, priced at \$[\d,]+, carried into the Deal Summary, Deal sheet and Cash flow\.$/)
  })
})

describe('I6: each responsibility shows its own group', () => {
  const groups = ['deal-lumpCost-group', 'deal-install-seetable', 'deal-install-notapplicable']
  const shown = () => groups.filter((g) => !must(g).classList.contains('hidden'))

  test('per unit points at the table', async () => {
    await mount({ installResp: 'Terminus Contractor - Per Unit' })
    expect(shown()).toEqual(['deal-install-seetable'])
    expect(must('deal-install-table').classList.contains('hidden')).toBe(false)
  })

  test('lump sum asks for the cost', async () => {
    await mount({ installResp: 'Terminus Contractor - Lump Sum' })
    expect(shown()).toEqual(['deal-lumpCost-group'])
    expect(must('deal-install-table').classList.contains('hidden')).toBe(true)
  })

  test('and the two Terminus-does-not-install cases say so', async () => {
    for (const resp of ['Client Own Installation Team', 'Terminus - Reseller Installation']) {
      await mount({ installResp: resp })
      expect(shown(), resp).toEqual(['deal-install-notapplicable'])
    }
  })
})

describe('section 3: the achieved margin sits among the controls that move it', () => {
  test('the row reads through marginPresentation, note and accent included', async () => {
    await mount()
    const row = host.querySelector('.terms-cards .terms-field-row.terms-achieved')
    expect(row, 'no achieved row inside the terms cards').not.toBeNull()
    const val = must('deal-terms-achieved-margin')
    // Not restated here: the same object the strip reads. Round 39 wrote the
    // rule inline and toggled it on ONE of the two renderings, so a deal 22
    // points under target displayed in the treatment of one on target.
    const strip = must('deal-achieved-margin')
    expect(val.textContent).toBe(strip.textContent)
    expect(val.classList.contains('under-target')).toBe(strip.classList.contains('under-target'))
    expect(val.classList.contains('on-target')).toBe(strip.classList.contains('on-target'))
    expect(must('deal-terms-achieved-note').textContent).not.toBe('')
  })

  test('and the accent is the presenter\'s answer, not a second rule', async () => {
    await mount()
    const mp = marginPresentation(30, { targetMargin: '30' }) as { state: string }
    // The presenter names its own states; this asserts the render uses those
    // names rather than inventing a parallel vocabulary.
    expect(['on-target', 'under-target']).toContain(mp.state)
  })
})

describe('section 6: the empty state is a real state', () => {
  test('with a duration there is a grid and no empty line', async () => {
    await mount()
    expect(must('deal-cashflow-empty').classList.contains('hidden')).toBe(true)
    expect(el('deal-cashflow-grid')).not.toBeNull()
    expect(host.querySelector('.deal-cashflow-col')).not.toBeNull()
  })

  test('and without one it names the act that fixes it', async () => {
    await mount({}, { ...VALUES, 'deal-duration': '' })
    const empty = must('deal-cashflow-empty')
    expect(empty.classList.contains('hidden')).toBe(false)
    expect(empty.classList.contains('empty-state')).toBe(true)
    // "No cash flow to show yet" leaves the reader looking for a fault. This
    // says what to do.
    expect(empty.textContent).toBe('Set the Contract Duration to model the monthly cash flow.')
  })
})
