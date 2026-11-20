// ── TODAY'S TERM PRICING SETTINGS AND COSTS, READ ONCE ───────────────────
//
// The ONE read of term_pricing_settings and the current catalog, for every
// server caller: the Term Pricing route (its GET and its admin writes) and,
// from TERM_QUOTES, the opportunity headline and the version routes, which
// price a term quote on today's settings (spec v2.1, 14.3). A second copy of
// this read beside the route's would be a second reader of one value
// (Verification 20), so the route was moved onto it rather than copied.
//
// Figures cast to text so no float exists in transit; which batch is current
// is decided by the estate's one resolver. Both reads are BOUNDED and raise
// rather than truncate (Verification 12, the author's side): the settings are
// a handful of rows and the catalog grows by one row per product per price
// change, so 1,000 is far from either, and reaching it is a fault, not a page.
import { resolveCurrentBatches } from './base-costs.js'
import { settingsFromRows, costsFromCatalog, buildParams } from './term-pricing-settings.js'

const CAP = 1000

export async function readTermState(db, asOf = new Date().toISOString().slice(0, 10)) {
  const settingsRead = await db.from('term_pricing_settings').select('key, value, updated_at, updated_by').range(0, CAP - 1)
  if (settingsRead.error) throw Object.assign(new Error(settingsRead.error.message), { status: 500 })
  const catalogRead = await db
    .from('base_cost_batches')
    .select('id, product, batch_label, effective_from, unit_cost::text, hosting_cost_month::text, install_cost_existing::text, install_cost_new::text')
    .lte('effective_from', asOf)
    .range(0, CAP - 1)
  if (catalogRead.error) throw Object.assign(new Error(catalogRead.error.message), { status: 500 })
  const rows = settingsRead.data ?? []
  const catalog = catalogRead.data ?? []
  if (rows.length >= CAP || catalog.length >= CAP) {
    throw Object.assign(new Error('term pricing settings or catalog outgrew their bounded read'), { status: 500 })
  }
  const settings = settingsFromRows(rows)
  const costs = costsFromCatalog(resolveCurrentBatches(catalog, asOf), catalog)
  return {
    asOf,
    settings,
    costs,
    updatedAt: rows.reduce((m, r) => (r.updated_at > m ? r.updated_at : m), ''),
    params: buildParams(settings, costs),
  }
}

/** Today's engine parameters, or null when they cannot be read (a list must not fail over them). */
export async function readTermParams(db) {
  try { return (await readTermState(db)).params } catch { return null }
}
