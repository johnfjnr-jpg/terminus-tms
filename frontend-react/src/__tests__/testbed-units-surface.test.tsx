// ── TEST BED UNITS PHASE 3: THE UNIT SURFACE ────────────────────────────
//
// Vanilla parity by capability, from the audit and the vanilla at 54001c5^:
//   L4  the row's four fields, its index and its feedback
//   L2  count correction, per open type, with a mandatory reason
//   L3  a locked count says so WHERE IT IS EDITED, on Commercials
//   R8  the installer search list is CLOSED until somebody types
//
// Through the REAL host, on the routes' own answers captured by
// scripts/testbed-units/capture-units.mjs, with every request recorded.
import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { TestBedHost } from '../testbed/TestBedHost'
import { ShellProvider } from '../ShellContext'
import { shellServices } from './fixtures'
import type { ShellServices } from '../shell-services'
import UNITS from './fixtures/units-live.json'
import SCORING from './fixtures/scoring-live.json'

const BED = UNITS.bedWithCounts as unknown as { id: string, owner_id: string, account_id?: string, payload: Record<string, unknown> }
const INSTALL = 'Installation and Commissioning'
const ROWS = UNITS.unitsWithSerial as Array<{ id: string, type: string, index?: number, serialNumber: string | null, latitude: string | null, longitude: string | null, state: string, revision_number: number | null }>
const TAB_KEY: Record<string, string> = { SafeSight: 'safesightCameras', 'Air Quality': 'airQualitySensors', HEMIR: 'hemirSensors' }
const SAFE = ROWS.find((u) => u.type === 'SafeSight')!

let host: HTMLElement
let root: Root
beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host) })
afterEach(() => { act(() => root.unmount()); host.remove() })

const settle = async () => { for (let i = 0; i < 6; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)) }) }
const $ = (id: string) => host.querySelector(`[data-testid="${id}"]`) as HTMLElement | null
const click = async (id: string) => { await act(async () => { $(id)!.click() }); await settle() }
const setValue = async (el: HTMLElement, value: string, blur = true) => {
  await act(async () => {
    const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value)
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }))
    // React's onBlur is delegated from focusout, not from the non-bubbling blur.
    if (blur) el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
  })
  await settle()
}

const mount = async (over: { accounts?: unknown } = {}) => {
  const calls: Array<{ method: string, path: string, body?: unknown }> = []
  const api = (async (method: string, path: string, body?: unknown) => {
    calls.push({ method, path, body })
    if (path === `/api/test-beds/${BED.id}/units`) return { ok: true, status: 200, data: ROWS }
    if (path === `/api/test-beds/${BED.id}`) return { ok: true, status: 200, data: BED }
    if (path.startsWith('/api/stage-definitions')) return { ok: true, status: 200, data: SCORING.stageDefinitions }
    if (path.startsWith('/api/accounts')) return { ok: true, status: 200, data: over.accounts ?? [
      { id: 'acc-1', payload: { name: 'Looney Tunes Cartoons' } },
      { id: 'acc-2', payload: { name: 'Walt Disney Studios Ltd' } }] }
    if (path.endsWith('/history')) return { ok: true, status: 200, data: { entries: [] } }
    if (method === 'PATCH' && path.includes('/units/')) return { ok: true, status: 200, data: { ...SAFE, serialNumber: 'x' } }
    if (method === 'PATCH' && path === `/api/test-beds/${BED.id}`) return { ok: true, status: 200, data: { ok: true } }
    return { ok: true, status: 200, data: [] }
  }) as ShellServices['api']
  act(() => { root.render(<ShellProvider services={shellServices({ currentUserId: () => BED.owner_id, api })}><TestBedHost bed={BED as never} /></ShellProvider>) })
  await settle()
  await click(`tb-tab-btn-stage-${INSTALL}`)
  return calls
}

describe('L4: the unit row carries the vanilla\'s fields', () => {
  test('index, serial, latitude, longitude and a state select, per row', async () => {
    await mount()
    expect($(`tb-unit-index-${SAFE.id}`)?.textContent, 'the row does not say which unit it is').toBe(String(SAFE.index ?? ''))
    expect($(`tb-unit-serial-${SAFE.id}`)).not.toBeNull()
    expect($(`tb-unit-latitude-${SAFE.id}`), 'latitude has no control').not.toBeNull()
    expect($(`tb-unit-longitude-${SAFE.id}`), 'longitude has no control').not.toBeNull()
    const state = $(`tb-unit-state-select-${SAFE.id}`) as HTMLSelectElement
    expect(state, 'state has no control').not.toBeNull()
    expect([...state.options].map((o) => o.value)).toEqual(['Planned', 'Installed', 'Faulty', 'Removed'])
    expect(state.value).toBe(SAFE.state)
  })

  test('each field saves FLAT through the real route, under its own key', async () => {
    const calls = await mount()
    await setValue($(`tb-unit-latitude-${SAFE.id}`)!, '1.2345')
    await setValue($(`tb-unit-longitude-${SAFE.id}`)!, '103.5')
    await setValue($(`tb-unit-state-select-${SAFE.id}`)!, 'Installed')
    const patches = calls.filter((c) => c.method === 'PATCH' && c.path.includes('/units/'))
    expect(patches.map((p) => p.path)).toEqual(Array(3).fill(`/api/test-beds/${BED.id}/units/${SAFE.id}`))
    expect(patches.map((p) => Object.keys(p.body as object).filter((k) => k !== 'expected_revision')))
      .toEqual([['latitude'], ['longitude'], ['state']])
    expect((patches[0].body as { latitude: string }).latitude).toBe('1.2345')
    expect((patches[2].body as { state: string }).state).toBe('Installed')
  })

  test('the row reports its own save', async () => {
    await mount()
    await setValue($(`tb-unit-latitude-${SAFE.id}`)!, '1.2345')
    expect($(`tb-unit-state-${SAFE.id}`)?.textContent).toBe('Saved')
  })
})

describe('L2: count correction returns, with its mandatory reason', () => {
  test('the open type offers a new count and a reason, and Apply waits for both', async () => {
    await mount()
    const count = $('tb-cc-count') as HTMLInputElement
    const reason = $('tb-cc-reason') as HTMLInputElement
    const apply = $('tb-cc-apply') as HTMLButtonElement
    expect(count, 'no count input').not.toBeNull()
    expect(reason, 'no reason input').not.toBeNull()
    expect(apply.disabled, 'Apply is live with nothing filled in').toBe(true)
    await setValue(count, '5', false)
    expect(apply.disabled, 'Apply went live with no reason').toBe(true)
    await setValue(reason, 'two were never installed', false)
    expect(apply.disabled, 'Apply stayed dead with both filled in').toBe(false)
  })

  test('Apply sends the vanilla\'s body: the payload count plus countCorrectionReason', async () => {
    const calls = await mount()
    await setValue($('tb-cc-count')!, '5', false)
    await setValue($('tb-cc-reason')!, 'two were never installed', false)
    await click('tb-cc-apply')
    const patch = calls.filter((c) => c.method === 'PATCH' && c.path === `/api/test-beds/${BED.id}`).at(-1)
    expect(patch, 'the correction was never sent').toBeTruthy()
    expect((patch!.body as { payload: Record<string, string> }).payload).toEqual({ safesightCameras: '5' })
    expect((patch!.body as { countCorrectionReason: string }).countCorrectionReason).toBe('two were never installed')
  })

  test('a type with no units offers no correction: the count is still an ordinary field', async () => {
    await mount()
    await click(`tb-units-tab-${TAB_KEY.HEMIR}`)
    expect($('tb-cc-apply'), 'a type with no units offered a correction').toBeNull()
  })
})

describe('L3: a locked count says so where it is edited', () => {
  test('the Commercials count for a type with units renders locked, naming where to correct it', async () => {
    await mount()
    await click('tb-tab-btn-commercials')
    const locked = $('tb-count-locked-safesightCameras')
    expect(locked, 'the locked count renders as an ordinary editable field').not.toBeNull()
    expect(locked!.textContent).toContain(String(BED.payload.safesightCameras))
    expect(locked!.textContent).toMatch(/Locked: \d+ units? exist/)
    expect(locked!.textContent).toContain('Installation and Commissioning')
    expect($('display-safesightCameras'), 'the editable row is still offered beside the lock').toBeNull()
  })

  test('a count with no units stays editable', async () => {
    await mount()
    await click('tb-tab-btn-commercials')
    expect($('tb-count-locked-hemirSensors')).toBeNull()
    expect($('display-hemirSensors')).not.toBeNull()
  })
})

describe('R8: the installer list stays closed until somebody types', () => {
  test('a fresh Installation tab shows no Account names', async () => {
    await mount()
    expect($('tb-installer-search'), 'there is no installer search').not.toBeNull()
    expect(host.textContent, 'another Account\'s name is on screen unprompted').not.toContain('Looney Tunes Cartoons')
    expect($('tb-installer-result-acc-1'), 'the list rendered open').toBeNull()
    expect($('tb-installer-nomatch'), 'an empty search claimed there are no matches').toBeNull()
  })

  test('typing opens it, and clearing the box closes it again', async () => {
    await mount()
    await setValue($('tb-installer-search')!, 'looney', false)
    expect($('tb-installer-result-acc-1'), 'typing did not open the list').not.toBeNull()
    expect(host.textContent).toContain('Looney Tunes Cartoons')
    await setValue($('tb-installer-search')!, '', false)
    expect($('tb-installer-result-acc-1'), 'clearing the box left the list open').toBeNull()
  })
})
