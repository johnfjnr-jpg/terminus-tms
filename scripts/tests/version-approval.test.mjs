// Approval is of a VERSION, and any revision after it voids the approval.
// Round 38. Runs under `npm test` - pure functions, no database.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { versionApprovalState, lastApprovedVersion, liveVersionApproval, APPROVAL_TRACK }
  from '../../src/lib/version-approval.js'

const approvedAt = (n, extra = {}) => ({
  revision_number: n, track: APPROVAL_TRACK, decision: 'approved',
  approver_id: 'u1', decided_at: '2026-08-29T10:00:00Z', ...extra,
})
const V = (n) => ({ revision_number: n, major: 0, minor: 1 })

test('a version nobody has decided on is not approved', () => {
  assert.equal(versionApprovalState(V(4), [], 4).state, 'none')
})

test('approved, and the record has not moved', () => {
  const s = versionApprovalState(V(4), [approvedAt(4)], 4)
  assert.equal(s.state, 'approved')
  assert.equal(s.revisionApproved, 4)
  assert.equal(s.revisionsSince, 0)
  assert.equal(s.approverId, 'u1')
})

// ─────────────────────────────────────────────────────────────
// The rule the whole column exists for
// ─────────────────────────────────────────────────────────────

test('ONE revision after approval voids it', () => {
  const s = versionApprovalState(V(4), [approvedAt(4)], 5)
  assert.equal(s.state, 'superseded',
    'an approval that no longer describes the screen must never read as approved')
  assert.equal(s.revisionsSince, 1)
})

test('and it stays void however far the record moves', () => {
  assert.equal(versionApprovalState(V(4), [approvedAt(4)], 40).state, 'superseded')
  assert.equal(versionApprovalState(V(4), [approvedAt(4)], 40).revisionsSince, 36)
})

test('a later approval at the CURRENT revision is a fresh approval', () => {
  // The remedy the superseded state names: take a new version, approve it.
  const s = versionApprovalState(V(9), [approvedAt(4), approvedAt(9)], 9)
  assert.equal(s.state, 'approved')
})

// ─────────────────────────────────────────────────────────────
// The states that must not be mistaken for approval
// ─────────────────────────────────────────────────────────────

test('an approval on ANOTHER revision does not approve this version', () => {
  assert.equal(versionApprovalState(V(4), [approvedAt(3)], 4).state, 'none')
  assert.equal(versionApprovalState(V(4), [approvedAt(5)], 5).state, 'none')
})

test('an approval on another TRACK does not approve this version', () => {
  const legal = approvedAt(4, { track: 'Legal' })
  assert.equal(versionApprovalState(V(4), [legal], 4).state, 'none',
    'the track filter is applied here so a caller that forgets it cannot widen the answer')
})

test('rejection is dominant over an approval at the same revision', () => {
  const rejected = approvedAt(4, { decision: 'rejected', approver_id: 'u2' })
  const s = versionApprovalState(V(4), [approvedAt(4), rejected], 4)
  assert.equal(s.state, 'rejected')
  assert.equal(s.approverId, 'u2')
})

test('a version that names no revision cannot be approved', () => {
  // The one row that predates the column. Absorbed at the read boundary; the
  // store is not rewritten.
  assert.equal(versionApprovalState({ revision_number: null }, [approvedAt(4)], 4).state, 'unapprovable')
  assert.equal(versionApprovalState({}, [], 4).state, 'unapprovable')
})

test('a version naming a revision the record has not reached is surfaced, not folded', () => {
  const s = versionApprovalState(V(9), [approvedAt(9)], 4)
  assert.equal(s.state, 'inconsistent',
    'a data fault must never be reachable as an approval')
})

test('the most recent decision is the one reported', () => {
  const early = approvedAt(4, { approver_id: 'early', decided_at: '2026-08-01T00:00:00Z' })
  const late = approvedAt(4, { approver_id: 'late', decided_at: '2026-08-20T00:00:00Z' })
  assert.equal(versionApprovalState(V(4), [early, late], 4).approverId, 'late')
})

// ─────────────────────────────────────────────────────────────
// The block 2 baseline
// ─────────────────────────────────────────────────────────────

test('the baseline is the last version ever approved, superseded included', () => {
  // Superseded COUNTS. It is the last thing an approver signed, which is
  // exactly what block 2 measures against.
  const versions = [V(2), V(6), V(9)]
  const approvals = [approvedAt(2), approvedAt(6)]
  assert.equal(lastApprovedVersion(versions, approvals, 12).revision_number, 6)
})

test('nothing ever approved means no baseline, not a substitute', () => {
  assert.equal(lastApprovedVersion([V(2), V(6)], [], 6), null,
    'falling back to the previous version would answer a different question in the same shape')
  assert.equal(lastApprovedVersion([], [], 1), null)
})

test('a rejected version is not a baseline', () => {
  const rejected = approvedAt(2, { decision: 'rejected' })
  assert.equal(lastApprovedVersion([V(2)], [rejected], 4), null)
})

// ─────────────────────────────────────────────────────────────
// The gate's answer and the page's answer are ONE function
// ─────────────────────────────────────────────────────────────
//
// CLAUDE.md Verification 23. Round 7 ruled that an approval survives every
// revision; Round 38 ruled that any revision voids it. Both shipped, both read
// the same table, and the live data carried three Commercial approvals
// describing prices that had already moved while the gate read green.
//
// The fix was deletion rather than reconciliation, so these lock the property
// that makes it a deletion: there is one function, and the gate calls it.

test('live when a version is approved and nothing has moved', () => {
  const r = liveVersionApproval({
    track: APPROVAL_TRACK, versions: [V(4)], approvals: [approvedAt(4)], latestRevision: 4,
  })
  assert.equal(r.live, true)
  assert.equal(r.state, 'approved')
  assert.match(r.reason, /nothing has changed since/)
})

test('NOT live the moment the record moves', () => {
  const r = liveVersionApproval({
    track: APPROVAL_TRACK, versions: [V(4)], approvals: [approvedAt(4)], latestRevision: 5,
  })
  assert.equal(r.live, false)
  assert.equal(r.state, 'superseded')
  assert.match(r.reason, /moved on 1 save since/)
  assert.match(r.reason, /Take a new version/)
})

test('"nobody approved a version" and "the deal moved" are DIFFERENT answers', () => {
  // They need different actions from the person reading a blocked gate, and a
  // single "not approved" message would send them to the wrong one.
  const none = liveVersionApproval({ track: APPROVAL_TRACK, versions: [], approvals: [approvedAt(4)], latestRevision: 4 })
  const superseded = liveVersionApproval({ track: APPROVAL_TRACK, versions: [V(4)], approvals: [approvedAt(4)], latestRevision: 9 })
  assert.equal(none.state, 'none')
  assert.equal(superseded.state, 'superseded')
  assert.notEqual(none.reason, superseded.reason)
  assert.match(none.reason, /Take a version on Commercials/)
})

test('an approval on another track cannot make this one live', () => {
  const legal = approvedAt(4, { track: 'Legal' })
  assert.equal(liveVersionApproval({
    track: 'Commercial', versions: [V(4)], approvals: [legal], latestRevision: 4,
  }).live, false)
})

test('the track is honoured, so one evaluator serves every track', () => {
  const legal = approvedAt(4, { track: 'Legal' })
  assert.equal(liveVersionApproval({
    track: 'Legal', versions: [V(4)], approvals: [legal], latestRevision: 4,
  }).live, true)
})
