import { createUserClient } from '../supabase.js'

export default async function industriesRoutes(app) {
  // GET /api/industries — admin-managed reference list, read-only from
  // this API. Edited directly via Supabase's own editor for now, same
  // deferral as stage_gate_rules admin config (DESIGN_PRINCIPLES Build
  // Order item 8).
  app.get('/industries', async (request, reply) => {
    const db = createUserClient(request.jwt)

    const { data, error } = await db
      .from('industries')
      .select('id, name, short_code')
      .order('name', { ascending: true })

    if (error) {
      request.log.error({ err: error }, 'failed to list industries')
      return reply.code(500).send({ error: error.message })
    }

    return data
  })
}
