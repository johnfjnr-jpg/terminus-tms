// ── THE REST: the model half ────────────────────────────────────────────
//
// Round 7 Phase 2d session 3, from the C/F/A/X enumeration.
import { describe, test, expect } from 'vitest'
import {
  completeDocumentRoute, confirmBody, saveUrlBody, docFeedback,
} from '../testbed/stageDocuments'
import { convertBody, CONVERT_ROUTE, convertFeedback } from '../testbed/convert'

describe('C: confirming and saving a document', () => {
  test('C1 ONE route serves both, and it is the vanilla\'s own', () => {
    expect(completeDocumentRoute('tb-1')).toBe('/api/test-beds/tb-1/complete-document')
  })

  test('C2 SAVING A URL MUST NOT APPROVE: approve is false, explicitly', () => {
    // The route defaults `approve` to TRUE so pre-existing callers behave as
    // they did. A save that omitted it would approve the document, which is
    // the gate bypass this split exists to prevent.
    const b = saveUrlBody('Site survey', 'http://a')
    expect(b.approve, 'a URL save omitted approve and would approve the document')
      .toBe(false)
    expect(b).toEqual({
      document_type: 'Site survey', document_location: 'http://a', approve: false,
    })
  })

  test('C2 a confirm does NOT pass approve at all, so the route\'s TRUE stands', () => {
    // The route defaults approve to true. A confirm that sent false would
    // never approve anything, which is the inverse of C2's defect.
    expect('approve' in confirmBody('Site survey', ''),
      'a confirm sent an approve flag, so it depends on the caller not the route')
      .toBe(false)
  })

  test('C3 confirm CARRIES the URL box, so a paste-and-confirm does not lose it', () => {
    expect(confirmBody('Site survey', '  http://a  ')).toEqual({
      document_type: 'Site survey', document_location: 'http://a',
    })
  })

  test('C3 and omits the key entirely when the box is empty', () => {
    expect(confirmBody('Site survey', '   ')).toEqual({ document_type: 'Site survey' })
    expect('document_location' in confirmBody('Site survey', ''),
      'an empty box sent an empty location, overwriting a stored one').toBe(false)
  })

  test('C2 a URL save trims, and an empty one is still a save', () => {
    // Clearing the box IS a legitimate write: it removes a wrong link.
    expect(saveUrlBody('X', '  ').document_location).toBe('')
  })

  test('C4 the feedback says which outcome, per row', () => {
    expect(docFeedback(true, null)).toEqual({ text: 'URL saved.', kind: 'ok' })
    expect(docFeedback(false, 'nope')).toEqual({
      text: 'Could not save URL: nope', kind: 'err' })
    expect(docFeedback(false, null).text).toMatch(/unknown error/)
  })
})

describe('X: the convert path', () => {
  test('X1 the name is REQUIRED before any request', () => {
    const r = convertBody('   ')
    expect(r.ok).toBe(false)
    expect(r.ok ? '' : r.error).toBe('Opportunity name is required.')
  })

  test('X1 a name is trimmed and sent under the route\'s own key', () => {
    expect(convertBody('  New deal  ')).toEqual({
      ok: true, body: { opportunity_name: 'New deal' },
    })
  })

  test('the route is the Test Bed\'s, not the Opportunity\'s', () => {
    expect(CONVERT_ROUTE('tb-1')).toBe('/api/test-beds/tb-1/convert')
  })

  test('X3 success OFFERS navigation rather than performing it', () => {
    const f = convertFeedback(true, { id: 'opp-9' }, null)
    expect(f.kind).toBe('ok')
    expect(f.opportunityId, 'success did not name the record to go to').toBe('opp-9')
    expect(f.text).toMatch(/Opportunity created/)
  })

  test('a refusal carries the SERVER\'s sentence, which says why', () => {
    // "This Test Bed has already been converted" is the max-conversions
    // refusal, and it is the one a user most needs to read.
    const f = convertFeedback(false, null, 'This Test Bed has already been converted to an Opportunity')
    expect(f.kind).toBe('err')
    expect(f.text).toBe('This Test Bed has already been converted to an Opportunity')
    expect(f.opportunityId).toBeNull()
  })

  test('and falls back to a plain sentence when the server sends none', () => {
    expect(convertFeedback(false, null, null).text).toBe('Conversion failed.')
  })
})
