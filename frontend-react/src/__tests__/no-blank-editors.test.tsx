// ── THE ESTATE-WIDE GUARD: NO EDITABLE CONTROL IS EMPTY WHILE ITS VALUE IS ──
//
// The defect class this round exists for: a control renders EMPTY while the
// value it represents exists, either stored on the record or produced by the
// single derivation. A reader then sees a blank box beside a computed total
// and cannot tell whether nothing is set or the screen is not saying.
//
// ── THE ONE DELIBERATE EXCEPTION, AND IT IS EXEMPTED BY DECLARED PROPERTY ──
//
// The old pricing cards' margin boxes are blank ON PURPOSE, per B8/B9
// (`section4.tsx`, from `opportunity-deal.js:379-385`): a blank box prices the
// line at target, and blank is how "this line is not a decision" is said.
// Filling them would delete the distinction between a line FOLLOWING target
// and a line somebody deliberately SET to target.
//
// R-EV3 corrected what those boxes PROMISE rather than what they show, so the
// exemption survives and B8/B9 stands amended rather than superseded.
//
// The exemption is by the class those controls declare, never by a list of ids
// (Verification 19: a named list fails by silent omission), AND the exempted
// set asserts its own completeness against MARGIN_KEYS - so a twelfth margin
// box, or one that quietly leaves the family, turns this red.
import { describe, test, expect } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ShellProvider } from '../ShellContext'
import { shellServices } from '../shell-services'
import { DealPanel } from '../deal/DealPanel'
import { MARGIN_KEYS } from '../deal/payload'
import type { UiState, Values } from '../deal/payload'
import { catalogApi } from './fixtures'

declare global {
  interface Window { api?: (m: string, p: string, b?: unknown) => Promise<unknown> }
}

// EVERY PRICED LINE POPULATED, so a blank box has no innocent explanation
// available to it. Distinct counts throughout, so a box reading the wrong
// line's figure cannot pass by coincidence.
const UI: UiState = {
  installResp: 'Terminus Contractor - Lump Sum', structure: 'twoPhase', invoicing: 'annual',
  grossUp: false, factoringEnabled: false, factoringMethod: 'straight',
  hostingPriceMode: 'margin',
}
const VALUES: Values = {
  'deal-ssExisting': '40', 'deal-ssNew': '25', 'deal-aqm': '12', 'deal-hemir': '8',
  'deal-duration': '36', 'deal-targetMargin': '30', 'deal-warrantyPct': '12',
  'deal-lumpCost': '200000',
  'deal-ssUnitCost': '1000', 'deal-aqUnitCost': '800', 'deal-hemirUnitCost': '1200',
  'deal-hoSafesight': '10', 'deal-hoAqm': '8', 'deal-hoHemir': '12',
}

let host: HTMLElement
const mount = async (values: Values = VALUES) => {
  window.api = catalogApi()
  document.body.innerHTML = '<div id="host"></div>'
  host = document.getElementById('host')!
  const root: Root = createRoot(host)
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  await act(async () => {
    root.render(
      <QueryClientProvider client={qc}>
        <ShellProvider services={shellServices}>
          <DealPanel initialValues={values} initialUi={UI} testBedCost={25000} />
        </ShellProvider>
      </QueryClientProvider>)
  })
  await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
  // THE DRAWERS ARE OPENED, or the editors are not in the document to census.
  // Expand all is a TOGGLE, so its label is read rather than clicked blind.
  const x = host.querySelector<HTMLButtonElement>('[data-testid="stmt-expand-all"]')
  if (x && x.textContent?.trim() === 'Expand all') {
    await act(async () => { x.click() })
  }
  await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
}

const editors = () => [...host.querySelectorAll<HTMLInputElement>('input, select, textarea')]
  .filter((e) => e.type !== 'hidden' && !e.disabled && !e.readOnly)

const isFamilyB = (e: HTMLInputElement) => e.classList.contains('pg-margin-input')

describe('no editable control renders empty while its effective value exists', () => {
  test('G1: the drawers actually opened, so the census is not of an empty page', async () => {
    await mount()
    // THE POPULATION IS ASSERTED BEFORE THE CLAIM ABOUT IT. A census that
    // reached nothing reports the same clean result as a healthy estate
    // (Verification 13), and this round has already been caught by exactly
    // that: the first live census read 0 editable controls on every surface.
    const stmt = host.querySelectorAll('.stmt-edit')
    expect(stmt.length).toBeGreaterThanOrEqual(14)
  })

  test('G2: every statement drawer editor carries a value', async () => {
    await mount()
    const blank = [...host.querySelectorAll<HTMLInputElement>('.stmt-edit')]
      .filter((e) => (e.value ?? '').trim() === '')
      .map((e) => e.getAttribute('data-testid'))
    expect(blank).toEqual([])
  })

  // ── THE LEGITIMATE CASE IS PRESERVED, AND IT IS THE HARD HALF ──────────
  //
  // "No editable control is blank" is the WRONG claim and this test asserted
  // it first: it went red on the milestone rows and the factoring boxes, which
  // are genuinely unset optional fields and are CORRECTLY empty. A guard that
  // demanded they fill would have driven the round into inventing values
  // nobody entered, which is the defect Architecture 11 is about.
  //
  // The claim is narrower and is the round's own: a control is at fault only
  // when something non-empty ANSWERS for it. Here that answer is the record -
  // the values this panel was seeded with - which is the census's own third
  // source of truth.
  test('G3: every control the RECORD has a value for renders it', async () => {
    await mount()
    const seeded = Object.entries(VALUES).filter(([, v]) => String(v ?? '').trim() !== '')
    const blank = seeded
      .map(([id]) => host.querySelector<HTMLInputElement>(`[id="${id}"]`))
      .filter((e): e is HTMLInputElement => !!e && !e.disabled && !e.readOnly)
      .filter((e) => (e.value ?? '').trim() === '')
      .map((e) => e.id)
    expect(blank).toEqual([])
  })

  test('G3b: and a genuinely unset optional field is still allowed to be blank', async () => {
    await mount()
    // The companion to G3 (Verification 14): a rule that only ever forbids
    // blankness would pass just as well on a screen that had filled every box
    // with a zero, and this round's whole point is that a blank must keep
    // meaning "not recorded" where nothing is recorded.
    const unset = editors()
      .filter((e) => !isFamilyB(e))
      .filter((e) => (e.value ?? '').trim() === '')
      .map((e) => e.id)
    expect(unset.length).toBeGreaterThan(0)
    expect(unset.every((id) => !(id in VALUES))).toBe(true)
  })

  test('G4: the exemption is complete, so a new margin box cannot hide in it', async () => {
    await mount()
    // Derived from MARGIN_KEYS rather than typed, so a key added to the family
    // moves this expectation with it. B8/B9 is what these are exempt UNDER.
    const exempt = editors().filter(isFamilyB).map((e) => e.id).sort()
    const possible = MARGIN_KEYS.map((k) => `deal-margin-${k}`)
    expect(exempt.length).toBeGreaterThan(0)
    expect(exempt.every((id) => possible.includes(id))).toBe(true)
  })

  test('G5: and every exempted box states its OWN line margin, not the target', async () => {
    await mount()
    // R-EV3. The warranty line prices at cost, so its placeholder must NOT be
    // the deal's target of 30 - which is the lie this round found.
    const warranty = host.querySelector<HTMLInputElement>('#deal-margin-hwWarranty')
    expect(warranty).not.toBeNull()
    expect(warranty!.placeholder).not.toEqual('30')
    expect(warranty!.title).not.toContain('target margin')
  })
})

describe('R-EV2: a stored override says so, and stops saying it when cleared', () => {
  const box = () => host.querySelector<HTMLInputElement>('[data-testid="stmt-edit-deal-margin-hwSs"]')!
  const set = async (v: string) => {
    const e = box()
    const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
    await act(async () => {
      proto.call(e, v)
      e.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  test('G6: no override, so the box is quiet and shows the derivation', async () => {
    await mount()
    expect(box().getAttribute('data-override')).toBe('false')
    expect(box().classList.contains('stmt-edit-override')).toBe(false)
    expect(box().value).not.toEqual('')
  })

  test('G6b: a box with NO derivation never wears the signal, however full', async () => {
    await mount()
    // The unit counts are editors carrying a stored value and no derivation.
    // They rendered amber and bold until a screenshot showed it, with every
    // assertion in this file green: a signal that is on permanently is not a
    // signal. Asserted on a box that is NOT empty, so it cannot pass by the
    // box simply having nothing in it.
    const unit = host.querySelector<HTMLInputElement>('[data-testid="stmt-edit-deal-ssExisting"]')
    expect(unit).not.toBeNull()
    expect(unit!.value).not.toEqual('')
    expect(unit!.getAttribute('data-override')).toBe('false')
    expect(unit!.classList.contains('stmt-edit-override')).toBe(false)
  })

  test('G7: typing an override turns BOTH signals on, weight and colour', async () => {
    await mount()
    await set('42')
    expect(box().value).toBe('42')
    expect(box().getAttribute('data-override')).toBe('true')
    // The CLASS is the colour and the weight together: the stylesheet binds
    // font-weight beside var(--attention) on this one selector, so a reader
    // who cannot separate amber from white still sees the change.
    expect(box().classList.contains('stmt-edit-override')).toBe(true)
  })

  // ── G8 WAS DECORATIVE AND A SILENT INJECTION SAID SO ───────────────────
  //
  // The first version typed and cleared without ever FOCUSING the box, so
  // `editing` was false throughout and the assertion never reached the path it
  // names. It passed, and it passed just as well with the blur handler
  // inverted: the I4 injection came back SILENT, which is Verification 51's
  // finding rather than Verification 9's.
  //
  // It now drives real focus and blur, which is also what React listens for -
  // onFocus and onBlur are delivered by focusin and focusout, so a dispatched
  // `blur` event would have reached no handler at all.
  test('G8: while focused the box is genuinely empty, so it CAN be cleared', async () => {
    await mount()
    const derived = box().value
    expect(derived).not.toEqual('')
    await act(async () => { box().focus() })
    // The mechanism the whole fallback rests on: without this the first
    // backspace stores empty, the fallback fires on the same render, and the
    // number reappears under the caret.
    expect(box().value).toBe('')
    expect(box().placeholder).toBe(derived)
  })

  test('G8b: clearing returns the DERIVED value on blur, never blank', async () => {
    await mount()
    const derived = box().value
    await act(async () => { box().focus() })
    await set('42')
    expect(box().getAttribute('data-override')).toBe('true')
    await set('')
    expect(box().getAttribute('data-override')).toBe('false')
    expect(box().classList.contains('stmt-edit-override')).toBe(false)
    // The claim is about the RESTING state, so the blur is part of the action
    // rather than a flourish.
    await act(async () => { box().blur() })
    expect(box().value).toBe(derived)
  })
})
