// ── THE LENS ROLL-UP, ONE COMPUTATION FOR THE ROWS AND THE RADAR ─────────
//
// DEAL RADAR Phase 2, 2026-11-14. Lifted out of frontend/app.js
// (oppLensRollup and oppAssessSeries) so the existing rows and the radar
// read one implementation, Architecture rule 3. `app.js` is a classic script
// and cannot import, so frontend-react/src/main.tsx publishes both functions
// onto `window`, the transport format-dates.js already uses. A transport is
// not a second implementation.
//
// Display only. Nothing here gates a stage: the server's score gates check
// presence and recency, never a value (DEAL DYNAMICS Phase 1).

// A criterion's score entries, oldest first. The ONE sort: oppAssessSeries in
// app.js is a caller of this, not a copy of it. `at` compared as a string,
// exactly as before the lift, so the rows cannot move.
export function assessSeries(entries) {
  return Array.isArray(entries)
    ? [...entries].sort((a, b) => String(a?.at).localeCompare(String(b?.at)))
    : []
}

// An entry is inside `asOf` when its `at` is at or before it, compared as
// INSTANTS (ruled at the Phase 1 sign-off). The two sources do not share a
// format: entries carry milliseconds and `Z`, the audit log microseconds and
// `+00:00`. Date.parse keeps milliseconds, and an entry has no finer grain,
// so dropping the asOf's microseconds cannot move an entry across it.
//
// An entry whose `at` does not parse is NOT inside any asOf: nothing can say
// it came before the stage change, so it is not counted as having done so.
function inside(entry, asOfMs) {
  const t = Date.parse(entry?.at)
  return Number.isFinite(t) && t <= asOfMs
}

// The roll-up of ONE lens at ONE stage, from a record's payload.
//
//   total   criteria in this lens asked at this stage
//   met     those whose LATEST entry is at a level flagged `satisfies`
//           (R-DD4: data on the level, never a value set in code)
//   scored  those with ANY entry. Unknown counts: it requires a reason, so it
//           is a deliberate answer (R-RAD3)
//
// asOf null reads every entry. A timestamp reads only entries at or before it
// (R-RAD4), so "latest" means latest as at that moment.
//
// The lens is a parameter rather than a filter the caller applies, so the
// rule for which criteria belong to a lens at a stage lives here once.
export function lensRollupAt(lensId, criteria, payload, stage, asOf = null) {
  const mine = (criteria ?? []).filter((c) => c.lens_id === lensId
    && (c.stages ?? []).some((st) => st.stage === stage))
  const asOfMs = asOf == null ? null : Date.parse(asOf)
  if (asOf != null && !Number.isFinite(asOfMs)) throw new Error(`lensRollupAt: unparseable asOf ${asOf}`)
  let met = 0
  let scored = 0
  for (const c of mine) {
    const all = assessSeries(payload?.[c.criterion_key])
    const series = asOfMs == null ? all : all.filter((e) => inside(e, asOfMs))
    if (!series.length) continue
    scored++
    // A value with no matching level is not met.
    const v = Number(series[series.length - 1].value)
    if ((c.levels ?? []).some((l) => l.value === v && l.satisfies === true)) met++
  }
  return { met, total: mine.length, scored }
}
