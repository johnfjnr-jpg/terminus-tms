// ── THE DEAL RADAR'S RULES, PURE ─────────────────────────────────────────
//
// DEAL RADAR Phase 3, 2026-11-14. Everything the radar decides that is not
// drawing: where a vertex sits, what an axis is called, when an axis is low
// coverage, and when the record last changed stage. app.js draws from these
// and nothing else, through the same window transport as lens-rollup.js.
//
// Geometry is the mockup of record's (prototypes/deal-radar-option-b.html,
// amended to Option A): viewBox 480 x 360, centre (240, 190), outer ring 140.

export const RADAR = Object.freeze({ width: 480, height: 360, cx: 240, cy: 190, r: 140 })

// R-RAD2: axis i of n, first at the top, clockwise. SVG's y runs down, so
// "up" is minus cosine.
//
// R-RAD1: a vertex sits at fraction x radius along its axis. A fraction outside
// 0 to 1 is clamped, and one that is not a number sits at the centre, so a bad
// input can never draw outside the ring or vanish from the polygon.
export function radarPoints(fractions, geo = RADAR) {
  const n = fractions.length
  return fractions.map((f, i) => {
    const a = (2 * Math.PI * i) / n
    const k = Number.isFinite(f) ? Math.min(1, Math.max(0, f)) : 0
    return { x: geo.cx + geo.r * k * Math.sin(a), y: geo.cy - geo.r * k * Math.cos(a) }
  })
}

// Where axis i's label sits, and which way it is anchored. Offsets reproduce
// the mockup's label positions to within 2px of its five.
export function radarLabelAt(i, n, geo = RADAR) {
  const a = (2 * Math.PI * i) / n
  const s = Math.sin(a), c = Math.cos(a)
  // Further out vertically than sideways: a label beside an axis needs only to
  // clear the vertex, one above or below it must clear its own cap height.
  return {
    x: geo.cx + (geo.r + 12) * s,
    y: geo.cy - (geo.r + 14) * c + 7 - 7 * c,
    anchor: Math.abs(s) < 0.1 ? 'middle' : (s > 0 ? 'start' : 'end'),
  }
}

// R-RAD6: several words give their initials, one word its first three
// letters, uppercase either way. Derived, so a renamed lens relabels itself.
export function lensShortLabel(name) {
  const words = String(name ?? '').trim().split(/\s+/).filter(Boolean)
  if (words.length > 1) return words.map((w) => w[0]).join('').toUpperCase()
  return (words[0] ?? '').slice(0, 3).toUpperCase()
}

// R-RAD3: strictly under half of the lens's criteria at this stage carry any
// entry. A lens with no criteria at the stage has no coverage to be low
// (R-RAD7 labels it with its short label only).
export function isLowCoverage({ scored, total }) {
  return total > 0 && scored / total < 0.5
}

// R-RAD4, its source as ruled at the Phase 1 sign-off: the LATEST of
//   - an audit_log row with action 'transition' (its `timestamp`), and
//   - an APPROVED transition request of kind 'transition' (its `closed_at`),
// compared as INSTANTS. Backward moves count, because both sources record
// them the same way. A review request moves nothing, so it is not a source.
//
// Returns the winning timestamp exactly as its source spelled it, or null
// when the record has never changed stage. A value that does not parse is
// skipped rather than allowed to win.
export function lastStageChangeAt(auditEntries, requests) {
  const candidates = [
    ...(auditEntries ?? []).filter((e) => e?.action === 'transition').map((e) => e.timestamp),
    ...(requests ?? []).filter((r) => r?.kind === 'transition' && r?.status === 'approved').map((r) => r.closed_at),
  ]
  let best = null, bestMs = -Infinity
  for (const t of candidates) {
    const ms = Date.parse(t)
    if (Number.isFinite(ms) && ms > bestMs) { best = t; bestMs = ms }
  }
  return best
}
