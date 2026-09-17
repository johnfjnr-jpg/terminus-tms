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
  /** Only for a DERIVED criteria set, named at the test that uses it. */
  criteria?: Criterion[]
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
      if (path.startsWith('/api/scoring-criteria')) return { ok: true, status: 200, data: opts.criteria ?? LIVE.criteria }
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

// ── 2.4 MEASURABILITY ─────────────────────────────────────────────────────
const asksMeasurability = (exit: unknown) => ((exit as { requirements: Array<{ field?: string }> }).requirements)
  .some((r) => r.field === 'measurabilityConfirmed')

describe('2.4 measurability appears exactly where the stage\'s requirements name it', () => {
  test('on Qualification it shows the payload\'s current confirmation with its entry line', async () => {
    expect(asksMeasurability(LIVE.exitQualification), 'the captured Qualification gate no longer names it').toBe(true)
    await mount()
    await openStage('Qualification')
    const series = orderedSeries(LIVE.record.payload, 'measurabilityConfirmed')
    const last = series[series.length - 1] as { value: boolean, by: string, stage: string }
    expect($('tb-score-measurability'), 'the row is missing where the gate asks for it').toBeTruthy()
    expect($('tb-measurability-value')?.textContent).toBe(last.value ? 'Yes' : 'No')
    const line = $('tb-measurability-entry')!.textContent!
    expect(line).toContain(last.by)
    expect(line).toContain(`${last.value ? 'Yes' : 'No'} at ${last.stage}`)
  })

  test('on Site Assessment, whose requirements do not name it, there is no row', async () => {
    expect(asksMeasurability(LIVE.exitSiteAssessment), 'Site Assessment now names it, so this proves nothing').toBe(false)
    await mount()
    await openStage('Site Assessment')
    expect($('tb-stage-scoring-card')!.hasAttribute('hidden'), 'the card is hidden, so absence is not the row\'s').toBe(false)
    expect($('tb-score-measurability')).toBeNull()
  })

  test('a choice saves AT ONCE on its own route, as a boolean, and never as a score', async () => {
    const sent: Sent[] = []
    await mount({ sent })
    await openStage('Qualification')
    const reads = sent.filter((s) => s.path === '/api/test-beds/tb-1').length
    await act(async () => {
      const sel = $('tb-measurability-select') as HTMLSelectElement
      sel.value = 'no'
      sel.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await settle()
    expect(sent.filter((s) => s.path.endsWith('/measurability')).map((s) => s.body)).toEqual([{ confirmed: false }])
    expect(posts(sent), 'measurability went through the score route').toHaveLength(0)
    expect(sent.filter((s) => s.path === '/api/test-beds/tb-1').length, 'the record was not re-read').toBeGreaterThan(reads)
  })

  test('the DOOR: on a record you may not edit, the choice sends nothing', async () => {
    const sent: Sent[] = []
    await mount({ sent, canEdit: () => false })
    await openStage('Qualification')
    await act(async () => {
      const sel = $('tb-measurability-select') as HTMLSelectElement
      sel.value = 'yes'
      sel.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await settle()
    expect(sent.filter((s) => s.path.endsWith('/measurability'))).toHaveLength(0)
  })
})

// ── 2.5 DEPTH ─────────────────────────────────────────────────────────────
const cls = (id: string) => $(id)!.className
describe('2.5 the current value, the question and the definitions', () => {
  test('the current value sits beside the name, and an unscored criterion says "Not scored"', async () => {
    await mount()
    await openStage('Qualification')
    for (const c of Q()) {
      const s = orderedSeries(LIVE.record.payload, c.criterion_key)
      const expected = s.length ? String(s[s.length - 1].value) : 'Not scored'
      expect($(`tb-score-value-${c.criterion_key}`)?.textContent, c.criterion_key).toBe(expected)
    }
    expect(Q().some((c) => orderedSeries(LIVE.record.payload, c.criterion_key).length === 0),
      'every criterion is scored, so "Not scored" is not exercised').toBe(true)
  })

  test('the asks line is the stored question, verbatim', async () => {
    await mount()
    await openStage('Qualification')
    for (const c of Q().filter((x) => x.asks)) expect($(`tb-score-asks-${c.criterion_key}`)?.textContent).toBe(c.asks)
  })

  test('the definitions list EVERY level, mark the ones with no wording, and name the version', async () => {
    await mount({ payload: {} })
    await openStage('Qualification')
    const c = Q()[0]
    const toggleBtn = $(`tb-anchors-toggle-${c.criterion_key}`)!
    expect(toggleBtn.getAttribute('aria-expanded')).toBe('false')
    expect(cls(`tb-anchors-${c.criterion_key}`)).toContain('hidden')
    await act(async () => { toggleBtn.click() })
    expect($(`tb-anchors-toggle-${c.criterion_key}`)!.getAttribute('aria-expanded')).toBe('true')
    expect(cls(`tb-anchors-${c.criterion_key}`)).not.toContain('hidden')
    const words = c.anchors![String(c.current_version)]
    for (const l of c.levels!) {
      const row = $(`tb-anchor-${c.criterion_key}-${l.value}`)!
      expect(row.className.includes('tb-score-anchor--nowording'), `level ${l.value}`).toBe(!words[String(l.value)])
      expect(row.querySelector('.tb-score-anchor-text')!.textContent).toBe(words[String(l.value)] ?? '')
    }
    expect(c.levels!.some((l) => !words[String(l.value)]), 'every level has wording, so the marking is not exercised').toBe(true)
    expect($(`tb-anchors-version-${c.criterion_key}`)?.textContent).toBe(`Version ${c.current_version}`)
  })

  test('the definitions OPEN while a draft is pending, and a close the person made survives the next focus', async () => {
    await mount({ payload: {} })
    await openStage('Qualification')
    const c = Q()[0]
    await choose(c.criterion_key, noReason(c))
    expect($(`tb-anchors-toggle-${c.criterion_key}`)!.getAttribute('aria-expanded'), 'a pending draft did not open them').toBe('true')
    await act(async () => { $(`tb-anchors-toggle-${c.criterion_key}`)!.click() })
    expect($(`tb-anchors-toggle-${c.criterion_key}`)!.getAttribute('aria-expanded')).toBe('false')
    await act(async () => {
      $(`tb-score-select-${c.criterion_key}`)!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    })
    expect($(`tb-anchors-toggle-${c.criterion_key}`)!.getAttribute('aria-expanded'), 'reaching for the select reopened a closed block').toBe('false')
  })
})

describe('2.5 history and the current explanation', () => {
  const multi = () => Q().find((c) => orderedSeries(LIVE.record.payload, c.criterion_key).length > 1)!
  const single = () => Q().find((c) => {
    const s = orderedSeries(LIVE.record.payload, c.criterion_key)
    return s.length === 1 && (s[0].reason || s[0].comment)
  })!

  test('a single entry shows its reason WITHOUT a history control', async () => {
    const c = single()
    expect(c, 'no captured criterion has exactly one explained entry').toBeTruthy()
    await mount()
    await openStage('Qualification')
    expect($(`tb-score-history-${c.criterion_key}`)).toBeNull()
    expect($(`tb-score-current-${c.criterion_key}`)?.textContent)
      .toContain(`Reason: ${orderedSeries(LIVE.record.payload, c.criterion_key)[0].reason}`)
  })

  test('history is newest FIRST, with when, who, value, stage and version on every row', async () => {
    const c = multi()
    const s = orderedSeries(LIVE.record.payload, c.criterion_key)
    await mount()
    await openStage('Qualification')
    const btn = $(`tb-score-history-${c.criterion_key}`)!
    expect(btn.textContent).toBe(`Show history (${s.length})`)
    expect(btn.getAttribute('aria-expanded')).toBe('false')
    await act(async () => { btn.click() })
    const rows = [...$(`tb-score-series-${c.criterion_key}`)!.querySelectorAll('[data-testid="tb-score-entry"]')] as HTMLElement[]
    expect(rows).toHaveLength(s.length)
    const newestFirst = [...s].reverse()
    rows.forEach((r, i) => {
      const e = newestFirst[i]
      expect(r.textContent).toContain(e.by!)
      expect(r.textContent).toContain(`${e.value} at ${e.stage}`)
      expect(r.textContent).toContain(`v${e.anchorVersion}`)
      if (e.reason) expect(r.textContent).toContain(`Reason: ${e.reason}`)
    })
    expect(newestFirst[0].at! > newestFirst[1].at!, 'the captured entries share a timestamp, so order is not proven').toBe(true)
  })

  test('each history row resolves wording against its OWN version (DERIVED: a version 2 of the captured anchors)', async () => {
    const base = multi()
    const s = orderedSeries(LIVE.record.payload, base.criterion_key)
    const scoredAtV1 = s.find((e) => base.anchors!['1'][String(e.value)])!
    expect(scoredAtV1, 'no captured entry lands on a worded level, so resolution is not exercised').toBeTruthy()
    const v2 = Object.fromEntries(Object.entries(base.anchors!['1']).map(([k, w]) => [k, `REVISED ${w}`]))
    const derived = LIVE.criteria.map((c) => (c.criterion_key === base.criterion_key
      ? { ...c, anchors: { ...c.anchors, '2': v2 }, current_version: 2 } : c))
    await mount({ criteria: derived })
    await openStage('Qualification')
    await act(async () => { $(`tb-score-history-${base.criterion_key}`)!.click() })
    const text = $(`tb-score-series-${base.criterion_key}`)!.textContent!
    expect(text).toContain(base.anchors!['1'][String(scoredAtV1.value)])
    expect(text, 'a v1 entry was restated in v2 wording').not.toContain('REVISED')
  })
})

describe('2.5 the reason box and the entry lock', () => {
  test('labels: optional at a free first score; blocking while a required reason is empty; required once given', async () => {
    await mount({ payload: {} })
    await openStage('Qualification')
    const [a, b] = Q()
    await choose(a.criterion_key, noReason(a))
    expect($(`tb-score-reason-label-${a.criterion_key}`)?.textContent).toBe('Reason (optional)')
    await choose(b.criterion_key, needsReason(b))
    expect($(`tb-score-reason-label-${b.criterion_key}`)?.textContent).toBe('Reason required before scoring anything else')
    await typeReason(b.criterion_key, 'No sponsor named yet.')
    expect($(`tb-score-reason-label-${b.criterion_key}`)?.textContent).toBe('Reason (required)')
  })

  test('the LOCK holds: the OTHER selects disable, the blocking one does not, the note names it, focus is in its box, and the handler refuses', async () => {
    await mount({ payload: {} })
    await openStage('Qualification')
    const [a, b] = Q()
    await choose(a.criterion_key, needsReason(a))
    expect(($(`tb-score-select-${a.criterion_key}`) as HTMLSelectElement).disabled, 'the blocking criterion lost its own way out').toBe(false)
    for (const c of Q().slice(1)) expect(($(`tb-score-select-${c.criterion_key}`) as HTMLSelectElement).disabled, c.criterion_key).toBe(true)
    expect(($('tb-measurability-select') as HTMLSelectElement).disabled).toBe(true)
    expect($('tb-score-lock-note')?.textContent).toBe(`Add the Reason for ${a.name} before scoring anything else.`)
    expect(document.activeElement, 'focus did not move into the reason box').toBe($(`tb-score-reason-${a.criterion_key}`))
    await choose(b.criterion_key, noReason(b))
    expect(($(`tb-score-select-${b.criterion_key}`) as HTMLSelectElement).value, 'the handler took a draft past the lock').toBe('')
  })

  test('the LOCK releases both ways: by giving the reason, and by clearing the draft', async () => {
    await mount({ payload: {} })
    await openStage('Qualification')
    const [a, b] = Q()
    await choose(a.criterion_key, needsReason(a))
    await typeReason(a.criterion_key, 'Exploratory only.')
    expect(($(`tb-score-select-${b.criterion_key}`) as HTMLSelectElement).disabled).toBe(false)
    expect($('tb-score-lock-note')).toBeNull()
    await typeReason(a.criterion_key, '')
    expect(($(`tb-score-select-${b.criterion_key}`) as HTMLSelectElement).disabled, 'emptying the reason did not lock again').toBe(true)
    await choose(a.criterion_key, '')
    expect(($(`tb-score-select-${b.criterion_key}`) as HTMLSelectElement).disabled).toBe(false)
    expect($('tb-score-lock-note')).toBeNull()
  })
})

