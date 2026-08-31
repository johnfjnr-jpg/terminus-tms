/**
 * THE OPPORTUNITY'S DATES, ONE RULE SET. Round 41, walk finding 5.
 *
 * Four fields, and one of them is not a payload key: `estClose` lives in
 * `opportunity_details.forecast_close_date` and moves only through the
 * close-date-move endpoint, which requires a reason and counts the moves.
 *
 * ── WHY THE OLD FIX DID NOT HOLD, AND IT IS NOT A BUG ────────────────────
 *
 * `isNotPastIsoDate` compares against `new Date()` AT WRITE TIME. It validates an
 * EVENT and the defect is a STATE: a date entered legitimately becomes past by
 * nobody doing anything. Measured, TT-SGP-SMARTC-001's estimated close of
 * 2026-07-29 was valid when entered and is 33 days past on an open deal.
 *
 * AND THE SAME PROPERTY MAKES IT BITE THE WRONG PERSON. The Reference tab sends
 * the WHOLE payload, so a since-passed `estGoLive` is re-sent unchanged and
 * REFUSED, and the deal becomes unsaveable from that tab until somebody changes
 * a date they did not intend to change.
 *
 * ── SO VALIDATION IS ON ENTRY AND EDIT ONLY ─────────────────────────────
 *
 * Ruled by the business. A rule fires when a value is BEING SET to something,
 * never on a value that is merely still there. `unchanged()` is what makes that
 * expressible, and it is the difference between a validator and a trap.
 */

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(v) {
  if (typeof v !== 'string' || !ISO.test(v.trim())) return false;
  const d = new Date(v.trim() + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v.trim();
}

const blank = (v) => v === undefined || v === null || String(v).trim() === '';

/**
 * Today, as an ISO date, injectable so a test is not a hostage to the clock.
 */
export function today(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

/**
 * THE FOUR FIELDS, mapped. Named here so no caller has to remember which of
 * them is a column rather than a payload key.
 */
export const DATE_FIELDS = Object.freeze({
  estClose: { label: 'Est. Close Date', stored: 'opportunity_details.forecast_close_date', payloadKey: null },
  actualClose: { label: 'Actual Close Date', stored: 'payload', payloadKey: 'actualClose' },
  estGoLive: { label: 'Est. Go Live', stored: 'payload', payloadKey: 'estGoLive' },
  actualGoLive: { label: 'Actual Go Live', stored: 'payload', payloadKey: 'actualGoLive' },
});

/**
 * Validate the date set on one save.
 *
 * @param {object} before the stored values: {estClose, actualClose, estGoLive, actualGoLive, status}
 * @param {object} after  the same shape, after the change
 * @param {{now?: string, closingTo?: string|null}} opts closingTo is the stage a
 *        transition is moving to, when this save is that transition
 * @returns {{errors: string[], warnings: string[]}}
 */
export function validateDates(before, after, opts = {}) {
  const now = opts.now ?? today();
  const errors = [];
  const warnings = [];
  const changed = (k) => String(before?.[k] ?? '') !== String(after?.[k] ?? '');

  for (const [k, def] of Object.entries(DATE_FIELDS)) {
    const v = after?.[k];
    if (!blank(v) && !isIsoDate(v)) errors.push(`${def.label} must be a real date (YYYY-MM-DD).`);
  }
  if (errors.length) return { errors, warnings };

  // ── a. ESTIMATED CLOSE ─────────────────────────────────────────────────
  //
  // Cannot be in the past AT ENTRY OR EDIT. A passed estimate on an open deal is
  // an OVERDUE SIGNAL rather than an error: surfaced, never blocking, because
  // the deal is real and the date going stale is the thing worth seeing.
  if (changed('estClose') && !blank(after.estClose) && after.estClose < now) {
    errors.push(`${DATE_FIELDS.estClose.label} cannot be set to a date in the past.`);
  }
  if (!changed('estClose') && !blank(after.estClose) && after.estClose < now && !isClosed(after.status)) {
    warnings.push(`${DATE_FIELDS.estClose.label} passed on ${after.estClose}. This deal is overdue against its own estimate.`);
  }

  // ── b. ACTUAL CLOSE ────────────────────────────────────────────────────
  //
  // Set at the Closed Won / Closed Lost transition and NOT WRITABLE ELSEWHERE.
  // A future actual date is refused: an actual is a record of something that
  // happened.
  if (changed('actualClose')) {
    if (!opts.closingTo && !isClosed(after.status)) {
      errors.push(`${DATE_FIELDS.actualClose.label} is set when the deal closes, not before.`);
    }
    if (!blank(after.actualClose) && after.actualClose > now) {
      errors.push(`${DATE_FIELDS.actualClose.label} cannot be in the future. It records what happened.`);
    }
  }

  // ── c. ESTIMATED GO LIVE ───────────────────────────────────────────────
  if (changed('estGoLive') && !blank(after.estGoLive) && after.estGoLive < now) {
    errors.push(`${DATE_FIELDS.estGoLive.label} cannot be set to a date in the past.`);
  }
  // At Closed Won, present and now BEFORE the close date is invalid and the
  // transition asks for a new one. Absent is handled by closedWonGoLive below,
  // which writes an initial value rather than refusing.
  if (opts.closingTo === 'Closed Won' && !blank(after.estGoLive) && !blank(after.actualClose)
    && after.estGoLive < after.actualClose) {
    errors.push(`${DATE_FIELDS.estGoLive.label} is ${after.estGoLive}, before the close date of `
      + `${after.actualClose}. Give it a new one.`);
  }

  // ── d. ACTUAL GO LIVE ──────────────────────────────────────────────────
  //
  // On or after the actual close. NO CONSTRAINT AGAINST THE ESTIMATE: early
  // delivery is a real thing and recording it must not need a lie.
  if (!blank(after.actualGoLive) && !blank(after.actualClose) && after.actualGoLive < after.actualClose) {
    errors.push(`${DATE_FIELDS.actualGoLive.label} cannot be before ${DATE_FIELDS.actualClose.label}.`);
  }

  return { errors, warnings };
}

export function isClosed(status) {
  return status === 'Closed Won' || status === 'Closed Lost';
}

/**
 * c, the Closed Won half: an ABSENT estimated go live gets one written at the
 * transition, close plus one month.
 *
 * ARCHITECTURE 11: an initial value written when the field comes into
 * existence, and the transition is that moment. Returns {} when the field is
 * already set, so it is never a fallback.
 */
export function closedWonGoLive(after) {
  if (!blank(after?.estGoLive)) return {};
  if (blank(after?.actualClose) || !isIsoDate(after.actualClose)) return {};
  const d = new Date(after.actualClose + 'T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + 1);
  return { estGoLive: d.toISOString().slice(0, 10) };
}
