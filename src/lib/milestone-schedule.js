// A payment schedule's parts must sum to the total it is a schedule OF.
// Round 39, 2026-08-29, from a real deal the business entered.
//
// ── THE INSTANCE ───────────────────────────────────────────────────────────
//
// Contractor milestones totalled $250,020 against a lump sum of $250,000. Both
// numbers were printed on the same row, and it SAVED WITHOUT A WORD.
//
// Two independent reasons nothing was said, and each alone would have been
// enough:
//
//   THE FIGURE WHOSE JOB IS TO SAY IT DOES NOT ADD UP WAS ROUNDED UNTIL IT
//   SAID IT DID. 250,020 / 250,000 is 100.008%, printed by `.toFixed(1)` as
//   "100.0%".
//
//   THE TOLERANCE WAS HALF A PERCENT OF THE BASE, not of anything rounding can
//   reach. At a $250,000 lump sum that is $1,250 of silent drift; at $1,000,000
//   it is $5,000.
//
// Verification 21: a reconciliation that cannot fail is not a reconciliation,
// and the tolerance has to be derived from what rounding can legitimately
// produce rather than picked.
//
// ── THE DERIVATION ─────────────────────────────────────────────────────────
//
// The percentage is the input and the dollar figure follows, rounded to whole
// dollars. Over N rows, whole-dollar rounding can move the total by at most
// N x 0.5. That is the entire legitimate discrepancy. Anything larger is a
// schedule that does not match the price, wearing rounding's clothes.
//
// ── DISPLAY AND REFUSAL ARE DIFFERENT THRESHOLDS, DELIBERATELY ─────────────
//
// The total row states the difference whenever it is not EXACTLY 100%, over or
// under, because a person reading the row should see what is actually there.
//
// A version is refused only when the difference exceeds what rounding can
// reach, because refusing a commercial commitment over two dollars of unavoidable
// rounding would teach people to work around the refusal.
//
// Saving warns and does not block: a part-built schedule mid-drafting is
// legitimate, and a save is not a commitment. Taking a version is.
export const MILESTONE_ROWS = 5;

/** The most whole-dollar rounding can move a total of `rows` rows. */
export function roundingAllowance(rows) {
  return rows * 0.5;
}

/**
 * @param {Array<{usd?: number}>} rows the schedule's rows, blank ones included
 * @param {number} base the total the schedule is a schedule OF
 */
/**
 * THE ONE DERIVATION. R-N1, ruled by John 2026-09-21.
 *
 * A milestone is a PERCENTAGE of the base it is a schedule of, and its dollar
 * figure is derived here and nowhere else. Every reader - the grid cell, the
 * reconciliation below, the cash flow in `deal-calculator.js` - calls this,
 * so they cannot disagree by construction rather than by a comment saying
 * they cannot.
 *
 * WHAT IT REPLACED, measured rather than argued. The grid derived its cell
 * from the percentage while the reconciliation and the cash flow read a
 * STORED dollar figure that was only rewritten when somebody retyped the
 * percentage. Changing the units from 40 to 80 doubled the price and the
 * screen then showed $467,143 in the cell, $233,572 in the warning and
 * $233,572 in the cash flow - at the same moment - with the save writing the
 * stale figure.
 *
 * TO CENTS, and that is not a detail. The cell has always shown two decimal
 * places, for the reason its own comment gives: a percentage of a six-figure
 * total lands on cents, and rounding them away makes the column stop summing
 * to the schedule. A first draft of this function rounded to whole dollars,
 * which would have put the cell and the cash flow a few cents apart - the
 * same class of disagreement this ruling exists to remove, reintroduced by
 * the fix for it.
 *
 * Rounding to cents rather than returning the raw product also keeps the
 * arithmetic exact: three rows of a third each sum to the whole rather than
 * to the whole plus a floating-point residue.
 */
export function milestoneUsd(pct, base) {
  const p = Number(pct);
  const b = Number(base);
  if (!Number.isFinite(p) || !Number.isFinite(b)) return 0;
  return Math.round((p / 100) * b * 100) / 100;
}

export function scheduleReconciliation(rows, base) {
  // R-N1: DERIVED, NOT READ. This filtered and summed `r.usd` from the stored
  // row, which is the reading that went stale. It now asks the same question
  // of the same derivation the cell uses.
  //
  // A ROW COUNTS WHEN ITS PERCENTAGE IS NON-ZERO, because the percentage is
  // what the person entered and the dollars are a consequence of it. With a
  // base of zero every derived figure is zero and `hasBase` below already
  // handles that case, so an empty form still reads as an empty form.
  const filled = (rows ?? []).filter((r) => Number(r?.pct) > 0);
  const usdOf = (r) => milestoneUsd(r?.pct, base);
  // ── W-C: A DATELESS PAYMENT COUNTS AND CANNOT BE ISSUED ────────────────
  //
  // Round 41, seventh walk. A row with money and no month used to be dropped by
  // the CLIENT before this function saw it, so this filter never had to think
  // about it. The drop is gone - it was discarding entered money - and the
  // question arrives here instead.
  //
  // IT COUNTS TOWARD THE TOTAL, because the money is committed whatever the
  // date says, and a total that excluded it would report a schedule as short by
  // exactly the amount somebody had just typed.
  //
  // AND IT BLOCKS A VERSION, because a version is a commercial commitment and a
  // payment with no date cannot be one. It does NOT block a save: the work must
  // not be lost while the date is found. That split is the business's ruling and
  // it is the reason `incomplete` is separate from `reconciles` rather than
  // folded into it - the two block different things.
  const incomplete = filled.filter((r) => !(Number(r?.month) > 0));
  const totalUsd = filled.reduce((s, r) => s + usdOf(r), 0);
  const hasSchedule = filled.length > 0;
  const hasBase = Number(base) > 0;

  // No schedule and no base is not a discrepancy, it is an empty form. Every
  // installation type except Lump Sum has no contractor schedule at all, and a
  // refusal that fired on those would fire on almost every deal.
  if (!hasSchedule || !hasBase) {
    return {
      hasSchedule, base: Number(base) || 0, totalUsd, rows: filled.length,
      incomplete: incomplete.length, issuable: incomplete.length === 0,
      diffUsd: 0, diffPct: 0, exact: true, reconciles: true, statement: null,
    };
  }

  const diffUsd = totalUsd - base;
  const diffPct = (diffUsd / base) * 100;
  const allowance = roundingAllowance(filled.length);

  return {
    hasSchedule, base: Number(base), totalUsd, rows: filled.length,
    // Two separate answers, deliberately. `reconciles` is about the ARITHMETIC
    // and `issuable` is about COMPLETENESS, and a schedule can fail either
    // without the other: 100% of the price across rows one of which has no
    // month reconciles perfectly and still cannot be issued.
    incomplete: incomplete.length,
    issuable: incomplete.length === 0,
    incompleteStatement: incomplete.length === 0 ? null
      : `${incomplete.length} milestone${incomplete.length === 1 ? ' has' : 's have'} an amount but no month. `
        + 'The schedule is saved, and a version cannot be taken until every payment has a date.',
    diffUsd,
    diffPct,
    exact: diffUsd === 0,
    reconciles: Math.abs(diffUsd) <= allowance,
    allowance,
    statement: diffUsd === 0 ? null : differenceStatement(diffUsd, diffPct),
  };
}

/**
 * The difference in DOLLARS AND POINTS, at a precision that cannot round a
 * discrepancy shut. `.toFixed(1)` on 100.008% prints 100.0%, which is how a
 * $20 gap read as agreement; the dollars are stated first because they are the
 * figure that cannot be rounded into agreement at all.
 */
export function differenceStatement(diffUsd, diffPct) {
  const over = diffUsd > 0;
  const money = Math.abs(diffUsd).toLocaleString('en-US', { maximumFractionDigits: 2 });
  // Enough places that a discrepancy is always visible: 0.008 points must not
  // print as 0.0.
  const pts = Math.abs(diffPct) < 0.05
    ? Math.abs(diffPct).toPrecision(2)
    : Math.abs(diffPct).toFixed(2);
  return `${over ? 'Over' : 'Under'} by $${money}, ${pts} points.`;
}

/** The sentence a refusal gives, naming the numbers rather than the rule. */
export function refusalStatement(rec, what) {
  return `${what} totals $${rec.totalUsd.toLocaleString('en-US')} against $${rec.base.toLocaleString('en-US')}. `
    + `${rec.statement} A version records a commercial commitment and cannot carry a payment `
    + `schedule that does not match the price it is a schedule of.`;
}
