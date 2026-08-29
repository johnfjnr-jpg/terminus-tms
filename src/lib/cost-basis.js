/**
 * How old a cost basis is, what that means, and the words for saying so.
 *
 * ONE MODULE BECAUSE TWO SURFACES NEED IT, and CLAUDE.md Verification 20 is
 * about what happens when they each write their own. The approval page shows an
 * approver what they are accepting. The Commercials reference panel shows a
 * SALESPERSON the rates they are pricing against, and they see them first: they
 * are the earliest person who could act on an ageing basis, before any approver
 * is involved. Same bands, same words, earlier.
 *
 * So the bands, the thresholds and the sentences all live here. A surface picks
 * which of them to show and how loudly; none of them invents its own.
 *
 * ─────────────────────────────────────────────────────────────
 * THE THRESHOLDS ARE JUDGEMENT, NOT EVIDENCE, AND THEY MUST NOT HARDEN
 * ─────────────────────────────────────────────────────────────
 *
 * Set by the business on 2026-08-29. `base_cost_batches` carries effective_from
 * and NO end date, so a batch never lapses and cost data ages indefinitely while
 * the system treats that as normal. Showing the date is necessary and not
 * sufficient: an approver signing 36 months against a basis nobody has revisited
 * since last year is taking that risk silently.
 *
 * THERE WAS NO EVIDENCE TO ARGUE WITH. The catalog holds exactly one batch per
 * product, all dated 2026-08-27, so this system contains no price history and
 * cannot yet say how fast hardware or hosting costs actually move. These numbers
 * are commercial judgement, recorded as such rather than dressed up as analysis.
 *
 * WHAT REPLACES THEM, AND WHAT HAS TO EXIST FIRST:
 *
 *   WHAT HAS TO EXIST: a SECOND batch for any product. One row per product is a
 *   snapshot; two is the first interval, and the data arrives on its own the
 *   first time somebody enters new costs. Nothing needs to be built to collect
 *   it.
 *
 *   WHAT IT BECOMES: measured drift per product. With two or more batches, the
 *   change per unit cost over the days between them is a real number, and the
 *   question "how long does this price hold" stops being an opinion. A product
 *   whose cost moved 2% in a year and one that moved 30% do not deserve the same
 *   six-month band, and per-product bands are the obvious end state.
 *
 *   WHERE IT SHOULD LIVE: configuration rows, not this constant. Architecture
 *   rule 2 - approval routing and gate rules are database rows. There is no
 *   configuration surface for Commercials yet, so this is the interim single
 *   point, dated and locked by a golden so a threshold cannot move without its
 *   date moving.
 *
 * The trigger to revisit is therefore a data event rather than a calendar one:
 * the first product to receive a second batch.
 */

export const COST_BASIS_STALENESS = {
  setOn: '2026-08-29',
  basis: 'commercial judgement, no price history available to measure against',
  replacedWhen: 'any product has a second batch, which makes drift measurable per product',
  bands: [
    {
      band: 'current',
      maxDays: 182,
      meaning: 'Under six months. Normal.',
      statement: 'This cost basis is current.',
    },
    {
      band: 'ageing',
      maxDays: 365,
      meaning: 'Six to twelve months. Shown as an assumption being accepted.',
      statement: 'This cost basis is between six and twelve months old. '
        + 'It is an assumption being accepted, not a current price.',
    },
    {
      band: 'stale',
      maxDays: Infinity,
      meaning: 'Over twelve months. Approval requires explicit acknowledgement that the basis is stale.',
      statement: 'This cost basis is over twelve months old. '
        + 'Approving against it accepts prices nobody has revisited in that time, '
        + 'and requires explicit acknowledgement that the basis is stale.',
    },
  ],
};

const UNDATED = {
  band: 'undated',
  meaning: 'This batch carries no effective date.',
  statement: 'This batch carries no effective date, so its age is unknown. '
    + 'An unknown age is not a current one.',
};

/**
 * Which band an age in days falls in.
 *
 * A null age is its own answer rather than a band. The zero-versus-missing shape
 * again: an undated batch must not fall into the band that needs no action.
 */
export function stalenessBand(ageDays) {
  if (!Number.isFinite(ageDays)) return UNDATED;
  return COST_BASIS_STALENESS.bands.find((b) => ageDays <= b.maxDays);
}

/**
 * How old a batch is, MEASURED AGAINST as_of RATHER THAN TODAY.
 *
 * as_of is the date the catalog was resolved for, and it is settable: a
 * historical question asks the catalog what it held on some past day. Ageing
 * against today would make every batch look stale inside a query where it was
 * current, which turns a legitimate historical read into a page full of false
 * warnings.
 *
 * In every path that exists as_of IS today, because nothing passes the
 * parameter. That is exactly why this has to be written down rather than left to
 * coincide.
 *
 * @param {string} effectiveFrom - YYYY-MM-DD, or a timestamp
 * @param {string} asOfISO - YYYY-MM-DD the catalog was resolved for
 * @returns {number|null}
 */
export function ageInDays(effectiveFrom, asOfISO) {
  if (!effectiveFrom || !asOfISO) return null;
  const from = new Date(`${String(effectiveFrom).slice(0, 10)}T00:00:00Z`);
  const asOf = new Date(`${String(asOfISO).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(asOf.getTime())) return null;
  return Math.round((asOf - from) / 86400000);
}
