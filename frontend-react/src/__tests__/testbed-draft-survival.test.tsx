// ── R1: THE DRAFT STORE SURVIVES A TAB SWITCH ────────────────────────────
//
// TEST BED STATE, R1. `StageTabs` renders each pane conditionally
// (`StageTabs.tsx:210`), so switching away from Reference UNMOUNTS the panel.
// While `TestBedPanel` owned `useFieldRows`, the store went with it and every
// unsaved edit was silently discarded.
//
// DRIVEN THROUGH ONE ROOT, RE-RENDERED, because that is how `main.tsx` invokes
// this view (Verification 47's harness clause). Mounting fresh per assertion is
// the convenient shape, not the real one.
//
// TWO CLAIMS, TWO ASSERTIONS. "The edit survives" and "there is ONE store" are
// different sentences: a panel that remounted and refetched could satisfy the
// first by luck while still holding a second store. The dirty count is what
// separates them - it is the store's own arithmetic, so a second store reads
// zero on a screen that is visibly dirty.
import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { TestBedHost } from '../testbed/TestBedHost'
import { ShellProvider } from '../ShellContext'
import { shellServices } from './fixtures'
import type { ShellServices } from '../shell-services'

let host: HTMLElement
let root: Root

const BED = {
  id: 'tb-1', status: 'Qualification', owner_id: 'user-1',
  payload: { name: 'Bed A', city: 'Kuala Lumpur', client_organisation: 'Acme' },
  latest_revision_number: 3,
}

beforeEach(() => {
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

const $ = (id: string) => host.querySelector(`[data-testid="${id}"]`) as HTMLElement | null
const must = (id: string) => { const el = $(id); if (!el) throw new Error(`no [data-testid="${id}"]`); return el }
const click = (el: HTMLElement) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
const settle = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)) }) }

// A REAL VALUE SETTER, because React's per-input value tracker dedupes a
// plain `.value =` once the component has persisted across renders, and the
// DOM then shows text the component's state never received (Verification 6's
// write clause).
const typeInto = (el: HTMLInputElement, v: string) => {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  act(() => { setter.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })) })
}

const mount = async () => {
  const services = shellServices({
    api: (async (_m: string, path: string) => {
      if (path.startsWith('/api/test-beds/tb-1')) return { ok: true, status: 200, data: BED }
      if (path.endsWith('/history')) return { ok: true, status: 200, data: { entries: [] } }
      if (path.endsWith('/lifecycle-documents')) {
        return { ok: true, status: 200, data: { total: 0, produced: 0, groups: [] } }
      }
      return { ok: true, status: 200, data: [] }
    }) as ShellServices['api'],
  })
  act(() => {
    root.render(<ShellProvider services={services}><TestBedHost bed={BED} /></ShellProvider>)
  })
  await settle()
}

describe('R1: an unsaved edit survives a tab switch', () => {
  test('the typed value is STILL THERE after leaving Reference and coming back', async () => {
    await mount()
    click(must('tb-tab-btn-reference'))
    await settle()

    click(must('display-city'))
    typeInto(must('input-city') as HTMLInputElement, 'Jakarta')
    expect((must('input-city') as HTMLInputElement).value,
      'the edit never landed, so the survival claim has nothing on either side').toBe('Jakarta')

    // Away, and the panel unmounts. This is the destructive act.
    click(must('tb-tab-btn-commercials'))
    await settle()
    expect($('input-city'),
      'the Reference panel did not unmount, so this test cannot see the defect it exists for').toBeNull()

    click(must('tb-tab-btn-reference'))
    await settle()
    expect((must('input-city') as HTMLInputElement)?.value,
      'the unsaved edit was DISCARDED by a tab switch').toBe('Jakarta')
  })

  test('there is ONE store: the dirty count survives with the value', async () => {
    await mount()
    click(must('tb-tab-btn-reference'))
    await settle()
    click(must('display-city'))
    typeInto(must('input-city') as HTMLInputElement, 'Jakarta')

    const before = must('edit-bar').textContent ?? ''
    expect(before, 'the edit bar reported no change, so the count proves nothing').toMatch(/1 CHANGE/i)

    click(must('tb-tab-btn-commercials'))
    await settle()
    click(must('tb-tab-btn-reference'))
    await settle()

    // A SECOND STORE WOULD READ ZERO HERE while the box shows Jakarta, which
    // is exactly the state a remount-and-refetch produces.
    expect(must('edit-bar').textContent ?? '',
      'the count reset, so the panel is reading a DIFFERENT store from the one it typed into').toMatch(/1 CHANGE/i)
  })
})

describe('R1: the date bound follows the LIVE draft', () => {
  // WHY THIS EXISTS. The first calibration injection gave `dateBounds` its own
  // `useFieldRows` and came back SILENT while every other assertion fired.
  // A silence is a finding (Verification 51): the bound reading a live draft
  // rather than the saved value was true, relied on, and asserted nowhere.
  test("typing an install date moves the go-live row's minimum", async () => {
    await mount()
    click(must('tb-tab-btn-reference'))
    await settle()

    click(must('display-estGoLiveDate'))
    const before = (must('input-estGoLiveDate') as HTMLInputElement).min
    click(must('display-estimatedInstallationDate'))
    typeInto(must('input-estimatedInstallationDate') as HTMLInputElement, '2027-03-01')

    const after = (must('input-estGoLiveDate') as HTMLInputElement).min
    expect(after,
      'the go-live minimum ignored an unsaved install date, so the bound is reading a stale store').toBe('2027-03-01')
    expect(after === before,
      'the minimum did not move at all, so this assertion cannot see the thing it is about').toBe(false)
  })
})
