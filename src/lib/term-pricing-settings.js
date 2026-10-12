// ── TERM PRICING SETTINGS: database rows to engine parameters, and back ──
//
// TERM_PRICING Phase 3, rulings R-TP3 and R-TP6 (John, 2026-10-01). Pure: no
// database, no network. The route reads the rows and the catalog and hands
// them here; the screen receives what this builds.
//
// ONE PATH FROM STORAGE TO THE ENGINE (Architecture 3). The route serves the
// settings and the catalog costs as decimal STRINGS; this module turns them
// into the engine's parameter object, and the same function validates an
// admin's change by running the merged result through the engine's own
// normaliseParams, so "valid" means exactly what the engine can price.
//
// Allowlisted as an importer of the engine in
// scripts/tests/term-pricing-isolation.test.mjs.

import { normaliseParams, validateBands, TermPricingError } from './term-pricing.js'

/**
 * The spec section 3 keys held in term_pricing_settings, in display order.
 *
 * v1.8 (TP_BANDS, TB-1): VOLUME_BANDS_BY_PRODUCT replaces VOLUME_BANDS. The
 * old row stays in the table until the removal migration applied after the
 * push, because the code deployed until then still reads it; nothing here
 * reads it, and a change naming it is refused as unknown.
 */
export const SETTING_KEYS = [
  'TERMS', 'ANCHOR_TERM', 'ANCHOR_MARGIN', 'SHORT_TERM_MARGIN', 'PROFIT_STEP',
  'VOLUME_BANDS_BY_PRODUCT', 'HW_UPFRONT_MARGIN', 'MARGIN_FLOOR', 'CURRENCY',
]

/** The keys whose value is one value per catalog product. */
export const PER_PRODUCT_KEYS = ['ANCHOR_MARGIN', 'SHORT_TERM_MARGIN', 'VOLUME_BANDS_BY_PRODUCT']

/** term_pricing_settings rows to { KEY: value }. Every key must be present. */
export function settingsFromRows(rows) {
  const out = {}
  for (const r of rows ?? []) out[r.key] = r.value
  const missing = SETTING_KEYS.filter((k) => !(k in out))
  if (missing.length) {
    throw new TermPricingError('SETTINGS_MISSING', `term_pricing_settings is missing: ${missing.join(', ')}`)
  }
  return out
}

/**
 * The current catalog batch per product, with costs as decimal STRINGS.
 *
 * `current` is what resolveCurrentBatches returned: it decides WHICH batch is
 * current (the estate's one path for that) but converts the figures to JS
 * numbers. `rawRows` are the same rows as read with `::text` casts, and the
 * figures are taken from them by batch id, so no float reaches the engine.
 */
export function costsFromCatalog(current, rawRows) {
  const byId = new Map((rawRows ?? []).map((r) => [r.id, r]))
  const costs = {}
  for (const c of current ?? []) {
    const raw = byId.get(c.batch_id)
    if (!raw) throw new TermPricingError('CATALOG_MISMATCH', `catalog batch ${c.batch_id} not found among the rows read`)
    costs[c.product] = {
      hwCost: String(raw.unit_cost),
      hostingMonthly: String(raw.hosting_cost_month),
      batchLabel: c.batch_label,
      effectiveFrom: c.effective_from,
    }
  }
  return costs
}

/** { KEY: value } plus catalog costs to the engine's parameter object. */
export function buildParams(settings, costs) {
  return {
    TERMS: settings.TERMS,
    ANCHOR_TERM: settings.ANCHOR_TERM,
    ANCHOR_MARGIN: settings.ANCHOR_MARGIN,
    SHORT_TERM_MARGIN: settings.SHORT_TERM_MARGIN,
    PROFIT_STEP: settings.PROFIT_STEP,
    VOLUME_BANDS_BY_PRODUCT: settings.VOLUME_BANDS_BY_PRODUCT,
    HW_UPFRONT_MARGIN: settings.HW_UPFRONT_MARGIN,
    MARGIN_FLOOR: settings.MARGIN_FLOOR,
    CURRENCY: settings.CURRENCY,
    costs: Object.fromEntries(Object.entries(costs).map(([k, c]) => [k, { hwCost: c.hwCost, hostingMonthly: c.hostingMonthly }])),
  }
}

/**
 * Validates an admin's change. Returns the merged settings, or throws a
 * TermPricingError whose message is fit to show the admin.
 *
 * - only the nine keys, and at least one;
 * - the merged result must normalise in the ENGINE (decimals as strings,
 *   ascending terms containing the anchor, margins below 100%, every
 *   product's bands meeting spec 3.2);
 * - per-product keys (margins, and v1.8's bands) must cover every product
 *   the catalog prices.
 */
export function mergeSettingsChange(current, patch, costs) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    throw new TermPricingError('BAD_CHANGE', 'settings must be an object of KEY: value')
  }
  const keys = Object.keys(patch)
  if (!keys.length) throw new TermPricingError('BAD_CHANGE', 'nothing to change')
  const unknown = keys.filter((k) => !SETTING_KEYS.includes(k))
  if (unknown.length) throw new TermPricingError('BAD_CHANGE', `unknown setting: ${unknown.join(', ')}`)

  const merged = { ...current, ...patch }
  if (typeof merged.CURRENCY !== 'string' || !/^[A-Z]{3}$/.test(merged.CURRENCY)) {
    throw new TermPricingError('BAD_PARAM', 'CURRENCY must be a three-letter code')
  }
  for (const k of PER_PRODUCT_KEYS) {
    const missing = Object.keys(costs).filter((p) => !(merged[k] && p in merged[k]))
    if (missing.length) throw new TermPricingError('BAD_PARAM', `${k} needs a value for: ${missing.join(', ')}`)
  }
  normaliseParams(buildParams(merged, costs))
  return merged
}

/**
 * v1.8 (TP_BANDS, ruling 0.5): an admin saves ONE product's bands. Returns the
 * merged settings with only that product's list changed, in the stored shape
 * (a start the editor sent as text becomes a whole number), or throws:
 *
 * - BAD_PRODUCT for a product the catalog does not price;
 * - BAD_BANDS for a set breaking a spec 3.2 rule, its message the FIRST
 *   problem and `problems` every one, in the editor's own wording (TB-6).
 */
export function mergeBandsChange(current, product, bands, costs) {
  if (typeof product !== 'string' || !(product in costs)) {
    throw new TermPricingError('BAD_PRODUCT', `No catalog product ${JSON.stringify(product)} to set bands for.`)
  }
  const v = validateBands(bands)
  if (!v.ok) throw Object.assign(new TermPricingError('BAD_BANDS', v.problems[0].message), { problems: v.problems })
  const merged = {
    ...current,
    VOLUME_BANDS_BY_PRODUCT: { ...current.VOLUME_BANDS_BY_PRODUCT, [product]: v.bands },
  }
  normaliseParams(buildParams(merged, costs))
  return merged
}
