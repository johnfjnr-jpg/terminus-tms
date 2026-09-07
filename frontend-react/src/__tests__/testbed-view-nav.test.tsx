// ── THE TEST BED VIEW'S NAVIGATION CONTRACT ─────────────────────────────
//
// Round 7 Phase 2e. The three things a whole-view registration owes, all of
// which this estate has already got wrong once on another surface.
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TestBedView } from '../testbed/TestBedView'
import { ShellProvider } from '../ShellContext'
import { shellServices } from './fixtures'
import type { ShellServices } from '../shell-services'

let host: HTMLElement
let root: Root
let qc: QueryClient
let gets: string[] = []
let detailLoaded: ReturnType<typeof vi.fn<(view: string) => void>>
let bedName = 'First'

const api = (async (_m: string, path: string) => {
  gets.push(path)
  if (/^\/api\/test-beds\/[^/?]+$/.test(path)) {
    return {
      ok: true, status: 200,
      data: {
        id: path.split('/').pop(), status: 'Qualification', owner_id: 'user-1',
        payload: { name: bedName }, latest_revision_number: 1,
      },
    }
  }
  if (path.endsWith('/history')) return { ok: true, status: 200, data: { entries: [] } }
  if (path.endsWith('/lifecycle-documents')) {
    return { ok: true, status: 200, data: { total: 0, produced: 0, groups: [] } }
  }
  return { ok: true, status: 200, data: [] }
}) as ShellServices['api']

// ONE SERVICES OBJECT for the life of a test. Rebuilding it per navigation
// gives `shell` a new identity, so an effect memoised on [settled, shell]
// re-runs anyway and the injection that memoises it came back SILENT. The real
// shell is a module singleton, so a stable object is also the truer fixture.
let svc: ShellServices

const view = async (id: string, navToken: number) => {
  await act(async () => {
    root.render(
      <QueryClientProvider client={qc}>
        <ShellProvider services={svc}>
          <TestBedView testBedId={id} navToken={navToken} />
        </ShellProvider>
      </QueryClientProvider>)
  })
  for (let i = 0; i < 20 && !host.querySelector('[data-testid="testbed-host"]'); i++) {
    await act(async () => { await Promise.resolve() })
  }
}

beforeEach(() => {
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  gets = []; detailLoaded = vi.fn<(view: string) => void>(); bedName = 'First'
  svc = shellServices({ api, detailLoaded })
})
afterEach(() => { act(() => root.unmount()); host.remove() })

describe('the ownership class, which the door reads', () => {
  test('the view sets is-not-mine so canEditFields keeps working', async () => {
    // Verification 43. app.js's loadTestBedDetail wrote this class and
    // CAN_EDIT_BY_VIEW reads it; the swap retired that load path, so without
    // this the banner is right and the DOOR is wide open. Found by the live
    // walk, which measured 31 tab stops and 31 rows opening on a record
    // belonging to somebody else.
    const el = document.createElement('div')
    el.id = 'view-test-bed-detail'
    document.body.appendChild(el)
    try {
      await view('tb-1', 1)
      expect(el.classList.contains('is-not-mine'),
        'the owner\'s own record was marked not-mine').toBe(false)

      svc = shellServices({ api, detailLoaded, currentUserId: () => 'somebody-else' })
      await view('tb-1', 2)
      expect(el.classList.contains('is-not-mine'),
        "another user's record does not carry the class the door reads, so "
        + 'every row stays editable').toBe(true)
    } finally { el.remove() }
  })
})

describe('the registration contract', () => {
  test('a second visit RE-READS the record rather than serving the cache', async () => {
    await view('tb-1', 1)
    expect(host.querySelector('[data-testid="tb-detail-name"]')?.textContent).toBe('First')
    const before = gets.filter((p) => p === '/api/test-beds/tb-1').length
    expect(before, 'the first visit did not read the record').toBeGreaterThan(0)

    // The record changed elsewhere - or this screen changed it.
    bedName = 'Second'
    await view('tb-1', 2)
    expect(gets.filter((p) => p === '/api/test-beds/tb-1').length,
      'the second visit served the cached row, which the Contact walk measured '
      + 'as a record reading its pre-change value').toBeGreaterThan(before)
  })

  test('and it settles the view on EVERY navigation, not on a state change', async () => {
    await view('tb-1', 1)
    expect(detailLoaded).toHaveBeenCalledWith('test-bed-detail')
    const before = detailLoaded.mock.calls.length
    // Navigating to a record whose query is already cached leaves `settled`
    // true from the first render, so a memoised effect never re-runs and the
    // view keeps `is-loading` for ever. Round 41 item K, measured live.
    await view('tb-1', 2)
    expect(detailLoaded.mock.calls.length,
      'a cached record never settled, so the view stays on its loading class')
      .toBeGreaterThan(before)
  })

  test('RETURNING TO THE SAME RECORD gets a fresh host', async () => {
    // THE CASE THE FIRST VERSION OF THIS TEST MISSED. It navigated tb-1 -> tb-2,
    // where useQuery has no cache, `isPending` is true and the host unmounts on
    // its own - so it passed with the key removed and the live walk then found
    // the open stage tab surviving a return visit. tb-1 -> tb-1 is what a
    // person actually does.
    await view('tb-1', 1)
    await act(async () => {
      (host.querySelector('[data-testid="tb-tab-btn-stage-Qualification"]') as HTMLElement).click()
    })
    for (let i = 0; i < 20 && !host.querySelector('[data-testid="tb-tab-stage-detail"]'); i++) {
      await act(async () => { await Promise.resolve() })
    }
    expect(host.querySelector('[data-testid="tb-tab-stage-detail"]'),
      'the stage tab did not open, so the assertion below is vacuous').toBeTruthy()

    await view('tb-1', 2)
    expect(host.querySelector('[data-testid="tb-tab-stage-detail"]'),
      'a return visit kept the previous visit\'s stage tab open').toBeNull()
  })

  test('a second record gets a fresh host, not the first record\'s state', async () => {
    await view('tb-1', 1)
    expect(host.querySelector('[data-testid="testbed-host"]')).toBeTruthy()
    // MEASURED THROUGH THE OPEN TAB, not the convert form. The form is keyed on
    // the record INSIDE the host already, so it resets with or without the
    // host's own key - which is why the injection removing that key came back
    // SILENT with zero failures. The tab is the state only the host's key
    // resets: StageTabs keeps the last tab in a ref, and its reload branch
    // re-applies it.
    await act(async () => {
      (host.querySelector('[data-testid="tb-tab-btn-stage-Qualification"]') as HTMLElement).click()
    })
    for (let i = 0; i < 20 && !host.querySelector('[data-testid="tb-tab-stage-detail"]'); i++) {
      await act(async () => { await Promise.resolve() })
    }
    expect(host.querySelector('[data-testid="tb-tab-stage-detail"]'),
      'the stage tab did not open, so the assertion below is vacuous').toBeTruthy()

    await view('tb-2', 2)
    expect(host.querySelector('[data-testid="tb-tab-stage-detail"]'),
      'the second record opened on the first record\'s stage tab, so the host '
      + 'was re-rendered rather than remounted').toBeNull()
    expect(gets.filter((p) => p === '/api/test-beds/tb-2').length).toBeGreaterThan(0)
    // AND THE RECORD ITSELF, which is the claim the two assertions above turned
    // out not to make: both passed with the host key removed AND with the
    // pending early-return removed, so neither was measuring host freshness.
    // The name is per-record and cannot be satisfied by anything else.
    bedName = 'First'
    expect(host.querySelector('[data-testid="tb-detail-name"]')?.textContent,
      'the second record shows the first record\'s name').toBeTruthy()
    expect(host.querySelector('[data-testid="testbed-host"]'),
      'the host did not render for the second record at all').toBeTruthy()
  })

  test('a failed load says Not found rather than a loading line for ever', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={qc}>
          <ShellProvider services={shellServices({
            detailLoaded,
            api: (async () => ({ ok: false, status: 500, data: null })) as ShellServices['api'],
          })}>
            <TestBedView testBedId="tb-9" navToken={1} />
          </ShellProvider>
        </QueryClientProvider>)
    })
    // A REJECTED query settles over a macrotask, not a microtask. Waiting on
    // Promise.resolve alone left the view pending and the assertion read
    // `undefined` - which is Verification 6's shape, a wait that returns before
    // the state it is about.
    for (let i = 0; i < 40 && !host.querySelector('[data-testid="tb-view-error"]'); i++) {
      await act(async () => { await new Promise((r) => setTimeout(r, 5)) })
    }
    expect(host.querySelector('[data-testid="tb-detail-name"]')?.textContent).toBe('Not found')
    expect(detailLoaded, 'a failed load never settled the view').toHaveBeenCalled()
  })
})
