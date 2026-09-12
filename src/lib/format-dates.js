// ── ONE MODULE, TWO FUNCTIONS. R7, ruled by the business 2026-09-12 ──────
//
// Phase 0 censused the estate and found NO formatter: sixteen sites producing
// SEVEN shapes, four of them rendering a raw ISO string at a person. Three
// copies already claimed to agree and one had already drifted - AccountView's
// port carries `year: 'numeric'` where the two it was copied from carry
// `'2-digit'`, with a comment saying it was kept the same.
//
// So this module exists to be the ONLY place a date becomes display text.
// `main.tsx` publishes both onto `window` for `app.js`, which is a classic
// script and cannot import; that is a TRANSPORT, not a second implementation,
// and it is what keeps Architecture 3's one-computation-path rule true across
// the two trees.
//
// ── GRAIN IS PRESERVED, SHAPE IS UNIFIED ────────────────────────────────
//
// R7 says a date site uses formatDate and a timestamp site formatTimestamp.
// Several sites render a TIMESTAMP VALUE at DATE GRAIN on purpose - "Approved
// 12/09/26" on a stage chip. Those stay date-grain: the ruling is about the
// shape a person reads and about raw ISO, and adding seconds to an approval
// chip would be a scope expansion nobody asked for. Each site's disposition is
// listed in the Phase 1 report.
//
// ── ABSENCE IS THE CALLER'S TO NAME ─────────────────────────────────────
//
// The sites disagree about what an absent date shows: '--' in app.js,
// AccountView, headerStats and KeyContacts; '' in descriptors and stageTracks.
// Verification 20's addendum - read and write must agree about absence - so
// this returns '' for absent and each call site keeps its own fallback rather
// than having one imposed on it. Unifying the SHAPE must not quietly unify the
// ABSENCE, which is a different decision on a different surface.
//
// ── AND AN UNPARSEABLE VALUE IS RETURNED AS IT STANDS ───────────────────
//
// descriptors.ts already did this deliberately: if the stored text is not a
// date, showing it beats showing nothing, because the person can then see what
// is actually in the field.

const pad = (n) => String(n).padStart(2, '0')

/**
 * A date-only string, `YYYY-MM-DD`, split WITHOUT `new Date`.
 *
 * `new Date('2026-09-12')` is parsed as UTC midnight, so in any timezone west
 * of UTC `getDate()` returns the 11th and the field renders the day before the
 * one that is stored. Every existing formatter in the estate has this hazard;
 * this module does not, because a date-only value never becomes a Date at all.
 */
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/

/** `DD/MM/YY`. A date somebody chose, or a timestamp shown at date grain. */
export function formatDate(value) {
  const s = String(value ?? '').trim()
  if (!s) return ''
  const m = DATE_ONLY.exec(s)
  if (m) return `${m[3]}/${m[2]}/${m[1].slice(2)}`
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)}`
}

/** `DD/MM/YY HH:MM:SS`, in the reader's own timezone. R7's ruled format. */
export function formatTimestamp(value) {
  const s = String(value ?? '').trim()
  if (!s) return ''
  // A date-only value has no time to show, so it renders as a date rather
  // than acquiring a 00:00:00 nobody recorded. Architecture 11's reasoning:
  // a value that was never entered is not displayed as though it were.
  if (DATE_ONLY.test(s)) return formatDate(s)
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)}`
    + ` ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}
