// THE ONE TAG FILTER. F5_TEARDOWN_SCALE rulings F1 and G3 (John, 2026-11-24).
//
// Every tag filter on record_revisions in fixtures.mjs, teardown-scoping and
// its two calibrators is built here, as an or-form of case-sensitive prefix
// likes on payload->>name. Pure: no database, no .env, no session, so a pure
// test can import it.
//
// WHY THE OR-FORM, MEASURED. For ORDER BY id with one 1,000-row page:
// - a direct single-term `.like('payload->>name', ...)` alternated between
//   the trigram index and a primary-key walk (min 116ms, about half of 20
//   samples at 300 to 680ms, one at 4,223ms);
// - the or-form held its minimum at 0ms over a one-row pk read, with one term
//   and with three (.verify/f5-teardown-scale/g1-orform-measure.txt).
// tearDown always issued the or-form. G3's test refuses the direct form in
// those four files, so a guard cannot drift onto a statement nobody runs.
//
// WHY LIKE, NOT ILIKE (cause C2): on that walk the filter runs on every row
// it passes, and ilike on payload->>'name' costs about 24x like per row.
export const tagOr = (tags) => tags.map((t) => `payload->>name.like.${t}%`).join(',')

// NOT A TAG FILTER. A deliberate per-row cost for a calibration injection:
// leading-wildcard ilike branches no index can serve. It lives here, in the
// guard's own module, so adding another use means editing this file in a diff
// somebody reads (Verification 19's exemption-as-a-call).
export const syntheticNameCost = (n) => Array.from({ length: n }, (_, i) => `payload->>name.ilike.%zq${i}%`).join(',')
