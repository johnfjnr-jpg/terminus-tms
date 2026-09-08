# The UI hygiene round: brief (v2)

Supersedes UI_HYGIENE_BRIEF.md, which parked when its Phase 0 stop
condition fired and became four security rounds. Those rounds are
closed: every write path the door guards on Opportunity surfaces now
refuses non-owners, proven in both directions. This round makes the
UI tell that truth. Governing docs: CLAUDE.md, the tms-round-method
skill, the closed security rounds' close-outs. Re-verify premises
against the tree you are on. This brief's R-series is its own.

## Rulings of record (John, 2026-09-08)

R1. Opening acts, before anything else, one commit each:
    a. tearDown() in scripts/fixtures.mjs scoped by tag, not by
       owner — calibrated both ways: its own fixtures swept, a
       live tagged record from another round left standing. The
       defect ate 66 evidence records mid-round and cannot survive
       another gate run.
    b. The accepted Verification 8 extension lands in CLAUDE.md:
       an unchecked Supabase select dressing an error as a zero,
       with the audit-anomaly false finding as its measured
       argument. Superseded reasoning left visible.
R2. Scope, four items on OPPORTUNITY surfaces only:
    a. The door: the census the parked round never ran, then the
       fix. Enumerate every interactive control on the Opportunity
       view and its tabs (Commercials included) by interaction
       under is-not-mine, not by reading selectors; keyboard
       counts. Then extend the door treatment to the full measured
       set: controls dead under the door, alive without it, with
       named exceptions (Back, navigation, approval view) recorded
       with reasons. The server-refusal proofs are already done by
       the security rounds — do not re-prove enforcement, prove
       presentation.
    b. The stat strip: the Test Bed cost cell added to the React
       strip for converted opportunities, reading the same value
       the Deal Sheet row reads. The dead write into the hidden
       vanilla strip (app.js) and its false "stays OUTSIDE both"
       comment retire with the two claims. Non-converted
       opportunities: measure what the vanilla did, choose, record
       the position.
    c. The Opportunity list: a Reference code column, first
       column, matching the Test Bed list's treatment (col-mono,
       '--' when absent). Field already in the API response.
    d. The Structural Terms notes: the eight visible pg-item-note
       rows convert to the existing help-dot pattern, note text
       carried unchanged, verified by a sweep reading zero visible
       note rows and eight help-dots. One field-help pattern
       across the deal form afterwards.
R3. EXPLICITLY OUT: Test Bed detail surfaces. The door treatment
    and all look-and-feel work there belong to the convergence
    round (TEST_BED_CONVERGENCE_BRIEF.md), so nothing is built
    twice. The Test Bed LIST is untouched by both rounds unless
    the convergence audit pulls it in.
R4. Method unchanged: rulings appended at the phase they launch,
    data changes proposed before applied, final-act gate on the
    exact tree, the word follows the stated gate result, nothing
    pushes without it.

## Phases

Phase 0 — R1's two opening acts, then the door census (read-only
against product code). Deliverable: the control inventory with
covered / not-covered per control. Stop for sign-off.

Phase 1 — the door fix per R2a, calibrated both directions on a
real unowned and owned record, with a live walk of the Opportunity
view and Commercials tab as a non-owner: zero interactive write
controls, count emitted. Stop for sign-off.

Phase 2 — R2b, c, d as three deliberate changes, each with its
verification named in R2. Route/UI tests derive from this brief.
Stop for sign-off.

Phase 3 — final-act gate on the exact committed tree, revert
rehearsed from an explicit ref with the tree hash verified,
reconcile by counting, close-out restating carried items
(including the 19 unexercised routes and concurrency, unchanged by
this round). Nothing pushes without the word, and the word follows
the stated gate result.
