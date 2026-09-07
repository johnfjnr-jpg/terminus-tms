// ── THE STAGE-TAB SHELL ─────────────────────────────────────────────────
//
// Derived from the T and P enumeration, Round 7 Phase 2b session 1.
import { describe, test, expect } from 'vitest'
import {
  TB_TABS, STAGE_TABS, isStageTab, stageOf, tabKey, paneFor,
  landingTab, shouldClearFeedback, nextStageState,
} from '../testbed/tabModel'
import { createStageLoader, PANEL_IDS } from '../testbed/stageLoad'

const STAGES = [
  { stage_name: 'Qualification', sort_order: 1 },
  { stage_name: 'Site Assessment', sort_order: 2 },
  { stage_name: 'Closed', sort_order: 9 },
]

describe('T: the tab strip', () => {
  test('T1 ten tabs, and only eight are stages', () => {
    expect(TB_TABS).toHaveLength(10)
    expect(STAGE_TABS).toHaveLength(8)
    expect(TB_TABS.filter((t) => !isStageTab(t.key)).map((t) => t.key))
      .toEqual(['reference', 'commercials'])
  })

  test('T1 the eight stage names are the record type\'s, in order', () => {
    expect(STAGE_TABS.map((t) => stageOf(t.key))).toEqual([
      'Qualification', 'Pre-Site Assessment', 'Site Assessment',
      'Installation and Commissioning', 'Monitoring and Analysis',
      'Review and Completion', 'Decommissioning', 'Closed'])
  })

  test('T1 a stage name carrying a hyphen survives the key round trip', () => {
    // Pre-Site Assessment is the case that breaks a naive split on '-'.
    expect(stageOf(tabKey('Pre-Site Assessment'))).toBe('Pre-Site Assessment')
    expect(stageOf(tabKey('Installation and Commissioning')))
      .toBe('Installation and Commissioning')
  })

  test('T2 the eight stage tabs share ONE pane; the other two have their own', () => {
    const panes = new Set(STAGE_TABS.map((t) => paneFor(t.key)))
    expect(panes.size, 'the stage tabs do not share one pane').toBe(1)
    expect([...panes][0]).toBe('tb-tab-stage-detail')
    expect(paneFor('reference')).toBe('tb-tab-reference')
    expect(paneFor('commercials')).toBe('tb-tab-commercials')
  })

  test('T5 a landed transition outranks everything', () => {
    expect(landingTab({ landing: 'Site Assessment', fresh: true, userPicked: true, openTab: 'commercials' }))
      .toBe('stage-Site Assessment')
  })

  test('T5 a fresh arrival lands on reference', () => {
    expect(landingTab({ landing: null, fresh: true, userPicked: false, openTab: null }))
      .toBe('reference')
  })

  test('T4 unless the user has already clicked, which outranks the default', () => {
    expect(landingTab({ landing: null, fresh: true, userPicked: true, openTab: 'stage-Qualification' }))
      .toBe('stage-Qualification')
  })

  test('T5 a reload RE-APPLIES the open tab rather than leaving it alone', () => {
    expect(landingTab({ landing: null, fresh: false, userPicked: false, openTab: 'stage-Qualification' }))
      .toBe('stage-Qualification')
  })

  test('T5 and falls back to reference with nothing open', () => {
    expect(landingTab({ landing: null, fresh: false, userPicked: false, openTab: null }))
      .toBe('reference')
  })

  test('T6 the feedback clears on a tab CHANGE and survives a re-apply', () => {
    expect(shouldClearFeedback('stage-Qualification', 'reference')).toBe(true)
    expect(shouldClearFeedback('stage-Qualification', 'stage-Qualification'),
      'a re-apply cleared the feedback, which erases a save failure on reload')
      .toBe(false)
    expect(shouldClearFeedback(null, 'reference'),
      'the first activation of a load cleared feedback there was no tab change for')
      .toBe(false)
  })

  test('T7 Next Stage is enabled only on the CURRENT stage tab', () => {
    const s = { currentStage: 'Qualification', nextStage: 'Site Assessment' }
    expect(nextStageState(s, 'stage-Qualification'))
      .toEqual({ disabled: false, label: 'Next Stage' })
    expect(nextStageState(s, 'stage-Site Assessment'))
      .toEqual({ disabled: true, label: 'Next Stage' })
    expect(nextStageState(s, 'reference'))
      .toEqual({ disabled: true, label: 'Next Stage' })
  })

  test('T7 with no next stage the LABEL changes, which is what carries the reason', () => {
    expect(nextStageState({ currentStage: 'Closed', nextStage: null }, 'stage-Closed'))
      .toEqual({ disabled: true, label: 'Final stage' })
  })
})

describe('P: the stage panel load', () => {
  const okFetches = () => ({
    documents: async () => ({ ok: true, data: ['doc'] }),
    criteria: async () => ({ ok: true, data: ['crit'] }),
    approvals: async () => ({ ok: true, data: [{ stage_name: 'Qualification' }] }),
  })
  test('P3 pending is stamped SYNCHRONOUSLY, before any await', () => {
    const seen: Record<string, { pending?: string, stage?: string }> = {}
    const loader = createStageLoader({
      ...okFetches(), stages: STAGES,
      onPanel: (id, s) => { seen[id] = { ...s } },
    })
    void loader.open('Qualification')
    for (const id of PANEL_IDS) {
      expect(seen[id]?.pending, `${id} was not marked pending synchronously`).toBe('Qualification')
      expect(seen[id]?.stage, `${id} claimed a stage while still loading`).toBeUndefined()
    }
  })

  test('P3 settled sets the stage and clears pending', async () => {
    const seen: Record<string, { pending?: string, stage?: string }> = {}
    const loader = createStageLoader({
      ...okFetches(), stages: STAGES,
      onPanel: (id, s) => { seen[id] = { ...s } },
    })
    await loader.open('Qualification')
    for (const id of PANEL_IDS) {
      expect(seen[id]).toEqual({ stage: 'Qualification' })
    }
  })

  test('P3 a FAILURE clears both, so a wait on stage cannot pass on an error', async () => {
    const seen: Record<string, { pending?: string, stage?: string }> = {}
    const loader = createStageLoader({
      ...okFetches(),
      criteria: async () => ({ ok: false, data: null }),
      stages: STAGES,
      onPanel: (id, s) => { seen[id] = { ...s } },
    })
    await loader.open('Qualification')
    expect(seen['tb-stage-exit-criteria-list'], 'a failed panel claimed a stage').toEqual({})
    expect(seen['tb-stage-approval-row'], 'one panel failing took another down')
      .toEqual({ stage: 'Qualification' })
  })

  test('P2 each panel renders on ITS OWN response, not after all three', async () => {
    const order: string[] = []
    let releaseSlow: () => void = () => {}
    const slow = new Promise<void>((r) => { releaseSlow = r })
    const loader = createStageLoader({
      documents: async () => { await slow; return { ok: true, data: ['doc'] } },
      criteria: async () => ({ ok: true, data: ['crit'] }),
      approvals: async () => ({ ok: true, data: [] }),
      stages: STAGES,
      onPanel: (id, s) => { if (s.stage) order.push(id) },
    })
    const done = loader.open('Qualification')
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
    expect(order, 'a fast panel waited for the slow one').toContain('tb-stage-exit-criteria-list')
    expect(order).not.toContain('tb-stage-documents-section')
    releaseSlow()
    await done
    expect(order).toContain('tb-stage-documents-section')
  })

  test('P1 THE OLDER LOAD MAY NOT WRITE, however late it resolves', async () => {
    const seen: Record<string, { pending?: string, stage?: string }> = {}
    let releaseFirst: () => void = () => {}
    const first = new Promise<void>((r) => { releaseFirst = r })
    let n = 0
    const loader = createStageLoader({
      documents: async () => { if (n++ === 0) await first; return { ok: true, data: [] } },
      criteria: async () => ({ ok: true, data: [] }),
      approvals: async () => ({ ok: true, data: [] }),
      stages: STAGES,
      onPanel: (id, s) => { seen[id] = { ...s } },
    })
    const a = loader.open('Qualification')
    const b = loader.open('Site Assessment')
    await b
    releaseFirst()
    await a
    expect(seen['tb-stage-documents-section']?.stage,
      'the older load overwrote the newer stage').toBe('Site Assessment')
  })

  test('P4 the TERMINAL stage renders the completed record, not the panels', async () => {
    const loader = createStageLoader({ ...okFetches(), stages: STAGES, onPanel: () => {} })
    const r = await loader.open('Closed')
    expect(r.terminal, 'Closed was not read as terminal').toBe(true)
    expect(r.panelsVisible).toBe(false)
  })

  test('P4 terminal is decided by the DATA, never by the string Closed', async () => {
    // A record type whose last stage is named otherwise must behave the same.
    const stages = [
      { stage_name: 'Qualification', sort_order: 1 },
      { stage_name: 'Retired', sort_order: 5 },
    ]
    const loader = createStageLoader({ ...okFetches(), stages, onPanel: () => {} })
    expect((await loader.open('Retired')).terminal).toBe(true)
    expect((await loader.open('Qualification')).terminal).toBe(false)
  })

  test('P5 the terminal branch STILL stamps the scoring card\'s stage', async () => {
    const cards: Record<string, string | undefined> = {}
    const loader = createStageLoader({
      ...okFetches(), stages: STAGES,
      onPanel: () => {},
      onScoringCard: (s) => { cards.stage = s.stage },
    })
    await loader.open('Closed')
    expect(cards.stage, 'the terminal tab left the card with no stage at all')
      .toBe('Closed')
  })

  test('P8 the scoring card is HIDDEN until its own criteria are derived', async () => {
    const states: Array<{ hidden: boolean, stage?: string }> = []
    const loader = createStageLoader({
      ...okFetches(), stages: STAGES,
      onPanel: () => {},
      onScoringCard: (s) => { states.push({ ...s }) },
    })
    await loader.open('Qualification')
    expect(states[0], 'the card was not hidden at the start of the load')
      .toEqual({ hidden: true, stage: undefined })
    expect(states.at(-1)).toEqual({ hidden: false, stage: 'Qualification' })
  })

  test('P6 the install section is visible ONLY for Installation and Commissioning', async () => {
    const seen: boolean[] = []
    const loader = createStageLoader({
      ...okFetches(), stages: STAGES.concat({ stage_name: 'Installation and Commissioning', sort_order: 4 }),
      onPanel: () => {}, onInstallSection: (v) => seen.push(v),
    })
    await loader.open('Qualification')
    await loader.open('Installation and Commissioning')
    expect(seen).toEqual([false, true])
  })

  test('P7 units are derived only for the stage that owns them', async () => {
    let derived = 0
    const loader = createStageLoader({
      ...okFetches(), stages: STAGES.concat({ stage_name: 'Installation and Commissioning', sort_order: 4 }),
      onPanel: () => {}, onDeriveUnits: () => { derived++ },
    })
    await loader.open('Qualification')
    expect(derived, 'units were derived for a stage that does not own them').toBe(0)
    await loader.open('Installation and Commissioning')
    expect(derived).toBe(1)
  })

  test('P9 a THROW leaves no panel pending, and writes a real message', async () => {
    const seen: Record<string, { pending?: string, stage?: string, error?: string }> = {}
    const loader = createStageLoader({
      ...okFetches(),
      approvals: async () => { throw new Error('network') },
      stages: STAGES,
      onPanel: (id, s) => { seen[id] = { ...s } },
    })
    await loader.open('Qualification')
    expect(seen['tb-stage-approval-row']?.pending).toBeUndefined()
    expect(seen['tb-stage-approval-row']?.stage).toBeUndefined()
    expect(seen['tb-stage-approval-row']?.error).toMatch(/Reopen the tab/)
  })

  test('P9 and a STALE throw may not clear a newer load\'s state', async () => {
    const seen: Record<string, { pending?: string, stage?: string, error?: string }> = {}
    let boom: (e: Error) => void = () => {}
    const failFirst = new Promise<never>((_, rej) => { boom = rej })
    let n = 0
    const loader = createStageLoader({
      documents: async () => ({ ok: true, data: [] }),
      criteria: async () => ({ ok: true, data: [] }),
      approvals: async () => { if (n++ === 0) return failFirst; return { ok: true, data: [] } },
      stages: STAGES,
      onPanel: (id, s) => { seen[id] = { ...s } },
    })
    const a = loader.open('Qualification')
    const b = loader.open('Site Assessment')
    await b
    boom(new Error('late'))
    await a
    expect(seen['tb-stage-approval-row']?.stage,
      'a stale failure wiped the newer load\'s settled panel').toBe('Site Assessment')
    expect(seen['tb-stage-approval-row']?.error).toBeUndefined()
  })

  test('the loader reports which panels a stage produced, so a caller can render', async () => {
    const loader = createStageLoader({ ...okFetches(), stages: STAGES, onPanel: () => {} })
    const r = await loader.open('Qualification')
    expect(r.terminal).toBe(false)
    expect(r.panelsVisible).toBe(true)
    expect(Object.keys(r.panels).sort()).toEqual([...PANEL_IDS].sort())
  })
})
