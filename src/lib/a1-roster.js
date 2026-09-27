// ── A1'S DECLARED POPULATION ─────────────────────────────────────────────
//
// R-A1P, John's ruling 2026-09-27: A1's walk runs against a DECLARED roster,
// not whatever it happens to parse. Every label-and-figures container the
// estate ships on the opportunity detail view is registered here, A1 asserts
// every rostered container was FOUND and MEASURED on the run, and a rostered
// container absent from the walk is a RED naming it - distinct from a gap
// failure, because they are different faults with different fixes.
//
// ── THIS IS NOT AN ENUMERATION BY NAME, AND THE DISTINCTION IS THE WHOLE
//    POINT ───────────────────────────────────────────────────────────────
//
// A1 still finds its rows BY STRUCTURE: a cell that is a label, a later cell
// in the same row that is a figure, in any container whatever it is called.
// That is deliberate and it stays, because this guard exists because a NEW
// grid went wrong, and Verification 19 records that an enumeration by class
// name fails on the unrecorded instance.
//
// The roster does not decide what gets walked. It decides what the walk is
// ACCOUNTABLE for having walked. Verification 19's own remedy, applied
// exactly: "where a list is unavoidable it asserts its own completeness, so a
// new member is a red test rather than a silent omission." So the check runs
// in BOTH directions - a rostered container that is missing is a red, and a
// container found that nobody registered is also a red.
//
// ── WHY IT EXISTS, MEASURED RATHER THAN ARGUED ───────────────────────────
//
// Two containers left A1's walk silently in one round. `#deal-product-grid`,
// the estate's main pricing surface, went out when R-US1 made the cards
// `<section>` elements the walk did not enumerate: measured zero times, while
// A1 went on reporting nine healthy containers. Then `.stmt-row-line` went out
// because the walk grouped cells by an exact rounded `top` and those rows are
// baseline-aligned.
//
// A list of containers says nothing about the one it never looked at, and a
// guard that reports what it FINDS cannot report what it has stopped finding.
//
// AND THE SECOND ONE WAS HIDING A REAL DEFECT. Repairing the parse turned the
// healthy state red at once: the statement's Total cost row sat 703px from its
// figure at 1920, having shipped with three empty group cells. The guard had
// read 142 of 142 for as long as the container had been unparseable.
//
// ── A CONDITION IS A PREDICATE ON THE STATE, NOT "AT LEAST ONCE" ─────────
//
// The first version of this file said `when: 'every'` or a prose condition,
// and asserted a conditional container had been found AT LEAST ONCE in the
// run. MEASURED ON THE FULL MATRIX, that is both too weak and too strong.
//
// Too weak: `deal-opex-table` is carried by six of the fifteen states, and one
// sighting would have satisfied it while it vanished from the other five.
//
// Too strong, and this is the one that would have produced a false red: the
// hybrid-only containers are not carried by the six-state FAST matrix at all,
// so an at-least-once rule fails every FAST run for a reason that is about
// the RUN rather than about the estate.
//
// So each entry carries a PREDICATE over the state label. The check asks it
// which of the states this run actually walked should carry the container,
// and asserts it was found in ALL of them. An entry no walked state matches
// is SKIPPED AND NAMED, never silently passed (Verification 14).
//
// ── SHRINK-ONLY ──────────────────────────────────────────────────────────
//
// A container genuinely retired leaves this roster IN THE SAME COMMIT that
// retires it. The entry is removed, never commented out and never left to be
// tidied later, because a roster carrying a container the estate no longer
// ships is a roster nobody can trust to be complete in the other direction.

/* The state label is `<width> <mode>/<structure>/<responsibility>/fx-<on|off>`,
   for example `1920 capex/hybrid/Per Unit/fx-on`. */
const EVERY = () => true
const HYBRID = (s) => s.includes('/hybrid/')
const NOT_HYBRID = (s) => !s.includes('/hybrid/')
const OPEX = (s) => s.includes('opex/')
const LUMP_SUM = (s) => s.includes('/Lump Sum/')

/**
 * `key` is what the walk reports a container as: its `id` if it has one,
 * otherwise its full `className`. Results are aggregated by that key, so one
 * entry covers every element sharing it.
 *
 * `when` is the human-readable condition and `inState` is the machine's copy
 * of it. They are two readers of one fact and are kept adjacent on purpose,
 * so a disagreement is visible in one line rather than across a file.
 */
export const A1_ROSTER = [
  { key: 'deal-product-grid', when: 'every state', inState: EVERY,
    what: 'Units Required, the per-product pricing rows', sample: 'SafeSight, new infra' },
  { key: 'stmt-row-line', when: 'every state', inState: EVERY,
    what: 'the C2 deal statement, money in, money out and result', sample: 'Total cost' },
  { key: 'pg-row', when: 'every state', inState: EVERY,
    what: 'Detail per line, unit cost and warranty rows', sample: 'AQ Sensor 4 units x $2,000' },
  { key: 'pg-row pg-total', when: 'every state', inState: EVERY,
    what: 'Detail per line, its total row', sample: 'Total' },
  { key: 'cf-row head', when: 'every state', inState: EVERY,
    what: 'the cash flow table heading row', sample: 'Month' },
  { key: 'cf-row', when: 'every state', inState: EVERY,
    what: 'the cash flow table body rows', sample: 'Hosting cost' },
  { key: 'cf-row total', when: 'every state', inState: EVERY,
    what: 'the cash flow table total rows', sample: 'Total cash in' },

  /* ── THE STRUCTURE SWAP, AND IT IS WHY THE PREDICATE EXISTS ────────────
     Hybrid does not render the yearly stack; it renders the deal sheet rows
     and the milestone schedule grid instead. Measured on the full matrix:
     `ys-line` is absent from exactly the three hybrid states and present in
     the other twelve, and `ds-row` and the milestone total appear in exactly
     those three and nowhere else. Two presentations of one thing, and the
     roster has to know that or it reports the swap as a defect. */
  { key: 'ys-line', when: 'every structure except hybrid', inState: NOT_HYBRID,
    what: 'the yearly stack, one line per contract year', sample: 'Year 1' },
  { key: 'ys-line ys-line--total', when: 'every structure except hybrid', inState: NOT_HYBRID,
    what: 'the yearly stack total', sample: 'Total (USD)' },
  { key: 'ds-row', when: 'hybrid structure only', inState: HYBRID,
    what: 'the hybrid deal sheet rows', sample: 'Total' },
  { key: 'ms-grid-row ms-grid-total', when: 'hybrid structure only', inState: HYBRID,
    what: 'the milestone schedule grid total', sample: 'Total' },

  { key: 'deal-opex-table', when: 'opex mode only', inState: OPEX,
    what: 'the OPEX table', sample: 'HEMIR' },
  { key: 'cm-grid-row cm-grid-total', when: 'Lump Sum responsibility only', inState: LUMP_SUM,
    what: 'the contractor milestone grid total', sample: 'Total' },
]
