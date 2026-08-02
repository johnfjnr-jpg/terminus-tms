import { createUserClient } from '../supabase.js'

export default async function transitionsRoutes(app) {
  // POST /api/records/:id/transition
  // Checks all stage_gate_rules for the transition before allowing it.
  // Returns 422 with the full list of unmet requirements if blocked.
  app.post('/records/:id/transition', async (request, reply) => {
    const { to_stage } = request.body ?? {}

    if (!to_stage || typeof to_stage !== 'string') {
      return reply.code(400).send({ error: 'to_stage is required' })
    }

    const db = createUserClient(request.jwt)

    // Fetch the record. RLS ensures the user can only see records they own.
    const { data: record, error: recordErr } = await db
      .from('records')
      .select('id, record_type, status')
      .eq('id', request.params.id)
      .maybeSingle()

    if (recordErr || !record) {
      return reply.code(404).send({ error: 'not found' })
    }

    const from_stage = record.status

    if (from_stage === to_stage) {
      return reply.code(400).send({ error: 'record is already in that stage' })
    }

    // Get the current revision number to check approvals against
    const { data: revRow } = await db
      .from('record_revisions')
      .select('revision_number')
      .eq('record_id', record.id)
      .order('revision_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    const currentRevision = revRow?.revision_number ?? 1

    // Fetch all gate rules for this transition.
    // variant: M1 only matches null-variant rules (smoke_test has no variant).
    // When Opportunity is built, derive variant from the record payload here
    // and use .or('variant.is.null,variant.eq.' + variant) instead.
    const { data: rules, error: rulesErr } = await db
      .from('stage_gate_rules')
      .select('*')
      .eq('record_type', record.record_type)
      .eq('from_stage', from_stage)
      .eq('to_stage', to_stage)
      .is('variant', null)

    if (rulesErr) {
      request.log.error({ err: rulesErr }, 'failed to fetch stage_gate_rules')
      return reply.code(500).send({ error: rulesErr.message })
    }

    // Check each rule. Collect all failures before returning so the caller
    // knows everything that needs fixing, not just the first blocker.
    const blocking = []

    for (const rule of rules) {
      if (rule.requirement_type === 'approval_obtained') {
        const track = rule.requirement_detail?.track
        if (!track) continue

        const { data: approval } = await db
          .from('approvals')
          .select('id')
          .eq('record_id', record.id)
          .eq('revision_number', currentRevision)
          .eq('track', track)
          .eq('decision', 'approved')
          .maybeSingle()

        if (!approval) {
          blocking.push({
            requirement_type: 'approval_obtained',
            track,
            message: `Requires an approved ${track} decision on revision ${currentRevision}`
          })
        }
      }
      // document_status and child_record_status handled in future milestones
    }

    if (blocking.length > 0) {
      return reply.code(422).send({
        error: 'transition blocked by unmet requirements',
        blocking
      })
    }

    // All gates pass — perform the transition
    const { error: updateErr } = await db
      .from('records')
      .update({ status: to_stage })
      .eq('id', record.id)

    if (updateErr) {
      request.log.error({ err: updateErr }, 'failed to update record status')
      return reply.code(500).send({ error: updateErr.message })
    }

    await db.from('audit_log').insert({
      record_id: record.id,
      record_type: record.record_type,
      action: 'transition',
      actor_id: request.user.id,
      detail: { from: from_stage, to: to_stage, revision: currentRevision }
    })

    return { record_id: record.id, from: from_stage, to: to_stage }
  })
}
