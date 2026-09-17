// ── ROUND A PHASE 4: THE RIDERS, THROUGH THE REAL HOST ───────────────────
//
// 4.1 (B5) the transition feedback element carries its id again; 4.2 (R4)
// Back to test beds through the shell's navigation; 4.3 (L9) the six read-only
// identity rows in the vanilla's positions, Age at display time.
//
// The record is GET /api/test-beds/:id as captured by
// scripts/testbed-core/capture-buyers.mjs (bedAfter, which carries reference,
// industry, stage, account and created_at), and the stage list is GET
// /api/stage-definitions as captured by capture-scoring.mjs. Routes no claim
// here is about answer an empty-list stub.
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { TestBedHost } from '../testbed/TestBedHost'
import { ShellProvider } from '../ShellContext'
import { shellServices } from './fixtures'
import type { ShellServices } from '../shell-services'
import BUYERS from './fixtures/buyers-live.json'
import SCORING from './fixtures/scoring-live.json'
import { ageFrom } from '../testbed/identity'
import { formatDate } from '../../../src/lib/format-dates.js'

const BED = BUYERS.bedAfter as unknown as {
  id: string, reference_code: string, status: string, created_at: string,
  industry: { name: string }, account: { name: string }, payload: Record<string, unknown>
}

let host: HTMLElement
let root: Root
beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host) })
afterEach(() => { act(() => root.unmount()); host.remove(); vi.useRealTimers() })

const settle = async () => { for (let i = 0; i < 4; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)) }) }
const $ = (id: string) => host.querySelector(`[data-testid="${id}"]`) as HTMLElement | null

const mount = async (over: Partial<ShellServices> = {}) => {
  const services = shellServices({
    currentUserId: () => (BED as unknown as { owner_id: string }).owner_id,
    api: (async (_m: string, path: string) => {
      if (path === `/api/test-beds/${BED.id}`) return { ok: true, status: 200, data: BED }
      if (path.startsWith('/api/stage-definitions')) return { ok: true, status: 200, data: SCORING.stageDefinitions }
      if (path.endsWith('/history')) return { ok: true, status: 200, data: { entries: [] } }
      return { ok: true, status: 200, data: [] }
    }) as ShellServices['api'],
    ...over,
  })
  act(() => { root.render(<ShellProvider services={services}><TestBedHost bed={BED} /></ShellProvider>) })
  await settle()
}
const tab = async (key: string) => { await act(async () => { $(`tb-tab-btn-${key}`)!.click() }); await settle() }

describe('4.1 the transition feedback element carries its id again', () => {
  test('exactly one element has the id, and it is the feedback element, with the vanilla\'s class', async () => {
    await mount()
    const byId = host.querySelectorAll('#tb-next-stage-feedback')
    expect(byId, 'the shell\'s getElementById target is missing or duplicated').toHaveLength(1)
    expect(byId[0]).toBe($('tb-next-stage-feedback'))
    expect(byId[0].className).toBe('tb-next-stage-feedback')
  })

  test('R8: what the shell writes there SURVIVES tab switches and re-renders (cleared only by the next attempt)', async () => {
    await mount()
    await tab('stage-Qualification')
    const el = () => host.querySelector('#tb-next-stage-feedback') as HTMLElement
    // What attemptTransition writes on a 422 (frontend/app.js), written the same way.
    el().innerHTML = '<p class="msg-error">Transition blocked.</p><ul class="blocking-list"><li>x</li></ul>'
    await tab('reference')
    await tab('commercials')
    await tab('stage-Qualification')
    expect(el().textContent, 'a tab change cleared the blocked list, which R8 rules out').toContain('Transition blocked.')
    expect(el().querySelectorAll('.blocking-list li')).toHaveLength(1)
  })
})

describe('4.2 Back to test beds', () => {
  test('the vanilla\'s button, first in the header, above the title', async () => {
    await mount()
    const back = $('tb-back')!
    expect(back.textContent).toBe('Back to test beds')
    expect(back.className).toBe('btn-text')
    expect(back.id, 'without the id the door disables it on an unowned record').toBe('btn-back-testbeds')
    expect($('tb-view-header')!.firstElementChild).toBe(back)
    expect(back.compareDocumentPosition($('tb-detail-name')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  test('it navigates to the test bed list through the SHELL', async () => {
    const navigate = vi.fn()
    await mount({ navigate })
    await act(async () => { $('tb-back')!.click() })
    expect(navigate).toHaveBeenCalledWith('test-beds')
  })
})

describe('4.3 the six read-only identity rows, in the vanilla\'s positions', () => {
  const keys = (card: string) => [...$(card)!.querySelectorAll('[data-key]')].map((e) => e.getAttribute('data-key'))
  const value = (key: string) => $(`display-${key}`)!.textContent

  test('Terminus Reference under the name; Industry and Stage at the end of Terminus Details', async () => {
    await mount()
    await tab('reference')
    const k = keys('tb-card-terminus')
    expect(k.slice(0, 2)).toEqual(['name', 'tb-id-reference'])
    expect(k.slice(-2)).toEqual(['tb-id-industry', 'tb-id-stage'])
    expect(value('tb-id-reference')).toBe(BED.reference_code)
    expect(value('tb-id-industry')).toBe(BED.industry.name)
    expect(value('tb-id-stage')).toBe(BED.status)
  })

  test('Account first in Customer Details', async () => {
    await mount()
    await tab('reference')
    expect(keys('tb-card-customer')[0]).toBe('tb-id-account')
    expect(value('tb-id-account')).toBe(BED.account.name)
  })

  test('Date Created and Age first in Key Dates, Age computed from created_at at display time', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(new Date(BED.created_at).getTime() + 3 * 86400000 + 3600000))
    await mount()
    await tab('reference')
    expect(keys('tb-card-dates').slice(0, 2)).toEqual(['tb-id-created', 'tb-id-age'])
    expect(value('tb-id-created')).toBe(formatDate(BED.created_at))
    expect(value('tb-id-age')).toBe('3 days')
  })

  test('the rows are READ-ONLY: marked so, no tab stop, and a click opens nothing', async () => {
    await mount()
    await tab('reference')
    for (const k of ['tb-id-reference', 'tb-id-industry', 'tb-id-stage', 'tb-id-account', 'tb-id-created', 'tb-id-age']) {
      const display = $(`display-${k}`)!
      expect(display.closest('.field-row')!.getAttribute('data-readonly'), k).toBe('true')
      expect(display.getAttribute('tabindex'), k).toBeNull()
      await act(async () => { display.click() })
      expect($(`edit-${k}`), `${k} has an edit half`).toBeNull()
    }
  })
})

describe('Age, the vanilla\'s daysAgo rule at its boundaries', () => {
  const T = '2026-09-10T10:00:00.000Z'
  const at = (ms: number) => new Date(T).getTime() + ms
  test('under a day is Today; one day is "1 day"; more is "N days"; floored, not rounded', () => {
    expect(ageFrom(T, at(0))).toBe('Today')
    expect(ageFrom(T, at(86400000 - 1))).toBe('Today')
    expect(ageFrom(T, at(86400000))).toBe('1 day')
    expect(ageFrom(T, at(2 * 86400000 - 1))).toBe('1 day')
    expect(ageFrom(T, at(2 * 86400000))).toBe('2 days')
  })
  test('a missing or unreadable date reads as not recorded, not "NaN days"', () => {
    expect(ageFrom(null, at(0))).toBe('')
    expect(ageFrom('not a date', at(0))).toBe('')
  })
})
