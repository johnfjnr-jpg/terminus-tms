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
// ── WHO MAY CHANGE A DEFAULT ───────────────────────────────────────────────
//
// Nothing here writes to system_defaults. The table has a select policy and no
// write policy, and that controls AUTHENTICATED CLIENTS ONLY: the service role
// bypasses RLS, so an absent policy is not an enforcement against a server-side
// write.
//
// What prevents one today is that no route performs one, and that rests on a
// measured property rather than a declared policy: zero routes import
// `supabaseAdmin`, and every route runs as the authenticated user through
// `createUserClient`. Re-measured 2026-08-30. When an admin surface is built,
// ITS AUTHORIZATION LIVES IN THE ROUTE.
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
 * The keys whose field only exists on some deals, so their initial value cannot
 * be written at creation. Named here rather than tested for inline, because a
 * key added to DEFAULT_KEYS and forgotten here would be silently prefilled onto
 * every deal including the ones it does not apply to.
 *
 * Each names its GOVERNING INPUT, which is the same one the approval page's
 * applicability table uses. Two readers of one rule, so they are checked
 * against each other by a test rather than kept in step by hand.
 */
export const CONDITIONAL_KEYS = ['recoveryMonths', 'factoringTermMonths'];

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
    if (CONDITIONAL_KEYS.includes(key)) continue;
    if (defaults[key] !== undefined) out[key] = defaults[key];
  }

  // recoveryMonths applies only to two-phase (Round 41 ruling 1), so it is
  // written only when the deal is created as two-phase. On any other structure,
  // and when no structure is stated, it is ABSENT: a field that does not apply
  // must not be prefilled, or the not-recorded path can never be reached for it.
  if (structure === 'twoPhase' && defaults.recoveryMonths !== undefined) {
    out.recoveryMonths = defaults.recoveryMonths;
  }

  // ── THE FACTORING TERM IS NEVER WRITTEN AT CREATION ──────────────────────
  //
  // CORRECTED within Round 41, and the correction is the round's own defect
  // rather than an inherited one. The first version wrote the term from the
  // STRUCTURE, which is the wrong governing input: the approved applicability
  // table makes `factoring.termMonths` conditional on `factoring.enabled`, and
  // a new opportunity has no factoring block at all.
  //
  // Writing it here would prefill the term of a facility nobody is using, which
  // is precisely what the recoveryMonths note four lines above forbids. It comes
  // into existence when factoring is switched on, and that is where it is
  // written: see defaultsForConditionalFields below.

  return out;
}

/**
 * A CONDITIONAL field's initial value, applied when the field first comes into
 * existence on a deal.
 *
 * ── THE TENSION THIS RESOLVES, AND IT IS REAL ─────────────────────────────
 *
 * `recoveryMonths` applies only to two-phase, and structure is not known at
 * creation: it is absent on 502 of 562 opportunities. So a field that only
 * exists on two-phase deals can never receive an initial value at creation, and
 * without this the deal reaches two-phase with a blank recovery period, which is
 * finding 1 surviving the round that exists to close it.
 *
 * ── CREATION IS NOT THE ONLY MOMENT A FIELD COMES INTO EXISTENCE ──────────
 *
 * For an unconditional field it is. For a conditional one, the field comes into
 * being when its governing input selects it, and THAT is the moment its initial
 * value is written. The rule is unchanged in substance: an initial value is
 * written once, when the field starts to exist, and never consulted again.
 *
 * ── WRITTEN ON THE TRANSITION, NOT ON EVERY SAVE ─────────────────────────
 *
 * Only when the structure CHANGES into one the field applies to, and only when
 * the field is absent. A save that leaves the structure alone writes nothing,
 * so a cleared recovery period stays cleared for as long as the deal stays
 * two-phase. That is what keeps this an initial value rather than a fallback.
 *
 * THE CONSEQUENCE, STATED RATHER THAN DISCOVERED: switching away from two-phase
 * and back re-applies the default. The field genuinely left the deal and
 * returned, so it is coming into existence again. Anyone who cleared it and
 * then toggled the structure twice gets 12 back, and that is the honest reading
 * of "when the field starts to exist" rather than an oversight.
 *
 * @param {object} before the payload as stored
 * @param {object} after  the payload after the client's changes are merged
 * @param {Record<string, number>} defaults from readSystemDefaults
 * @returns {object} keys to write, empty when the transition does not apply
 */
export function defaultsForConditionalFields(before, after, defaults) {
  const out = {};
  const absent = (v) => v === undefined || v === null || v === '';

  // ── ONE GOVERNING INPUT PER FIELD, AND THEY ARE NOT THE SAME ONE ────────
  //
  // The first version of this function keyed BOTH fields off the structure
  // change, which was right for the recovery period and wrong for the factoring
  // term: the term's governing input is `factoring.enabled`. Keying it off
  // structure wrote the term of a facility nobody had switched on.

  const wasStructure = before?.structure ?? null;
  const nowStructure = after?.structure ?? null;
  if (wasStructure !== nowStructure
    && nowStructure === 'twoPhase'
    && absent(after?.recoveryMonths)
    && defaults.recoveryMonths !== undefined) {
    out.recoveryMonths = defaults.recoveryMonths;
  }

  // ── THE FACTORING TERM, ON THE TRANSITION INTO ENABLED ──────────────────
  //
  // The initial value is the ADMIN DEFAULT, not a figure derived from the
  // structure. The old calculator computed 12 for hybrid and the recovery
  // period otherwise; that was a fallback, and reproducing it here as a default
  // would move the same substitution rather than remove it. A term the admin
  // configured is a value a person chose, visible in the field and editable.
  //
  // Switching factoring OFF does not clear the term. Clearing it would destroy
  // a value somebody entered, and applicability already stops a disabled
  // facility's term being reported as a missing one. Switching back on then
  // finds it present and writes nothing, which is what an initial value does.
  const wasOn = before?.factoring?.enabled === true;
  const nowOn = after?.factoring?.enabled === true;
  if (!wasOn && nowOn && absent(after?.factoring?.termMonths)
    && defaults.factoringTermMonths !== undefined) {
    out.factoring = { ...(after?.factoring ?? {}), termMonths: defaults.factoringTermMonths };
  }

  return out;
}

/**
 * THE TERMS A VERSION FREEZES, beside the rates it already freezes.
 *
 * Decided by the business 2026-08-30, Round 41: contract duration and recovery
 * period join the version freeze, each with a flag for whether it was the
 * default or an override.
 *
 * ── WHY THE VALUE ALONE IS NOT ENOUGH ────────────────────────────────────
 *
 * The value is already frozen: it is in the version's `inputs`. What is not,
 * and cannot be recovered later, is WHICH DEFAULT WAS IN FORCE. An admin
 * changes the default from 12 to 24 and every past version's 12 silently
 * becomes an override in the eyes of anybody comparing, or worse, a 24 that
 * somebody typed reads as the default.
 *
 * So the default in force is recorded ALONGSIDE the value rather than the flag
 * being derived at read time from whatever the table says today.
 *
 * ── AND THE FLAG IS HONEST ABOUT WHAT IT CAN KNOW ────────────────────────
 *
 * `source` is derived by comparing the two, so a value somebody deliberately
 * typed that happens to equal the default reads as 'default'. That is not
 * distinguishable without recording the keystroke, and pretending otherwise
 * would be worse than saying so: BOTH numbers are in the frozen object, so a
 * reader who needs more than the flag has it.
 *
 * @param {object} payload the deal as versioned
 * @param {Record<string, number>} defaults the admin defaults in force NOW
 */
export function frozenTerms(payload, defaults = {}) {
  const out = {};
  for (const key of ['duration', 'recoveryMonths']) {
    const raw = payload?.[key];
    const value = raw === undefined || raw === null || raw === '' ? null : Number(raw);
    const dflt = defaults[key] === undefined ? null : Number(defaults[key]);
    const source = value === null ? 'absent'
      : dflt !== null && value === dflt ? 'default'
      : 'override';
    out[key] = { value: Number.isFinite(value) ? value : null, default: dflt, source };
  }
  return out;
}

/**
 * One sentence per frozen term, for a surface that has to show provenance.
 *
 * Verification 22: the flag above is required of every version, so something
 * reads it. This is that reader, and it is used by the approval page.
 */
export function frozenTermsSentences(frozen, labels = { duration: 'Contract duration', recoveryMonths: 'Recovery period' }) {
  const out = [];
  for (const [key, t] of Object.entries(frozen ?? {})) {
    const label = labels[key] ?? key;
    if (t.source === 'absent') {
      out.push({ key, source: t.source, sentence: `${label} was not recorded when this version was taken.` });
      continue;
    }
    const months = `${t.value} month${t.value === 1 ? '' : 's'}`;
    out.push({
      key,
      source: t.source,
      sentence: t.source === 'default'
        ? `${label} ${months}, the system default in force when this version was taken.`
        : t.default === null
          ? `${label} ${months}, entered on the deal. No system default was configured at the time.`
          : `${label} ${months}, entered on the deal in place of the system default of ${t.default}.`,
    });
  }
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
