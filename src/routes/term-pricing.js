import { createUserClient } from '../supabase.js'
import { resolveCurrentBatches } from '../lib/base-costs.js'
import {
  settingsFromRows, costsFromCatalog, mergeSettingsChange, SETTING_KEYS,
} from '../lib/term-pricing-settings.js'

// ── TERM PRICING: settings and catalog costs for the quote calculator ────
//
// TERM_PRICING Phase 3 (John, 2026-10-01). The calculation itself runs in the
// browser, in src/lib/term-pricing.js, which is pure; this route serves what
// it needs and guards the one write.
//
//   GET /api/term-pricing            settings, catalog costs, and whether the
//                                    caller is an admin
//   PUT /api/term-pricing/settings   admin only: change one or more settings
//
// ── R-TP6: ADMIN ONLY, ENFORCED TWICE ────────────────────────────────────
//
// This route answers 403 to anybody without a system_roles admin row, and
// the table's own RLS insert and update policies require that row as well.
// Both are needed: an RLS refusal of a write returns SUCCESS WITH ZERO ROWS
// (Verification 8), so the 403 has to come from here, and the policy is what
// binds a client that goes round this route.
//
// The role is read through the CALLER'S client: system_roles is select-only,
// own row only, so the caller can see their own admin row and nobody else's.
// Nothing here takes "I am an admin" from the request (Architecture 12).

async function readState(db, userId) {
  const asOf = new Date().toISOString().slice(0, 10)

  const settingsRead = await db.from('term_pricing_settings').select('key, value, updated_at, updated_by')
  if (settingsRead.error) throw Object.assign(new Error(settingsRead.error.message), { status: 500 })

  // Figures cast to text so no float exists in transit (Phase 0, accepted);
  // which batch is current is decided by the estate's one resolver.
  const catalogRead = await db
    .from('base_cost_batches')
    .select('id, product, batch_label, effective_from, unit_cost::text, hosting_cost_month::text, install_cost_existing::text, install_cost_new::text')
    .lte('effective_from', asOf)
  if (catalogRead.error) throw Object.assign(new Error(catalogRead.error.message), { status: 500 })

  const roleRead = await db.from('system_roles').select('role').eq('user_id', userId).eq('role', 'admin')
  if (roleRead.error) throw Object.assign(new Error(roleRead.error.message), { status: 500 })

  const rows = settingsRead.data ?? []
  const current = resolveCurrentBatches(catalogRead.data ?? [], asOf)
  return {
    asOf,
    settings: settingsFromRows(rows),
    updatedAt: rows.reduce((m, r) => (r.updated_at > m ? r.updated_at : m), ''),
    costs: costsFromCatalog(current, catalogRead.data),
    isAdmin: (roleRead.data ?? []).length > 0,
  }
}

export default async function termPricingRoutes(app) {
  app.get('/term-pricing', async (request, reply) => {
    try {
      return await readState(createUserClient(request.jwt), request.user.id)
    } catch (err) {
      request.log.error({ err }, 'term pricing: read failed')
      return reply.code(err.status ?? 500).send({ error: err.message })
    }
  })

  app.put('/term-pricing/settings', async (request, reply) => {
    const db = createUserClient(request.jwt)
    let state
    try {
      state = await readState(db, request.user.id)
    } catch (err) {
      request.log.error({ err }, 'term pricing: read before write failed')
      return reply.code(err.status ?? 500).send({ error: err.message })
    }

    if (!state.isAdmin) {
      return reply.code(403).send({ error: 'Only an admin can change term pricing settings.' })
    }

    const patch = request.body?.settings
    let merged
    try {
      merged = mergeSettingsChange(state.settings, patch, state.costs)
    } catch (err) {
      return reply.code(400).send({ error: err.message, code: err.code })
    }

    // ONE statement for every changed key, so a change lands whole or not at
    // all. The admin has both the insert and the update policy, which an
    // upsert needs.
    const now = new Date().toISOString()
    const rows = Object.keys(patch)
      .filter((k) => SETTING_KEYS.includes(k))
      .map((k) => ({ key: k, value: merged[k], updated_at: now, updated_by: request.user.id }))
    const { data, error } = await db.from('term_pricing_settings').upsert(rows, { onConflict: 'key' }).select('key')
    if (error) {
      request.log.error({ err: error }, 'term pricing: settings write failed')
      return reply.code(500).send({ error: error.message })
    }
    // Zero rows back is the RLS refusal wearing success (Verification 8).
    if ((data ?? []).length !== rows.length) {
      return reply.code(403).send({ error: 'The database refused the change: no admin row for this user.' })
    }

    return await readState(db, request.user.id)
  })
}
