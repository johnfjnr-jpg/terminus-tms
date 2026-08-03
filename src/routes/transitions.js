import { createUserClient } from '../supabase.js'

export default async function transitionsRoutes(app) {
  // POST /api/records/:id/transition
  // Validates to_stage against stage_definitions, checks all gate rules,
  // then performs the transition and auto-updates probability_pct for opportunities.
  app.post('/records/:id/transition', async (request, reply) => {
    const { to_stage } = request.body ?? {}

    if (!to_stage || typeof to_stage !== 'string') {
      return reply.code(400).send({ error: 'to_stage is required' })
    }

    const db = createUserClient(request.jwt)

    const { data: record, error: recordErr } = await db
      .from('records')
      .select('id, record_type, status, variant')
      .eq('id', request.params.id)
      .maybeSingle()

    if (recordErr || !record) {
      return reply.code(404).send({ error: 'not found' })
    }

    const from_stage = record.status

    if (from_stage === to_stage) {
      return reply.code(400).send({ error: 'record is already in that stage' })
    }

    // Validate to_stage against stage_definitions for this record type/variant.
    // Records with no definitions (e.g. smoke_test) skip this check.
    let stageQuery = db
      .from('stage_definitions')
      .select('stage_name')
      .eq('record_type', record.record_type)

    stageQuery = record.variant
      ? stageQuery.eq('variant', record.variant)
      : stageQuery.is('variant', null)

    const { data: stageDefs } = await stageQuery

    if (stageDefs?.length) {
      const validStages = stageDefs.map(s => s.stage_name)
      if (!validStages.includes(to_stage)) {
        return reply.code(400).send({
          error: `${to_stage} is not a valid stage for this record type`
        })
      }
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

    // Fetch gate rules for this transition.
    // Null-variant rules apply to all variants; variant-specific rules apply only to that variant.
    // Use .is('variant', null) directly when there is no variant -- .or() with a single condition
    // can be misinterpreted by PostgREST as a top-level OR, bypassing the other .eq() filters.
    let rulesQuery = db
      .from('stage_gate_rules')
      .select('*')
      .eq('record_type', record.record_type)
      .eq('from_stage', from_stage)
      .eq('to_stage', to_stage)

    rulesQuery = record.variant
      ? rulesQuery.or(`variant.is.null,variant.eq.${record.variant}`)
      : rulesQuery.is('variant', null)

    const { data: rules, error: rulesErr } = await rulesQuery

    if (rulesErr) {
      request.log.error({ err: rulesErr }, 'failed to fetch stage_gate_rules')
      return reply.code(500).send({ error: rulesErr.message })
    }

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

      if (rule.requirement_type === 'document_status') {
        const docName = rule.requirement_detail?.document
        const reqStatus = rule.requirement_detail?.status
        if (!docName || !reqStatus) continue

        // Document records are stored as record_type='document' children of the parent record.
        // The document type is held in records.variant; completion status in records.status.
        const { data: docRecord } = await db
          .from('records')
          .select('id')
          .eq('parent_record_id', record.id)
          .eq('record_type', 'document')
          .eq('variant', docName)
          .eq('status', reqStatus)
          .maybeSingle()

        if (!docRecord) {
          blocking.push({
            requirement_type: 'document_status',
            document: docName,
            required_status: reqStatus,
            message: `Requires ${docName} to be ${reqStatus}`
          })
        }
      }

      // child_record_status handled in a future milestone
    }

    if (blocking.length > 0) {
      return reply.code(422).send({
        error: 'transition blocked by unmet requirements',
        blocking
      })
    }

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

    // Auto-update probability_pct from stage defaults after a successful transition.
    // Opportunities have null variant; the lookup uses IS NULL to match the correct defaults row.
    // Test Beds have no probability concept, so this block is scoped to opportunity only.
    if (record.record_type === 'opportunity') {
      let probQuery = db
        .from('stage_probability_defaults')
        .select('default_probability_pct')
        .eq('record_type', record.record_type)
        .eq('stage', to_stage)

      probQuery = record.variant
        ? probQuery.eq('variant', record.variant)
        : probQuery.is('variant', null)

      const { data: probDefault } = await probQuery

      if (probDefault) {
        await db
          .from('opportunity_details')
          .update({ probability_pct: probDefault.default_probability_pct })
          .eq('record_id', record.id)
      }
    }

    return { record_id: record.id, from: from_stage, to: to_stage }
  })
}
