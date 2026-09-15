// ── THE PAYLOAD DIFF THAT FEEDS THE AUDIT LOG ────────────────────────────
//
// TEST BED STATE R3. Notes and audit are TWO SEPARATE CONCERNS, ruled by the
// business: `payload.notes` is what a person wrote, and a field changing is
// something the system observed. They had been the same list on the Contact
// surface, where the CLIENT composed "Job Title changed from X to Y." and
// prepended it into the notes array.
//
// ── WHY THE DIFF IS TAKEN ON THE SERVER ──────────────────────────────────
//
// The client cannot be the author of an audit trail. It reports what it
// believes changed, from a record it loaded at some earlier moment, and
// nothing checks it against what was actually stored. An audit entry that a
// caller can word is not an audit entry; it is a caller's claim, which is
// Architecture 12's rule arriving one layer up.
//
// ── AND IT IS A DIFF, NOT THE PATCH ──────────────────────────────────────
//
// A PATCH carries every key the surface owns, changed or not: the Test Bed's
// batch save sends the whole set. Logging the patch would record nine
// "changes" for a save that altered one field, which is worse than no log,
// because a reader cannot tell which of the nine to care about.
//
// ONE DEFINITION FOR BOTH ROUTES. Contacts and Test Beds ask the same
// question, and two copies of it would agree today (Verification 20).

/**
 * Keys that are never audited as field changes, with the reason for each.
 *
 * `notes` is THE OTHER HALF OF THE SPLIT: it is the human list, it is a whole
 * array rewritten on every append, and diffing it would put a copy of every
 * note into the audit detail on every note added.
 */
export const NOT_AUDITED = new Set(['notes'])

/** A value is "absent" whether it was never set or was cleared to empty. */
const absent = (v) => v === undefined || v === null || v === ''

/**
 * Compare like with like without pretending a number and its own text are
 * different values. A payload holds `4` where a form sends `"4"`, so a strict
 * comparison would log a change on every save of an untouched numeric field.
 */
const same = (a, b) => {
  if (absent(a) && absent(b)) return true
  if (absent(a) !== absent(b)) return false
  if (typeof a === 'object' || typeof b === 'object') {
    return JSON.stringify(a) === JSON.stringify(b)
  }
  return String(a) === String(b)
}

/**
 * The changes a patch actually makes to a payload.
 *
 * @param {object} before the payload as stored
 * @param {object} patch the keys this write is setting
 * @returns {Record<string, {from: unknown, to: unknown}>} changed keys only
 */
export function auditChanges(before, patch) {
  const out = {}
  for (const [k, to] of Object.entries(patch ?? {})) {
    if (NOT_AUDITED.has(k)) continue
    const from = (before ?? {})[k]
    if (same(from, to)) continue
    // ABSENCE IS RECORDED AS null, ONE WAY, so a reader never has to know
    // whether a field was missing, undefined or an empty string. The screen
    // says "not recorded" for all three, and the audit agrees with the screen.
    out[k] = { from: absent(from) ? null : from, to: absent(to) ? null : to }
  }
  return out
}

/**
 * Whether this write is worth an audit row at all.
 *
 * A PATCH that changes nothing must not write one: a log of saves is not a
 * log of changes, and a reader scrolling past forty identical entries stops
 * reading the list.
 */
export const hasAuditableChange = (changes) => Object.keys(changes ?? {}).length > 0

/** The one action name both routes write, so a reader can filter on it. */
export const FIELDS_CHANGED = 'fields_changed'
