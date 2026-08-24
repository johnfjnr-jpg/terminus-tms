# Round 27: the Assessment reviewed row on unreached stages

## Phase 0, investigation

Branched from `main` at `8830a96`. Round number confirmed against the repo,
not from memory: the highest `Merge Round N` commit is 26 (`4d882cb`), so
this is 27.

## The finding, Round 26 Phase 4's, verbatim

The review row renders on stage tabs the record has not reached, and clicking
it there writes a real entry and changes nothing on screen, because the server
dates the entry from the record's own stage. Ninth instance of Architecture
rule 8.

## The decision, confirmed with the business

The row borrows Test Bed's approval treatment. On a stage the record has not
reached it renders visible, disabled, reading "Not yet at this stage".

Every other criterion is a bare presence check, so a tick turns it met from
anywhere. `assessmentReviewed` is the first Opportunity criterion whose
met-ness depends on the record's stage, which makes it behave like an approval
rather than a criterion.

## Baseline, measured before anything is built

One Opportunity at Qualification, each stage tab opened in turn:

| Stage tab | Review row | Tickable | Title |
|---|---|---|---|
| Qualification | yes | **true** | Confirm you have read the assessment |
| Solution Alignment | yes | **true** | Confirm you have read the assessment |
| Proposal | yes | **true** | Confirm you have read the assessment |
| Evaluation | no row | -- | -- |
| Negotiating | yes | **true** | Confirm you have read the assessment |

The record is at Qualification, so three of the four are ahead of it and all
three are tickable. That is the defect, measured rather than restated.

Evaluation carries no row because no `assessmentReviewed` rule exists there;
the four rules sit at Qualification, Solution Alignment, Proposal and
Negotiating. Correct, and worth stating so the absence is not read as a
second fault.

**One probe fault, recorded rather than quietly fixed.** The loop timed out
after Negotiating. `loadOppStageTab` returns early for a terminal stage,
whose panel is static markup with nothing to fetch, so the wait for a
criteria row can never be satisfied on Closed Won or Closed Lost. The
measurement above is complete; the loop's terminal-stage handling is not.

## I1. What renders Test Bed's "Not yet at this stage"

**One place.** `buildStageTrackListHtml`, `frontend/app.js:4683`, with the
string itself at `:4690`. Nothing else in `frontend`, `src` or `supabase`
contains the phrase, searched with a calibration confirming the search runs.

It is the Test Bed stage tab's approval list, and it is a deliberate SIBLING
of `buildStageApprovalRowHtml` rather than a shared function. The Round 9
Phase 6.2 comment above it says why: the other builder is shared with
Opportunity's all-stages table, which still needs its Stage and Exit criteria
columns, and editing it to suit one caller is how two callers drift apart.

**Disabled is not a `disabled` attribute.** The row is a `div`. Unavailability
is expressed by three things together:

| Mechanism | Effect |
|---|---|
| the `clickable` class is withheld | no `cursor: pointer` (`style.css:2247`) |
| no `onclick` is emitted | the click does nothing |
| the meta line reads "Not yet at this stage" | the user is told why |

The discriminator is `st.state === 'current'`, which arrives as data from
`GET /records/:id/stage-approvals`.

## I2. How far it is reusable for a criterion row

**The pattern transfers. The function does not.**

The two rows are structurally different. An approval row is two lines: a
ring-radio, a role name, and a **meta line** beneath it. A criterion row is
one line: a tick box and its text, with **no meta slot at all**.
`buildStageTrackListHtml` renders a track from an approvals payload and has no
notion of `met`, `field`, or a tick box, so it cannot be called.

**`.tb-crit-row` is shared with Test Bed** and must not be modified.
`test-bed-detail.js:1522` and `:1529` emit the same class, so a change to the
rule at `style.css:2715` reaches Test Bed's own criteria panel. Anything new
has to be an additive modifier class. `.sa-approval-meta` (`style.css:2338`,
mono 9px, `--muted-2`) is reusable as the meta treatment; the layout is not,
because `.tb-crit-row` is a flex row with `align-items: flex-start` and no
second line.

**The JS side is safe.** `renderOppExitCriteria` is Opportunity-only; Test Bed
uses `renderTbStageExitCriteria` in `test-bed-detail.js`. A change to the
renderer cannot reach Test Bed. Only the stylesheet can.

**Two states for approvals, three for this row, and this is the part that does
not transfer.** For approvals, a past stage shows "Approved <date>" because
the approval exists. For the review row, a past stage is genuinely
SATISFIABLE: the rule is `entry_stage_at_or_after`, so an entry written now,
dated at the record's current stage, satisfies an earlier stage's rule. So
"not reached" must mean strictly AHEAD of the record, and past stages must
stay tickable. Copying `st.state === 'current'` would disable the row on
stages where clicking it still works.

**Test Bed's own answer to this class is different again, and worth knowing
before borrowing.** Test Bed's three `entry_stage_at_or_after` rules are score
rules, kept out of `TB_EXIT_CRITERION_KEYS`, so they render as
`.tb-crit-row--computed` read-only rows and the action lives in a separate
scoring panel. Test Bed has never offered a tick for a stage-dependent
requirement. That is a third precedent, not the one the business chose, and it
is recorded so the choice is visible as a choice.

## I3. Whether tickability is decided in one place or several

**Rendering is one place. The decision is re-expressed in five.**

| # | Where | What it decides | Knows the record's stage |
|---|---|---|---|
| 1 | `renderOppExitCriteria`, review branch, `app.js:1999` | `cls` and `onclick`, from `r.met` alone | **no** |
| 2 | `renderOppExitCriteria`, generic branch, `app.js:2013` | `tickable`, from type + key set + label | **no** |
| 3 | `applyConfirmedOppTick`, `app.js:2046` | rewrites `onclick` after a confirmed tick | no. Generic path only |
| 4 | `toggleOppExitCriterion` | refuses a field outside `OPP_EXIT_CRITERION_KEYS` | no |
| 5 | `recordOppAssessmentReview` | **nothing. No guard of any kind** | no |

`renderOppExitCriteria` takes `(containerId, recordId, fromStage, toStage,
isStillCurrent)`. **It is never told the record's stage**, so as written it
cannot make this decision at all. The record's stage is available as the
global `currentOppStage` and the order as `currentOppStages`
(`app.js:4534-4535`), and one of the four call sites, `loadOppStageTab`,
already receives `currentStage` as a parameter and does not pass it on.

**The server is not wrong and needs no change.** `POST
/opportunities/:id/assessment-reviewed` takes no body and no stage. It always
writes at `record.status`, and a repeat of the same stage is a 200 no-op. So
there is no request it could refuse: a click from an unreached tab writes
exactly what a click from the correct tab would write. **The harm is not a bad
write. It is that the person believes they have reviewed Proposal and have
not.** A display-only fix is therefore sufficient, and a guard in
`recordOppAssessmentReview` is defence in depth rather than a correction.

## A trap in the verification requirement, flagged before building

"Clicking it on an unreached stage writes nothing. Assert the series is
unchanged in the database."

If the record's current stage has ALREADY been reviewed, that click is a 200
no-op today and the series is unchanged **without the fix**. The check would
pass against the defect. The counterfactual has to be built in: the fixture
must have its current stage UNREVIEWED, so that a click, if it fired, would
demonstrably add an entry. The same probe run before the fix must show the
series growing.

## Proposed plan

Two phases. The round is small and the two halves are a display change and
its evidence.

- **Phase 1.** The disabled treatment. Teach `renderOppExitCriteria` the
  record's stage, render the review row visible and unclickable with a
  "Not yet at this stage" meta line on stages strictly ahead, add the guard
  in `recordOppAssessmentReview`, and add an Opportunity-scoped modifier
  class without touching `.tb-crit-row`.
- **Phase 2.** Verification and close-out: both halves on one record, the
  unchanged-series assertion with its counterfactual, three ticks in sequence
  without reloading, advance-then-review, Test Bed pixel comparison,
  `CURRENT_STATE.md`, and the two records the close-out must carry.

Awaiting sign-off. Nothing has been built.

---

## Agreed in conversation at Phase 0 sign-off, recorded here

Phase 0 was signed off on 2026-08-24. The four items below were agreed in
conversation and existed nowhere in the repo. **That is the failure Round 26
found twice**: rule 7's refinement recorded in a close-out nobody re-reads,
and the cumulative-rollup decision living only in a migration comment. A
decision that exists only in a conversation is a decision the next session
does not have, so it is written here before Phase 1 begins.

### C1. Phase 1 constraints

**`.tb-crit-row` is shared with Test Bed, so anything new must be an additive
modifier class.** Not a change to the rule at `style.css:2715`, and not a new
declaration on `.tb-crit-row` itself. Test Bed's own criteria panel emits the
same class at `test-bed-detail.js:1522` and `:1529`, so either would reach it.

**Test Bed pixel-identical is the check that would catch a leak.** Per I2 the
stylesheet is the only route by which this round can reach Test Bed, the JS
side being safe because `renderOppExitCriteria` is Opportunity-only. So a
before-and-after comparison of Test Bed's criteria panel is not a courtesy
check at the end of the round. It is the only instrument pointed at the one
surface a display change here can damage, and it belongs in Phase 2's evidence.

**Report whether threading the record's stage into `renderOppExitCriteria`
changes anything else that renderer decides.** The function gains a parameter
it has never had. A parameter in scope is a parameter a second decision can
quietly start depending on, and the report has to state, for each of the other
decisions the renderer makes, whether the new one is read there. Same family
as Architecture rule 9: the options list reads as open-ended at the call site
and is closed at the definition, and the distance between the two is where an
unintended dependency lives unseen.

### C2. For the close-out: Test Bed's third precedent

**Test Bed has never offered a tick for a stage-dependent requirement.** Its
three `entry_stage_at_or_after` rules are score rules, deliberately kept out of
`TB_EXIT_CRITERION_KEYS`, so they render read-only as `.tb-crit-row--computed`
and the action that satisfies them lives in a separate scoring panel.

That is a third precedent, alongside the approval treatment being borrowed and
the tickable row as it stands today. **It is not the pattern the business
chose.** Recording it means the choice reads as a choice that was made rather
than one defaulted into, and a later round asking why the row is a tick at all
finds the alternative already stated instead of having to rediscover it.

### C3. For the close-out: evidence before the claim, not after

Round 26's `CLAUDE.md` commit carried a message asserting a check that had
errored at the moment the message was written. **The claim was true and the
order was wrong.**

**A commit message asserting a verification that never ran reads identically to
one asserting a verification that passed.** Nothing in the artefact separates
them, which is why the order is the control rather than the eventual truth of
the claim. Run the check, read its output, then write the sentence that
describes it. Same family as Verification 12 and 13: a search that never ran
and an instrument never shown reaching one both read as a clean result.

### C4. For the close-out: two probe faults from Phase 0

**The uncalibrated zero on the dev server restart.** Every probe returned
`000`, including the calibration case whose whole job was to show the probe
could tell a live server from a dead one. **A run in which the calibration and
the measurement return the same value has measured nothing.** Seventh instance
of the third-state species, and the second caught pre-emptively rather than
after a conclusion had been published.

The restart at the head of Phase 1 was calibrated three ways before any reading
was trusted: a dead port returned `000`, an unknown path on the live server
returned `404`, and an unauthenticated API call returned `401`. The refreshed
token was calibrated the same way, a good token returning `200` from
`GET /api/opportunities` and a malformed one returning `401`, so the `200` is a
reading rather than a default.

**The terminal-stage probe fault.** `loadOppStageTab` returns early for a
terminal stage, whose panel is static markup with nothing to fetch, so a wait
for a criteria row on Closed Won or Closed Lost can never be satisfied.
**A wait that cannot be satisfied reads as a hang rather than as a result**, so
it presents as the harness being slow rather than as the probe being wrong, and
it is the one failure mode a timeout will not label correctly. Any Phase 2 loop
over all stages special-cases the terminal ones rather than waiting on them.

---

## Phase 2: verification and close-out

### The two claims Phase 1 did not cover

Fixture in the same shape throughout: an Opportunity at Solution Alignment
carrying one entry at Qualification, so its current stage was unreviewed and a
click that fired would demonstrably add an entry.

**A. Three ticks in sequence, without reloading.** Every tick re-enters
`renderOppExitCriteria` through `toggleOppExitCriterion`, which now passes
`currentOppStage`. If that were wrong the disabled state would flicker or
invert on a path nothing else exercises.

Three generic criteria ticked in a row. All three landed in the database
(`null` before, set after, read back through the API each time). The active
tab read `Solution Alignment` after every one, which is the Round 21 Phase 1
defect staying fixed. A sentinel set on `window` after page load survived all
three, so no tick reloaded the document. **After three re-renders the Proposal
row still read `unreached=true`, no `onclick`, meta line intact.**

**B. Advance then review.** The disabled state is about POSITION, not
permanence, and this is the claim the defect could never satisfy: it always
wrote at the record's own stage, so it could never produce an entry dated at a
stage the record had just arrived at.

Before advancing, Proposal read `unreached=true, onclick=false`. The rest of
the Solution Alignment gate was satisfied through the real API, leaving 0 unmet
requirements, and the record was then advanced **through the UI's own advance
control**, not the transition endpoint. The wait was on `currentOppStage`
changing, which the previous value could not satisfy.

After arriving, the same Proposal row read
`unreached=false, met=false, onclick=true, tickable=true, cursor=pointer,
meta=null`. Clicking it: 1 POST, series 2 to 3, and **the new entry is dated at
Proposal**.

### Rule 7 under its corrected wording, the first round to use it

**It passed, and it is workable, but its instrument now lives outside the
repo and that is the thing worth recording.**

Sign-offs enumerated, then joined to commits:

| Sign-off | Commit |
|---|---|
| Phase 0 | `eb622fa` |
| (Phase 0 boundary, instructed work, no phase of its own) | `20aa31b` |
| Phase 1 | `95ed806` |
| Phase 2 | this commit |

Two phases signed off before this one, two matching commits, none missing, and
one boundary commit accounted for rather than counted as a phase. The brief's
own plan said two phases after Phase 0, which agrees.

**The old instrument returned 1 against this brief.** Eighth consecutive
round, and the same mode as the two prior cases: a `## Phase 0, investigation`
heading ABOUT Phase 0 rather than a list of phases. Calibrated the Round 26
way, by injecting `### Phase 99` and watching the count move 1 to 2 and back,
so the instrument works and the premise is again what is false. **A round
trusting it would have declared itself complete after Phase 0**, which is
exactly the danger the corrected rule names.

**What is genuinely better.** The corrected rule cannot return a
plausible-but-wrong number, because there is no count to misread. The failure
mode that has now recurred eight times is structurally impossible under it.

**What is genuinely worse, and should be known before the next round trusts
it.** The sign-offs live in the conversation, not in the repo, so the
authoritative side of the check has no artefact. The join is between one list
that can be verified (`git log main..HEAD`) and one that cannot. Nothing on the
repo side can detect a sign-off left OUT of the enumeration: if a phase is
forgotten, both lists agree and the check passes. That is the shape of
Verification 14, a check that passes when both sides are absent, moved from
values to list membership.

**So the rule should be read as prescribing an order**: enumerate the
sign-offs FIRST, from the conversation, and only then open `git log`. Deriving
the list from the commits and then confirming the commits is a check against
itself. A session resuming mid-round from a summary may not hold the sign-off
history at all, and should say so rather than counting commits and calling it
the same thing.

### `CURRENT_STATE.md`: not regenerated, and not stale

**This round changed no migration, no seed and no route.** The full diff
against `main` is three files: this brief, `frontend/app.js` and
`frontend/style.css`.

The staleness test from the `CURRENT_STATE.md` rules was run in full and both
halves were calibrated:

- the recorded SHA `c11a2fd` **is** an ancestor of `HEAD`, and the same test
  was shown able to fail by asking the reverse question
- `git diff --name-only c11a2fd..HEAD -- supabase/migrations supabase/seeds
  src/routes` returned **0 files**, and the same command over `frontend`
  returned 2, so the query was reading the range

**A disagreement worth stating rather than resolving quietly.** The
`CURRENT_STATE.md` rules say a round is not complete until the file is
regenerated and its diff reconciled. That was set aside deliberately for this
round, on the basis that the file records configuration and source-parsed
state, none of which moved. Regenerating it would have produced a diff of a
timestamp and a SHA and nothing else, which is a change no phase accounts for
and therefore a finding under the same rule that asked for it.

### Residue

Fixtures were enumerated from the DATABASE by the `R27P1` tag, never from the
file the setup script wrote. That mattered on the first attempt: the sweep
found a Contact and an Account left by an ABORTED setup run that no fixture
file named. Eight records found and soft deleted after Phase 1, three after
Phase 2, both confirmed by re-querying the tag and by a direct row-level
re-query of the ids.

Close-out sweep over the whole population, paged rather than left to a default
limit: **94 live records, every one owned by a single owner id, none owned by
the test account, no `harness_*` record type live, no `R27P1` reference
surviving.** Calibrated by reporting a type known to be present.

The four live Opportunities are the business's own and were confirmed as such:
three Willowglen records at Qualification created before Round 26, and one
Closed Won. Not residue. Left alone.

---

## Records carried beyond the phase list

### R1. C1 to C4 as committed, and a second instance of C4

C1 to C4 stand as committed at `20aa31b`. C4 gains a second instance found
while building Phase 1.

**Evaluation carries no `assessmentReviewed` rule at all**, so a wait for the
review row on that tab can never be satisfied. Same unsatisfiable-wait species
as the terminal-stage fault recorded in Phase 0, in the same probe, from a
different cause: the terminal case is a panel with nothing to fetch, this one
is a panel that fetches correctly and legitimately contains no such row.

**Same fix in both cases: wait on the PANEL rendering, and treat "no row" as a
result rather than as a state still to arrive.** The probe now reports
`NO REVIEW ROW (no assessmentReviewed rule at this stage)` for Evaluation and
carries on, which is a reading. Before the change it timed out, which is not.

The general form is worth holding separately from the two instances.
**A wait whose condition can never become true presents as a hang rather than
as a result**, so it is read as the harness being slow rather than as the probe
being wrong, and a timeout is the one instrument that cannot label it
correctly. Before waiting on a condition, ask not only whether the OLD state
already satisfies it, which is Verification 7, but whether the NEW state ever
can.

### R2. Two instruments, and the strongest instance of it in this project

The Phase 0 brief flagged a trap in the verification requirement. **It then
appeared live in the pre-fix calibration run, which is the part that makes
this worth recording.**

Pre-fix, the direct call to `recordOppAssessmentReview` for an unreached stage
**fired one POST and left the series unchanged at 2**. Both readings are
correct. The write reached the server; the server returned its 200 no-op
because the record's current stage had just been reviewed by the preceding
click in the same run.

**A series-only probe would have printed "unchanged" for a call that reached
the server**, which is the exact false negative Phase 0 predicted, produced by
the exact mechanism Phase 0 named, in a run whose purpose was to demonstrate
the defect.

The pair is what separated them: a network counter says whether the call
happened, the series says whether it changed anything, and **the defect lives
in the gap between those two questions**. Neither instrument is wrong and
neither is sufficient. Where a write path can legitimately no-op, an unchanged
result is not evidence the write did not happen, and the only fix is a second
instrument measuring the other half.

### R3. Three states, and why the round existed at all

Approvals have TWO states per stage: reached, or not. A past stage shows
"Approved <date>" because the approval exists, so `st.state === 'current'`
discriminates correctly and `buildStageTrackListHtml` has used it since
Round 9.

**The review row has THREE.** Its rule is `entry_stage_at_or_after`, so an
entry written now and dated at the record's current stage satisfies an EARLIER
stage's rule. A past stage is therefore genuinely satisfiable, and clicking it
genuinely works. Ahead, current and past are three distinct answers where
approvals have two.

**Borrowing the two-state discriminator would have disabled a row where
clicking still works**, and it would have looked right: the row would have been
disabled on every stage that was not current, which is the correct answer on
three of the four and wrong only on the one nobody would have tested. The
measured evidence is a single reading, `unreached=false` on Qualification, a
past stage, on a record at Solution Alignment.

**The general form.** When borrowing a pattern, the treatment and the
discriminator are two separate decisions. The treatment transferred exactly:
visible, no pointer cursor, no handler, a meta line saying why. The
discriminator did not transfer at all, because it encodes how many states the
borrowed surface has, and that is a property of the rule underneath rather
than of the pattern. **Copy the appearance, re-derive the condition.**

### R4. The prominence judgement, recorded unfixed

The unreached row's tick box is muted, and **that is a weak signal**, because
the read-only computed rows in the same panel render a visually similar empty
box. The meta line is carrying essentially all of it.

This is faithful to the borrowed pattern. Test Bed's unavailable approval rows
are not dimmed either; unavailability is carried by the absent pointer cursor
and the meta line. It was a choice, not an oversight, and it is left as built.

**It is recorded because it is the class of thing no assertion measures.**
Every property a check can name is correct: the row renders exactly once, the
meta text is right, the cursor is `default`, the layout holds at 1240, 1920 and
3440, and Test Bed is pixel-identical. Prominence is not among them. Round 15
Phase 4 shipped a Cost summary card whose totals read last with every check
passing, and this is the same instrument gap pointed at a smaller thing. Worth
the business's eye rather than a further round's assumption.
