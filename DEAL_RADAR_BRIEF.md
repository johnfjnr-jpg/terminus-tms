ROUND: DEAL RADAR
Base: main at cdd689e (confirm by ls-remote; if origin differs, STOP).
Branch: deal-radar.
First commit: this brief verbatim as DEAL_RADAR_BRIEF.md, together with
prototypes/deal-radar-option-b.html (John placed it in the tree; commit it
as the mockup of record). ls-remote base check at branch time and merge time.
Rule 18: Claude Code never pushes. NordVPN OFF for gate runs.
Report after EACH phase to REPORT_FOR_CHAT.md, the OneDrive copy, pbcopy.
Each phase waits for sign-off.

WHAT THIS ROUND BUILDS
A radar ("spider") chart of the lens roll-ups on the Exit criteria card,
beside the existing "Assessment by lens" rows, per the APPROVED MOCKUP
prototypes/deal-radar-option-b.html (John, Option B, 2026-11-13; legend
added 2026-11-14). Mockup-first rule applies: geometry assertions cite it;
any layout question it does not answer is a STOP with photographed options.
Display only. Writes nothing. Gates nothing.

RULINGS
R-RAD1 Axis value = the existing per-lens roll-up at the tab's stage:
       met / total, as a fraction 0 to 1. No average, no new arithmetic
       on scores. Met = the level's satisfies flag (R-DD4).
R-RAD2 Axes in lens sort_order, first at the top, clockwise. Order never
       varies by data. Axis count follows the lens rows (five today).
R-RAD3 Coverage = criteria with ANY score entry / total, at the tab's
       stage. Unknown counts as scored (it requires a reason, so it is a
       deliberate answer). Coverage < 0.5 (strictly under half) draws that
       axis dashed in the --attention token and its label in --attention.
R-RAD4 Overlay: a dashed shape scoring TODAY's criteria at the tab's
       stage using only entries at or before the record's last stage
       change. No stage change yet: no overlay, and its legend key is
       absent. Computed, never stored.
R-RAD5 Every stage tab shows its own radar, matching the rows beside it.
R-RAD6 Axis labels derived from the lens name: several words give
       uppercase initials (Deal dynamics -> DD), one word gives its first
       three letters uppercase (Commercial -> COM). No label list in code.
R-RAD7 A lens with no criteria at a stage draws its axis with no point,
       labelled with its short label only; the polygon skips nothing
       (that vertex sits at the centre). Fewer than 3 lenses: no radar,
       rows only.
R-RAD8 Legend under the radar: Now / Last stage / Under half scored,
       each key shown only when that element is on screen.
R-RAD9 The rows beside the radar are unchanged. No "since last stage"
       figures (John, 2026-11-14).
R-RAD10 Accessible: role="img" and an aria-label stating each lens's
       met of total, and naming low-coverage lenses.

PHASE 1: INVESTIGATE (read-only)
1. The last-stage-change timestamp: where a stage transition is
   recorded (stage-transition write, revisions, transition requests),
   the field that holds it, and whether the page already has it.
   For the 3 scored opportunities and one never-transitioned record,
   print the value the radar would use.
2. The Exit criteria card's markup and layout at 1240, 1440, 1920 on
   every stage tab: the roll-up block's container, its width, and the
   space the mockup's radar (280 x 210) needs beside it. Measure whether
   it fits without wrapping or overflow. If not: STOP and photograph
   options for John (mockup-first rule).
3. The estate guards the radar must join: the A1 adjacency roster, the
   containment guard, the ink/overprint enumeration, the dead-selector
   source check. Name each and what a new container needs to be rostered.
4. Tokens available: the green accent, --attention, muted text, border.
   Name the token for each mockup colour. Any mockup colour with no
   token: report, do not invent one.
5. Where oppLensRollup could be lifted into src/lib (isomorphic, shared,
   never copied) as a pure function lensRollupAt(criteria, payload,
   stage, asOf) returning met, total, scored. Confirm the pure suite can
   test it and list every current caller.
STOP and report.

PHASE 2: PURE ROLL-UP (behaviour-neutral refactor, full verification)
1. Add lensRollupAt to src/lib with asOf filtering (entries with at <=
   asOf; asOf null = all) and a scored count. oppLensRollup calls it
   with asOf null. No other behaviour change.
2. Pure tests: unscored criterion (counted in total, not met, not
   scored); Unknown (scored, not met); satisfies true/false; asOf
   excluding a later entry; asOf before any entry; empty lens. Each
   test injection-calibrated: break the function, the test fails.
3. probe-rollups: AFTER must equal the current main capture byte for
   byte on all cells and DOM blocks. Any difference: STOP.
STOP and report.

PHASE 3: THE RADAR (UI, per the mockup)
1. Render the SVG radar in the roll-up block on every stage tab,
   R-RAD1 to R-RAD10. Values from lensRollupAt only. Geometry from one
   pure function (points for n axes and fractions), pure-tested.
2. Proof:
   a. For R1, R2, R3 at every stage tab: each polygon vertex's distance
      from centre / ring radius equals met/total for its lens (tolerance
      0.5px). Assert from the DOM, not from the function that drew it,
      and include one semantic anchor computed by hand in the report.
   b. Coverage: an axis is dashed iff scored/total < 0.5. Show at least
      one dashed and one solid on real data; if no real record has a
      lens exactly at 0.5, cover 0.5 in the pure test.
   c. Overlay: present on a record with a stage change, with vertices
      equal to lensRollupAt at that timestamp; absent on a
      never-transitioned record, and its legend key absent too.
   d. Axis order matches lens sort_order; labels COM ORG TEC LEG DD.
   e. Screenshots at 1240, 1440, 1920 beside the mockup; join every
      estate guard named in Phase 1 item 3; containment and ink checks
      green with the radar rostered.
   f. 0 non-GET requests from the card.
   g. Test Bed untouched (checksum).
STOP and report.

PHASE 4: CLOSE
DESIGN_PRINCIPLES: record R-RAD1 to R-RAD10 and the overlay rule's reason
(stages ask different criteria, so the overlay rescores today's set).
Regenerate CURRENT_STATE if anything it reads changed. Full gate.
Report push-ready SHA. STOP.

STOP RULES
- Any roll-up difference in Phase 2: STOP.
- Radar does not fit the card at any width: STOP and photograph.
- Any colour without a token: report, do not invent.
- Anything this brief does not cover that forces a choice: STOP and ask.

QUEUED, NOT THIS ROUND: gate skip rule (any skipped stage turns the gate
red); C3; refusal wording on never-scored criteria; "CHECKING..." on
unowned records; per-lens spider (parked by John).

RULINGS AT PHASE 1 SIGN-OFF (John, 2026-11-14), appended as they launch
Phase 2. Pasted verbatim:

PHASE 1 SIGN-OFF: DEAL RADAR

LAYOUT: John approves Option A as photographed (radar 280 x 210 centred
above the unchanged rows, legend between them, card grows ~245px).
This AMENDS the mockup of record: commit the Option A screenshots at 1240
and 1920 under prototypes/deal-radar-option-a-live-*.png with a note in
prototypes/deal-radar-option-b.html's header comment: "Arrangement
superseded by Option A (stacked) 2026-11-14, John; size, colours, legend
and geometry stand." Phase 3 geometry assertions cite both.

R-RAD4 source: (a) latest of audit_log action='transition' timestamp and
approved transition_requests closed_at, compared as INSTANTS, via the
existing GET /records/:id/history. No server change. Backward moves count.
No source: no overlay.

Degenerate overlay: drawn whenever a stage change exists, legend key shown;
aria-label states the last-stage figures.

Fill: color-mix(in srgb, var(--green) 18%, transparent). No new token.

Positions ACCEPTED: rows not tinted; series sort lifted into src/lib with
oppAssessSeries as a caller (one sort, not two); transport via
frontend-react/src/main.tsx onto window (format-dates precedent), bundle
rebuilt and committed.

Guard scope ACCEPTED: probe-gaps.mjs extended to visit stage tabs so the
radar block and the existing lens rows join A1 and R-US4. Count this in
Phase 3.

Phase 1 roll-up values from the faulted layout probe: not to be quoted
anywhere. Phase 2 re-measures.

QUEUE (finding, not this round): workflow transitions
(decide_transition_request, raise_transition_request zero-track) write
no audit_log row; the audit trail is incomplete for approved moves.

Proceed to Phase 2 as the brief states. Stop for sign-off.
