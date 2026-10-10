// ── THE SHARED MILESTONE VOCABULARY (TP_CAPEX, C-11) ──────────────────────
//
// The milestone NAMES, defined once and used by both Commercials (the customer
// and contractor milestone grids) and term pricing (the Hybrid CAPEX rows).
// NAMES ONLY, NO PRICING LOGIC: nothing here computes, rounds or validates an
// amount. Commercials' arithmetic stays in milestone-schedule.js, and the term
// pricing engine never sees a name at all (it takes a milestone as an opaque
// key, R-TP1 part 1 with no exception, Q4).
//
// THESE ARE THE PROTOTYPE'S OWN SIX, in its own order, from the
// `projectMilestone` picklist at `Terminus Ops.dc.html:5592`, moved here
// unchanged from frontend-react/src/deal/milestones.ts, which re-exports them
// as CONTRACTOR_MILESTONES so none of its readers move.
//
// QUEUED, NOT BUILT (John, R-W12): this could be a vocabulary TABLE, the way
// `contact_roles`, `contact_stances`, `industries` and `closed_lost_reasons`
// already are. That is a schema change and a configuration decision; the
// constant is neither.

export const MILESTONE_NAMES = Object.freeze([
  'Contract start',
  'Hardware delivered to site',
  'Installation complete',
  'Commissioning',
  'Go live',
  'Final acceptance',
])
