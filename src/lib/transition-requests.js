import { pricingChanged, namedChangedKeys } from './version-pricing.js';

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
/**
 * @param {Array}  versions
 * @param {object} currentPayload - the record's payload NOW. Round 41: this was
 *   `currentRevision`, a number, and subtracting revisions is the coupling the
 *   business has ruled out. See src/lib/version-pricing.js for the line between
 *   a pricing decision and a frozen rate.
 */
export function issuedProposal(versions, currentPayload, fromStage) {
  // ── ORDERED BY THE VERSION'S OWN SEQUENCE. Round 41 ─────────────────────
  //
  // This sorted by `revision_number`, the OPPORTUNITY's sequence, to decide
  // which issued version is the latest. That is the same conflation the
  // staleness comparison had, one instance smaller: a version-to-version
  // question answered with the record's counter.
  //
  // The version's own sequence is `(major, minor)`, and the issue route is the
  // authority on it: issuing sets `major = highestIssued + 1, minor = 0` and
  // NEVER touches revision_number, so a version keeps the revision it was
  // created at and two versions routinely share one.
  //
  // The `revision_number` filter stays: it is the approval PAIRING, and a
  // version that names no revision cannot carry an approval. It is no longer
  // what ORDERS them.
  //
  // ── AND THIS HALF IS DEFENSIVE, NOT A FIX. Measured, not assumed ────────
  //
  // Driven through the real routes, two ISSUED versions came out V1.0@rev1 and
  // V2.0@rev2: no inversion and not even a tie. Issuing writes `proposalIssued`,
  // which bumps the record, so the next draft is always created at a strictly
  // higher revision, and among ISSUED versions the two orders agree strictly.
  //
  // So there is no case to calibrate this against, and it is recorded as
  // unprovable rather than claimed as a fix. It is kept because it removes the
  // conflation and costs nothing, and because the select feeding it carries no
  // ORDER BY, so a tie would be resolved by whatever Postgres returned.
  //
  // The later-draft check below is the opposite: its disagreement IS
  // constructible, and it was live.
  const issued = (versions ?? [])
    .filter((v) => v.status === 'issued' && Number.isInteger(v.revision_number))
    .sort((a, b) => (b.major - a.major) || (b.minor - a.minor))[0];

  if (!issued) {
    return {
      ok: false, version: null,
      notice: true,
      reason: 'No Deal Sheet version has been issued. Take a version on Commercials and issue it '
        + 'before requesting this transition.',
    };
  }
  // ── W-K: A NOTICE, NOT AN ERROR, AND IT NAMES THE ACTION ────────────────
  //
  // Round 41, seventh walk. This read as a failure and recurred, and it is
  // neither: it is the precondition doing its job, and it will say the same
  // thing every time until somebody issues a version.
  //
  // THE ACTION IS TO ISSUE, and the old wording did not make that unmissable.
  // "Issue a new one" sat at the end of a sentence about revisions, and a person
  // who had just TAKEN a version reasonably read it as done. A draft does not
  // clear this. Only issuing does, and the sentence now leads with that.
  //
  // `notice: true` marks it for the screen, which styles it as a notice rather
  // than an error. The kind is decided here rather than by the caller matching
  // on the text, which is Verification 43's shape: the surface reads the state
  // the rule produced instead of re-deriving it from a sentence.
  // ── COMPARED ON PRICING, NOT ON REVISIONS. Round 41 ────────────────────
  //
  // This read `currentRevision > issued.revision_number`, and on
  // TT-SGP-SMARTC-112 that counted ELEVEN saves - none of which touched a
  // pricing field, and one of which was the issue itself, 674ms later.
  //
  // The sentence changes with the question. It no longer counts saves, because
  // the number of saves is not the reason: it names what moved.
  //
  // ── W-K'S ACTION-FIRST RULING IS SUPERSEDED HERE. F1, 2026-09-02 ────────
  //
  // W-K ruled the refusal must LEAD with the action, because "issue a new one"
  // sat at the end of a sentence about revisions and a person who had just
  // TAKEN a version read it as done. That reasoning is left visible rather than
  // deleted: it was correct about the sentence it was ruling on.
  //
  // F1 rules the exact wording, and it opens with the STATE rather than the
  // act. What answers W-K's concern is no longer word order but vocabulary:
  // "minor (draft) version" and "Issue major version" name the two things that
  // were being confused, so the sentence distinguishes taking from issuing in
  // its own terms instead of relying on which clause comes first.
  const moved = pricingChanged(issued.inputs, currentPayload);
  if (!moved.comparable) {
    // NOT a silent pass. A version with no snapshot, or a caller with no current
    // pricing, cannot answer "is this still the price" - and a transition
    // request freezes a price, so the honest move is to refuse and say why.
    return {
      ok: false, notice: true, version: issued,
      reason: 'This deal sheet version records no pricing, so there is no way to tell whether the '
        + 'price on screen is the one that was issued. Take a fresh version from current pricing '
        + 'and issue it before requesting this transition.',
    };
  }
  if (moved.changed) {
    // THE STAGE IS PASSED IN, NOT TYPED HERE. F1's wording names the stage the
    // record is leaving. ISSUED_VERSION_REQUIRED holds exactly one entry today
    // and it is Proposal, so a literal would be true and would rot the moment a
    // second entry is added: Architecture 9's fourth variant, a sentence that
    // cannot be falsified by anything.
    return {
      ok: false, notice: true, version: issued,
      reason: `Pricing at minor (draft) version. Changes since last major version: `
        + `${namedChangedKeys(moved.keys)}. Issue major version for ${fromStage} stage exit.`,
    };
  }
  // ── A DRAFT IS NEWER THAN THE ISSUE IFF IT SHARES ITS MAJOR ─────────────
  //
  // The sixth-walk rule, and the issue route enforces exactly this: a draft
  // saved after V5 was issued is V5.1 and carries major 5; one from before
  // carries a LOWER major and is STRANDED.
  //
  // Read through `revision_number` this refused a transition and told the
  // person to issue a stranded draft, which the issue route refuses as "not the
  // next version". Measured on a constructed record, not inferred: a
  // BLOCKED TRANSITION WITH AN INSTRUCTION THE SYSTEM WILL NOT LET YOU FOLLOW.
  // scripts/probe-version-order.mjs holds the construction.
  const laterDraft = (versions ?? []).some((v) =>
    v.status === 'draft' && Number.isInteger(v.major) && v.major >= issued.major);
  if (laterDraft) {
    return {
      ok: false, notice: true, version: issued,
      reason: 'There is a draft version that has not been issued. Issue it, or discard it, before '
        + 'requesting this transition. A draft is not what a request freezes.',
    };
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
