// ── THE EXIT-CRITERIA PANEL, DRIVEN BY THE ROUTE'S OWN RESPONSES ─────────
//
// Round A Phase 1, brief items 1.1-1.7. Every response here comes from
// `fixtures/exit-criteria-live.json`, captured from GET
// /api/records/:id/exit-criteria by scripts/testbed-core/capture-exit-criteria.mjs.
// A hand-shaped array is what hid audit finding B3 for months (the panel's old
// fixture was `[{ field, label, value }]`, shaped to the reader), so the brief
// forbids one here.
//
// TWO BRANCHES HAVE NO LIVE INSTANCE, and are said to be derived rather than
// passed off as captured: no live stage has zero rules, and no fixture reached
// all-met. Each is built from a captured response by changing exactly one
// property, named at the test.
//
// Expected numbers are EXPRESSED from the fixture, never typed (Verification
// 20: a number a test expects is a second reader of the calculation).

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
// The captured responses are IMPORTED (the bundler resolves JSON). The route
// file cannot be: Vite denies a `?raw` import from outside this package's root,
// and widening that is not this test's business. So it is read at run time
// through Node, typed here because the bundle's tests carry no Node types.
import LIVE_JSON from './fixtures/exit-criteria-live.json'
declare const __dirname: string
const NODE_FS = 'node:fs'
const readText = async (path: string): Promise<string> => {
  const fs = await import(/* @vite-ignore */ NODE_FS) as { readFileSync: (p: string, e: string) => string }
  return fs.readFileSync(path, 'utf8')
}
import { ExitCriteria, type TickResult } from '../testbed/StagePanel'
import { ShellProvider } from '../ShellContext'
import { shellServices } from './fixtures'
import { StageTabs, type StageTabsDeps } from '../testbed/StageTabs'
import {
  TB_EXIT_CRITERION_KEYS, attemptTick, exitSummary, readExitCriteria,
  type ExitCriteriaResponse, type ExitRequirement,
} from '../testbed/exitCriteria'

const LIVE = LIVE_JSON as unknown as {
  cases: Record<'qualificationFresh' | 'qualificationDataEntryMet' | 'monitoringUnticked'
    | 'monitoringTicked' | 'installation' | 'finalStage' | 'qualificationScored', ExitCriteriaResponse>
}
const C = LIVE.cases

let host: HTMLElement
let root: Root
beforeEach(() => {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

const SETTLED = (stage: string) => ({ stage })
const panel = () => host.querySelector('[data-testid="tb-stage-exit-criteria-list"]') as HTMLElement
const rows = () => [...panel().querySelectorAll('.tb-crit-row')] as HTMLElement[]
const tickables = () => [...panel().querySelectorAll('[role="checkbox"]')] as HTMLElement[]
const readable = (r: ExitRequirement) => [r.label, r.message].filter(Boolean)
  .some((t) => panel().textContent!.includes(t as string))

const show = (data: unknown, onTick: (f: string, m: boolean) => Promise<TickResult>
  = async () => ({ ok: true })) => act(() => {
  root.render(<ExitCriteria stage="Any" data={data} panel={SETTLED('Any')} onTick={onTick} />)
})
const press = async (el: HTMLElement) => {
  await act(async () => { el.click(); await Promise.resolve(); await Promise.resolve() })
}

describe('B3: the route\'s OBJECT renders, where it rendered the empty branch', () => {
  test('every one of the fresh Qualification response\'s requirements is readable in the panel', async () => {
    await show(C.qualificationFresh)
    const reqs = C.qualificationFresh.requirements
    expect(reqs.length, 'the captured response carries no requirements, so this proves nothing')
      .toBeGreaterThan(0)
    expect(reqs.filter(readable).length, 'a served requirement is not on screen').toBe(reqs.length)
    expect(rows()).toHaveLength(reqs.length)
    expect(panel().textContent).not.toContain('No exit criteria')
  })

  test('the legacy ARRAY shape is refused as unreadable, never shown as "no criteria"', async () => {
    await show([{ field: 'x', label: 'X', value: null }])
    expect(panel().textContent).toContain('Unable to load exit criteria.')
    expect(readExitCriteria([])).toBeNull()
  })

  test('the real response reaches the panel THROUGH StageTabs and its loader, the seam B3 broke on', async () => {
    const deps: StageTabsDeps = {
      stages: [{ stage_name: 'Qualification', sort_order: 1 }, { stage_name: 'Closed', sort_order: 8 }],
      documents: async () => ({ ok: true, data: [] }),
      criteria: async () => ({ ok: true, data: C.qualificationFresh }),
      approvals: async () => ({ ok: true, data: [] }),
      scoringCriteria: () => [],
      series: () => [],
      onTick: async () => ({ ok: true }),
      onRecordScores: async () => ({ recorded: [], failed: null, refused: false }),
      onMeasurability: async () => null,
      onDeriveUnits: async () => {},
      unitDeps: { patch: async () => ({ ok: true, data: {} }), unitById: () => undefined, onUnit: () => {} },
    }
    await act(() => {
      // V9: wrapped, because ScoringCard is a seam caller now (R2 option B).
      root.render(<ShellProvider services={shellServices()}><StageTabs payload={{}} units={[]} landing={null} fresh
        currentStage="Qualification" nextStage="Pre-Site Assessment" deps={deps}
        reference={null} commercials={null} /></ShellProvider>)
    })
    await press(host.querySelector('[data-testid="tb-tab-btn-stage-Qualification"]') as HTMLElement)
    expect(panel().getAttribute('data-stage')).toBe('Qualification')
    expect(rows(), 'StageTabs dropped the response between the loader and the panel')
      .toHaveLength(C.qualificationFresh.requirements.length)
  })
})

describe('1.1 the summary line', () => {
  test('names the outstanding count over ALL requirements and to_stage', async () => {
    const res = C.qualificationFresh
    await show(res)
    const out = res.requirements.filter((r) => !r.met).length
    expect(host.querySelector('[data-testid="tb-crit-summary"]')?.textContent)
      .toBe(`${out} of ${res.requirements.length} outstanding to move to ${res.to_stage}:`)
  })

  test('counts rows the split HIDES: met data-entry rows are gone from the list and still in the denominator', async () => {
    const res = C.qualificationDataEntryMet
    const hidden = res.requirements.filter((r) => r.met && r.requirement_type !== 'approval_obtained'
      && r.requirement_type !== 'document_status' && r.min_length === undefined)
    expect(hidden.length, 'the captured case has no met data-entry row, so the split is not exercised')
      .toBeGreaterThan(0)
    await show(res)
    expect(rows()).toHaveLength(res.requirements.length - hidden.length)
    const out = res.requirements.filter((r) => !r.met).length
    expect(host.querySelector('[data-testid="tb-crit-summary"]')?.textContent)
      .toBe(`${out} of ${res.requirements.length} outstanding to move to ${res.to_stage}:`)
  })

  test('the all-met sentence (DERIVED: the captured Monitoring response with every met set true)', () => {
    const res = { ...C.monitoringTicked,
      requirements: C.monitoringTicked.requirements.map((r) => ({ ...r, met: true })) }
    expect(exitSummary(res)).toBe(`All criteria met - ready to move to ${res.to_stage}.`)
  })

  test('the final stage says so (captured: Closed answers to_stage null)', async () => {
    expect(C.finalStage.to_stage).toBeNull()
    await show(C.finalStage)
    expect(panel().textContent).toContain('This is the final stage - nothing further to exit toward.')
  })

  test('no criteria names to_stage (DERIVED: a captured response with requirements emptied)', async () => {
    await show({ ...C.monitoringUnticked, requirements: [], blocking: [] })
    // R11 gave the panel the estate's card and its eyebrow, so the panel's own
    // text is no longer the message alone. The claim was never about the panel
    // holding NOTHING else: it is that an empty answer names the stage rather
    // than rendering blank. Asserted on the message element, with the eyebrow
    // asserted beside it rather than silently absorbed.
    expect(panel().querySelector('.pg-card-title')?.textContent).toBe('Exit criteria')
    expect(panel().querySelector('.empty-state')?.textContent)
      .toBe(`No exit criteria configured for ${C.monitoringUnticked.to_stage}.`)
  })
})

describe('1.2 met is the server\'s own `met`', () => {
  test('the ticked key reads met from the response, and the unticked one does not', async () => {
    const field = 'exitMonAllMeetingActionsCompleted'
    expect(C.monitoringTicked.requirements.find((r) => r.field === field)?.met).toBe(true)
    await show(C.monitoringTicked)
    const row = panel().querySelector(`[data-testid="tb-crit-${field}"]`) as HTMLElement
    expect(row.getAttribute('aria-checked')).toBe('true')
    expect(row.dataset.met).toBe('true')
    expect(row.querySelector('.tb-crit-box--met')).toBeTruthy()
    await show(C.monitoringUnticked)
    const again = panel().querySelector(`[data-testid="tb-crit-${field}"]`) as HTMLElement
    expect(again.getAttribute('aria-checked')).toBe('false')
    expect(again.querySelector('.tb-crit-box--met')).toBeNull()
  })

  test('computed rows carry the server\'s met too', async () => {
    // The SCORED case, not the data-entry one. Calibration found the first
    // version true by absence: every visible computed row there is unmet, so
    // "data-met follows the server" and "data-met is always false" read the
    // same (Verification 14). A score recorded through the route is met,
    // visible and read-only, which is the population the claim is about.
    const res = C.qualificationScored
    await show(res)
    const metComputed = rows().filter((r) => r.className.includes('tb-crit-row--computed')
      && r.dataset.met === 'true')
    expect(metComputed.length, 'no met computed row is on screen, so this cannot fail').toBeGreaterThan(0)
    expect(metComputed[0].querySelector('.tb-crit-box--met')).toBeTruthy()
    const shown = res.requirements.filter((r) => !(r.met && r.requirement_type === 'payload_field_required'
      && r.min_length === undefined))
    expect(rows().map((r) => r.dataset.met)).toEqual(shown.map((r) => String(r.met)))
  })
})

describe('1.3 TICKABLE REQUIRES ALL THREE: payload_field_required, a tick key, a label', () => {
  test('the client key set equals the server\'s TB_EXIT_CRITERION_KEYS, parsed from the route file', async () => {
    const src = await readText(`${__dirname}/../../../src/routes/test-beds.js`)
    const block = src.split('const TB_EXIT_CRITERION_KEYS = new Set([')[1]?.split('])')[0]
    expect(block, 'the server set was not found, so equality cannot be claimed').toBeTruthy()
    const server = [...block!.replace(/\/\/.*$/gm, '').matchAll(/'([^']+)'/g)].map((m) => m[1]).sort()
    expect(server.length).toBeGreaterThan(0)
    expect([...TB_EXIT_CRITERION_KEYS].sort()).toEqual(server)
  })

  test('a LABELLED payload field outside the key set renders read-only: Installer', async () => {
    const res = C.installation
    const installer = res.requirements.find((r) => r.field === 'installer_account_id')!
    expect(installer.label, 'the captured rule lost its label, so this is no longer the dangerous case').toBeTruthy()
    const onTick = vi.fn(async () => ({ ok: true }))
    await show(res, onTick)
    expect(tickables(), 'a labelled non-key field was offered as a tick').toHaveLength(0)
    const row = rows().find((r) => r.dataset.field === 'installer_account_id')!
    expect(row.className).toContain('tb-crit-row--computed')
    expect(row.getAttribute('tabindex')).toBeNull()
    await press(row)
    expect(onTick, 'a click on a computed row reached the writer').not.toHaveBeenCalled()
  })

  test('the labelled SCORE rows are read-only, and no Qualification row can write', async () => {
    const onTick = vi.fn(async () => ({ ok: true }))
    await show(C.qualificationFresh, onTick)
    expect(tickables()).toHaveLength(0)
    for (const r of rows()) await press(r)
    expect(onTick).not.toHaveBeenCalled()
  })

  test('the one real tick key IS tickable, and is the only one', async () => {
    await show(C.monitoringUnticked)
    expect(tickables().map((t) => t.dataset.field)).toEqual(['exitMonAllMeetingActionsCompleted'])
  })
})

describe('1.4 the process vs data-entry split', () => {
  test('met PROCESS rows stay (the ticked key); met DATA-ENTRY rows go', async () => {
    await show(C.monitoringTicked)
    expect(panel().querySelector('[data-testid="tb-crit-exitMonAllMeetingActionsCompleted"]'),
      'a performed step was hidden, which is the opposite of the ruling').toBeTruthy()
    const res = C.qualificationDataEntryMet
    await show(res)
    for (const r of res.requirements.filter((x) => x.met)) {
      expect(readable(r), `met data-entry "${r.message}" is still on screen`).toBe(false)
    }
  })

  test('UNMET data-entry rows show (contact roles, dates)', async () => {
    const res = C.qualificationFresh
    await show(res)
    for (const r of res.requirements.filter((x) => x.requirement_type === 'contact_role_linked')) {
      expect(readable(r)).toBe(true)
    }
  })
})

describe('1.5 the tick', () => {
  const FIELD = 'exitMonAllMeetingActionsCompleted'
  const row = () => panel().querySelector(`[data-testid="tb-crit-${FIELD}"]`) as HTMLElement

  test('an unmet row asks to TICK, and shows ticked once the write is confirmed', async () => {
    const onTick = vi.fn(async () => ({ ok: true }))
    await show(C.monitoringUnticked, onTick)
    await press(row())
    expect(onTick).toHaveBeenCalledWith(FIELD, false)
    expect(row().getAttribute('aria-checked')).toBe('true')
    expect(row().dataset.met, 'data-met is the SERVER\'s value and must not follow the click').toBe('false')
  })

  test('a met row asks to UNTICK', async () => {
    const onTick = vi.fn(async () => ({ ok: true }))
    await show(C.monitoringTicked, onTick)
    await press(row())
    expect(onTick).toHaveBeenCalledWith(FIELD, true)
    expect(row().getAttribute('aria-checked')).toBe('false')
  })

  test('the keyboard ticks too (Space)', async () => {
    const onTick = vi.fn(async () => ({ ok: true }))
    await show(C.monitoringUnticked, onTick)
    await act(async () => {
      row().dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
      await Promise.resolve(); await Promise.resolve()
    })
    expect(onTick).toHaveBeenCalledWith(FIELD, false)
  })

  test('a fresh server response REPLACES the confirmed state', async () => {
    await show(C.monitoringUnticked, async () => ({ ok: true }))
    await press(row())
    expect(row().getAttribute('aria-checked')).toBe('true')
    // The recompute answers, and the server says unmet (a copy, so a new object).
    await show(JSON.parse(JSON.stringify(C.monitoringUnticked)))
    expect(row().getAttribute('aria-checked'), 'a client record outlived the server\'s answer').toBe('false')
  })

  test('attemptTick writes a timestamp to tick and null to untick, then refreshes', async () => {
    const write = vi.fn(async () => ({ ok: true, error: null }))
    const refresh = vi.fn()
    const deps = { canEdit: () => true, write, refresh, now: () => '2026-09-17T01:00:00.000Z' }
    await attemptTick(deps, FIELD, false)
    await attemptTick(deps, FIELD, true)
    expect(write.mock.calls).toEqual([[{ [FIELD]: '2026-09-17T01:00:00.000Z' }], [{ [FIELD]: null }]])
    expect(refresh).toHaveBeenCalledTimes(2)
  })

  test('attemptTick asks the DOOR first: refused, it writes nothing and says nothing', async () => {
    const write = vi.fn(async () => ({ ok: true, error: null }))
    const r = await attemptTick({ canEdit: () => false, write, refresh: () => {}, now: () => 'x' }, FIELD, false)
    expect(write, 'a tick on somebody else\'s record reached the writer').not.toHaveBeenCalled()
    expect(r).toEqual({ ok: false, error: null })
  })
})

describe('1.6 the tick feedback', () => {
  const FIELD = 'exitMonAllMeetingActionsCompleted'
  test('a refused write says why in the panel, and leaves the row as it was', async () => {
    await show(C.monitoringUnticked, async () => ({ ok: false, error: 'payload contains fields that cannot be set' }))
    const row = panel().querySelector(`[data-testid="tb-crit-${FIELD}"]`) as HTMLElement
    await press(row)
    expect(host.querySelector('[data-testid="tb-crit-feedback"]')?.textContent)
      .toBe('Could not update: payload contains fields that cannot be set')
    expect(row.getAttribute('aria-checked')).toBe('false')
  })

  test('a door refusal (error null) says nothing, and the next attempt clears an old message', async () => {
    let result: TickResult = { ok: false, error: 'first' }
    await show(C.monitoringUnticked, async () => result)
    const row = () => panel().querySelector(`[data-testid="tb-crit-${FIELD}"]`) as HTMLElement
    await press(row())
    expect(host.querySelector('[data-testid="tb-crit-feedback"]')?.textContent).toBe('Could not update: first')
    result = { ok: false, error: null }
    await press(row())
    expect(host.querySelector('[data-testid="tb-crit-feedback"]')?.textContent).toBe('')
  })
})

describe('2.6 pending marks, rendered from the drafts', () => {
  const showPending = (data: unknown, pending: ReadonlySet<string>) => act(() => {
    root.render(<ExitCriteria stage="Any" data={data} panel={SETTLED('Any')} onTick={async () => ({ ok: true })} pending={pending} />)
  })
  const rowFor = (field: string) => rows().find((r) => r.dataset.field === field)!

  test('an UNMET row whose field is drafted gets the dot, the dashed box and "unsaved"; the others do not', async () => {
    const res = C.qualificationFresh
    const field = res.requirements.find((r) => r.min_length !== undefined && !r.met)!.field!
    await showPending(res, new Set([field]))
    const row = rowFor(field)
    expect(row.querySelector('.tb-crit-box--pending')?.textContent).toBe('●')
    expect(row.querySelector('[data-testid="tb-crit-pending-tag"]')?.textContent).toBe('unsaved')
    expect(row.dataset.met, 'a pending mark rewrote the server\'s met').toBe('false')
    expect(panel().querySelectorAll('[data-testid="tb-crit-pending-tag"]'), 'a row nobody drafted is marked').toHaveLength(1)
  })

  test('a SERVER-MET row is never marked, whatever is drafted', async () => {
    const res = C.qualificationScored
    const met = res.requirements.find((r) => r.min_length !== undefined && r.met)
    expect(met, 'the captured scored case has no met score row, so this cannot fail').toBeTruthy()
    await showPending(res, new Set([met!.field!]))
    const row = rowFor(met!.field!)
    expect(row.querySelector('.tb-crit-box--met')).toBeTruthy()
    expect(row.querySelector('.tb-crit-box--pending')).toBeNull()
    expect(row.querySelector('[data-testid="tb-crit-pending-tag"]')).toBeNull()
  })

  test('with nothing drafted there are no marks at all', async () => {
    await showPending(C.qualificationFresh, new Set())
    expect(panel().querySelectorAll('.tb-crit-box--pending, [data-testid="tb-crit-pending-tag"]')).toHaveLength(0)
  })
})
