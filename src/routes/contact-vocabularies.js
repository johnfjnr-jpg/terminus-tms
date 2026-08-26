import { createUserClient } from '../supabase.js'

// The two Key Customer Contacts vocabularies, Round 35 Phase 2.
//
// One file rather than two, matching scoring.js, which serves lenses, criteria
// and scales together because they are one feature's configuration. These two
// are read by one panel and are meaningless apart.
//
// GET-only, both of them, and that is the admin-only decision rather than an
// unfinished route file. Round 35 Phase 0 refused inline role creation after
// finding the precedent it was proposed from writes into an Admin screen this
// build does not have. Neither table carries an insert policy either, so a
// future POST here would fail under RLS rather than quietly working: the rule
// is stated twice, in the schema and in the absence of a handler.
export default async function contactVocabulariesRoutes(app) {
  // GET /api/contact-roles
  //
  // Retired roles are excluded here rather than deleted, so a picker never
  // offers one while a deal that cites it keeps resolving. Same shape and same
  // reason as closed-lost-reasons.js.
  app.get('/contact-roles', async (request, reply) => {
    const db = createUserClient(request.jwt)

    const { data, error } = await db
      .from('contact_roles')
      .select('id, label, sort_order')
      .eq('active', true)
      .order('sort_order', { ascending: true })

    if (error) {
      request.log.error({ err: error }, 'failed to list contact roles')
      return reply.code(500).send({ error: error.message })
    }

    return data ?? []
  })

  // GET /api/contact-stances
  //
  // `axis` is returned, because it is not decoration: it says which values
  // compete. Six values on "disposition" are mutually exclusive and the one on
  // "stake" is orthogonal to all of them, so a caller that ignores axis and
  // treats this as a flat list will build a picker that cannot express a Pain
  // Owner who is also a Blocker, which is the case the vocabulary exists for.
  app.get('/contact-stances', async (request, reply) => {
    const db = createUserClient(request.jwt)

    const { data, error } = await db
      .from('contact_stances')
      .select('id, label, axis, sort_order')
      .eq('active', true)
      .order('sort_order', { ascending: true })

    if (error) {
      request.log.error({ err: error }, 'failed to list contact stances')
      return reply.code(500).send({ error: error.message })
    }

    return data ?? []
  })
}
