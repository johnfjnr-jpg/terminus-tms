import { createUserClient } from '../supabase.js'

export default async function stageDefinitionsRoutes(app) {
  // GET /api/stage-definitions?record_type=X&variant=Y
  // Returns stages in sort_order for the given record type and variant.
  app.get('/stage-definitions', async (request, reply) => {
    const { record_type, variant } = request.query ?? {}

    if (!record_type) {
      return reply.code(400).send({ error: 'record_type is required' })
    }

    const db = createUserClient(request.jwt)

    let query = db
      .from('stage_definitions')
      .select('stage_name, sort_order, phase')
      .eq('record_type', record_type)
      .order('sort_order', { ascending: true })

    query = variant ? query.eq('variant', variant) : query.is('variant', null)

    const { data, error } = await query
    if (error) return reply.code(500).send({ error: error.message })

    return data ?? []
  })
}
