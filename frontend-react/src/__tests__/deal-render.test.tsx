// ── THE RENDER HALVES ────────────────────────────────────────────────────
//
// Session C asserted the four models. These are the facts with a VISUAL half:
// a dash instead of a zero, a leading minus, a colour on a negative, a signpost
// that must appear with its rows, a section save that must exist only when
// needed. Model-level tests cannot see any of them.
//
// The non-zero rule and the independent-expression rule both apply: every
// difference asserted is non-zero and asserted as such, and every computed
// expectation is derived rather than typed.
import { describe, test, expect, beforeEach } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ShellProvider } from '../ShellContext'
import { shellServices } from '../shell-services'
import { DealPanel } from '../deal/DealPanel'
import { catalogApi } from './fixtures'
import { MARGIN_KEYS } from '../deal/payload'
import type { UiState, Values } from '../deal/payload'

declare global { interface Window { api?: (m: string, p: string, b?: unknown) => Promise<unknown> } }

const RATES = {
  ssUnitCost: 1000, aqUnitCost: 800, hemirUnitCost: 1200,
  hoSafesight: 10, hoAqm: 8, hoHemir: 12,
  inSsExisting: 100, inSsNew: 200, inAqm: 90, inHemir: 110,
}
const UI: UiState = {
  installResp: 'Terminus Contractor - Lump Sum', structure: 'twoPhase', invoicing: 'annual',
  grossUp: false, factoringEnabled: true, factoringMethod: 'straight',
}
// ── FIXTURES CHOSEN BY MEASUREMENT, NOT BY GUESS ────────────────────────
//
// Session A's rule: an assertion about a difference needs a fixture where the
// difference is non-zero. Measured across four deal shapes:
//   this one          -> 0 negative cumulative months. The colouring rule is
//                        UNTESTABLE on it.
//   V_CASHNEG below   -> 12 negative and 12 positive. Both signs present.
// And `contractorStaged` is FALSE on every shape measured, so the cash-out row
// is "Hardware, warranty and installation" rather than the staged pair.
const V: Values = {
  'deal-ssExisting': '10', 'deal-aqm': '4', 'deal-duration': '24', 'deal-targetMargin': '30',
  'deal-warrantyPct': '5', 'deal-whtPct': '10', 'deal-gstPct': '9', 'deal-recoveryMonths': '12',
  'deal-lumpCost': '200000', 'deal-factoring-ratePct': '8', 'deal-factoring-termMonths': '6',
}

/** Two-phase, recovery over the full term, annual invoicing: 12 negative and
 *  12 positive cumulative months, so both branches of the colour rule exist. */
const V_CASHNEG: Values = {
  'deal-ssExisting': '10', 'deal-aqm': '4', 'deal-duration': '24', 'deal-targetMargin': '30',
  'deal-warrantyPct': '5', 'deal-whtPct': '10', 'deal-gstPct': '9', 'deal-recoveryMonths': '24',
}
const UI_CASHNEG: UiState = {
  installResp: 'Client Own Installation Team', structure: 'twoPhase', invoicing: 'annual',
  grossUp: false, factoringEnabled: false, factoringMethod: 'straight',
}

let host: HTMLElement
let root: Root
const saved: unknown[] = []

const mount = async (values: Values = V, ui: UiState = UI, testBedCost = 25000) => {
  saved.length = 0
  window.api = catalogApi()
  document.body.innerHTML = '<div id="host"></div>'
  host = document.getElementById('host')!
  root = createRoot(host)
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  await act(async () => {
    root.render(
      <QueryClientProvider client={qc}>
        <ShellProvider services={shellServices}>
          <DealPanel initialValues={values} initialUi={ui} testBedCost={testBedCost}
            onSave={(p) => { saved.push(p) }} />
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
const cfRow = (label: string) => {
  const rows = [...host.querySelectorAll('[data-testid^="cf-row-"]')]
  const found = rows.find((r) => r.querySelector('.cf-label')!.textContent === label)
  if (!found) throw new Error(`no cash-flow row "${label}"; have: ${rows.map((r) => r.querySelector('.cf-label')!.textContent).join(' | ')}`)
  return [...found.querySelectorAll('.cf-cell')] as HTMLElement[]
}

beforeEach(() => { saved.length = 0 })

describe('the cash-flow grid renders its model', () => {
  test('the grid exists with one column per month', async () => {
    await mount()
    const head = must('cashflow-grid').querySelector('.cf-row.head')!
    // 24 months plus the label cell. Derived from the rendered row count rather
    // than typed, so a change in term length cannot silently pass.
    const dataCells = cfRow('Total cash in').length
    expect(head.querySelectorAll('.cf-cell')).toHaveLength(dataCells)
    expect(dataCells).toBeGreaterThan(0)
  })

  test('A ZERO CELL RENDERS AS A DASH, which only the render can show', async () => {
    await mount()
    // Measured: under ANNUAL invoicing the hosting fee is billed once a year,
    // so 22 of 24 months are zero. "Hosting cost" has none and could not have
    // tested this.
    const cells = cfRow('Hosting fee, annual in advance')
    const dashes = cells.filter((c) => c.textContent === '-')
    expect(dashes.length, 'no zero month in this fixture, so the dash is untested').toBeGreaterThan(0)
    expect(cells.some((c) => c.textContent === '0')).toBe(false)
  })

  test('CASH OUT CARRIES A LEADING MINUS, cash in does not', async () => {
    await mount()
    // contractorStaged is false on every measured deal shape, so this is the
    // unstaged label. The staged pair is exercised at model level in Session C.
    const out = cfRow('Hardware, warranty and installation').map((c) => c.textContent ?? '')
    const inn = cfRow('Hosting fee, annual in advance').map((c) => c.textContent ?? '')
    const outNums = out.filter((t) => t !== '-' && t !== '')
    const innNums = inn.filter((t) => t !== '-' && t !== '')
    expect(outNums.length, 'no cash-out figure to check the sign of').toBeGreaterThan(0)
    expect(innNums.length, 'no cash-in figure to contrast with').toBeGreaterThan(0)
    expect(outNums.every((t) => t.startsWith('-'))).toBe(true)
    expect(innNums.every((t) => !t.startsWith('-'))).toBe(true)
  })

  test('A NEGATIVE CUMULATIVE POSITION IS COLOURED, and a positive one is not', async () => {
    await mount(V_CASHNEG, UI_CASHNEG)
    const cells = cfRow('Cumulative cash position')
    const negs = cells.filter((c) => (c.textContent ?? '').startsWith('-'))
    const poss = cells.filter((c) => !(c.textContent ?? '').startsWith('-') && c.textContent !== '-')
    // NON-ZERO RULE, both sides: the fixture must actually contain both signs,
    // or one branch of the rule goes untested and the test still passes.
    expect(negs.length, 'no negative month, so the coloured branch is untested').toBeGreaterThan(0)
    expect(poss.length, 'no positive month, so the uncoloured branch is untested').toBeGreaterThan(0)
    for (const c of negs) expect(c.style.color).toBe('rgb(224, 130, 74)')
    for (const c of poss) expect(c.style.color).not.toBe('rgb(224, 130, 74)')
  })

  test('the factoring rows appear only when the facility is on', async () => {
    await mount(V, { ...UI, factoringEnabled: true })
    expect(() => cfRow('Factoring interest')).not.toThrow()
    await mount(V, { ...UI, factoringEnabled: false })
    expect(() => cfRow('Factoring interest')).toThrow()
  })

  test('closing cash renders through the shared presenter, symbol included', async () => {
    await mount()
    expect(must('cashflow-closing').textContent).toMatch(/\$|not recorded/)
  })
})

describe('the year schedule renders down, not across', () => {
  test('each year is a labelled line, plus a total line', async () => {
    await mount()
    const lines = must('year-schedule').querySelectorAll('.ys-line')
    expect(lines.length).toBeGreaterThan(1)
    expect(lines[lines.length - 1].className).toContain('ys-line--total')
  })

  test('hybrid renders its own list instead', async () => {
    await mount(V, { ...UI, structure: 'hybrid' })
    expect($('hybrid-schedule')).not.toBeNull()
    expect($('year-schedule')).toBeNull()
  })
})

describe('the milestone grids render', () => {
  test('the customer USD cell is READ-ONLY and computed from the percentage', async () => {
    await mount()
    type('deal-ms-0-pct', '25')
    const usd = must('deal-ms-0-usd') as HTMLInputElement
    expect(usd.readOnly).toBe(true)
    expect(Number(usd.value)).toBeGreaterThan(0)
  })

  test('THE ROUND TRIP: typing a contractor percentage fills its dollars', async () => {
    await mount()
    type('deal-cm-0-pct', '25')
    // Derived, not typed: 25% of the lump cost in the fixture.
    expect((must('deal-cm-0-usd') as HTMLInputElement).value)
      .toBe(String(Math.round((25 / 100) * 200000)))
  })

  test('and typing dollars fills the percentage', async () => {
    await mount()
    type('deal-cm-0-usd', '50000')
    expect((must('deal-cm-0-pct') as HTMLInputElement).value).toBe('25')
  })

  test('an unrecognised stored milestone keeps its option in the select', async () => {
    await mount({ ...V, 'deal-cm-0-label': 'Some bespoke stage' })
    const opts = [...(must('deal-cm-0-label') as HTMLSelectElement).options].map((o) => o.textContent)
    expect(opts.some((t) => (t ?? '').includes('not in the list'))).toBe(true)
  })

  test('a non-reconciling schedule shows its difference and marks it off', async () => {
    await mount({ ...V, 'deal-cm-0-month': '1', 'deal-cm-0-usd': '150016' })
    // NON-ZERO RULE: the discrepancy is real.
    expect(must('contractor-total-pct').textContent).not.toBe('100%')
    expect(must('contractor-diff').className).toContain('deal-schedule-off')
  })

  test('a dateless contractor row raises the version warning', async () => {
    await mount({ ...V, 'deal-cm-0-month': '0', 'deal-cm-0-usd': '200000' })
    expect(must('contractor-warn').textContent).toContain('no month')
  })
})

describe('the installation tab: the signpost co-appears with its rows', () => {
  test('per unit shows both', async () => {
    await mount(V, { ...UI, installResp: 'Terminus Contractor - Per Unit' })
    expect(must('install-table').hasAttribute('hidden')).toBe(false)
    expect(must('install-signpost').hasAttribute('hidden')).toBe(false)
  })

  test('lump sum hides both and shows the contractor group', async () => {
    await mount(V, { ...UI, installResp: 'Terminus Contractor - Lump Sum' })
    expect(must('install-table').hasAttribute('hidden')).toBe(true)
    expect(must('install-signpost').hasAttribute('hidden')).toBe(true)
    expect(must('install-contractor-group').hasAttribute('hidden')).toBe(false)
  })

  test('THEY ARE NEVER OUT OF STEP, across every responsibility', async () => {
    for (const r of ['Terminus Contractor - Per Unit', 'Terminus Contractor - Lump Sum',
      'Client Own Installation Team']) {
      await mount(V, { ...UI, installResp: r })
      expect(must('install-signpost').hasAttribute('hidden'), r)
        .toBe(must('install-table').hasAttribute('hidden'))
    }
  })

  test('the two switches carry their state in the label and in aria', async () => {
    await mount(V, { ...UI, grossUp: false, factoringEnabled: true })
    expect(must('deal-grossUp-toggle').getAttribute('aria-checked')).toBe('false')
    expect(must('deal-grossUp-toggle').textContent).toBe('Gross up disabled')
    expect(must('deal-factoring-toggle').getAttribute('aria-checked')).toBe('true')
    expect(must('deal-factoring-toggle').title).toContain('turn it off')
  })
})

describe('B5 and B6 at render level: section saves by need', () => {
  test('a clean panel shows NO section save anywhere', async () => {
    await mount()
    expect(host.querySelectorAll('[data-testid^="section-save-"]')).toHaveLength(0)
  })

  // ── RE-POINTED, Session E ─────────────────────────────────────────────
  //
  // The claim is unchanged. The SECTION NAMES became the screen's own:
  // `deal-gstPct` is a census 'risk' key and the vanilla renders it in
  // Structural Terms, #deal-section-3. The census label is still what
  // sectionOfKey answers; what changed is that the save button belongs to the
  // section the input SITS IN, which is what the vanilla groups by.
  test('editing a section CREATES its save, and only its own', async () => {
    await mount()
    type('deal-gstPct', '7')
    expect($('section-save-deal-section-3'), 'the edited section has no save').not.toBeNull()
    expect($('section-save-deal-sections-1-2'), 'an untouched section grew a save').toBeNull()
  })

  test('and editing back DESTROYS it again', async () => {
    await mount()
    type('deal-gstPct', '7')
    expect($('section-save-deal-section-3')).not.toBeNull()
    type('deal-gstPct', '9')
    expect($('section-save-deal-section-3')).toBeNull()
  })

  test('B6: a section save saves the WHOLE sheet, and says so', async () => {
    await mount()
    type('deal-gstPct', '7')
    const btn = must('section-save-deal-section-3')
    expect(btn.title).toContain('whole deal sheet')
    act(() => { btn.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    expect(saved).toHaveLength(1)
    // The WHOLE payload, not the section's keys.
    expect(Object.keys(saved[0] as object).length).toBeGreaterThan(20)
  })
})

describe('the empty-state contracts at render level', () => {
  test('a numOrUndefined box shows "no override" and holds no value', async () => {
    await mount()
    // ── RE-POINTED, Session E ─────────────────────────────────────────
    //
    // The claim is unchanged: a numOrUndefined box holds no value and says so
    // in its placeholder. WHERE it is measured moved, because the seven
    // pricing-card margins now carry the vanilla's own treatment - the TARGET
    // as the placeholder, since a blank box prices at target
    // (opportunity-deal.js:382). 'no override' was a React invention.
    //
    // The four installation margins keep the generic treatment, so they are
    // where the generic contract is asserted. Both are covered: the card
    // treatment is asserted in deal-section4.test.tsx B8.
    for (const k of ['inSsEx', 'inSsNew', 'inAqm']) {
      const el = must(`deal-margin-${k}`) as HTMLInputElement
      expect(el.value).toBe('')
      expect(el.placeholder).toBe('no override')
    }
  })

  test('an installation override shows the CATALOG as placeholder, never as value', async () => {
    await mount()
    const el = must('deal-inSsExisting') as HTMLInputElement
    expect(el.value).toBe('')
    expect(el.placeholder).toContain('catalog')
    // Derived from the fixture rather than typed.
    expect(el.placeholder).toContain(String(RATES.inSsExisting))
  })

  test('a num box shows "0" as its placeholder, because empty IS zero there', async () => {
    await mount()
    expect((must('deal-factoring-ratePct') as HTMLInputElement).placeholder).toBe('0')
  })

  test('a numOrNull box says "not recorded"', async () => {
    await mount()
    expect((must('deal-gstPct') as HTMLInputElement).placeholder).toBe('not recorded')
  })

  // ── AN emptyToNull FIELD OFFERS NO NUMERIC KEYPAD ──────────────────────
  //
  // Added because a calibration DID NOT FIRE: changing the inputMode rule
  // changed nothing, which meant nothing asserted it. The two currency fields
  // hold codes, not numbers, and a decimal keypad on them is wrong on a phone
  // and wrong about what the field is - the same declaration-versus-behaviour
  // pairing the contracts are for.
  test('the emptyToNull currency fields get NO inputMode, unlike the numeric ones', async () => {
    await mount()
    for (const id of ['deal-bidCurrency', 'deal-proposalCurrency']) {
      expect((must(id) as HTMLInputElement).getAttribute('inputmode'), id).toBeNull()
    }
    // NON-ZERO RULE: the contrast is real - a numeric field on the same panel
    // does carry one, so this is not asserting a property nothing has.
    expect((must('deal-gstPct') as HTMLInputElement).getAttribute('inputmode')).toBe('decimal')
  })
})
