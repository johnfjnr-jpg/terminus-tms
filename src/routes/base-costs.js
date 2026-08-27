import { createUserClient } from '../supabase.js'
import { resolveCurrentBatches } from '../lib/base-costs.js'

// Base Cost Data, the product catalog. Round 36 Phase 1.
//
// GET-only, and that is the admin-only decision rather than an unfinished route
// file. base_cost_batches carries a select policy and no insert, update or
// delete policy, so a POST here would fail under RLS rather than quietly
// working: the rule is stated twice, in the schema and in the absence of a
// handler. Same shape and same reason as contact-vocabularies.js.
//
// ── WHY THIS ROUTE RESOLVES "CURRENT" RATHER THAN RETURNING EVERY ROW ────────
//
// "Which batch is current" has exactly one correct answer and it is derived,
// not stored: the latest row for a product whose effective_from has passed.
// Returning every row and letting each caller pick would put that derivation in
// every caller, and Architecture rule 3 says one computation path per concern,
// because a second path that agrees today will disagree later.
//
// So resolveCurrentBatches() in src/lib/base-costs.js is the one path, shared
// with the frontend, and as_of is that same path asked a different date rather
// than a second one. The pricing-version round will need
// exactly that: what were the costs on the day this deal was approved.
export default async function baseCostsRoutes(app) {
  // GET /api/base-costs
  // GET /api/base-costs?as_of=YYYY-MM-DD
  //
  // Returns one row per product: the batch current on the given date, or today
  // if none is given. A product with no batch yet is ABSENT from the response
  // rather than present with zeros - Round 36 Phase 0 found the Commercials tab
  // computing on absent inputs and displaying the result as $0, and a zero-
  // filled row here would hand the next screen the same indistinguishable pair.
  app.get('/base-costs', async (request, reply) => {
    const asOf = request.query?.as_of ?? new Date().toISOString().slice(0, 10)

    if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf) || Number.isNaN(Date.parse(asOf))) {
      return reply.code(400).send({ error: 'as_of must be a valid date (YYYY-MM-DD)' })
    }

    const db = createUserClient(request.jwt)

    // Ordered newest-first per product so the first row seen for a product is
    // the current one. lte() is what makes a future-dated batch not current,
    // which the business confirmed as intended: entering next quarter's prices
    // must not reprice today's deals.
    const { data, error } = await db
      .from('base_cost_batches')
      .select('id, product, batch_label, effective_from, unit_cost, install_cost_existing, install_cost_new, hosting_cost_month')
      .lte('effective_from', asOf)
      .order('product', { ascending: true })
      .order('effective_from', { ascending: false })

    if (error) {
      request.log.error({ err: error }, 'failed to list base cost batches')
      return reply.code(500).send({ error: error.message })
    }

    return { as_of: asOf, products: resolveCurrentBatches(data ?? [], asOf) }
  })
}

// The derivation moved to src/lib/base-costs.js in Phase 2, so the Commercials
// tab's live preview and this route resolve a batch through the SAME FILE
// rather than two copies that agree today. It is served at /lib/base-costs.js,
// the arrangement deal-calculator.js already uses for the same reason.
