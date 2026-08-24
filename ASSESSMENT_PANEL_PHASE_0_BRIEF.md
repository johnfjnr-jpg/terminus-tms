# Assessment panel: usability

## Phase 0, investigation and plan

**Round number to be confirmed against the repo.** Round 27 merged to `main`
at `2b3247d`.

---

## What this phase is

**Investigation and a plan. No file edits, no migrations, no code, no
configuration changes.**

---

## What this round is

The business scored a real opportunity against the seven Commercial criteria
and reported that the panel is unusable. Verbatim:

> *"I can tell you now that no sales person is going to have time to read all
> that. Screen layout is terrible. I would get tired completing this as part
> of my job."*

**That is the six-month watch item arriving at month zero.**
`OPPORTUNITY_DESIGN.md` records the test as whether scores get maintained or
whether somebody re-saves the same numbers to clear the gate. The instrument
is tiring before anyone has used it in anger.

**This round comes before Round C.** Configuring twenty-five more criteria
into a panel that is already painful would build the problem four times
larger.

**Measured from the screenshot:** each criterion carries roughly **170px of
permanently-expanded anchor block**. Seven criteria is over 1200px of anchor
text before anything is scored. **Test Bed collapses anchors behind a
toggle. Opportunity does not, and that is the regression.**

---

## The six items, and what was decided

### 1. Per-criterion anchor wording is mostly one rule written thirty-five times

The business's observation, and it is correct. Read side by side:

| | Budget confirmed | Metrics and quantified value | Funding mechanism |
|---|---|---|---|
| Our hypothesis | Terminus believes a budget exists | Terminus has estimated the value | Terminus has assumed a mechanism |
| Buyer confirmed | A named person has stated a budget exists | The buyer has stated the value | A named person has stated which mechanism |

**The step from hypothesis to confirmed is *who said it*, and that is the
same for all thirty-two criteria.** That was the virtue of the evidence-state
model and the round that configured Commercial wrote it out longhand anyway.

**The decision: generic wording lives on the scale level. Per-criterion
anchors become optional overrides.**

The generic wording, agreed with the business:

| Level | Wording |
|---|---|
| Not applicable | Not applicable |
| Unknown | Unknown at this time |
| Our hypothesis | Our hypothesis, a Terminus assumption |
| Buyer confirmed | Buyer confirmed, stated by a named person |
| Verified | Verified, evidenced, corroborated or documented |

**One exception is real and must survive.** *Not applicable* genuinely
differs per criterion and carries information: "rarely applicable, a
commercial deal has a budget question" against "the buyer is not making a
value case, a mandated or compliance-driven purchase" against "not applicable
where the buyer has already stated the purchase route." Verified may differ
too, since what counts as corroboration varies.

**Overrides should be rare. If more than a quarter of criteria need one, the
generic wording is wrong.**

### 2. The text belongs in the control, not permanently on screen

The business's framing: the wording appears in the dropdown or as a reminder,
and **only the level name goes in the record**. Anyone who knows the scale,
which is everyone after the first week, never sees the block.

### 3. Criterion name and question on one line

Two lines per criterion for a name and a prompt. The screenshot shows
"Budget confirmed" and "Is money identified and committed" stacked.

### 4. One save for the panel, not one per criterion

The screenshot shows `RECORD` and `CANCEL` under each criterion. **Test Bed
has a shared save bar and the business asked for Test Bed's pattern.**

**A caution that is not a reason to avoid it.** Round 11A found `.find()`
used where `.filter()` was meant in exactly this mechanism: scoring five
things and pressing Save once silently kept one and lost four. **The
verification must change all seven and save once.**

**And the business asked for an unsaved-changes warning on navigating away.**
Check `INTERACTION_STANDARDS.md` before treating that as new machinery.

### 5. Current reason only; history behind a control

Round 26 Phase 1 made the current reason prominent and left history visible
beneath it under "Previously". With seven criteria and repeated scoring that
grows without bound.

### 6. One review tick, confirmed

The business initially raised four ticks, one per lens, and settled on one:

> *"It's just a tick for the approvers to acknowledge they have reviewed. At
> that point, it's on them. They move to approve the stage transition based
> on the assessment as it was at the time of approval."*

**Round 27's single `assessmentReviewed` key stands unchanged.** No
per-lens ticks.

**The second sentence carries something structural.** See I1.

---

## Investigations

### I1. Does an approval already point at the assessment it was given against?

**The question.** `approvals` stores `revision_number` alongside `track`,
`stage` and `approver_id`, and the assessment lives in
`record_revisions.payload`. **Does an approval therefore already reference
the exact state of the assessment at the moment of approval?**

**Verify, do not assume.** Report whether `revision_number` is written from
the record's current revision at approval time, whether it is reliable, and
whether the payload at that revision can be resolved back.

**If it holds**, the snapshot the business described exists and needs
surfacing rather than building, which is a much smaller thing. Report what
displaying it would take. **Do not build it in this round.**

**If it does not hold**, that is a real gap and it matters more than the
layout. Report it and stop short of designing a fix.

### I2. The anchor mandate collides with generic wording

**The question, and it is the round's central mechanical problem.**

Round 24 Phase 0 established two things: the write path **refuses any
criterion with no anchors** with a 409, and `INVARIANT 8` requires every
gated criterion to carry anchors.

**So moving wording to the scale level and deleting per-criterion anchors
would break scoring outright.**

Report the options and their costs. Candidates:

- **A description column on `scoring_scale_levels`**, with anchors becoming
  optional and the write path relaxed to accept a criterion whose scale
  supplies wording.
- **Anchors stay as rows and are simply not displayed.** No mechanism change,
  and thirty-five rows of near-duplicate text remain in the database as the
  authority for nothing.
- **Something else the codebase suggests.**

**Report what `INVARIANT 8` would need.** It covers only
`payload_field_required` rules today and cannot see `assessment_current`,
recorded in Round 24 and still unfixed. **Do not choose.**

### I3. The panel, and how far Test Bed's patterns transfer

Round 25 Phase 6 took the shape of `renderTbScores` and left the shared save
bar, the eleven module-level Test Bed variables, and the
`measurabilityConfirmed` special case.

**The business is now asking for the thing that was left.** Report what the
shared save bar does on Test Bed, how its draft state is held, and how far it
transfers to a panel that already has its own state.

Report the collapse toggle: how Test Bed hides anchors by default, and
whether the same control works when the wording moves to the scale level and
may not need a block at all.

Report the layout change for one line rather than two, measured at 1240 and
1920, not estimated.

### I4. The unsaved-changes warning

**The question.** Does anything in this system already warn on navigating
away with unsaved edits, and does `INTERACTION_STANDARDS.md` govern it?

Report what "navigating away" means here: a sub-tab change, a top-level tab
change, a record change, or leaving the page. **Those are four different
events and probably four different answers.**

### I5. What the design cannot express

The six items were settled from a screenshot and a written log without
repository access. **Output item 4 has caught the brief's central premise
being wrong three times in seven rounds.**

---

## The plan to produce

Small phases, each verifying, each committing. Suggested shape, argue with
it:

| Phase | Content |
|---|---|
| 0 | This investigation |
| 1 | Generic wording on the scale, per the I2 decision |
| 2 | Anchors collapsed or moved into the control |
| 3 | Criterion and question on one line |
| 4 | One save for the panel |
| 5 | Current reason only, history behind a control |
| 6 | Unsaved-changes warning, per I4 |
| 7 | Full walk and close-out |

**Argue with it.** If I2 shows the anchor mandate is expensive to relax,
Phase 1 grows or the second option becomes the honest one. Phases 2 and 3 may
merge, since both are the same block.

---

## Verification requirements

**Test Bed pixel-identical**, calibrated at each step against an injected
change, as every round since Round A. `.tb-crit-row` is shared, so anything
new must be an additive modifier.

**Phase 4 must change all seven criteria and save once**, and assert all
seven landed in the database. Round 11A is the precedent and it lost
four-fifths of a save.

**Every browser interaction at least three times in sequence without
reloading.**

**Look at it.** This round is about whether a panel is tiring to use, which
is the property no assertion measures. Round A Phase 4 shipped no diff and
found a three-phase-old defect by looking; Round B Phase 6 found eye travel
growing without limit by measuring the rendered text edge rather than the
box.

**Wait on state only the new write satisfies.** Round 26 hit a fixed delay
twice, and Round 25 Phase 7 produced a convincing off-by-one from a wait the
previous render already satisfied.

**Enumerate teardown from the database by tag**, never from a fixture file.
Round 27 Phase 1 found two records no fixture file named.

---

## Explicit non-goals

- **Round C.** The other three lenses and the remaining twenty-five criteria.
  **This round comes first and Round C waits for it.**
- **Per-lens review ticks.** Raised and settled at one.
- **Building the approval snapshot display.** I1 reports; it does not build.
- **`assessment_current` rollup rules.** Built, unused, staying that way.
- **Whether an answer is required above some level** on Budget confirmed.
  Deferred to Round C.
- **The Risk assessment.** Not designed.
- **Coverage and confidence, creation checks, reason on incomplete approval.**
  Round D.
- **`measurabilityConfirmed`.** Its own round.
- The Reference tab round, reopening a loss, the open-decisions table
  convention, the `CURRENT_STATE.md` blind spot, `INVARIANT 8` not seeing
  `assessment_current`, `approver_id` resolving to nobody.

---

## Output format

1. **I1 to I5**, each with the command run or the interaction performed, the
   actual output, and the finding.
2. **The I2 options**, with costs, presented for a decision and not chosen.
3. **The I1 answer**, stated plainly as holds or does not hold.
4. **The phase plan**, with the argument for any departure.
5. **Anything that cannot be built as stated.**
6. **Any disagreement between a generated file and a hand-written one**,
   reported and not resolved.

Then stop and wait for sign-off.

---

# Phase 0 report

Round 28. Investigation only, no code. Signed off 2026-08-24.

Setup: the brief was committed to `main` at `6f7f001` before branching, the
round branch was taken from `main` rather than from `2b3247d` so it carries
its own scope from the start (build discipline rule 9), and the dev server and
API token were restarted and calibrated in both directions before any reading
was trusted.

---

## I1. The approval snapshot. IT HOLDS

**Probe:** score a criterion, approve, **score again after the approval**, then
resolve the approval's revision back to a payload. Scoring after approving is
the discriminator: a live pointer shows the new score, a snapshot does not.

```
step 1  score assessCommBudgetConfirmed = 3   -> 201 ; max revision now 2
step 2  POST approvals (no revision_number in the body) -> 201
        approval.revision_number = 2
        max revision after approving: 2   (an approval writes no revision: true)
step 3  score assessCommBudgetConfirmed = 5 AFTER -> 201 ; max revision now 3
step 4  payload AT revision 2: series [3]
        payload at latest  (3): series [3,5]
        THE DISCRIMINATOR  the approval's revision does NOT show the later score: true
        each revision stores the FULL payload, not a delta: 4 keys at that revision
```

**Written from the current revision at approval time: yes.**
`src/routes/approvals.js:41-63` resolves the max revision when the body omits
one, and the browser always omits it. The error branch is checked, with a
comment recording that a fallback to 1 would durably record an approval
against the wrong revision.

**Resolvable: yes, in one SELECT.** `append_record_revision` merges the patch
into the current payload and inserts the WHOLE merged result
(`supabase/migrations/20260821000001`), so every revision row is a complete
payload. No replay.

**Reliable: yes, enforced by the database rather than by convention.**
`record_revisions` has RLS enabled with only `record_revisions_select` and
`record_revisions_insert`. There is no UPDATE or DELETE policy anywhere.
Measured: UPDATE and DELETE each affected 0 rows and the series was unchanged
afterwards. Calibrated, because the same client inserted into `audit_log`
successfully, so the refusal is a policy result rather than a broken client.
Zero update, delete or upsert calls against `record_revisions` exist in `src/`
(calibration: `records` carries 3 `.update()` calls).

**THE CAVEAT TO CARRY.** The snapshot is taken at the instant of the POST, not
at the instant the approver read the panel. **A score written in between lands
inside the approved snapshot.** The approver approves what the record said
when they pressed the button, which is not necessarily what they read.

**What surfacing it would take.** `GET /records/:id/approvals` already returns
`revision_number` on every row. What does not exist is any way to fetch a
payload at a given revision: zero routes mention `revision` in a path
(calibration: the same grep finds 6 route declarations in `records.js`). One
read-only endpoint, or an extension to the approvals response, plus display.
Not built, per the brief.

---

## I2. The anchor mandate. THE BRIEF'S PREMISE IS PARTLY WRONG

**What the write path actually requires.** `score-entry.js:148-158` selects
**only `version`** from `scoring_anchors`. It never reads `wording`. The 409
means *an anchor row must exist for this criterion*, not *per-criterion
wording must exist*.

**INVARIANT 8 does not constrain these seven criteria at all.** Its filter is
`payload_field_required` rules whose field `startsWith('score')`. Measured
against the live configuration:

```
stage_gate_rules: 93 rows
rules naming a field: 49
fields starting with "score": 8     <- the five Test Bed criteria
fields starting with "assess": 4    <- all four are assessmentReviewed, not a criterion
assessment_current rules: 0
```

No gate rule names any `assessComm*` criterion.

**INVARIANT 9 is the binding constraint, and the brief does not mention it.**
It asserts every stored score references a COMPLETE anchor version. Measured
on live records: 36 criterion series, **62 score entries, every one stamped
`anchorVersion: 1`**, of which 11 sit against five of the seven Commercial
criteria. Deleting the 35 anchor rows would leave all 62 pointing at a version
that no longer exists. `npm run test:db` is currently 59/59 including
INVARIANTs 8 and 9.

**Two further measured facts.** `scoring_anchors` has no UPDATE or DELETE
policy, append-only by design and stated in its own table comment, so deletion
needs a migration rather than an API call. `scoring_scale_levels` carries
`id, scale_id, value, label, created_at, reason_required` and **no description
column**. The five-level scale uses values 1 to 5, so
`scoring_anchors.score CHECK (1..5)` is not in the way.

**A correction to the brief's framing.** The 35 rows are not "the authority for
nothing." They are the authority for the provenance of 62 live score entries,
which is exactly what anchor versioning exists to provide.

### THE DECISION: OPTION C

**Keep every anchor row. Add the description column to
`scoring_scale_levels`. Display precedence is per-criterion wording at this
version if present, else the scale-level description.**

Chosen because it is the literal reading of the business's own request that
per-criterion anchors become optional overrides; it never relaxes the mandate,
because a row still exists to stamp a version; and it leaves INVARIANT 9
untouched.

**What a future criterion with no anchors does stays open.** It still 409s,
which is correct until someone needs otherwise.

**What INVARIANT 8 would need**, recorded and not built: widen the filter from
`startsWith('score')` to any rule field matching a
`scoring_criteria.criterion_key` for that record type, and add
`assessment_current` resolution.

---

## I3. The panel. THE PREMISE IS WRONG IN BOTH HALVES

Measured on the real screen, on a fixture advanced to Proposal where all seven
criteria are visible. Six are visible at Solution Alignment, one at
Qualification, seven from Proposal onward.

| State at 1240px | Pane height | Anchor blocks open | Record/Cancel pairs |
|---|---|---|---|
| virgin, nothing touched | **818px** | **0 / 7** | 0 |
| every select focused | **2252px** | **7 / 7** | 0 |
| a level chosen on all seven | **3266px** | 7 / 7 | **7** |

1920px is within 16px throughout. Individual anchor blocks measure **189 to
222px**, so the brief's 170px estimate understates it. 3266px against an
1100px viewport is three screens.

**Opportunity DOES collapse anchors:** 0 of 7 open when virgin.

**Test Bed does NOT offer a toggle either.** Its function is
`showTbScoreAnchors` (`test-bed-detail.js:1848`) and it only ever sets true.
Opportunity's is named `toggleOppAssessAnchorsOpen` but its own comment reads
"Idempotent: re-focusing does not close them." Both fire on `onfocus`.
**Neither can be closed.** Measured: zero buttons, links or summaries in the
pane, and refocusing leaves the block open.

**So this is a SHARED ONE-WAY REVEAL, not an Opportunity regression**, and
focusing a select is unavoidable when scoring it, so scoring all seven opens
all seven permanently for the session.

**The shared save bar does not transfer as a component.** Test Bed's score
drafts go into `tbEdits`, the same dirty map every other Test Bed field uses,
and `#tb-save-all` is wired to `saveTbFields`. It is record-level machinery
that scoring participates in. Opportunity has no equivalent: `oppEdits` 0
references, `opp-save-all` 0, `dirtyEntries` 0 in `app.js` against 11 in
`test-bed-detail.js`. Phase 5 builds a dirty registry; it does not lift a bar.

---

## I4. The unsaved-changes warning, AND A LIVE DEFECT

**Nothing warns, anywhere.** Zero `beforeunload` handlers and zero `confirm()`
calls in the whole frontend. Calibrated: dispatching a cancelable
`beforeunload` is not prevented, and with a handler deliberately installed it
IS prevented.

**`INTERACTION_STANDARDS.md` governs it and says it is not built.** Section 5,
under a header reading "Specification only, not yet implemented." A working
shared discard dialog already exists: `#discard-confirm-modal` with
`openDiscardConfirm`/`closeDiscardConfirm`, defined once in `app.js` and
reused by New Lead and Park. What does not exist is the system-wide
dirty-state registry. Section 5 already names this panel's exact case: an
unrelated deliberate action threatening someone else's unsaved edit elsewhere
on the page.

**Four events, four different answers, and only one is a loss:**

| Event | Measured | |
|---|---|---|
| Sub-tab (lens) change | draft survives | not a loss |
| Top-level tab change and back | draft survives, 0 dialogs | not a loss |
| **Record change** | **draft carried onto the other record** | **a defect** |
| Leaving the page | silent discard, no handler | the only real loss |

**THE DEFECT.** `oppAssessDraft`, `oppAssessReason` and `oppAssessAnswer` are
module-level maps keyed by criterion and **never cleared on record load**.
`loadOpportunityDetail` does not touch them.

```
A, dirty:  select "4", reason "I4 unsaved reason on record A"
3. on a DIFFERENT record B: selectValue "4", reason "I4 unsaved reason on record A"
   B shows record A's unsaved draft in its select: true
   B shows record A's unsaved reason:              true
   dialogs so far: 0
```

Record B renders with record A's unsaved judgement pre-selected and A's reason
in the box, with Record live. **One click writes A's assessment onto B, and it
would look entirely deliberate in the history.** A warning does not fix this;
clearing the maps on record load does.

**Found by asking what "navigating away" means rather than by looking for it.**
The brief's instruction to separate the four events is what surfaced it.

---

## I5. What the design could not express

Four premises settled from a screenshot, checked against the repository:

1. **INVARIANT 8 blocks deletion.** Wrong for these seven. It cannot see them.
   INVARIANT 9 is the binding constraint and is not mentioned.
2. **Test Bed collapses, Opportunity does not.** Wrong in both halves.
3. **Roughly 170px.** Understated. 189 to 222px measured.
4. **Thirty-five rows as the authority for nothing.** They are the authority
   for 62 live entries' provenance.

Plus the cross-record draft defect, which the design could not have known and
which is more serious than any of the six items.

**One item is already true and needs no phase.** Item 2's "only the level name
goes in the record": a score entry stores `{at, by, value, anchorVersion,
stage}` plus optional reason, comment and answer. The label is resolved from
the scale at render time.

---

## Cannot be built as stated

**Deleting per-criterion anchors.** It would break INVARIANT 9 for 62 live
score entries, and `scoring_anchors` has no DELETE policy, so it would need a
migration rather than an API call. Option C keeps every row, which is why it
was chosen.

---

## The accepted phase plan

| Phase | Content | Change from the brief |
|---|---|---|
| 0 | This investigation | as briefed |
| **1** | **Clear the assessment draft maps on record load** | **new, and first** |
| 2 | A close control for the anchors block, **on Test Bed as well as Opportunity** | briefed 2, narrowed, promoted, and widened |
| 3 | Generic wording on the scale, per option C | briefed 1, moved after 2 |
| 4 | Criterion and question on one line | briefed 3, kept separate |
| 5 | One save for the panel | briefed 4 |
| 6 | Current reason only, history behind a control | briefed 5 |
| 7 | `beforeunload` guard, plus the discard dialog on record change | briefed 6, narrowed |
| 8 | Full walk and close-out | briefed 7 |

**Phase 1 is new and first** because the draft bleed can write one
Opportunity's judgement onto another, it is a handful of lines, and every later
phase touches the same state. Fixing it afterwards means five phases built on a
panel that can mis-attribute a score.

**2 before 3** because the collapse control is the largest measured win
available and is independent of the option C decision.

**2 and 4 are not merged.** The anchors block is its own container with its own
state; the one-line head is a layout change to `.opp-assess-head`, which is
shared markup. Different blast radius.

**PHASE 2 COVERS BOTH RECORD TYPES.** The one-way reveal is Test Bed's too,
identically. This project has recorded nine instances of a fix built for the
screen that existed at the time; fixing only Opportunity would be the tenth,
made deliberately. Build discipline rule 6.

**Phase 7 shrinks** because three of the four navigation events are not losses
and the record-change case is Phase 1's defect rather than a warning. It is a
`beforeunload` guard plus reuse of the existing discard dialog, not the
system-wide registry `INTERACTION_STANDARDS.md` specifies.

Phases 2, 4 and 6 all touch markup or classes Test Bed shares or mirrors, so
each needs the pixel-identical check with an injected calibration.

---

## Records for the close-out

### R1. INVARIANT 8's second blind spot

It sees the Test Bed five and **nothing from the Opportunity assessment**,
because its filter reads `startsWith('score')` and the assessment criteria are
`assessComm*`. This sits beside the `assessment_current` blind spot recorded in
Round 25 Phase 1 and still unfixed. **Two blind spots, one recorded and one
not**, in an invariant whose stated job is to catch a gate nothing can satisfy.

### R2. `CURRENT_STATE.md` does not record `scoring_scale_levels` at all

Zero mentions. `scoring_scales` appears once, only as a migration filename in
the ledger list. `scripts/state-dump.mjs` never reads the table: 0 references,
calibrated against `scoring_anchors` at 3, searched with `grep -a` for the
NUL-byte trap.

**That table is exactly where option C puts the wording.** As it stands, a
change to the generic level wording would not appear in the configuration
changelog, which is the file's stated purpose. A generated file and a
hand-written intention disagreeing, reported rather than resolved.

### R3. A capture that passed both its guards and was still mostly background

The first capture of the draft state cleared its clip-height guard and its
file-size guard and was still blank below the fold, because the pane lives
inside `.app-content-scroll` and only the scrolled viewport paints.

**The Round 17A refinement failing in a new way.** That rule says to confirm
the element is inside the captured region and to sanity-check that the capture
is not empty. Both were done. **The capture was non-empty AND mostly
background**, because "inside the clip" and "painted" are different questions
once a scroll container is involved. Re-taken at a viewport tall enough to
paint the whole pane. The measurements were never affected, since they came
from the live DOM, which is exactly what makes this the dangerous shape.

### R4. The RLS refusal presenting as error none, rows affected 0

The UPDATE and DELETE against `record_revisions` returned no error and zero
rows, because RLS filters the rows out rather than raising. **Verification 8's
shape**, working in our favour here, and a caller not checking the row count
would read it as success. The immutability guarantee is real; the way it
reports itself is not self-announcing.

---

## Phase 8: the full walk

One Opportunity through Qualification, Solution Alignment and Proposal. The
assessment work through the UI, because that is this round's subject; the
generic exit criteria and the approvals through the API, because they are not.
The strip clicked once to reach a control and not again.

**The walk found no problem.** Every round before this one found something in
the walk that the targeted phases did not, so that is a result worth stating
plainly rather than assuming it means the walk was weak.

### The three things this round made worth watching

**Phase 1 and Phase 7 against each other, for the first time.** Drafted at
Qualification with a level, a reason and a figure, then navigated to another
record. Phase 7's dialog opened BEFORE Phase 1 could clear: the dialog showed,
the record had not changed, and the draft was still held. Keep editing returned
all three, the figure included. After the save, the same navigation was silent
and completed. The ordering is right: the warning is upstream of the clearing,
so the clearing never runs on work the person has not been asked about.

**Phase 5 and Phase 6 on the same entries from different ends.** Four criteria
drafted at Solution Alignment and saved with one press: "Recorded 4 of 4", all
four grew in the database, and the re-scored Budget confirmed went to two
entries. Its history control then read **"Show 1 earlier assessment"**, and the
three criteria scored once offered no history control at all. The count is the
series minus the current entry, which is what "earlier" has to mean.

**Phase 6's removal of both auto-open routes, under a walk.** The definitions
block was opened by hand, closed by hand, and then a level was chosen: it
stayed closed. It was still closed on arrival at Solution Alignment, and still
closed at Proposal after a full walk, including with all seven criteria in
draft.

### The number the business asked about

Measured on a fresh record at Proposal, in the same two states Phase 0
measured, identical at 1240 and 1920:

| | Phase 0 | Phase 8 | |
|---|---|---|---|
| collapsed, nothing touched | 818 | **687** | -131 |
| a level chosen on all seven | 3266 | **1463** | **-1803, 55 per cent** |

Zero block-level overflow at either width. At an 1100px viewport the drafting
state went from three screens to just over one.

**Where it came from, and one correction to how it was described.** Phase 2's
close control is the largest single contributor, but its 1506px was measured
against a state that no longer exists, because Phase 6 stopped the definitions
opening at all. What the round actually did is remove the two lines per
criterion (Phase 4, 208px), take the history out of the default view (Phase 6,
626px on a record with three entries each), and stop the definitions block ever
opening by itself (Phases 2 and 6 together). Phase 3's generic wording
contributes 16px of height and its win is reading effort rather than scrolling,
which was stated when it was measured.

### One mislabelled assertion, recorded rather than tidied

The Proposal check printed "exactly the four re-scorable criteria offer history"
against an assertion of `historyToggles.length === 1`. The assertion is right,
because only Budget confirmed had been scored twice at that point; the label
was written for a state the walk did not reach. The check passed for the right
reason and said the wrong thing, which is the milder half of the family this
round has been recording: a label that describes the intent rather than the
test.

---

## Phase 9: the discarded errors, and the round's close-out

### The 22, and a correction to this phase's own premise

**The 11 scripts are not in the repository.** `.gitignore` excludes
`/verify-*.mjs` and `/debug-*.mjs` at the repo root, deliberately, with the
reason written beside it: one-shot verification harnesses are round-scoped,
hardcode absolute paths and need `session-ref.json`, while reusable tooling
lives in `scripts/` and is tracked. `git ls-files` returns exactly one match
for verify or debug, and it is `scripts/verify-harness.mjs`.

So "leaving it means the next probe inherits it" is true for a session on this
machine and false for anyone cloning the repo. The phase was worth doing on the
first reading and the second reading is narrower than the first. Fixed anyway,
because a future session in this working copy reads these files, which is how
Phase 3 found them.

**They are dead.** Nothing references them: not `package.json`, not
`.github/workflows/test.yml`, which runs `npm test` only, and no tracked file
names any of them.

**All 22 are one shape, and it is not the shape Phase 2 hit.**

| shape | count |
|---|---|
| a WRITE whose `error` is discarded, Verification 8 | **22** |
| a list READ coerced to `[]`, the false-clean shape | **0** |

Every one is the same statement, twice per file:
`const { data } = await db.from('records').update({ deleted_at: ... })`. That
confirms Phase 3's separate finding rather than restating it: the list shape
exists nowhere else, and these are its cousin, not its instances.

### The verification, which is a re-scan and nothing more

These scripts are dead and untracked, so there is no behaviour to run and
manufacturing one would be worse than saying so.

```
discarded-write shape remaining:   0
discarded-read  shape remaining:   0
delErr destructured:              22
delErr actually CHECKED:          22

CALIBRATION, pattern known PRESENT: 'await db.from(' -> 29
CALIBRATION, pattern known ABSENT:  'zzz-not-a-real-pattern' -> 0
```

The destructured count and the checked count are reported separately on
purpose. The first version of this fix named `delErr` and never read it, which
would have been a fix that satisfies a grep for the pattern and checks nothing.

---

## Rule 7, under its corrected wording

**The sign-offs were enumerated from the conversation FIRST, and `git log` was
opened afterwards.** The order is the control: a list derived from the commits
and then checked against the commits is a check against itself.

| Sign-off | Commit |
|---|---|
| Phase 0 | `c5aa493` |
| Phase 1 | `5f28ae0` |
| Phase 2 | `a73afb5` |
| Phase 3 | `82ba541` |
| Phase 4 | `bd06f91` |
| Phase 5 | `bd485f3` |
| Phase 6 | `02d9473` |
| Phase 7 | `08be6e1` |
| Phase 8 | `53a9a7d` |
| Phase 9 | this commit |

Nine sign-offs before this one, nine commits, one to one, none missing. Plus
`6f7f001` on `main`, the brief committed before the branch was cut: instructed
work, not a phase, and accounted for as such.

---

## `CURRENT_STATE.md`, regenerated and reconciled

Regenerated at `53a9a7d`. The diff reconciles to the phase list except for one
entry, which is the rule earning its keep.

- **72 migrations, up from 71, with `20260824000002_scoring_scale_level_description.sql`
  listed.** Phase 3.
- **Soft-deleted rows up by 249, live count unchanged at 94.** This round's
  fixtures, created and torn down. Accounted for.
- **One live Opportunity moved from Qualification to Solution Alignment.**
  No phase accounts for it. **Investigated rather than resolved quietly:**
  `TT-SGP-SMARTC-003`, and every audit row on it carries
  `actor 75425a02`, the business account, never `266a2812`, the test account.
  The business reviewed the assessment at Qualification at 09:14:57Z,
  transitioned at 09:15:08Z, and scored four Commercial criteria between
  09:25 and 09:32.

**The business was using the product during this session**, and the
reconciliation rule is what surfaced it.

### What that means under build discipline rule 9

The machine runs UTC+8. The business finished at **09:32Z, 17:32 local**. This
round's first commit was **17:59 local** and its first code change was Phase 1
at roughly **18:25 local**. Phase 0 was investigation and changed no file.

**So the business was served Round 27's merged code throughout, and the
exposure rule 9 describes did not occur.** It did not occur because of the
ordering, not because anything prevented it, which is exactly what Round 17A
recorded: timing, not design.

**One exposure is open now and should be named.** The dev server was restarted
from this branch's working tree at 19:11 local and has served the branch since.
The round is not merged. Anyone opening the app now sees the whole unreleased
round. No business action is recorded after 09:32Z, so nobody has, but that is
an observation about what happened rather than a control.

---

## Records carried beyond the phase list

### R1. The false-clean teardown

`j?.data ?? []` turned three 401s from an expired token into three empty arrays,
and the sweep reported **TEARDOWN CLEAN** while three fixtures sat live.

Previous instances of the third-state species produced a false **zero**. This
produced a false **pass**, which is worse: a zero invites a second look and a
pass closes the question. The only thing that caught it was a warning written
into the sweep for exactly that case, "nothing found to tear down, so the zero
below is uncalibrated". An absence that had not been manufactured would have
read identically. The helper now throws on a non-2xx.

Phase 3 swept for the same shape everywhere else in tracked code and found
none: `verify-harness.mjs`, `state-dump.mjs` and all nine test files check
every read.

### R2. The blind instrument, both halves

**Calibrated on the elements the PROBE measures rather than the elements the
PHASE changed.** The Phase 2 comparison measures fourteen selectors and fired
correctly in Phases 2 through 5. For Phase 6 the injection was aimed at
`.tb-score-entry` and `.tb-score-current`, Test Bed's own equivalents of what
that phase changed, and **fired zero**, because neither is in the measured set.
"Zero differences" came from an instrument that could not have seen the change.

**A calibrated instrument stays calibrated only for the change it was
calibrated against.** Verification 17 at one remove.

**And the record had no history to compare.** The Test Bed used through Phases
2 to 5 has no scores at all, so `.tb-score-entry` rendered zero times and a
history comparison would have passed on two sets of nothing, which is
Verification 14. **Two independent reasons the same green result meant
nothing.** Rerun on a record with history, over the phase's own elements: zero
differences, and 48 when injected into.

### R3. The held DOM node

`saveAllOppAssess` held `const fb = getElementById(...)` across the whole batch.
A record load overlapping the save replaces the bar, because
`mountOppAssessmentLenses` rebuilds it and `createSubTabs` rewrites the mount,
so the captured node was detached by the end. Measured by wrapping the handler
and comparing node identity across the call: `sameNode` false,
`beforeStillConnected` false, the captured node holding "Recorded 1 of 1."
while the live one was empty.

**Every write had succeeded and the confirmation went to a node nobody could
see**, which is the worst form of this class: silence reads as failure, and the
natural response is to score it again. Checking the database before concluding
is what separated it from a save that never happened.

**The same function got the same class right and wrong.** The dirty set is
derived from `oppAssessDraft` rather than declared, precisely so there is no
second source of truth; the feedback element was a held reference to something
the app rebuilds, which is the same mistake in a different medium. Hold the id,
resolve the node.

### R4. The Section 5 departure, and the measurement behind it

`INTERACTION_STANDARDS.md` Section 5 counts a nav-bar click as real navigation,
because it was written for a page-wide dirty registry where leaving discards.

**Here it does not.** Phase 1 clears the draft maps on a RECORD CHANGE, so
going to the Opportunities list and back to the same record still has the work.
Measured, not argued: after the round trip the panel read
`{"dirty":1,"select":"4","reason":"R28P7 unsaved work"}`.

So the guard warns on the two events that lose work, arriving at a different
record and unloading the tab, and stays quiet on the two that do not. Warning
about a discard that will not happen makes the dialog's own words false and
teaches people to dismiss it.

**Recorded so the round that builds the system-wide registry meets the
reasoning rather than the exception.** When leaving a page does discard,
Section 5's letter and this reasoning give the same answer; they differ only
while it does not.

### R5. The sticky-bar capture

A capture cleared its clip-height guard and its file-size guard and did not
contain the save bar, because the bar is `position: sticky; bottom: 0`, the
mount was 2748px, and the clip capped at 1900. **"Inside the element" and
"inside the frame" are different questions under sticky positioning**, and the
element-rect check answers the first while the capture needs the second.

Third instance of the family, after a clipped region the element had scrolled
out of and a capture non-empty and mostly background. The fix that worked:
scroll the real scroll container, take the rect after scrolling, and assert the
subject's rect lies inside the clip.

### R6. A wait on a variable set early in an async function

`openAssess` waited on `currentOppDetailId`, which `loadOpportunityDetail`
assigns near the top; everything the panel needs happens after. The probe
returned while `mountOppAssessmentLenses` was still running and raced a rebuild
for four runs, presenting as a hang.

**A wait on a variable an async function sets early is not a wait for that
function.** Wait on the last thing it does.

### R7. The mislabelled assertion

The Phase 8 walk printed "exactly the four re-scorable criteria offer history"
against an assertion of `historyToggles.length === 1`. The assertion was right;
the label was written for a state the walk did not reach. **It passed for the
right reason and said the wrong thing.** The milder half of the family this
round kept finding, and the one that survives review most easily, because the
number is correct and only the prose is not.

### R8. The quarter rule, restated

The brief read "if more than a quarter of CRITERIA need an override, the
generic wording is wrong". Against the data that trips at 100 per cent, because
every criterion keeps its Not applicable and its Verified.

**The override decision is per LEVEL, not per criterion.** Two levels of five
genuinely differ per criterion and three do not, which is 40 per cent.
Restated that way the rule is usable; as written it condemns wording that is
working.

### R9. The `.opp-assess-head` correction

Phase 2 stated that `.opp-assess-head` is shared markup and used it to argue
against merging phases 2 and 4. **It is not shared**: once in `app.js`, once in
`style.css`, zero times in `test-bed-detail.js`, whose equivalent is the
sibling `.tb-score-head`. Calibration: `tb-crit-row`, which genuinely is
shared, appears in both. The conclusion held on blast radius; the stated reason
was wrong and was corrected in Phase 4's commit rather than inherited.

### R10. A latent finding for whichever round gives Test Bed a scale

Test Bed's criteria all carry `scale_id` null, so they render their own anchors
and nothing else. Test Bed's anchors exist at levels 1, 3 and 5 only, because 2
and 4 are deliberately "between these".

**If Test Bed is ever given a scale, levels 2 and 4 would start showing that
scale's generic wording**, in a panel whose whole design says those levels have
no wording. Demonstrated rather than predicted: injecting a description into
Test Bed's cached levels left every anchored row untouched and filled exactly
those two. Architecture rule 8's shape, and it will not surface until the scale
arrives.

### R11. Two configuration blind spots

**INVARIANT 8's second one.** Its filter is `payload_field_required` rules whose
field `startsWith('score')`. The seven Commercial criteria are `assessComm*`
and no gate rule names any of them, so **it sees the Test Bed five and nothing
from the Opportunity assessment.** That sits beside the `assessment_current`
blind spot recorded in Round 25 Phase 1 and still unfixed: two blind spots in an
invariant whose stated job is to catch a gate nothing can satisfy. The binding
constraint on this round's decision turned out to be INVARIANT 9, which the
brief did not mention.

**`CURRENT_STATE.md` does not record `scoring_scale_levels` at all.** Zero
mentions before the migration and zero after, confirmed with `grep -a` for the
NUL-byte trap and calibrated against `scoring_anchors`, which is recorded.
`scripts/state-dump.mjs` never reads the table. **That table is where this
round's wording now lives**, so a change to the generic level wording would not
appear in the configuration changelog, which is the file's stated purpose.
Reported and left unfixed, as instructed.

### R12. The twenty retired overrides, kept as rows

Recommended and accepted: **keep 15, retire 20. Nothing deleted.**

| Level | Verdict | Why |
|---|---|---|
| Not applicable | **keep all 7** | Each says WHEN not-applicable is legitimate for that criterion, and two of the seven say "rarely applicable" and constrain its use. That is a guardrail at the two criteria where the dishonest answer is most tempting |
| Unknown | keep 1, retire 6 | Six restate the level using the criterion's own name, already on screen above. Metrics is the exception: "the conversation is about capability, not outcome" is a diagnostic cue |
| Our hypothesis | retire all 7 | Every one is "Terminus believes X, from [sources]". If the source lists are missed they belong on the `asks` line, not in five stacked rows |
| Buyer confirmed | retire all 7 | Every one is "a named person has stated <the criterion>" |
| Verified | **keep all 7** | What counts as corroboration genuinely differs and is the hardest judgement on the scale. The generic is a list of synonyms, not a test |

**The rows stay whatever is retired.** INVARIANT 9 binds 35 anchor rows to 62
live score entries, and `scoring_anchors` has no delete policy at all.

**And the win is reading effort, not scrolling.** Retiring the twenty is 16px of
height, measured. It takes each criterion from five paragraphs to two.
