// ── TQ_RESTORE X1: THE COMMERCIALS FORM IS SEEDED PER RECORD ─────────────
//
// Ruling X1 (John, 2026-11-25), from the Phase 0 finding: opening record A's
// Commercials tab and then record B's showed A's values on B, unmarked, and a
// save on B wrote A's values for every key nobody touched (fixture B's
// contract duration 48 overwritten with A's 36, measured from the click by
// scripts/tq-restore/p0-cross-record.mjs).
//
// THE HARNESS IS THE PRODUCTION ENTRY (Verification 47's clause): app.js calls
// `window.initOpportunityDealPanel(opp)` once per record load, and main.tsx
// re-renders ONE root. Mounting <DealPanel> fresh per test cannot see the
// defect, because a fresh mount seeds correctly.
//
// The goldens are the ruling's: A 10/36, B 20/48; open A then B; B shows
// 20/48, unmarked; 21 typed on B and saved; B holds 21/48.
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { act } from 'react'
import { catalogApi } from './fixtures'

type Opp = { id: string, status: string, payload: Record<string, unknown>, opportunity_details: Record<string, unknown> }
const A: Opp = { id: 'opp-a', status: 'Qualification', payload: { ssNew: 10, duration: 36 }, opportunity_details: {} }
const B: Opp = { id: 'opp-b', status: 'Qualification', payload: { ssNew: 20, duration: 48 }, opportunity_details: {} }

let patches: { id: string, body: { payload: Record<string, unknown> } }[] = []
const settle = async () => { for (let i = 0; i < 4; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)) }) }
const input = (id: string) => {
  const el = document.getElementById(id) as HTMLInputElement | null
  if (!el) throw new Error(`no #${id}: the panel did not render`)
  return el
}
const type = (id: string, v: string) => {
  const el = input(id)
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
  act(() => { set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })) })
}
const unmarked = () => !document.querySelector('[data-testid="stmt-unsaved"]')
  && (window as unknown as { dealFormSeam?: { hasUnsavedChanges(): boolean } }).dealFormSeam?.hasUnsavedChanges() === false
const init = async (opp: Opp) => {
  await act(async () => { (window as unknown as { initOpportunityDealPanel(o: Opp): void }).initOpportunityDealPanel(opp) })
  await settle()
}

beforeEach(() => {
  patches = []
  document.body.innerHTML = '<div id="deal-form-root"></div><div class="form-actions"><button id="btn-save-deal"></button><p id="deal-feedback"></p></div>'
  Object.assign(window, {
    api: catalogApi(),
    navigate: () => {},
    detailLoaded: () => {},
    getOppLoadedRevision: () => null,
    oppPatch: async (id: string, body: { payload: Record<string, unknown> }) => { patches.push({ id, body }); return { ok: true, status: 200, data: {} } },
  })
})
afterEach(() => { vi.resetModules() })


describe('X1: the Commercials form and its baseline are seeded per record', () => {
  test('the first record opened shows its own values (the harness renders the panel at all)', async () => {
    await import('../main')
    await init(A)
    expect(input('deal-ssNew').value).toBe('10')
    expect(input('deal-duration').value).toBe('36')
  })

  test('B OPENED AFTER A shows B\'s values, 20 and 48, unmarked', async () => {
    await import('../main')
    await init(A)
    expect(input('deal-ssNew').value, 'precondition: A rendered').toBe('10')
    await init(B)
    expect(input('deal-ssNew').value, 'B shows A\'s units: the form was not reseeded for the new record').toBe('20')
    expect(input('deal-duration').value, 'B shows A\'s duration').toBe('48')
    expect(unmarked(), 'B opened carrying unsaved changes it never had').toBe(true)
  })

  test('A SAVE ON B WRITES B\'S OWN UNTOUCHED VALUES: 21 typed, 48 kept', async () => {
    await import('../main')
    await init(A)
    await init(B)
    type('deal-ssNew', '21')
    const seam = (window as unknown as { dealFormSeam: { freezeCurrentState(): Promise<unknown> } }).dealFormSeam
    await act(async () => { await seam.freezeCurrentState() })
    // NON-EMPTY FIRST (Verification 14): a save that sent nothing passes any
    // per-key assertion made inside a loop over what was sent.
    expect(patches, 'no PATCH was sent, so nothing below is tested').toHaveLength(1)
    expect(patches[0].id, 'the version path saved B\'s screen onto record A').toBe('opp-b')
    expect(patches[0].body.payload.ssNew).toBe(21)
    expect(patches[0].body.payload.duration, 'the save wrote A\'s duration onto B').toBe(48)
  })

  // The other route to the same write: Save changes, #btn-save-deal, which the
  // Phase 0 click measurement used. Two routes, so two tests (Verification 37).
  test('AND THROUGH SAVE CHANGES: 21 typed on B, B holds 21/48', async () => {
    await import('../main')
    await init(A)
    await init(B)
    type('deal-ssNew', '21')
    await act(async () => { document.getElementById('btn-save-deal')!.click() })
    await settle()
    expect(patches, 'no PATCH was sent, so nothing below is tested').toHaveLength(1)
    expect(patches[0].id).toBe('opp-b')
    expect(patches[0].body.payload.ssNew).toBe(21)
    expect(patches[0].body.payload.duration, 'the save wrote A\'s duration onto B').toBe(48)
  })
})
