/**
 * Is this version approved, and does that approval still describe the screen?
 *
 * Round 38, 2026-08-29. One evaluator, used by the route that lists versions
 * and served to the browser that renders them, because a second path that
 * agrees today will disagree later.
 *
 * ─────────────────────────────────────────────────────────────
 * APPROVAL IS OF A VERSION, WITHOUT FORKING THE ENGINE
 * ─────────────────────────────────────────────────────────────
 *
 * `approvals` stays keyed to (record_id, revision_number, track, approver_id).
 * That is deliberate and record-type agnostic: Test Beds, Contacts and
 * Opportunities all approve the same way, and a second approvals table keyed to
 * a Commercials-only concept would be the fork the architecture forbids.
 *
 * The VERSION carries the link instead. deal_sheet_versions.revision_number is
 * the revision the version was taken from, so approving V1.2 is approving that
 * revision, and the two statements are the same statement.
 *
 * THIS IS ONLY TRUE BECAUSE TAKING A VERSION SAVES THE RECORD FIRST. Round 38
 * Phase 1 made that the rule, and it stopped being a usability nicety the moment
 * this column existed: without it the version would hold the payload on screen
 * and name a revision holding something else, and every approval would be of a
 * document nobody can reproduce. DESIGN_PRINCIPLES.md records it as load
 * bearing so it is not unpicked later.
 *
 * ─────────────────────────────────────────────────────────────
 * ANY REVISION AFTER APPROVAL VOIDS IT
 * ─────────────────────────────────────────────────────────────
 *
 * An approval at revision N stops describing the deal the moment revision N+1
 * exists. It is then SUPERSEDED, and a new version must be taken and approved.
 *
 * Without that rule an approval means "something was once approved", which is
 * worse than no approval at all because it looks like control.
 *
 * DERIVED, NEVER STORED. Computed values are computed: the state is a function
 * of the version, the approvals and the record's current revision, all three of
 * which are already immutable facts. A stored `superseded` flag would be a
 * fourth thing to keep true, and it would be the one people read.
 */

export const APPROVAL_TRACK = 'Commercial'

export const VERSION_APPROVAL_STATES = [
  // The version predates deal_sheet_versions.revision_number and names no
  // revision. It cannot be approved, and it is not a failure: it is a version
  // taken before the link existed, absorbed at the read boundary rather than
  // backfilled into the store.
  'unapprovable',
  // Names a revision, and nobody has decided on it.
  'none',
  // Somebody refused it. Rejection is dominant: one rejection at that revision
  // outranks any number of approvals, because the safe reading of a split
  // decision is the refusing one.
  'rejected',
  // Approved, and the record has not moved since.
  'approved',
  // Approved, and the record HAS moved. The approval describes a deal that is
  // no longer on screen.
  'superseded',
  // The version names a revision the record has not reached.
  //
  // UNREACHABLE BY CONSTRUCTION, and that was checked rather than assumed. The
  // version is stamped with a revision verified as current inside the advisory
  // lock, and revision numbers only increase, so nothing the writer produces can
  // land here and a version cannot be born stale either. Everything that does
  // NOT go through the writer is closed by
  // deal_sheet_versions_revision_exists, a composite foreign key onto
  // (record_id, revision_number): a version can only name a revision of its own
  // record that has actually been written.
  //
  // IT STAYS ANYWAY, and the reason is that it fails closed. Reaching it now
  // requires the foreign key to have been dropped or this evaluator to be reused
  // somewhere without one, and in both cases the difference between this state
  // and 'approved' is the difference between surfacing a fault and rendering an
  // approval nobody gave. A defensive branch is not the same as a claim: it
  // asserts nothing about the world, it refuses to guess when the world is
  // wrong.
  'inconsistent',
]

/**
 * @param {{ revision_number: number|null }} version
 * @param {Array<{ revision_number: number, track: string, decision: string,
 *                 approver_id: string, decided_at: string }>} approvals
 *   Every approval row for this RECORD. Filtered here rather than by the
 *   caller, so a caller that forgets the track filter cannot widen the answer.
 * @param {number} latestRevision - the record's current highest revision number
 * @returns {{ state: string, decidedAt: string|null, approverId: string|null,
 *             revisionApproved: number|null, revisionsSince: number }}
 */
export function versionApprovalState(version, approvals, latestRevision, track = APPROVAL_TRACK) {
  const at = version?.revision_number
  const blank = { state: 'unapprovable', decidedAt: null, approverId: null, revisionApproved: null, revisionsSince: 0 }
  if (!Number.isInteger(at)) return blank

  if (!Number.isInteger(latestRevision) || latestRevision < at) {
    return { ...blank, state: 'inconsistent', revisionApproved: at }
  }

  const here = (approvals ?? []).filter(
    (a) => a.track === track && a.revision_number === at)

  const rejected = here.find((a) => a.decision === 'rejected')
  if (rejected) {
    return {
      state: 'rejected',
      decidedAt: rejected.decided_at ?? null,
      approverId: rejected.approver_id ?? null,
      revisionApproved: at,
      revisionsSince: latestRevision - at,
    }
  }

  // The most recent approval, so the panel names a decision rather than an
  // arbitrary member of a tiered set.
  const approved = here
    .filter((a) => a.decision === 'approved')
    .sort((a, b) => String(b.decided_at ?? '').localeCompare(String(a.decided_at ?? '')))[0]

  if (!approved) {
    return { state: 'none', decidedAt: null, approverId: null, revisionApproved: at, revisionsSince: latestRevision - at }
  }

  return {
    state: latestRevision > at ? 'superseded' : 'approved',
    decidedAt: approved.decided_at ?? null,
    approverId: approved.approver_id ?? null,
    revisionApproved: at,
    revisionsSince: latestRevision - at,
  }
}

/**
 * The version block 2 measures against: the most recent one whose approval is
 * still, or was ever, an approval.
 *
 * SUPERSEDED COUNTS. That is the point of the baseline: the last thing an
 * approver signed, whether or not the deal has moved since. "Approved and
 * unchanged" means there is nothing for block 2 to say.
 *
 * @param {Array} versions - every version for the record
 * @param {Array} approvals
 * @param {number} latestRevision
 * @returns {object|null} the version, or null when nothing was ever approved
 */
export function lastApprovedVersion(versions, approvals, latestRevision, track = APPROVAL_TRACK) {
  const approvedOnes = (versions ?? [])
    .map((v) => ({ v, s: versionApprovalState(v, approvals, latestRevision, track) }))
    .filter(({ s }) => s.state === 'approved' || s.state === 'superseded')
  if (!approvedOnes.length) return null
  return approvedOnes.sort((a, b) => b.v.revision_number - a.v.revision_number)[0].v
}

// ─────────────────────────────────────────────────────────────
// THE ONE ANSWER TO "IS THIS APPROVAL STILL VALID"
// ─────────────────────────────────────────────────────────────
//
// CLAUDE.md Verification 23. Two correct decisions about the same question,
// taken a round apart, produced a conflict nothing detected:
//
//   Round 7 made Opportunity approval rules scope: 'stage', so an approval
//   survives every revision. A correct fix to a real defect - revision-scoped
//   approvals were invalidated by editing any field, which re-enabled the
//   control and recorded a duplicate approval per edit. Sound for a gate about
//   REACHING A STAGE.
//
//   Round 38 decided an approval is of a VERSION and any revision after it
//   voids it, because otherwise an approval means "something was once
//   approved", which looks like control and is not. Sound for a gate about
//   A PRICE.
//
// Measured on the live data: one Opportunity carried four Commercial approvals
// and THREE described prices that had already moved, while the gate read green.
//
// THE FIX IS DELETION, NOT RECONCILIATION. Changing scope from 'stage' to
// 'revision' would have made the gate agree with the page today through a second
// mechanism that drifts later, which is Verification 20 arriving at design
// level. So the stage gate does not decide this for itself at all: scope
// 'version' means "ask this function", and this function is the same one the
// approval page renders from.

export const VERSION_SCOPE = 'version';

/**
 * Does this record currently hold a LIVE approval on this track?
 *
 * Live means: a version was approved, and the record has not moved since. It is
 * exactly what the approval page shows an approver, asked by the gate rather
 * than re-derived by it.
 *
 * @param {object} p
 * @param {string} p.track
 * @param {Array} p.versions   deal_sheet_versions rows for this record
 * @param {Array} p.approvals  approvals rows for this record
 * @param {number} p.latestRevision
 * @returns {{ live: boolean, state: string, version: object|null, reason: string }}
 */
export function liveVersionApproval({ track, versions, approvals, latestRevision }) {
  const version = lastApprovedVersion(versions, approvals, latestRevision, track);

  if (!version) {
    // NOT THE SAME AS SUPERSEDED, and the message has to say which. "Nobody has
    // approved a version" and "the deal moved after it was approved" need
    // different actions from the person reading a blocked gate.
    return {
      live: false,
      state: 'none',
      version: null,
      reason: `No Deal Sheet version has been approved on the ${track} track. `
        + 'Take a version on Commercials, then approve it.',
    };
  }

  const detail = versionApprovalState(version, approvals, latestRevision, track);
  const label = version.major === 0 ? `V0.${version.minor}` : (version.minor === 0 ? `V${version.major}` : `V${version.major}.${version.minor}`);

  if (detail.state === 'approved') {
    return { live: true, state: 'approved', version, detail, reason: `${label} is approved and nothing has changed since.` };
  }

  return {
    live: false,
    state: detail.state,
    version,
    detail,
    reason: detail.state === 'superseded'
      ? `${label} was approved at revision ${detail.revisionApproved}, and the record has moved on `
        + `${detail.revisionsSince} save${detail.revisionsSince === 1 ? '' : 's'} since. `
        + 'That approval no longer describes this deal. Take a new version and have it approved.'
      : `${label} is ${detail.state}.`,
  };
}
