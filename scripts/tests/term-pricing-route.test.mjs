// ── TERM PRICING ROUTE: the band save, over HTTP, against a recording db ──
//
// TP_BANDS ruling 0.1 (John, 2026-10-12): the route's success and refusal
// paths are proven over HTTP by tests calling the route's own validation. No
// probe writes the live settings, and the probe account is not an admin.
//
// So the REAL route module is mounted on a real Fastify instance and driven
// with real HTTP requests (inject), and only the database is replaced: a
// recording stand-in answering the four reads the route makes (settings,
// catalog, the caller's admin row) and capturing the one write. The stand-in
// is built from the shapes the route reads with its own select strings, and
// the settings rows are migration 20261012000001's seed, so the fixture is
// the state the SYSTEM holds, not the state this code happens to want
// (Verification 47).
//
// What this does not prove: that Postgres's RLS refuses a non-admin (the live
// HTTP probe does, as john+test), or that a real admin's save lands in the
// table (John's walk step, ruling 0.1).

import test from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'

// src/supabase.js builds its clients at import and needs a URL to do so. The
// pure suite runs with no .env, and this test never reaches a client: dbFor
// replaces every one. An unroutable placeholder, so a call that escaped the
// stand-in would fail loudly rather than reach the real project.
process.env.SUPABASE_URL ??= 'http://127.0.0.1:9'
process.env.SUPABASE_PUBLISHABLE_KEY ??= 'placeholder'
process.env.SUPABASE_SECRET_KEY ??= 'placeholder'
const { default: termPricingRoutes } = await import('../../src/routes/term-pricing.js')

const SEED = [
  { from: 1, discountPct: '0' }, { from: 10, discountPct: '5' }, { from: 50, discountPct: '10' }, { from: 200, discountPct: '15' },
]
const SETTINGS_ROWS = () => [
  { key: 'TERMS', value: [12, 24, 36, 48, 60, 72, 84, 96, 108, 120] },
  { key: 'ANCHOR_TERM', value: 36 },
  { key: 'ANCHOR_MARGIN', value: { safesight: '90', air_quality: '90', hemir: '90' } },
  { key: 'SHORT_TERM_MARGIN', value: { safesight: '90', air_quality: '90', hemir: '90' } },
  { key: 'PROFIT_STEP', value: '0.00' },
  { key: 'VOLUME_BANDS', value: SEED },
  { key: 'VOLUME_BANDS_BY_PRODUCT', value: { safesight: SEED, air_quality: SEED, hemir: SEED } },
  { key: 'HW_UPFRONT_MARGIN', value: '20' },
  { key: 'MARGIN_FLOOR', value: '25' },
  { key: 'CURRENCY', value: 'USD' },
].map((r) => ({ ...r, updated_at: '2026-10-12T02:35:08.847153+00:00', updated_by: null }))

// base_cost_batches as the route selects it: figures already ::text.
const CATALOG_ROWS = [
  { id: 'b-ss', product: 'safesight', batch_label: 'Initial catalog', effective_from: '2026-08-27', unit_cost: '8000.00', hosting_cost_month: '200.00', install_cost_existing: '0.00', install_cost_new: '0.00' },
  { id: 'b-aq', product: 'air_quality', batch_label: 'Initial catalog', effective_from: '2026-08-27', unit_cost: '2000.00', hosting_cost_month: '100.00', install_cost_existing: '0.00', install_cost_new: '0.00' },
  { id: 'b-he', product: 'hemir', batch_label: 'Initial catalog', effective_from: '2026-08-27', unit_cost: '100000.00', hosting_cost_month: '500.00', install_cost_existing: '0.00', install_cost_new: '0.00' },
]

/**
 * A recording stand-in for the caller's client. `admin` decides what the
 * caller's own system_roles read returns; `rlsRefuses` makes the upsert
 * answer success with zero rows, which is how RLS refuses a write.
 */
function fakeDb({ admin, rlsRefuses = false }) {
  const writes = []
  const rows = SETTINGS_ROWS()
  const from = (table) => {
    let op = 'select'
    let payload = null
    const chain = {
      select() { return chain },
      lte() { return chain },
      eq() { return chain },
      upsert(r) { op = 'upsert'; payload = r; return chain },
      then(resolve, reject) {
        try {
          if (op === 'upsert') {
            writes.push({ table, rows: payload })
            if (!rlsRefuses) {
              for (const w of payload) {
                const at = rows.findIndex((x) => x.key === w.key)
                if (at >= 0) rows[at] = { ...rows[at], ...w }
              }
            }
            return resolve({ data: rlsRefuses ? [] : payload.map((w) => ({ key: w.key })), error: null })
          }
          if (table === 'term_pricing_settings') return resolve({ data: rows.map((r) => ({ ...r })), error: null })
          if (table === 'base_cost_batches') return resolve({ data: CATALOG_ROWS, error: null })
          if (table === 'system_roles') return resolve({ data: admin ? [{ role: 'admin' }] : [], error: null })
          return resolve({ data: null, error: { message: `unexpected table ${table}` } })
        } catch (e) { return reject(e) }
      },
    }
    return chain
  }
  return { db: { from }, writes, rows }
}

async function appWith(db) {
  const app = Fastify()
  app.decorateRequest('user', null)
  app.decorateRequest('jwt', null)
  app.addHook('onRequest', async (request) => {
    request.user = { id: 'user-1', email: 'admin@example.test' }
    request.jwt = 'jwt'
  })
  await app.register(termPricingRoutes, { prefix: '/api', dbFor: () => db })
  return app
}

const SIX = [[1, '0'], [10, '5'], [50, '10'], [200, '15'], [500, '20'], [1000, '30']].map(([from, discountPct]) => ({ from, discountPct }))
const put = (app, product, bands) => app.inject({ method: 'PUT', url: `/api/term-pricing/bands/${product}`, payload: { bands } })

test('0.1 success: an admin saves one product\'s bands, and only that product changes (TB-8, 0.5)', async () => {
  const f = fakeDb({ admin: true })
  const app = await appWith(f.db)
  const res = await put(app, 'safesight', SIX)
  assert.equal(res.statusCode, 200, res.body)
  assert.equal(f.writes.length, 1, 'exactly one write')
  const [w] = f.writes
  assert.equal(w.table, 'term_pricing_settings')
  assert.deepEqual(w.rows.map((r) => r.key), ['VOLUME_BANDS_BY_PRODUCT'], 'one row, the bands key, nothing else')
  assert.deepEqual(w.rows[0].value.safesight, SIX)
  assert.deepEqual(w.rows[0].value.hemir, SEED, 'HEMIR untouched')
  assert.deepEqual(w.rows[0].value.air_quality, SEED, 'Air Quality untouched')
  assert.equal(w.rows[0].updated_by, 'user-1', 'the writer is the caller, read from the session')
  // The answer is the state after the write, read back through the same route.
  const body = res.json()
  assert.deepEqual(body.settings.VOLUME_BANDS_BY_PRODUCT.safesight, SIX)
  assert.equal(body.isAdmin, true)
  await app.close()
})

test('0.1 refusal: a non-admin is refused 403 before anything is validated or written', async () => {
  const f = fakeDb({ admin: false })
  const app = await appWith(f.db)
  const res = await put(app, 'safesight', SIX)
  assert.equal(res.statusCode, 403)
  assert.equal(res.json().error, 'Only an admin can change term pricing settings.')
  assert.equal(f.writes.length, 0)
  await app.close()
})

test('0.1 refusal, TB-6: an invalid set is refused 400 with the 3.2 wording and every problem', async () => {
  const f = fakeDb({ admin: true })
  const app = await appWith(f.db)
  const overlap = [[1, '0'], [2, '5'], [5, '10'], [4, '15']].map(([from, discountPct]) => ({ from, discountPct }))
  const res = await put(app, 'hemir', overlap)
  assert.equal(res.statusCode, 400)
  const body = res.json()
  assert.equal(body.error, 'Band 4 must start above 5, where band 3 starts. Bands cannot overlap. Fix this to save.')
  assert.deepEqual(body.problems.map((p) => p.message), [body.error])
  assert.equal(f.writes.length, 0)
  // And with more than one problem, every one, in band order.
  const many = await put(app, 'hemir', [{ from: 2, discountPct: '0' }, { from: 10, discountPct: '100' }])
  assert.equal(many.statusCode, 400)
  assert.deepEqual(many.json().problems.map((p) => p.message), [
    'Band 1 always starts at 1. Fix this to save.',
    'Band 2\'s discount must be below 100%. Fix this to save.',
  ])
  // 1 band and 7 bands, which the editor cannot send, the server still refuses.
  const one = await put(app, 'hemir', [{ from: 1, discountPct: '0' }])
  assert.equal(one.json().error, 'A product needs at least 2 bands. Add a band to save.')
  const seven = await put(app, 'hemir', [...SIX, { from: 2000, discountPct: '40' }])
  assert.equal(seven.json().error, 'A product can have at most 6 bands. Remove a band to save.')
  assert.equal(f.writes.length, 0)
  await app.close()
})

test('0.1 refusal: a product the catalog does not price is refused 400', async () => {
  const f = fakeDb({ admin: true })
  const app = await appWith(f.db)
  const res = await put(app, 'not_a_product', SIX)
  assert.equal(res.statusCode, 400)
  assert.equal(f.writes.length, 0)
  await app.close()
})

test('0.1 refusal: RLS refusing the write (success, zero rows) is reported 403, not success', async () => {
  const f = fakeDb({ admin: true, rlsRefuses: true })
  const app = await appWith(f.db)
  const res = await put(app, 'safesight', SIX)
  assert.equal(res.statusCode, 403)
  assert.equal(f.writes.length, 1, 'the write was attempted')
  await app.close()
})

test('TB-1: the settings save refuses the retired single list, and GET serves bands per product', async () => {
  const f = fakeDb({ admin: true })
  const app = await appWith(f.db)
  const res = await app.inject({ method: 'PUT', url: '/api/term-pricing/settings', payload: { settings: { VOLUME_BANDS: SIX } } })
  assert.equal(res.statusCode, 400)
  assert.match(res.json().error, /unknown setting: VOLUME_BANDS/)
  assert.equal(f.writes.length, 0)
  const get = await app.inject({ method: 'GET', url: '/api/term-pricing' })
  assert.equal(get.statusCode, 200)
  assert.deepEqual(Object.keys(get.json().settings.VOLUME_BANDS_BY_PRODUCT).sort(), ['air_quality', 'hemir', 'safesight'])
  await app.close()
})
