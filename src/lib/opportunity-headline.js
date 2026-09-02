/**
 * The figures an Opportunity is judged by at a glance.
 *
 * ── ONE COMPUTATION PATH, SERVER SIDE ─────────────────────────────────────
 *
 * The banner on the record and the column in the list ask for the same numbers,
 * and Verification 20 is explicit that a second reader of one value always
 * drifts. So they are computed here, once, and both surfaces read the result
 * rather than each running the calculator its own way.
 *
 * TOTAL CONTRACT VALUE IS `contractNet`, and it is not a new derivation: it is
 * what the Deal Sheet already prints as "Revenue, contract value net" and what
 * achieved margin is computed against. Naming a different number "Total Contract
 * Value" on the banner would put two contract values on one record.
 *
 * WEIGHTED IS COMPUTED, NEVER STORED, per Architecture 2. It is TCV x
 * probability, and it is null whenever either input is absent rather than 0:
 * a weighted value of zero is a claim that the deal is worth nothing, and
 * "nobody has set a probability" is a different statement (Architecture 11's
 * shape - a missing value is not a value).
 */
import { calculateDeal } from './deal-calculator.js';
import { buildDealInputs } from './deal-inputs.js';
import { resolveRates } from './rate-resolution.js';

/**
 * @param {object} payload    the record's current payload
 * @param {object} catalog    resolved catalog rates, from catalogToRates()
 * @param {number} testBedCost
 * @returns {number|null} the net contract value, or null when it cannot be computed
 */
export function totalContractValue(payload, catalog, testBedCost = 0) {
  if (!payload || !catalog) return null;
  try {
    const { rates } = resolveRates(payload, catalog);
    const result = calculateDeal(buildDealInputs(payload, { testBedCost, rates }));
    const net = result?.totals?.contractNet;
    if (!Number.isFinite(net)) return null;
    // ── ZERO IS NOT A CONTRACT VALUE, IT IS AN UNPRICED DEAL ─────────────
    //
    // The calculator returns 0 for a payload carrying no units, no lump sum and
    // no hosting, which is every opportunity nobody has priced yet. Rendering
    // that as "$0" puts a confident figure where there is no figure, and
    // CLAUDE.md rule 10 records this exact fault: one card carrying a bright
    // zero and a dim zero, meaning a value and a placeholder.
    //
    // A deal genuinely worth nothing is not a state this business has, so the
    // ambiguity costs nothing to resolve this way and the screen says "--".
    return net === 0 ? null : net;
  } catch {
    // A payload the calculator cannot price is not an error worth failing a
    // LIST over. It reads as "no value yet", which is what an unpriced deal is.
    return null;
  }
}

/**
 * TCV x probability. Null when either side is missing.
 *
 * @param {number|null} tcv
 * @param {number|null} probabilityPct
 * @returns {number|null}
 */
export function weightedValue(tcv, probabilityPct) {
  if (!Number.isFinite(tcv)) return null;
  if (!Number.isFinite(probabilityPct)) return null;
  return tcv * (probabilityPct / 100);
}

/**
 * The version a proposal is currently at: the highest ISSUED major.
 *
 * Ordered by (major, minor), the version's own sequence, never by
 * revision_number - Round 41 established that a version-to-version question
 * must not be answered with the opportunity's counter.
 *
 * Returns null when nothing has been issued, which the screen renders as "none"
 * rather than as a blank: a blank reads as "not loaded".
 *
 * @param {Array<{status: string, major: number, minor: number}>} versions
 * @returns {number|null}
 */
export function issuedMajor(versions) {
  const issued = (versions ?? [])
    .filter((v) => v.status === 'issued' && Number.isInteger(v.major))
    .sort((a, b) => (b.major - a.major) || ((b.minor ?? 0) - (a.minor ?? 0)))[0];
  return issued ? issued.major : null;
}
