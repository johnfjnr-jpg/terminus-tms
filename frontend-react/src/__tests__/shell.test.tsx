// ── THE SHELL SEAM ───────────────────────────────────────────────────────
//
// Brief Phase 3 item 2: loadApprovalPage registered, mounts into the existing
// container, detailLoaded fires on success AND on a failing fetch.
//
// Derived from the brief's Phase 2 points 4 and 5, not from main.tsx. The
// import of main.tsx is the thing under test rather than the source of the
// expectations: what is asserted is that ONE global appears, that it fills the
// container the vanilla shell already owns, and that the view always stops
// hiding its body.
import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest'
import { act } from 'react'

const CONTAINER = 'view-opportunity-approval'
const loaded: string[] = []

// The shell's services, as the vanilla app.js provides them: implicit globals
// from a classic script. shell-services.ts reads exactly these.
function installShell(apiImpl: (m: string, p: string) => Promise<unknown>) {
  loaded.length = 0
  Object.assign(window, {
    api: apiImpl,
    navigate: () => {},
    detailLoaded: (v: string) => { loaded.push(v) },
    getOppLoadedRevision: () => null,
  })
}

const settle = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)) }) }

beforeEach(() => {
  document.body.innerHTML = `<div id="${CONTAINER}" class="wrap"></div>`
})
afterEach(() => { vi.resetModules() })

describe('the bundle registers exactly one global', () => {
  test('window.loadApprovalPage is a function after import, and nothing else is added', async () => {
    installShell(async () => ({ ok: true, data: null }))
    const before = new Set(Object.keys(window))
    await import('../main')
    expect(typeof window.loadApprovalPage).toBe('function')

    // ONE global. The revert story is "restore one script tag", and it stays
    // true only while this bundle adds one name.
    const added = Object.keys(window).filter((k) => !before.has(k))
    expect(added).toEqual(['loadApprovalPage'])
  })
})

describe('it mounts into the container the vanilla shell already owns', () => {
  test('a successful fetch renders the view into #view-opportunity-approval', async () => {
    installShell(async (_m, path) => {
      expect(path).toBe('/api/opportunities/opp-1/approval-page')
      return { ok: true, data: PAGE }
    })
    await import('../main')
    await act(async () => { window.loadApprovalPage!('opp-1') })
    await settle()

    const container = document.getElementById(CONTAINER)!
    expect(container.querySelector('[data-testid="approval-view"]')).not.toBeNull()
    expect(container.textContent).toContain('Back to the Opportunity')
    expect(container.textContent).toContain('1. The ask')
  })

  test('point 4: detailLoaded fires on the SUCCESS path', async () => {
    installShell(async () => ({ ok: true, data: PAGE }))
    await import('../main')
    await act(async () => { window.loadApprovalPage!('opp-1') })
    await settle()
    expect(loaded).toContain('opportunity-approval')
  })

  test('point 4 and 5: a FAILING fetch renders the server sentence and still fires detailLoaded', async () => {
    installShell(async () => ({ ok: false, status: 404, data: { error: 'opportunity not found' } }))
    await import('../main')
    await act(async () => { window.loadApprovalPage!('opp-1') })
    await settle()

    const container = document.getElementById(CONTAINER)!
    expect(container.querySelector('[data-testid="approval-error"]')?.textContent)
      .toBe('opportunity not found')
    expect(loaded).toContain('opportunity-approval')

    // The five blocks do NOT render stale content on failure.
    expect(container.querySelector('[data-testid="approval-view"]')).toBeNull()
    expect(container.textContent).not.toContain('1. The ask')
    // And the way back survives.
    expect(container.querySelector('#btn-back-from-approval')).not.toBeNull()
  })

  test('detailLoaded fires even when the container is missing entirely', async () => {
    installShell(async () => ({ ok: true, data: PAGE }))
    await import('../main')
    document.body.innerHTML = ''
    await act(async () => { window.loadApprovalPage!('opp-1') })
    await settle()
    expect(loaded).toContain('opportunity-approval')
  })
})

describe('point 3: the staleness sentence comes from the seam', () => {
  test('a higher held revision extends the subtitle', async () => {
    installShell(async () => ({ ok: true, data: PAGE }))
    window.getOppLoadedRevision = () => 99
    await import('../main')
    await act(async () => { window.loadApprovalPage!('opp-1') })
    await settle()
    const sub = document.getElementById('appr-subtitle')!.textContent!
    expect(sub).toContain('priced at revision 5')
    expect(sub).toContain('the record has since moved to revision 99, so reload before deciding')
  })

  test('and an equal one does not, so the sentence means something', async () => {
    installShell(async () => ({ ok: true, data: PAGE }))
    window.getOppLoadedRevision = () => 5
    await import('../main')
    await act(async () => { window.loadApprovalPage!('opp-1') })
    await settle()
    const sub = document.getElementById('appr-subtitle')!.textContent!
    expect(sub).toContain('priced at revision 5')
    expect(sub).not.toContain('has since moved')
  })
})

// A page produced the way the route produces one. Imported rather than typed
// out: Verification 47 again, and the shell test has no business inventing a
// response shape when the evaluator can produce one.
const { build, payload, version } = await import('./fixtures')
const PAGE = build({ payload: payload(), version: version(), baseline: null })

declare global {
  interface Window {
    api?: (m: string, p: string, b?: unknown) => Promise<unknown>
    navigate?: (v: string, id?: string) => void
    detailLoaded?: (v: string) => void
    getOppLoadedRevision?: () => number | null
  }
}
