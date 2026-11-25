// ── TQ_RESTORE on the Commercials tab: L1, L2, L6, W and G1 ──────────────
//
// Rulings (John, 2026-11-25), spec v2.2 section 14.9. The Commercials list is
// the extracted VersionList and must stay as it was, in look and behaviour,
// apart from listing its own kind (L2). A refused Restore reaches the card's
// feedback line (L6). Closed Won offers no Restore (W, superseding W6). The
// Commercials form is a registered dirty source (G1), through the production
// entry.
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { ShellProvider } from '../ShellContext'
import { shellServices } from '../shell-services'
import { VersionCardHost } from '../versions/VersionCardHost'
import type { VersionSeam } from '../versions/VersionCardHost'
import { catalogApi } from './fixtures'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// Red first in 3402b41, as `test.fails`; plain tests since the build.

const C2 = { id: 'c2', kind: 'commercials', major: 0, minor: 3, status: 'draft', reason: 'second Commercials draft', created_at: '2026-11-24T10:00:00Z', inputs: { ssNew: 12 }, sections: ['units', 'term'] }
const T1 = { id: 't1', kind: 'term_quote', major: 0, minor: 2, status: 'draft', reason: 'a term draft', created_at: '2026-11-23T10:00:00Z', inputs: { units: { safesight: 60 }, termMonths: 120 }, sections: [] }
const C1 = { id: 'c1', major: 0, minor: 1, status: 'draft', reason: 'first, read with no kind', created_at: '2026-11-22T10:00:00Z', inputs: { ssNew: 10 }, sections: ['units'] }

const seam = (): VersionSeam & { populated: unknown[] } => {
  const populated: unknown[] = []
  return {
    populated,
    freezeCurrentState: async () => ({ payload: {}, contractorMilestones: [], catalogRates: {} }),
    hasUnsavedChanges: () => false, readContractorMilestones: () => [],
    populateForm: (p) => { populated.push(p) }, recompute: () => ({}),
  }
}

let host: HTMLElement
let root: Root | null = null
const settle = async () => { for (let i = 0; i < 4; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)) }) }
async function mountHost({ restore, won = false }: { restore?: () => unknown, won?: boolean } = {}) {
  const s = seam()
  const api = async (method: string, path: string) => {
    if (method === 'GET') return { ok: true, data: [C2, T1, C1] }
    if (method === 'POST' && /\/restore$/.test(path)) return restore ? restore() : { ok: true, data: { kind: 'commercials', label: 'V0.3', inputs: { ssNew: 12 } } }
    return { ok: false, data: {} }
  }
  root?.unmount()
  document.body.innerHTML = '<div id="host"></div>'
  host = document.getElementById('host')!
  root = createRoot(host)
  const props = { opportunityId: 'opp-1', seam: s, api: api as never, won }
  await act(async () => {
    root!.render(<QueryClientProvider client={new QueryClient()}><ShellProvider services={shellServices}>
      <VersionCardHost {...(props as unknown as Parameters<typeof VersionCardHost>[0])} />
    </ShellProvider></QueryClientProvider>)
  })
  await settle()
  return s
}
const restoreIds = () => [...host.querySelectorAll('[data-restore-version]')].map((b) => (b as HTMLElement).dataset.restoreVersion)

beforeEach(() => { root?.unmount(); root = null })

describe('L1, L2: the Commercials list', () => {
  test('the ids and the "sections recorded" line the Commercials card always had (unchanged, a plain test both sides)', async () => {
    await mountHost()
    expect(host.querySelector('#deal-version-panel #deal-version-list')).not.toBeNull()
    expect(host.querySelector('#deal-version-range')).not.toBeNull()
    expect(host.textContent).toContain('2 sections recorded')
  })

  test('L2: Commercials rows only: a term version is not listed, and a row read with no kind is Commercials', async () => {
    await mountHost()
    expect(restoreIds()).toEqual(['c2', 'c1'])
  })
})

describe('L6: a refused Restore says why on the card', () => {
  test('a route refusal reaches #deal-version-feedback, and the form is not touched', async () => {
    const s = await mountHost({ restore: () => ({ ok: false, status: 404, data: { error: 'version not found' } }) })
    await act(async () => { (host.querySelector('[data-restore-version="c2"]') as HTMLElement).click() }); await settle()
    expect(host.querySelector('#deal-version-feedback')?.textContent?.trim()).toBe('version not found')
    expect(s.populated).toEqual([])
  })

  test('an accepted Restore still fills the form (unchanged, a plain test both sides)', async () => {
    const s = await mountHost()
    await act(async () => { (host.querySelector('[data-restore-version="c2"]') as HTMLElement).click() }); await settle()
    expect(s.populated).toEqual([{ ssNew: 12 }])
  })
})

describe('W: Closed Won', () => {
  test('no Restore is offered on a won deal', async () => {
    await mountHost({ won: true })
    expect(host.querySelectorAll('.ds-row').length, 'precondition: the rows still render').toBeGreaterThan(0)
    expect(restoreIds()).toEqual([])
  })
})

describe('G1: the Commercials form is a registered dirty source, through the production entry', () => {
  let sources: Map<string, () => boolean>
  beforeEach(() => {
    sources = new Map()
    document.body.innerHTML = '<div id="deal-form-root"></div><div class="form-actions"><button id="btn-save-deal"></button><p id="deal-feedback"></p></div>'
    Object.assign(window, {
      api: catalogApi(), navigate: () => {}, detailLoaded: () => {}, getOppLoadedRevision: () => null,
      oppPatch: async () => ({ ok: true, status: 200, data: {} }),
      tmsRegisterDirtySource: (name: string, fn: () => boolean) => { sources.set(name, fn); return () => { if (sources.get(name) === fn) sources.delete(name) } },
    })
  })
  afterEach(() => { vi.resetModules() })

  test('registered as "commercials": clean at open, dirty after an edit', async () => {
    await import('../main')
    await act(async () => { (window as unknown as { initOpportunityDealPanel(o: unknown): void }).initOpportunityDealPanel({ id: 'opp-a', status: 'Qualification', payload: { ssNew: 10, duration: 36 }, opportunity_details: {} }) })
    await settle()
    expect(sources.get('commercials')?.()).toBe(false)
    const el = document.getElementById('deal-ssNew') as HTMLInputElement
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, '11')
    await act(async () => { el.dispatchEvent(new Event('input', { bubbles: true })) }); await settle()
    expect(sources.get('commercials')?.()).toBe(true)
  })
})
