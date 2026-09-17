// ── THE STAGE SCORING PANEL, THROUGH THE REAL HOST ───────────────────────
//
// Round A Phase 2. Rendered through `TestBedHost` itself, because B2 broke in
// the HOST's wiring (a `scoring` state nothing set, a series filled only by a
// POST) and a component test with deps handed in would have passed through it.
//
// EVERY RESPONSE the claims rest on is captured from the routes by
// scripts/testbed-core/capture-scoring.mjs: the criteria with their stage rows
// and anchors, the stage list, the exit-criteria responses, the record read
// back after real scores and a real measurability confirmation, and the real
// 201 and 400 bodies of POST /scores. Routes no claim here is about (history,
// documents, approvals, lifecycle, contacts) answer an empty list, which is a
// stub, not a server shape, and nothing asserts against them.
//
// Driven through ONE root re-rendered, as main.tsx invokes the view
// (Verification 47's harness clause).
import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { TestBedHost } from '../testbed/TestBedHost'
import { ShellProvider } from '../ShellContext'
import { shellServices } from './fixtures'
import type { ShellServices } from '../shell-services'
import LIVE_JSON from './fixtures/scoring-live.json'
import type { Criterion } from '../testbed/scoring'
import { orderedSeries } from '../testbed/QualificationScore'

interface Captured { status: number, body: Record<string, unknown> }
const LIVE = LIVE_JSON as unknown as {
  criteria: Criterion[]
  stageDefinitions: Array<{ stage_name: string, sort_order: number }>
  exitQualification: unknown
  exitSiteAssessment: unknown
  accepted: Record<'firstScore' | 'revisionWithReason' | 'requiredLevelWithReason' | 'measurability', Captured>
  refusals: Record<'revisionWithoutReason' | 'requiredLevelWithoutReason', Captured>
  record: { status: string, latest_revision_number: number, payload: Record<string, unknown> }
}

let host: HTMLElement
let root: Root
beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host) })
afterEach(() => { act(() => root.unmount()); host.remove() })

type Sent = { method: string, path: string, body?: unknown }
const BED = (payload: Record<string, unknown>) => ({
  id: 'tb-1', status: LIVE.record.status, owner_id: 'user-1',
  payload: { name: 'Bed A', ...payload }, latest_revision_number: LIVE.record.latest_revision_number,
})

/** The router. `onScore` answers POST /scores with a CAPTURED body. */
const mount = async (opts: {
  payload?: Record<string, unknown>
  sent?: Sent[]
  onScore?: (body: Record<string, unknown>, n: number) => Captured
  canEdit?: () => boolean
} = {}) => {
  const sent = opts.sent ?? []
  let scores = 0
  const payload = opts.payload ?? LIVE.record.payload
  const services = shellServices({
    canEditFields: opts.canEdit ?? (() => true),
    api: (async (method: string, path: string, body?: unknown) => {
      sent.push({ method, path, body })
      if (method === 'POST' && path === '/api/test-beds/tb-1/scores') {
        const c = (opts.onScore ?? (() => LIVE.accepted.firstScore))(body as Record<string, unknown>, scores++)
        return { ok: c.status < 300, status: c.status, data: c.body }
      }
      if (method === 'POST' && path === '/api/test-beds/tb-1/measurability') {
        const c = LIVE.accepted.measurability
        return { ok: true, status: c.status, data: c.body }
      }
      if (path === '/api/test-beds/tb-1') return { ok: true, status: 200, data: BED(payload) }
      if (path.startsWith('/api/stage-definitions')) return { ok: true, status: 200, data: LIVE.stageDefinitions }
      if (path.startsWith('/api/scoring-criteria')) return { ok: true, status: 200, data: LIVE.criteria }
      if (path === '/api/records/tb-1/exit-criteria?stage=Qualification') return { ok: true, status: 200, data: LIVE.exitQualification }
      if (path === '/api/records/tb-1/exit-criteria?stage=Site%20Assessment') return { ok: true, status: 200, data: LIVE.exitSiteAssessment }
      if (path.includes('/exit-criteria')) return { ok: false, status: 404, data: { error: 'not captured' } }
      if (path.endsWith('/history')) return { ok: true, status: 200, data: { entries: [] } }
      return { ok: true, status: 200, data: [] }
    }) as ShellServices['api'],
  })
  act(() => { root.render(<ShellProvider services={services}><TestBedHost bed={BED(payload)} /></ShellProvider>) })
  await settle()
  return sent
}

const $ = (id: string) => host.querySelector(`[data-testid="${id}"]`) as HTMLElement | null
const settle = async () => { for (let i = 0; i < 4; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)) }) }
const openStage = async (stage: string) => {
  await act(async () => { $(`tb-tab-btn-stage-${stage}`)!.click() })
  await settle()
}
const selects = () => [...host.querySelectorAll('[data-testid="tb-stage-scoring-card"] [data-testid^="tb-score-select-"]')] as HTMLSelectElement[]
const keysShown = () => selects().map((s) => s.dataset.testid!.replace('tb-score-select-', ''))
const atStage = (stage: string) => LIVE.criteria.filter((c) => (c.stages ?? []).some((s) => s.stage === stage))

describe('2.1 criteria come from each criterion\'s OWN stage rows', () => {
  test('Qualification offers every criterion whose stages include it, in the route\'s order', async () => {
    await mount()
    await openStage('Qualification')
    const expected = atStage('Qualification').map((c) => c.criterion_key)
    expect(expected.length, 'the captured criteria name no Qualification stage row').toBeGreaterThan(0)
    expect(keysShown()).toEqual(expected)
  })

  test('Site Assessment offers only its own, which is a DIFFERENT set', async () => {
    await mount()
    await openStage('Site Assessment')
    const expected = atStage('Site Assessment').map((c) => c.criterion_key)
    expect(expected.length).toBeGreaterThan(0)
    expect(expected.length, 'the two stages ask for the same set, so this cannot tell them apart')
      .not.toBe(atStage('Qualification').length)
    expect(keysShown()).toEqual(expected)
  })
})

describe('2.2 series come from the record PAYLOAD, through the one reducer', () => {
  test('on a load with NO score POST, each row carries the payload\'s own entry count', async () => {
    const sent = await mount()
    await openStage('Qualification')
    expect(sent.filter((s) => s.method === 'POST' && s.path.endsWith('/scores')),
      'a POST happened, so the series could have come from its response').toHaveLength(0)
    const scored = LIVE.criteria.filter((c) => orderedSeries(LIVE.record.payload, c.criterion_key).length > 0)
    expect(scored.length, 'the captured record holds no scores, so this cannot fail').toBeGreaterThan(0)
    for (const c of atStage('Qualification')) {
      expect($(`tb-score-${c.criterion_key}`)!.dataset.entries, `${c.criterion_key} read a series other than the payload's`)
        .toBe(String(orderedSeries(LIVE.record.payload, c.criterion_key).length))
    }
  })

  test('the reducer orders by `at`, not by stored position (captured entries, stored order reversed)', () => {
    const key = 'scoreRolloutPath'
    const stored = LIVE.record.payload[key] as Array<{ at: string }>
    expect(stored.length).toBeGreaterThan(1)
    const reversed = { [key]: [...stored].reverse() }
    expect(orderedSeries(reversed, key).map((e) => e.at)).toEqual([...stored].map((e) => e.at).sort())
  })
})

// ── 2.3 THE CONTRACT ──────────────────────────────────────────────────────
const choose = async (key: string, value: string) => {
  await act(async () => {
    const sel = $(`tb-score-select-${key}`) as HTMLSelectElement
    sel.value = value
    sel.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await settle()
}
// A REAL VALUE SETTER for a controlled textarea (Verification 6's write clause).
const typeReason = async (key: string, text: string) => {
  await act(async () => {
    const ta = $(`tb-score-reason-${key}`) as HTMLTextAreaElement
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!
    setter.call(ta, text)
    ta.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await settle()
}
const record = async () => { await act(async () => { $('tb-score-record')!.click() }); await settle() }
const posts = (sent: Sent[]) => sent.filter((s) => s.method === 'POST' && s.path.endsWith('/scores'))
const Q = () => atStage('Qualification')
const nameOf = (k: string) => LIVE.criteria.find((c) => c.criterion_key === k)!.name!
const needsReason = (c: Criterion) => String(c.levels!.find((l) => l.reason_required)!.value)
const noReason = (c: Criterion) => String(c.levels!.find((l) => !l.reason_required)!.value)

describe('2.3 one flat entry per criterion, in PANEL order', () => {
  test('the bodies are { criterion, score, reason? }, never { entries }, sent in panel order whatever the drafting order', async () => {
    const sent: Sent[] = []
    await mount({ payload: {}, sent })
    await openStage('Qualification')
    const [first, second, , , last] = Q()
    await choose(last.criterion_key, noReason(last))
    await choose(first.criterion_key, noReason(first))
    await choose(second.criterion_key, needsReason(second))
    await typeReason(second.criterion_key, 'No sponsor named yet.')
    await record()
    expect(posts(sent).map((p) => p.body)).toEqual([
      { criterion: first.criterion_key, score: Number(noReason(first)) },
      { criterion: second.criterion_key, score: Number(needsReason(second)), reason: 'No sponsor named yet.' },
      { criterion: last.criterion_key, score: Number(noReason(last)) },
    ])
  })

  test('with NOTHING drafted the button sends nothing (P0.1 posted {"entries":[]})', async () => {
    const sent: Sent[] = []
    await mount({ payload: {}, sent })
    await openStage('Qualification')
    expect(($('tb-score-record') as HTMLButtonElement).disabled).toBe(true)
    await record()
    expect(posts(sent)).toHaveLength(0)
  })

  test('after a recorded run the RECORD is re-read, so the panel shows what the server holds', async () => {
    const sent: Sent[] = []
    await mount({ payload: {}, sent })
    await openStage('Qualification')
    const reads = () => sent.filter((s) => s.method === 'GET' && s.path === '/api/test-beds/tb-1').length
    const before = reads()
    await choose(Q()[0].criterion_key, noReason(Q()[0]))
    await record()
    expect(reads(), 'the record was not reloaded after scoring').toBeGreaterThan(before)
  })

  test('the DOOR: on a record you may not edit, nothing is sent and the drafts stay', async () => {
    const sent: Sent[] = []
    let allowed = true
    await mount({ payload: {}, sent, canEdit: () => allowed })
    await openStage('Qualification')
    await choose(Q()[0].criterion_key, noReason(Q()[0]))
    allowed = false
    await record()
    expect(posts(sent), 'a score was sent for somebody else\'s record').toHaveLength(0)
    expect(($(`tb-score-select-${Q()[0].criterion_key}`) as HTMLSelectElement).value).toBe(noReason(Q()[0]))
  })
})

describe('2.3 the vanilla\'s partial-failure semantics, on REAL refusal bodies', () => {
  test('a recorded score stands; the FIRST refusal stops the run; the message names both; the rest stay drafted', async () => {
    const sent: Sent[] = []
    const refusal = LIVE.refusals.revisionWithoutReason
    await mount({ payload: {}, sent, onScore: (_b, n) => (n === 1 ? refusal : LIVE.accepted.firstScore) })
    await openStage('Qualification')
    const [a, b, c] = Q()
    for (const x of [a, b, c]) await choose(x.criterion_key, noReason(x))
    await record()
    expect(posts(sent).map((p) => (p.body as { criterion: string }).criterion),
      'the run went on past the refusal').toEqual([a.criterion_key, b.criterion_key])
    expect($('tb-score-error')?.textContent)
      .toBe(`Recorded ${nameOf(a.criterion_key)}. ${nameOf(b.criterion_key)} could not be recorded: ${refusal.body.error}`)
    expect(($(`tb-score-select-${a.criterion_key}`) as HTMLSelectElement).value, 'the recorded score stayed drafted').toBe('')
    expect(($(`tb-score-select-${b.criterion_key}`) as HTMLSelectElement).value, 'the refused score was not kept for a retry').toBe(noReason(b))
    expect(($(`tb-score-select-${c.criterion_key}`) as HTMLSelectElement).value, 'the unattempted score was not kept').toBe(noReason(c))
  })

  test('a refusal on the FIRST entry says nothing was recorded', async () => {
    const refusal = LIVE.refusals.requiredLevelWithoutReason
    await mount({ payload: {}, onScore: () => refusal })
    await openStage('Qualification')
    const [a, b] = Q()
    await choose(a.criterion_key, noReason(a))
    await choose(b.criterion_key, noReason(b))
    await record()
    expect($('tb-score-error')?.textContent)
      .toBe(`Nothing was recorded. ${nameOf(a.criterion_key)} could not be recorded: ${refusal.body.error}`)
  })
})
