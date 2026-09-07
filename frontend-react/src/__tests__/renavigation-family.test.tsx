// ── THE RE-NAVIGATION FAMILY, ACROSS EVERY REGISTERED VIEW ──────────────
//
// Round 6 Phase 2b. Phase 2 found four defects on the Contact view and they
// were one fact: main.tsx's root.render() RE-RENDERS the component rather than
// mounting a new one, so every mount-shaped assumption stops holding the second
// time somebody navigates to the same record.
//
// The Contact fixes are proven. This asks the question that matters more:
// DO THE TWO SURFACES ALREADY IN PRODUCTION HAVE IT TOO?
//
// Both key detailLoaded on [settled] or [isPending], and both use useQuery
// without a per-navigation signal - so by reading, they should. Reading is not
// measuring, and these are live surfaces, so they are driven rather than
// inspected. Build discipline rule 8: fix the CLASS, not the instance the
// failure happened to name.
import { describe, test, expect, beforeEach, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AccountView } from '../account/AccountView'
import { ApprovalView } from '../ApprovalView'
import { ShellProvider } from '../ShellContext'
import type { ShellServices } from '../shell-services'

let host: HTMLElement
let root: Root
let detailLoadedFor: string[] = []
let fetches: string[] = []
let accountName = 'First Name'

const ACCOUNT = () => ({
  id: 'a-1', reference_code: 'AC-1', revision_number: 2,
  payload: { name: accountName }, parent_account_id: null,
})

const services: ShellServices = {
  api: (async (_m: string, path: string) => {
    fetches.push(path)
    if (path.includes('/terminus-staff')) return { ok: true, status: 200, data: [] }
    if (path.includes('/accounts/')) return { ok: true, status: 200, data: ACCOUNT() }
    if (path.includes('/accounts')) return { ok: true, status: 200, data: [ACCOUNT()] }
    // THE APPROVAL PAGE SETTLES AS AN ERROR, deliberately. What is being
    // measured is whether detailLoaded fires on the SECOND navigation, and an
    // error settles the query exactly as a success does - so the failure path
    // measures the claim without needing the whole approval payload shape.
    // Round 41 item K is about every exit path, and this is one of them.
    if (path.includes('/approval') || path.includes('/opportunities')) {
      return { ok: false, status: 500, data: { error: 'probe' } }
    }
    return { ok: true, status: 200, data: {} }
  }) as ShellServices['api'],
  navigate: vi.fn(),
  detailLoaded: (v: string) => { detailLoadedFor.push(v) },
  getOppLoadedRevision: () => 1,
  canEditFields: () => true,
  requestChangeReason: () => {},
  currentUserEmail: () => 'probe@example.invalid',
  staleWriteHtml: () => null,
  setContactReturnView: () => {},
  confirmDiscard: (p) => { p() },
}

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })

/** Renders the way main.tsx does: ONE root, re-rendered per navigation. */
const renderNav = async (node: React.ReactElement) => {
  await act(async () => {
    root.render(
      <QueryClientProvider client={qc}>
        <ShellProvider services={services}>{node}</ShellProvider>
      </QueryClientProvider>)
  })
  await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
}

beforeEach(() => {
  detailLoadedFor = []; fetches = []; accountName = 'First Name'
  qc.clear()
  document.body.innerHTML = '<div id="host"></div>'
  host = document.getElementById('host')!
  root = createRoot(host)
})

describe('AccountView, driven through a repeat navigation', () => {
  test('detailLoaded fires on EVERY navigation, so is-loading always clears', async () => {
    await renderNav(<AccountView accountId="a-1" navToken={1} />)
    const first = detailLoadedFor.filter((v) => v === 'account-detail').length
    expect(first).toBeGreaterThan(0)
    await renderNav(<AccountView accountId="a-1" navToken={2} />)
    expect(detailLoadedFor.filter((v) => v === 'account-detail').length,
      'the second navigation never cleared is-loading, so the Account view '
      + 'stays hidden behind its loading state').toBeGreaterThan(first)
  })

  test('the record is RE-READ on every navigation, not served from cache', async () => {
    await renderNav(<AccountView accountId="a-1" navToken={1} />)
    const first = fetches.filter((p) => p.includes('/accounts/')).length
    accountName = 'Renamed Elsewhere'
    await renderNav(<AccountView accountId="a-1" navToken={2} />)
    expect(fetches.filter((p) => p.includes('/accounts/')).length,
      'the second navigation served a cached Account, so a rename made '
      + 'anywhere else is invisible').toBeGreaterThan(first)
    expect(host.textContent, 'the screen still shows the stale name')
      .toContain('Renamed Elsewhere')
  })
})

describe('ApprovalView, driven through a repeat navigation', () => {
  test('detailLoaded fires on EVERY navigation', async () => {
    await renderNav(<ApprovalView oppId="o-1" navToken={1} />)
    const first = detailLoadedFor.filter((v) => v === 'opportunity-approval').length
    expect(first).toBeGreaterThan(0)
    await renderNav(<ApprovalView oppId="o-1" navToken={2} />)
    expect(detailLoadedFor.filter((v) => v === 'opportunity-approval').length,
      'the second navigation never cleared is-loading').toBeGreaterThan(first)
  })
})
