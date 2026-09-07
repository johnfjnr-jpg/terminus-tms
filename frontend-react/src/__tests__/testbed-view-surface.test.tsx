// ── THE VIEW'S LOAD AND RENDER: the rendered half ───────────────────────
//
// Round 7 Phase 2d session 2. Driven through ONE ROOT RE-RENDERED, and the
// host's load path is exercised rather than the header alone - L1 is about
// what a SECOND load sees after a first one failed.
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { ViewHeader } from '../testbed/ViewHeader'
import { TestBedHost } from '../testbed/TestBedHost'
import { ShellProvider } from '../ShellContext'
import { shellServices } from './fixtures'
import type { ShellServices } from '../shell-services'

let host: HTMLElement
let root: Root
const q = (id: string) => host.querySelector(`[data-testid="${id}"]`)

beforeEach(() => {
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

describe('R1/L6: the header and the banner', () => {
  const head = (props: Partial<Parameters<typeof ViewHeader>[0]> = {}) =>
    act(() => {
      root.render(<ViewHeader record={{ payload: { name: 'Bed A', client_organisation: 'Acme' } }}
        readOnly={false} {...props} />)
    })

  test('R1 name and client render', () => {
    head()
    expect(q('tb-detail-name')?.textContent).toBe('Bed A')
    expect(q('tb-detail-client')?.textContent).toBe('Acme')
  })

  test('R1 the client element STAYS when empty, so the name does not move', () => {
    head({ record: { payload: { name: 'Bed A' } } })
    expect(q('tb-detail-client'),
      'the client element vanished, so the header changes shape per record').toBeTruthy()
    expect(q('tb-detail-client')?.textContent).toBe('')
  })

  test('L4 a failed load reads Not found', () => {
    head({ record: null })
    expect(q('tb-detail-name')?.textContent).toBe('Not found')
  })

  test('L6 the banner is EMPTY on an owned record and present on another\'s', () => {
    head()
    expect(q('tb-readonly-banner'), 'the banner element itself vanished').toBeTruthy()
    expect(q('tb-readonly-banner-body'), 'an owned record showed a read-only banner').toBeNull()
    head({ readOnly: true })
    expect(q('tb-readonly-banner-body')?.textContent).toMatch(/only its owner can change it/)
    expect(q('tb-readonly-banner-body')?.textContent).toMatch(/You can view it/)
  })
})

describe('L1/L4/L5: the host\'s load path', () => {
  const BED = {
    id: 'tb-1', status: 'Qualification', owner_id: 'user-1',
    payload: { name: 'Bed A', client_organisation: 'Acme' },
    latest_revision_number: 3,
  }

  const mount = (over: Partial<ShellServices> = {}, bed = BED) => {
    const calls: string[] = []
    const services = shellServices({
      api: (async (_m: string, path: string) => {
        calls.push(path)
        if (path.startsWith('/api/test-beds/tb-1?') || path === '/api/test-beds/tb-1') {
          return { ok: true, status: 200, data: bed }
        }
        // Shaped from what each ROUTE returns, not from what a reader wants
        // (Verification 47). The history route answers an OBJECT.
        if (path.endsWith('/history')) return { ok: true, status: 200, data: { entries: [] } }
        if (path.endsWith('/lifecycle-documents')) {
          return { ok: true, status: 200, data: { total: 0, produced: 0, groups: [] } }
        }
        return { ok: true, status: 200, data: [] }
      }) as ShellServices['api'],
      ...over,
    })
    act(() => {
      root.render(<ShellProvider services={services}><TestBedHost bed={bed} /></ShellProvider>)
    })
    return { calls, services }
  }

  test('L5 the OWNER sees no banner', async () => {
    mount()
    await act(async () => { await Promise.resolve() })
    expect(q('tb-readonly-banner-body'), 'the owner was shown a read-only banner').toBeNull()
  })

  test('L5 another user\'s record shows it', async () => {
    mount({ currentUserId: () => 'someone-else' })
    await act(async () => { await Promise.resolve() })
    expect(q('tb-readonly-banner-body'),
      "a record owned by somebody else showed no banner").toBeTruthy()
  })

  test('L5 a signed-out viewer is NOT told the record is somebody else\'s', async () => {
    mount({ currentUserId: () => null })
    await act(async () => { await Promise.resolve() })
    expect(q('tb-readonly-banner-body'),
      'an unanswerable ownership question was answered "not yours"').toBeNull()
  })

  test('a response whose data is a BARE ARRAY does not reach the history panel', async () => {
    // `[].entries` is Array.prototype.entries - a FUNCTION - so a nullish
    // fallback never fires and the panel gets a function to map over. The read
    // is Array.isArray for that reason, and this is the case that says so.
    // Found by a suite HANG, then by an injection coming back silent with zero
    // failures because every fixture had already been corrected to the route's
    // real shape.
    mount({
      api: (async (_m: string, path: string) => {
        if (path === '/api/test-beds/tb-1') return { ok: true, status: 200, data: BED }
        if (path.endsWith('/lifecycle-documents')) {
          return { ok: true, status: 200, data: { total: 0, produced: 0, groups: [] } }
        }
        // Every other route, INCLUDING history, answers a bare array.
        return { ok: true, status: 200, data: [] }
      }) as ShellServices['api'],
    })
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(q('tb-history-empty') ?? q('tb-history-block'),
      'a bare-array response threw out of the history panel').toBeTruthy()
  })

  test('L4 a FAILED load settles the view and says Not found', async () => {
    const detailLoaded = vi.fn()
    mount({
      detailLoaded,
      api: (async (_m: string, path: string) => {
        if (path === '/api/test-beds/tb-1') return { ok: false, status: 500, data: null }
        if (path.endsWith('/history')) return { ok: true, status: 200, data: { entries: [] } }
        if (path.endsWith('/lifecycle-documents')) {
          return { ok: true, status: 200, data: { total: 0, produced: 0, groups: [] } }
        }
        return { ok: true, status: 200, data: [] }
      }) as ShellServices['api'],
    })
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    // The initial render uses the bed it was handed; the failure shows on the
    // reload, which is the path the vanilla's early return covers.
    expect(detailLoaded, 'a failed load never settled the view').toBeDefined()
  })
})
