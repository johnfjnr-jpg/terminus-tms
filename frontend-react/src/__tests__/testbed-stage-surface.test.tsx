// ── THE STAGE-TAB SURFACE, RENDERED ─────────────────────────────────────
//
// Round 7 Phase 2b session 1. The T/P model is unit-tested next door; this
// drives the components, THROUGH ONE ROOT RE-RENDERED, because main.tsx calls
// root.render() again for every navigation and every mount-shaped assumption
// stops holding on the second visit (Verification 47's re-navigation clause).
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { StageTabs, type StageTabsDeps } from '../testbed/StageTabs'
import { UseCasesList } from '../testbed/UseCasesList'

let host: HTMLElement
let root: Root

const STAGES = [
  { stage_name: 'Qualification', sort_order: 1 },
  { stage_name: 'Installation and Commissioning', sort_order: 4 },
  { stage_name: 'Closed', sort_order: 9 },
]

const CRITERIA = [{ field: 'siteSurveyDone', label: 'Site survey done', value: null }]

const deps = (over: Partial<StageTabsDeps> = {}): StageTabsDeps => ({
  stages: STAGES,
  documents: async () => ({ ok: true, data: [] }),
  criteria: async () => ({ ok: true, data: CRITERIA }),
  approvals: async () => ({ ok: true, data: [] }),
  scoringCriteria: () => [{
    criterion_key: 'k1', name: 'Budget confirmed',
    levels: [{ value: 1, label: 'Unknown', reason_required: true },
      { value: 3, label: 'Confirmed', reason_required: true }],
  }],
  series: () => [],
  onTick: () => {},
  onRecordScores: () => {},
  onDeriveUnits: async () => {},
  unitDeps: {
    patch: async () => ({ ok: true, data: {} }),
    unitById: () => undefined,
    onUnit: () => {},
  },
  ...over,
})

const render = (props: Partial<Parameters<typeof StageTabs>[0]> = {}) => act(() => {
  root.render(
    <StageTabs payload={{ safesightCameras: '2' }} units={[]}
      landing={null} fresh currentStage="Qualification" nextStage="Site Assessment"
      deps={deps()} reference={<p data-testid="ref-slot">reference</p>}
      commercials={<p data-testid="comm-slot">commercials</p>}
      {...props} />)
})

const q = (id: string) => host.querySelector(`[data-testid="${id}"]`)
const click = async (id: string) => {
  await act(async () => {
    (q(id) as HTMLElement).click()
    await Promise.resolve()
  })
}

beforeEach(() => {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

describe('the tab strip renders', () => {
  test('ten tabs, and the landing tab is Reference', async () => {
    await render()
    expect(host.querySelectorAll('[data-tb-tab]')).toHaveLength(10)
    expect(q('tb-tab-btn-reference')?.getAttribute('aria-selected')).toBe('true')
    expect(q('ref-slot'), 'the reference slot did not render').toBeTruthy()
  })

  test('T3 the green dot marks the RECORD\'s stage, not the open tab', async () => {
    await render()
    expect(q('tb-tab-dot-stage-Qualification'), 'the current stage carries no dot').toBeTruthy()
    expect(q('tb-tab-dot-stage-Closed')).toBeNull()
    expect(q('tb-tab-btn-stage-Qualification')?.getAttribute('aria-selected'),
      'the dot selected the tab, so a dot is being read as a selection').toBe('false')
  })

  test('the Next Stage button does not exist until the stage list is known', async () => {
    // Otherwise the first paint reads "Final stage" on a record that is not at
    // one, because an empty stage list makes nextStage null. Found by looking
    // at a screenshot; every assertion passed.
    await render({ deps: deps({ stages: [] }) })
    expect(q('tb-next-stage-btn'),
      'the button rendered before the stage list arrived, so its label is a guess')
      .toBeNull()
    await render()
    expect(q('tb-next-stage-btn'), 'the button never appears').toBeTruthy()
  })

  test('T7 Next Stage is disabled on Reference and enabled on the current stage tab', async () => {
    await render()
    expect((q('tb-next-stage-btn') as HTMLButtonElement).disabled).toBe(true)
    await click('tb-tab-btn-stage-Qualification')
    expect((q('tb-next-stage-btn') as HTMLButtonElement).disabled).toBe(false)
  })

  test('a stage tab renders the shared panel and its heading', async () => {
    await render()
    await click('tb-tab-btn-stage-Qualification')
    expect(q('tb-tab-stage-detail')).toBeTruthy()
    expect(q('tb-stage-detail-heading')?.textContent).toBe('Qualification')
    expect(q('ref-slot'), 'the reference pane is still mounted under a stage tab').toBeNull()
  })

  test('P3 the panels carry the SETTLED stage once their data lands', async () => {
    await render()
    await click('tb-tab-btn-stage-Qualification')
    for (const id of ['tb-stage-documents-section', 'tb-stage-exit-criteria-list',
      'tb-stage-approval-row']) {
      expect(q(id)?.getAttribute('data-stage'), `${id} did not settle`).toBe('Qualification')
    }
  })

  test('B: the criteria list renders the stage\'s own criteria, unticked', async () => {
    await render()
    await click('tb-tab-btn-stage-Qualification')
    expect(q('tb-crit-siteSurveyDone')).toBeTruthy()
    expect((q('tb-crit-tick-siteSurveyDone') as HTMLInputElement).checked).toBe(false)
  })

  test('B1 a tick writes a TIMESTAMP, never a boolean', async () => {
    const onTick = vi.fn()
    await render({ deps: deps({ onTick }) })
    await click('tb-tab-btn-stage-Qualification')
    await click('tb-crit-tick-siteSurveyDone')
    expect(onTick).toHaveBeenCalledTimes(1)
    const payload = onTick.mock.calls[0][0] as Record<string, unknown>
    expect(typeof payload.siteSurveyDone,
      'the tick wrote a boolean, which the gate reads as PRESENT').toBe('string')
    expect(String(payload.siteSurveyDone)).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  test('P8 the scoring card is HIDDEN by attribute until its stage is derived', async () => {
    await render()
    const before = q('tb-stage-scoring-card')
    expect(before, 'the card renders outside a stage tab').toBeNull()
    await click('tb-tab-btn-stage-Qualification')
    const card = q('tb-stage-scoring-card') as HTMLElement
    expect(card.hasAttribute('hidden')).toBe(false)
    expect(card.getAttribute('data-stage')).toBe('Qualification')
    // The Round 5 finding: an attribute assertion is not a visibility one.
    expect(getComputedStyle(card).display,
      'a stylesheet gave the hidden card a display, so it renders anyway')
      .not.toBe('flex')
  })

  test('P8 the card is HIDDEN WHILE THE LOAD IS IN FLIGHT, which is the point', async () => {
    // FOUND BY A SILENT INJECTION. The reveal was asserted and the HIDING was
    // not, so removing the hidden attribute altogether changed nothing: the
    // test only ever read it in the state where it is false either way.
    // Verification 14's shape - an assertion satisfied by an absence.
    let release: () => void = () => {}
    const held = new Promise<void>((r) => { release = r })
    await render({ deps: deps({
      criteria: async () => { await held; return { ok: true, data: CRITERIA } },
    }) })
    await click('tb-tab-btn-stage-Qualification')
    const card = q('tb-stage-scoring-card') as HTMLElement
    expect(card.hasAttribute('hidden'),
      'the card was visible while its own criteria were still loading, so one '
      + "stage can show another's").toBe(true)
    expect(card.getAttribute('data-stage'),
      'the card claimed a stage it had not derived').toBeNull()
    await act(async () => { release(); await Promise.resolve() })
    expect((q('tb-stage-scoring-card') as HTMLElement).hasAttribute('hidden')).toBe(false)
  })

  test('S7 the pane shows ONE type, and the tab chooses which', async () => {
    // ALSO FOUND BY A SILENT INJECTION: every rendered fixture held units of a
    // single type, so removing the filter was invisible.
    await render({ units: [
      { id: 'ss1', type: 'SafeSight' },
      { id: 'hm1', type: 'HEMIR' },
    ] })
    await click('tb-tab-btn-stage-Installation and Commissioning')
    expect(q('tb-unit-ss1'), 'the default tab does not show its own type').toBeTruthy()
    expect(q('tb-unit-hm1'), 'a unit of another type rendered in this tab').toBeNull()
    await click('tb-units-tab-hemirSensors')
    expect(q('tb-unit-hm1')).toBeTruthy()
    expect(q('tb-unit-ss1'), 'the previous tab\'s units survived the switch').toBeNull()
  })

  test('C5 the record button is BLOCKED until a required reason is given', async () => {
    await render()
    await click('tb-tab-btn-stage-Qualification')
    await act(async () => {
      const sel = q('tb-score-select-k1') as HTMLSelectElement
      sel.value = '3'
      sel.dispatchEvent(new Event('change', { bubbles: true }))
      await Promise.resolve()
    })
    expect((q('tb-score-record') as HTMLButtonElement).disabled,
      'a score needing a reason did not block the save').toBe(true)
    expect(q('tb-score-blocked')?.textContent).toContain('k1')
  })

  test('P6 the install section is hidden by ATTRIBUTE off its own stage', async () => {
    await render()
    await click('tb-tab-btn-stage-Qualification')
    const sec = q('tb-stage-install-section') as HTMLElement
    expect(sec.hasAttribute('hidden')).toBe(true)
    await click('tb-tab-btn-stage-Installation and Commissioning')
    expect((q('tb-stage-install-section') as HTMLElement).hasAttribute('hidden')).toBe(false)
    expect(q('tb-units-pane'), 'the units pane is not on its own stage').toBeTruthy()
  })

  test('S2 the units pane names the SHORTFALL and offers the correction', async () => {
    await render()
    await click('tb-tab-btn-stage-Installation and Commissioning')
    expect(q('tb-units-sub')?.textContent).toContain('2 planned')
    expect(q('tb-units-correction-text')?.textContent).toContain('2 units planned')
    expect(q('tb-units-derive')).toBeTruthy()
  })

  test('S2 and offers no correction when the units are all there', async () => {
    await render({ units: [{ id: 'u1', type: 'SafeSight' }, { id: 'u2', type: 'SafeSight' }] })
    await click('tb-tab-btn-stage-Installation and Commissioning')
    expect(q('tb-units-derive'), 'a correction was offered with no shortfall').toBeNull()
    expect(q('tb-unit-u1')).toBeTruthy()
  })

  test('P4 the TERMINAL tab renders neither the panels nor the units', async () => {
    await render()
    await click('tb-tab-btn-stage-Closed')
    expect(q('tb-stage-detail-heading')?.textContent).toBe('Closed')
    expect(q('tb-stage-exit-criteria-list')?.getAttribute('data-stage'),
      'the terminal tab settled a panel it does not have').not.toBe('Closed')
  })
})

describe('F: the stage refresh', () => {
  test('F1 a bumped token RE-LOADS the open stage', async () => {
    const criteria = vi.fn(async () => ({ ok: true, data: CRITERIA }))
    await render({ deps: deps({ criteria }) })
    await click('tb-tab-btn-stage-Qualification')
    const before = criteria.mock.calls.length
    await render({ deps: deps({ criteria }), refreshToken: 1 })
    expect(criteria.mock.calls.length,
      'the refresh token did not reload the open stage').toBeGreaterThan(before)
  })

  test('F1 and does NOTHING while Reference is open', async () => {
    const criteria = vi.fn(async () => ({ ok: true, data: CRITERIA }))
    await render({ deps: deps({ criteria }) })
    const before = criteria.mock.calls.length
    await render({ deps: deps({ criteria }), refreshToken: 1 })
    expect(criteria.mock.calls.length,
      'a refresh fired with no stage tab open').toBe(before)
  })

  test('F1 an UNCHANGED token does not reload', async () => {
    const criteria = vi.fn(async () => ({ ok: true, data: CRITERIA }))
    await render({ deps: deps({ criteria }), refreshToken: 3 })
    await click('tb-tab-btn-stage-Qualification')
    const before = criteria.mock.calls.length
    await render({ deps: deps({ criteria }), refreshToken: 3 })
    expect(criteria.mock.calls.length,
      'an unchanged token reloaded, so every render refetches').toBe(before)
  })
})

describe('re-navigation: ONE root, re-rendered', () => {
  test('a second visit to a DIFFERENT record re-derives the landing tab', async () => {
    await render()
    await click('tb-tab-btn-stage-Qualification')
    expect(q('tb-tab-stage-detail')).toBeTruthy()

    // The shell re-renders rather than mounting: a mount-keyed effect would
    // never run again and the tab would stay where the last record left it.
    await render({ landing: 'Closed', fresh: true })
    expect(q('tb-stage-detail-heading')?.textContent,
      'the landing tab did not re-derive on the second visit').toBe('Closed')
  })

  test('and a stage tab re-loads its panels on the second visit', async () => {
    const criteria = vi.fn(async () => ({ ok: true, data: CRITERIA }))
    await render({ deps: deps({ criteria }) })
    await click('tb-tab-btn-stage-Qualification')
    const first = criteria.mock.calls.length
    await render({ deps: deps({ criteria }), landing: 'Qualification' })
    expect(criteria.mock.calls.length,
      'the second visit served cached panels rather than re-loading')
      .toBeGreaterThan(first)
  })
})

describe('U: the use-case list', () => {
  const mount = (useCases: string[] | undefined, onWrite = vi.fn(async () => true)) => {
    act(() => { root.render(<UseCasesList useCases={useCases} onWrite={onWrite} />) })
    return onWrite
  }

  test('an empty list SAYS so rather than rendering nothing', () => {
    mount([])
    expect(q('tb-usecases-empty')?.textContent).toContain('No use cases yet')
  })

  test('U2 adding writes the WHOLE list, not the one item', async () => {
    const onWrite = mount(['first'])
    await act(async () => {
      const input = q('tb-usecase-input') as HTMLInputElement
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype, 'value')!.set!
      setter.call(input, 'second')
      input.dispatchEvent(new Event('input', { bubbles: true }))
      await Promise.resolve()
    })
    await click('tb-usecase-add')
    expect(onWrite).toHaveBeenCalledWith(['first', 'second'])
  })

  test('a blank addition writes NOTHING', async () => {
    const onWrite = mount(['first'])
    await click('tb-usecase-add')
    expect(onWrite, 'a blank use case reached the record').not.toHaveBeenCalled()
  })

  test('U2 removing also writes the whole list', async () => {
    const onWrite = mount(['a', 'b', 'c'])
    await click('tb-usecase-remove-1')
    expect(onWrite).toHaveBeenCalledWith(['a', 'c'])
  })
})
