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
import { ShellProvider } from '../ShellContext'
import { shellServices } from './fixtures'
import { scoreButton, scoreValue, scoredKeys, scoreDisabled } from './scoreControl'

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
    // V9: wrapped, because ScoringCard is a seam caller now (R2 option B).
    root.render(<ShellProvider services={shellServices()}>
      <StageTabs payload={{}} units={[]}
        landing={null} fresh currentStage="Qualification" nextStage="Closed"
        deps={deps()} reference={<p>reference</p>} commercials={<p>commercials</p>} /></ShellProvider>)
  })
  await settle()
  await act(async () => { q('tb-tab-btn-stage-Qualification')!.click() })
  await settle()
}

/** Level 1 of this captured criterion is the one the route marks reason_required. */
const draftABlockingScore = async () => {
  await act(async () => {
    // V9: the control is five buttons now, so drafting is a CLICK.
    scoreButton(host, 'scoreRolloutPath', 1)!.click()
  })
  await settle()
}

const escapeOn = async (id: string) => {
  await act(async () => {
    q(id)!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  })
  await settle()
}
/** V9: the score control is not addressable by one testid any more. */
const escapeOnEl = async (el: HTMLElement) => {
  await act(async () => { el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })) })
  await settle()
}

describe('Walk 2: Next Stage wears the estate\'s primary treatment', () => {
  // The vanilla's own class, `btn-sm btn-primary` (54001c5^:index.html:900).
  // The React replacement shipped with none, so the estate's most prominent
  // action on this surface rendered as a white browser default.
  test('the Next Stage control is not a browser default', async () => {
    await render()
    const btn = q('tb-next-stage-btn')
    expect(btn, 'there is no Next Stage control to dress').not.toBeNull()
    expect(btn!.className, 'Next Stage carries no class at all').toContain('btn-primary')
    expect(btn!.className).toContain('btn-sm')
  })
})

describe('W7: Escape reverts the field, as ruling A3 already requires elsewhere', () => {
  test('Escape in the reason box drops the draft, so the recorded value stands again', async () => {
    await render()
    await draftABlockingScore()
    expect(q('tb-score-reason-scoreRolloutPath'), 'no reason box opened, so there is nothing to escape from').not.toBeNull()

    await escapeOn('tb-score-reason-scoreRolloutPath')

    expect(q('tb-score-reason-scoreRolloutPath'), 'Escape left the reason box open').toBeNull()
    expect(scoreValue(host, 'scoreRolloutPath'),
      'Escape left the draft on the select').toBe('')
  })

  test('and Escape on the score control itself does the same, because it is the same gesture', async () => {
    await render()
    await draftABlockingScore()
    await escapeOnEl(scoreButton(host, 'scoreRolloutPath', 1)!)
    expect(scoreValue(host, 'scoreRolloutPath')).toBe('')
    expect(q('tb-score-reason-scoreRolloutPath')).toBeNull()
  })

  test('Escape with NO draft changes nothing, so it cannot destroy a recorded score', async () => {
    await render()
    const before = host.innerHTML
    await escapeOnEl(scoreButton(host, 'scoreRolloutPath', 1)!)
    expect(host.innerHTML, 'Escape on an untouched row changed the surface').toBe(before)
  })

  // ADDED FROM A SILENT CALIBRATION (Verification 51). The injection that makes
  // the handler fire on EVERY key came back silent: the tests drove the reason
  // box through React's onChange, so not one of them pressed an ordinary key at
  // it, and a handler that reverted on every keystroke would have shipped. The
  // silence named a claim nothing asserted.
  test('and ORDINARY keys in the reason box leave the draft alone', async () => {
    await render()
    await draftABlockingScore()
    for (const key of ['a', 'Shift', 'Backspace', 'Enter']) {
      await act(async () => {
        q('tb-score-reason-scoreRolloutPath')!
          .dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
      })
      await settle()
      expect(q('tb-score-reason-scoreRolloutPath'), `"${key}" reverted the draft`).not.toBeNull()
      expect(scoreValue(host, 'scoreRolloutPath'),
        `"${key}" cleared the score`).toBe('1')
    }
  })
})

describe('W8a: the awaiting-reason lock never traps a person who changed their mind', () => {
  test('a blank reason locks the other criteria, and Escape releases them', async () => {
    await render()
    await draftABlockingScore()

    // The lock, as it stands: every other criterion's control is refused while
    // this one has no reason. Asserted so the release below is not vacuous.
    const others = scoredKeys(host).filter((k) => k !== 'scoreRolloutPath')
    expect(others.length, 'there are no other criteria, so the lock claim is vacuous').toBeGreaterThan(0)
    expect(others.every((k) => scoreDisabled(host, k)), 'the lock is not on, so releasing it proves nothing').toBe(true)
    expect((q('tb-score-record') as HTMLButtonElement).disabled).toBe(true)

    await escapeOn('tb-score-reason-scoreRolloutPath')

    expect(others.every((k) => !scoreDisabled(host, k)), 'Escape left the other criteria locked').toBe(true)
    expect(q('tb-score-lock-note'), 'the lock note survived the escape').toBeNull()
  })
})
