// TERM_QUOTES V1 to V6: the Term quote tab, mounted the way main.tsx mounts
// it, against a recording API. Fixture params only (spec 11.7), never live.
import { describe, test, expect } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { ShellProvider } from '../ShellContext'
import { shellServices } from '../shell-services'
import { TermPricingView } from '../term-pricing/TermPricingView'
import { formFromInput, inputFromForm, DEFAULT_TERM_FORM } from '../term-pricing/form'
import type { TermQuoteForm } from '../term-pricing/form'
import { TermQuoteHost, CommercialsMethodHost } from '../term-quote/TermQuoteTab'
import type { TermOpp } from '../term-quote/TermQuoteTab'
import { TermAskBlock, WhatChangedBlock, MethodChangedBlock } from '../approval-term'
import { tqParams, TQ1_INPUTS } from '../../../scripts/tests/fixtures/term-quote-params.mjs'
import { CLOSED_WON_PRICING_REFUSAL } from '../../../src/lib/pricing-keys.js'

// jsdom has no ResizeObserver (the screen's fitted figures use one) and does
// not declare the act environment; both are this test's to supply.
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
class NoopResizeObserver { observe() {} unobserve() {} disconnect() {} }
;(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= NoopResizeObserver

declare global { interface Window { api?: (m: string, p: string, b?: unknown) => Promise<unknown>, getOppLoadedRevision?: () => number | null } }

type Call = { method: string, path: string, body?: unknown }
const SETTINGS_KEYS = ['TERMS', 'COMPARE_TERM', 'PRICE_LADDER_BY_PRODUCT', 'VOLUME_BANDS_BY_PRODUCT', 'HW_UPFRONT_MARGIN', 'MARGIN_FLOOR', 'CURRENCY'] as const
const serverState = (ladder120 = '500.00') => {
  const p = tqParams(ladder120) as Record<string, unknown> & { costs: Record<string, { hwCost: string, hostingMonthly: string }> }
  return {
    settings: Object.fromEntries(SETTINGS_KEYS.map((k) => [k, p[k]])),
    costs: Object.fromEntries(Object.entries(p.costs).map(([k, c]) => [k, { ...c, batchLabel: 'fixture', effectiveFrom: '2026-08-27' }])),
    isAdmin: false, updatedAt: '', asOf: '2026-11-20',
  }
}

function recordingApi({ versions = [] as unknown[], draftParams = null as unknown, ladder120 = '500.00' } = {}) {
  const calls: Call[] = []
  const api = async (method: string, path: string, body?: unknown) => {
    calls.push({ method, path, body })
    if (method === 'GET' && path === '/api/term-pricing') return { ok: true, data: serverState(ladder120) }
    if (method === 'GET' && /\/deal-sheet-versions$/.test(path)) return { ok: true, data: versions }
    if (method === 'GET' && /^\/api\/deal-sheet-versions\//.test(path)) return { ok: true, data: { rates: { params: draftParams } } }
    if (method === 'POST') return { ok: true, status: 201, data: { id: 'new' } }
    return { ok: false, status: 404, data: { error: `unexpected ${method} ${path}` } }
  }
  return { api, calls }
}

let host: HTMLElement
let root: Root | null = null
async function mount(node: React.ReactElement, api: (m: string, p: string, b?: unknown) => Promise<unknown>) {
  window.api = api
  window.getOppLoadedRevision = () => 7
  root?.unmount()
  document.body.innerHTML = '<div id="opp-tab-commercial"><div id="host"></div></div>'
  host = document.getElementById('host')!
  root = createRoot(host)
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  await act(async () => {
    root!.render(<QueryClientProvider client={qc}><ShellProvider services={shellServices}>{node}</ShellProvider></QueryClientProvider>)
  })
  for (let i = 0; i < 3; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
}
const q = (s: string) => host.querySelector(s) as HTMLElement | null
const text = (s: string) => q(s)?.textContent?.replace(/\s+/g, ' ').trim() ?? null
function type(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}
const click = async (el: HTMLElement | null) => { await act(async () => { el!.click() }); for (let i = 0; i < 3; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)) }) }

const termOpp = (over: Partial<TermOpp> = {}): TermOpp => ({
  id: 'opp-1', status: 'Proposal', payload: { pricingMethod: 'term_quote', termQuote: TQ1_INPUTS },
  working_version: 'V0.2', approved_version: null, won_version: null, ...over,
})

// ── The value object ────────────────────────────────────────────────────

describe('the term quote as one value object (P2)', () => {
  test('a saved quote reopens into the controls and prices back to itself', () => {
    expect(inputFromForm(formFromInput(TQ1_INPUTS as never)).units).toEqual({ safesight: 60, air_quality: 0, hemir: 0 })
    const f: TermQuoteForm = { ...DEFAULT_TERM_FORM, units: { safesight: '12', air_quality: '0', hemir: '2' }, term: 60,
      cpiMode: 'locked', escalator: '3', factoringOn: true, fxRate: '1.0', fxTerm: '24', dealMode: 'discount', dealPct: '7.5' }
    const once = inputFromForm(f)
    expect(inputFromForm(formFromInput(once as never))).toEqual(once)
  })
})

// ── Bound mode ──────────────────────────────────────────────────────────

describe('V3: the Term Pricing screen in bound mode', () => {
  test('inputs in: the screen shows the value it is handed, with no admin settings editors and no standalone header', async () => {
    const { api } = recordingApi()
    await mount(<TermPricingView navToken={1} bound={{ value: formFromInput(TQ1_INPUTS as never), onChange: () => {} }} />, api)
    expect((q('[data-testid="tp-units-safesight"]') as HTMLInputElement).value).toBe('60')
    expect(q('[data-testid="tp-settings"]')).toBeNull()
    expect(q('[data-testid="tp-head-base"]')).toBeNull()
    expect(text('[data-testid="tp-p-base"]')).toBe('3,414,000.00')
  })

  test('onChange out: an edit reports the whole next value; the screen holds nothing of its own', async () => {
    const { api } = recordingApi()
    const seen: TermQuoteForm[] = []
    await mount(<TermPricingView navToken={1} bound={{ value: formFromInput(TQ1_INPUTS as never), onChange: (n) => seen.push(n) }} />, api)
    await act(async () => { type(q('[data-testid="tp-units-safesight"]') as HTMLInputElement, '61') })
    expect(seen.at(-1)?.units.safesight).toBe('61')
    expect(seen.at(-1)?.term).toBe(120)
    // Bound: the parent did not re-render with the new value, so the input still shows the old one.
    expect((q('[data-testid="tp-units-safesight"]') as HTMLInputElement).value).toBe('60')
  })

  test('the standalone screen is unchanged: it owns its inputs and opens on one SafeSight unit', async () => {
    const { api } = recordingApi()
    await mount(<TermPricingView navToken={1} />, api)
    expect((q('[data-testid="tp-units-safesight"]') as HTMLInputElement).value).toBe('1')
    expect(q('[data-testid="tp-head-base"]')).not.toBeNull()
  })
})

// ── The tab ─────────────────────────────────────────────────────────────

describe('V2: the pricing method selector and the inactive tab', () => {
  test('a Commercials-priced deal: the Term quote tab shows only the bar and the line', async () => {
    const { api } = recordingApi()
    await mount(<TermQuoteHost opp={termOpp({ payload: {} })} api={api as never} patch={async () => ({ ok: true })} reload={() => {}} navToken={1} />, api)
    expect(text('[data-testid="pm-inactive"] .pm-inactive-head')).toBe('Not in use. This deal is priced by Commercials.')
    expect(q('[data-testid="tq-version"]')).toBeNull()
    expect(q('[data-testid="term-pricing"]')).toBeNull()
  })

  test('choosing a method writes pricingMethod, through the record\'s patch', async () => {
    const { api } = recordingApi()
    const patches: unknown[] = []
    let reloaded = 0
    await mount(<TermQuoteHost opp={termOpp({ payload: {} })} api={api as never} patch={async (_id, b) => { patches.push(b); return { ok: true } }}
      reload={() => { reloaded++ }} navToken={1} />, api)
    await click(q('[data-testid="pm-term_quote"]'))
    expect(patches).toEqual([{ payload: { pricingMethod: 'term_quote' } }])
    expect(reloaded).toBe(1)
  })

  test('the Commercials tab on a term-priced deal: the artboard 3 line, and its pane marked inactive', async () => {
    await mount(<CommercialsMethodHost opp={termOpp()} patch={async () => ({ ok: true })} reload={() => {}} />, recordingApi().api)
    expect(text('[data-testid="pm-inactive"] .pm-inactive-head')).toBe('Not in use. This deal is priced by Term quote.')
    expect(text('[data-testid="pm-inactive"] .pg-item-note')).toBe('To price it bottom-up instead, choose Commercials above. The term quote stays saved, so you can switch back. Whichever method you submit next becomes a new major version, and approval starts again.')
    expect(document.getElementById('opp-tab-commercial')?.getAttribute('data-pricing-inactive')).toBe('true')
  })
})

describe('V3: the version card on the second seam', () => {
  test('Save version saves the record\'s quote first, then takes a term version of it', async () => {
    const { api, calls } = recordingApi()
    const patches: unknown[] = []
    await mount(<TermQuoteHost opp={termOpp({ payload: { pricingMethod: 'term_quote' } })} api={api as never}
      patch={async (_id, b) => { patches.push(b); return { ok: true } }} reload={() => {}} navToken={1} />, api)
    await act(async () => { type(q('[data-testid="tq-reason"]') as HTMLTextAreaElement, 'first term price') })
    await click(q('[data-testid="tq-save"]'))
    expect(patches).toHaveLength(1)
    const saved = (patches[0] as { payload: { termQuote: { units: Record<string, number> } } }).payload.termQuote
    expect(saved.units.safesight).toBe(1)
    const post = calls.find((c) => c.method === 'POST')!
    expect(post.path).toBe('/api/opportunities/opp-1/deal-sheet-versions')
    expect(post.body).toMatchObject({ kind: 'term_quote', reason: 'first term price', expected_revision: 7, inputs: saved })
  })

  test('no reason, no version: the card refuses in the version prompt\'s words and sends nothing', async () => {
    const { api, calls } = recordingApi()
    await mount(<TermQuoteHost opp={termOpp()} api={api as never} patch={async () => ({ ok: true })} reload={() => {}} navToken={1} />, api)
    await click(q('[data-testid="tq-save"]'))
    expect(text('[data-testid="tq-feedback"]')).toBeTruthy()
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(0)
  })

  test('Submit names the draft and the major it becomes, and posts the issue', async () => {
    const draft = { id: 'd1', kind: 'term_quote', status: 'draft', major: 0, minor: 2, reason: 'x', inputs: TQ1_INPUTS, created_at: '2026-11-19T00:00:00Z' }
    const { api, calls } = recordingApi({ versions: [draft], draftParams: tqParams() })
    await mount(<TermQuoteHost opp={termOpp()} api={api as never} patch={async () => ({ ok: true })} reload={() => {}} navToken={1} />, api)
    expect(text('[data-testid="tq-submit"]')).toBe('Submit V0.2 as V1.0 for approval')
    await click(q('[data-testid="tq-submit"]'))
    expect(calls.some((c) => c.method === 'POST' && c.path === '/api/deal-sheet-versions/d1/issue')).toBe(true)
  })
})

describe('a reload never discards an unsaved edit (the click probe\'s K8)', () => {
  test('re-rendered for the same record with a moved revision: the typed edit stays', async () => {
    const { api } = recordingApi()
    const node = (o: TermOpp) => <TermQuoteHost key={o.id} opp={o} api={api as never} patch={async () => ({ ok: true })} reload={() => {}} navToken={1} />
    await mount(node(termOpp()), api)
    await act(async () => { type(q('[data-testid="tp-units-safesight"]') as HTMLInputElement, '80') })
    expect((q('[data-testid="tp-units-safesight"]') as HTMLInputElement).value).toBe('80')
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    await act(async () => { root!.render(<QueryClientProvider client={qc}><ShellProvider services={shellServices}>{node(termOpp({ working_version: 'V1.0' }))}</ShellProvider></QueryClientProvider>) })
    expect((q('[data-testid="tp-units-safesight"]') as HTMLInputElement).value).toBe('80')
    // A newly SAVED quote does not overwrite the unsaved edit either.
    await act(async () => { root!.render(<QueryClientProvider client={qc}><ShellProvider services={shellServices}>{node(termOpp({ payload: { pricingMethod: 'term_quote', termQuote: { ...TQ1_INPUTS, units: { safesight: 70 } } } }))}</ShellProvider></QueryClientProvider>) })
    expect((q('[data-testid="tp-units-safesight"]') as HTMLInputElement).value).toBe('80')
  })

  test('with nothing unsaved, a newly saved quote is taken into the screen', async () => {
    const { api } = recordingApi()
    const node = (o: TermOpp) => <TermQuoteHost key={o.id} opp={o} api={api as never} patch={async () => ({ ok: true })} reload={() => {}} navToken={1} />
    await mount(node(termOpp()), api)
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    await act(async () => { root!.render(<QueryClientProvider client={qc}><ShellProvider services={shellServices}>{node(termOpp({ payload: { pricingMethod: 'term_quote', termQuote: { ...TQ1_INPUTS, units: { safesight: 70 } } } }))}</ShellProvider></QueryClientProvider>) })
    expect((q('[data-testid="tp-units-safesight"]') as HTMLInputElement).value).toBe('70')
  })
})

describe('V4: a draft reopened after the settings moved', () => {
  const draft = { id: 'd1', kind: 'term_quote', status: 'draft', major: 0, minor: 2, reason: 'x', inputs: TQ1_INPUTS, created_at: '2026-11-19T00:00:00Z' }

  test('the banner: saved, today, the difference, and what moved (artboard 2)', async () => {
    const { api } = recordingApi({ versions: [draft], draftParams: tqParams('500.00'), ladder120: '510.00' })
    await mount(<TermQuoteHost opp={termOpp()} api={api as never} patch={async () => ({ ok: true })} reload={() => {}} navToken={1} />, api)
    expect(text('[data-testid="tq-reopened-saved"]')).toBe('3,414,000.00')
    expect(text('[data-testid="tq-reopened-today"]')).toBe('3,482,280.00')
    expect(text('[data-testid="tq-reopened-diff"]')).toBe('+68,280.00')
    expect(text('[data-testid="tq-reopened-moved"]')).toBe('the SafeSight price ladder at 120 months, 500.00 to 510.00')
  })

  test('no banner when the stored settings equal today\'s', async () => {
    const { api } = recordingApi({ versions: [draft], draftParams: tqParams('500.00'), ladder120: '500.00' })
    await mount(<TermQuoteHost opp={termOpp()} api={api as never} patch={async () => ({ ok: true })} reload={() => {}} navToken={1} />, api)
    expect(q('[data-testid="tq-reopened"]')).toBeNull()
    expect(q('[data-testid="tq-version"]')).not.toBeNull()
  })
})

describe('V6: Closed Won', () => {
  test('the selector disabled, the refusal\'s exact words, the won version\'s frozen figures, no save or submit', async () => {
    const won = { id: 'w', kind: 'term_quote' as const, label: 'V2.0', inputs: { units: { safesight: 80 }, termMonths: 96 }, ask: { baseTcv: 3978240, margin: '45.3' }, basis: 'OPEX' }
    const { api } = recordingApi()
    await mount(<TermQuoteHost opp={termOpp({ status: 'Closed Won', won_version: won })} api={api as never} patch={async () => ({ ok: true })} reload={() => {}} navToken={1} />, api)
    expect(text('[data-testid="tq-won"] b')).toBe(CLOSED_WON_PRICING_REFUSAL)
    expect((q('[data-testid="pm-term_quote"]') as HTMLButtonElement).disabled).toBe(true)
    expect((q('[data-testid="pm-commercials"]') as HTMLButtonElement).disabled).toBe(true)
    expect(q('[data-testid="tq-save"]')).toBeNull()
    expect(q('[data-testid="tq-submit"]')).toBeNull()
    expect(text('[data-testid="tq-won-base"]')).toBe('3,978,240.00')
    expect((q('[data-testid="tq-won-units-safesight"]') as HTMLInputElement).disabled).toBe(true)
  })
})

// ── The approval page's term blocks ─────────────────────────────────────

const asText = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()

describe('V5, CF2: the approval page for a term version', () => {
  test('the ask, its chips, and the Cash flow card as ruled', () => {
    const html = renderToStaticMarkup(<TermAskBlock frozen ask={{ kind: 'term_quote', baseTcv: 3414000, margin: '43.8', profit: 1494000, sentence: '',
      chips: [{ ok: true, text: 'No deal discount: priced at list' }, { ok: true, text: 'Above the 25% floor' }],
      cashFlow: { peakFunding: { amount: '128,750.00', month: 25, text: '128,750.00 in month 25' }, noFundingNeed: null, paybackText: 'Month 33',
        paybackSub: 'cash stays at or above zero from here', factoring: { on: false, text: 'PO factoring: off', cost: null, treatment: null } } }} />)
    const t = asText(html)
    expect(t).toContain('3,414,000.00')
    expect(t).toContain('No deal discount: priced at list')
    expect(t).toContain('Peak funding need 128,750.00 in month 25')
    expect(t).toContain('Month of payback Month 33 cash stays at or above zero from here')
    expect(t).toContain('PO factoring: off')
    expect(t).not.toMatch(/Absorb|0\.00 Factoring/)
  })

  test('what changed: unchanged rows are marked to be greyed, changed ones carry their difference', () => {
    const html = renderToStaticMarkup(<WhatChangedBlock baselineLabel="V1.0" underReviewLabel="V2.0" note="n" rows={[
      { key: 'units.safesight', label: 'SafeSight units', before: '60', after: '80', changed: true, delta: null },
      { key: 'cpi', label: 'CPI', before: 'None', after: 'None', changed: false, delta: null },
      { key: 'baseTcv', label: 'Base TCV', before: '3,414,000.00', after: '3,978,240.00', changed: true, delta: '+564,240.00' },
    ]} />)
    expect(html).toContain('class="tq-same" data-testid="tq-changed-cpi"')
    expect(html).toContain('class="tq-chg" data-testid="tq-changed-units.safesight"')
    expect(asText(html)).toContain('Base TCV 3,414,000.00 3,978,240.00 +564,240.00')
    expect(asText(html)).toContain('V1.0 approved V2.0 under review')
  })

  test('the method-changed block: the ruled sentence, both figures, the term side\'s summary (artboard 5)', () => {
    const t = asText(renderToStaticMarkup(<MethodChangedBlock m={{
      sentence: 'Pricing method changed: the previous approval does not carry over.', explanation: 'V1.0 was priced bottom-up in Commercials; V2.0 is a term quote.',
      lastApproved: { label: 'V1.0', method: 'Commercials', measure: 'Contract net', figure: 1234567.89 },
      underReview: { label: 'V2.0', method: 'Term quote', measure: 'Base TCV', figure: 3414000, summary: 'SafeSight 60 units · 120 months · OPEX · margin 43.8%', chips: [] },
    }} />))
    expect(t).toContain('Pricing method changed: the previous approval does not carry over.')
    expect(t).toContain('Last approved · V1.0 · Commercials Contract net 1,234,567.89')
    expect(t).toContain('Under review · V2.0 · Term quote Base TCV 3,414,000.00 SafeSight 60 units · 120 months · OPEX · margin 43.8%')
  })
})
