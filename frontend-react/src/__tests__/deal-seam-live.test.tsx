// ── THE SEAM AGAINST THE REAL FORM ───────────────────────────────────────
//
// The seam's own tests drive it through mocked sources. These drive it through
// the rendered panel, which is the only place the two behavioural members can
// be shown to work: freezeCurrentState must save a dirty form BEFORE returning
// it, and the restore path must leave the form clean with nothing having been
// told to update.
import { describe, test, expect, beforeEach, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ShellProvider } from '../ShellContext'
import { shellServices } from '../shell-services'
import { DealPanel } from '../deal/DealPanel'
import { catalogApi, CATALOG_PRODUCTS } from './fixtures'
import { catalogToRates } from '../../../src/lib/base-costs.js'
import type { DealFormSeam } from '../deal/seam'
import type { UiState, Values } from '../deal/payload'

// The signature must MATCH the other test files' declaration: `declare global`
// merges across the project, and a narrower one here is a conflict rather than
// a local convenience. Caught by the typecheck stage, which vitest walks past.
declare global { interface Window { api?: (m: string, p: string, b?: unknown) => Promise<unknown> } }

const RATES = { ssUnitCost: 1000, aqUnitCost: 800, hemirUnitCost: 1200, hoSafesight: 10, hoAqm: 8, hoHemir: 12 }
const UI: UiState = {
  installResp: 'Terminus Contractor - Lump Sum', structure: 'twoPhase', invoicing: 'annual',
  grossUp: false, factoringEnabled: false, factoringMethod: 'straight',
}
const V: Values = {
  'deal-ssExisting': '10', 'deal-gstPct': '9', 'deal-duration': '24',
  'deal-targetMargin': '30', 'deal-lumpCost': '200000',
}

let host: HTMLElement
let seam: DealFormSeam
let persisted: Record<string, unknown>[]
let persistError: Error | null

const mount = async () => {
  persisted = []; persistError = null
  window.api = catalogApi()
  document.body.innerHTML = '<div id="host"></div>'
  host = document.getElementById('host')!
  const root: Root = createRoot(host)
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  await act(async () => {
    root.render(
      <QueryClientProvider client={qc}>
        <ShellProvider services={shellServices}>
          <DealPanel initialValues={V} initialUi={UI} testBedCost={0}
            onPersist={async (p) => { if (persistError) throw persistError; persisted.push(p) }}
            onSeamReady={(s) => { seam = s }} />
        </ShellProvider>
      </QueryClientProvider>)
  })
  await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
}
const must = (id: string) => {
  const el = host.querySelector(`[data-testid="${id}"]`) as HTMLElement | null
  if (!el) throw new Error(`no ${id}`); return el
}
const type = (id: string, v: string) => {
  const el = must(id) as HTMLInputElement
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
  act(() => { set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })) })
}
const sectionSaves = () => host.querySelectorAll('[data-testid^="section-save-"]').length

beforeEach(() => { persisted = []; persistError = null })

describe('freezeCurrentState against the real form', () => {
  test('a CLEAN form is not saved, and still returns its state', async () => {
    await mount()
    const frozen = await act(async () => seam.freezeCurrentState())
    expect(persisted).toHaveLength(0)
    expect(frozen.payload.gstPct).toBe(9)
    // ONE SOURCE for the expectation: the rates the shared fixture's products
    // actually derive to, rather than a second hand-kept copy of them.
    expect(frozen.catalogRates).toEqual(catalogToRates(CATALOG_PRODUCTS).rates)
  })

  test('A DIRTY FORM IS SAVED FIRST, and what is returned is what was saved', async () => {
    await mount()
    type('deal-gstPct', '7')
    // NON-ZERO RULE: the form is genuinely dirty before the freeze.
    expect(sectionSaves(), 'the form is not dirty, so the save branch is untested').toBeGreaterThan(0)

    const frozen = await act(async () => seam.freezeCurrentState())
    expect(persisted, 'the dirty form was not saved').toHaveLength(1)
    // The SAVED projection and the RETURNED payload agree on the edited key.
    expect(persisted[0].gstPct).toBe(7)
    expect(frozen.payload.gstPct).toBe(7)
  })

  test('and the save re-baselines, so the form reads clean afterwards', async () => {
    await mount()
    type('deal-gstPct', '7')
    expect(sectionSaves()).toBeGreaterThan(0)
    await act(async () => { await seam.freezeCurrentState() })
    expect(sectionSaves(), 'the section save survived a successful freeze').toBe(0)
    expect(seam.hasUnsavedChanges()).toBe(false)
  })

  // A version taken from a form whose save was refused would freeze a payload
  // the record does not hold.
  test('A REFUSED SAVE THROWS, and the form stays dirty', async () => {
    await mount()
    type('deal-gstPct', '7')
    persistError = new Error('This Opportunity changed since the screen loaded.')
    await expect(act(async () => seam.freezeCurrentState()))
      .rejects.toThrow('changed since the screen loaded')
    expect(sectionSaves(), 'a refused save cleared the dirty state').toBeGreaterThan(0)
    expect(seam.hasUnsavedChanges()).toBe(true)
  })

  test('the contractor base travels in the payload: num needed no member', async () => {
    await mount()
    const frozen = await act(async () => seam.freezeCurrentState())
    expect(frozen.payload.lumpSumCost).toBe(200000)
  })
})

describe('hasUnsavedChanges against the real form', () => {
  test('false on load, true after an edit, false after typing back', async () => {
    await mount()
    expect(seam.hasUnsavedChanges()).toBe(false)
    type('deal-gstPct', '7')
    expect(seam.hasUnsavedChanges()).toBe(true)
    type('deal-gstPct', '9')
    expect(seam.hasUnsavedChanges()).toBe(false)
  })
})

describe('the restore path: updateDirtyState has no successor', () => {
  test('populateForm writes the payload into the form', async () => {
    await mount()
    act(() => { seam.populateForm({ gstPct: 15, ssExisting: 20 }) })
    expect((must('deal-gstPct') as HTMLInputElement).value).toBe('15')
    expect((must('deal-ssExisting') as HTMLInputElement).value).toBe('20')
  })

  // THE ASSERTION THAT MATTERS. The vanilla called updateDirtyState() after
  // populateForm because dirty was PUSHED. Here it is computed against the
  // baseline, so a restore leaves the form dirty against the OLD baseline until
  // the baseline moves - and it does not move on its own.
  test('a restore leaves the form DIRTY against the old baseline, which is correct', async () => {
    await mount()
    expect(sectionSaves()).toBe(0)
    act(() => { seam.populateForm({ gstPct: 15 }) })
    // The restored value differs from what was saved, so there IS something to
    // save. Nothing had to be told: the comparison saw it.
    expect(seam.hasUnsavedChanges(), 'a restored value that differs read as clean').toBe(true)
    expect(sectionSaves()).toBeGreaterThan(0)
  })

  // ── A RESTORED NULL MUST CLEAR THE BOX ─────────────────────────────
  //
  // Added because a calibration DID NOT FIRE: skipping null on restore changed
  // nothing, which meant nothing restored a null. A version can freeze a key as
  // "not recorded", and restoring it must EMPTY the field rather than leave the
  // current value sitting there - otherwise a restore silently keeps a value
  // the version does not have, and the next save writes it back.
  test('restoring a NULL clears the field rather than leaving the old value', async () => {
    await mount()
    // NON-ZERO RULE: the box holds something first, so clearing is observable.
    expect((must('deal-gstPct') as HTMLInputElement).value).toBe('9')
    act(() => { seam.populateForm({ gstPct: null }) })
    expect((must('deal-gstPct') as HTMLInputElement).value,
      'a restored null left the previous value in the box').toBe('')
    // And the payload now reads it as absent, which is the contract.
    expect((seam.recompute() as Record<string, unknown>).gstPct).toBeNull()
  })

  test('and restoring the SAME values leaves it clean, with nothing told', async () => {
    await mount()
    // ── THE PAYLOAD IS COMPLETE, as a real restore's is ──────────────────
    //
    // This passed `{ gstPct: 9 }`, and only passed because populate MERGED
    // into the existing values. The vanilla's populateForm writes every field
    // from the payload, and so does the shared reader, so a partial object
    // now clears everything it omits - correctly. No caller sends one:
    // restoreVersion posts the version's `inputs`, which is whole.
    //
    // Verification 47: a fixture shaped to the implementation tests the
    // implementation. This restores the form's OWN current payload, which is
    // what "the same values" means.
    const same = seam.recompute() as Record<string, unknown>
    act(() => { seam.populateForm(same) })
    expect(seam.hasUnsavedChanges()).toBe(false)
    expect(sectionSaves()).toBe(0)
  })

  test('recompute is available and returns the current payload', async () => {
    await mount()
    type('deal-ssExisting', '12')
    const r = seam.recompute() as Record<string, unknown>
    expect(r.ssExisting).toBe(12)
  })
})

describe('the outward feeds reach the panel', () => {
  test('both are callable on the live seam', async () => {
    await mount()
    expect(seam.oppCurrentVersionRejection()).toBeNull()
    expect(() => seam.oppRefreshVersionActions()).not.toThrow()
  })
})
