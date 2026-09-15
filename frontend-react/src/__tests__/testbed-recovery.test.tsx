// ── L2, L3, L4: THE RESTORED SURFACES ────────────────────────────────────
//
// DERIVED FROM THE VANILLA'S CONTRACT and from the round's rulings, not from
// reading the components back. Each claim below names what the old screen did
// that the new one had stopped doing.
import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QualificationScore, currentEntry, seriesFromPayload } from '../testbed/QualificationScore'
import { SubTabs } from '../testbed/SubTabs'
import { CommercialsCards } from '../testbed/CommercialsCards'
import { CostBreakdownCards } from '../testbed/CostBreakdownCards'
import type { TestBedCostBreakdown } from '../testbed/costBreakdown'

let host: HTMLElement
let root: Root

beforeEach(() => {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => { root.unmount() })
  host.remove()
})

const render = (node: React.ReactNode) => { act(() => { root.render(node) }) }
const q = (id: string) => host.querySelector(`[data-testid="${id}"]`)
const all = (sel: string) => [...host.querySelectorAll(sel)]
const text = (id: string) => q(id)?.textContent ?? ''

// ── L2 ───────────────────────────────────────────────────────────────────

const CRITERIA = [
  { criterion_key: 'commBudget', name: 'Commercial budget' },
  { criterion_key: 'sitePerm', name: 'Site permissions' },
]

describe('L2: the Qualification score card', () => {
  test('reads the RECORD PAYLOAD, which is where scores are stored', () => {
    // Q5. The obvious wiring - the host's `seriesByKey` - is populated ONLY by
    // the response to POST /scores, so on a fresh load it is {} and a card
    // reading it prints `Not scored` against a fully scored record. That is
    // indistinguishable from a correctly empty card, which is why this test
    // exists and why the fixture below is a payload.
    render(<QualificationScore criteria={CRITERIA} payload={{
      commBudget: [{ at: '2026-09-01T00:00:00Z', value: 3, stage: 'Qualification' }],
    }} />)
    expect(text('tb-score-sum-commBudget')).toContain('Commercial budget')
    expect(text('tb-score-sum-commBudget')).toContain('3')
    expect(text('tb-score-sum-commBudget')).toContain('Qualification')
  })

  test('says Not scored for a criterion with no entry, and only for that one', () => {
    render(<QualificationScore criteria={CRITERIA} payload={{
      commBudget: [{ at: '2026-09-01T00:00:00Z', value: 3, stage: 'Qualification' }],
    }} />)
    expect(text('tb-score-sum-sitePerm')).toContain('Not scored')
    expect(text('tb-score-sum-commBudget')).not.toContain('Not scored')
  })

  test('shows the CURRENT score, which is the latest by `at`', () => {
    // Deliberately out of array order: the vanilla sorted by `at` rather than
    // trusting the order, and a payload written by any past version of the app
    // is not guaranteed to be sorted.
    const series = [
      { at: '2026-09-05T00:00:00Z', value: 5, stage: 'Site Assessment' },
      { at: '2026-09-01T00:00:00Z', value: 2, stage: 'Qualification' },
    ]
    expect(currentEntry(series)?.value).toBe(5)
    render(<QualificationScore criteria={CRITERIA} payload={{ commBudget: series }} />)
    expect(text('tb-score-sum-commBudget')).toContain('Site Assessment')
    expect(text('tb-score-sum-commBudget')).not.toContain('Qualification')
  })

  test('carries NO control: the card says where scoring happens instead', () => {
    // Display only, and structural rather than a promise. A control here would
    // be a second writer of a value the stage tabs own.
    render(<QualificationScore criteria={CRITERIA} payload={{}} />)
    expect(all('button, input, select, textarea, a, [tabindex]')).toEqual([])
  })

  test('a criterion with no scores at all reads as an empty series', () => {
    expect(seriesFromPayload({}, 'commBudget')).toEqual([])
    expect(seriesFromPayload(undefined, 'commBudget')).toEqual([])
    // A payload key holding something that is not an array must not throw.
    expect(seriesFromPayload({ commBudget: 'nonsense' }, 'commBudget')).toEqual([])
    expect(currentEntry([])).toBeNull()
  })

  test('says so when nothing is configured, rather than rendering an empty card', () => {
    render(<QualificationScore criteria={[]} payload={{}} />)
    expect(text('tb-score-summary-empty')).toContain('No scoring criteria configured')
  })
})

// ── L3 ───────────────────────────────────────────────────────────────────

const FIELDS = [
  'safesightCameras', 'airQualitySensors', 'hemirSensors',
  'ssUnitCost', 'aqUnitCost', 'hemirUnitCost',
  'ssInstallCost', 'aqInstallCost', 'hemirInstallCost',
  'ssHostingCost', 'aqHostingCost', 'hemirHostingCost',
].map((name) => ({ name, label: name, value: '' }))

// Only what FieldRow reads. A fuller fake would be a fixture shaped to the
// reader rather than to the system (Verification 47).
const rowsStub = {
  fields: FIELDS, dirtyNames: [], dirtyCount: 0, changes: {},
  isOpen: () => false, isDirty: () => false, valueOf: () => '',
  requestOpen: () => false, canEdit: false,
  close: () => {}, setDraft: () => {}, discard: () => {}, discardAll: () => {},
// eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any

describe('L3: the rate cards are three again, and they say their units', () => {
  beforeEach(() => { render(<CommercialsCards rows={rowsStub} fields={FIELDS as never} />) })

  test('renders FOUR cards, not the flattened two', () => {
    expect(all('[data-testid="tb-commercials-cards"] > .pg-card')).toHaveLength(4)
  })

  test('each rate card NAMES ITS UNIT, which the flat card did not', () => {
    // A hosting rate and a hardware rate read identically on the flat card,
    // and one of them is per month.
    expect(text('tb-card-rates-hardware')).toContain('($ / unit)')
    expect(text('tb-card-rates-install')).toContain('($ / unit)')
    expect(text('tb-card-rates-hosting')).toContain('($ / unit / month)')
  })

  test('hosting is the ONLY per-month card', () => {
    // The discriminating half: `toContain('/ month')` on hosting alone would
    // pass on a build that put it on all three.
    const perMonth = ['tb-card-sensors', 'tb-card-rates-hardware',
      'tb-card-rates-install', 'tb-card-rates-hosting']
      .filter((id) => text(id).includes('/ month'))
    expect(perMonth).toEqual(['tb-card-rates-hosting'])
  })

  test('the nine cost rows are split three by three, in their own cards', () => {
    const keys = (id: string) =>
      [...(q(id)?.querySelectorAll('[data-key]') ?? [])].map((e) => e.getAttribute('data-key'))
    expect(keys('tb-card-rates-hardware')).toEqual(['ssUnitCost', 'aqUnitCost', 'hemirUnitCost'])
    expect(keys('tb-card-rates-install')).toEqual(['ssInstallCost', 'aqInstallCost', 'hemirInstallCost'])
    expect(keys('tb-card-rates-hosting')).toEqual(['ssHostingCost', 'aqHostingCost', 'hemirHostingCost'])
    expect(keys('tb-card-sensors')).toEqual(['safesightCameras', 'airQualitySensors', 'hemirSensors'])
  })

  test('the RETIRED testid is gone, and the retained one is not', () => {
    // Verification 41's disposition, asserted rather than described: a name
    // that survives on an arbitrary card is a label claiming a scope it no
    // longer has.
    expect(q('tb-card-commercials')).toBeNull()
    expect(q('tb-card-sensors')).not.toBeNull()
  })

  test('the breakdown is NOT nested in here any more', () => {
    // Q4: it is its own Itemized Cost section, rendered by the host.
    expect(q('tb-cost-breakdown')).toBeNull()
  })
})

// ── L4 ───────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'useCases', label: 'Use cases', content: <p data-testid="pane-uc">UC</p> },
  { key: 'customerDocuments', label: 'Customer documents', content: <p data-testid="pane-cd">CD</p> },
  { key: 'history', label: 'History', content: <p data-testid="pane-h">H</p> },
]

const strip = (active: string, onSelect: (k: string) => void = () => {}) =>
  render(<SubTabs idPrefix="tb-ref-subtabs" label="Reference detail"
    tabs={TABS} active={active} onSelect={onSelect} />)

describe('L4: the Reference sub-tab strip', () => {
  test('renders the three tabs the vanilla had, in order', () => {
    strip('useCases')
    expect(all('[data-testid="tb-ref-subtabs-strip"] button').map((b) => b.textContent))
      .toEqual(['Use cases', 'Customer documents', 'History'])
  })

  test('renders ONLY the open pane, which is what keeps History lazy', () => {
    strip('useCases')
    expect(q('pane-uc')).not.toBeNull()
    expect(q('pane-cd')).toBeNull()
    expect(q('pane-h')).toBeNull()
  })

  test('opening a tab swaps which pane is rendered', () => {
    strip('customerDocuments')
    expect(q('pane-cd')).not.toBeNull()
    expect(q('pane-uc')).toBeNull()
  })

  test('a click reports the key rather than changing anything itself', () => {
    // Controlled: the open pane is held by the HOST, because this component's
    // parent unmounts on every tab switch and would take the state with it.
    const picked: string[] = []
    strip('useCases', (k) => picked.push(k))
    act(() => {
      host.querySelector<HTMLButtonElement>('[data-testid="tb-ref-subtabs-btn-history"]')!.click()
    })
    expect(picked).toEqual(['history'])
    // And it did NOT move on its own.
    expect(q('pane-h')).toBeNull()
  })

  test('the ROVING TABINDEX puts exactly one tab in the page tab sequence', () => {
    // Behaviour the old component had that was not in its props
    // (Verification 7): `createTabStrip` carried this and a replacement loses
    // it silently.
    strip('customerDocuments')
    const btns = all('[data-testid="tb-ref-subtabs-strip"] button') as HTMLButtonElement[]
    expect(btns.map((b) => b.tabIndex)).toEqual([-1, 0, -1])
  })

  test('ARROW KEYS move the selection, wrapping at both ends', () => {
    const picked: string[] = []
    strip('useCases', (k) => picked.push(k))
    const stripEl = q('tb-ref-subtabs-strip')!
    const key = (k: string) => act(() => {
      stripEl.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }))
    })
    key('ArrowRight'); expect(picked.at(-1)).toBe('customerDocuments')
    key('ArrowLeft'); expect(picked.at(-1)).toBe('history')   // wraps backwards
    key('End'); expect(picked.at(-1)).toBe('history')
    key('Home'); expect(picked.at(-1)).toBe('useCases')
  })

  test('carries the estate\'s own tab treatment, not a new one', () => {
    // Verification 7: a replacement control carries the replaced control's
    // class, and `.sub-tabs` / `.detail-tab.sub-tab` are what `createTabStrip`
    // emitted and what style.css still dresses.
    strip('useCases')
    expect(q('tb-ref-subtabs-strip')!.className).toBe('sub-tabs')
    const btns = all('[data-testid="tb-ref-subtabs-strip"] button')
    expect(btns[0].className).toBe('detail-tab sub-tab active')
    expect(btns[1].className).toBe('detail-tab sub-tab')
  })

  test('aria-controls names a pane that EXISTS, for the open tab', () => {
    // Pointing it at nothing is worse than omitting it: a screen reader
    // announces a relationship that does not resolve.
    strip('history')
    const open = host.querySelector('[data-testid="tb-ref-subtabs-btn-history"]')!
    const paneId = open.getAttribute('aria-controls')!
    expect(host.querySelector(`#${paneId}`)).not.toBeNull()
    expect(open.getAttribute('aria-selected')).toBe('true')
  })

  test('an active key that is not in the list falls back to the first pane', () => {
    // Otherwise a pane is "open" with nothing rendered.
    strip('nosuchpane')
    expect(q('pane-uc')).not.toBeNull()
  })
})

// ── L1's RENDER, as opposed to its rows ──────────────────────────────────

const MIN: TestBedCostBreakdown = {
  hardware: { totalUnits: 1, hardwareCost: 10, warrantyUnits: 0, warrantyCost: 0, avgHwCost: 10 },
  groups: {
    hardwareGroup: { rows: [{ key: 'hwSs', rawCost: 10, rawPrice: 99 }], rawTotalCost: 10, rawTotalPrice: 99 },
    installGroup: { rows: [{ key: 'inSs', rawCost: 2, rawPrice: 98 }], rawTotalCost: 2, rawTotalPrice: 98 },
    hostingGroup: { rows: [{ key: 'hoSs', rawCost: 1, rawPrice: 97 }], rawTotalCost: 1, rawTotalPrice: 97 },
  },
  hostingMonthCost: 1, hostingTermCost: 12, months: 12, totalCost: 24,
}

describe('L1: the Itemized Cost render', () => {
  test('the unsaved marker rides in the SUMMARY CARD\'S OWN TITLE', () => {
    // Not in the save bar. A total a person cannot tell apart from a saved one
    // makes the save bar advisory: they read the number, believe it is
    // recorded, and move on.
    render(<CostBreakdownCards breakdown={MIN} input={() => '1'} unsaved />)
    const title = q('tb-cost-card-summary')!.querySelector('.pg-card-title')!
    expect(title.querySelector('[data-testid="tb-cost-preview-marker"]')).not.toBeNull()
  })

  test('a SAVED breakdown carries no marker at all', () => {
    // The other half. A marker that is always on says nothing.
    render(<CostBreakdownCards breakdown={MIN} input={() => '1'} unsaved={false} />)
    expect(q('tb-cost-preview-marker')).toBeNull()
    expect(q('tb-cost-card-summary')!.className).toBe('pg-card')
  })

  test('Total Cost renders ABOVE the three category rows', () => {
    // A relationship between elements, not a CSS property (Verification 4).
    render(<CostBreakdownCards breakdown={MIN} input={() => '1'} unsaved={false} />)
    const rows = [...q('tb-cost-card-summary')!.querySelectorAll('[data-row-label]')]
      .map((r) => r.getAttribute('data-row-label'))
    expect(rows[0]).toBe('Total Cost')
    expect(rows.indexOf('Total Cost')).toBeLessThan(rows.indexOf('Hardware'))
  })

  test('the total is NOT dressed in the dimmed itemized treatment', () => {
    // The exact defect Round 15 Phase 4 shipped and Verification 4 records:
    // every check passed on a Cost summary card whose totals were the least
    // prominent figures on the tab.
    render(<CostBreakdownCards breakdown={MIN} input={() => '1'} unsaved={false} />)
    const total = q('tb-cost-row-total')!
    expect(total.className).toContain('tb-cost-summary-total')
    expect(total.querySelector('.data-row-label')).toBeNull()
  })
})
