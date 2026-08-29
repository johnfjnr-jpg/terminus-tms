/**
 * Is the form different from what was last saved? Round 38, before the Phase 2
 * reshape.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY THIS REPLACES AN EVENT-INFERRED FLAG
 * ─────────────────────────────────────────────────────────────
 *
 * The Commercials tab decided "dirty" by listening for 'input' and 'change' on
 * the panel and setting a boolean. Two properties follow from that, and both
 * are defects rather than details:
 *
 *   EVERY NEW CONTROL IS DIRTY BY DEFAULT. Anything that fires an input event
 *   inside the panel marks the tab dirty whether or not it changes the deal.
 *   The version reason box is not a deal input and needed its own guard.
 *
 *   THE GUARD IS PER EVENT TYPE. That guard covered 'input' and not 'change',
 *   and a textarea fires change on BLUR, so the click that used the reason
 *   marked the tab dirty a moment before the flag was read. Harmless until a
 *   dirty flag started meaning "write a revision first", at which point it
 *   produced a revision on every version taken from a clean screen.
 *
 * A comparison has neither property. A control that does not change the payload
 * cannot make the payload differ, whatever events it fires, so Phase 2 can add
 * controls to this panel without each one needing to be told not to lie.
 *
 * ─────────────────────────────────────────────────────────────
 * WHAT COUNTS AS THE SAME VALUE
 * ─────────────────────────────────────────────────────────────
 *
 * Absent, null and '' are ONE state: not set. Without that the form is dirty
 * the moment it loads, because a record that has never held `duration` renders
 * a blank box, and a blank box is null while the record's key is absent.
 *
 * Numeric keys compare through toNumberOrNull, so the 159 numeric strings
 * already in record_revisions (measured 2026-08-28) compare equal to the
 * numbers the form produces. History is never rewritten; the variance is
 * absorbed here, at the read boundary, which is the same principle
 * numeric-payload.js states.
 */

import { toNumberOrNull, WRITABLE_NUMERIC_KEYS } from './numeric-payload.js';

const NUMERIC = new Set(WRITABLE_NUMERIC_KEYS);

/**
 * Absent, null and the empty string are one state. Everything else is itself.
 */
function isEmpty(value) {
  return value === undefined || value === null || value === '';
}

/**
 * Stable stringify: object keys sorted, so two objects that carry the same
 * facts compare equal whatever order they were built in. The form builds
 * marginOverrides by iterating MARGIN_KEYS and the server returns whatever
 * order jsonb chose, and those need not match.
 */
function stable(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  const keys = Object.keys(value).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + stable(value[k])).join(',') + '}';
}

/**
 * Compares one key across two payloads.
 */
export function valuesDiffer(key, a, b) {
  if (NUMERIC.has(key)) {
    // Both through the read boundary: "36" and 36 are one value, and blank,
    // null and absent are all null.
    return toNumberOrNull(a) !== toNumberOrNull(b);
  }
  if (isEmpty(a) && isEmpty(b)) return false;
  return stable(a) !== stable(b);
}

/**
 * Every key on which `current` differs from `baseline`.
 *
 * The union of both key sets, so a key the form dropped counts as a change
 * rather than being invisible. Returned as a list rather than a boolean because
 * the list is what makes a wrong answer debuggable: "dirty" tells you nothing,
 * "dirty because gstPct" tells you where to look.
 *
 * @param {object} current
 * @param {object} baseline
 * @returns {string[]}
 */
export function changedKeys(current, baseline) {
  const a = current ?? {};
  const b = baseline ?? {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const out = [];
  for (const key of keys) {
    if (valuesDiffer(key, a[key], b[key])) out.push(key);
  }
  return out.sort();
}

/**
 * @returns {boolean} whether anything at all differs.
 */
export function payloadsDiffer(current, baseline) {
  return changedKeys(current, baseline).length > 0;
}
