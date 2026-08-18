import { createUserClient } from '../supabase.js'

export default async function terminusStaffRoutes(app) {
  // GET /api/terminus-staff — admin-managed reference list, read-only
  // from this API. Edited directly via Supabase's own editor for now,
  // same deferral as industries/stage_gate_rules admin config.
  app.get('/terminus-staff', async (request, reply) => {
    const db = createUserClient(request.jwt)

    const { data, error } = await db
      .from('terminus_staff')
      .select('id, name, title')
      .order('name', { ascending: true })

    if (error) {
      request.log.error({ err: error }, 'failed to list terminus staff')
      return reply.code(500).send({ error: error.message })
    }

    return data
  })
}
