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
import { workingVersionLabel } from './version-label.js';
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
export function workingVersionOf(latest, payload) {
  if (!latest || !Number.isInteger(latest.major)) return null;
  const moved = pricingChanged(latest.inputs, payload);
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
