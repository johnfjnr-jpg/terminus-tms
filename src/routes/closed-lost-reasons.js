import { createUserClient } from '../supabase.js'

export default async function closedLostReasonsRoutes(app) {
  // GET /api/closed-lost-reasons - admin-managed reference list, read-only
  // from this API. Edited directly via Supabase's own editor for now, the
  // same deferral as industries, terminus_staff and stage_gate_rules.
  //
  // Retired reasons are excluded here rather than deleted, so a picker never
  // offers one while a closed deal that cites it keeps resolving.
  app.get('/closed-lost-reasons', async (request, reply) => {
    const db = createUserClient(request.jwt)

    const { data, error } = await db
      .from('closed_lost_reasons')
      .select('id, label, sort_order')
      .eq('active', true)
      .order('sort_order', { ascending: true })

    if (error) {
      request.log.error({ err: error }, 'failed to list closed lost reasons')
      return reply.code(500).send({ error: error.message })
    }

    return data ?? []
  })
}
