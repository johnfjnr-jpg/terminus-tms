// ── WHAT BLOCKS THE WALK: the model half ────────────────────────────────
//
// Round 7 Phase 2d session 1, from the M/A/Z/X enumeration.
import { describe, test, expect } from 'vitest'
import {
  documentRows, docKey, DOCUMENTS_ROUTE, type DocRequirements,
} from '../testbed/documents'
import { stageTracks, trackRow, TRACK_EMPTY, UNKNOWN_STAGE } from '../shared/stageTracks'
import { closedGroups, closedSubtitle, LIFECYCLE_ROUTE } from '../testbed/closedPanel'
import { nextStageFor } from '../testbed/tabModel'

describe('M: the documents panel', () => {
  const DATA: DocRequirements = {
    reference_docs: [{ document_name: 'Site survey' }, { document_name: 'Catalogue only' }],
    completable_documents: [
      { document: 'Site survey', current_status: 'approved', document_location: 'http://a' },
      { document: 'Gated but unlisted', current_status: null, document_location: null },
    ],
  }

  test('M2 the two keys are UNIONED, so a mismatch is visible rather than lost', () => {
    const names = documentRows(DATA).map((r) => r.name)
    expect(names, 'the panel intersected, so a misaligned document vanished')
      .toEqual(['Site survey', 'Catalogue only', 'Gated but unlisted'])
  })

  test('M1 the CATALOGUE decides the order, and gated-only names follow', () => {
    expect(documentRows(DATA)[0].name).toBe('Site survey')
    expect(documentRows(DATA).at(-1)?.name).toBe('Gated but unlisted')
  })

  test('M3 three statuses, from current_status', () => {
    const rows = documentRows(DATA)
    expect(rows[0].statusLabel).toBe('Approved')
    expect(rows[1].statusLabel).toBe('Not started')
    expect(rows[2].statusLabel).toBe('Not started')
    expect(documentRows({
      reference_docs: [{ document_name: 'X' }],
      completable_documents: [{ document: 'X', current_status: 'started' }],
    })[0].statusLabel).toBe('Started')
  })

  test('M4 a document with NO GATE RULE is catalogue-only and gets no Confirm', () => {
    const row = documentRows(DATA).find((r) => r.name === 'Catalogue only')!
    expect(row.confirm, 'a catalogue-only document offered a Confirm').toBe('not-gated')
  })

  test('M5 an APPROVED document gets no Confirm either, for a different reason', () => {
    const row = documentRows(DATA).find((r) => r.name === 'Site survey')!
    expect(row.confirm).toBe('none')
    expect(row.confirm, 'approved and not-gated were collapsed').not.toBe('not-gated')
  })

  test('M5 and a gated, unapproved document DOES offer one', () => {
    const row = documentRows(DATA).find((r) => r.name === 'Gated but unlisted')!
    expect(row.confirm).toBe('offer')
  })

  test('M6 the row key is a slug: spaces to hyphens, everything else dropped', () => {
    expect(docKey('Site survey')).toBe('Site-survey')
    expect(docKey('H&S / risk assessment (v2)')).toBe('HS--risk-assessment-v2')
    expect(docKey('  spaced  out  ')).toBe('-spaced-out-')
  })

  test('M7 the URL comes from document_location, and is empty when absent', () => {
    const rows = documentRows(DATA)
    expect(rows.find((r) => r.name === 'Site survey')!.url).toBe('http://a')
    expect(rows.find((r) => r.name === 'Catalogue only')!.url).toBe('')
  })

  test('M8 an empty configuration is an ANSWER, not a failure', () => {
    expect(documentRows({ reference_docs: [], completable_documents: [] })).toEqual([])
  })

  test('the route carries the stage, encoded', () => {
    expect(DOCUMENTS_ROUTE('tb-1', 'Pre-Site Assessment'))
      .toBe('/api/test-beds/tb-1/document-requirements?stage=Pre-Site%20Assessment')
  })
})

describe('A: the shared stage track list', () => {
  const ST = {
    stage_name: 'Qualification',
    state: 'current',
    tracks: [
      { track: 'Technical', approved: false, scope: 'stage' },
      { track: 'Commercial', approved: true, scope: 'stage', decided_at: '2026-01-01' },
    ],
  }

  test('A4 recordType is REQUIRED and throws, so a missed call site is loud', () => {
    // @ts-expect-error deliberately omitting the argument the rule is about
    expect(() => stageTracks(ST, undefined, false)).toThrow(/recordType is required/)
  })

  test('A2 an unknown stage says so', () => {
    expect(stageTracks(undefined, 'test_bed', false)).toEqual({ kind: 'unknown', text: UNKNOWN_STAGE })
  })

  test('A3 a known stage with no tracks says something different', () => {
    const r = stageTracks({ ...ST, tracks: [] }, 'test_bed', false)
    expect(r.kind, 'a known stage with no tracks read as unknown').toBe('empty')
    expect(r).toEqual({ kind: 'empty', text: TRACK_EMPTY })
    expect(TRACK_EMPTY, 'unknown and none-required were collapsed').not.toBe(UNKNOWN_STAGE)
  })

  test('A5 clickable needs all four: not superseded, current, unapproved, not version', () => {
    expect(trackRow(ST.tracks[0], ST, false).clickable).toBe(true)
    expect(trackRow(ST.tracks[1], ST, false).clickable, 'an approved track was clickable').toBe(false)
    expect(trackRow(ST.tracks[0], ST, true).clickable, 'a workflow record offered the old control').toBe(false)
    expect(trackRow(ST.tracks[0], { ...ST, state: 'future' }, false).clickable).toBe(false)
    expect(trackRow({ ...ST.tracks[0], scope: 'version' }, ST, false).clickable,
      'a version-scoped track was clickable').toBe(false)
  })

  test('A6 a version-scoped APPROVED track names the version and the stage', () => {
    const r = trackRow({
      track: 'Commercial', approved: true, scope: 'version',
      version_label: 'v3.0', decided_at: '2026-01-01',
    }, ST, false)
    expect(r.meta).toContain('v3.0')
    expect(r.meta).toContain('Qualification')
    expect(r.role).toContain('Proposal/Pricing approved for issue')
  })

  test('A6 an unapproved version-scoped track carries the RULE\'s own reason', () => {
    expect(trackRow({
      track: 'Commercial', approved: false, scope: 'version', reason: 'No major issued yet',
    }, ST, false).meta).toBe('No major issued yet')
  })

  test('A8 the four ordinary shapes each say something different', () => {
    expect(trackRow(ST.tracks[1], ST, false).meta).toMatch(/^Approved /)
    expect(trackRow(ST.tracks[0], ST, false).meta).toBe('Click to approve')
    expect(trackRow(ST.tracks[0], ST, true).meta).toBe('Decided on the transition request')
    expect(trackRow(ST.tracks[0], { ...ST, state: 'future' }, false).meta)
      .toBe('Not yet at this stage')
  })

  test('A7 scope is READ, never inferred from the stage name', () => {
    // A Proposal-named stage whose rule says `stage` must behave as stage-scoped.
    const proposal = { ...ST, stage_name: 'Proposal' }
    expect(trackRow({ track: 'Commercial', approved: false, scope: 'stage' }, proposal, false).meta)
      .toBe('Click to approve')
  })
})

describe('Z: the closed panel', () => {
  const DATA = {
    total: 4, produced: 3,
    groups: [
      { stage: 'Qualification', documents: [
        { document: 'Site survey', produced: true, status: 'approved', document_location: 'http://a' },
        { document: 'Never made', produced: false, status: null, document_location: null }] },
      { stage: 'Closed', documents: [
        { document: 'Final report', produced: true, status: 'started', document_location: null }] },
    ],
  }

  test('Z3 the ROUTE\'s group order is preserved, which is lifecycle order', () => {
    expect(closedGroups(DATA).map((g) => g.stage)).toEqual(['Qualification', 'Closed'])
  })

  test('Z3 a stage that produced NOTHING is omitted, not shown empty', () => {
    const withEmpty = { ...DATA, groups: [...DATA.groups, { stage: 'Decommissioning', documents: [] }] }
    expect(closedGroups(withEmpty).map((g) => g.stage),
      'an empty stage group was rendered').toEqual(['Qualification', 'Closed'])
  })

  test('Z4 it DEGRADES HONESTLY: the shortfall is stated, not implied', () => {
    expect(closedSubtitle(DATA)).toBe('3 of 4 documents produced. 1 were never recorded.')
  })

  test('Z4 and a complete record says so plainly', () => {
    expect(closedSubtitle({ ...DATA, produced: 4 })).toBe('All 4 documents produced across the lifecycle.')
  })

  test('Z5 a document never produced SAYS so; a produced one with no URL says that', () => {
    const rows = closedGroups(DATA)[0].documents
    expect(rows[0].statusLabel).toBe('Approved')
    expect(rows[0].urlText).toBe('http://a')
    expect(rows[1].statusLabel).toBe('Not produced')
    expect(rows[1].urlText, 'an unproduced document rendered a blank URL line').toBe('')
    expect(closedGroups(DATA)[1].documents[0].urlText).toBe('No document URL recorded')
  })

  test('Z2 no row carries a confirm control or an editable url', () => {
    for (const g of closedGroups(DATA)) {
      for (const d of g.documents) {
        expect(Object.keys(d), 'the closed row grew an editable field')
          .toEqual(['document', 'produced', 'statusLabel', 'statusClass', 'urlText'])
      }
    }
  })

  test('Z1 its own route, not the per-stage one', () => {
    expect(LIFECYCLE_ROUTE('tb-1')).toBe('/api/test-beds/tb-1/lifecycle-documents')
  })
})

describe('X: the Next Stage action', () => {
  const STAGES = [
    { stage_name: 'Qualification', sort_order: 1 },
    { stage_name: 'Site Assessment', sort_order: 2 },
    { stage_name: 'Closed', sort_order: 9 },
  ]

  test('X1 the next stage is the one after the record\'s status IN SORT ORDER', () => {
    expect(nextStageFor(STAGES, 'Qualification')).toEqual(
      { currentStage: 'Qualification', nextStage: 'Site Assessment' })
  })

  test('X1 and it is null at the end', () => {
    expect(nextStageFor(STAGES, 'Closed').nextStage).toBeNull()
  })

  test('X1 the list is SORTED first, so a route order cannot decide it', () => {
    // THE FIXTURE HAS TO DISTINGUISH. The first version shuffled to
    // [Closed, Qualification, Site Assessment], where the unsorted answer after
    // Qualification is ALSO Site Assessment - so the injection removing the
    // sort came back silent with zero failures. Verification 17: a probe that
    // fires correctly and cannot tell the two states apart.
    //
    // Here the unsorted answer is Closed and the sorted one is Site Assessment.
    const shuffled = [STAGES[1], STAGES[0], STAGES[2]]
    expect(shuffled.map((s) => s.stage_name),
      'the fixture no longer differs from sort order').toEqual(
      ['Site Assessment', 'Qualification', 'Closed'])
    expect(nextStageFor(shuffled, 'Qualification').nextStage,
      'the array order decided the next stage instead of sort_order')
      .toBe('Site Assessment')
  })

  test('X1 an unknown status yields no next stage rather than the first', () => {
    expect(nextStageFor(STAGES, 'Nonsense').nextStage).toBeNull()
  })
})
