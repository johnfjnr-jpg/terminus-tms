// ── TQ_RESTORE on the Term quote tab: the list, Restore, the strip, banner B ─
//
// Rulings S, L1 to L7, W, B and T (John, 2026-11-25); spec v2.2 section 14.9
// and cases TR-1 to TR-3. Derived from the rulings and the spec, never from
// the component. FIXTURE PARAMS ONLY (spec 11.8's fixture, T): never live.
//
// TR-1's ruled figure for 80 units at 96 months, 3,978,240.00, is not what the
// fixture prices (4,026,624.00, spec 11.9). The expectation is the ENGINE's on
// the fixture, never a typed number (Verification 20's clause).
//
// AND TR-1 IS BUILT ON A RECORD HOLDING 80/96. The ruled "unsaved edits
// pending" can only be true when the restored quote differs from the record's
// saved one; restoring V1.0 onto a record still holding V1.0's own quote
// changes nothing to save, as on Commercials (measured, Phase 0 P1). Reported.
import { describe, test, expect, beforeEach } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { ShellProvider } from '../ShellContext'
import { shellServices } from '../shell-services'
import { TermQuoteHost } from '../term-quote/TermQuoteTab'
import type { TermOpp } from '../term-quote/TermQuoteTab'
import { tqParams } from '../../../scripts/tests/fixtures/term-quote-params.mjs'
import { termQuoteValue, whatMoved, whatMovedSentence } from '../../../src/lib/term-quote.js'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
class NoopResizeObserver { observe() {} unobserve() {} disconnect() {} }
;(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= NoopResizeObserver

// RED FIRST (the hook refuses a red suite): vitest passes a `test.fails` only
// while it fails, and reports the moment it passes. The build commit replaces
// RED_FIRST with `test`.
const RED_FIRST = test.fails

const SETTINGS_KEYS = ['TERMS', 'COMPARE_TERM', 'PRICE_LADDER_BY_PRODUCT', 'VOLUME_BANDS_BY_PRODUCT', 'HW_UPFRONT_MARGIN', 'MARGIN_FLOOR', 'CURRENCY'] as const
const TODAY = tqParams() as Record<string, unknown> & { costs: Record<string, { hwCost: string, hostingMonthly: string }> }
const MOVED = tqParams('510.00')
const serverState = () => ({
  settings: Object.fromEntries(SETTINGS_KEYS.map((k) => [k, TODAY[k]])),
  costs: Object.fromEntries(Object.entries(TODAY.costs).map(([k, c]) => [k, { ...c, batchLabel: 'fixture', effectiveFrom: '2026-08-27' }])),
  isAdmin: false, updatedAt: '', asOf: '2026-11-25',
})
const Q = (units: number, termMonths: number) => ({ units: { safesight: units, air_quality: 0, hemir: 0 }, termMonths, paymentStructure: 'opex' })
const money = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const tcv = (q: unknown, p: unknown) => (termQuoteValue(q, p) as { tcv: number }).tcv

// The list route's rows, as ruling L4 makes it answer: rates and the frozen ask.
const V11 = { id: 'v11', kind: 'term_quote', major: 1, minor: 1, status: 'draft', reason: 'priced on moved settings', created_at: '2026-11-24T10:00:00Z',
  inputs: Q(60, 120), rates: { params: MOVED }, ask: null }
const V10 = { id: 'v10', kind: 'term_quote', major: 1, minor: 0, status: 'issued', reason: 'first term quote', created_at: '2026-11-23T10:00:00Z', issued_at: '2026-11-23T11:00:00Z',
  inputs: Q(60, 120), rates: { params: TODAY }, ask: { baseTcv: 3414000 }, approval: { state: 'approved' } }
const V01 = { id: 'v01', kind: 'commercials', major: 0, minor: 1, status: 'draft', reason: 'a Commercials draft', created_at: '2026-11-22T10:00:00Z', inputs: { ssNew: 10 }, sections: ['units'] }

type Call = { method: string, path: string, body?: unknown }
function server({ versions = [V11, V10, V01] as unknown[], restore = null as null | ((id: string) => unknown) } = {}) {
  const calls: Call[] = []
  const api = async (method: string, path: string, body?: unknown) => {
    calls.push({ method, path, body })
    if (method === 'GET' && path === '/api/term-pricing') return { ok: true, data: serverState() }
    if (method === 'GET' && /\/deal-sheet-versions$/.test(path)) return { ok: true, data: versions }
    if (method === 'GET' && /^\/api\/deal-sheet-versions\/[^/]+$/.test(path)) {
      const v = (versions as { id: string }[]).find((x) => path.endsWith(x.id)); return { ok: true, data: v ?? {} }
    }
    const m = path.match(/^\/api\/deal-sheet-versions\/([^/]+)\/restore$/)
    if (method === 'POST' && m) {
      if (restore) return restore(m[1])
      const v = (versions as { id: string, kind: string, major: number, minor: number, inputs: unknown }[]).find((x) => x.id === m[1])!
      return { ok: true, data: { version_id: v.id, kind: v.kind, label: `V${v.major}.${v.minor}`, inputs: v.inputs } }
    }
    return { ok: false, status: 404, data: { error: `unexpected ${method} ${path}` } }
  }
  return { api, calls }
}

let host: HTMLElement
let root: Root | null = null
let patches: unknown[] = []
let sources: Map<string, () => boolean>
let prompts: (() => void)[] = []
async function mount(opp: TermOpp, api: (m: string, p: string, b?: unknown) => Promise<unknown>) {
  patches = []; prompts = []; sources = new Map()
  Object.assign(window, {
    api, getOppLoadedRevision: () => 7,
    openDiscardConfirm: (cb: () => void) => { prompts.push(cb) },
    tmsRegisterDirtySource: (name: string, fn: () => boolean) => { sources.set(name, fn); return () => { if (sources.get(name) === fn) sources.delete(name) } },
  })
  root?.unmount()
  document.body.innerHTML = '<div id="host"></div>'
  host = document.getElementById('host')!
  root = createRoot(host)
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  await act(async () => {
    root!.render(<QueryClientProvider client={qc}><ShellProvider services={shellServices}>
      <TermQuoteHost opp={opp} api={api as never} patch={async (_id, b) => { patches.push(b); return { ok: true } }} reload={() => {}} navToken={1} />
    </ShellProvider></QueryClientProvider>)
  })
  await settle()
}
const settle = async () => { for (let i = 0; i < 4; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)) }) }
const q = (s: string) => host.querySelector(s) as HTMLElement | null
const text = (s: string) => q(s)?.textContent?.replace(/\s+/g, ' ').trim() ?? null
const click = async (el: HTMLElement | null) => { if (!el) throw new Error('nothing to click'); await act(async () => { el.click() }); await settle() }
const typeUnits = async (v: string) => {
  const el = q('[data-testid="tp-units-safesight"]') as HTMLInputElement
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, v)
  await act(async () => { el.dispatchEvent(new Event('input', { bubbles: true })) }); await settle()
}
const base = () => text('[data-testid="tp-p-base"]')
const strip = () => q('[data-testid="stmt-unsaved"]')
const opp = (over: Partial<TermOpp> = {}): TermOpp => ({ id: 'opp-1', status: 'Proposal',
  payload: { pricingMethod: 'term_quote', termQuote: Q(80, 96) }, working_version: 'V1.1', approved_version: 'V1.0', won_version: null, ...over })
const writes = (calls: Call[]) => calls.filter((c) => c.method !== 'GET' && !/\/restore$/.test(c.path))

beforeEach(() => { root?.unmount(); root = null })

describe('L1 to L3, L7: the Term quote tab lists its own versions', () => {
  RED_FIRST('term rows only, newest first, with the shared row states', async () => {
    const { api } = server()
    await mount(opp(), api)
    const rows = [...host.querySelectorAll('[data-testid="tq-version-row"]')]
    expect(rows.map((r) => r.querySelector('.ds-label')?.textContent?.replace(/\s+/g, ' ').trim())).toEqual(['V1.1 draft', 'V1.0 approved'])
  })

  RED_FIRST('L3: the issued row shows its FROZEN Base TCV; the draft its Base TCV on its OWN stored settings, "as saved"', async () => {
    const { api } = server()
    await mount(opp(), api)
    const figs = [...host.querySelectorAll('[data-testid="tq-version-figure"]')].map((e) => e.textContent?.trim())
    // The draft's own snapshot prices 60/120 at 510.00, which today's 500.00
    // does not: the figure proves which settings priced it.
    expect(tcv(Q(60, 120), MOVED)).not.toBe(tcv(Q(60, 120), TODAY))
    expect(figs).toEqual([`Base TCV ${money(tcv(Q(60, 120), MOVED))} as saved`, `Base TCV ${money(V10.ask.baseTcv)}`])
    expect(host.textContent).not.toMatch(/sections? recorded/)
  })
})

describe('TR-1 and TR-2 (fixture params): Restore is unsaved edits, and Reset goes back', () => {
  RED_FIRST('TR-1: Restore V1.0 over a saved 80/96 reads V1.0\'s figure, "Modified, not saved" showing, nothing written', async () => {
    const { api, calls } = server()
    await mount(opp(), api)
    expect(base(), 'precondition: the tab opens on the record\'s 80/96').toBe(money(tcv(Q(80, 96), TODAY)))
    expect(strip(), 'precondition: nothing is unsaved at open').toBeNull()
    await click(q('[data-testid="tq-version-row"][data-version-id="v10"] [data-restore-version]'))
    expect(base()).toBe('3,414,000.00')
    expect(strip(), 'the restored quote is not shown as unsaved').not.toBeNull()
    expect(patches, 'Restore wrote the record').toEqual([])
    expect(writes(calls), 'Restore created a version or wrote something').toEqual([])
  })

  RED_FIRST('TR-2: then Reset returns to the record\'s saved quote, and the strip goes', async () => {
    const { api } = server()
    await mount(opp(), api)
    await click(q('[data-version-id="v10"] [data-restore-version]'))
    await click(q('[data-testid="stmt-reset"]'))
    expect(base()).toBe(money(tcv(Q(80, 96), TODAY)))
    expect(strip()).toBeNull()
  })

  RED_FIRST('Restore over UNSAVED edits asks the one dialogue first; until it is answered nothing changes', async () => {
    const { api } = server()
    await mount(opp(), api)
    await typeUnits('70')
    await click(q('[data-version-id="v10"] [data-restore-version]'))
    expect(prompts, 'no dialogue: the unsaved edit was overwritten unasked').toHaveLength(1)
    expect((q('[data-testid="tp-units-safesight"]') as HTMLInputElement).value).toBe('70')
    await act(async () => { prompts[0]() }); await settle()
    expect(base()).toBe('3,414,000.00')
  })
})

describe('S: the strip on the Term quote tab', () => {
  RED_FIRST('Save changes writes the record\'s termQuote ONLY, and takes no version', async () => {
    const { api, calls } = server()
    await mount(opp(), api)
    await click(q('[data-version-id="v10"] [data-restore-version]'))
    await click(q('[data-testid="stmt-save"]'))
    expect(patches).toHaveLength(1)
    const sent = patches[0] as { payload: Record<string, unknown> }
    expect(Object.keys(sent)).toEqual(['payload'])
    expect(Object.keys(sent.payload)).toEqual(['termQuote'])
    expect((sent.payload.termQuote as { units: Record<string, number>, termMonths: number }).units.safesight).toBe(60)
    expect((sent.payload.termQuote as { termMonths: number }).termMonths).toBe(120)
    expect(writes(calls), 'Save changes took a version').toEqual([])
  })

  test('a record holding no termQuote opens with nothing unsaved, and the guard reads it clean', async () => {
    const { api } = server({ versions: [] })
    await mount(opp({ payload: { pricingMethod: 'term_quote' } }), api)
    expect(strip()).toBeNull()
    expect(sources.get('term_quote')?.(), 'the tab is not registered with the leave guard').toBe(false)
    await typeUnits('12')
    expect(strip()).not.toBeNull()
    expect(sources.get('term_quote')?.()).toBe(true)
  })
})

describe('B: the banner after a Restore', () => {
  RED_FIRST('a restored version whose stored settings differ from today\'s: the ruled sentence, and the reopened notice gives way', async () => {
    const { api } = server()
    await mount(opp(), api)
    expect(q('[data-testid="tq-reopened"]'), 'precondition: V1.1 is a draft whose snapshot differs, so the reopened notice shows').not.toBeNull()
    await click(q('[data-version-id="v11"] [data-restore-version]'))
    const saved = tcv(Q(60, 120), MOVED), today = tcv(Q(60, 120), TODAY)
    const d = Math.round((today - saved) * 100)
    const diff = `${d >= 0 ? '+' : '-'}${money(Math.abs(d) / 100)}`
    expect(text('[data-testid="tq-restored"]')).toBe(`Restored from V1.1. It was priced at ${money(saved)} on its own settings; today's settings price it at ${money(today)} (${diff}). `
      + `What moved: ${whatMovedSentence(whatMoved(MOVED, TODAY))}. Save changes to keep it as your working quote.`)
    expect(q('[data-testid="tq-reopened"]')).toBeNull()
  })

  RED_FIRST('a restored version whose stored settings are today\'s: no banner', async () => {
    const { api } = server()
    await mount(opp(), api)
    await click(q('[data-version-id="v10"] [data-restore-version]'))
    expect(q('[data-testid="tq-restored"]')).toBeNull()
  })
})

describe('L6 and W', () => {
  RED_FIRST('L6: a refused Restore says why on the version card\'s feedback line', async () => {
    const { api } = server({ restore: () => ({ ok: false, status: 404, data: { error: 'version not found' } }) })
    await mount(opp(), api)
    await click(q('[data-version-id="v10"] [data-restore-version]'))
    expect(text('[data-testid="tq-feedback"]')).toBe('version not found')
    expect(base(), 'a refused restore changed the tab').toBe(money(tcv(Q(80, 96), TODAY)))
  })

  test('W: Closed Won keeps the won panel, with no list and no Restore (true today; a plain test both sides)', async () => {
    const { api } = server()
    await mount(opp({ status: 'Closed Won' }), api)
    expect(q('[data-testid="tq-won"]'), 'precondition: the won panel').not.toBeNull()
    expect(host.querySelectorAll('[data-restore-version]')).toHaveLength(0)
    expect(q('[data-testid="tq-version-row"]')).toBeNull()
  })
})
