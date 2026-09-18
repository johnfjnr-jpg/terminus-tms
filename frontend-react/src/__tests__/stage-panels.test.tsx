// ── STAGE PANELS: the pilot's contract ──────────────────────────────────
//
// R1 order and the relocated approvals, R2 the grid, R3 documents only where
// required, R4 scoring where a score already exists. Through the REAL host, on
// the routes' own answers, with the panels read from the rendered tree.
//
// Layout is asserted as STRUCTURE here (which element is inside the grid, which
// spans the row); the WIDTHS are measured live at 1440 and 1240 by
// scripts/stage-panels/probe-pilot.mjs, because jsdom has no layout.
import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { TestBedHost } from '../testbed/TestBedHost'
import { ShellProvider } from '../ShellContext'
import { shellServices } from './fixtures'
import type { ShellServices } from '../shell-services'
import UNITS from './fixtures/units-live.json'
import SCORING from './fixtures/scoring-live.json'
import EXIT from './fixtures/exit-criteria-live.json'

const BASE = UNITS.bedWithCounts as unknown as { id: string, owner_id: string, payload: Record<string, unknown> }
const PRE = 'Pre-Site Assessment'
const QUAL = 'Qualification'

let host: HTMLElement
let root: Root
beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host) })
afterEach(() => { act(() => root.unmount()); host.remove() })
const settle = async () => { for (let i = 0; i < 6; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)) }) }
const $ = (id: string) => host.querySelector(`[data-testid="${id}"]`) as HTMLElement | null
const click = async (id: string) => { await act(async () => { $(id)!.click() }); await settle() }

/** A record whose Qualification scores are already recorded, as the route returns them. */
const scoredPayload = () => ({
  ...BASE.payload,
  commercialAuthority: 'Josh Ward', technicalAuthority: 'Matous Kundrik', terminusLegalOwner: '',
  scoreRolloutPath: [{ at: '2026-09-01T00:00:00.000Z', by: 'someone@terminustechnologies.io', value: 4, stage: QUAL }],
  scoreDataRights: [{ at: '2026-09-01T00:00:00.000Z', by: 'someone@terminustechnologies.io', value: 3, stage: QUAL }],
})

const mount = async ({ scored = true }: { scored?: boolean } = {}) => {
  const bed = { ...BASE, payload: scored ? scoredPayload() : BASE.payload }
  const calls: string[] = []
  const api = (async (method: string, path: string) => {
    calls.push(`${method} ${path}`)
    if (path === `/api/test-beds/${BASE.id}/units`) return { ok: true, status: 200, data: [] }
    if (path === `/api/test-beds/${BASE.id}`) return { ok: true, status: 200, data: bed }
    if (path.startsWith('/api/stage-definitions')) return { ok: true, status: 200, data: SCORING.stageDefinitions }
    if (path.startsWith('/api/scoring-criteria')) return { ok: true, status: 200, data: SCORING.criteria }
    if (path.includes('/exit-criteria')) {
      return { ok: true, status: 200, data: path.includes(encodeURIComponent(QUAL)) ? EXIT.cases.qualificationFresh : EXIT.cases.installation }
    }
    if (path.includes('/document-requirements')) {
      // The route's own shapes: Pre-Site has one, Qualification has none.
      return { ok: true, status: 200, data: path.includes(encodeURIComponent(QUAL))
        ? { reference_docs: [], completable_documents: [] }
        : { reference_docs: [{ document_name: 'NDA' }],
            completable_documents: [{ document: 'NDA', required_status: 'approved', current_status: null, document_record_id: null, document_location: null }] } }
    }
    if (path.endsWith('/stage-approvals')) return { ok: true, status: 200, data: [] }
    if (path.endsWith('/history')) return { ok: true, status: 200, data: { entries: [] } }
    return { ok: true, status: 200, data: [] }
  }) as ShellServices['api']
  act(() => { root.render(<ShellProvider services={shellServices({ currentUserId: () => bed.owner_id, api })}><TestBedHost bed={bed as never} /></ShellProvider>) })
  await settle()
  return calls
}
const openStage = async (stage: string) => { await click(`tb-tab-btn-stage-${stage}`) }

describe('R2: the panels sit in the estate\'s column grid, scoring across the row', () => {
  test('a grid row holds the panels, and every one of them is inside it', async () => {
    await mount()
    await openStage(PRE)
    const row = $('tb-stage-panels-row')
    expect(row, 'the panels are still a full-width stack with no grid row').not.toBeNull()
    for (const id of ['tb-stage-scoring-card', 'tb-stage-documents-section', 'tb-stage-exit-criteria-list']) {
      const el = $(id)
      if (el) expect(row!.contains(el), `${id} is outside the panel row`).toBe(true)
    }
  })

  test('R1: the order is scoring, documents, exit criteria', async () => {
    await mount()
    await openStage(PRE)
    const row = $('tb-stage-panels-row')!
    const order = [...row.querySelectorAll('[data-testid]')]
      .map((e) => e.getAttribute('data-testid'))
      .filter((t) => ['tb-stage-scoring-card', 'tb-stage-documents-section', 'tb-stage-exit-criteria-list'].includes(t!))
    expect(order).toEqual(['tb-stage-scoring-card', 'tb-stage-documents-section', 'tb-stage-exit-criteria-list'])
  })
})

describe('R1: approvals move inside the exit criteria panel', () => {
  test('the approvals are INSIDE the criteria panel, and are not a panel of the row', async () => {
    await mount()
    await openStage(PRE)
    const criteria = $('tb-stage-exit-criteria-list')!
    expect(criteria.querySelector('[data-testid="tb-stage-approvals-section"]'),
      'the approvals section is not inside the exit criteria panel').not.toBeNull()
    // The track list keeps its own panel id, which is what makes it the same
    // list with the same controls. R1's claim is about WHERE it sits.
    const list = $('tb-stage-approval-row')
    expect(list && criteria.contains(list), 'the track list is still outside the criteria panel').toBe(true)
    const row = $('tb-stage-panels-row')!
    expect([...row.children].some((c) => c.getAttribute('data-testid') === 'tb-stage-approval-row'),
      'approvals is still a panel of the row').toBe(false)
  })

  test('each track names its configured approver, or says none is named', async () => {
    await mount()
    await openStage(PRE)
    const section = $('tb-stage-approvals-section')!
    expect(section.textContent).toContain('Josh Ward')       // commercialAuthority
    expect(section.textContent).toContain('Matous Kundrik')  // technicalAuthority
    expect($('tb-stage-approver-Legal')?.textContent, 'an empty approver field is not said')
      .toMatch(/no approver named/i)
  })
})

describe('R3: the documents panel renders only where the stage has documents', () => {
  test('Pre-Site Assessment has one, so the panel renders', async () => {
    await mount()
    await openStage(PRE)
    expect($('tb-stage-documents-section')).not.toBeNull()
  })

  test('Qualification has none, so the panel does not render at all', async () => {
    await mount()
    await openStage(QUAL)
    expect($('tb-stage-documents-section'),
      'Qualification still renders a documents panel, placeholder and all').toBeNull()
  })
})

describe('R4: scoring follows the gate, then the scores already recorded', () => {
  test('a stage the gate asks nothing of still offers the criteria already scored', async () => {
    await mount({ scored: true })
    await openStage(PRE)
    const card = $('tb-stage-scoring-card')
    expect(card, 'the card is absent on a stage with scored criteria').not.toBeNull()
    expect(card!.hidden, 'the card is hidden on a stage with scored criteria').toBe(false)
    expect($('tb-score-select-scoreRolloutPath'), 'the scored criterion is not offered for re-scoring').not.toBeNull()
    expect($('tb-score-select-scoreClientCommitment'), 'an UNSCORED criterion was offered on a stage the gate asks nothing of').toBeNull()
  })

  test('with nothing scored and no measurability, the card does not render', async () => {
    await mount({ scored: false })
    await openStage(PRE)
    const card = $('tb-stage-scoring-card')
    expect(card === null || card.hidden, 'an empty scoring card renders on a stage with nothing to show').toBe(true)
  })
})
