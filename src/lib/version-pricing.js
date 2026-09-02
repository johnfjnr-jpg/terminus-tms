/**
 * IS AN ISSUED VERSION STILL THE PRICE ON SCREEN?
 *
 * Round 41, after the seventh walk. The business's architectural point, and it
 * is the reason this module exists at all:
 *
 *   A deal sheet version is its own object with its own lifecycle, and "has this
 *   changed since issue" must be answered against PRICING state alone, never
 *   against the opportunity record's revision.
 *
 * ── WHAT WAS THERE BEFORE, AND WHY IT WAS WRONG ───────────────────────────
 *
 * Two surfaces subtracted revision numbers: `issuedProposal` for the moved-on
 * notice and `versionApprovalState` for the approval state. Both read
 * `deal_sheet_versions.revision_number`, which is a pointer into the
 * OPPORTUNITY's sequence - and that sequence moves for reasons the version does
 * not care about.
 *
 * MEASURED ON TT-SGP-SMARTC-112: eleven revisions landed after V1 was issued and
 * NOT ONE touched a pricing field. Nine were exit-criteria ticks and assessment
 * reviews - the record being worked, which is what the workflow asks for.
 *
 * AND THE ELEVENTH WAS THE ISSUE ITSELF. `proposalIssued` is written by the
 * issue route 674 milliseconds after the version is issued, so issuing a version
 * advanced the revision and marked that version superseded by its own act.
 *
 * The no-delta refusal added earlier in this round already asked the right
 * question - `payloadsDiffer` over version inputs - which is the instrument
 * reused here rather than a second one invented beside it.
 *
 * ── THE LINE BETWEEN DECISION AND FROZEN RATE, RECORDED NOT IMPLICIT ──────
 *
 * Ruled by the business: "changed" means a pricing DECISION changed. A catalog
 * batch turning over does NOT supersede an issued version - the rates are a
 * default applied at creation, and after that the opportunity owns its price.
 *
 * THE LINE IS MEASURED RATHER THAN JUDGED, and the measurement is the
 * definition: a version's `inputs` carries 32 keys, and SIX of them are never
 * stored on the record at all. They are resolved from the catalog at price time
 * and frozen into the version:
 *
 *   ssUnitCost, aqUnitCost, hemirUnitCost     hardware unit costs
 *   hoSafesight, hoAqm, hoHemir               hosting per month
 *
 * The other 26 the record owns, including the four INSTALLATION rates
 * (inSsExisting, inSsNew, inAqm, inHemir). Those look like catalog rates and are
 * not: they are seeded from Base Cost Data and then stored, editable and
 * overridable per opportunity, so changing one IS a decision.
 *
 * NAMED AS AN OUT-SET, NOT AN IN-SET, and that is deliberate. A pricing input
 * added in a later round is automatically INSIDE the comparison, so the failure
 * mode is "a new field supersedes a version when perhaps it should not", which
 * somebody notices. An in-set would fail the other way: a new field silently
 * ignored, and a version reading current while the price had moved.
 *
 * THE `rates` COLUMN IS OUT ENTIRELY. It is the frozen catalog and holds no
 * decision.
 *
 * `sections` IS OUT TOO, and this is where the business's "only if something
 * changes the calculation" clause lands. Every figure in `sections` is derived
 * from decisions AND rates together, so comparing it would re-admit the batch
 * turnover through the back door - a rate moves, every derived figure moves, and
 * the version reads superseded for a decision nobody took. The clause is served
 * instead by the decision keys: a person who responds to a rate change by
 * overriding a margin has changed `marginOverrides`, which IS in the comparison.
 *
 * WHAT THAT LEAVES UNCAUGHT, stated rather than hidden: a catalog turnover with
 * no human response changes the customer price without superseding the issued
 * version. That is the ruled behaviour, and the cost-basis line on the approval
 * page is what tells an approver the rates have aged.
 *
 * ── NO MIGRATION, AND NOTHING ABOUT VERSION HISTORY CHANGES ───────────────
 *
 * The comparison is computed at read time from data every version already
 * carries, so it works identically for the 882 pre-workflow rows. Their
 * `revision_number` is simply no longer the thing read. The table, the
 * snapshots, the major/minor sequence, sub-version drafts, immutability and the
 * governance trail are untouched.
 */
import { payloadsDiffer, changedKeys } from './payload-diff.js';
import { CATALOG_ONLY_RATE_KEYS } from './rate-resolution.js';

/**
 * The keys a version freezes from the catalog and the record never stores.
 *
 * ── NOT A SECOND LIST. Verification 20 ─────────────────────────────────────
 *
 * This was first written here as its own six-element array, and that was a
 * second reader of a value the resolver already owns: the same six, spelled the
 * same way, in a file that would not be edited when a catalog key was added.
 *
 * `CATALOG_ONLY_RATE_KEYS` already carries exactly this meaning - the rates the
 * opportunity does NOT own - and its four-element sibling `OVERRIDABLE_RATE_KEYS`
 * carries the opposite one. The line this module draws is therefore the line the
 * resolver already draws, and a round that adds a catalog rate updates one list.
 *
 * Verification 19: the property was measured before the name was trusted. Every
 * live opportunity's current payload was read; these six appear in none of them,
 * and the other 26 keys of a version snapshot appear.
 */
export const FROZEN_RATE_KEYS = Object.freeze([...CATALOG_ONLY_RATE_KEYS]);

/** The pricing decisions out of a version's inputs or a record's payload. */
export function decisionState(source) {
  const out = {};
  for (const [k, v] of Object.entries(source ?? {})) {
    if (FROZEN_RATE_KEYS.includes(k)) continue;
    out[k] = v;
  }
  return out;
}

/**
 * Has the priced deal moved since this version was taken?
 *
 * COMPARED OVER THE VERSION'S OWN KEYS, not over the record's. A record payload
 * carries exit criteria, assessment series, contact links and dates, none of
 * which are pricing: comparing whole payloads would reproduce the defect this
 * replaces with extra steps.
 *
 * ── AND IT REFUSES TO ANSWER WITH NOTHING ON ONE SIDE. Verification 14 ────
 *
 * The comparison runs over the SNAPSHOT's keys, so a version with no snapshot
 * has no keys, and `payloadsDiffer({}, {})` is false. That reads as "the price
 * has not moved" - a confident all-clear derived from an empty comparison, on
 * exactly the surface where somebody approves a price.
 *
 * Measured 2026-09-02: all 400 rows carry a snapshot, so this is a guard rather
 * than a fix. It is here because the previous rule ANSWERED for those rows,
 * badly, and this one would have answered for them silently.
 *
 * @param {object} versionInputs - deal_sheet_versions.inputs
 * @param {object} recordPayload - the record's current payload
 * @returns {{ changed: boolean, keys: string[], comparable: boolean }}
 */
export function pricingChanged(versionInputs, recordPayload) {
  const was = decisionState(versionInputs);
  if (!Object.keys(was).length || recordPayload === undefined || recordPayload === null) {
    return { changed: false, keys: [], comparable: false };
  }
  const now = {};
  for (const k of Object.keys(was)) now[k] = recordPayload[k];
  return { changed: payloadsDiffer(now, was), keys: changedKeys(now, was), comparable: true };
}

/**
 * The changed keys as a phrase, capped at three and counting the rest.
 *
 * ONE FORMATTER, THREE CALLERS. Verification 20: the transition refusal, the
 * approval evaluator's reason and the browser's version line all name the same
 * list, and three hand-rolled slice-and-join expressions would agree today and
 * drift the first time the cap changes. The phrase is a fragment rather than a
 * sentence because its three callers put it in three different places: W-K
 * ruled the transition refusal must LEAD with the action, so nothing here may
 * assume it comes first.
 *
 * @param {string[]} keys
 * @returns {string} e.g. "contractValue, targetMargin and 2 more"
 */
export function namedChangedKeys(keys) {
  const list = keys ?? [];
  const named = list.slice(0, 3).join(', ');
  return list.length > 3 ? `${named} and ${list.length - 3} more` : named;
}
