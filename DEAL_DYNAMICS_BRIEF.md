ROUND: DEAL DYNAMICS LENS
Base: main at b5f2b7c. Branch: deal-dynamics.
First commit: this brief, verbatim, as DEAL_DYNAMICS_BRIEF.md (permanent method rule).
ls-remote base-equality check at branch time and again at merge time.
Rule 18 stands: Claude Code never pushes. Stop at push-ready and report the SHA.
NordVPN OFF for gate runs.
Report after EACH phase to REPORT_FOR_CHAT.md, the OneDrive copy
(Documents/Terminus/TMS Testng notes), and pbcopy. Each phase waits for sign-off.

CONTEXT (from Phase 0 report, 2026-11-13, at b5f2b7c)
- Lens set is data (scoring_lenses). Sub-tabs, panes and roll-ups follow the rows.
- No gate, approval or snapshot reads scores. A new lens changes no gate outcome.
- OPP_LENS_SATISFYING_LEVELS = new Set([1,4,5]) at frontend/app.js:4867 is the
  only hardcoded scale assumption. A new scale whose level 1 means "bad" would
  read as MET. This round removes that trap.
- Finding A: assessCommRegulatoryDriver has zero scoring_criterion_stages rows
  and renders nowhere.

JOHN'S RULINGS (2026-11-13)
R-DD1 Fifth lens "Deal dynamics", information only, no gate, equal standing.
R-DD2 Four criteria D1 to D4 (below). Compelling event and competitive position
      dropped as overlaps with existing lenses.
R-DD3 Own scale "Deal dynamics, five level": 1 worst to 5 best. Met at 4 and 5
      only. Reason required at 1 and 2. No Not applicable level.
R-DD4 Which levels count as met becomes DATA per scale level, replacing the
      hardcoded set. Existing scales keep today's behaviour exactly.
R-DD5 Stage rows: Qualification, Solution Alignment (required), Proposal,
      Evaluation, Negotiating.
R-DD6 Finding A fixed in this round: Regulatory driver gets the same stage rows
      as its Commercial siblings (SA required, then P, E, N).
R-DD7 Scored manually by the salesperson. Anchors written as measurable
      thresholds so later email automation can score the same meaning.
NOT IN THIS ROUND: the radar (waits for John's mockup approval), source
tracking of manual vs system scores, the 1240 wraps, the dimmed rows.

PHASE 1: INVESTIGATE THE REMAINING PREMISES (read-only, short)
1. Every reader of satisfying levels: app.js:4867 and any other site, including
   the assessment_current evaluator (transitions.js:586-652) and any server or
   React code. grep calibrated against a known hit.
2. How oppLensRollup treats a criterion with NO score entry: counted in total,
   not met? Cite the line. This decides how Deal dynamics shows on a new deal.
3. Exact column shapes of scoring_scales, scoring_scale_levels, scoring_anchors,
   scoring_criterion_stages, and how "reason required" is stored per level.
4. Stage key values as stored, for the five stages in R-DD5.
5. The existing PROVISIONAL. prefix convention as it appears in stored wording.
STOP and report. No proposal drafting beyond confirming or correcting this brief.

PHASE 2: SATISFIES FLAG (behaviour change, full verification)
1. Migration: add scoring_scale_levels.satisfies boolean not null default false.
   Set true for: Deal evidence five level values 1, 4, 5; Requirement
   confirmation three level values 1, 4. Test Bed scale(s): set to match
   whatever the current code treats as met for them (Phase 1 measures it).
2. Code: every reader from Phase 1 item 1 reads the flag. Remove the hardcoded
   set. The level rows are already fetched with the criteria; no new route
   unless Phase 1 shows otherwise.
3. Proof, before and after on the same records:
   a. The per-lens roll-up for each of the 3 scored opportunities and each
      stage, captured before the change and after. Must be byte-identical.
   b. Injection calibration: flip one level's flag in a test transaction, show
      the roll-up moves, revert. Proves the comparison can see a difference.
   c. A new config invariant: every scoring scale has at least one level with
      satisfies = true. Calibrate it by showing it fails on a scale without one.
STOP and report with the before and after tables.

PHASE 3: SEED THE LENS (data; show the migration before applying it)
Write ONE idempotent migration. Show its full text in the report and STOP
before applying. Apply only after sign-off.
1. Scale "Deal dynamics, five level". Levels:
   1 Poor (reason required), 2 Weak (reason required), 3 Adequate,
   4 Good (satisfies), 5 Strong (satisfies).
2. Lens "Deal dynamics", sort_order 50.
3. Criteria, record_type opportunity, scale as above, sort 1 to 4:
   assessDealClientResponsiveness  "Client responsiveness"
     asks: "How quickly does the client reply to our communications?"
   assessDealTerminusResponsiveness "Terminus responsiveness"
     asks: "How quickly do we reply to the client and move the next step?"
   assessDealEngagementMomentum    "Engagement momentum"
     asks: "Is interaction with the client rising, steady or falling?"
   assessDealClientFollowThrough   "Client follow-through"
     asks: "Does the client complete agreed actions by the agreed date?"
4. Anchors, version 1, every wording prefixed "PROVISIONAL. ":
   Client responsiveness
     1 No reply in 10 or more business days
     2 Replies only after repeated chasing
     3 Replies in 3 to 5 business days
     4 Replies in 1 to 2 business days
     5 Same-day replies; the client starts threads
   Terminus responsiveness
     1 Client waiting 5 or more business days on us
     2 Our replies run past 3 business days
     3 We reply in 2 to 3 business days
     4 We reply the next business day
     5 Same day; we start the next step
   Engagement momentum
     1 No interaction in 30 days
     2 Interaction falling off; client passive
     3 Steady but irregular contact
     4 Regular cadence; both sides active
     5 Interaction increasing; client asks for meetings
   Client follow-through
     1 Agreed actions missed with no explanation
     2 Most agreed actions late
     3 About half of agreed actions on time
     4 Most agreed actions on time
     5 All agreed actions met by the agreed date
5. scoring_criterion_stages for all four per R-DD5.
6. Finding A: stage rows for assessCommRegulatoryDriver per R-DD6.
Proof after applying:
- Live DOM at Solution Alignment: Deal dynamics sub-tab present with 4 rows;
  Commercial shows Regulatory driver (row count up by one, roll-up "of 7"
  becomes "of 8" on the measured record). Screenshot at 1240.
- One score written through the real click path on a TEST opportunity at
  level 3: roll-up shows NOT met. A second at level 4: MET. Then revise
  both back with a reason (append-only; leave the entries, note them).
- A level 1 score without a reason is refused.
- INVARIANT 9 green with the new anchors.
- Test Bed scoring unchanged (row count before and after).
STOP and report.

PHASE 4: PROSE AND STATE DUMP (cosmetic plus small code)
1. Update the "four lenses" text at the sites the Phase 0 report listed
   (index.html:1818; app.js comments at 946, 3449, 3456, 4708, 4855, 4882;
   style.css:5687; DESIGN_PRINCIPLES.md:5744). Wording: count-free where
   possible ("read under each lens") so a sixth lens does not stale it again.
2. scripts/state-dump.mjs prints scoring_lenses, scoring_scales with levels
   and satisfies flags, and scoring_criterion_stages. Regenerate
   CURRENT_STATE.md; the diff must show the new lens, scale, criteria, stage
   rows and Finding A's rows.
3. DESIGN_PRINCIPLES.md gains R-DD4 as a principle: whether a scale level
   counts as met is data on the level, never a value set in code.
4. Record Finding A's cause in DESIGN_PRINCIPLES: a criterion needs criterion,
   anchors AND stage rows; the Round 41 checklist missed the third table.
Then the full gate. Report gate result and push-ready SHA. STOP.

STOP RULES
- Any roll-up difference in Phase 2 item 3a: STOP, do not fix forward.
- Any layout change beyond the fifth sub-tab and the extra roll-up row: STOP
  and photograph (mockup-first rule).
- Anything this brief does not cover that forces a choice: STOP and ask.

PHASE 1 SIGN-OFF (John, 2026-11-13), appended at the phase it launches

Rulings on the Phase 1 report:
C1 ACCEPTED. No satisfies change for Test Bed; DEFAULT_LEVELS untouched;
   Test Bed response stays byte-identical. Phase 2 proof adds one check:
   GET /scoring-criteria?record_type=test_bed response identical before
   and after.
C2 ACCEPTED. Phase 3 measures Commercial at Solution Alignment (6 to 7)
   AND Proposal (7 to 8) on the same record.
C3 NOT IN SCOPE. OPP_FIGURE_BEARING_LEVELS untouched. Add to the carried
   list in the round report.
C4 ACCEPTED. The comment at app.js:4864-4866 claiming a probe goes with
   the set. Do not write a replacement claim; the Phase 2 invariant and
   before/after proof are the guard.
H1 NOTED. Expected per convention.
description column: null, as positioned.

RIDER, Phase 2 step 0 (before any code change):
Sweep for level comparisons by literal value that Phase 1's patterns
could not see. Over src, frontend, frontend-react/src and scripts, grep
for comparisons of a score or level value against a number literal
(e.g. ===, !==, >=, <=, >, < followed by 1-5, and inline arrays or sets
of 1-5 values) near score, level, value or series reads. Calibrate the
pattern on app.js:4867 first. Report every hit with a verdict: decides
met / does not. Any hit that decides met: STOP and report before
building.

Proceed to Phase 2 on the rider's result. Phase 2 stops for sign-off as
the brief says.

PHASE 2 SIGN-OFF (John, 2026-11-14), appended at the phase it launches

Phase 2 ACCEPTED at b4b15a2.
- Ledger row for 20261113000001: inserted by John.
- No database flip. The server never decides met by level (Phase 1), so
  the in-page flip covers the only reader.
- The not-met levels gap is accepted; Phase 3's level 3 case adds a
  direct not-met case on the new scale.
- DESIGN_PRINCIPLES.md:5837 history reference: leave for Phase 4.

Proceed to Phase 3 as the brief states, with the Phase 1 corrections:
- Show the full migration text and STOP before applying.
- Proof measures Commercial at Solution Alignment (6 to 7) and Proposal
  (7 to 8) on the same record.
- Click-path scores on R2 (5e5ca23d): a level 3 score reads NOT met, a level 4
  reads MET, and a level 1 without a reason is refused. Leave the entries
  (append-only) and list them in the report.
- Re-run probe-rollups after applying: the four existing lenses must
  stay identical to the Phase 2 AFTER capture, except Commercial at the
  stages where Regulatory driver now counts (expected and listed).
- Test Bed checksum unchanged.
