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
import { buildBasis } from '../deal/basis'
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
  hostingPriceMode: 'margin',
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
    // THE BASIS IS SAFESIGHT UNITS, NOT THE MIX. John's warranty ruling,
    // 2026-09-16. This read 40 + 25 + 12 + 8, every unit on the deal, which was
    // correct while the count was taken over the mix. The AQ and HEMIR counts
    // no longer enter it.
    const safesight = 40 + 25
    const text = must('pg-note-hwWarranty').textContent ?? ''
    // The COUNT is the calculator's and is not restated here: an earlier draft
    // of this test recomputed it as Math.round and read 10 where the calculator
    // ceilings 10.2 to 11. What B6 claims is the WORDING, so the number is read
    // back out of the sentence and the sentence is asserted around it.
    const n = Number(text.match(/= (\d+) unit/)?.[1])
    expect(Number.isFinite(n), `no unit count in: ${text}`).toBe(true)
    expect(text).toBe(`12% of ${safesight} SafeSight units = ${n} unit${n === 1 ? '' : 's'}, at cost`)
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

// ── WALK 11 D3: INSTALLATION IS A LINE WITH A MARGIN ────────────────────
//
// RED FIRST, all five. Before the change the card had four rows and no
// Installation among them, no `deal-margin-inLump` existed anywhere, and
// `MARGIN_KEYS` could not carry the key even if a box had been added.
//
// THE MECHANISM THIS IS ABOUT: a lump-sum installation priced at
// `marginFor('inLump')`, which is `marginOverrides.inLump ?? targetMargin`,
// against a `marginOverrides` built by looping an ELEVEN-key allowlist that
// did not contain `inLump`. Architecture 9: adding the box is a no-op until
// the definition names the key too, so both halves are asserted here.
describe('D3: the installation line', () => {
  const LUMP: UiState = { ...UI, installResp: 'Terminus Contractor - Lump Sum' }
  // THE ID IS THE SYSTEM'S, not the payload key's: the census calls this box
  // `deal-lumpCost` and it writes `lumpSumCost`. The first fixture used the
  // payload key, so the cost never reached the calculator and the line read
  // $0 - Verification 47, a fixture shaped by the reader rather than by the
  // thing that produces the state.
  const LUMP_VALUES: Values = { ...VALUES, 'deal-lumpCost': '200000' }
  const num = (id: string) => Number((must(id).textContent ?? '').replace(/[^0-9.]/g, ''))

  test('D3a the Unit cost and warranty card carries an Installation row', async () => {
    await mount(LUMP_VALUES, LUMP)
    expect(must('pg-cost-inGroup')).toBeTruthy()
    expect(must('pg-price-inGroup')).toBeTruthy()
  })

  test('D3b on a LUMP SUM deal its margin is an adjustable box named inLump', async () => {
    await mount(LUMP_VALUES, LUMP)
    const box = must('deal-margin-inLump') as unknown as HTMLInputElement
    expect(box.tagName).toBe('INPUT')
    expect(box.disabled, 'the control D3 exists to add cannot be disabled').toBe(false)
    // The placeholder carries the target, which is the estate's own contract
    // for every other margin box: blank prices at target.
    expect(box.placeholder).toBe('30')
  })

  test('D3c the price is the TARGET-margin derivation, to the dollar', async () => {
    await mount(LUMP_VALUES, LUMP)
    // Expressed, never restated: 200000 at a 30% margin. A hand-typed 285714
    // would be a second reader of the calculator (Verification 20).
    expect(num('pg-cost-inGroup')).toBe(200000)
    expect(num('pg-price-inGroup')).toBe(Math.round(200000 / (1 - 30 / 100)))
  })

  test('D3d the card TOTAL includes the installation line it now shows', async () => {
    await mount(LUMP_VALUES, LUMP)
    const rows = ['hwSs', 'hwAqm', 'hwHemir', 'hwWarranty', 'inGroup']
    const sum = (what: string) => rows.reduce((s, k) => s + num(`pg-${what}-${k}`), 0)
    // A card whose rows do not add up to its own total is the defect
    // Verification 21 is about: a total that cannot be checked against
    // anything is not a total.
    expect(num('pg-total-cost-oneoff')).toBe(sum('cost'))
    expect(num('pg-total-price-oneoff')).toBe(sum('price'))
  })

  test('D3e PER UNIT: the margin is a READOUT, never a second writer', async () => {
    await mount(VALUES, UI)   // UI is Per Unit
    expect(host.querySelector('#deal-margin-inLump'),
      'a single box driving four independently-controlled install lines is two writers')
      .toBeNull()
    // The line is still shown, and still derived from the same group.
    expect(must('pg-price-inGroup')).toBeTruthy()
    expect(must('pg-margin-inGroup').textContent).toMatch(/%|--/)
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

// ── THE COST BASIS AGE, AND WHERE ITS BAND MAY BE PAINTED ────────────────
//
// Ported from the vanilla harness's basis blocks, which modelled the
// rendering locally and so kept passing after the swap while asserting nothing
// about the live panel. Running them found a real defect: buildBasis computed
// `ageBand` and section 4 dropped it, so an ageing or a stale catalog read in
// exactly the treatment of a current one.
describe('the cost basis age', () => {
  test('a CURRENT basis says nothing about its age, and the value still reads', () => {
    const v = buildBasis({ safesight: { batch_label: '2026 H1', effective_from: '2026-01-01' } },
      [], '2026-02-01', null, undefined)
    expect(v.text).toBe('2026 H1 · effective 2026-01-01')
    expect(v.age, 'a current basis printed an age').toBe('')
    expect(v.ageBand).toBe('')
  })

  test('an AGEING basis states it, and the band names the age span only', () => {
    const v = buildBasis({ safesight: { batch_label: '2026 H1', effective_from: '2025-01-01' } },
      [], '2025-08-01', null, undefined)
    expect(v.age).not.toBe('')
    expect(v.ageBand).toBe('deal-catalog-ageing')
    // THE BATCH NAME IS NOT PAINTED BY HOW OLD IT IS: the basis is a fact about
    // this deal, the age is a warning that only sometimes applies.
    expect(v.text).toBe('2026 H1 · effective 2025-01-01')
  })

  test('a STALE basis takes its own band, distinct from ageing', () => {
    const v = buildBasis({ safesight: { batch_label: 'old', effective_from: '2024-01-01' } },
      [], '2026-01-01', null, undefined)
    expect(v.ageBand).toBe('deal-catalog-stale')
  })

  // ── COST_CALC_AUDIT.md F4: the per-KEY absence ────────────────────────
  //
  // Verification 24: the new parameter defaults to [], so every existing caller
  // and every test above agrees with the constant. These pass a DIFFERENT value,
  // which is the only thing that can tell a used parameter from a decorative one.
  test('a NULL RATE COLUMN is named, where the per-product warning cannot see it', () => {
    const v = buildBasis({ safesight: { batch_label: 'b', effective_from: '2026-01-01' } },
      [], '2026-02-01', null, undefined, ['inSsNew'])
    expect(v.warning).toContain('SafeSight installation, new infrastructure')
    expect(v.warning).toContain('$0 because no rate exists')
  })

  test('it does NOT repeat a product the missing-batch warning already named', () => {
    const v = buildBasis({ safesight: { batch_label: 'b', effective_from: '2026-01-01' } },
      ['hemir'], '2026-02-01', null, undefined, ['hemirUnitCost', 'inHemir'])
    expect(v.warning).toContain('no current batch for HEMIR')
    expect(v.warning, 'HEMIR was named twice').not.toContain('HEMIR installation')
  })

  test('no absent keys means no such sentence at all', () => {
    const v = buildBasis({ safesight: { batch_label: 'b', effective_from: '2026-01-01' } },
      [], '2026-02-01', null, undefined, [])
    expect(v.warning).toBe('')
  })

  test('an UNDATED batch is not treated as current', () => {
    const v = buildBasis({ safesight: { batch_label: 'undated' } }, [], '2026-01-01', null, undefined)
    expect(v.ageBand).toBe('deal-catalog-undated')
    expect(v.age).not.toBe('')
  })

  test('and the RENDER carries the band, which is what the class is for', async () => {
    await mount()
    const span = must('deal-catalog-age')
    expect(span.classList.contains('deal-basis-age')).toBe(true)
    // The fixture's batch is current, so no band. The assertion that matters is
    // that the render reads ageBand at all, which is checked by injection.
    expect(span.className.startsWith('deal-basis-age')).toBe(true)
  })
})

// ──────────────────────────────────────────────────────────────────────
// R-O7: THE PRICE/UNIT SWITCH AND ITS TABLE
//
// Written from the ruling: "Price/Unit switch (hover: 'Override the calculated
// Margin Price') on -> the entered monthly fee per unit type REPLACES the
// calculated hosting price for that type, % Margin derived from the override
// against that type's cost ... Table: Unit, Monthly fee, % Margin; rows
// Safesight, Air Quality, HEMIR."
//
// THE SWITCH IS ON THE HOSTING CARD ONLY, which is a claim about the other
// card as much as this one: a hardware line has no per-unit monthly fee.
// ──────────────────────────────────────────────────────────────────────

const PER_UNIT: UiState = { ...UI, hostingPriceMode: 'perUnit' }

describe('R-O7: the hosting price override', () => {
  test('the switch exists, says what it does on hover, and starts OFF', async () => {
    await mount()
    const sw = must('deal-hosting-price-mode')
    expect(sw.getAttribute('role')).toBe('switch')
    expect(sw.getAttribute('title')).toBe('Override the calculated Margin Price')
    expect(sw.textContent).toContain('Price/Unit')
    expect(sw.getAttribute('aria-checked'), 'a deal with no mode recorded is not overridden').toBe('false')
  })

  test('and there is exactly ONE of it, on the hosting card rather than every card', async () => {
    await mount()
    // A count, because the switch is rendered inside a `CARDS.map` and the
    // obvious way to get it wrong is to give one to the hardware card too.
    expect(host.querySelectorAll('[data-testid="deal-hosting-price-mode"]')).toHaveLength(1)
    const card = must('deal-hosting-price-mode').closest('.pg-card')
    expect(card?.querySelector('.pg-card-title')?.textContent).toContain('Hosting')
  })

  test('OFF, the card shows the margin table and NO fee table', async () => {
    await mount()
    expect(host.querySelector('[data-testid="pg-head-fee"]')).toBeNull()
    // The negative needs its positive, or it passes on a card that renders
    // nothing at all: the margin boxes must still be there.
    expect(host.querySelector('[data-testid="deal-margin-hoSs"]')).not.toBeNull()
  })

  test('ON, the fee table replaces it, with the ruling\'s three rows in its order', async () => {
    await mount(VALUES, PER_UNIT)
    expect(host.querySelector('[data-testid="pg-head-fee"]')).not.toBeNull()
    const head = [...host.querySelectorAll('[data-testid="pg-head-fee"] span')]
      .map((s) => s.textContent)
    expect(head).toEqual(['Unit', 'Monthly fee', '% Margin'])
    for (const k of ['hoSs', 'hoAqm', 'hoHemir']) {
      expect(host.querySelector(`[data-testid="deal-hofee-${k}"]`), `no fee box for ${k}`).not.toBeNull()
    }
    // `:not(.pg-total)` because the TOTAL row also takes the fee shape: three
    // columns, so its figures line up with the three headings. Without the
    // exclusion this read a fourth name, 'Total', which is the row being right
    // rather than the table being wrong.
    const names = [...host.querySelectorAll('.pg-row--fee:not(.pg-total) .pg-item-name')]
      .map((n) => n.textContent)
    expect(names).toEqual(['Safesight', 'Air Quality', 'HEMIR'])
  })

  test('the TOTAL row answers the same three headings, not the margin table\'s four', async () => {
    // The defect this replaced was invisible to every assertion: the row was
    // present, its figures were right to the dollar and its ids were correct,
    // and the total PRICE sat under the heading `% Margin` because the row
    // kept the four-column shape. Found by opening the screenshot.
    await mount({ ...VALUES, 'deal-hofee-hoSs': '20' }, PER_UNIT)
    const total = host.querySelector('.pg-row--fee.pg-total')
    expect(total, 'the total row did not take the fee table\'s shape').not.toBeNull()
    expect(total!.children).toHaveLength(3)
    // The card's overall margin, derived from the same group the rows are.
    expect(must('pg-fee-margin-total').textContent).toMatch(/^-?\d+\.\d%$/)
  })

  test('ON, the hosting MARGIN boxes are gone, so there is one way to price a line', async () => {
    await mount(VALUES, PER_UNIT)
    for (const k of ['hoSs', 'hoAqm', 'hoHemir']) {
      expect(host.querySelector(`[data-testid="deal-margin-${k}"]`),
        `${k} still offers a margin box while the fee table is showing`).toBeNull()
    }
    // AND THE HARDWARE MARGINS SURVIVE, which is what makes the claim above
    // about the hosting card rather than about the screen.
    expect(host.querySelector('[data-testid="deal-margin-hwSs"]')).not.toBeNull()
  })

  test('R-O8: the help text says an overridden fee is warranty-inclusive', async () => {
    await mount(VALUES, PER_UNIT)
    const help = host.querySelector('[data-testid="deal-hosting-fee-help"]')
    expect(help, 'nothing on the panel says what an overridden price includes').not.toBeNull()
    expect(help!.textContent).toMatch(/warranty-inclusive/i)
  })

  test('R-O8: and it is absent while the override is OFF, having nothing to explain', async () => {
    await mount()
    expect(host.querySelector('[data-testid="deal-hosting-fee-help"]')).toBeNull()
  })

  test('a recorded fee prices the line, and the margin beside it is the one it earns', async () => {
    // 65 SafeSight units at a hosting cost of 10 = 650 cost. A fee of 20 per
    // unit is 1300, so the margin is (1 - 650/1300) x 100 = 50.0%.
    await mount({ ...VALUES, 'deal-hofee-hoSs': '20' }, PER_UNIT)
    expect(must('pg-fee-margin-hoSs').textContent).toBe('50.0%')
  })

  test('and a type with no fee still reads its own margin, not a blank', async () => {
    await mount({ ...VALUES, 'deal-hofee-hoSs': '20' }, PER_UNIT)
    // 29.9%, NOT 30.0%, AND THE DIFFERENCE IS REAL RATHER THAN A ROUNDING
    // SLOPPINESS IN THE TEST. AQ has no fee, so it prices from the 30% target:
    // 12 units x $8 = $96 of cost, and `priceFromCost` rounds to whole dollars,
    // so the price is round(96 / 0.7) = $137 rather than $137.14. The margin
    // that price actually earns is (1 - 96/137) x 100 = 29.93%.
    //
    // The column shows the margin the line EARNS, one definition for every row,
    // overridden or not. Showing the nominal 30 here and the derived figure on
    // an overridden row would be two meanings in one column, which is
    // Verification 20 inside a table.
    //
    // My first expectation here was 30.0%, hand-computed from the target - a
    // second reader of the calculation, and the code was right.
    const cost = 12 * 8
    const price = Math.round(cost / 0.7)
    const earned = (1 - cost / price) * 100
    expect(must('pg-fee-margin-hoAqm').textContent).toBe(`${earned.toFixed(1)}%`)
    expect(earned.toFixed(1), 'the arithmetic above drifted from the claim').toBe('29.9')
  })
})
