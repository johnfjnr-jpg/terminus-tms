/**
 * The numeric payload boundary. Round 38, before the Phase 2 reshape.
 *
 * Lives in src/lib/ and is served at /lib/numeric-payload.js, the arrangement
 * deal-calculator.js and base-costs.js already use, so the browser and the
 * server share one file rather than two copies that agree today.
 *
 * ─────────────────────────────────────────────────────────────
 * THE PRINCIPLE
 * ─────────────────────────────────────────────────────────────
 *
 * REPRESENTATIONAL VARIANCE IN AN APPEND-ONLY STORE IS ABSORBED AT THE READ
 * BOUNDARY, NOT CORRECTED BY REWRITING THE STORE.
 *
 * record_revisions is append-only and immutable, and its value as an audit
 * trail is the guarantee that nothing rewrites it. Rewrite it once for a good
 * reason and it becomes a convention rather than a guarantee, and no later
 * reader can verify which rows were touched. Being reachable as the table owner
 * is not permission.
 *
 * So: every reader comes through toNumberOrNull(), the variance already in the
 * store becomes permanently harmless, and no migration touches history.
 *
 * ─────────────────────────────────────────────────────────────
 * WHAT WAS MEASURED, 2026-08-28
 * ─────────────────────────────────────────────────────────────
 *
 * Across all 17,618 record_revisions, paged over the whole table:
 *
 *   159 of the twelve numeric keys hold a numeric STRING, 241 hold a number.
 *   Distinct string values: "4", "6", "12", "12.75", "18", "24", "36".
 *   Zero hold an empty string. All 159 would survive (value)::numeric.
 *   16 sit in a CURRENT revision, 143 in superseded ones.
 *
 * TWO WRITERS, AND ONLY ONE WAS LIVE:
 *
 *   duration, 49 of them, from opportunity-reference.js. Contract Duration is
 *   a Reference tab field, and performGenericRefSave assigns the input's raw
 *   .value, which is always a string. Every save from that tab wrote "36".
 *   FIXED in the same change as this file: the mixed state was still growing.
 *
 *   The other eleven keys sit on ONE soft-deleted record with no reference
 *   code, values "4" and "12.75". No file in the repository contains 12.75, so
 *   no shipping path produced them. Residue from ad-hoc probing.
 *
 * NOTHING CASTS THESE VALUES IN SQL TODAY: zero ::numeric, ::int or ::float
 * anywhere, and zero payload->> in any migration or route. Every read is
 * JavaScript. The hazard is prospective, which is why the sentinel is fixed
 * now rather than after the forecast layer exists.
 */

/**
 * The twelve numeric keys the Commercials tab writes, all of which are in
 * SALESPERSON_WRITABLE_KEYS, so a coerced value on any of them reaches the
 * record.
 *
 * `duration` is in this list AND is editable on the Reference tab, which is
 * why the guard below is applied at the server rather than only in one screen.
 */
export const WRITABLE_NUMERIC_KEYS = [
  'ssExisting', 'ssNew', 'aqm', 'hemir',
  'lumpSumCost',
  'targetMargin', 'warrantyPct', 'whtPct', 'gstPct', 'fxContingency',
  'duration', 'recoveryMonths',
];

/**
 * THE READ BOUNDARY. Every reader of a numeric payload value comes through
 * here.
 *
 * Accepts what the store actually holds and what a form actually produces:
 * a number, a numeric string, null, undefined, or an empty string. Returns a
 * number or null. Never returns 0 for an absent value, which is the whole
 * point: a blank box and a genuine zero are different facts, and this project
 * has now met the consequence of conflating them three times.
 *
 * @param {unknown} value
 * @returns {number|null}
 */
export function toNumberOrNull(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * THE WRITE BOUNDARY. What may be stored on one of the twelve keys.
 *
 * A number or null, and nothing else. Not a numeric string, which is what the
 * Reference tab used to send, and not an empty string, which is an INPUT
 * convention rather than a storage one: `(payload->>'key')::numeric` returns
 * NULL for a JSON null and ERRORS on '' with invalid input syntax for numeric.
 * The forecast reporting this build is heading toward will cast these values in
 * SQL, and an empty string turns a blank margin into a query that throws,
 * discovered months later at the reporting layer.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isStorableNumeric(value) {
  if (value === null) return true;
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Normalises the numeric keys of a payload about to be written: '' and numeric
 * strings become numbers or null, everything else is left alone.
 *
 * Applied at the input boundary, so '' is accepted from a form and never
 * reaches the store. Returns a new object; the input is not mutated.
 *
 * @param {object} payload
 * @returns {object}
 */
export function normaliseNumericPayload(payload) {
  const out = { ...(payload ?? {}) };
  for (const key of WRITABLE_NUMERIC_KEYS) {
    if (!(key in out)) continue;
    out[key] = toNumberOrNull(out[key]);
  }
  return out;
}

/**
 * THE DEFAULTS, IN ONE PLACE.
 *
 * Round 36 Phase 0 measured warrantyPct's default of 2 written into five
 * separate files and targetMargin's 30 into three. Making the calculator branch
 * explicitly on an absent value is the moment that duplication either gets
 * consolidated or gets entrenched, so it is consolidated here.
 *
 * PERCENTAGES TAKE THEIR DEFAULT WHEN ABSENT. COUNTS AND lumpSumCost TAKE 0.
 * The distinction is the point of the whole change: a deal with no unit count
 * genuinely has no units, and a deal with no target margin is not a deal priced
 * at zero margin, it is a deal priced at the house default.
 *
 * THE SUBSTITUTION IS NEVER WRITTEN BACK. These values feed the calculator and
 * the display; nothing here is persisted, and a payload that arrived without
 * targetMargin still has no targetMargin after being priced.
 */
export const NUMERIC_DEFAULTS = {
  // Percentages: absent means "use the house default".
  targetMargin: 30,
  warrantyPct: 2,
  whtPct: 0,
  gstPct: 0,
  fxContingency: 0,
  factoringRatePct: 1.5,
  // Counts and money: absent means none.
  ssExisting: 0,
  ssNew: 0,
  aqm: 0,
  hemir: 0,
  lumpSumCost: 0,
  duration: 0,
  recoveryMonths: 0,
};

/**
 * Reads a numeric payload key through the read boundary and applies the
 * configured default when it is absent.
 *
 * `defaults` is a parameter rather than a closed-over constant so a caller can
 * price against a different set without a second copy of this function, which
 * is what a version restored from an older default set will need.
 *
 * @param {object} payload
 * @param {string} key
 * @param {object} [defaults]
 * @returns {number}
 */
export function numericOrDefault(payload, key, defaults = NUMERIC_DEFAULTS) {
  const value = toNumberOrNull((payload ?? {})[key]);
  if (value !== null) return value;
  const fallback = defaults[key];
  return typeof fallback === 'number' ? fallback : 0;
}
