import { createUserClient } from '../supabase.js'
import { sendWriteError } from '../lib/write-errors.js'

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
      .select('id, record_type, status')
      .eq('id', request.params.id)
      .maybeSingle()

    if (recordErr || !record) {
      return reply.code(404).send({ error: 'not found' })
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
