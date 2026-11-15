ROUND: GATE HYGIENE
Base: main at a557000 (confirm by ls-remote; differs: STOP).
Branch: gate-hygiene. First commit: this brief verbatim as
GATE_HYGIENE_BRIEF.md. ls-remote base check at branch and merge.
Rule 18. NordVPN OFF for gate runs. Each phase reports
(REPORT_FOR_CHAT.md, OneDrive, pbcopy) and waits for sign-off.

WHY: three gaps found this week.
G1 A gate run with SKIPPED stages (e.g. PUPPETEER_PATH unset) is not
   guaranteed to read red. A gate that can pass while measuring less is
   the false-completion pattern.
G2 probe-gaps (A1 adjacency, R-US4 containment, ink, now with stage tabs)
   is unwired: nothing runs it unless a round does. 5 failures sat on main
   unseen (Verification 9, unscheduled detector).
G3 The 5 failures themselves, all Commercials, all pre-existing:
   R-US4 #deal-section-1 and .units-row 879 of 876px at 1240 in four
   Per Unit states (3px over); A5 hybrid invoicing radios 72px above
   their schedule at 1240.
ORDER: G3 before G2, so wiring the probe does not turn the gate red.

PHASE 1: INVESTIGATE (read-only)
1. G1: how verify-all reports a skipped stage today (file:line); what
   counts as skipped (browser unavailable, env missing, precondition
   unmet, other); whether the final verdict can read "All N passed"
   with any skip. Measure: one run with PUPPETEER_PATH unset, report
   the verdict line verbatim.
2. G2: probe-gaps full-matrix runtime at all widths and states; its
   preconditions (session, fixtures, server); its flake history if any.
   If runtime would add more than 10 minutes to the gate, STOP and
   propose: (a) a gate stage anyway, (b) a separate scheduled run with
   red notification, (c) a reduced matrix in the gate plus full matrix
   scheduled. Recommend one.
3. G3: for each failure, the measured cause (file:line, the width or
   rule that overflows; why the radios sit 72px from their schedule).
   Classify each fix: a registry/token/width correction against the
   approved picture (ordinary finding), or a change to panel structure
   (mockup rule: STOP and photograph options).
4. Every other unwired browser probe in scripts/ that asserts a
   standing rule: list them with what each guards, for John to decide
   later. Do not wire them.
STOP and report.

PHASE 2: BUILD
G3 first: fix each failure at its cause; probe-gaps full matrix 0
   failures; screenshot each fixed site at 1240/1440/1920 beside its
   reference.
G1: any stage that does not run to a PASS/FAIL result (skipped, not run,
   precondition unmet) makes the verdict red and names the stage. Prove:
   PUPPETEER_PATH unset gives a red verdict naming the browser stages;
   restored gives green. Calibrate: remove the rule, the unset run reads
   green.
G2: per the Phase 1 ruling. If a gate stage: it runs, passes on main,
   and an injected 4px overflow on a rostered container fails the gate
   by name.
STOP and report.

PHASE 3: DESIGN_PRINCIPLES entries (a skipped stage is a failed stage;
a detector nobody runs detects nothing). CURRENT_STATE if affected. Full
gate with PUPPETEER_PATH set, no skips. Push-ready SHA. STOP.

QUEUED, NOT THIS ROUND: factoring on the term screen (mockup approved);
workflow audit_log gap; view-wide keyboard reach of frozen inputs;
revision reason prefill/append; pale Save/Discard on not-mine contact;
C3; refusal wording; CHECKING...; per-lens spider; the single
commercial-gate teardown transport drop (baseline on record).

---

PHASE 1 SIGN-OFF: GATE HYGIENE (appended at the phase it launches)

Incident (background gate run on import): accepted as reported; residue
cleared and re-queried at 0. Lesson recorded: a residue query must be
calibrated against a known row first (the r7h% vs harness_r7h% miss).

G1 (John rules):
(i) Any stage that does not run to PASS/FAIL makes the gate RED and names
    the stage. --round-close kept as an accepted no-op. Record the
    supersession of F6's position in DESIGN_PRINCIPLES with F6's reasoning
    left visible.
(ii) A skip INSIDE a stage is also RED, named by the gate:
    - probe-term-initial-value: rewrite the unconditional SKIP as an
      assertion that the branch is unreachable;
    - probe-stage-probability: the conditional SKIP fails the stage when
      it fires;
    - node "skipped"/"todo" and vitest "N skipped" counts > 0 fail the
      suite stage.
    Calibrate each: inject one skip of each kind, the gate goes red naming
    it; revert, green.
G2 (John rules): probe-gaps joins the gate as a REQUIRED stage
    (needsSession + needsBrowser). Prove: passes on the fixed tree; an
    injected 4px overflow on a rostered container fails the gate by name.
G3 R-US4: proceed as an ordinary finding. Measure wrap first, track
    widening only if wrap cannot fit; add #deal-units-panel and
    #deal-install-panel to the R-US4 roster; screenshots at
    1240/1440/1920. Show the roster change catches the 37px at all three
    widths on the unfixed tree before fixing.
G3 A5 (John rules): option (a). The A5 geometry check measures radios to
    the schedule HEAD, per the probe's own driven check. Product unchanged.
    Calibrate: move the radios 40px away, A5 fails.
G4 (added): verify-all.mjs runs only when executed directly, never on
    import (main-module guard). Prove: importing it starts nothing (no
    process, no harness rows); running it works as before.

ORDER: G4, G3, then G1 and G2. Gate must be green before G2 wires in.

QUEUED (not this round): 23 harness_* stage-gate rules from 2026-09-13
(cleanup to be proposed before applied); the 27 standing-rule probes
triage, including the 4 rotted (leads gated-fields, lead door,
probe-scrollable, plus borderline probe-transition-render) and the 4 with
no unwired reason; probe-dead-selectors has no pass/fail;
probe-version-join exits 0 on SKIP.

Proceed to Phase 2. Stop for sign-off.
