// ── SECTION 4: DEAL SHEET SUMMARY ────────────────────────────────────────
//
// Behaviours enumerated from the vanilla source before anything was built:
// renderPricingCards (opportunity-deal.js:356), renderCatalogNotice (:445),
// the disclosure listener (:1931) and the signpost toggle (:1663).
//
//  B1  the disclosure label is a SPAN beside the chevron, never the button's
//      own textContent: writing textContent deletes the chevron the CSS
//      rotates, so the indicator would work exactly once. (:1939)
//  B2  `detail-open` goes on the ROW, not the panel. The row has to become two
//      columns; hiding the panel alone leaves a one-column grid with a gap.
//  B3  aria-expanded tracks the state, and the label reads Show/Hide detail.
//  B4  #deal-sheet-units carries result.hardware.totalUnits. (:739)
//  B5  each row's note reads `N units x $cost`. (:398)
//  B6  the warranty note reads `pct% of N units = W unit(s)`, singular at one.
//  B7  every hosting figure carries the perMonthFigure wording, totals too:
//      the same hosting is priced over the term three sections below, and
//      $5,400 and $194,400 were the same cost with nothing saying which. (:405)
//  B8  a blank margin box prices at target, so the PLACEHOLDER carries the
//      target rather than the box carrying a value nobody entered. (:382)
//  B9  an overridden line says so, in a class and in the title. (:392)
//  B10 the per-unit signpost appears exactly when the rows it points at do.
import { describe, test, expect } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ShellProvider } from '../ShellContext'
import { shellServices } from '../shell-services'
import { DealPanel } from '../deal/DealPanel'
import { SummaryNotices } from '../deal/section4'
import { perMonthFigure } from '../../../src/lib/deal-inputs.js'
import type { UiState, Values } from '../deal/payload'
import { catalogApi } from './fixtures'

declare global {
  interface Window { api?: (m: string, p: string, b?: unknown) => Promise<unknown> }
}

// NON-ZERO throughout, and every unit count DIFFERENT, so a note that reads the
// wrong count cannot pass by coincidence.
const UI: UiState = {
  installResp: 'Terminus Contractor - Per Unit', structure: 'twoPhase', invoicing: 'annual',
  grossUp: false, factoringEnabled: false, factoringMethod: 'straight',
}
const VALUES: Values = {
  'deal-ssExisting': '40', 'deal-ssNew': '25', 'deal-aqm': '12', 'deal-hemir': '8',
  'deal-duration': '36', 'deal-targetMargin': '30', 'deal-warrantyPct': '12',
  'deal-ssUnitCost': '1000', 'deal-aqUnitCost': '800', 'deal-hemirUnitCost': '1200',
  'deal-hoSafesight': '10', 'deal-hoAqm': '8', 'deal-hoHemir': '12',
}

let host: HTMLElement
const mountRaw = async (values: Values = VALUES, ui: UiState = UI) => {
  document.body.innerHTML = '<div id="host"></div>'
  host = document.getElementById('host')!
  const root: Root = createRoot(host)
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  await act(async () => {
    root.render(
      <QueryClientProvider client={qc}>
        <ShellProvider services={shellServices}>
          <DealPanel initialValues={values} initialUi={ui} testBedCost={25000} />
        </ShellProvider>
      </QueryClientProvider>)
  })
  await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
}
const mount = async (values: Values = VALUES, ui: UiState = UI) => {
  window.api = catalogApi()
  await mountRaw(values, ui)
}
const el = (id: string) => host.querySelector(`#${id}`) as HTMLElement | null
const must = (id: string) => { const e = el(id); if (!e) throw new Error(`no #${id}`); return e }

describe('section 4 structure', () => {
  test('the section, the title row and the summary row exist', async () => {
    await mount()
    expect(must('deal-section-4').tagName).toBe('SECTION')
    expect(host.querySelector('.section-title-row')).not.toBeNull()
    expect(must('deal-summary-row').className).toContain('deal-summary-row')
    expect(must('deal-panel').className).toContain('deal-panel')
  })

  test('B4: the units figure is the hardware total, not a count of inputs', async () => {
    await mount()
    // 40 + 25 SafeSight + 12 AQ + 8 HEMIR = 85. Expressed as the sum rather
    // than typed, so the fixture and the assertion cannot drift together.
    const expected = 40 + 25 + 12 + 8
    expect(must('deal-sheet-units').textContent).toBe(String(expected))
  })
})

describe('the disclosure', () => {
  test('B1: the label is a span beside the chevron, and the chevron survives a toggle', async () => {
    await mount()
    const btn = must('btn-toggle-detail')
    expect(btn.querySelector('.disclose-chevron'), 'no chevron').not.toBeNull()
    expect(must('btn-toggle-detail-text').textContent).toBe('Show detail')
    await act(async () => { btn.click() })
    expect(btn.querySelector('.disclose-chevron'), 'the toggle destroyed the chevron').not.toBeNull()
    expect(must('btn-toggle-detail-text').textContent).toBe('Hide detail')
  })

  test('B2: detail-open goes on the ROW and hidden comes off the PANEL', async () => {
    await mount()
    expect(must('deal-detail-panel').classList.contains('hidden')).toBe(true)
    expect(must('deal-summary-row').classList.contains('detail-open')).toBe(false)
    await act(async () => { must('btn-toggle-detail').click() })
    expect(must('deal-detail-panel').classList.contains('hidden')).toBe(false)
    expect(must('deal-summary-row').classList.contains('detail-open')).toBe(true)
    // And the class is NOT on the panel, which is the half that makes it a
    // two-column grid rather than a one-column grid with a gap.
    expect(must('deal-detail-panel').classList.contains('detail-open')).toBe(false)
  })

  test('B3: aria-expanded tracks the state', async () => {
    await mount()
    const btn = must('btn-toggle-detail')
    expect(btn.getAttribute('aria-expanded')).toBe('false')
    await act(async () => { btn.click() })
    expect(btn.getAttribute('aria-expanded')).toBe('true')
    await act(async () => { btn.click() })
    expect(btn.getAttribute('aria-expanded')).toBe('false')
  })
})

describe('the pricing cards', () => {
  test('B5: a hardware note reads the units and the unit cost', async () => {
    await mount()
    expect(must('pg-note-hwAqm').textContent).toBe(`${12} units x $${(800).toLocaleString('en-US')}`)
  })

  test('B6: the warranty note names the provision, and is singular at one unit', async () => {
    await mount()
    const total = 40 + 25 + 12 + 8
    const text = must('pg-note-hwWarranty').textContent ?? ''
    // The COUNT is the calculator's and is not restated here: an earlier draft
    // of this test recomputed it as Math.round and read 10 where the calculator
    // ceilings 10.2 to 11. What B6 claims is the WORDING, so the number is read
    // back out of the sentence and the sentence is asserted around it.
    const n = Number(text.match(/= (\d+) unit/)?.[1])
    expect(Number.isFinite(n), `no unit count in: ${text}`).toBe(true)
    expect(text).toBe(`12% of ${total} units = ${n} unit${n === 1 ? '' : 's'}`)
  })

  test('B7: every hosting figure carries the per-month wording, totals included', async () => {
    await mount()
    for (const id of ['pg-cost-hoSs', 'pg-price-hoSs', 'pg-cost-hoAqm',
      'pg-total-cost-ho', 'pg-total-price-ho']) {
      const text = must(id).textContent ?? ''
      // Expressed through the presenter, never restated: perMonthFigure is the
      // one wording rule and this asserts the render used it.
      expect(text, id).toBe(perMonthFigure(text.replace(/ .*$/, '')))
    }
  })

  test('and the hardware figures do NOT, because they are not per month', async () => {
    await mount()
    expect(must('pg-cost-hwSs').textContent).not.toContain('month')
  })

  test('B8: a blank margin box carries the target as its PLACEHOLDER, not its value', async () => {
    await mount()
    const box = must('deal-margin-hwSs') as HTMLInputElement
    expect(box.placeholder).toBe('30')
    expect(box.value).toBe('')
    expect(box.classList.contains('pg-margin-input')).toBe(true)
  })

  test('B9: an overridden line says so, in a class and in the title', async () => {
    await mount({ ...VALUES, 'deal-margin-hwSs': '42' })
    const box = must('deal-margin-hwSs') as HTMLInputElement
    expect(box.value).toBe('42')
    expect(box.classList.contains('pg-margin-override')).toBe(true)
    expect(box.title).toContain('42')
    const blank = must('deal-margin-hwAqm') as HTMLInputElement
    expect(blank.classList.contains('pg-margin-override')).toBe(false)
    expect(blank.title).not.toBe(box.title)
  })
})

describe('the summary notices', () => {
  test('whichever mood is showing carries the SAME trough sentence', async () => {
    // The sign is the calculator's business and is not guessed here: an earlier
    // draft asserted "stays positive" on a fixture whose cash goes negative,
    // which tested my expectation rather than the panel. What the panel claims
    // is that the two moods share one trough sentence and differ only in the
    // verdict, so a reader compares like with like.
    await mount()
    const ok = must('deal-cashflow-ok'), warn = must('deal-cashflow-warn')
    const shownEl = ok.classList.contains('hidden') ? warn : ok
    expect(shownEl.classList.contains(shownEl === ok ? 'msg-success' : 'msg-error')).toBe(true)
    expect(shownEl.textContent).toMatch(
      shownEl === ok ? /^Cash position stays positive throughout the term\. / : /^Cash position goes negative\. /)
    expect(shownEl.textContent).toMatch(/Lowest cash position: -?\$[\d,]+ in month \d+\.$/)
  })

  // ── BOTH MOODS, DRIVEN DIRECTLY ───────────────────────────────────────
  //
  // Found by calibration: making the warning permanently visible changed
  // nothing, because this deal's cash goes negative, so the positive line was
  // hidden anyway and exactly one was still showing. The panel fixture cannot
  // exhibit the fault, so the component is driven with both signs instead.
  // Verification 25: the reading has to be taken on a population that can show
  // the thing.
  const renderNotices = async (minCash: number | null) => {
    document.body.innerHTML = '<div id="host"></div>'
    const h = document.getElementById('host')!
    const r: Root = createRoot(h)
    await act(async () => {
      r.render(<SummaryNotices n={{ minCash, minCashMonth: 7, milestoneWarning: null }} />)
    })
    return h
  }

  test('exactly one mood shows, for POSITIVE cash', async () => {
    const h = await renderNotices(1234)
    const shown = ['deal-cashflow-ok', 'deal-cashflow-warn']
      .filter((id) => !h.querySelector(`#${id}`)!.classList.contains('hidden'))
    expect(shown).toEqual(['deal-cashflow-ok'])
    expect(h.querySelector('#deal-cashflow-ok')!.textContent).toContain('in month 7.')
  })

  test('and exactly one for NEGATIVE cash', async () => {
    const h = await renderNotices(-5000)
    const shown = ['deal-cashflow-ok', 'deal-cashflow-warn']
      .filter((id) => !h.querySelector(`#${id}`)!.classList.contains('hidden'))
    expect(shown).toEqual(['deal-cashflow-warn'])
    expect(h.querySelector('#deal-cashflow-warn')!.textContent).toContain('-$5,000')
  })

  test('and NEITHER before there is a cash flow to describe', async () => {
    const h = await renderNotices(null)
    for (const id of ['deal-cashflow-ok', 'deal-cashflow-warn']) {
      expect(h.querySelector(`#${id}`)!.classList.contains('hidden'), id).toBe(true)
    }
  })

  test('and only ONE of the two is ever showing', async () => {
    await mount()
    const shown = ['deal-cashflow-ok', 'deal-cashflow-warn']
      .filter((id) => !must(id).classList.contains('hidden'))
    expect(shown).toHaveLength(1)
  })
})

describe('the cost basis and the signpost', () => {
  test('B10: the signpost appears exactly when the per-unit rows it points at do', async () => {
    await mount(VALUES, { ...UI, installResp: 'Terminus Contractor - Per Unit' })
    expect(must('deal-detail-signpost').classList.contains('hidden')).toBe(false)
    await mount(VALUES, { ...UI, installResp: 'Terminus Contractor - Lump Sum' })
    expect(must('deal-detail-signpost').classList.contains('hidden')).toBe(true)
  })

  test('the cost basis names the batch it priced against', async () => {
    await mount()
    expect(must('deal-catalog-basis').textContent).toBe('2026 H1 · effective 2026-01-01')
    expect(must('deal-catalog-basis').classList.contains('deal-basis-absent')).toBe(false)
  })

  test('and reads not recorded when no batch is known, which is a different state from $0', async () => {
    window.api = catalogApi([])
    await mountRaw()
    expect(must('deal-catalog-basis').textContent).toBe('not recorded')
    expect(must('deal-catalog-basis').classList.contains('deal-basis-absent')).toBe(true)
    // The warning says WHY every cost is zero, because a zero that means "no
    // rate exists" and a zero that means "free" look identical on the screen.
    expect(must('deal-catalog-warn').classList.contains('hidden')).toBe(false)
    expect(must('deal-catalog-warn').textContent).toContain('not because it is free')
  })
})
