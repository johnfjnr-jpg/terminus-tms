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
// ── ROUND 41: THE MEASURE IS THE PRICE, NOT THE REVISION NUMBER ──────────
//
// A version now carries the pricing snapshot it froze, because that snapshot is
// what supersession is decided against. `SAME` is a record whose pricing still
// matches what V() froze; `MOVED` is one where a pricing DECISION changed.
// F1: REAL pricing keys, because the reason now renders LABELS. `contractValue`
// is not one of the 32 a snapshot carries, so it rendered as "an unlabelled
// pricing field" and the assertion below was testing the fallback.
const V = (n, inputs = { duration: 60, targetMargin: 30 }) =>
  ({ revision_number: n, major: 0, minor: 1, inputs })

const SAME = Object.freeze({ duration: 60, targetMargin: 30 })
const MOVED = Object.freeze({ duration: 72, targetMargin: 30 })

// A save that is not a pricing decision: the record moves, the price does not.
const NON_PRICING = Object.freeze({ duration: 60, targetMargin: 30, estCloseDate: '2026-12-01' })

test('a version nobody has decided on is not approved', () => {
  assert.equal(versionApprovalState(V(4), [], 4, APPROVAL_TRACK, SAME).state, 'none')
})

test('approved, and the PRICE has not moved', () => {
  const s = versionApprovalState(V(4), [approvedAt(4)], 4, APPROVAL_TRACK, SAME)
  assert.equal(s.state, 'approved')
  assert.equal(s.revisionApproved, 4)
  assert.deepEqual(s.changedKeys, [])
  assert.equal(s.approverId, 'u1')
})

// ─────────────────────────────────────────────────────────────
// The rule the whole column exists for
// ─────────────────────────────────────────────────────────────

// ── SUPERSEDED 2026-09-02, ROUND 41, AND THE OLD WORDING IS LEFT VISIBLE ──
//
// These two read "ONE revision after approval voids it" and "it stays void
// however far the record moves", asserting `revisionsSince` of 1 and 36.
//
// THE PROPERTY THEY PROTECTED SURVIVES INTACT: an approval that no longer
// describes the screen must never read as approved. What changed is what "the
// screen" means. A revision bumps on a contact, an exit tick, a score or a
// date, none of which touch the price, so the old measure voided approvals over
// edits an approver would not have cared about - and on TT-SGP-SMARTC-112 the
// eleven revisions since V1 included the version's OWN issue, 674ms later, so a
// version superseded itself at birth.
//
// The measure is now the pricing snapshot the version froze. Both directions are
// asserted below, because a rule that can only fire one way is not a rule.

test('ONE pricing decision changed after approval voids it', () => {
  const s = versionApprovalState(V(4), [approvedAt(4)], 5, APPROVAL_TRACK, MOVED)
  assert.equal(s.state, 'superseded',
    'an approval that no longer describes the price must never read as approved')
  assert.deepEqual(s.changedKeys, ['duration'],
    'and it names WHICH decision moved, because that is what an approver needs')
})

test('and it stays void however far the record moves', () => {
  assert.equal(versionApprovalState(V(4), [approvedAt(4)], 40, APPROVAL_TRACK, MOVED).state, 'superseded')
})

test('a NON-PRICING save does not void an approval, however many land', () => {
  // The calibration that makes the rule above a rule rather than a constant.
  // Ticking an exit criterion is a revision, and it is not a price.
  assert.equal(versionApprovalState(V(4), [approvedAt(4)], 40, APPROVAL_TRACK, NON_PRICING).state, 'approved',
    'the record moving is not the deal being re-priced')
})

test('a FROZEN CATALOG RATE is not a pricing decision', () => {
  // Ruled 2026-09-02: catalog batch rates are a default applied at creation.
  // After that the opportunity owns its price, and a batch turnover does not
  // supersede an issued version. The record never stores these six keys, so
  // without the exclusion every version would read superseded against every
  // record - Verification 14, a comparison with nothing on one side.
  const withRates = V(4, { duration: 60, targetMargin: 30, ssUnitCost: 900, hoAqm: 12 })
  assert.equal(versionApprovalState(withRates, [approvedAt(4)], 40, APPROVAL_TRACK, SAME).state, 'approved')
})

test('no current pricing means UNKNOWN, never a guess in either direction', () => {
  // Verification 14. A comparison reached with nothing on one side says so.
  const s = versionApprovalState(V(4), [approvedAt(4)], 5)
  assert.equal(s.state, 'unknown',
    'reading it as approved would claim currency nobody checked; as superseded '
    + 'would reinstate the false alarm this change removes')
})

test('a later approval at the CURRENT revision is a fresh approval', () => {
  // The remedy the superseded state names: take a new version, approve it.
  const s = versionApprovalState(V(9), [approvedAt(4), approvedAt(9)], 9, APPROVAL_TRACK, SAME)
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

test('live when a version is approved and the price has not moved', () => {
  const r = liveVersionApproval({
    track: APPROVAL_TRACK, versions: [V(4)], approvals: [approvedAt(4)], latestRevision: 4, currentPayload: SAME,
  })
  assert.equal(r.live, true)
  assert.equal(r.state, 'approved')
  assert.match(r.reason, /nothing has changed since/)
})

test('NOT live the moment the PRICE moves', () => {
  // Superseded wording, Round 41: this asserted /moved on 1 save since/. The
  // property it protected is that the gate closes and the sentence tells the
  // reader what to do; the save count was never the thing that mattered.
  const r = liveVersionApproval({
    track: APPROVAL_TRACK, versions: [V(4)], approvals: [approvedAt(4)], latestRevision: 5, currentPayload: MOVED,
  })
  assert.equal(r.live, false)
  assert.equal(r.state, 'superseded')
  assert.match(r.reason, /the pricing has changed since: Contract duration \(months\)/)
  assert.ok(!/duration[,.]/.test(r.reason), 'a raw key leaked into the approver-facing sentence')
  assert.match(r.reason, /Take a new version/)
})

test('a save that is not a price leaves the gate OPEN', () => {
  // The direction that was wrong before this round, and the reason for it: an
  // exit tick used to close a Commercial gate.
  const r = liveVersionApproval({
    track: APPROVAL_TRACK, versions: [V(4)], approvals: [approvedAt(4)], latestRevision: 40, currentPayload: NON_PRICING,
  })
  assert.equal(r.live, true)
  assert.equal(r.state, 'approved')
})

test('"nobody approved a version" and "the deal moved" are DIFFERENT answers', () => {
  // They need different actions from the person reading a blocked gate, and a
  // single "not approved" message would send them to the wrong one.
  const none = liveVersionApproval({ track: APPROVAL_TRACK, versions: [], approvals: [approvedAt(4)], latestRevision: 4, currentPayload: SAME })
  const superseded = liveVersionApproval({ track: APPROVAL_TRACK, versions: [V(4)], approvals: [approvedAt(4)], latestRevision: 9, currentPayload: MOVED })
  assert.equal(none.state, 'none')
  assert.equal(superseded.state, 'superseded')
  assert.notEqual(none.reason, superseded.reason)
  assert.match(none.reason, /Take a version on Commercials/)
})

test('an approval on another track cannot make this one live', () => {
  const legal = approvedAt(4, { track: 'Legal' })
  assert.equal(liveVersionApproval({
    track: 'Commercial', versions: [V(4)], approvals: [legal], latestRevision: 4, currentPayload: SAME,
  }).live, false)
})

test('the track is honoured, so one evaluator serves every track', () => {
  const legal = approvedAt(4, { track: 'Legal' })
  assert.equal(liveVersionApproval({
    track: 'Legal', versions: [V(4)], approvals: [legal], latestRevision: 4, currentPayload: SAME,
  }).live, true)
})
