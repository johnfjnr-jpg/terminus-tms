import { createUserClient } from '../supabase.js'

export default async function opportunitiesRoutes(app) {
  // GET /api/opportunities
  app.get('/opportunities', async (request, reply) => {
    const db = createUserClient(request.jwt)

    const { data: opps, error: oppsErr } = await db
      .from('records')
      .select('*, opportunity_details!opportunity_details_record_id_fkey(*)')
      .eq('record_type', 'opportunity')
      .order('created_at', { ascending: false })

    if (oppsErr) {
      request.log.error({ err: oppsErr }, 'failed to list opportunities')
      return reply.code(500).send({ error: oppsErr.message })
    }
    if (!opps.length) return []

    const ids = opps.map(o => o.id)
    const { data: revs, error: revErr } = await db
      .from('record_revisions')
      .select('record_id, payload')
      .in('record_id', ids)
      .order('revision_number', { ascending: false })

    if (revErr) {
      request.log.error({ err: revErr }, 'failed to fetch opportunity revisions')
      return reply.code(500).send({ error: revErr.message })
    }

    const latestPayload = {}
    for (const rev of revs ?? []) {
      if (!latestPayload[rev.record_id]) latestPayload[rev.record_id] = rev.payload
    }

    return opps.map(opp => ({ ...opp, payload: latestPayload[opp.id] ?? {} }))
  })

  // GET /api/opportunities/:id
  app.get('/opportunities/:id', async (request, reply) => {
    const db = createUserClient(request.jwt)

    const [oppResult, revResult] = await Promise.all([
      db.from('records')
        .select('*, opportunity_details!opportunity_details_record_id_fkey(*)')
        .eq('id', request.params.id)
        .eq('record_type', 'opportunity')
        .maybeSingle(),
      db.from('record_revisions')
        .select('revision_number, payload, created_at')
        .eq('record_id', request.params.id)
        .order('revision_number', { ascending: false })
        .limit(1)
        .maybeSingle()
    ])

    if (oppResult.error || !oppResult.data) {
      return reply.code(404).send({ error: 'not found' })
    }

    return {
      ...oppResult.data,
      payload: revResult.data?.payload ?? {},
      latest_revision_number: revResult.data?.revision_number ?? 1
    }
  })
}
