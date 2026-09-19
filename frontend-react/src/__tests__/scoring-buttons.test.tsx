// ── V9: THE SCORE CONTROL IS FIVE BUTTONS, WITH THE ANCHOR AT THE POINT OF USE
//
// Derived from John's rulings R1 to R6 in SCORING_SELECTOR_BRIEF.md, not from
// the component. The select these replace is the failing claim.
//
//   R1  five inline buttons 1..5; hover or focus shows THAT number's anchor;
//       clicking or Enter commits; 2 and 4 are bare numbers with no invented
//       text and their anchor area stays empty
//   R2  the anchor renders through the SHARED popup (option B), so the card is
//       a CALLER: it must go through the seam rather than draw its own region
//   R3  arrows move across the numbers with the anchor following; Enter
//       commits; Escape reverts per A3; tab order unbroken
//   R4  Show definitions is gone from the criterion row
//   R5  the measurability control is untouched - and Phase 0 measured it
//       sharing the `tb-score-select` class, so nothing here may catch it
//   R6  the popup dismisses on commit
import { describe, test, expect, beforeEach, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { ShellProvider } from '../ShellContext'
import { shellServices } from './fixtures'
import { ScoringCard } from '../testbed/StagePanel'
import type { Criterion } from '../testbed/scoring'

const CRITERIA = [{
  criterion_key: 'scoreRolloutPath',
  name: 'Rollout Path',
  asks: 'Does a suitable rollout path exist',
  current_version: 1,
  // Anchors at 1, 3 and 5 only - which is the real shape: Phase 0 measured
  // ZERO anchor rows at scores 2 and 4 across every test_bed criterion.
  anchors: { 1: { 1: 'No path exists.', 3: 'A path is plausible.', 5: 'A path is agreed and funded.' } },
  levels: [{ value: 1 }, { value: 2 }, { value: 3 }, { value: 4 }, { value: 5 }],
  stages: [{ stage: 'Qualification' }],
}] as unknown as Criterion[]

let root: Root
let host: HTMLElement
const shown: { key: string, wording: string, label?: string | null }[] = []
const dismissed: string[] = []
const drafts: { key: string, value: string }[] = []

const services = shellServices({
  showAnchor: (o) => { shown.push({ key: o.key, wording: o.wording, label: o.label }) },
  dismissAnchor: (k) => { dismissed.push(k) },
})

function mount(scores = { drafts: {}, reasons: {} }) {
  act(() => {
    root.render(
      <ShellProvider services={services}>
        <ScoringCard
          card={{ hidden: false, stage: 'Qualification' }}
          criteria={CRITERIA}
          series={() => []}
          scores={scores as never}
          onDraft={(key, value) => { drafts.push({ key, value }) }}
          onReason={() => {}}
          onRecord={async () => null}
          measurability={undefined as never}
          onMeasurability={async () => null} />
      </ShellProvider>)
  })
}

const $ = (id: string) => host.querySelector(`[data-testid="${id}"]`) as HTMLElement | null
const must = (id: string) => { const e = $(id); if (!e) throw new Error(`no ${id}`); return e }
const btn = (n: number) => must(`tb-score-btn-scoreRolloutPath-${n}`)
const press = (el: HTMLElement, key: string) =>
  act(() => { el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })) })

beforeEach(() => {
  shown.length = 0; dismissed.length = 0; drafts.length = 0
  window.canEditFields = () => true
  document.body.innerHTML = '<div id="host"></div>'
  host = document.getElementById('host')!
  root = createRoot(host)
})

describe('R1: five buttons replace the select', () => {
  test('the select is GONE from the criterion row', () => {
    mount()
    expect($('tb-score-select-scoreRolloutPath')).toBe(null)
  })

  test('five buttons render, numbered 1 to 5', () => {
    mount()
    for (let n = 1; n <= 5; n++) expect(btn(n).textContent?.trim()).toBe(String(n))
  })

  // THE NEGATIVE R1 NAMES. 2 and 4 have no anchor in the data, and the ruling
  // is that they render as BARE NUMBERS with nothing invented for them.
  test('2 and 4 are bare numbers, and asking for their anchor shows nothing', () => {
    mount()
    for (const n of [2, 4]) {
      act(() => { btn(n).dispatchEvent(new MouseEvent('mouseover', { bubbles: true })) })
    }
    expect(shown, 'an anchor was invented for a level that has none').toEqual([])
  })

  test('hovering a number shows THAT number\'s anchor through the shared popup', () => {
    mount()
    act(() => { btn(3).dispatchEvent(new MouseEvent('mouseover', { bubbles: true })) })
    expect(shown).toHaveLength(1)
    expect(shown[0].wording).toBe('A path is plausible.')
    expect(shown[0].key).toBe('scoreRolloutPath')
  })

  test('clicking a number commits it as the draft', () => {
    mount()
    act(() => { btn(4).dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    expect(drafts).toEqual([{ key: 'scoreRolloutPath', value: '4' }])
  })
})

describe('R2: the card is a CALLER of the shared popup', () => {
  // It must not draw its own region. The seam is the only route, so a card that
  // rendered its own anchor text would show nothing through this.
  test('the anchor goes through the SEAM, not a region the card drew', () => {
    mount()
    act(() => { btn(5).dispatchEvent(new MouseEvent('mouseover', { bubbles: true })) })
    expect(shown[0]?.wording).toBe('A path is agreed and funded.')
  })

  test('and the card renders a box the shared module can position', () => {
    mount()
    expect(must('tb-score-anchor-scoreRolloutPath').className).toContain('anchor-defn')
  })
})

describe('R3: keyboard per the R-K standard', () => {
  test('ArrowRight moves across the numbers with the anchor FOLLOWING', () => {
    mount()
    act(() => { btn(1).focus() })
    shown.length = 0
    press(btn(1), 'ArrowRight')
    expect(document.activeElement).toBe(btn(2))
    press(btn(2), 'ArrowRight')
    expect(document.activeElement).toBe(btn(3))
    // The anchor followed: 3 has wording, so the last show is 3's.
    expect(shown[shown.length - 1]?.wording).toBe('A path is plausible.')
  })

  test('ArrowLeft moves back', () => {
    mount()
    act(() => { btn(3).focus() })
    press(btn(3), 'ArrowLeft')
    expect(document.activeElement).toBe(btn(2))
  })

  // ── ENTER IS LEFT TO THE BUTTON, AND THAT IS WHAT THIS ASSERTS ────────
  //
  // R3 says Enter commits, and on a <button> the browser does that itself by
  // firing a click. Handling Enter here as well would commit TWICE in a real
  // browser - once from the keydown and once from the activation it did not
  // suppress.
  //
  // So the unit claim is the honest one: the handler does NOT swallow Enter,
  // leaving native activation to do its job. That Enter actually commits is
  // proven where a real browser is pressing it, in the live probe - jsdom does
  // not activate a button on a synthetic keydown, so asserting the commit here
  // would be asserting the harness rather than the product.
  test('Enter is NOT swallowed, so the button\'s own activation commits', () => {
    mount()
    act(() => { btn(2).focus() })
    const e = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    act(() => { btn(2).dispatchEvent(e) })
    expect(e.defaultPrevented, 'Enter was swallowed, so the button can never activate').toBe(false)
    expect(drafts, 'the handler committed as well, which double-commits in a browser').toEqual([])
  })

  test('Escape reverts per A3, which is dropping the draft', () => {
    mount({ drafts: { scoreRolloutPath: '3' }, reasons: {} })
    press(btn(3), 'Escape')
    expect(drafts).toEqual([{ key: 'scoreRolloutPath', value: '' }])
  })

  // TAB ORDER UNBROKEN: a roving tabindex, so the group is ONE tab stop rather
  // than five, and arrowing inside it is how the numbers are reached.
  test('the group is one tab stop, not five', () => {
    mount()
    const stops = [1, 2, 3, 4, 5].map((n) => btn(n).tabIndex)
    expect(stops.filter((t) => t === 0)).toHaveLength(1)
    expect(stops.filter((t) => t === -1)).toHaveLength(4)
  })
})

describe('R6: committing dismisses the popup', () => {
  test('clicking a number dismisses through the seam', () => {
    mount()
    act(() => { btn(3).dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    expect(dismissed).toContain('scoreRolloutPath')
  })
})

describe('R4 and R5: what goes and what must not be touched', () => {
  test('R4: Show definitions is gone from the criterion row', () => {
    mount()
    expect($('tb-anchors-toggle-scoreRolloutPath')).toBe(null)
  })

  // R5, and Phase 0 measured why this needs saying: the MEASURABILITY control
  // wears the same `tb-score-select` class as the score select did, so a sweep
  // that removed "the select" by class would have taken it too.
  test('R5: the measurability select is untouched', () => {
    act(() => {
      root.render(
        <ShellProvider services={services}>
          <ScoringCard
            card={{ hidden: false, stage: 'Qualification' }}
            criteria={CRITERIA}
            series={() => []}
            scores={{ drafts: {}, reasons: {} } as never}
            onDraft={() => {}} onReason={() => {}} onRecord={async () => null}
            measurability={{ key: 'measurable', label: 'Can the sensors capture it?', value: '', levels: [{ value: 1, label: 'Yes' }] } as never}
            onMeasurability={async () => null} />
        </ShellProvider>)
    })
    const sel = host.querySelector('select.tb-score-select')
    expect(sel, 'the measurability select was caught by the score-select removal').not.toBe(null)
  })
})
