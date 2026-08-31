/**
 * The stage approvals workflow, as decisions rather than as queries.
 *
 * Round 41. Everything here is pure: it takes rows and returns judgements, so
 * the route fetches and this decides, and both the route and the test see the
 * same function.
 */

/**
 * WHICH RECORD TYPES USE THE WORKFLOW.
 *
 * Ruled by the business 2026-08-31: Opportunity only for now, and Test Bed and
 * Contact keep `POST /records/:id/transition`. The REQUEST OBJECT is generic and
 * keyed to a record, so adopting another type later is adding a string here and
 * routing, not a second table.
 *
 * CLAUDE.md Verification 19: this is a name asserting a property, so the suite
 * measures it rather than reading it. A type in this list with no
 * `approval_obtained` rules would be a workflow that gates nothing; a type with
 * such rules and NOT in this list keeps the old path, which is the deliberate
 * state today for Test Bed.
 */
export const WORKFLOW_RECORD_TYPES = Object.freeze(['opportunity']);

export function usesWorkflow(recordType) {
  return WORKFLOW_RECORD_TYPES.includes(recordType);
}

/**
 * The tracks a transition needs, from its own rules.
 *
 * Read from `stage_gate_rules` rather than from a constant, because the tracks
 * per transition are configuration and have already changed once.
 */
export function requiredTracks(rules) {
  return [...new Set((rules ?? [])
    .filter((r) => r.requirement_type === 'approval_obtained')
    .map((r) => r?.requirement_detail?.track)
    .filter(Boolean))].sort();
}

/**
 * Whether a request has everything it needs, and what is outstanding.
 *
 * A REJECTION IS DECISIVE. Ruled: any rejection closes the request, and the
 * other tracks' approvals stay on it as audit rather than carrying over. So this
 * reports a rejection before it counts approvals, and the caller closes.
 */
export function requestState(required, decisions) {
  const byTrack = new Map();
  for (const d of decisions ?? []) byTrack.set(d.track, d);

  const rejected = (decisions ?? []).find((d) => d.decision === 'rejected');
  if (rejected) {
    return { complete: false, rejected: true, rejectedTrack: rejected.track, outstanding: [] };
  }

  const outstanding = required.filter((t) => byTrack.get(t)?.decision !== 'approved');
  return { complete: outstanding.length === 0, rejected: false, rejectedTrack: null, outstanding };
}

/**
 * May this person decide this track on this request?
 *
 * TWO RULES, AND THE FIRST IS THE ONE THAT MATTERS. A requester may never
 * approve their own request, on any track, ruled and kept. It is expressed here
 * rather than in the database because it compares two rows and a check
 * constraint cannot see another table; the route is the enforcement and this is
 * the definition, so the route has nothing to restate.
 *
 * @param {{requested_by: string}} request
 * @param {string} userId
 * @param {Array<{track: string, user_id: string, record_id: string|null}>} approvers
 * @param {string} track
 * @param {string} recordId
 */
export function mayDecide(request, userId, approvers, track, recordId) {
  if (!request) return { allowed: false, reason: 'There is no such request.' };
  if (request.status !== 'open') {
    return { allowed: false, reason: `This request is ${request.status} and cannot be decided.` };
  }
  if (request.requested_by === userId) {
    return {
      allowed: false,
      reason: 'You raised this request, so you cannot approve or reject it. '
        + 'Someone else on this track has to decide it.',
    };
  }
  const named = (approvers ?? []).some((a) =>
    a.track === track && a.user_id === userId && (a.record_id === null || a.record_id === recordId));
  if (!named) {
    return { allowed: false, reason: `You are not an approver on the ${track} track.` };
  }
  return { allowed: true, reason: null };
}

/**
 * Proposal -> Evaluation approves an ISSUED VERSION, not a revision.
 *
 * Two checks, and the second is the one worth stating: an issued version exists,
 * AND nothing has changed since. A record revision after the issue is a change,
 * and so is a later draft version.
 *
 * @param {Array} versions every deal_sheet_version for the record
 * @param {number} currentRevision
 */
export function issuedProposal(versions, currentRevision) {
  const issued = (versions ?? [])
    .filter((v) => v.status === 'issued' && Number.isInteger(v.revision_number))
    .sort((a, b) => b.revision_number - a.revision_number)[0];

  if (!issued) {
    return {
      ok: false, version: null,
      reason: 'No Deal Sheet version has been issued. Take a version on Commercials and issue it '
        + 'before requesting this transition.',
    };
  }
  if (currentRevision > issued.revision_number) {
    return {
      ok: false, version: issued,
      reason: `The record has moved on ${currentRevision - issued.revision_number} `
        + `save${currentRevision - issued.revision_number === 1 ? '' : 's'} since the issued version. `
        + 'Issue a new one, or the request would freeze a state nobody has issued.',
    };
  }
  const laterDraft = (versions ?? []).some((v) =>
    v.status === 'draft' && Number.isInteger(v.revision_number) && v.revision_number >= issued.revision_number);
  if (laterDraft) {
    return { ok: false, version: issued, reason: 'There is an unissued draft version. Issue it or discard it first.' };
  }
  return { ok: true, version: issued, reason: null };
}

/**
 * The transitions that require an issued version. Data-shaped rather than a
 * hardcoded pair, so a second one is a line rather than a branch.
 */
export const ISSUED_VERSION_REQUIRED = Object.freeze([
  { record_type: 'opportunity', from_stage: 'Proposal', to_stage: 'Evaluation' },
]);

export function needsIssuedVersion(recordType, fromStage, toStage) {
  return ISSUED_VERSION_REQUIRED.some((r) =>
    r.record_type === recordType && r.from_stage === fromStage && r.to_stage === toStage);
}
