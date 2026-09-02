/**
 * The stage approvals workflow. Round 41.
 *
 * A salesperson REQUESTS a transition; the record freezes; each track decides;
 * the last approval moves the record. Approvals bind to the REQUEST, so there is
 * no revision for a later edit to move out from under them, and the scope
 * question two rounds answered differently disappears rather than being settled.
 */
import { createUserClient } from '../supabase.js'
import { computeBlocking, GATE_RECORD_SELECT } from './transitions.js'
// From the one file that owns it, not re-declared here: a second 'version'
// literal is a second reader of the same decision (Verification 20).
import { VERSION_SCOPE } from '../lib/version-approval.js'
import {
  usesWorkflow, requiredTracks, requestState, mayDecide,
  issuedProposal, needsIssuedVersion,
} from '../lib/transition-requests.js'

const OPEN_TRANSITION = { status: 'open', kind: 'transition' }

/**
 * THE CRITERIA STATE, AND IT IS NEVER ABSENT. Round 41, ruled by the business.
 *
 * A request raised through the route has passed computeBlocking. A request
 * raised by calling raise_transition_request directly has not, and it looks
 * ENTIRELY NORMAL to an approver: correct stage, correct revision, three tracks
 * waiting. Three people approve in good faith and the record moves without its
 * exit criteria ever having been asked.
 *
 * That gap cannot be closed in SQL without a second gate computation path, which
 * Architecture rule 3 forbids. So it is closed HERE, on the way to the approver:
 * every request carries what the gate says about it RIGHT NOW, computed on the
 * frozen record.
 *
 * TWO STATES, AND NEITHER IS SILENCE.
 *
 *   'met'            the gate passes on this record, everything but the
 *                    approvals themselves
 *   'not evaluated'  it does not, which means nobody asked: a request cannot be
 *                    raised through the route with unmet criteria, so a request
 *                    that has them was raised another way
 *
 * An error computing it is ALSO 'not evaluated', never an omission. A field that
 * disappears when something goes wrong is read as "fine" by the person the
 * warning was for.
 */
export async function criteriaState(db, req) {
  const fallback = (why) => ({ criteria: 'not evaluated', criteria_blockers: [], criteria_note: why })
  try {
    const { data: record, error: recErr } = await db
      .from('records').select(GATE_RECORD_SELECT).eq('id', req.record_id).maybeSingle()
    if (recErr || !record) return fallback('the record could not be read')

    const { data: rev, error: revErr } = await db
      .from('record_revisions').select('revision_number, payload')
      .eq('record_id', req.record_id).eq('revision_number', req.frozen_revision).maybeSingle()
    if (revErr || !rev) return fallback('the frozen revision could not be read')

    const result = await computeBlocking(
      db, record, req.from_stage, req.to_stage, rev.revision_number, rev.payload)
    if (result.error) return fallback('the gate could not be evaluated')

    const blockers = (result.blocking ?? []).filter((b) => b.requirement_type !== 'approval_obtained')
    return blockers.length
      ? {
        criteria: 'not evaluated',
        criteria_blockers: blockers,
        criteria_note: 'This request has unmet exit criteria, which means it was not raised '
          + 'through the stage panel. Do not approve it without checking why.',
      }
      : { criteria: 'met', criteria_blockers: [], criteria_note: null }
  } catch (e) {
    return fallback('the gate raised: ' + String(e?.message ?? e))
  }
}

/** The one place a PT423 becomes an HTTP status, so no route invents its own. */
export function sendFrozen(reply, err) {
  return reply.code(423).send({ error: err.message, frozen: true })
}

export default async function transitionRequestRoutes(app) {
  // ── RAISE ────────────────────────────────────────────────────────────────
  //
  // THE REQUEST IS THE GATE'S FRONT DOOR, ruled by the business. Unmet exit
  // criteria refuse the REQUEST with the blockers list, exactly as Advance does
  // today, so the person who has to fix them is told at the moment they ask
  // rather than after three approvers have looked at it.
  app.post('/records/:id/transition-requests', async (request, reply) => {
    const { to_stage, kind = 'transition' } = request.body ?? {}
    if (!to_stage || typeof to_stage !== 'string') {
      return reply.code(400).send({ error: 'to_stage is required' })
    }
    if (kind !== 'transition' && kind !== 'review') {
      return reply.code(400).send({ error: "kind must be 'transition' or 'review'" })
    }

    const db = createUserClient(request.jwt)
    const { data: record, error: recErr } = await db
      .from('records').select(GATE_RECORD_SELECT).eq('id', request.params.id).maybeSingle()
    if (recErr || !record) return reply.code(404).send({ error: 'not found' })

    if (!usesWorkflow(record.record_type)) {
      return reply.code(400).send({
        error: `${record.record_type} does not use transition requests. `
          + 'Use POST /records/:id/transition.',
      })
    }
    if (record.status === to_stage) {
      return reply.code(400).send({ error: 'record is already in that stage' })
    }

    const { data: rev, error: revErr } = await db
      .from('record_revisions').select('revision_number, payload')
      .eq('record_id', record.id).order('revision_number', { ascending: false })
      .limit(1).maybeSingle()
    if (revErr) return reply.code(500).send({ error: revErr.message })
    if (!rev) return reply.code(400).send({ error: 'this record has no revision to freeze' })

    // Only one open transition request, and the index says so too. Checked here
    // so the answer is a sentence rather than a 23505.
    if (kind === 'transition') {
      const { data: open } = await db.from('transition_requests')
        .select('id, to_stage').eq('record_id', record.id)
        .match(OPEN_TRANSITION).maybeSingle()
      if (open) {
        return reply.code(409).send({
          error: `A request to move this record to ${open.to_stage} is already open. `
            + 'Withdraw it before raising another.',
          request_id: open.id,
        })
      }
    }

    // ── THE BLOCKERS, MINUS THE APPROVALS THIS REQUEST COLLECTS ────────────
    //
    // computeBlocking is the ONE gate computation path and it stays. What is
    // dropped is the approval requirements a request exists to COLLECT, because
    // refusing it for their absence would refuse every request ever made.
    //
    // ── AND A VERSION-SCOPED APPROVAL IS NOT ONE OF THOSE. Item 4 ─────────
    //
    // From Proposal onward the approval is a STANDING SIGN-OFF held against the
    // issued major version. It is not collected by this request and it either
    // exists already or does not, so it is a genuine blocker and stays in the
    // list. That is what makes the from-Proposal path a CHECK rather than a
    // wait: the gate is asked, and the answer decides then and there.
    //
    // Filtered on the blocker's own `scope`, which computeBlocking already
    // reports, rather than on a stage list here. A stage list would be a second
    // statement of where the model changes, and the rules already say it.
    let blocking = []
    let frozenVersionId = null
    if (kind === 'transition') {
      const result = await computeBlocking(
        db, record, record.status, to_stage, rev.revision_number, rev.payload)
      if (result.error) return reply.code(500).send({ error: result.error.message })
      blocking = (result.blocking ?? [])
        .filter((b) => b.requirement_type !== 'approval_obtained' || b.scope === VERSION_SCOPE)
      if (blocking.length) {
        // The version-scoped refusal says what to do about it. computeBlocking
        // carries the evaluator's own reason, so "no version approved" and "the
        // pricing moved since it was approved" stay different sentences.
        const unapproved = blocking.some((b) => b.requirement_type === 'approval_obtained')
        return reply.code(409).send({
          error: unapproved
            ? 'The current pricing version is not approved for issue yet.'
            : 'This transition is not ready to be requested.',
          blocking,
        })
      }

      if (needsIssuedVersion(record.record_type, record.status, to_stage)) {
        // `inputs` is now part of the select, because the staleness question is
        // answered against the version's own pricing snapshot rather than
        // against a revision number. Round 41.
        const { data: versions, error: vErr } = await db
          .from('deal_sheet_versions').select('id, status, revision_number, major, minor, inputs')
          .eq('record_id', record.id)
        if (vErr) return reply.code(500).send({ error: vErr.message })
        // rev.payload, not rev.revision_number. The route already loaded the
        // record's current revision row for the freeze, so this costs no read.
        // `record.status` is the stage being LEFT, which is what F1's wording
        // names. Derived here rather than typed into the sentence.
        const issued = issuedProposal(versions, rev.payload, record.status)
        // W-K: `notice` travels with the refusal so the screen can style it as
        // one. It is still a 409 and still refuses; what changes is that the
        // client stops rendering a precondition doing its job in the same red as
        // a failure.
        if (!issued.ok) return reply.code(409).send({ error: issued.reason, notice: !!issued.notice })
        frozenVersionId = issued.version.id
      }
    }

    // THE FUNCTION IS THE ONLY WRITER, and it derives record_type, from_stage
    // and frozen_revision from the record rather than being told them. Measured
    // before migration 5: a direct insert was permitted, so a caller could name
    // any stage and any revision. This route no longer sends any of the three,
    // which is why it cannot get them wrong either.
    const { data: created, error: insErr } = await db.rpc('raise_transition_request', {
      p_record_id: record.id,
      p_to_stage: to_stage,
      p_kind: kind,
      p_frozen_version_id: frozenVersionId,
    })

    if (insErr) {
      if (insErr.code === '23505') {
        return reply.code(409).send({ error: 'A request is already open on this record.' })
      }
      if (insErr.code === 'PT400') return reply.code(400).send({ error: insErr.message })
      if (insErr.code === 'PT401') return reply.code(401).send({ error: insErr.message })
      if (insErr.code === 'PT404') return reply.code(404).send({ error: insErr.message })
      request.log.error({ err: insErr }, 'failed to open a transition request')
      return reply.code(500).send({ error: insErr.message })
    }

    // ── A ZERO-TRACK TRANSITION HAS ALREADY MOVED BY NOW. Round 41 W6 ─────
    //
    // raise_transition_request executes a transition that needs no approval in
    // the same transaction and returns the row already `approved`, so the audit
    // says what actually happened rather than "requested" for something that
    // completed. Read from the returned ROW rather than recomputed here: the
    // function decided it, and a second opinion about whether the record moved
    // is Verification 20 in the one place it would be least visible.
    const executed = created.status === 'approved'
    await db.from('audit_log').insert({
      record_id: record.id, record_type: record.record_type,
      action: kind === 'review' ? 'review_requested'
        : executed ? 'transitioned_no_approval_required' : 'transition_requested',
      actor_id: request.user.id,
      detail: {
        to_stage, from_stage: created.from_stage,
        frozen_revision: created.frozen_revision, request_id: created.id,
        ...(executed ? { executed_on_raise: true, reason: created.close_reason } : {}),
      },
    })

    return reply.code(201).send(created)
  })

  // ── DECIDE ───────────────────────────────────────────────────────────────
  app.post('/transition-requests/:id/approvals', async (request, reply) => {
    const { track, decision, reason } = request.body ?? {}
    if (!track || typeof track !== 'string') return reply.code(400).send({ error: 'track is required' })
    if (decision !== 'approved' && decision !== 'rejected') {
      return reply.code(400).send({ error: "decision must be 'approved' or 'rejected'" })
    }
    if (decision === 'rejected' && !String(reason ?? '').trim()) {
      return reply.code(400).send({ error: 'a rejection needs a reason' })
    }

    const db = createUserClient(request.jwt)
    const { data: req, error: reqErr } = await db
      .from('transition_requests').select('*').eq('id', request.params.id).maybeSingle()
    if (reqErr) return reply.code(500).send({ error: reqErr.message })
    if (!req) return reply.code(404).send({ error: 'not found' })

    const { data: approvers, error: apErr } = await db
      .from('track_approvers').select('track, user_id, record_id')
      .eq('record_type', req.record_type).eq('track', track)
    if (apErr) return reply.code(500).send({ error: apErr.message })

    // THE SELF-APPROVAL RULE, and it is the route's because it compares two rows
    // a check constraint cannot see at once.
    const may = mayDecide(req, request.user.id, approvers, track, req.record_id)
    if (!may.allowed) return reply.code(403).send({ error: may.reason })

    // ── THE ROUTE'S CHECK IS FOR THE MESSAGE, NOT FOR THE OUTCOME ─────────
    //
    // Round 41 W6: p_required is gone from the function, so this read no longer
    // decides anything. It stays, and it stays for the same reason mayDecide()
    // does: the database's refusal is `The X track is not required to leave Y`,
    // and a route that could name the destination gives the better sentence.
    // The two agree because they read the same rows; if they ever disagree, the
    // database wins and the route's 400 was simply the earlier of the two.
    const { data: rules, error: rulesErr } = await db
      .from('stage_gate_rules').select('requirement_type, requirement_detail')
      .eq('record_type', req.record_type)
      .eq('from_stage', req.from_stage).eq('to_stage', req.to_stage)
    if (rulesErr) return reply.code(500).send({ error: rulesErr.message })
    const required = requiredTracks(rules)

    if (req.kind === 'transition' && !required.includes(track)) {
      return reply.code(400).send({
        error: `The ${req.from_stage} to ${req.to_stage} transition does not require a ${track} approval.`,
      })
    }

    // p_approver is GONE. The function reads auth.uid(): a parameter is an
    // assertion by the caller, and the caller is exactly who the rule
    // constrains. The mayDecide() call above stays, and it is now purely for the
    // message: measured, both this RPC and a direct approvals insert were open
    // to any authenticated user with the publishable key, so the route's check
    // was a declared policy rather than an enforcement.
    //
    // AND p_required IS GONE TOO, Round 41 W6, Architecture 12's third instance.
    // The function derived the record's stage and revision for itself and then
    // took WHICH TRACKS MUST APPROVE as an argument, moving the record when that
    // list was exhausted. A caller passing '{}' moved a record needing three
    // approvals on one, and the function is SECURITY DEFINER, so it had the
    // privilege to do it. required_tracks_for() reads stage_gate_rules inside
    // the function now.
    // ── THE TEMPORARY FAIL-CLOSED GUARD IS GONE, and this is its record ────
    //
    // Between the previous commit and 20260831000008 being applied there was a
    // real window, not a theoretical one: the old function's fifth parameter is
    // `p_required text[] default '{}'`, so a four-argument call RESOLVED TO IT
    // with an empty required list, and the first approval would have moved a
    // record needing three. Nothing would have errored and the gate would have
    // been green. The route refused to decide at all until the derivation
    // existed.
    //
    // REMOVED BECAUSE ITS CONDITION IS MET AND ITS HAZARD IS NOW STRUCTURALLY
    // IMPOSSIBLE, both measured rather than assumed: required_tracks_for
    // answers, and the five-argument overload is GONE - a call passing
    // p_required now fails to resolve. A four-argument call can only reach the
    // new function.
    //
    // Deleted on the condition its own comment named, rather than left in place
    // as scaffolding that outlives its reason. That is the "plan recorded in the
    // same voice as a fact" family, and the way out of it is to write the
    // removal condition down and then honour it.
    const { data: outcome, error: rpcErr } = await db.rpc('decide_transition_request', {
      p_request_id: req.id, p_track: track,
      p_decision: decision, p_reason: reason ?? null,
    })
    if (rpcErr) {
      if (rpcErr.code === '23505') {
        return reply.code(409).send({ error: `The ${track} track has already been decided on this request.` })
      }
      // ── AN ALREADY-DECIDED REQUEST SAYS SO. Round 41 walk item A2 ──────
      //
      // The function's own message is 'this request is approved and cannot be
      // decided', which is a state machine describing itself. What reached the
      // walk was a raw conflict on a request that had COMPLETED, after a
      // double-click the screen gave no reason not to make, and "conflict" is
      // the wrong word for "this already worked".
      //
      // Read from the request's own status rather than parsed out of the
      // message: a sentence is not a status, and matching on it would break the
      // first time the function's wording changed.
      if (rpcErr.code === 'PT409') {
        const { data: now } = await db.from('transition_requests')
          .select('status').eq('id', req.id).maybeSingle()
        const decided = now?.status === 'approved' || now?.status === 'rejected'
        return reply.code(409).send({
          error: decided
            ? `This request has already been decided: it was ${now.status}. Nothing further is needed.`
            : rpcErr.message,
        })
      }
      if (rpcErr.code === 'PT400') return reply.code(400).send({ error: rpcErr.message })
      if (rpcErr.code === 'PT404') return reply.code(404).send({ error: rpcErr.message })
      // The function's own copy of the two rules. Reaching this means the
      // route's check disagreed with the database's, which is worth a distinct
      // status rather than a 500.
      if (rpcErr.code === 'PT403') return reply.code(403).send({ error: rpcErr.message })
      if (rpcErr.code === 'PT401') return reply.code(401).send({ error: rpcErr.message })
      // The request no longer describes the record. Its own status, because it
      // is neither a conflict nor a permission problem: the request is stale in
      // a way only withdrawing and re-raising can fix.
      if (rpcErr.code === 'PT412') return reply.code(412).send({ error: rpcErr.message })
      request.log.error({ err: rpcErr }, 'failed to decide a transition request')
      return reply.code(500).send({ error: rpcErr.message })
    }

    await db.from('audit_log').insert({
      record_id: req.record_id, record_type: req.record_type,
      action: outcome.transitioned ? 'transition_executed' : 'request_decision',
      actor_id: request.user.id,
      detail: {
        request_id: req.id, track, decision,
        ...(outcome.transitioned ? { from_stage: req.from_stage, to_stage: req.to_stage } : {}),
        ...(decision === 'rejected' ? { reason } : {}),
      },
    })

    return reply.send(outcome)
  })

  // ── WITHDRAW ─────────────────────────────────────────────────────────────
  //
  // REQUESTER ONLY, ruled. No admin concept is introduced, so there is no
  // second branch here and none to keep in step with a role model that does not
  // exist yet.
  app.post('/transition-requests/:id/withdraw', async (request, reply) => {
    const reason = String(request.body?.reason ?? '').trim()
    if (!reason) return reply.code(400).send({ error: 'a withdrawal needs a reason' })

    const db = createUserClient(request.jwt)
    const { data: req, error: reqErr } = await db
      .from('transition_requests').select('*').eq('id', request.params.id).maybeSingle()
    if (reqErr) return reply.code(500).send({ error: reqErr.message })
    if (!req) return reply.code(404).send({ error: 'not found' })
    if (req.status !== 'open') {
      return reply.code(409).send({ error: `This request is ${req.status} and cannot be withdrawn.` })
    }
    if (req.requested_by !== request.user.id) {
      return reply.code(403).send({
        error: 'Only the person who raised a request may withdraw it.',
      })
    }

    const { data: updated, error: updErr } = await db.from('transition_requests').update({
      status: 'withdrawn', closed_by: request.user.id,
      closed_at: new Date().toISOString(), close_reason: reason,
    }).eq('id', req.id).select().single()
    if (updErr) return reply.code(500).send({ error: updErr.message })

    await db.from('audit_log').insert({
      record_id: req.record_id, record_type: req.record_type,
      action: 'request_withdrawn', actor_id: request.user.id,
      detail: { request_id: req.id, to_stage: req.to_stage, reason },
    })

    return reply.send(updated)
  })

  // ── THE APPROVER QUEUE ───────────────────────────────────────────────────
  app.get('/transition-requests', async (request, reply) => {
    const db = createUserClient(request.jwt)
    const status = request.query?.status ?? 'open'
    let q = db.from('transition_requests')
      .select('*').order('requested_at', { ascending: true })
    if (status !== 'all') q = q.eq('status', status)
    const { data, error } = await q
    if (error) return reply.code(500).send({ error: error.message })

    // Each request carries what is outstanding, because a queue that shows a
    // request without saying what it is waiting for makes the approver open it
    // to find out.
    const out = []
    for (const req of data ?? []) {
      const { data: rules } = await db.from('stage_gate_rules')
        .select('requirement_type, requirement_detail')
        .eq('record_type', req.record_type)
        .eq('from_stage', req.from_stage).eq('to_stage', req.to_stage)
      const { data: decisions } = await db.from('approvals')
        .select('track, decision, approver_id, decided_at').eq('request_id', req.id)
      const required = requiredTracks(rules)
      // Only OPEN requests carry a criteria state: a closed one is history, and
      // re-evaluating the gate against a record that has since moved would print
      // a judgement about a decision nobody is being asked to make.
      const criteria = req.status === 'open' && req.kind === 'transition'
        ? await criteriaState(db, req)
        : { criteria: 'not applicable', criteria_blockers: [], criteria_note: null }
      // may_decide on this route too, so the queue and the record carry the same
      // shape. The queue has no decide controls by design, and giving it a
      // different payload from the record is how one of them ends up with a
      // control the other says is not allowed.
      const { data: qApprovers } = await db.from('track_approvers')
        .select('track, user_id, record_id').eq('record_type', req.record_type)
      const qMayDecide = required.filter((t) =>
        mayDecide(req, request.user.id, qApprovers ?? [], t, req.record_id).allowed)
      out.push({ ...req, required, decisions: decisions ?? [], may_decide: qMayDecide,
        ...requestState(required, decisions), ...criteria })
    }
    return reply.send(out)
  })

  // ── ONE RECORD'S HISTORY, open and closed ────────────────────────────────
  app.get('/records/:id/transition-requests', async (request, reply) => {
    const db = createUserClient(request.jwt)
    const { data, error } = await db.from('transition_requests')
      .select('*').eq('record_id', request.params.id)
      .order('requested_at', { ascending: false })
    if (error) return reply.code(500).send({ error: error.message })

    const out = []
    for (const req of data ?? []) {
      const { data: rules } = await db.from('stage_gate_rules')
        .select('requirement_type, requirement_detail')
        .eq('record_type', req.record_type)
        .eq('from_stage', req.from_stage).eq('to_stage', req.to_stage)
      const { data: decisions } = await db.from('approvals')
        .select('track, decision, approver_id, decided_at, comment').eq('request_id', req.id)
      const required = requiredTracks(rules)
      const criteria = req.status === 'open' && req.kind === 'transition'
        ? await criteriaState(db, req)
        : { criteria: 'not applicable', criteria_blockers: [], criteria_note: null }
      // ── WHO MAY DECIDE, ANSWERED HERE. Round 41 walk item B ──────────────
      //
      // The walk found Approve and Reject rendered for the REQUESTER, who can
      // never decide their own request. The refusal was correct and arrived
      // after the click.
      //
      // Computed server-side and sent as ONE LOADED VALUE, which is the W1
      // mechanism the ruling names. The alternative is the client fetching
      // track_approvers and re-implementing mayDecide, which is Verification 20
      // by construction: two readers of one rule, and the screen's copy is the
      // one nobody tests against a real refusal.
      //
      // mayDecide is the SAME function the decide route calls, so a track the
      // screen offers is a track the route will accept, and a track it hides is
      // one the route would have refused.
      const { data: approvers } = await db.from('track_approvers')
        .select('track, user_id, record_id').eq('record_type', req.record_type)
      const mayDecideTracks = required.filter((t) =>
        mayDecide(req, request.user.id, approvers ?? [], t, req.record_id).allowed)
      out.push({ ...req, required, decisions: decisions ?? [], may_decide: mayDecideTracks,
        // Which of the two reasons a track is undecidable, so the screen can say
        // it without re-deriving anything.
        requested_by_is_me: req.requested_by === request.user.id,
        ...requestState(required, decisions), ...criteria })
    }
    return reply.send(out)
  })
}
