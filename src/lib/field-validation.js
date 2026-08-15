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
