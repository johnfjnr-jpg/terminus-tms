// ── THE REGION LIST, ONCE ────────────────────────────────────────────────
//
// R3 of the LEADS CARD POLISH 2 round, ruled server-derived.
//
// Phase 0 measured SIX live copies of these five values and none of them
// authoritative: contact/descriptors.ts, testbed/descriptors.ts,
// account/descriptors.ts, reference/descriptors.ts, app.js's
// TB_MATRIX_REGIONS, and three hardcoded <option> blocks in index.html. Plus
// two more in tests. Nothing in the database.
//
// Six readers of one list is Verification 20 at scale, and the reason it has
// survived is that every copy is correct today. They agree; they simply have
// no reason to go on agreeing.
//
// ── WHY THE SERVER AND NOT A SHARED CONSTANT ─────────────────────────────
//
// A shared frontend constant would still be a constant each surface chooses
// to import. Served, it is DERIVED - the same property that made `jobRole`
// reach the New Lead grid's mandatory markers with no edit to the grid, and
// the same shape `creation-requirements` already uses for `sources` on this
// exact screen.
//
// ── WHAT IS DELIBERATELY NOT DONE ────────────────────────────────────────
//
// The six copies are NOT re-pointed here. Lead Detail is FROZEN and editing
// its descriptors would touch the surface John has still to walk for parity;
// the others are re-pointed when their own surfaces are next opened. So this
// round adds a source and one reader, and does not pretend the drift is
// closed. It is closed one surface at a time.
export const REGION_OPTIONS = [
  'Americas',
  'Europe & UK',
  'Middle East',
  'APAC',
  'Africa',
]
