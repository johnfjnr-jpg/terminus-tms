// ── WHAT BLOCKS THE WALK: the rendered half ─────────────────────────────
//
// Round 7 Phase 2d session 1. Driven through ONE ROOT RE-RENDERED.
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { DocumentsPanel } from '../testbed/DocumentsPanel'
import { ClosedRecordPanel } from '../testbed/ClosedRecordPanel'
import { StageTrackList } from '../shared/StageTrackList'

let host: HTMLElement
let root: Root
const q = (id: string) => host.querySelector(`[data-testid="${id}"]`)
const click = async (id: string) => {
  await act(async () => { (q(id) as HTMLElement).click(); await Promise.resolve() })
}

beforeEach(() => {
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

const DOCS = {
  reference_docs: [{ document_name: 'Site survey' }, { document_name: 'Catalogue only' }],
  completable_documents: [
    { document: 'Site survey', current_status: 'approved', document_location: 'http://a' },
    { document: 'Gated but unlisted', current_status: null, document_location: null },
  ],
}

describe('M: the documents panel, rendered', () => {
  const docs = (over: Partial<Parameters<typeof DocumentsPanel>[0]> = {}) => {
    const props = { data: DOCS, onConfirm: vi.fn(), onSaveUrl: vi.fn(), ...over }
    act(() => { root.render(<DocumentsPanel {...props} />) })
    return props
  }

  test('M2 all three names render, so a misalignment is VISIBLE', () => {
    docs()
    expect(q('tb-doc-Site-survey')).toBeTruthy()
    expect(q('tb-doc-Catalogue-only')).toBeTruthy()
    expect(q('tb-doc-Gated-but-unlisted'),
      'a gated document absent from the catalogue vanished from the panel').toBeTruthy()
  })

  test('M4 the catalogue-only row says Not gated and offers no Confirm', () => {
    docs()
    expect(q('tb-doc-nogate-Catalogue-only')?.textContent).toBe('Not gated')
    expect(q('tb-doc-confirm-Catalogue-only')).toBeNull()
  })

  test('M5 the approved row offers neither, and does NOT say Not gated', () => {
    docs()
    expect(q('tb-doc-confirm-Site-survey')).toBeNull()
    expect(q('tb-doc-nogate-Site-survey'),
      'approved and not-gated were collapsed into one label').toBeNull()
    expect(q('tb-doc-status-Site-survey')?.textContent).toBe('Approved')
  })

  test('M5 the gated unapproved row DOES offer Confirm, by name', async () => {
    const p = docs()
    await click('tb-doc-confirm-Gated-but-unlisted')
    expect(p.onConfirm).toHaveBeenCalledWith('Gated but unlisted')
  })

  test('M7 the URL box is prefilled, and saves only when it CHANGES', async () => {
    const p = docs()
    const box = q('tb-doc-url-Site-survey') as HTMLInputElement
    expect(box.value).toBe('http://a')
    // React maps onBlur to the FOCUSOUT event, not to `blur`, which does not
    // bubble. A `blur` dispatch reaches nothing and reads as a broken handler.
    const blur = () => box.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    await act(async () => { blur() })
    expect(p.onSaveUrl, 'an unchanged URL was saved on every blur').not.toHaveBeenCalled()
    await act(async () => { box.value = 'http://b'; blur() })
    expect(p.onSaveUrl).toHaveBeenCalledWith('Site survey', 'http://b')
  })

  test('M8 an empty configuration says so', () => {
    docs({ data: { reference_docs: [], completable_documents: [] } })
    expect(q('tb-docs-empty')?.textContent).toMatch(/No documents configured/)
  })
})

describe('A: the shared track list, rendered', () => {
  const ST = {
    stage_name: 'Qualification', state: 'current',
    tracks: [
      { track: 'Technical', approved: false, scope: 'stage' },
      { track: 'Commercial', approved: true, scope: 'stage', decided_at: '2026-01-01' },
    ],
  }
  const list = (over: Partial<Parameters<typeof StageTrackList>[0]> = {}) => {
    const props = {
      stage: ST, recordType: 'test_bed', superseded: false,
      onApprove: vi.fn(), testId: 'tracks', ...over,
    }
    act(() => { root.render(<StageTrackList {...props} />) })
    return props
  }

  test('A5 only the clickable row responds', async () => {
    const p = list()
    await click('tracks-Technical')
    expect(p.onApprove).toHaveBeenCalledWith('Technical')
    await click('tracks-Commercial')
    expect(p.onApprove, 'an approved row was clickable').toHaveBeenCalledTimes(1)
  })

  test('A5 a workflow record type offers no click at all', async () => {
    const p = list({ superseded: true })
    await click('tracks-Technical')
    expect(p.onApprove, 'the superseded control was live on a workflow record')
      .not.toHaveBeenCalled()
    expect(q('tracks-Technical')?.className).not.toContain('clickable')
  })

  test('A2 and A3 render DIFFERENT sentences', () => {
    list({ stage: undefined })
    expect(q('tracks-unknown')?.textContent).toBe('Unknown stage.')
    list({ stage: { ...ST, tracks: [] } })
    expect(q('tracks-empty')?.textContent).toBe('No approvals required for this stage.')
  })

  test('A6 a version-scoped row names the version and is not clickable', async () => {
    const p = list({ stage: { ...ST, tracks: [
      { track: 'Commercial', approved: true, scope: 'version', version_label: 'v3.0', decided_at: '2026-02-02' }] } })
    expect(q('tracks-Commercial')?.textContent).toContain('v3.0')
    expect(q('tracks-Commercial')?.textContent).toContain('Proposal/Pricing approved for issue')
    await click('tracks-Commercial')
    expect(p.onApprove, 'a version-scoped row sent somebody to the wrong route')
      .not.toHaveBeenCalled()
  })
})

describe('Z: the closed panel, rendered', () => {
  const DATA = {
    total: 4, produced: 3,
    groups: [
      { stage: 'Qualification', documents: [
        { document: 'Site survey', produced: true, status: 'approved', document_location: 'http://a' },
        { document: 'Never made', produced: false, status: null, document_location: null }] },
      { stage: 'Empty stage', documents: [] },
    ],
  }
  const closed = (over: Partial<Parameters<typeof ClosedRecordPanel>[0]> = {}) =>
    act(() => { root.render(<ClosedRecordPanel data={DATA} {...over} />) })

  test('Z2 NO row carries a confirm control or an editable input', () => {
    closed()
    expect(host.querySelectorAll('input'),
      'the closed record grew an editable field').toHaveLength(0)
    expect(host.querySelectorAll('button'),
      'the closed record grew a control').toHaveLength(0)
  })

  test('Z3 an empty stage group is OMITTED', () => {
    closed()
    expect(q('tb-closed-group-Qualification')).toBeTruthy()
    expect(q('tb-closed-group-Empty stage'),
      'a stage that produced nothing was rendered empty').toBeNull()
  })

  test('Z4 the shortfall is STATED', () => {
    closed()
    expect(q('tb-closed-sub')?.textContent)
      .toBe('3 of 4 documents produced. 1 were never recorded.')
  })

  test('Z5 an unproduced document says so and shows no URL line', () => {
    closed()
    const row = q('tb-closed-doc-Never made')
    expect(row?.textContent).toContain('Not produced')
    expect(row?.querySelector('.tb-closed-doc-url')?.textContent,
      'an unproduced document rendered a blank URL that reads as a missing one').toBe('')
  })

  test('Z6 a failed load says so and shows no groups', () => {
    closed({ data: null, failed: true })
    expect(q('tb-closed-groups')?.textContent).toMatch(/Could not load the lifecycle/)
    expect(q('tb-closed-sub'), 'a failed load still stated a count').toBeNull()
  })

  test('Z6 loading is a state of its own, not an empty record', () => {
    closed({ data: null, loading: true })
    expect(q('tb-closed-groups')?.getAttribute('data-pending')).toBe('true')
    expect(q('tb-closed-groups')?.textContent).toMatch(/Loading the completed record/)
  })

  test('re-navigation: a second record replaces the first record\'s groups', () => {
    closed()
    expect(q('tb-closed-group-Qualification')).toBeTruthy()
    closed({ data: { total: 0, produced: 0, groups: [] } })
    expect(q('tb-closed-group-Qualification'),
      'the second record showed the first record\'s lifecycle').toBeNull()
    expect(q('tb-closed-groups')?.textContent).toMatch(/No documents are configured/)
  })
})
