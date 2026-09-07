// ── THE FOUR DEFECTS THE LIVE WALK FOUND ────────────────────────────────
//
// Round 6 Phase 2. Every one is the same underlying fact: main.tsx's
// root.render() RE-RENDERS the component instead of mounting a new one, so
// every mount-shaped assumption stops holding on a repeat navigation.
//
// None was visible in jsdom before, because nothing navigated TWICE.
import { describe, test, expect, beforeEach, vi } from 'vitest'
import { shellServices } from './fixtures'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ContactView } from '../contact/ContactView'
import { ShellProvider } from '../ShellContext'
import type { ShellServices } from '../shell-services'

let host: HTMLElement
let root: Root
let detailLoadedCalls = 0
let contactFetches = 0
let navigated: string[] = []
let returnViews: string[] = []
let status = 'Unqualified'

const RECORD = () => ({
  id: 'c-1', payload: { name: 'Ada', company: 'X' },
  industry_id: null, parent_record_id: null, status,
  account: null, latest_revision_number: 3,
})

const services: ShellServices = shellServices({
  api: (async (_m: string, path: string) => {
    if (path.includes('/industries')) return { ok: true, status: 200, data: [] }
    if (path.includes('/accounts')) return { ok: true, status: 200, data: [] }
    if (path.includes('/contacts')) { contactFetches++; return { ok: true, status: 200, data: [RECORD()] } }
    return { ok: true, status: 200, data: {} }
  }) as ShellServices['api'],
  navigate: ((v: string) => { navigated.push(v) }) as ShellServices['navigate'],
  detailLoaded: () => { detailLoadedCalls++ },
  getOppLoadedRevision: () => 1,
  canEditFields: () => true,
  requestChangeReason: () => {},
  currentUserEmail: () => 'probe@example.invalid',
  staleWriteHtml: () => null,
  setContactReturnView: (v) => { returnViews.push(v) },
  confirmDiscard: (p) => { p() },
})

/** Renders the way main.tsx does: ONE root, re-rendered per navigation. */
const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
const renderNav = async (navToken: number) => {
  await act(async () => {
    root.render(
      <QueryClientProvider client={qc}>
        <ShellProvider services={services}><ContactView contactId="c-1" navToken={navToken} /></ShellProvider>
      </QueryClientProvider>)
  })
  await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
}

beforeEach(async () => {
  detailLoadedCalls = 0; contactFetches = 0; navigated = []; returnViews = []
  status = 'Unqualified'
  qc.clear()
  document.body.innerHTML = '<div id="host"></div>'
  host = document.getElementById('host')!
  root = createRoot(host)
})

describe('a repeat navigation is a re-render, not a remount', () => {
  test('detailLoaded fires on EVERY navigation, not only when settled CHANGES', async () => {
    // Keyed on [settled] it fires once: a cached query is settled from the
    // first render, so the dependency never changes and the effect never
    // re-runs - while app.js has just set is-loading expecting it cleared.
    // The live walk found the view stuck at "wrap is-loading" permanently.
    await renderNav(1)
    const afterFirst = detailLoadedCalls
    expect(afterFirst).toBeGreaterThan(0)
    await renderNav(2)
    expect(detailLoadedCalls,
      'the second navigation never cleared is-loading').toBeGreaterThan(afterFirst)
  })

  test('the record is RE-READ on every navigation, so a status change is seen', async () => {
    // useQuery sees no new observer on a re-render, so it serves the cached
    // row. The walk measured a contact still reading Unqualified after it had
    // been qualified, and Back therefore went to leads.
    await renderNav(1)
    const afterFirst = contactFetches
    status = 'Qualified'
    await renderNav(2)
    expect(contactFetches, 'the second navigation served cached data').toBeGreaterThan(afterFirst)
    expect(returnViews.at(-1), 'the return view followed a stale status').toBe('contacts')
  })

  test('the return view is published for both statuses', async () => {
    await renderNav(1)
    expect(returnViews.at(-1)).toBe('leads')
    status = 'Qualified'
    await renderNav(2)
    expect(returnViews.at(-1)).toBe('contacts')
  })

  test('THE BACK BUTTON IS REPRODUCED, because createRoot cleared the original', async () => {
    // The static #btn-back-contact-detail lives in the container React owns,
    // so it is destroyed on first render and app.js's load-time listener is
    // left bound to nothing. The walk found the button simply gone.
    await renderNav(1)
    const back = host.querySelector('#btn-back-contact-detail')
    expect(back, 'the back button is not reproduced, so the view has no way out').not.toBeNull()
    await act(async () => { (back as HTMLElement).click() })
    expect(navigated.at(-1)).toBe('leads')
  })

  test('and Back follows the CURRENT status, not the one the host was seeded with', async () => {
    // useState(contact) seeds once and ignores every later prop, so the host
    // held the pre-qualify record while the view had the new one - and the
    // stale reader was the one deciding where Back went.
    await renderNav(1)
    status = 'Qualified'
    await renderNav(2)
    await act(async () => {
      (host.querySelector('#btn-back-contact-detail') as HTMLElement).click()
    })
    expect(navigated.at(-1), 'Back used the record the host was first given').toBe('contacts')
  })
})
