// ── THE SECTION FRAMES AND THE LATCH ─────────────────────────────────────
//
// Behaviours enumerated from the vanilla before anything was built:
// applyLatches (opportunity-deal.js:782), the click wiring (:1899) and
// renderSectionSaves (:1821).
//
//  L1  four panels latch: deal-sections-1-2, deal-section-3, deal-section-5,
//      deal-section-6. Section 4 has NO latch, because it is the summary.
//  L2  the PANEL carries `is-latched`, not the button.
//  L3  the button reads Show when latched and Hide when not.
//  L4  aria-expanded is the inverse of latched.
//  L5  the button title is the signal sentence when latched, `Hide <label>`
//      when not, and both come from src/lib/latches.js rather than from here.
//  L6  #latch-all reads "Show all" when anything is hidden, "Hide all"
//      otherwise, and its click clears everything if anything is latched and
//      otherwise latches every panel. It RETURNS TO EVERYTHING VISIBLE rather
//      than to a remembered set: there is no remembered set.
//  L7  latching is session only. Nothing about it reaches the payload, so a
//      latched section must not make the form dirty.
//  SS1 a section-save button appears in the latch row of a DIRTY section, and
//      is inserted before the latch button.
import { describe, test, expect } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ShellProvider } from '../ShellContext'
import { shellServices } from '../shell-services'
import { DealPanel } from '../deal/DealPanel'
import { catalogApi } from './fixtures'
import { LATCH_PANELS } from '../../../src/lib/latches.js'
import type { UiState, Values } from '../deal/payload'

declare global {
  interface Window { api?: (m: string, p: string, b?: unknown) => Promise<unknown> }
}

const UI: UiState = {
  installResp: 'Terminus Contractor - Per Unit', structure: 'twoPhase', invoicing: 'annual',
  grossUp: false, factoringEnabled: false, factoringMethod: 'straight',
}
const VALUES: Values = {
  'deal-ssExisting': '40', 'deal-ssNew': '25', 'deal-aqm': '12', 'deal-hemir': '8',
  'deal-duration': '36', 'deal-targetMargin': '30', 'deal-warrantyPct': '12',
  'deal-recoveryMonths': '24', 'deal-gstPct': '9', 'deal-whtPct': '10',
}

let host: HTMLElement
const mount = async (values: Values = VALUES, ui: UiState = UI) => {
  window.api = catalogApi()
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
const el = (id: string) => host.querySelector(`#${id}`) as HTMLElement | null
const must = (id: string) => { const e = el(id); if (!e) throw new Error(`no #${id}`); return e }
const PANEL_IDS = (LATCH_PANELS as readonly { id: string, label: string }[]).map((p) => p.id)

describe('the five sections exist, with the vanilla ids', () => {
  test('every section the vanilla has, and section 4 has no latch', async () => {
    await mount()
    for (const id of ['deal-sections-1-2', 'deal-section-3', 'deal-section-4',
      'deal-section-5', 'deal-section-6']) {
      expect(must(id).classList.contains('deal-section'), id).toBe(true)
    }
    expect(must('deal-sections-1-2').classList.contains('deal-section--intake')).toBe(true)
    // Section 4 is the summary and is not latchable: it is what the latches
    // are FOR, so hiding it would hide the answer rather than the inputs.
    expect(PANEL_IDS).not.toContain('deal-section-4')
    expect(el('latch-deal-section-4')).toBeNull()
  })

  test('the intake row carries its own latch-row modifier', async () => {
    await mount()
    const row = must('deal-sections-1-2').querySelector('.latch-row')!
    expect(row.classList.contains('latch-row--intake')).toBe(true)
  })
})

describe('the latch', () => {
  test('L1/L2/L3/L4: a latched panel is marked, and the button says how to undo it', async () => {
    await mount()
    for (const id of PANEL_IDS) {
      const panel = must(id)
      const btn = must(`latch-${id}`)
      expect(panel.classList.contains('is-latched'), id).toBe(false)
      expect(btn.textContent, id).toBe('Hide')
      expect(btn.getAttribute('aria-expanded'), id).toBe('true')
      await act(async () => { btn.click() })
      expect(must(id).classList.contains('is-latched'), id).toBe(true)
      expect(must(`latch-${id}`).textContent, id).toBe('Show')
      expect(must(`latch-${id}`).getAttribute('aria-expanded'), id).toBe('false')
      await act(async () => { must(`latch-${id}`).click() })
      expect(must(id).classList.contains('is-latched'), id).toBe(false)
    }
  })

  test('L5: the title is the shared sentence, never one written here', async () => {
    await mount()
    const panel = (LATCH_PANELS as readonly { id: string, label: string }[])[0]
    const btn = must(`latch-${panel.id}`)
    expect(btn.title).toBe(`Hide ${panel.label}`)
    await act(async () => { btn.click() })
    // The latched title is signalSentence's, and both of its shapes name the
    // panel, so this asserts the label reaches it rather than restating it.
    expect(must(`latch-${panel.id}`).title).toContain(panel.label)
    expect(must(`latch-${panel.id}`).title).not.toBe(`Hide ${panel.label}`)
  })

  test('L6: hide all, then show all, and it returns to EVERYTHING visible', async () => {
    await mount()
    const all = must('latch-all')
    expect(all.textContent).toBe('Hide all')
    await act(async () => { all.click() })
    expect(must('latch-all').textContent).toBe('Show all')
    for (const id of PANEL_IDS) expect(must(id).classList.contains('is-latched'), id).toBe(true)
    await act(async () => { must('latch-all').click() })
    expect(must('latch-all').textContent).toBe('Hide all')
    for (const id of PANEL_IDS) expect(must(id).classList.contains('is-latched'), id).toBe(false)
  })

  test('L6b: with ONE panel latched, show-all clears rather than latching the rest', async () => {
    await mount()
    await act(async () => { must(`latch-${PANEL_IDS[0]}`).click() })
    expect(must('latch-all').textContent).toBe('Show all')
    await act(async () => { must('latch-all').click() })
    for (const id of PANEL_IDS) expect(must(id).classList.contains('is-latched'), id).toBe(false)
  })

  test('L7: latching is session only, so it does not make the form dirty', async () => {
    await mount()
    expect(host.querySelectorAll('.section-save')).toHaveLength(0)
    await act(async () => { must(`latch-${PANEL_IDS[0]}`).click() })
    expect(host.querySelectorAll('.section-save'),
      'latching produced a save button, so it reached the payload').toHaveLength(0)
  })
})

describe('the one field whose census label and screen placement disagree', () => {
  test('deal-recoveryMonths renders in PAYMENT TERMS, not Structural Terms', async () => {
    // Found by calibration: dropping the exception changed nothing, because
    // nothing asserted it. It is a census 'structural' key and the vanilla
    // renders it beside the invoicing radios, because hardware recovery is a
    // payment-terms question.
    await mount()
    const input = host.querySelector('[data-testid="deal-recoveryMonths"]')
    expect(input, 'the recovery months input is not rendered at all').not.toBeNull()
    expect(input!.closest('.deal-section')!.id).toBe('deal-section-5')
  })

  test('and its save button lands on Payment Terms too', async () => {
    await mount()
    const input = host.querySelector('[data-testid="deal-recoveryMonths"]') as HTMLInputElement
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
    await act(async () => { set.call(input, '36'); input.dispatchEvent(new Event('input', { bubbles: true })) })
    const saves = [...host.querySelectorAll('.section-save')]
    expect(saves).toHaveLength(1)
    // A save over Structural Terms would point at a section the changed field
    // is not in, which is the whole reason the map keys on the FIELD.
    expect(saves[0].closest('.deal-section')!.id).toBe('deal-section-5')
  })
})

describe('the section save', () => {
  test('SS1: it appears in the dirty section only, and before the latch button', async () => {
    await mount()
    expect(host.querySelectorAll('.section-save')).toHaveLength(0)
    // deal-duration lives in section 3; typing in it must not raise a save on
    // any other section.
    const input = host.querySelector('[data-testid="deal-duration"]') as HTMLInputElement
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
    await act(async () => { set.call(input, '48'); input.dispatchEvent(new Event('input', { bubbles: true })) })
    const saves = [...host.querySelectorAll('.section-save')]
    expect(saves).toHaveLength(1)
    const row = saves[0].closest('.latch-row')!
    expect(row.closest('.deal-section')!.id).toBe('deal-section-3')
    // Inserted BEFORE the latch button, which is what keeps the latch at the
    // right-hand end of the row.
    const kids = [...row.children]
    expect(kids.indexOf(saves[0])).toBeLessThan(kids.findIndex((k) => k.classList.contains('latch')))
  })
})
