import { createUserClient } from '../supabase.js'

// Read-only legacy view. POST /leads, /leads/:id/convert and
// /leads/:id/convert-to-test-bed are retired (2026-08-12) - Lead and
// Contact are the same record going forward (DESIGN_PRINCIPLES.md
// Section 2), new intake happens via POST /api/contacts, and conversion
// is the generic stage transition + Contacts' create-opportunity/
// create-test-bed endpoints, not a Lead-specific action. The 9 existing
// record_type='lead' rows stay exactly as they are - not relabeled to
// 'contact', not deleted - this is the only place they remain visible.
export default async function leadsRoutes(app) {
  // GET /api/leads
  app.get('/leads', async (request, reply) => {
    const db = createUserClient(request.jwt)

    const { data: leads, error } = await db
      .from('records')
      .select('*')
      .eq('record_type', 'lead')
      .order('created_at', { ascending: false })

    if (error) {
      request.log.error({ err: error }, 'failed to list leads')
      return reply.code(500).send({ error: error.message })
    }
    if (!leads.length) return []

    const ids = leads.map(l => l.id)
    const { data: revs } = await db
      .from('record_revisions')
      .select('record_id, payload')
      .in('record_id', ids)
      .order('revision_number', { ascending: false })

    const latestPayload = {}
    for (const rev of revs ?? []) {
      if (!latestPayload[rev.record_id]) latestPayload[rev.record_id] = rev.payload
    }

    return leads.map(l => ({ ...l, payload: latestPayload[l.id] ?? {} }))
  })
}
