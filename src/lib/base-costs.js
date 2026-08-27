/**
 * Base Cost Data: resolving a batch, and mapping the catalog onto the deal's
 * rate keys. Round 36 Phase 2.
 *
 * Lives in src/lib/ and is served at /lib/base-costs.js, the same arrangement
 * deal-calculator.js already uses, so the Commercials tab's live preview and
 * the server's authoritative recompute run the SAME FILE rather than two
 * copies. Round 36 Phase 0 found what the alternative costs: the tab and
 * deals.js each carried their own payload-to-inputs mapping, described in
 * comments as "glue code, allowed to be duplicated", and they agreed only
 * because both read zero.
 *
 * No DOM, no database client, no fetch. Callers supply rows.
 */

/**
 * The three catalog product keys, and the payload rate keys each one feeds.
 *
 * THIS IS THE ONE PLACE the catalog's readable keys meet the ss/aq/hemir
 * prefixes the payload and the markup use. The migration promised exactly that:
 * admin maintains rows by hand in the Supabase editor, so the stored key is a
 * word, and the translation happens once here rather than at every reader.
 *
 * Round 37 Phase 1: install_cost_existing and install_cost_new are mapped here
 * too. Round 36 left them out deliberately, and the business found the
 * consequence on first use: selecting "Terminus Contractor - Per Unit" priced
 * installation at $0 on every deal, because the four rate inputs had no source.
 *
 * SafeSight maps cleanly, two catalog figures onto the two rows the tab already
 * has. AQ Sensor and HEMIR have TWO catalog figures and ONE row each, so the
 * mapping has to choose, and choosing silently is what this project keeps
 * recording as the expensive mistake.
 *
 * THEY TAKE install_cost_existing, AND THE ROWS SAY SO. The labels read "AQ
 * Sensor, existing infra" and "HEMIR, existing infra", matching the convention
 * the two SafeSight rows already use, so the basis of the figure is on the
 * screen beside the figure rather than buried here. A reader who disagrees with
 * the choice can see that a choice was made.
 *
 * The new-infrastructure figures for those two products, $1,000 and $10,000,
 * are carried by the catalog and reach no row. That is unresolved and belongs
 * with the Installation tab, which is where the business decides whether a deal
 * records infrastructure per product or only for SafeSight.
 */
export const PRODUCT_RATE_KEYS = {
  safesight: {
    unitCost: 'ssUnitCost',
    hosting: 'hoSafesight',
    // The only product whose two catalog figures both have a row.
    installExisting: 'inSsExisting',
    installNew: 'inSsNew',
  },
  air_quality: {
    unitCost: 'aqUnitCost',
    hosting: 'hoAqm',
    installExisting: 'inAqm',
  },
  hemir: {
    unitCost: 'hemirUnitCost',
    hosting: 'hoHemir',
    installExisting: 'inHemir',
  },
};

/**
 * Given every batch row at or before a date, returns the current batch per
 * product: the latest effective_from that has passed.
 *
 * Sorts internally rather than trusting the caller's ordering. The route
 * already asks the database for effective_from descending, but a function that
 * silently depends on its input being pre-sorted is one refactor away from
 * picking an arbitrary batch, and the cost of sorting three rows is nothing.
 *
 * Rows with effective_from AFTER asOf are dropped here as well as in the
 * query. That is the business's confirmed-intended consequence stated twice:
 * entering next quarter's prices must not reprice today's deals.
 *
 * @param {Array<object>} rows - batch rows, any order
 * @param {string} asOf - YYYY-MM-DD
 * @returns {Array<object>} one row per product, numeric fields coerced
 */
export function resolveCurrentBatches(rows, asOf) {
  const eligible = (rows ?? [])
    .filter((r) => r.effective_from <= asOf)
    // String compare is correct and intentional for YYYY-MM-DD, which sorts
    // lexicographically exactly as it sorts chronologically. Date parsing here
    // would introduce a timezone the database does not have.
    .sort((a, b) => b.effective_from.localeCompare(a.effective_from));

  const current = [];
  const seen = new Set();
  for (const row of eligible) {
    if (seen.has(row.product)) continue;
    seen.add(row.product);
    current.push({
      product: row.product,
      batch_id: row.id,
      batch_label: row.batch_label,
      effective_from: row.effective_from,
      // Postgres numeric arrives as a string, because it has no lossless JSON
      // form. Coerced once, here. Round 36 Phase 0 found Test Bed's own rates
      // stored as strings in the payload and nobody noticing, because
      // "8000" * 10 happens to work in JavaScript and "8000" + 10 does not.
      unit_cost: Number(row.unit_cost),
      install_cost_existing: Number(row.install_cost_existing),
      install_cost_new: Number(row.install_cost_new),
      hosting_cost_month: Number(row.hosting_cost_month),
    });
  }
  return current;
}

/**
 * Turns resolved catalog products into the flat rate keys the deal payload,
 * the calculator and the markup all use.
 *
 * A product missing from the catalog is ABSENT from the result rather than
 * present as 0. The caller decides what an absent rate means; this function
 * will not manufacture a zero that is indistinguishable from a real one. That
 * distinction is the whole finding of Round 36 Phase 0: the tab displayed $0
 * for costs that did not exist, and no figure on screen could tell a genuine
 * zero from a missing input.
 *
 * @param {Array<object>} products - output of resolveCurrentBatches()
 * @returns {{rates: object, missing: string[], batches: object}}
 */
export function catalogToRates(products) {
  const rates = {};
  const batches = {};
  const missing = [];

  for (const [product, keys] of Object.entries(PRODUCT_RATE_KEYS)) {
    const row = (products ?? []).find((p) => p.product === product);
    if (!row) {
      missing.push(product);
      continue;
    }
    rates[keys.unitCost] = row.unit_cost;
    rates[keys.hosting] = row.hosting_cost_month;
    // Only assigned where the product has a row for it. A product with no
    // new-infrastructure row does not get a key invented for it, because an
    // invented key is a number nothing on screen accounts for.
    if (keys.installExisting) rates[keys.installExisting] = row.install_cost_existing;
    if (keys.installNew) rates[keys.installNew] = row.install_cost_new;
    batches[product] = { batch_id: row.batch_id, batch_label: row.batch_label, effective_from: row.effective_from };
  }

  return { rates, missing, batches };
}
