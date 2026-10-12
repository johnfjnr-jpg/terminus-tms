import { createUserClient } from '../supabase.js'
import { resolveCurrentBatches } from '../lib/base-costs.js'
import {
  settingsFromRows, costsFromCatalog, mergeSettingsChange, mergeBandsChange, SETTING_KEYS,
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
//   PUT /api/term-pricing/bands/:product
//                                    admin only: one product's volume bands
//                                    (v1.8, TP_BANDS ruling 0.5)
//
// `dbFor` (plugin option) is the caller's client factory. It defaults to
// createUserClient and exists so scripts/tests/term-pricing-route.test.mjs can
// drive this module over HTTP against a recording database (ruling 0.1).
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

// ONE statement for every changed key, so a change lands whole or not at all.
// The admin has both the insert and the update policy, which an upsert needs.
// Zero rows back is the RLS refusal wearing success (Verification 8).
async function writeKeys(db, request, reply, keys, merged) {
  const now = new Date().toISOString()
  const rows = keys.map((k) => ({ key: k, value: merged[k], updated_at: now, updated_by: request.user.id }))
  const { data, error } = await db.from('term_pricing_settings').upsert(rows, { onConflict: 'key' }).select('key')
  if (error) {
    request.log.error({ err: error }, 'term pricing: settings write failed')
    reply.code(500).send({ error: error.message })
    return false
  }
  if ((data ?? []).length !== rows.length) {
    reply.code(403).send({ error: 'The database refused the change: no admin row for this user.' })
    return false
  }
  return true
}

export default async function termPricingRoutes(app, opts = {}) {
  const dbFor = opts.dbFor ?? createUserClient

  app.get('/term-pricing', async (request, reply) => {
    try {
      return await readState(dbFor(request.jwt), request.user.id)
    } catch (err) {
      request.log.error({ err }, 'term pricing: read failed')
      return reply.code(err.status ?? 500).send({ error: err.message })
    }
  })

  app.put('/term-pricing/settings', async (request, reply) => {
    const db = dbFor(request.jwt)
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

    if (!await writeKeys(db, request, reply, Object.keys(patch).filter((k) => SETTING_KEYS.includes(k)), merged)) return reply
    return await readState(db, request.user.id)
  })

  // v1.8 (TP_BANDS, rulings 0.5 and TB-6): one product's bands, and only that
  // product's. The set is validated by the engine's own validateBands, so a
  // refusal carries the sentence the editor showed, and EVERY problem.
  //
  // Read-merge-write of the one jsonb row: two admins saving DIFFERENT
  // products in the same instant could lose one save. Recorded, not guarded:
  // there is one admin today, and the Settings card's own save has the same
  // shape.
  app.put('/term-pricing/bands/:product', async (request, reply) => {
    const db = dbFor(request.jwt)
    let state
    try {
      state = await readState(db, request.user.id)
    } catch (err) {
      request.log.error({ err }, 'term pricing: read before bands write failed')
      return reply.code(err.status ?? 500).send({ error: err.message })
    }

    if (!state.isAdmin) {
      return reply.code(403).send({ error: 'Only an admin can change term pricing settings.' })
    }

    let merged
    try {
      merged = mergeBandsChange(state.settings, request.params.product, request.body?.bands, state.costs)
    } catch (err) {
      return reply.code(400).send({ error: err.message, code: err.code, problems: err.problems ?? [] })
    }

    if (!await writeKeys(db, request, reply, ['VOLUME_BANDS_BY_PRODUCT'], merged)) return reply
    return await readState(db, request.user.id)
  })
}
