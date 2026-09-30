// ── R-RS1 to R-RS4: RESET TO TARGET MARGIN ──────────────────────────────
//
// John's rulings 2026-09-30, built to the approved mockup in
// `prototypes/opex-reset/`. Written before the control existed.
//
//   R-RS1  one control beneath the OPEX table, right-aligned, outline dress
//          with a circular-arrow icon, label carrying the deal's target margin
//   R-RS2  shown ONLY when at least one row stores a fee or margin. Otherwise
//          ABSENT from the DOM, nothing in its place. Never under CAPEX.
//   R-RS3  click clears both keys for every row in the FORM state. Unit counts
//          untouched. No dialog: nothing is written until a save, so reopening
//          the record restores the overrides from the server. (R-RS3's
//          original "Discard restores" clause was STRUCK by John 2026-09-30:
//          the Commercials surface has no Discard control.)
//   R-RS4  no new route.
//
// ── WHY "ABSENT" AND NOT "DISABLED" IS ASSERTED ─────────────────────────
//
// The mockup settles it: in the no-overrides picture the rule is there and the
// card simply ends. A disabled control would be a different picture, and a
// hidden-but-present one would leave a control the door has to reason about.
import { describe, test, expect } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { ShellProvider } from '../ShellContext'
import { shellServices } from '../shell-services'
import { DealPanel } from '../deal/DealPanel'
import type { UiState, Values } from '../deal/payload'
import { catalogApi } from './fixtures'

const OPEX: UiState = {
  installResp: 'Terminus Contractor - Lump Sum', structure: 'single', invoicing: 'monthly',
  grossUp: false, factoringEnabled: false, factoringMethod: 'straight',
  hostingPriceMode: 'margin', paymentMode: 'opex',
}
const CAPEX: UiState = { ...OPEX, paymentMode: 'capex', structure: 'twoPhase' }

const BASE: Values = {
  'deal-ssExisting': '11', 'deal-ssNew': '10', 'deal-aqm': '9', 'deal-hemir': '0',
  'deal-duration': '60', 'deal-targetMargin': '30', 'deal-warrantyPct': '0',
  'deal-lumpCost': '300000',
  'deal-ssUnitCost': '8000', 'deal-aqUnitCost': '2000', 'deal-hemirUnitCost': '100000',
  'deal-hoSafesight': '200', 'deal-hoAqm': '100', 'deal-hoHemir': '500',
}
const WITH_FEE: Values = { ...BASE, 'deal-opexfee-ss': '700' }
const WITH_MARGIN: Values = { ...BASE, 'deal-opexmargin-aq': '41' }

let host: HTMLElement
const mount = async (values: Values, ui: UiState = OPEX) => {
  window.api = catalogApi()
  document.body.innerHTML = '<div id="host"></div>'
  host = document.getElementById('host')!
  const root: Root = createRoot(host)
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  await act(async () => {
    root.render(
      <QueryClientProvider client={qc}>
        <ShellProvider services={shellServices}>
          <DealPanel initialValues={values} initialUi={ui} testBedCost={0} />
        </ShellProvider>
      </QueryClientProvider>)
  })
  await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
}

const reset = () => host.querySelector<HTMLButtonElement>('[data-testid="deal-opex-reset"]')
const cell = (id: string) => host.querySelector<HTMLInputElement>(`[data-testid="${id}"]`)
const valueOf = (id: string) => cell(id)?.value ?? '(absent)'
const overrideFlag = (id: string) => cell(id)?.dataset.override ?? '(absent)'
const click = async (el: HTMLElement) => {
  await act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
}

describe('R-RS2: when the control is there at all', () => {
  test('ABSENT with no overrides, and nothing in its place', async () => {
    await mount(BASE)
    expect(reset(), 'the control rendered on a deal with no overrides').toBeNull()
    // Nothing takes its place: no placeholder, no disabled twin, no reserved row.
    expect(host.querySelector('[data-testid="deal-opex-reset-slot"]')).toBeNull()
  })

  test('PRESENT when a row stores a FEE', async () => {
    await mount(WITH_FEE)
    expect(reset(), 'a stored fee did not bring the control').not.toBeNull()
  })

  test('PRESENT when a row stores a MARGIN', async () => {
    await mount(WITH_MARGIN)
    expect(reset(), 'a stored margin did not bring the control').not.toBeNull()
  })

  test('NEVER under CAPEX, even with the keys stored', async () => {
    // CAPEX ignores these keys entirely, so a control offering to clear them
    // would offer to change nothing while implying the deal carries overrides.
    //
    // IT INHERITS THIS rather than checking `paymentMode` itself:
    // `section5.tsx:262` renders `{opexOn ? opex : null}`, so under CAPEX the
    // whole table is absent and the control with it. Recorded so a reader does
    // not go hunting inside OpexTable for a mode check that is not there - and
    // so that MOVING the control out of the table would fail this test rather
    // than silently losing the guarantee.
    await mount(WITH_FEE, CAPEX)
    expect(reset(), 'the control appeared on a CAPEX deal').toBeNull()
    expect(host.querySelector('[data-testid="deal-opex-table"]'),
      'the table itself rendered under CAPEX, so this test no longer proves what it says').toBeNull()
  })
})

describe('R-RS1: the control as the mockup draws it', () => {
  test('the label carries the deal s target margin', async () => {
    await mount(WITH_FEE)
    expect(reset()?.textContent).toContain('Reset to target margin')
    expect(reset()?.textContent).toContain('30')
  })

  test('and it reads the DEAL s target, not a constant', async () => {
    await mount({ ...WITH_FEE, 'deal-targetMargin': '41.5' })
    expect(reset()?.textContent).toContain('41.5')
    expect(reset()?.textContent).not.toContain('30')
  })

  test('it FOLLOWS the table in document order', async () => {
    // The markup half of "beneath the table". jsdom has no layout, so this
    // cannot see WHERE the control renders - and the first build proved that
    // gap expensive: the JSX order was correct and the control rendered ABOVE
    // the table, because `.opex-tables` is a grid that auto-placed an unplaced
    // child into row 1. Every property assertion passed on it.
    //
    // So this asserts what a DOM test honestly can (the order), and the live
    // probe asserts the geometry as a RELATION to the table. Neither alone is
    // the claim.
    await mount(WITH_FEE)
    const table = host.querySelector('[data-testid="deal-opex-table"]')!
    const btn = reset()!
    expect(table, 'no table to order against').not.toBeNull()
    expect(
      table.compareDocumentPosition(btn) & Node.DOCUMENT_POSITION_FOLLOWING,
      'the control does not follow the table in the DOM',
    ).toBeTruthy()
  })

  test('it wears the estate s outline dress and carries the icon', async () => {
    await mount(WITH_FEE)
    // `.btn-sm` is the Key Customer Contacts Add button's class, and it is what
    // makes the label upper case: the markup carries sentence case.
    expect(reset()?.className).toContain('btn-sm')
    expect(reset()?.querySelector('[data-testid="deal-opex-reset-icon"]')).not.toBeNull()
  })
})

describe('R-RS3: what the click does', () => {
  test('it clears BOTH keys on EVERY row', async () => {
    await mount({ ...WITH_FEE, 'deal-opexmargin-aq': '41', 'deal-opexfee-hemir': '900' })
    expect(overrideFlag('deal-opexfee-ss')).toBe('true')
    await click(reset()!)
    for (const id of ['deal-opexfee-ss', 'deal-opexfee-aq', 'deal-opexfee-hemir',
      'deal-opexmargin-ss', 'deal-opexmargin-aq', 'deal-opexmargin-hemir']) {
      expect(overrideFlag(id), `${id} is still stored`).not.toBe('true')
    }
  })

  test('the UNIT COUNTS are untouched', async () => {
    await mount(WITH_FEE)
    await click(reset()!)
    expect(valueOf('deal-ssExisting')).toBe('11')
    expect(valueOf('deal-ssNew')).toBe('10')
    expect(valueOf('deal-aqm')).toBe('9')
  })

  test('and the control disappears, because there is nothing left to reset', async () => {
    await mount(WITH_FEE)
    await click(reset()!)
    expect(reset(), 'the control survived its own click').toBeNull()
  })

  test('the rows RE-DERIVE rather than going blank', async () => {
    await mount(WITH_FEE)
    await click(reset()!)
    const shown = valueOf('deal-opexfee-ss')
    expect(shown, 'the fee cell went empty instead of showing the derived fee').not.toBe('')
    expect(Number(shown), 'the derived fee is not a number').not.toBeNaN()
  })

  test('NO confirmation dialog stands between the click and the clear', async () => {
    await mount(WITH_FEE)
    await click(reset()!)
    // The change is reversible without one: nothing is written until a save,
    // so a modal here would be a second gate on a change the record has not
    // yet seen. (Not "the sticky bar governs" - there is no Discard on this
    // surface; R-RS3 amended 2026-09-30.)
    expect(host.querySelector('[role="dialog"]')).toBeNull()
    expect(overrideFlag('deal-opexfee-ss')).not.toBe('true')
  })
})
