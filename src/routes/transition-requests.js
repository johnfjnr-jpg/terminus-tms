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
import {
  usesWorkflow, requiredTracks, requestState, mayDecide,
  issuedProposal, needsIssuedVersion,
} from '../lib/transition-requests.js'

const OPEN_TRANSITION = { status: 'open', kind: 'transition' }

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

    // ── THE BLOCKERS, MINUS THE APPROVALS ──────────────────────────────────
    //
    // computeBlocking is the ONE gate computation path and it stays. What is
    // dropped here is the approval requirements, and only those: a request
    // exists precisely to collect them, so refusing it for their absence would
    // refuse every request ever made.
    let blocking = []
    let frozenVersionId = null
    if (kind === 'transition') {
      const result = await computeBlocking(
        db, record, record.status, to_stage, rev.revision_number, rev.payload)
      if (result.error) return reply.code(500).send({ error: result.error.message })
      blocking = (result.blocking ?? []).filter((b) => b.requirement_type !== 'approval_obtained')
      if (blocking.length) {
        return reply.code(409).send({
          error: 'This transition is not ready to be requested.',
          blocking,
        })
      }

      if (needsIssuedVersion(record.record_type, record.status, to_stage)) {
        const { data: versions, error: vErr } = await db
          .from('deal_sheet_versions').select('id, status, revision_number, major, minor')
          .eq('record_id', record.id)
        if (vErr) return reply.code(500).send({ error: vErr.message })
        const issued = issuedProposal(versions, rev.revision_number)
        if (!issued.ok) return reply.code(409).send({ error: issued.reason })
        frozenVersionId = issued.version.id
      }
    }

    const { data: created, error: insErr } = await db.from('transition_requests').insert({
      record_id: record.id,
      record_type: record.record_type,
      from_stage: record.status,
      to_stage,
      kind,
      status: 'open',
      frozen_revision: rev.revision_number,
      frozen_version_id: frozenVersionId,
      requested_by: request.user.id,
    }).select().single()

    if (insErr) {
      if (insErr.code === '23505') {
        return reply.code(409).send({ error: 'A request is already open on this record.' })
      }
      request.log.error({ err: insErr }, 'failed to open a transition request')
      return reply.code(500).send({ error: insErr.message })
    }

    await db.from('audit_log').insert({
      record_id: record.id, record_type: record.record_type,
      action: kind === 'review' ? 'review_requested' : 'transition_requested',
      actor_id: request.user.id,
      detail: { to_stage, from_stage: record.status, frozen_revision: rev.revision_number, request_id: created.id },
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
    const { data: outcome, error: rpcErr } = await db.rpc('decide_transition_request', {
      p_request_id: req.id, p_track: track,
      p_decision: decision, p_reason: reason ?? null, p_required: required,
    })
    if (rpcErr) {
      if (rpcErr.code === '23505') {
        return reply.code(409).send({ error: `The ${track} track has already been decided on this request.` })
      }
      if (rpcErr.code === 'PT409') return reply.code(409).send({ error: rpcErr.message })
      if (rpcErr.code === 'PT400') return reply.code(400).send({ error: rpcErr.message })
      if (rpcErr.code === 'PT404') return reply.code(404).send({ error: rpcErr.message })
      // The function's own copy of the two rules. Reaching this means the
      // route's check disagreed with the database's, which is worth a distinct
      // status rather than a 500.
      if (rpcErr.code === 'PT403') return reply.code(403).send({ error: rpcErr.message })
      if (rpcErr.code === 'PT401') return reply.code(401).send({ error: rpcErr.message })
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
      out.push({ ...req, required, decisions: decisions ?? [], ...requestState(required, decisions) })
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
      out.push({ ...req, required, decisions: decisions ?? [], ...requestState(required, decisions) })
    }
    return reply.send(out)
  })
}
