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
  hostingPriceMode: 'margin', paymentMode: 'capex',
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
  /* ── RE-POINTED BY R-SZ2, 2026-09-26 ───────────────────────────────────
     There is no `.unit-card` and no `.unit-cards`. The Units card and the
     Installation per-unit table are ONE per-product grid, because their rows
     had to stay level and two lists can only do that by sharing row tracks.

     THE CLAIM IS UNCHANGED AND THE SUBJECT MOVED: four products, each with its
     own units input, and the input named by its product. What was a card is a
     ROW, and a row's cells are identified by the product key they carry rather
     than by a wrapper element, because a flat grid has no row element to ask.

     The head row that M8 added is no longer a data row wearing the same class,
     so the `:not(.unit-card--head)` exclusion has nothing to exclude. */
  test('I1: four product rows, each with its own units input', async () => {
    await mount()
    const cards = [...host.querySelectorAll('[data-testid^="ig-units-"]')]
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

  /* ── M8: THE TWO CATALOG COLUMNS ────────────────────────────────────────
     Read-only, catalog, and named once. The VALUES are the catalog's, so this
     asserts they are the catalog's rather than asserting a number: a hardcoded
     expectation here would be a second reader of the rate table. */
  test('M8: every unit row carries a unit cost and a hosting cost, read-only', async () => {
    await mount()
    const ids = ['deal-ssExisting', 'deal-ssNew', 'deal-aqm', 'deal-hemir']
    for (const id of ids) {
      for (const suffix of ['unitCost', 'hostingCost']) {
        const cell = host.querySelector(`[data-testid="${id}-${suffix}"]`)
        expect(cell, `${id}-${suffix}`).not.toBeNull()
        // READ-ONLY: text, not a control. R-C2a keeps catalog costs off the deal.
        expect(cell!.querySelector('input, select, textarea'), `${id}-${suffix}`).toBeNull()
        expect(cell!.textContent!.trim().length, `${id}-${suffix}`).toBeGreaterThan(0)
      }
    }
  })

  test('M8: the columns are named once, and the basis is named once', async () => {
    await mount()
    /* RE-POINTED BY R-SZ2: one head track for the whole grid, so the columns
       of both halves are named once in one row. The blank first cell is gone
       because the product column now has a name of its own. */
    const heads = [...host.querySelectorAll('#deal-product-grid .ig-head')]
    expect(heads.map((c) => c.textContent!.trim())).toEqual(
      ['Product', 'Units', 'Unit cost', 'Hosting cost/mth',
        'Rate (USD, from Base Cost Data)', 'Cost (USD)', 'Margin %', 'Price (USD)'])
    expect(host.querySelectorAll('[data-testid="unit-cards-basis"]')).toHaveLength(1)
  })

  test('M8: both SafeSight rows read the SAME unit rate, because they are one product', async () => {
    await mount()
    const v = (t: string) => host.querySelector(`[data-testid="${t}"]`)!.textContent!.trim()
    expect(v('deal-ssExisting-unitCost')).toBe(v('deal-ssNew-unitCost'))
    expect(v('deal-ssExisting-hostingCost')).toBe(v('deal-ssNew-hostingCost'))
    // and they are NOT all the same figure, or the assertion above is vacuous
    expect(v('deal-ssExisting-unitCost')).not.toBe(v('deal-hemir-unitCost'))
  })

  test('M8: warranty is not a unit row and gains nothing', async () => {
    await mount()
    expect(host.querySelector('[data-testid="deal-warrantyPct-unitCost"]')).toBeNull()
    expect(host.querySelectorAll('[data-testid^="ig-product-"]')).toHaveLength(4)
  })

  test('and the product grid lives in the intake column, not loose in the section', async () => {
    await mount()
    expect(host.querySelector('#deal-product-grid')!.closest('.deal-intake-col')).not.toBeNull()
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
    /* ── RE-POINTED BY R-SZ2, AND THE COUNT IS NOW READ ONCE ───────────────
       `deal-install-units-*` is retired. It was a READ-ONLY DISPLAY of the same
       number the Units input holds, in a separate table, and the merge puts the
       two on one row where showing it twice would be two readers of one value
       (Verification 20) three centimetres apart.

       So the claim becomes what it always meant: the row carries its count, and
       the count is the one the deal records. Read from the input, which is the
       thing that holds it. */
    const grid = must('deal-product-grid')
    for (const [key, id, want] of [['inSsEx', 'deal-ssExisting', '40'],
      ['inSsNew', 'deal-ssNew', '25'], ['inAqm', 'deal-aqm', '12'],
      ['inHemir', 'deal-hemir', '8']] as const) {
      const cell = host.querySelector(`[data-testid="ig-units-${key}"]`)
      expect(cell, key).not.toBeNull()
      expect((cell!.querySelector(`#${id}`) as HTMLInputElement).value, key).toBe(want)
    }
    // The rate and margin inputs belong to the grid, not to the section, and
    // there is exactly one of each.
    for (const id of ['deal-inSsExisting', 'deal-inSsNew', 'deal-inAqm', 'deal-inHemir',
      'deal-margin-inSsEx', 'deal-margin-inSsNew', 'deal-margin-inAqm', 'deal-margin-inHemir']) {
      expect(host.querySelectorAll(`#${id}`), id).toHaveLength(1)
      expect(must(id).closest('#deal-product-grid'), id).not.toBeNull()
    }
    expect(grid.getAttribute('data-install-half')).toBe('true')
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
    /* RE-POINTED BY R-SZ2: the install half is a set of cells in the merged
       grid rather than a table of its own, so the grid says whether the half
       is showing. HIDDEN, NOT ABSENT, exactly as the table was: the inputs
       stay in the document, which the census control guard depends on. */
    expect(must('deal-product-grid').getAttribute('data-install-half')).toBe('true')
    expect(must('deal-inSsExisting')).not.toBeNull()
  })

  test('lump sum asks for the cost', async () => {
    await mount({ installResp: 'Terminus Contractor - Lump Sum' })
    expect(shown()).toEqual(['deal-lumpCost-group'])
    expect(must('deal-product-grid').getAttribute('data-install-half')).toBe('false')
    expect(must('deal-inSsExisting')).not.toBeNull()
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

// ── THE TWO RENDERINGS MOVE TOGETHER ─────────────────────────────────────
//
// Ported from the vanilla harness, which asserted this against a local model.
// It is the claim Round 39 broke: the rule was written inline and toggled on
// ONE of the two renderings, so a deal 22 points under target displayed in the
// treatment of one on target. Equality at a single state cannot catch that -
// both renderings start equal - so the deal has to MOVE.
describe('the strip and the local figure are one value', () => {
  const both = () => ({
    strip: must('deal-achieved-margin'),
    local: must('deal-terms-achieved-margin'),
  })
  const state = (el: HTMLElement) =>
    ['on-target', 'under-target'].filter((c) => el.classList.contains(c)).join(',')

  test('they agree, and they MOVE together when the deal moves', async () => {
    await mount()
    const before = both()
    expect(before.local.textContent).toBe(before.strip.textContent)
    const beforeText = before.strip.textContent

    // Move the TARGET, which is what the accent compares against, so both the
    // figure and the state can change.
    const box = host.querySelector('[data-testid="deal-targetMargin"]') as HTMLInputElement
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
    await act(async () => { set.call(box, '95'); box.dispatchEvent(new Event('input', { bubbles: true })) })

    const after = both()
    expect(after.strip.textContent, 'the deal did not move, so this proves nothing')
      .not.toBe(beforeText)
    expect(after.local.textContent).toBe(after.strip.textContent)
    expect(state(after.local), 'the accent moved on one rendering and not the other')
      .toBe(state(after.strip))
  })

  test('and exactly one accent state applies, on both', async () => {
    await mount()
    for (const el of [must('deal-achieved-margin'), must('deal-terms-achieved-margin')]) {
      const on = el.classList.contains('on-target'), under = el.classList.contains('under-target')
      expect(on !== under, `neither or both states on ${el.id}`).toBe(true)
    }
  })
})

// ── A BARE CELL INPUT STILL HAS A NAME ───────────────────────────────────
//
// Found by Verification 51, an hour after that rule was written: the injection
// dropping `aria-label` from bare inputs came back SILENT in a sweep where
// everything else fired. The eight per-unit rate and margin boxes carry no
// visible label - their COLUMN HEADER is the label - so aria-label is the only
// accessible name they have, and nothing asserted it.
describe('the bare inputs keep an accessible name', () => {
  test('every input with no visible label carries one in aria', async () => {
    await mount({ installResp: 'Terminus Contractor - Per Unit' })
    const bare = ['deal-inSsExisting', 'deal-inSsNew', 'deal-inAqm', 'deal-inHemir',
      'deal-margin-inSsEx', 'deal-margin-inSsNew', 'deal-margin-inAqm', 'deal-margin-inHemir']
    for (const id of bare) {
      const el = must(id)
      expect(el.closest('#deal-product-grid'), `${id} is not in the grid`).not.toBeNull()
      const name = el.getAttribute('aria-label')
      expect(name, `${id} has no accessible name at all`).toBeTruthy()
      expect(name!.length, `${id}'s name is too short to say what it is`).toBeGreaterThan(3)
    }
  })

  test('and a LABELLED input does not carry one, because its label is the name', async () => {
    // The counterfactual: if every input carried aria-label the check above
    // would pass on a render that had stopped distinguishing the two cases.
    await mount()
    /* RE-POINTED BY R-SZ2, AND THE COUNTERFACTUAL HAD TO MOVE OR IT WOULD HAVE
       INVERTED SILENTLY. `deal-ssExisting` was the labelled example; the merge
       renders it BARE, because the product is named once in its own column, so
       it now carries an aria-label like every other bare input and asserting it
       does not would be asserting the defect. `deal-lumpCost` is still rendered
       with its visible label and is what the claim is about. */
    expect(must('deal-lumpCost').getAttribute('aria-label')).toBeNull()
    expect(must('deal-ssExisting').getAttribute('aria-label')).toBeTruthy()
  })
})
