import { createUserClient } from '../supabase.js'

export default async function recordsRoutes(app) {
  // POST /api/records — create a record with its initial revision
  // TODO M2: wrap the three inserts (records, record_revisions, audit_log)
  // in a Postgres function called via .rpc() to make creation atomic.
  app.post('/records', async (request, reply) => {
    const { record_type, status = 'draft', payload = {}, parent_record_id } = request.body ?? {}

    if (!record_type || typeof record_type !== 'string' || record_type.trim() === '') {
      return reply.code(400).send({ error: 'record_type is required' })
    }

    const db = createUserClient(request.jwt)

    const { data: record, error: recordErr } = await db
      .from('records')
      .insert({ record_type, status, owner_id: request.user.id, parent_record_id: parent_record_id ?? null })
      .select()
      .single()

    if (recordErr) {
      request.log.error({ err: recordErr }, 'failed to insert record')
      return reply.code(500).send({ error: recordErr.message })
    }

    const { error: revErr } = await db
      .from('record_revisions')
      .insert({ record_id: record.id, revision_number: 1, payload, created_by: request.user.id })

    if (revErr) {
      request.log.error({ err: revErr }, 'failed to insert record_revision')
      return reply.code(500).send({ error: revErr.message })
    }

    await db.from('audit_log').insert({
      record_id: record.id,
      record_type,
      action: 'created',
      actor_id: request.user.id,
      detail: { initial_status: status }
    })

    return reply.code(201).send(record)
  })

  // GET /api/records — list records visible to the authenticated user
  app.get('/records', async (request, reply) => {
    const { record_type, status } = request.query ?? {}
    const db = createUserClient(request.jwt)

    let query = db.from('records').select('*').order('created_at', { ascending: false })
    if (record_type) query = query.eq('record_type', record_type)
    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) {
      request.log.error({ err: error }, 'failed to list records')
      return reply.code(500).send({ error: error.message })
    }

    return data
  })

  // GET /api/records/:id — fetch a single record with its latest revision
  app.get('/records/:id', async (request, reply) => {
    const db = createUserClient(request.jwt)

    const [recordResult, revResult] = await Promise.all([
      db.from('records').select('*').eq('id', request.params.id).maybeSingle(),
      db.from('record_revisions')
        .select('*')
        .eq('record_id', request.params.id)
        .order('revision_number', { ascending: false })
        .limit(1)
        .maybeSingle()
    ])

    if (recordResult.error || !recordResult.data) {
      return reply.code(404).send({ error: 'not found' })
    }

    return { record: recordResult.data, latest_revision: revResult.data }
  })

  // GET /api/records/:id/stage-approvals
  // Read-only view for the Stage & Approvals tab: every stage in the
  // record's lifecycle (not just the current one), with its dot state,
  // a plain-language exit-criteria list derived from stage_gate_rules
  // (both approval_obtained and document_status requirement rows), and
  // which approval_obtained tracks are already decided on the current
  // revision. This does not decide who may approve - it only shows what's
  // required and what's already true. The actual transition gate (does an
  // approval exist before allowing the stage to advance) already lives in
  // transitions.js; this endpoint is purely for display.
  app.get('/records/:id/stage-approvals', async (request, reply) => {
    const db = createUserClient(request.jwt)

    const { data: record, error: recordErr } = await db
      .from('records')
      .select('id, record_type, status, variant')
      .eq('id', request.params.id)
      .maybeSingle()

    if (recordErr || !record) {
      return reply.code(404).send({ error: 'not found' })
    }

    let stageQuery = db
      .from('stage_definitions')
      .select('stage_name, sort_order, phase')
      .eq('record_type', record.record_type)
      .order('sort_order', { ascending: true })
    stageQuery = record.variant ? stageQuery.eq('variant', record.variant) : stageQuery.is('variant', null)

    let rulesQuery = db
      .from('stage_gate_rules')
      .select('from_stage, requirement_type, requirement_detail')
      .eq('record_type', record.record_type)
    rulesQuery = record.variant
      ? rulesQuery.or(`variant.is.null,variant.eq.${record.variant}`)
      : rulesQuery.is('variant', null)

    const { data: revRow } = await db
      .from('record_revisions')
      .select('revision_number')
      .eq('record_id', record.id)
      .order('revision_number', { ascending: false })
      .limit(1)
      .maybeSingle()
    const currentRevision = revRow?.revision_number ?? 1

    const [stagesResult, rulesResult, approvalsResult] = await Promise.all([
      stageQuery,
      rulesQuery,
      db.from('approvals')
        .select('track, decision, approver_id, decided_at')
        .eq('record_id', record.id)
        .eq('revision_number', currentRevision)
    ])

    if (stagesResult.error) return reply.code(500).send({ error: stagesResult.error.message })
    if (rulesResult.error) return reply.code(500).send({ error: rulesResult.error.message })
    if (approvalsResult.error) return reply.code(500).send({ error: approvalsResult.error.message })

    const stages = stagesResult.data ?? []
    const rules = rulesResult.data ?? []
    const approvals = approvalsResult.data ?? []
    const currentIdx = stages.findIndex(s => s.stage_name === record.status)

    const result = stages.map((stage, idx) => {
      const state = currentIdx < 0 ? 'upcoming' : (idx < currentIdx ? 'completed' : idx === currentIdx ? 'current' : 'upcoming')
      const stageRules = rules.filter(r => r.from_stage === stage.stage_name)

      const criteria = stageRules.map(r => {
        if (r.requirement_type === 'approval_obtained') {
          return `Requires an approved ${r.requirement_detail?.track} decision`
        }
        if (r.requirement_type === 'document_status') {
          return `Requires ${r.requirement_detail?.document} to be ${r.requirement_detail?.status}`
        }
        return null
      }).filter(Boolean)

      const tracks = stageRules
        .filter(r => r.requirement_type === 'approval_obtained' && r.requirement_detail?.track)
        .map(r => r.requirement_detail.track)
        .filter((t, i, arr) => arr.indexOf(t) === i)
        .map(track => {
          const decision = approvals.find(a => a.track === track && a.decision === 'approved')
          return {
            track,
            approved: !!decision,
            approver_id: decision?.approver_id ?? null,
            decided_at: decision?.decided_at ?? null,
          }
        })

      return { stage_name: stage.stage_name, sort_order: stage.sort_order, phase: stage.phase, state, criteria, tracks }
    })

    return result
  })
}
