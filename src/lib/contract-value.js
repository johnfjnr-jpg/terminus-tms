// ── ZERO IS NOT A CONTRACT VALUE, IT IS AN UNPRICED DEAL ─────────────────
//
// ONE DEFINITION (CONTRACT_VALUE ruling 2, John 2026-11-17). The headline,
// the list column, the won-version headline, the Commercials stats cell and
// the Commercials statement all decide "is this deal priced?" here, so the
// screens cannot disagree about it. Before this round the headline answered
// it twice in one file (`net === 0` and a `nonZero` helper) and Commercials
// did not ask at all, printing "$0" where the headline printed "--" on the
// seven unpriced live deals the Phase 0 census found.
//
// The calculator returns 0 for a payload carrying no units, no lump sum and
// no hosting, which is every opportunity nobody has priced yet. Rendering that
// as "$0" puts a confident figure where there is no figure (CLAUDE.md rule 10:
// a bright zero and a dim zero meaning a value and a placeholder). A deal
// genuinely worth nothing is not a state this business has, so the ambiguity
// costs nothing to resolve this way.

/** The contract value, or null when the deal is unpriced (or unpriceable). */
export function contractValueOf(net) {
  return Number.isFinite(net) && net !== 0 ? net : null
}

// ── TERM_QUOTES (spec v2.1, 14.4): THE ONE CENTS-TO-DOLLARS ADAPTER ──────
//
// The term engine reports integer cents (BigInt, or a decimal string once
// stored); every caller of contractValueOf passes dollars. A term figure
// reaches the unpriced rule through here and nowhere else, so "is it priced"
// stays ONE definition for both methods. Exact for any whole number of cents a
// deal can reach (below 2^53 cents).

/** Integer cents (bigint, integer string or integer number) to dollars, or null. */
export function centsToDollars(cents) {
  if (cents === null || cents === undefined || cents === '') return null
  let c
  try { c = BigInt(cents) } catch { return null }
  return Number(c) / 100
}

/** contractValueOf for a figure in cents. */
export function contractValueOfCents(cents) {
  return contractValueOf(centsToDollars(cents))
}

/** What every surface prints for an unpriced deal. */
export const UNPRICED = '--'
