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
