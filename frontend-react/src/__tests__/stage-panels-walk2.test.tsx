// ── WALK 2: W7 AND W8a, ESCAPE ON THE SCORING SURFACE ───────────────────
//
// W7 restores a ruling that already exists elsewhere. A3, ruled by John at the
// Leads round's Phase 0 sign-off (2026-09-11, built in `daa90af`): Escape
// reverts the focused field to its last saved value. It lives in the FIELD ROW
// and it has never reached this card, whose controls are bespoke - the
// archaeology is in the phase report.
//
// W8a is the same gesture asked to do one more thing: a person held by the
// awaiting-reason lock, with the reason box blank, must have a visible way out.
import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { StageTabs, type StageTabsDeps } from '../testbed/StageTabs'
import LIVE_JSON from './fixtures/exit-criteria-live.json'
import SCORING_JSON from './fixtures/scoring-live.json'
import { criteriaForStage, type Criterion } from '../testbed/scoring'

let host: HTMLElement
let root: Root

const STAGES = [
  { stage_name: 'Qualification', sort_order: 1 },
  { stage_name: 'Closed', sort_order: 9 },
]
const CRITERIA = LIVE_JSON.cases.qualificationFresh

const deps = (over: Partial<StageTabsDeps> = {}): StageTabsDeps => ({
  stages: STAGES,
  documents: async () => ({ ok: true, data: [] }),
  criteria: async () => ({ ok: true, data: CRITERIA }),
  approvals: async () => ({ ok: true, data: [] }),
  scoringCriteria: (stage) => criteriaForStage(SCORING_JSON.criteria as Criterion[], stage),
  series: () => [],
  onTick: async () => ({ ok: true }),
  onRecordScores: async () => ({ recorded: [], failed: null, refused: false }),
  onMeasurability: async () => null,
  onDeriveUnits: async () => {},
  unitDeps: { patch: async () => ({ ok: true, data: {} }), unitById: () => undefined, onUnit: () => {} },
  ...over,
})

beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host) })
afterEach(() => { act(() => root.unmount()); host.remove() })

const settle = async () => { for (let i = 0; i < 4; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)) }) }
const q = (id: string) => host.querySelector(`[data-testid="${id}"]`) as HTMLElement | null

const render = async () => {
  act(() => {
    root.render(
      <StageTabs payload={{}} units={[]}
        landing={null} fresh currentStage="Qualification" nextStage="Closed"
        deps={deps()} reference={<p>reference</p>} commercials={<p>commercials</p>} />)
  })
  await settle()
  await act(async () => { q('tb-tab-btn-stage-Qualification')!.click() })
  await settle()
}

/** Level 1 of this captured criterion is the one the route marks reason_required. */
const draftABlockingScore = async () => {
  await act(async () => {
    const sel = q('tb-score-select-scoreRolloutPath') as unknown as HTMLSelectElement
    sel.value = '1'
    sel.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await settle()
}

const escapeOn = async (id: string) => {
  await act(async () => {
    q(id)!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  })
  await settle()
}

describe('W7: Escape reverts the field, as ruling A3 already requires elsewhere', () => {
  test('Escape in the reason box drops the draft, so the recorded value stands again', async () => {
    await render()
    await draftABlockingScore()
    expect(q('tb-score-reason-scoreRolloutPath'), 'no reason box opened, so there is nothing to escape from').not.toBeNull()

    await escapeOn('tb-score-reason-scoreRolloutPath')

    expect(q('tb-score-reason-scoreRolloutPath'), 'Escape left the reason box open').toBeNull()
    expect((q('tb-score-select-scoreRolloutPath') as unknown as HTMLSelectElement).value,
      'Escape left the draft on the select').toBe('')
  })

  test('and Escape on the score control itself does the same, because it is the same gesture', async () => {
    await render()
    await draftABlockingScore()
    await escapeOn('tb-score-select-scoreRolloutPath')
    expect((q('tb-score-select-scoreRolloutPath') as unknown as HTMLSelectElement).value).toBe('')
    expect(q('tb-score-reason-scoreRolloutPath')).toBeNull()
  })

  test('Escape with NO draft changes nothing, so it cannot destroy a recorded score', async () => {
    await render()
    const before = host.innerHTML
    await escapeOn('tb-score-select-scoreRolloutPath')
    expect(host.innerHTML, 'Escape on an untouched row changed the surface').toBe(before)
  })
})

describe('W8a: the awaiting-reason lock never traps a person who changed their mind', () => {
  test('a blank reason locks the other criteria, and Escape releases them', async () => {
    await render()
    await draftABlockingScore()

    // The lock, as it stands: every other criterion's control is refused while
    // this one has no reason. Asserted so the release below is not vacuous.
    const others = [...host.querySelectorAll('[data-testid^="tb-score-select-"]')]
      .filter((el) => el.getAttribute('data-testid') !== 'tb-score-select-scoreRolloutPath') as HTMLSelectElement[]
    expect(others.length, 'there are no other criteria, so the lock claim is vacuous').toBeGreaterThan(0)
    expect(others.every((el) => el.disabled), 'the lock is not on, so releasing it proves nothing').toBe(true)
    expect((q('tb-score-record') as HTMLButtonElement).disabled).toBe(true)

    await escapeOn('tb-score-reason-scoreRolloutPath')

    expect(others.every((el) => !el.disabled), 'Escape left the other criteria locked').toBe(true)
    expect(q('tb-score-lock-note'), 'the lock note survived the escape').toBeNull()
  })
})
