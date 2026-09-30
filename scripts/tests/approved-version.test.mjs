// ── R-L4a: THE APPROVED VERSION FIELD NAMES AN APPROVED VERSION ──────────
//
// Phase 0 measured that `issued_major` is set by PROMOTION: the highest major
// whose status is `issued`, with no approval track in the derivation. The field
// labelled "Approved version" was therefore naming a version that might be
// waiting on every track.
//
// Written before the re-source, red first.
import test from 'node:test'
import assert from 'node:assert/strict'
import { approvedVersionOf, issuedMajor } from '../../src/lib/opportunity-headline.js'
import { versionLabel } from '../../src/lib/version-label.js'

const TRACKS = ['Commercial', 'Technical', 'Legal']
const REV = 5

/** A version row the way the table holds one. */
const v = (major, minor, status = 'issued', id = `${major}.${minor}`) =>
  ({ id, major, minor, status, revision_number: REV, inputs: {} })

/** An approval row already linked to its version, the way the evaluator reads one. */
const ok = (versionId, track) => ({
  track, decision: 'approved', revision_number: REV,
  approver_id: 'someone', decided_at: '2026-09-01T00:00:00Z', version_id: versionId,
})

const call = (versions, approvals, tracks = TRACKS) =>
  approvedVersionOf({ versions, approvals, latestRevision: REV, tracks, payload: {} })

test('R-L4a: a promoted version with NO approvals is not the approved version', () => {
  const versions = [v(1, 0)]
  // The old field would have said V1.0 here, because the status is `issued`.
  assert.equal(issuedMajor(versions), 1, 'the promoted major is 1, which is what the old field read')
  assert.equal(call(versions, []), null, 'and nobody has approved it, so there is no approved version')
})

test('R-L4a: PARTIAL approval is not approval', () => {
  const versions = [v(1, 0)]
  const partial = [ok('1.0', 'Commercial'), ok('1.0', 'Technical')]
  assert.equal(call(versions, partial), null,
    'two of three tracks signed is awaiting approval, not approved')
})

test('R-L4a: every required track signed IS the approved version', () => {
  const versions = [v(1, 0)]
  const all = TRACKS.map((t) => ok('1.0', t))
  const got = call(versions, all)
  assert.ok(got, 'all three tracks signed and it reported nothing')
  assert.equal(got.major, 1)
  assert.equal(got.minor, 0)
})

test('R-L4a: a later PROMOTED version does not displace an earlier APPROVED one', () => {
  // The whole point. V2.0 is promoted and waiting; V1.0 is approved. The field
  // must name V1.0, and the Approvals panel is where V2.0's state belongs.
  const versions = [v(1, 0), v(2, 0)]
  const all = TRACKS.map((t) => ok('1.0', t))
  assert.equal(issuedMajor(versions), 2, 'the promoted major is 2')
  const got = call(versions, all)
  assert.equal(got.major, 1, 'but the APPROVED one is still V1.0')
  assert.equal(got.minor, 0)
})

test('R-L4a: the highest approved wins when more than one is approved', () => {
  const versions = [v(1, 0), v(2, 0)]
  const all = [...TRACKS.map((t) => ok('1.0', t)), ...TRACKS.map((t) => ok('2.0', t))]
  assert.equal(call(versions, all).major, 2)
})

test('R-L4a: a DRAFT is never the approved version, whatever is signed against it', () => {
  const versions = [v(0, 3, 'draft', '0.3')]
  const all = TRACKS.map((t) => ok('0.3', t))
  assert.equal(call(versions, all), null)
})

test('R-L4a: NO required tracks reports nothing, never "approved by default"', () => {
  // `every` over an empty list is vacuously true, which would have reported the
  // newest promoted version as approved by nobody. Verification 14's shape.
  const versions = [v(1, 0)]
  assert.equal(call(versions, [], []), null)
  assert.equal(call(versions, [], null), null)
})

test('R-AV: the stored MINOR is carried through, not derived as .0', () => {
  // A version stored as 2.1 and approved must print V2.1. Deriving ".0" from
  // "an approved version is always x.0" would be a second reader of the
  // numbering rule: right today, silently wrong the day that rule moves.
  const versions = [v(2, 1)]
  const all = TRACKS.map((t) => ok('2.1', t))
  const got = call(versions, all)
  assert.equal(got.minor, 1, 'the stored minor was not carried through')
  assert.equal(versionLabel(got), 'V2.1')
})

test('R-L4a: a version approved and then MOVED PAST still names it', () => {
  // The decision this took, stated so it is a decision rather than a default.
  // `versionApprovalState` calls a signed version whose pricing has since moved
  // `superseded`. It was still approved, and the movement is reported by the
  // Working Version field and by H1's moved-since line rather than by this
  // field going blank.
  //
  // NOT A NEW POSITION: `lastApprovedVersion` had already ruled it, in a
  // comment saying "SUPERSEDED COUNTS. That is the point of the baseline: the
  // last thing an approver signed". Both now read one predicate.
  const moved = { id: '1.0', major: 1, minor: 0, status: 'issued', revision_number: REV,
    inputs: { targetMargin: 30, ssExisting: 10 } }
  const all = TRACKS.map((t) => ok('1.0', t))
  const got = approvedVersionOf({
    versions: [moved], approvals: all, latestRevision: REV, tracks: TRACKS,
    payload: { targetMargin: 35, ssExisting: 10 },   // the deal has moved since
  })
  assert.ok(got, 'a signed version whose price moved afterwards stopped being named')
  assert.equal(versionLabel(got), 'V1.0')
})

test('R-L4a: a REJECTED track blocks it, whatever the other two did', () => {
  const versions = [v(1, 0)]
  const mixed = [
    ok('1.0', 'Commercial'), ok('1.0', 'Technical'),
    { track: 'Legal', decision: 'rejected', revision_number: REV,
      approver_id: 'someone', decided_at: '2026-09-02T00:00:00Z', version_id: '1.0' },
  ]
  assert.equal(call(versions, mixed), null)
})
