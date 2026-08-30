// The initial values a new deal is created with. Round 41 item 1.
//
// ── ARCHITECTURE 11, STATED AS CODE ────────────────────────────────────────
//
// A default is an INITIAL VALUE, not a fallback:
//
//   an initial value lives in the RECORD.      applyDefaults() writes it, once
//   a fallback lives in the CALCULATION.       nothing here is called at read
//
// So this module has exactly one entry point that writes, and it is called from
// exactly one place: the creation of an opportunity. Nothing here is reachable
// from a render, a recompute, or a save of an existing record. That is the
// whole design, and a second caller would break it silently, so the test suite
// asserts the call-site count.
//
// ── WHAT CLEARING A FIELD MEANS ────────────────────────────────────────────
//
// After creation the value is an ordinary recorded figure. A person can change
// it or clear it, and a cleared field is empty and the sheet says the value is
// not recorded. It does not reappear on the next load, because nothing consults
// this module again.
//
// ── TWO-PHASE RECOVERY FOLLOWS THE RECOVERY PERIOD ─────────────────────────
//
// Ruling 5: the factoring term's initial value is 12 for hybrid, and for
// two-phase it follows the recovery period, which is what the old hardcoded
// `Math.max(1, recov)` intended. Structure is known at creation only if the
// caller supplies it; when it is not, the term is left ABSENT rather than
// guessed, because guessing here would be a fallback wearing an initial value's
// clothes.
export const DEFAULT_KEYS = ['targetMargin', 'warrantyPct', 'duration', 'recoveryMonths', 'factoringTermMonths'];

/**
 * Reads the admin-configured defaults.
 *
 * @param {{from: (t: string) => any}} db a Supabase client
 * @returns {Promise<Record<string, number>>}
 */
export async function readSystemDefaults(db) {
  const { data, error } = await db.from('system_defaults').select('key, value');
  if (error) throw new Error(`system_defaults unreadable: ${error.message}`);
  const out = {};
  for (const row of data ?? []) {
    const n = Number(row.value);
    if (Number.isFinite(n)) out[row.key] = n;
  }
  return out;
}

/**
 * The payload a NEW opportunity starts with.
 *
 * Returns only the keys the defaults table supplies, so a key the admin has not
 * configured is simply absent from a new deal rather than present as some
 * hardcoded stand-in. An empty table produces an empty object and a deal with
 * nothing prefilled, which is a legible state rather than a broken one.
 *
 * @param {Record<string, number>} defaults from readSystemDefaults
 * @param {{structure?: string}} opts the shape known at creation, if any
 */
export function initialPayload(defaults, { structure } = {}) {
  const out = {};
  for (const key of DEFAULT_KEYS) {
    if (key === 'factoringTermMonths' || key === 'recoveryMonths') continue;
    if (defaults[key] !== undefined) out[key] = defaults[key];
  }

  // recoveryMonths applies only to two-phase (Round 41 ruling 1), so it is
  // written only when the deal is created as two-phase. On any other structure,
  // and when no structure is stated, it is ABSENT: a field that does not apply
  // must not be prefilled, or the not-recorded path can never be reached for it.
  if (structure === 'twoPhase' && defaults.recoveryMonths !== undefined) {
    out.recoveryMonths = defaults.recoveryMonths;
  }

  // The factoring term: 12 for hybrid from the table, and for two-phase it
  // follows the recovery period rather than the table, per ruling 5. Absent
  // when neither is known.
  const term = structure === 'hybrid' ? defaults.factoringTermMonths
    : structure === 'twoPhase' ? out.recoveryMonths
    : undefined;
  if (term !== undefined) out.factoring = { termMonths: term };

  return out;
}

/**
 * Recovery period must be less than or equal to contract duration.
 *
 * Returns null when the pair is acceptable, or a sentence when it is not.
 * Absent on either side is not a violation: absence is reported by the
 * not-recorded path and blocked at the version, which is a different control.
 */
export function validateRecoveryAgainstDuration(payload) {
  const recov = payload?.recoveryMonths;
  const dur = payload?.duration;
  if (recov === undefined || recov === null || recov === '') return null;
  if (dur === undefined || dur === null || dur === '') return null;
  const r = Number(recov); const d = Number(dur);
  if (!Number.isFinite(r) || !Number.isFinite(d)) return null;
  if (r <= d) return null;
  return `The recovery period is ${r} months and the contract runs for ${d}. `
    + 'Hardware cannot be recovered over longer than the contract it is recovered from.';
}

/**
 * The recovery period's state on a two-phase or hybrid deal, per the table in
 * DESIGN_PRINCIPLES.md.
 *
 * empty  -> not recorded, blocked at version save
 * zero   -> an error on screen, blocked at version save
 * 1..11  -> a warning that names the exposure, acknowledged, allowed
 * 12+    -> normal
 *
 * The warning names the EXPOSURE and not the number: short recovery is good for
 * us and hard on the customer, and the risk is deliverability rather than
 * arithmetic. The customer may refuse the payment profile, and the deal was
 * priced as though they had accepted it.
 */
export function recoveryState(payload) {
  const structure = payload?.structure;
  if (structure !== 'twoPhase' && structure !== 'hybrid') {
    return { state: 'not applicable', blocksVersion: false, message: null };
  }
  const raw = payload?.recoveryMonths;
  if (raw === undefined || raw === null || raw === '') {
    return {
      state: 'empty', blocksVersion: true,
      message: 'The recovery period is not recorded. A two-phase deal without one has no cash flow, '
        + 'so a version cannot be taken until it is set.',
    };
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) return { state: 'empty', blocksVersion: true, message: 'The recovery period is not a number.' };
  if (n === 0) {
    return {
      state: 'zero', blocksVersion: true,
      message: 'A recovery period of zero months recovers no hardware, on a structure whose purpose '
        + 'is recovering it. Set a period, or change the payment structure.',
    };
  }
  if (n < 12) {
    return {
      state: 'short', blocksVersion: false, needsAcknowledgement: true,
      message: `Recovering the hardware over ${n} month${n === 1 ? '' : 's'} means a large upfront invoice. `
        + 'That is good for us and hard on the customer: the risk is that they refuse the payment '
        + 'profile, and the deal has been priced as though they accepted it.',
    };
  }
  return { state: 'normal', blocksVersion: false, message: null };
}
