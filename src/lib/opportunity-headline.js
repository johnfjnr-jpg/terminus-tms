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
import { pricingChanged } from './version-pricing.js';
import { workingVersionLabel, versionLabel } from './version-label.js';
import { WON_STAGE } from './pricing-keys.js';
import { contractValueOf } from './contract-value.js';
// TERM_QUOTES: the term quote's value through its one gateway (R-TP1), and the
// method and kind through their one reading.
import { termQuoteValue, quoteFigures } from './term-quote.js';
import { pricingMethodOf, versionKindOf } from './pricing-method.js';
// R-L4a: the evaluator the ENFORCEMENT calls, asked rather than re-derived.
import { versionApprovalState, wasSigned } from './version-approval.js';

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
    // ZERO IS NOT A CONTRACT VALUE, IT IS AN UNPRICED DEAL. The rule and its
    // reasoning live in ONE place, src/lib/contract-value.js (CONTRACT_VALUE
    // ruling 2), which the Commercials cell and statement now call too.
    return contractValueOf(result?.totals?.contractNet);
  } catch {
    // A payload the calculator cannot price is not an error worth failing a
    // LIST over. It reads as "no value yet", which is what an unpriced deal is.
    return null;
  }
}

/**
 * ── TERM_QUOTES P6 (John 2026-11-20): THE HEADLINE BY METHOD ─────────────
 *
 * The record's working inputs for ITS method, priced live (spec v2.1, 14.4):
 *   - commercials: the deal-sheet engine over the record, exactly as before;
 *   - term_quote:  the term engine over `termQuote` on TODAY's settings,
 *     reporting Base TCV, in dollars through the one adapter.
 * The method decides, so a stray termQuote on a Commercials record is not
 * priced, and an absent method is Commercials (W). Unpriced either way is null.
 *
 * @param {object} payload the record's current payload
 * @param {{ catalog?: object, termParams?: object, testBedCost?: number }} sources
 * @returns {number|null}
 */
export function headlineTcv(payload, { catalog = null, termParams = null, testBedCost = 0 } = {}) {
  if (pricingMethodOf(payload) === 'term_quote') {
    return termParams ? termQuoteValue(payload?.termQuote, termParams).tcv : null;
  }
  return catalog ? totalContractValue(payload, catalog, testBedCost) : null;
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
/**
 * ── P6: THE WORKING VERSION. John's walk 2026-09-27 ──────────────────────
 *
 * The record's own pricing state, said in one line beside the approved one.
 * Server side for the same reason every other headline figure is: the browser
 * formats, it does not calculate (Verification 20).
 *
 * THE MOVEMENT IS THE EXISTING SUPERSESSION MACHINERY, not a second opinion.
 * `pricingChanged` is what `version-approval.js` and `transition-requests.js`
 * already ask whether a version has been overtaken, so the field cannot
 * disagree with the gate about whether this record has moved.
 *
 * NOT COMPARABLE IS NOT MOVED. `pricingChanged` reports `comparable: false`
 * when the version predates the keys it would compare, and an incomparable
 * version is not evidence of an edit. Saying "Under Edit" on a record nobody
 * has touched would be the wrong-green of Round 38 inverted: a wrong RED,
 * which teaches somebody to ignore the field.
 *
 * @param {{ status?: string, major: number, minor: number, inputs?: object } | null} latest
 * @param {object} payload the record's current payload
 * @returns {string | null}
 */
// ── FROZEN_FIGURES R-FF4 (John, 2026-11-17): A WON DEAL SHOWS ITS WON VERSION ─
//
// A Closed Won record's contract value is the WON version's, which the raise
// into Closed Won froze into the request (`frozen_version_id`, derived by the
// database, Architecture 12). Catalog and engine changes do not move it.
//   - the won version froze its figures: they stand, labelled as its;
//   - it was submitted before figures were frozen (R-FF6): its OWN inputs at
//     its OWN frozen rates, which no catalog can move, labelled as recomputed;
//   - there is no won version: today's figures, with the ruled sentence.
// Any other stage: today's figures, and nothing to say.
export const NO_WON_VERSION_NOTE = "No approved version was won; these are today's figures.";

export function wonHeadline({ status, wonVersion, liveTcv, testBedCost = 0 }) {
  if (status !== WON_STAGE) return { tcv: liveTcv, note: null, source: 'live' };
  if (!wonVersion) return { tcv: liveTcv, note: NO_WON_VERSION_NOTE, source: 'live' };
  const label = versionLabel(wonVersion);
  // TERM_QUOTES P6: a won TERM version reads its own Base TCV, frozen or, for
  // a version somehow submitted unfrozen, priced on the settings stored with
  // it (spec 14.6). Either way no live setting can move it.
  if (versionKindOf(wonVersion) === 'term_quote') {
    if (wonVersion.frozen_figures) {
      return {
        tcv: quoteFigures(wonVersion.frozen_figures.result).baseTcv,
        note: `The won version's figures (${label}), frozen when it was submitted.`,
        source: 'won-version',
      };
    }
    const priced = termQuoteValue(wonVersion.inputs, wonVersion.rates?.params ?? null);
    return priced.refusal
      ? { tcv: null, note: `The won version (${label}) could not be priced.`, source: 'won-version-legacy' }
      : { tcv: priced.tcv, note: `The won version's figures (${label}), priced on the settings stored with it.`, source: 'won-version-legacy' };
  }
  if (wonVersion.frozen_figures) {
    return {
      tcv: contractValueOf(wonVersion.frozen_figures.result?.totals?.contractNet),
      note: `The won version's figures (${label}), frozen when it was submitted.`,
      source: 'won-version',
    };
  }
  try {
    const { rates } = resolveRates(wonVersion.inputs ?? {}, wonVersion.rates?.rates ?? {});
    const result = calculateDeal(buildDealInputs(wonVersion.inputs ?? {}, { testBedCost, rates }));
    return {
      tcv: contractValueOf(result?.totals?.contractNet),
      note: `The won version's figures (${label}), recomputed by today's engine: it was submitted before figures were frozen.`,
      source: 'won-version-legacy',
    };
  } catch {
    return { tcv: null, note: `The won version (${label}) could not be priced.`, source: 'won-version-legacy' };
  }
}

/**
 * The won version of each Closed Won record: the version frozen into its
 * approved raise into Closed Won (the newest, if somehow several). Two reads
 * for any number of records; no read at all when none is won.
 */
export async function wonVersionsOf(db, recordIds) {
  const out = new Map();
  if (!recordIds.length) return out;
  const { data: reqs, error: rErr } = await db.from('transition_requests')
    .select('record_id, frozen_version_id, closed_at')
    .in('record_id', recordIds).eq('to_stage', WON_STAGE).eq('status', 'approved')
    .order('closed_at', { ascending: false });
  if (rErr) throw new Error(`won requests: ${rErr.message}`);
  const versionOf = new Map();
  for (const r of reqs ?? []) if (!versionOf.has(r.record_id)) versionOf.set(r.record_id, r.frozen_version_id ?? null);
  const ids = [...versionOf.values()].filter(Boolean);
  if (!ids.length) return out;
  const { data: vs, error: vErr } = await db.from('deal_sheet_versions')
    .select('id, record_id, kind, major, minor, status, inputs, rates, frozen_figures').in('id', ids);
  if (vErr) throw new Error(`won versions: ${vErr.message}`);
  for (const v of vs ?? []) out.set(v.record_id, v);
  return out;
}

export function workingVersionOf(latest, payload) {
  if (!latest || !Number.isInteger(latest.major)) return null;
  const moved = pricingChanged(latest, payload);
  return workingVersionLabel({
    version: latest,
    draftSaved: latest.status !== 'issued',
    editedSince: moved.comparable ? moved.changed : false,
  });
}

export function issuedMajor(versions) {
  const issued = (versions ?? [])
    .filter((v) => v.status === 'issued' && Number.isInteger(v.major))
    .sort((a, b) => (b.major - a.major) || ((b.minor ?? 0) - (a.minor ?? 0)))[0];
  return issued ? issued.major : null;
}

/**
 * ── R-L4a: THE APPROVED VERSION, WHICH IS NOT THE PROMOTED ONE ───────────
 *
 * Ruled by John 2026-09-29, after Phase 0 measured what actually set the field.
 *
 * `issuedMajor` above is the highest major whose STATUS is `issued`, and that
 * status is written by PROMOTION - the control that turns the newest draft into
 * a major. **No approval track enters it.** So the field labelled "Approved
 * version" was naming a version that had been submitted and might be waiting on
 * all three tracks, or refused on one.
 *
 * That is the wrong-green Round 38 recorded, on a headline figure: a green
 * display is a POSITIVE CLAIM, and "Approved version V2.0" said a named person
 * had accepted that price when nobody had.
 *
 * ── APPROVED MEANS EVERY REQUIRED TRACK, NOT ANY ─────────────────────────
 *
 * A version with Commercial signed and Legal outstanding is not approved. It is
 * awaiting approval, and the Approvals panel is where that state belongs.
 *
 * ── IT ASKS THE EVALUATOR THE GATE ASKS ──────────────────────────────────
 *
 * `versionApprovalState` is the function the enforcement calls, so the headline
 * and the gate cannot disagree about what approved means (Verification 43: name
 * the function the enforcement calls, and confirm the panel calls it too). This
 * does not re-derive it; it asks it once per track.
 *
 * ── R-AV: THE STORED MINOR IS CARRIED THROUGH ────────────────────────────
 *
 * It returns the VERSION, not a major, so the composer prints the minor the row
 * actually holds. Deriving `.0` from "an approved version is always x.0" would
 * be a second reader of the numbering rule, correct today and silently wrong the
 * first time that rule moved.
 *
 * @param {object} a
 * @param {Array} a.versions   every deal_sheet_versions row for the record
 * @param {Array} a.approvals  approvals already linked to versions
 * @param {number} a.latestRevision
 * @param {string[]} a.tracks  the version-scoped tracks this record type needs
 * @param {object} a.payload   the record's current payload
 * @returns {{ major: number, minor: number } | null} null when none is approved
 */
export function approvedVersionOf({ versions, approvals, latestRevision, tracks, payload }) {
  // NO TRACKS IS NOT "EVERYTHING IS APPROVED". An empty required set would make
  // `every` vacuously true and report the newest version as approved by nobody,
  // which is the exact claim this function exists to stop making.
  if (!Array.isArray(tracks) || tracks.length === 0) return null;
  const approved = (versions ?? [])
    .filter((v) => v.status === 'issued' && Number.isInteger(v.major))
    // ONE PREDICATE, shared with `lastApprovedVersion`, which had already ruled
    // this question: a sign-off is a sign-off, and the deal moving afterwards is
    // reported beside it rather than deleting it. Verification 23: search for an
    // existing decision about the same behaviour before taking a new one.
    .filter((v) => tracks.every((t) =>
      wasSigned(versionApprovalState(v, approvals, latestRevision, t, payload).state)));
  if (!approved.length) return null;
  // Highest (major, minor), the same ordering `issuedMajor` uses.
  return approved.sort((a, b) => (b.major - a.major) || ((b.minor ?? 0) - (a.minor ?? 0)))[0];
}
