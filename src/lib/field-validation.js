// Shared server-side value validation for free-text-turned-typed fields
// (2026-08-15) - the writable-keys allowlist check on each PATCH endpoint
// only ever validated field *names*, never field *values*, so a plain
// text input could save literally anything: a garbled date string
// ("affdsd01/01/25") or a non-numeric duration ("as") both saved
// successfully with no rejection, confirmed live on a real Test Bed
// record. Client-side <input type="date">/type="number"> constrains the
// normal UI path, but per this session's own established rule (never
// trust client-only validation), the server must reject the same bad
// values independently, not just rely on the browser.

// Genuinely parseable date, not just "looks date-shaped" - requires
// exact ISO YYYY-MM-DD (what a native <input type="date"> always
// produces) and rejects values JS's Date would otherwise silently
// coerce or misinterpret (e.g. "2027-02-30", "12/11/26").
export function isValidIsoDate(value) {
  if (typeof value !== 'string') return false
  if (value.trim() === '') return true
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}

// Numeric-only, matching <input type="number">'s own constraint - accepts
// an empty string as "not yet set" (same convention every other optional
// field in this codebase uses), rejects anything else that isn't a
// finite number once trimmed. Accepts a real JS number as well as a
// numeric string: 'duration' on Opportunity is shared by two different
// callers, the Reference tab's <input type="number"> (sends a string,
// the DOM's own convention) and opportunity-deal.js's Commercial tab
// (sends a real parsed number via num()) - both are genuinely valid,
// this isn't the field-name collision itself, just this validator
// needing to accept both real shapes already in live use.
export function isValidNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value !== 'string') return false
  if (value.trim() === '') return true
  return Number.isFinite(Number(value))
}

// Contract Duration specifically (Round 3 Phase 3, 2026-08-17): a real
// duration in months can't be negative or fractional, unlike isValidNumber
// above, which is deliberately more permissive for fields that genuinely
// can be. Same empty-string-is-"not yet set" convention as every other
// optional field. \d+ alone (no leading -, no .) is what actually rejects
// negative and decimal values - Number.isInteger(Number(value)) would not,
// since Number('-3') and Number('2.0') both produce integers.
export function isValidNonNegativeInteger(value) {
  if (typeof value === 'number') return Number.isInteger(value) && value >= 0
  if (typeof value !== 'string') return false
  if (value.trim() === '') return true
  return /^\d+$/.test(value.trim())
}

// Margin/rate/percentage fields specifically (Round 3, 2026-08-17
// follow-up) - these were briefly forced through isValidNonNegativeInteger
// during Phase 4's blanket numeric-field pass, which broke real percentage
// precision (12.5%, the factoring rate's own former 1.5% default) for no
// real reason; whole-number-only was correct for unit counts, never for a
// margin or rate. Same non-negative discipline as isValidNonNegativeInteger,
// just up to 2 decimal places instead of zero - normal currency/percentage
// precision, not the same "whole things only" reasoning that field's own
// comment describes for counts. \d+(\.\d{1,2})? alone (no leading -, no
// 3+ decimal places) is what rejects both a negative sign and a
// too-precise value - the numeric branch checks the same "at most 2dp"
// property with a rounding comparison, since floating-point numbers have
// no literal decimal-place count to test against a regex.
export function isValidNonNegativePercent(value) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) return false
    return Math.abs(value - Math.round(value * 100) / 100) < 1e-9
  }
  if (typeof value !== 'string') return false
  if (value.trim() === '') return true
  return /^\d+(\.\d{1,2})?$/.test(value.trim())
}

// Est. Close Date / Est. Go Live specifically (Round 3 Phase 3): a past
// "estimate" is nonsensical, unlike Actual Close Date/Actual Go Live,
// which record things that already happened and must allow the past.
// Compared as plain ISO strings (YYYY-MM-DD sorts lexically the same as
// chronologically) against the server's own UTC today, not the client's -
// same reasoning isValidIsoDate already uses Date.UTC, avoids a client
// timezone making "today" ambiguous. Assumes the value already passed
// isValidIsoDate - doesn't re-validate format.
export function isNotPastIsoDate(value) {
  if (typeof value !== 'string' || value.trim() === '') return true
  const today = new Date().toISOString().slice(0, 10)
  return value.trim() >= today
}

// Round 9 Phase 3.2: an exit-criterion tick is stored as an ISO timestamp
// string, never a boolean.
//
// The reason is specific and load-bearing. `payload_field_required` in
// transitions.js blocks only on `undefined`, `null` and `''`, so a stored
// boolean `false` reads as PRESENT and satisfies the gate. An unticked box
// would open the transition. Storing a timestamp on tick and deleting the
// key on untick makes "present and non-empty" structurally equivalent to
// "ticked", rather than dependent on a truthiness detail in a branch that
// knows nothing about criteria.
//
// Validated as a real parseable instant, not merely date-shaped, and
// required to round-trip exactly, which rejects values Date would
// otherwise silently coerce ("2027-02-30T00:00:00.000Z").
export function isValidIsoTimestamp(value) {
  if (typeof value !== 'string') return false
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.exec(value)
  if (!m) return false
  const [, y, mo, d, h, mi, sec] = m.map(Number)
  // Calendar validity of the written components, checked the same way
  // isValidIsoDate does it. Date.parse alone is not enough: it silently
  // rolls "2027-02-30" forward to 2 March rather than rejecting it.
  const utc = new Date(Date.UTC(y, mo - 1, d))
  if (utc.getUTCFullYear() !== y || utc.getUTCMonth() !== mo - 1 || utc.getUTCDate() !== d) return false
  if (h > 23 || mi > 59 || sec > 59) return false
  return !Number.isNaN(Date.parse(value))
}

/**
 * Round 10 Phase 4 item 1 (2026-08-19). Mobile numbers were accepted as
 * completely free text, so "call me on the office line" persisted as
 * happily as a real number.
 *
 * THE RULE, deliberately permissive, because a validator that rejects real
 * international numbers is worse than none at all:
 *   - an optional single leading "+"
 *   - digits, and the separators space, hyphen, parenthesis and full stop,
 *     in any arrangement
 *   - once every separator is stripped, between 7 and 15 digits must remain
 *
 * 15 is the E.164 maximum for a full international number; 7 is about the
 * shortest real national significant number in use. Nothing is checked
 * about country prefixes or number plans: that needs a real library and a
 * maintained dataset, and getting it half right would reject genuine
 * numbers, which is the specific failure this rule is written to avoid.
 *
 * KNOWN AND ACCEPTED EXCLUSION: extensions ("+44 20 7946 0958 ext 221")
 * are rejected, because "ext"/"x" would mean admitting letters and there
 * is no evidence this business records them. Recorded rather than silently
 * unsupported.
 */
export function isValidMobile(value) {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  if (!trimmed) return false
  if (!/^\+?[0-9 ()\-.]+$/.test(trimmed)) return false
  const digits = trimmed.replace(/[^0-9]/g, '')
  return digits.length >= 7 && digits.length <= 15
}

// Round 17 Phase 1: unit coordinates.
//
// THE FIRST FIELDS IN THIS SYSTEM THAT LEGITIMATELY ACCEPT A NEGATIVE VALUE.
// Every numeric validator above rejects one, and correctly: a duration, a
// count, a rate and a dollar figure are all non-negative by nature, and
// isValidNonNegativeInteger's own comment explains why. A latitude south of
// the equator or a longitude west of Greenwich is negative in the ordinary
// case, so reusing any existing validator here would reject roughly half the
// planet. Recorded because the pattern in this file reads as "numbers are
// non-negative" and this is the genuine exception, not an oversight.
//
// Range-checked as well as parsed. A latitude of 91 is not a coordinate, and
// unlike a too-precise percentage it cannot be a rounding artefact. Decimal
// precision is deliberately NOT capped: 6 decimal places is roughly 0.1m and
// real GPS output carries more, so truncating would discard real precision on
// the field whose whole purpose is to say exactly where a unit is.
//
// Empty is "not set", the same convention every other optional field uses:
// a Planned slot has no coordinates yet, which is the normal state.
function isValidCoordinate(value, limit) {
  if (typeof value === 'number') return Number.isFinite(value) && Math.abs(value) <= limit
  if (typeof value !== 'string') return false
  if (value.trim() === '') return true
  if (!/^-?\d+(\.\d+)?$/.test(value.trim())) return false
  return Math.abs(Number(value.trim())) <= limit
}

export function isValidLatitude(value) { return isValidCoordinate(value, 90) }
export function isValidLongitude(value) { return isValidCoordinate(value, 180) }
