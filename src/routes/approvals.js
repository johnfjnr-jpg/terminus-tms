import { createUserClient } from '../supabase.js'
import { sendWriteError } from '../lib/write-errors.js'
import { usesWorkflow } from '../lib/transition-requests.js'

export default async function approvalsRoutes(app) {
  // GET /api/records/:id/approvals
  app.get('/records/:id/approvals', async (request, reply) => {
    const db = createUserClient(request.jwt)

    const { data, error } = await db
      .from('approvals')
      .select('*')
      .eq('record_id', request.params.id)
      .order('created_at', { ascending: false })

    if (error) {
      request.log.error({ err: error }, 'failed to fetch approvals')
      return reply.code(500).send({ error: error.message })
    }

    return data
  })

  // POST /api/records/:id/approvals
  // The authenticated user records their own approval decision.
  // The unique constraint (record_id, revision_number, track, approver_id)
  // prevents duplicate decisions; a second POST for the same combination is
  // rejected at the DB level.
  app.post('/records/:id/approvals', async (request, reply) => {
    const { track, decision, comment, tier, revision_number } = request.body ?? {}

    if (!track || typeof track !== 'string') {
      return reply.code(400).send({ error: 'track is required' })
    }
    if (!['approved', 'rejected'].includes(decision)) {
      return reply.code(400).send({ error: 'decision must be "approved" or "rejected"' })
    }

    const db = createUserClient(request.jwt)

    // Resolve revision_number: use supplied value or default to the latest
    let revisionNumber = revision_number
    if (revisionNumber == null) {
      const { data: revRow, error: revRowErr } = await db
        .from('record_revisions')
        .select('revision_number')
        .eq('record_id', request.params.id)
        .order('revision_number', { ascending: false })
        .limit(1)
        .maybeSingle()

      // Round 7 Phase 3.1: same unchecked-error shape as the six fixed in
      // step 3.0, but with a worse consequence. There the fallback to 1
      // caused a misread; here it would WRITE 1 into a durable audit row,
      // permanently recording an approval against the wrong revision.
      // Phase 3.1 constraint 1 makes revision_number matter for every
      // approval, stage-scoped ones included, so it must be right.
      if (revRowErr) {
        request.log.error({ err: revRowErr }, 'failed to resolve current revision for approval')
        return reply.code(500).send({ error: revRowErr.message })
      }

      revisionNumber = revRow?.revision_number ?? 1
    }

    // Verify the record exists and is accessible (RLS will block if not)
    const { data: record, error: recordErr } = await db
      .from('records')
      .select('id, record_type, status, owner_id')
      .eq('id', request.params.id)
      .maybeSingle()

    if (recordErr || !record) {
      return reply.code(404).send({ error: 'not found' })
    }

    // ── SUPERSEDED FOR A RECORD TYPE THAT USES THE WORKFLOW. Round 41 A ────
    //
    // This route predates the stage approvals workflow and it stayed wired to a
    // live control on the Opportunity stage panel. The third walk found it: an
    // approve click returned "An approval decision from you already exists for
    // this revision and track", which is THIS route's 23505 message refusing a
    // duplicate of its own earlier row.
    //
    // WHAT IT WAS WRITING, and this is the part that matters more than the
    // message. For a workflow record type approvalSatisfiesRule returns
    // `requestApprovals.has(track)` and never reaches the stage or revision
    // branches, so every row this route wrote SATISFIED NO GATE. It looked like
    // an approval, was stored as one, and did nothing.
    //
    // AND IT HAS NO IDENTITY CHECK BEYOND BEING SIGNED IN, so the record's owner
    // approved their own transitions through it five times on the walk - the one
    // rule the workflow exists to enforce.
    //
    // REFUSED, NOT DELETED. Test Bed still uses this route by ruling, and
    // WORKFLOW_RECORD_TYPES is the same list the evaluator branches on, so this
    // is a conditional on configuration rather than a fork. When Test Bed moves
    // to the workflow the list changes and this route refuses everything, which
    // is the moment to delete it.
    if (usesWorkflow(record.record_type)) {
      return reply.code(409).send({
        error: 'Approvals on this record are recorded against its transition request, not directly. '
          + 'Open the request and decide the track there.',
      })
    }

    // ── YOU MAY NOT APPROVE YOUR OWN RECORD. Round 41 item A, condition 3 ──
    //
    // Instructed by the business for ALL record types, explicitly not waiting
    // for Test Bed to move to the workflow. This route had no identity check of
    // any kind beyond being signed in.
    //
    // "REQUESTER" HAS NO SUBJECT HERE, so the rule is expressed against the
    // nearest thing that does: this route has no transition request, and the
    // person who advances a record is its OWNER. That is the same person the
    // workflow's own rule names, reached by a different road.
    //
    // ── AND THE MEASURED COST, RECORDED BECAUSE IT IS LARGE ────────────────
    //
    // Every pre-workflow approval in this database is a self-approval by the
    // record's owner: 35 on opportunities, 24 on test beds, and ZERO given by
    // anybody else, ever. One person owns and approves all nine live Test Beds.
    //
    // So on the day this shipped it refused 100% of the approvals this route has
    // ever recorded, and no Test Bed could pass an approval gate. That is not a
    // defect in the rule; it is what a control looks like when one person holds
    // every role, and it is the same condition track_approvers was made a table
    // for. It is written down here so the next person to find Test Beds stuck
    // finds the reason in the same place as the rule.
    if (record.owner_id && record.owner_id === request.user.id) {
      return reply.code(403).send({
        error: 'You own this record, so you cannot approve it. An approval has to come from '
          + 'somebody other than the person advancing the deal.',
      })
    }



    const { data: approval, error: insertErr } = await db
      .from('approvals')
      .insert({
        record_id: request.params.id,
        // Round 7 Phase 3.1: the stage this approval was given at, captured
        // now rather than derived later - by the time a stage-scoped rule is
        // evaluated the record may have moved on, and reconstructing it then
        // would be a guess. revision_number is still written alongside it,
        // for every approval regardless of scope (constraint 1).
        stage: record.status,
        revision_number: revisionNumber,
        track,
        tier: tier ?? null,
        approver_id: request.user.id,
        decision,
        comment: comment ?? null,
        decided_at: new Date().toISOString()
      })
      .select()
      .single()

    if (insertErr) {
      if (insertErr.code === '23505') {
        return reply.code(409).send({
          error: 'An approval decision from you already exists for this revision and track'
        })
      }
      request.log.error({ err: insertErr }, 'failed to insert approval')
      return sendWriteError(reply, insertErr)
    }

    await db.from('audit_log').insert({
      record_id: request.params.id,
      record_type: record.record_type,
      action: 'approval_submitted',
      actor_id: request.user.id,
      detail: { track, decision, revision_number: revisionNumber }
    })

    return reply.code(201).send(approval)
  })
}
