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
export function scheduleReconciliation(rows, base) {
  const filled = (rows ?? []).filter((r) => Number(r?.usd) > 0);
  const totalUsd = filled.reduce((s, r) => s + Number(r.usd), 0);
  const hasSchedule = filled.length > 0;
  const hasBase = Number(base) > 0;

  // No schedule and no base is not a discrepancy, it is an empty form. Every
  // installation type except Lump Sum has no contractor schedule at all, and a
  // refusal that fired on those would fire on almost every deal.
  if (!hasSchedule || !hasBase) {
    return {
      hasSchedule, base: Number(base) || 0, totalUsd, rows: filled.length,
      diffUsd: 0, diffPct: 0, exact: true, reconciles: true, statement: null,
    };
  }

  const diffUsd = totalUsd - base;
  const diffPct = (diffUsd / base) * 100;
  const allowance = roundingAllowance(filled.length);

  return {
    hasSchedule, base: Number(base), totalUsd, rows: filled.length,
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
