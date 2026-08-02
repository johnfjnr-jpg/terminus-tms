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
}
