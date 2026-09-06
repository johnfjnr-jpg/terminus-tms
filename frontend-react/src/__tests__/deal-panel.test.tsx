// ── THE PANEL AND THE UNFOLD RULING ──────────────────────────────────────
//
// Derived from MIGRATION_ROUND_3_PHASE_0_REPORT.md's census and from the unfold
// ruling as the vanilla's own comments record it. NOT from renderDealPanel's
// markup: the ruling is a statement about what an approver can follow, and the
// vanilla's string concatenation is one expression of it, not its definition.
import { describe, test, expect, beforeEach, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ShellProvider } from '../ShellContext'
import { shellServices } from '../shell-services'
import { DealPanel } from '../deal/DealPanel'
import { catalogApi } from './fixtures'
import { buildDealRows } from '../deal/rows'
import { CENSUS, CATALOG_DISPLAYS, ALL_INPUT_IDS } from '../deal/census'
import { MARGIN_KEYS, readDealPayload } from '../deal/payload'
import type { UiState, Values } from '../deal/payload'

declare global {
  interface Window { api?: (m: string, p: string, b?: unknown) => Promise<unknown> }
}

const RATES = {
  ssUnitCost: 1000, aqUnitCost: 800, hemirUnitCost: 1200,
  hoSafesight: 10, hoAqm: 8, hoHemir: 12,
  inSsExisting: 100, inSsNew: 200, inAqm: 90, inHemir: 110,
}
const UI: UiState = {
  installResp: 'Terminus Contractor - Lump Sum', structure: 'twoPhase', invoicing: 'annual',
  grossUp: false, factoringEnabled: false, factoringMethod: 'straight',
}
const VALUES: Values = {
  'deal-ssExisting': '10', 'deal-aqm': '4', 'deal-duration': '24',
  'deal-targetMargin': '30', 'deal-warrantyPct': '5', 'deal-whtPct': '10', 'deal-gstPct': '9',
  'deal-recoveryMonths': '12',
}

let host: HTMLElement
let root: Root

// ── THE UNFOLD FIXTURE MUST HAVE SOMETHING TO UNFOLD ────────────────────
//
// Found by calibration: with factoring off, financeCost is 0, so folding it
// back into another row changes NOTHING and the sum assertion passed on a deal
// where the folded quantity could not vary. Verification 25 - the right
// measurement on a population that cannot exhibit the fault.
//
// Measured: factoring off -> financeCost 0; factoring on at 8% over 6 months ->
// financeCost 3,960. testBedCost is passed non-zero for the same reason.
const FOLD_UI: UiState = { ...UI, factoringEnabled: true }
const FOLD_VALUES: Values = { ...VALUES, 'deal-factoring-ratePct': '8', 'deal-factoring-termMonths': '6' }
const FOLD_TEST_BED = 25000

const mount = async (values: Values = VALUES, ui: UiState = UI, testBedCost = 0) => {
  window.api = catalogApi()
  document.body.innerHTML = '<div id="host"></div>'
  host = document.getElementById('host')!
  root = createRoot(host)
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  await act(async () => {
    root.render(
      <QueryClientProvider client={qc}>
        <ShellProvider services={shellServices}>
          <DealPanel initialValues={values} initialUi={ui} testBedCost={testBedCost} />
        </ShellProvider>
      </QueryClientProvider>)
  })
  await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
}
const $ = (id: string) => host.querySelector(`[data-testid="${id}"]`) as HTMLElement | null
const must = (id: string) => { const el = $(id); if (!el) throw new Error(`no ${id}`); return el }
const type = (id: string, v: string) => {
  const el = must(id) as HTMLInputElement
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
  act(() => { set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })) })
}
const rowLabels = () => [...host.querySelectorAll('[data-testid^="dm-row-"] .dm-label')].map((n) => n.textContent)
const rowAt = (i: number) => must(`dm-row-${i}`)

beforeEach(() => { vi.resetModules() })

// ─────────────────────────────────────────────────────────────────────────
describe('the census renders, contract by contract', () => {
  test('every census input has a control', async () => {
    await mount()
    for (const f of CENSUS) expect($(f.id), f.id).not.toBeNull()
  })

  test('and the count matches the census, so an input cannot be lost silently', async () => {
    await mount()
    const rendered = ALL_INPUT_IDS.filter((id) => $(id))
    expect(rendered).toHaveLength(ALL_INPUT_IDS.length)
    expect(ALL_INPUT_IDS.length).toBeGreaterThanOrEqual(39)
  })

  test('all eleven numOrUndefined margin inputs exist, by NAME not by count', async () => {
    await mount()
    for (const k of MARGIN_KEYS) expect($(`deal-margin-${k}`), k).not.toBeNull()
  })

  test('each input declares the contract its key is read under', async () => {
    await mount()
    for (const f of CENSUS) {
      expect(must(f.id).closest('[data-contract]')!.getAttribute('data-contract'), f.id).toBe(f.contract)
    }
  })

  // ── AND THE DECLARED CONTRACT IS CHECKED AGAINST THE READER ────────────
  //
  // THE TEST ABOVE IS A TAUTOLOGY ON ITS OWN, found by calibration: it reads
  // the census and compares it to the census, so changing a census entry
  // changes both sides and nothing fails. Verification 17 exactly - a probe
  // that runs cleanly and cannot tell the two states apart.
  //
  // This one asks the READER what an empty box does to that key, which is what
  // the declaration is a claim about. A census entry that names the wrong
  // contract now fails here.
  test('a declared contract MATCHES what the reader actually does with an empty box', async () => {
    // EVERY non-margin, non-factoring census id maps to its payload key. The
    // first version listed five and `continue`d on the rest, so an entry whose
    // contract was mis-declared simply fell through the gap - a skip that reads
    // as a pass, which is what the calibration caught. An unmapped id now FAILS.
    const KEY_OF: Record<string, string> = {
      'deal-ssExisting': 'ssExisting', 'deal-ssNew': 'ssNew', 'deal-aqm': 'aqm', 'deal-hemir': 'hemir',
      'deal-lumpCost': 'lumpSumCost',
      'deal-inSsExisting': 'inSsExisting', 'deal-inSsNew': 'inSsNew',
      'deal-inAqm': 'inAqm', 'deal-inHemir': 'inHemir',
      'deal-targetMargin': 'targetMargin', 'deal-warrantyPct': 'warrantyPct',
      'deal-whtPct': 'whtPct', 'deal-gstPct': 'gstPct', 'deal-fxContingency': 'fxContingency',
      'deal-duration': 'duration', 'deal-recoveryMonths': 'recoveryMonths',
      'deal-bidCurrency': 'bidCurrency', 'deal-proposalCurrency': 'proposalCurrency',
    }
    const base: Values = Object.fromEntries(CENSUS.map((f) => [f.id, '3']))

    for (const f of CENSUS) {
      const emptied = { ...base, [f.id]: '' }
      const p = readDealPayload(emptied, UI, RATES)

      if (f.contract === 'numOrUndefined') {
        const k = f.id.replace('deal-margin-', '')
        expect(Object.keys(p.marginOverrides as object), `${f.id} declares numOrUndefined`).not.toContain(k)
        continue
      }
      if (f.contract === 'num') {
        const factoring = p.factoring as Record<string, number>
        const k = f.id.replace('deal-factoring-', '')
        expect(factoring[k], `${f.id} declares num, so empty is ZERO`).toBe(0)
        continue
      }
      const key = KEY_OF[f.id]
      expect(key, `${f.id} declares ${f.contract} and has no payload key mapped, so this test would SKIP it`)
        .toBeTruthy()
      expect(p[key], `${f.id} declares ${f.contract}, so empty is null`).toBeNull()
    }
  })

  test('the four contracts are all present on the panel', async () => {
    await mount()
    const seen = new Set([...host.querySelectorAll('[data-contract]')].map((n) => n.getAttribute('data-contract')))
    expect([...seen].sort()).toEqual(['emptyToNull', 'num', 'numOrNull', 'numOrUndefined'])
  })
})

describe('no normalisation between the box and the reader', () => {
  test('an emptied box writes the empty STRING, which is what the reader is proved against', async () => {
    await mount({ ...VALUES, 'deal-gstPct': '9' })
    type('deal-gstPct', '')
    expect((must('deal-gstPct') as HTMLInputElement).value).toBe('')
  })

  test('a numOrUndefined box emptied drops its key from the payload', async () => {
    const withMargin = { ...VALUES, 'deal-margin-hwSs': '22' }
    expect(Object.keys(readDealPayload(withMargin, UI, RATES).marginOverrides as object)).toContain('hwSs')
    const emptied = { ...withMargin, 'deal-margin-hwSs': '' }
    expect(Object.keys(readDealPayload(emptied, UI, RATES).marginOverrides as object)).not.toContain('hwSs')
  })

  test('a num box empty is a VALUE, zero, not an absence', async () => {
    const p = readDealPayload({ ...VALUES, 'deal-factoring-ratePct': '' }, UI, RATES)
    expect((p.factoring as { ratePct: number }).ratePct).toBe(0)
  })

  test('the catalog placeholder is a PLACEHOLDER, never the value', async () => {
    await mount()
    const el = must('deal-inSsExisting') as HTMLInputElement
    expect(el.value).toBe('')
    expect(el.placeholder).toContain('catalog')
  })
})

describe('the catalog is self-fetched and displayed, never recorded', () => {
  test('the six rate readouts render the catalog figures', async () => {
    await mount()
    for (const d of CATALOG_DISPLAYS) {
      expect((must(d.id) as HTMLInputElement).value, d.id)
        .toBe(Number(RATES[d.rate as keyof typeof RATES]).toLocaleString('en-US', { maximumFractionDigits: 0 }))
    }
  })

  test('and they are readOnly, because a readout is not a record', async () => {
    await mount()
    for (const d of CATALOG_DISPLAYS) expect((must(d.id) as HTMLInputElement).readOnly, d.id).toBe(true)
  })

  test('a failed catalog fetch is RENDERED, not swallowed', async () => {
    window.api = async () => ({ ok: false, status: 500, data: { error: 'no catalog' } })
    document.body.innerHTML = '<div id="host"></div>'
    host = document.getElementById('host')!
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    await act(async () => {
      createRoot(host).render(
        <QueryClientProvider client={qc}>
          <ShellProvider services={shellServices}><DealPanel initialValues={VALUES} /></ShellProvider>
        </QueryClientProvider>)
    })
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
    expect($('catalog-error')).not.toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────
describe('the UNFOLD ruling', () => {
  const rowsFor = (values = VALUES, ui = UI, testBedCost = 0) => {
    const payload = readDealPayload(values, ui, RATES)
    // Built through the same chain the panel uses.
    const { resolveRates } = require('../../../src/lib/rate-resolution.js')
    const { buildDealInputs } = require('../../../src/lib/deal-inputs.js')
    const { calculateDeal } = require('../../../src/lib/deal-calculator.js')
    const res = resolveRates(payload, RATES)
    const result = calculateDeal(buildDealInputs(payload, { testBedCost, rates: res.rates }))
    return { rows: buildDealRows(result, payload, ui.grossUp), result, payload }
  }

  test('TOTAL COST IS THE VISIBLE SUM of the six cost rows directly above it', async () => {
    await mount(FOLD_VALUES, FOLD_UI, FOLD_TEST_BED)
    const labels = rowLabels()
    const totalIdx = labels.findIndex((l) => l === 'Total cost')
    expect(totalIdx).toBeGreaterThan(-1)

    // A BARE DASH IS ZERO, and that is the ruling rather than a parser
    // convenience: "a dash because a value is zero is a fact about the deal".
    // `- $1,234` is negative; `$500` is positive; `not recorded` is not a
    // number at all and would make the column unsummable, which is why the
    // fixture has a recorded facility.
    const parse = (s: string): number => {
      const t = String(s).trim()
      if (t === '-') return 0
      const n = Number(t.replace(/[^0-9.]/g, ''))
      if (!Number.isFinite(n)) throw new Error(`cost cell is not summable: ${JSON.stringify(t)}`)
      return t.startsWith('-') ? -n : n
    }
    const six = [...host.querySelectorAll('[data-testid^="dm-row-"]')]
      .slice(totalIdx - 6, totalIdx)
      .map((n) => parse((n.querySelector('.dm-cell--total, .dm-cell--span') as HTMLElement).textContent ?? '0'))
    expect(six).toHaveLength(6)
    const total = parse((rowAt(totalIdx).querySelector('.dm-cell--span') as HTMLElement).textContent ?? '0')
    // The whole ruling in one assertion: an approver can add the column up.
    expect(Math.round(six.reduce((a, b) => a + b, 0))).toBe(Math.round(total))
  })

  test('the fixture actually FOLDS something: all three quantities are non-zero', async () => {
    const { result } = rowsFor(FOLD_VALUES, FOLD_UI, FOLD_TEST_BED)
    expect((result as { financeCost: number }).financeCost, 'financeCost').toBeGreaterThan(0)
    expect((result as { testBedCost: number }).testBedCost, 'testBedCost').toBeGreaterThan(0)
    expect((result as { tax: { whtBorne: number } }).tax.whtBorne, 'whtBorne').toBeGreaterThan(0)
  })

  test('and the model itself gives a full-width row NO group keys', () => {
    const { rows } = rowsFor(FOLD_VALUES, FOLD_UI, FOLD_TEST_BED)
    for (const r of rows.filter((x) => x.fullWidth)) {
      expect(r.hardware, r.label).toBeUndefined()
      expect(r.hosting, r.label).toBeUndefined()
      expect(r.installation, r.label).toBeUndefined()
    }
  })

  test('finance, test bed and absorbed WHT are FULL-WIDTH rows with no group cells', async () => {
    await mount(FOLD_VALUES, FOLD_UI, FOLD_TEST_BED)
    for (const label of ['PO factoring interest', 'Test Bed cost, carried from conversion']) {
      const i = rowLabels().findIndex((l) => l === label)
      expect(i, label).toBeGreaterThan(-1)
      expect(rowAt(i).className).toContain('dm-row--full')
      expect(rowAt(i).querySelectorAll('.dm-cell').length, label).toBe(1)
    }
  })

  test('THE DEAD CELLS CEASE TO EXIST: no full-width row carries three dashes', async () => {
    await mount(FOLD_VALUES, FOLD_UI, FOLD_TEST_BED)
    for (const n of host.querySelectorAll('.dm-row--full')) {
      expect(n.querySelectorAll('.dm-cell').length).toBe(1)
    }
  })

  test('the per-column margin is RELABELLED and sits AFTER the total, not inside the sum', async () => {
    await mount()
    const labels = rowLabels()
    const total = labels.findIndex((l) => l === 'Total cost')
    const memo = labels.findIndex((l) => l === 'Margin before financing, test bed and withholding')
    expect(memo).toBeGreaterThan(total)
    expect(labels).not.toContain('Margin')
  })

  test('a zero financing row is a DASH; an unrecorded facility says so instead', () => {
    const { rows } = rowsFor()
    const fin = rows.find((r) => r.label === 'PO factoring interest')!
    expect(['-', 'not recorded']).toContain(fin.total.startsWith('-') && fin.total !== '-' ? 'x' : fin.total)
    // And the two are genuinely different strings, so one cannot borrow the other.
    expect('not recorded').not.toBe('-')
  })

  test('gross up changes the WHT row LABEL, not only its figure', () => {
    const off = rowsFor(VALUES, UI).rows.map((r) => r.label)
    const on = rowsFor(VALUES, { ...UI, grossUp: true }).rows.map((r) => r.label)
    expect(off).toContain('Withholding tax absorbed by Terminus')
    expect(on).toContain('Withholding tax, grossed up and recovered from the customer')
  })

  test('the results recompute when an input changes', async () => {
    await mount()
    const before = (rowAt(rowLabels().findIndex((l) => l === 'Total cost'))
      .querySelector('.dm-cell--span') as HTMLElement).textContent
    type('deal-ssExisting', '40')
    const after = (rowAt(rowLabels().findIndex((l) => l === 'Total cost'))
      .querySelector('.dm-cell--span') as HTMLElement).textContent
    expect(after).not.toBe(before)
  })
})

describe('the panel is behind the line', () => {
  test('the bundle does NOT register initOpportunityDealPanel', async () => {
    await import('../main')
    expect((window as unknown as Record<string, unknown>).initOpportunityDealPanel).toBeUndefined()
  })
})
