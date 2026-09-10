// The header strip's rules, tested without a browser.
import { describe, it, expect } from 'vitest'
import { headerStats, isOverdue, hardwareCounts } from '../testbed/headerStats'

describe('the contracted end date is overdue when today is past it', () => {
  it('is overdue when today is later', () => {
    expect(isOverdue('2026-01-01', '2026-09-10')).toBe(true)
  })
  it('is not overdue on the day itself', () => {
    // The boundary is deliberate: a Test Bed is not late until the day AFTER
    // its contracted end.
    expect(isOverdue('2026-09-10', '2026-09-10')).toBe(false)
  })
  it('is not overdue when the date is in the future', () => {
    expect(isOverdue('2027-03-10', '2026-09-10')).toBe(false)
  })
  it('is not overdue when there is no date at all', () => {
    // A bed that has not gone live has no contracted end. Absence must not
    // read as overdue, which is what a naive string compare would do.
    expect(isOverdue(undefined, '2026-09-10')).toBe(false)
    expect(isOverdue('', '2026-09-10')).toBe(false)
    expect(isOverdue(null, '2026-09-10')).toBe(false)
  })
})

describe('R12: HEMIR is suppressed unless it carries data', () => {
  it('shows SafeSight and Air Quality and omits HEMIR when it is absent', () => {
    const h = hardwareCounts({ safesightCameras: 3, airQualitySensors: 2 })
    expect(h.map((x) => x.type)).toEqual(['SafeSight', 'Air Quality'])
  })
  it('shows HEMIR once it carries a value, including zero', () => {
    // Zero is DATA once somebody has entered it. The suppression is about a
    // field nobody uses, not about the number being small.
    const h = hardwareCounts({ safesightCameras: 3, airQualitySensors: 2, hemirSensors: 0 })
    expect(h.map((x) => x.type)).toEqual(['SafeSight', 'Air Quality', 'HEMIR'])
  })
  it('still shows SafeSight and Air Quality as 0 when they are absent', () => {
    // Only HEMIR is suppressed. The other two are the ordinary case and keep
    // the cell's shape across records.
    expect(hardwareCounts({}).map((x) => `${x.type}:${x.count}`))
      .toEqual(['SafeSight:0', 'Air Quality:0'])
  })
})

describe('the five cells', () => {
  it('reads accumulated_cost, which is what the carry-forward passes', () => {
    const { cells } = headerStats({ accumulated_cost: 164000 }, '2026-09-10')
    expect(cells[0]).toEqual({ label: 'Total cost', value: '$164,000' })
  })
  it('says -- rather than 0 for a cost nobody has entered', () => {
    const { cells } = headerStats({}, '2026-09-10')
    expect(cells[0].value).toBe('--')
  })
  it('marks the end cell overdue and no other', () => {
    const { cells } = headerStats({ estGoLiveDate: '2026-01-01' }, '2026-09-10')
    expect(cells.find((c) => c.label === 'Contracted end')?.overdue).toBe(true)
    expect(cells.filter((c) => c.overdue).length).toBe(1)
  })
  it('keeps the five cells in the order of record', () => {
    const { cells } = headerStats({}, '2026-09-10')
    expect(cells.map((c) => c.label))
      .toEqual(['Total cost', 'Duration', 'Hardware', 'Est. start', 'Contracted end'])
  })
})

// ── THE RENDERED HEADER ───────────────────────────────────────────────────
//
// createRoot and act, the estate's own pattern - @testing-library is not a
// dependency here and adding one for four assertions is not worth it.
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { ViewHeader } from '../testbed/ViewHeader'

const bed = (payload: Record<string, unknown>, status = 'Monitoring and Analysis') =>
  ({ status, payload: { name: 'Marina Bay', client_organisation: 'Willowglen', ...payload } })

function mount(node: React.ReactElement): { host: HTMLElement, root: Root } {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  act(() => { root.render(node) })
  return { host, root }
}
const q = (host: HTMLElement, id: string) => host.querySelector(`[data-testid="${id}"]`)

describe('the Test Bed header renders the design of record', () => {
  it('puts the summary beside the title, inside one row', () => {
    const { host, root } = mount(<ViewHeader record={bed({ summary: 'Camera trial at the pier' })} readOnly={false} />)
    expect(q(host, 'tb-detail-name')?.textContent).toBe('Marina Bay')
    expect(q(host, 'tb-header-summary')?.textContent).toBe('Camera trial at the pier')
    expect(q(host, 'tb-header-row')?.contains(q(host, 'tb-header-summary') as Node)).toBe(true)
    act(() => root.unmount())
  })

  it('keeps the summary element when there is no summary', () => {
    // The title must not move when one record has a summary and the next does
    // not, which is the same reason the client line keeps its element.
    const { host, root } = mount(<ViewHeader record={bed({})} readOnly={false} />)
    expect(q(host, 'tb-header-summary')?.textContent).toBe('')
    act(() => root.unmount())
  })

  it('orders title, strip and chevron top to bottom', () => {
    const { host, root } = mount(<ViewHeader record={bed({})} readOnly={false} />)
    const wanted = ['tb-header-row', 'tb-header-stats', 'tb-chevron-strip']
    const order = [...host.querySelectorAll('[data-testid]')]
      .map((e) => e.getAttribute('data-testid'))
      .filter((t) => wanted.includes(t as string))
    expect(order).toEqual(wanted)
    act(() => root.unmount())
  })

  it('marks the contracted end red when today is past it, and nothing else', () => {
    const { host, root } = mount(<ViewHeader record={bed({ estGoLiveDate: '2020-01-01' })} readOnly={false} />)
    const end = q(host, 'tb-stat-contracted-end')
    expect(end?.className).toContain('stat-value--overdue')
    expect(end?.getAttribute('data-overdue')).toBe('true')
    expect(host.querySelectorAll('[data-overdue="true"]').length).toBe(1)
    act(() => root.unmount())
  })

  it('does not mark a future end date', () => {
    const { host, root } = mount(<ViewHeader record={bed({ estGoLiveDate: '2099-01-01' })} readOnly={false} />)
    expect(q(host, 'tb-stat-contracted-end')?.className).not.toContain('overdue')
    act(() => root.unmount())
  })

  it('shows two hardware names when HEMIR is absent and three when present', () => {
    const { host, root } = mount(
      <ViewHeader record={bed({ safesightCameras: 3, airQualitySensors: 2 })} readOnly={false} />)
    expect(q(host, 'tb-hardware')?.textContent).toBe('SafeSight3Air Quality2')
    act(() => { root.render(
      <ViewHeader record={bed({ safesightCameras: 3, airQualitySensors: 2, hemirSensors: 4 })} readOnly={false} />) })
    expect(q(host, 'tb-hardware')?.textContent).toContain('HEMIR4')
    act(() => root.unmount())
  })
})
