# TEST BED WORKFLOW CORE: the Round A build brief

Governing docs, read before anything: CLAUDE.md, DESIGN_PRINCIPLES.md,
INTERACTION_STANDARDS.md, TEST_BED_OLD_VS_NEW_AUDIT.md (the source of every
item here, with file:line evidence), COST_CALCULATIONS.md (context only,
not in scope), and the tms-round-method skill. Where this brief and
CLAUDE.md disagree, CLAUDE.md wins and the disagreement is a finding.

## Rulings at the open (John, 2026-09-17)

- R1. Scope split accepted: this round is the workflow core (B1, B2, B3,
  B5, B6, L1, L5, L6 from the audit, plus the riders named below). Units
  (B4, R-regression, L2, L3, L4) are Round B, a separate brief.
- R2 (audit C1). The separate per-stage Record scores button STAYS. The
  fix is the contract and the semantics behind the button, not a return
  to the Save-bar interception.
- R3 (audit C2). The reject-the-keystroke numeric guard STAYS. No work;
  ruling recorded so the vanilla's withdrawn-blocking history is not
  re-litigated.
- R4 (audit L11). Back to test beds RETURNS, navigating to the test bed
  list. It rides this round.

## Rulings at the Phase 0 sign-off (John, 2026-09-17)

- R5 (P0.5 finding). Phase 3.1's acceptance is restated in the positive
  form below; the vacuous edit-bar line is removed.
- R6. The Phase 0 probe becomes a committed instrument under
  scripts/testbed-core/, with an index of its evidence. New files only.
- R7. The pre-commit hook fix rides this round: pre-commit-suites.mjs
  derives ROOT from its own location, calibrated both directions (refuses
  on an injected red suite, passes on green). The only edit to an existing
  script this round outside the phases.
- R8 (supersedes the Phase 0 report's Phase 4 note). The blocked list
  persisting across tab switches is VANILLA PARITY, not fix-created: the
  old element cleared only at the top of the next transition attempt.
  Phase 4 matches that and adds no tab-change clear.

## Standing constraints

- Behaviour and data changes throughout, so the FULL treatment applies:
  Phase 0 live reproduction, both-direction calibration on every new
  check, proof on the real screen (presence is not visibility, CLAUDE.md
  V4), gate on the exact tree.
- NO SERVER CHANGES in this round. Every fix is client-side against
  routes that already exist. If any item turns out to need a server or
  policy change, STOP that item and report; do not widen scope.
- Every number in a report is emitted by its run. A claim of absence
  names the instrument. Full output captured to file and the file read.
- Fixtures are shaped from what the SERVER sends, never from what the
  reader wants. Six of the audit's findings exist because fixtures were
  shaped to the reader; this round must not add a seventh.
- Nothing pushes without John's explicit word. Reports paste back to
  chat for sign-off before the next phase proceeds.

---

## PHASE 0: live reproduction of the six claims (read-only, no fixes)

The audit is a reading of both sides of each contract; this phase turns
each claim into a measurement on the live screen, and it is also the
calibration baseline the fixes are proven against.

Reproduce, with emitted evidence (network capture, DOM read, or
screenshot, whichever the claim needs):

- P0.1 (B1) Record a score on a stage tab; capture the request body and
  the 400 response.
- P0.2 (B2) Open a stage whose gate names scored criteria; show the
  scoring card's criteria count is zero while `/api/scoring-criteria`
  answered non-empty.
- P0.3 (B3) Open Qualification on a record with real exit criteria; show
  the panel reading its empty state while the network response carries
  `requirements`.
- P0.4 (B5) Click Next Stage on a blocked record; capture the 422 with
  its blocking list and show nothing rendered.
- P0.5 (B6) Select a buyer contact; show no network write fires and the
  edit bar's resulting state.
- P0.6 (L1) Show no control exists that can reach the measurability
  route (instrument: a DOM sweep for its writers plus the route's server
  log or network absence during a full walk of Qualification).

STOP CONDITION: any claim that fails to reproduce stops the round for
John's ruling before any fix is drafted. A claim that reproduces
DIFFERENTLY from the audit's description is a finding, reported with the
measurement.

Deliverable: a Phase 0 report, one measurement per claim, pasted for
sign-off.

## PHASE 1: exit criteria (B3 + L6)

Map the route's real response, `{ from_stage, to_stage, blocking,
requirements[] }`, and restore the vanilla's panel behaviour, derived
from the audit's behaviour list and the old source at `54001c5^`
(test-bed-detail.js:1454-1610), never translated line by line:

- 1.1 The summary line: "N of M outstanding to move to {to_stage}",
  counted over ALL requirements, and the all-met sentence. Final-stage
  and no-criteria messages naming to_stage.
- 1.2 Met state comes from the server's own `met` field, never derived
  client-side from the payload.
- 1.3 TICKABLE REQUIRES BOTH CONDITIONS: requirement_type is
  payload_field_required AND the field is a member of the four-key
  TB_EXIT_CRITERION_KEYS set AND it carries a label. Everything else
  renders as a computed read-only row. This is the safety half: a click
  must never write a timestamp into a score, contact-role or document
  field.
- 1.4 The process-vs-data-entry visibility split (isProcessRequirement,
  ported with its recorded min_length caveat).
- 1.5 Tick writes an ISO timestamp, untick writes null, through the
  existing revision-carrying patch. The per-record tick QUEUE is
  deliberately NOT rebuilt: at this product's scale a rapid double-tick
  answering 409 and reloading is a safe failure. Documented position
  under the scale ruling; revisitable.
- 1.6 The tick feedback element.
- 1.7 Pending marks land in Phase 2 (they read score drafts); the hook
  point is left named.

Calibration must include, firing and silent: the real route response
shape driven into the component (a hand-shaped array fixture is
forbidden here); a non-key payload_field_required requirement rendered
read-only, with an injection making it tickable shown to redden a test;
the outstanding count asserted over all requirements against a response
where met rows are hidden by the split.

## PHASE 2: scoring (B1 + B2 + L1 + L5, under R2)

- 2.1 Criteria sourcing: the stage panel's criteria derive from the
  fetched criteria's own stage rows (criterion.stages includes the open
  stage), reusing the host's existing allCriteria fetch. The dead
  `scoring` state and its reader are removed, not left.
- 2.2 Series come from the record payload, ordered by `at` (the same
  reader QualificationScore already uses; one reducer, two renderers).
- 2.3 The contract fix, client-side: the Record button posts ONE entry
  per criterion, `{ criterion, score, reason? }`, sequentially in panel
  order, with the vanilla's stated partial-failure semantics: a recorded
  score stands, the first failure stops the run, the message names what
  was recorded and what was not by criterion name, everything not
  recorded stays drafted for a retry. The server is untouched.
- 2.4 Measurability (L1): the yes/no row appears exactly when the open
  stage's requirements name measurabilityConfirmed, saves immediately on
  its own route, and shows the current confirmation with its entry line.
- 2.5 L5 depth, ported from the old renderer against the behaviour list
  in MIGRATION_TEST_BED_CAPABILITIES.md: current value beside the name
  ("Not scored" when none); the asks line; the anchors block (toggle
  with aria-expanded, per-level wording, no-wording marking, version
  line, auto-open while a draft is pending, a made close surviving the
  next focus); history rows newest-first showing when, who, value,
  stage, version, comment, reason, and the anchor wording resolved
  against the entry's OWN anchorVersion; the reason box with
  required/optional labelling; the entry lock disabling the OTHER
  selects while a reason is awaited, the blocking criterion keeping its
  own control, the lock note naming the criterion, and focus moving into
  the reason box.
- 2.6 Pending marks on the exit criteria panel: dot, dashed border and
  the word "unsaved" on a row whose score draft would satisfy it, by
  mutation of state the panel renders from, never touching a
  server-met row.

Calibration must include: the real client body driven into the real
route (the exact seam B1 broke on), shown accepted; the partial-failure
path shown stopping with the named message on an injected refusal; the
lock shown holding and releasing in both directions; measurability
appearing on Qualification and absent elsewhere.

## PHASE 3: buyer links (B6)

### Rulings and addenda at the Phase 2 sign-off (John, 2026-09-17)

- R10. The per-stage Record scope stands: a draft made on another stage's
  tab stays there, and the button sends the open stage's scores only. It
  follows R2 and is not revisitable this round.
- R11. MIGRATION_TEST_BED_CAPABILITIES.md is a HINT, not the authority, for
  the rest of this round: C6 proved it is inference over the vanilla. Where
  it and the vanilla at 54001c5^ disagree, the vanilla wins and the
  disagreement is a finding. C6 and C9 are annotated at the round close, not
  now.
- Addendum (a), reported in Phase 3's report: provoke a REAL mid-run refusal
  from the server during a live Record run (three drafts, the second a
  revision without a reason) and read the outcome back from the database.
  Closes Phase 2's "does not establish" line on S7.
- Addendum (b), reported in Phase 3's report: width measurements for the
  scoring card at 1240 and 3440, the treatment Phase 1 gave the exit panel.
- Phase 3 is built under the P0.5 finding: the buyer rows are not registered
  in the draft store, so this builds the direct-write control; acceptance is
  R5's positive form, all three observable live.

- 3.1 Acceptance, all three observable on the live screen: selecting a
  contact fires POST /test-beds/:id/buyer-contacts; per-role feedback
  renders for that role; a linked role displays the contact's name
  read-only. (The previous "edit bar can no longer show a change that
  saves nothing" line is removed: P0.5 measured it already true on the
  broken screen, so it could not fail. R5.)
- 3.2 The "+ New" inline contact creation returns, through the shell's
  existing openInlineBuyerContactModal seam (app.js already supports the
  test_bed context at its 3131 region). If the seam cannot be reached
  cleanly from the bundle, report the measured options rather than
  minting a second modal.
- 3.3 Both directions on the door: owner links successfully, a
  non-owner's attempt is refused and the refusal is visible.

## PHASE 4: the riders (B5 + R4 + L9)

### Carried at the Phase 3 sign-off (John, 2026-09-17)

- The route accepting a second contact in an already-linked role is noted
  for ROUND B's server scope, not a general list.
- The buyer rows are measured at 1240 and 3440 in Phase 4's run, the
  treatment addendum (b) gave the scoring card.
- Phase 4 runs under R8 (no tab-change clear) and R11 (the vanilla at
  54001c5^ wins over the capabilities document; a disagreement is a finding).
- 4.1's closing proof is P0.4 re-run under a new run label, plus a
  calibration showing the live proof redden with the id removed.

- 4.1 B5: the transition feedback element carries
  id="tb-next-stage-feedback" again beside its testid. Proven live: a
  blocked transition renders the itemised blocking list; calibrated by
  removing the id and showing the proof redden. Per R8, the list clears
  only at the top of the next attempt, as the vanilla did; no tab-change
  clear is added.
- 4.2 R4: a "Back to test beds" control in the view header, navigating
  to the test bed list through the shell.
- 4.3 L9: the six read-only rows return where the old screen had them:
  Terminus Reference (under the name), Industry and Stage in Terminus
  Details; Account in Customer Details; Date Created and Age in Key
  Dates, Age computed at display time from created_at.

## PHASE 5: the close

### Rulings at the Phase 4 sign-off (John, 2026-09-17)

- R12 (Phase 4 finding 1, refines R8). The blocked list CLEARS on the host's
  own load() after a save, and nowhere else. R8's no-tab-change clear stands.
  Reason beyond parity: after a save the list can be actively wrong, demanding
  the very thing just recorded, and a refusal that contradicts what the user
  just did is worse than no message. Built and calibrated both directions; the
  live proof shows the list gone after a host-internal reload and still present
  across a tab switch.
- R13 (Phase 4 finding 4). The pre-commit hook gains a typecheck stage, riding
  this close as its own commit on the R7 precedent. Calibrated both directions:
  refusing on an injected type error, passing clean. Running tsc by hand is a
  person-shaped guard and does not survive the next session.
- The close additionally: annotates the capabilities document's C6 and C9 per
  R11, and gives K3's timing its own paragraph rather than a carried line.
- Carried into ROUND B, not this close: the route accepting a second contact in
  an already-linked role; K1's journal hole; the server refusal text naming "a
  score of 1 or 2"; exit-criteria-live.json's staleness treatment if the close
  does not settle it.


Gate on the exact tree, revert rehearsal from an explicit ref with the
tree verified byte-identical, reconciliation by counting (commits
against sign-offs, items against this brief), CURRENT_STATE.md
regenerated with its staleness check stated, candidate CLAUDE.md
promotions proposed not landed (the fixture-shaped-to-reader lesson is
the obvious candidate; check first whether Verification 47 already
covers it and extend rather than duplicate), the exit gate answered
point by point, then the round waits for the word.

## Exit gate

1. All six Phase 0 claims reproduced, then shown closed by the same
   instrument that reproduced them.
2. Every new check calibrated in both directions, with the injection
   named against the test it must falsify.
3. No hand-shaped fixture stands where a server shape exists.
4. No server file changed.
5. Gate green on the exact tree; nothing pushed without the word.

## Out of scope, recorded

Units (Round B). The tick queue (documented position, 1.5). C2 as ruled.
L7, L8, L10, L12, C9 ride Round B or a later hygiene batch unless a
phase here touches their file anyway, in which case the report says so
and asks.

## Carried list, recorded at the Phase 1 sign-off (John, 2026-09-17)

Not fixed in this round.

- K1. The edit-journal hook accepts untracked edits to a file that
  already carries one tracked edit (Phase 1 report, process notes).
- K2. `frontend-react/src/__tests__/fixtures/exit-criteria-live.json` is
  a snapshot of the current gate configuration and needs a staleness
  treatment at the round close.
- K3. The database gate stage ran about 160s against 112 to 126s
  earlier, passing. Watch the shape.

## Ruling at the Phase 1 sign-off: Phase 2 order (John, 2026-09-17)

- R9. The starvation is fixed before the contract: 2.1, then 2.2, then
  2.3, then 2.4, 2.5, 2.6. The closing proof is a live run recording a
  real score end to end and reading it back from the database, plus the
  P0.1 and P0.2 sections of probe-p0 re-run under a new run label. The
  report states at its top which model the session is running.
