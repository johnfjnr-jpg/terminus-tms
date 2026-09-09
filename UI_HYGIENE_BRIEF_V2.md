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
       view and its tabs (~~Commercials included~~ STRUCK, see R5)
       by interaction under is-not-mine, not by reading selectors;
       keyboard counts. Then extend the door treatment to ~~the
       full measured set~~ STRUCK, see R6. The treatment targets
       the OPERATING surface, not the control list: controls dead
       under the door, alive without it, with named exceptions
       (Back, navigation, approval view) recorded with reasons.
       The server-refusal proofs are already done by the security
       rounds — do not re-prove enforcement, prove presentation.
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

R5. ASSESSMENT SURFACES ARE IN SCOPE FOR THE R2 TREATMENT PHASES,
    ON EQUAL FOOTING WITH COMMERCIALS. Ruled on the Phase 0
    census, which measured where the door's gaps actually are:

        tab                 reachable write controls
        Assessment          52
        Commercials          8
        Solution Alignment   5
        every other tab      0

    R2a's "(Commercials included)" is struck rather than deleted,
    per this repository's supersession convention. It was not
    wrong when written; it was written before anything had been
    measured, and both briefs were drafted around the Commercials
    deal panel because that is where the parked round's one live
    observation came from. THE MEASUREMENT PUT 52 OF 65 SOMEWHERE
    NOBODY HAD LOOKED. A round that treated only Commercials would
    have closed 8 of 65 and reported the door fixed.

R6. THE TREATMENT PHASES TARGET THE OPERATING SURFACE, NOT THE
    CONTROL LIST. R2a's "extend the door treatment to the full
    measured set" is struck for the same reason: a set of controls
    is not what a person operates.

    Two gaps, both measured in Phase 0, and neither is closed by
    listing controls:

    a. THE LABEL OPERATES THE INPUT. The thirty Assessment score
       inputs are pointer-events:none and not mouse-reachable. A
       click at one's own coordinates still CHANGED ITS CHECKED
       STATE, because the click lands on label.opp-assess-level,
       which is pointer-events:auto. Eight labels are reachable
       where all thirty inputs are not. The door was applied to
       the control and not to the thing that operates it, so a
       treatment that hardens the control list changes nothing a
       person can do.
    b. THE KEYBOARD PATH IS THE LARGER HALF. Under the door,
       mouse reachability falls from 38 to 19 and keyboard
       reachability only from 58 to 46. FORTY-SIX write controls
       are keyboard-reachable on a record the user does not own.
       The A12 precedent already in R2a's spirit applies: a
       control the door refuses drops its tab stop.

    Phase 1's calibration is stated in these terms rather than in
    control counts: on an unowned record, no path - mouse, label,
    or keyboard - reaches a write, and on an owned record every
    one of them still does.

R7. COMMIT HYGIENE, ruled at the Phase 0 sign-off. The act-1
    departure (two untracked briefs swept in by `git add -A`) is
    ACCEPTED as recorded. History is not rewritten. From here,
    changes are staged BY NAME and `git add -A` is not used again
    this round.

R8. THE TWO ESTATE INSTRUMENT DEFECTS ARE QUEUED as the first item
    of the next writing phase, not fixed now:
    probe-readonly-view.mjs waits on a condition that cannot be
    satisfied (`getElementById('ref-display-name')` exists and is
    permanently empty, so the `||` never reaches the populated
    element), and it swallows the resulting timeout with
    `.catch(() => {})`, so it measures without waiting at all.

R9. GATE COMPOSITION AMENDED, and it is a DECISION OF RECORD because
    it reverses a standing by-design exclusion. verify-all.mjs
    carries a comment stating that the browser probes are run by the
    round and deliberately not by the gate. probe-readonly-view
    JOINS THE GATE as a stage, CONDITIONAL on the repaired probe
    proving stable across this phase's runs.

    The reasoning, recorded because the exclusion was deliberate and
    a later reader must be able to see which way this went and why:
    A PROBE THAT FAILS CORRECTLY TO NOBODY IS A FALSE-COMPLETION
    SIGNAL AT THE GATE LEVEL. Measured this phase: the probe has
    been reporting the door gap at both widths, naming the exact
    control the census names first, and reporting it to nothing,
    because nothing runs it. This round exists because of that
    silence.

    IF THE PROBE PROVES UNSTABLE IN THIS ENVIRONMENT, STOP AND
    REPORT. The gate is not reasoned forward. The fallback, a
    separate named pre-push step, needs John's word and is not a
    session decision.

R10. A SERVER-SIDE REJECTION PROBE is added to scope and built this
    phase. What it must establish: a non-owner write against
    Opportunity tables is REJECTED AT THE SERVER, through the app's
    real auth path.

    - It authenticates as a REAL NON-OWNER USER JWT. Never the
      service role. A declared policy is not an enforcement, and
      `USING (false)` is dead code against a role that bypasses RLS,
      so a probe through the service role proves nothing and MUST
      NOT EXIST.
    - Targets are TAGGED FIXTURES, created and swept by the act-1
      teardown. No live or untagged record is touched.
    - Calibrated both ways: shown REJECTING the non-owner write on
      the healthy policy, and shown PASSING, the write landing, when
      the policy is weakened by injection. Harness discipline in
      full, the policy restored byte-identical, a reverted run at
      the end.
    - It starts with the writes THE CENSUS PROVED REACHABLE: the
      assessment inputs and Mark Closed Lost. Then the remaining
      write surfaces on Opportunity tables, ENUMERATED FROM THE
      SCHEMA, not from the UI.

    - IF ANY WRITE LANDS ON THE HEALTHY POLICY, STOP IMMEDIATELY,
      report the finding with record ids, and wait. That is a LIVE
      SECURITY FINDING and belongs to John before anything else
      moves.

    COMPLETE. The clause above was delivered truncated at "If any
    write" and was recorded as incomplete rather than finished by
    inference, because a stop rule that was assumed rather than
    stated is worth nothing when it fires. John supplied it verbatim
    and the conservative interim reading was correct, so nothing
    built in between rested on the lenient reading.

R11. THE P2.6 PROMOTION QUEUE, recorded at the phase that produced
    it rather than discovered at the close. Positions of record,
    none requiring a ruling.

    a. A DETECTOR MUST NOT BE KEYED ON A NUMBER THE DEFECT LEAVES
       ALONE OR IMPROVES. Four attempts were needed to catch the
       container kill, and TWO OF THE THREE FAILURES WERE
       STRUCTURAL rather than bugs: a container kill removes
       CAPABILITY while leaving POPULATION intact, so counts
       either improve or freeze.

           reachable write controls   FALLS   2 -> 1
           disclosure candidates      FROZEN  37 -> 37
           reachable disclosure       0 -> 0, already zero healthy
           effect on a named affordance   RESPONDED -> inert

       The table is carried verbatim. The distinction to preserve
       against Verification 33 is a measure that CANNOT SEE the
       thing versus a measure that MOVES THE WRONG WAY.

    b. AN EDIT THAT THREW BEFORE WRITING, PLUS A RUN THAT
       PROCEEDED, IS INDISTINGUISHABLE FROM A RUN ON THE EDITED
       FILE. It produced a green calibration that established
       nothing, and was caught only by reading the traceback in
       the capture. The remedy in use is to ASSERT THE ARTEFACT
       CHANGED before launching the run. It is the byte-snapshot
       discipline's missing sibling on the WRITE side: the
       harness rules already require comparing bytes after a
       restore, and say nothing about confirming an edit landed
       before measuring. Proposed as an extension to those rules
       rather than a new number.

    c. FOR THE FINDINGS SECTION, one line: two instruments
       disagreed about CLASSIFICATION, not about the product. The
       census counted a sub-tab panel as a write control while
       the door's own rule correctly excluded it. Both now share
       one structural test - a control does not contain other
       controls - and any future instrument inherits it rather
       than re-deciding.

## Phases

Phase 0 — R1's two opening acts, then the door census (read-only
against product code). Deliverable: the control inventory with
covered / not-covered per control. Stop for sign-off.

Phase 1 — the door fix per R2a as amended by R5 and R6, calibrated
both directions on a real unowned and owned record, with a live
walk of the Opportunity view as a non-owner across ~~the
Commercials tab~~ STRUCK, see R5: Commercials, Assessment and
Solution Alignment, the three tabs the census found carry reachable
write controls: zero reachable by mouse, label or keyboard, count
emitted. Stop for sign-off.

Phase 2 — R2b, c, d as three deliberate changes, each with its
verification named in R2. Route/UI tests derive from this brief.
Stop for sign-off.

Phase 3 — final-act gate on the exact committed tree, revert
rehearsed from an explicit ref with the tree hash verified,
reconcile by counting, close-out restating carried items
(including the 19 unexercised routes and concurrency, unchanged by
this round). Nothing pushes without the word, and the word follows
the stated gate result.
