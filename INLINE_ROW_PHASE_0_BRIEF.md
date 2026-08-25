# Assessment row: inline value, hover definitions, single-line reason

## Phase 0, investigation and plan

**Round number to be confirmed against the repo.** Round 30 merged to `main`
at `36a3a00`.

---

## What this phase is

**Investigation and a plan. No file edits, no migrations, no code, no
configuration changes.**

---

## What this round is

The business used the Round 30 panel and reported, verbatim:

> *"This is better. I would go even further and put the value on the same line
> as the criteria immediately after, I would then move the reason over to the
> right. Limit the reason to 2 lines of display with a scroll if required. It
> rarely will be."*

Then narrowed it to a prototype:

> *"What I would like to try just for Budget confirmed is this. When the
> cursor hovers over each criteria the sentence text of that criteria is
> displayed, eg Our Hypothesis: 'Terminus has estimated the value from
> comparable deployments. The buyer has not put numbers to it.' When we select
> the criteria, the Value would appear on the same line after the criteria
> selection, and the reason text could be entered on a single line. Let's get
> this item nailed first."*

**Prototype on one criterion, then decide whether it generalises.** That is
the business's own sequencing and the round should hold to it. Rounds 28 to 30
each specified a shape and then measured it; this one tries a shape on one
row before specifying anything.

**Round 30's baseline, which everything is measured against:** 461px at rest
and 530px drafting at 1920, 769 and 838 at 1240. Re-measure rather than quote.

---

## A defect to settle first

The business also reported:

> *"We have lost Qualification assessments, and the approvals."*

**The approvals report is a false alarm and should be confirmed as one.**
Round 26 removed Budget, Timeline and Commitment from Qualification and
replaced them with a single Assessment reviewed tick. Qualification has never
carried approvals. The screenshot shows one exit criterion, met, which is
correct.

**The assessments card is not.** The Qualification stage tab reads *"No
assessments configured for this stage"* while `assessCommBudgetConfirmed` has
been configured at Qualification since Round 25.

**The business does not remember whether it ever worked.** Settle it from the
repository, not from memory. Three candidates:

| | |
|---|---|
| It was never wired | Round 21 built the card as a placeholder; Round 25 put the real panel on the Assessment tab. **The placeholder may simply have stayed one** |
| Round 30 broke it | Four phases changed that renderer heavily |
| It reads a different source | `scoring_criterion_stages` versus whatever the card queries |

**The first would mean nothing is lost** — the assessment is on the Assessment
tab and always has been, and the stage tab is showing an empty card nobody
filled.

**This changes what the round is.** A regression is fixed first and separately.
A Round 21 leftover is a decision about whether that card should exist at all,
given the Assessment tab now holds the instrument.

---

## The three changes, and what is settled about each

### 1. Hover a segment, see that level's wording

**Confirmed: hover plus focus, and the definitions block stays.**

Hover is unavailable on touch and unreachable by keyboard, and the segments
are real `<input type="radio">` elements with arrow-key navigation, so a
keyboard user moving through them would otherwise get nothing.

**Focus costs nothing over hover alone** and means arrow-keying through five
segments reads five definitions, which is arguably better than the mouse
version.

**The definitions block stays** as the route that works everywhere. The hover
is a shortcut, not a replacement.

### 2. Selecting a level puts the value inline

**Budget confirmed only.** The value is on the disclosure today because Round
30 Phase 2 measured that 1 of 7 criteria carry one and a permanent column is
empty on six rows.

**Inline after the selection is different from a column**: it appears because
a level was chosen, on the one row that has one.

**Report what that does to the reason cell.** Round 30 measured the reason at
817px at 1920 with 5 of 7 real-length strings reading whole, and the longest
real reason in the corpus rendering at 372px.

### 3. The reason on a single line

Today: one line at rest, expanding to four on focus.

**The business asked for two lines of display with a scroll**, then for the
prototype said a single line. **Those are not the same and the phase should
resolve it by looking**, with the corpus behind it: fifty real reasons,
median 14 characters, longest 58, rendering at 372px against a cell of 817.
Truncation begins at 133 characters.

**Two lines at rest is generous rather than tight**, on that evidence.

### 4. "PROVISIONAL." comes out

**Confirmed with the business.**

Round 28 seeded the five generic level descriptions and the seven per-criterion
Not applicable and Verified overrides with a literal `PROVISIONAL.` prefix,
deliberately, because `scoring_model.sql` had carried the same warning in a
comment over Test Bed's anchors and they were read as settled ever since.

**The marker has done its job.** The wording has been read against a real deal
and the business has now judged it. On a hover tooltip it would be the first
word read five times in a row.

**Report what carries it.** Round 28 seeded 35 anchor rows and Round 30's
retirement decision kept 15. The generic descriptions on
`scoring_scale_levels` may carry it too. **Report the count before removing
anything**, and note that `scoring_anchors` has no UPDATE or DELETE policy, so
this is a migration rather than an API call.

---

## Investigations

### I1. The Qualification assessments card

**The question.** Why does the Qualification stage tab say no assessments are
configured when one is?

**Settle whether it ever worked**, from `git log` and the source, not from
memory. If it never did, say so plainly — that is the answer that means
nothing is lost.

**Report what the card queries** and what it would take to show the criteria
configured at that stage.

**And report whether it should.** The Assessment tab holds the instrument with
four lens sub-tabs. A second surface showing the same criteria is a second
thing that drifts, and this project has recorded that failure more than any
other. **Report the options; do not choose.**

### I2. The hover and focus definitions

**The question.** Where does the wording appear, and what already exists to
reuse?

`INTERACTION_STANDARDS.md` §8 documents the chevron hover popup and its four
properties: a 180ms debounce, a load token, `mouseleave` on the wrapper so
moving into the popup is not a leave, and no click handler ever.

**Report whether that pattern applies.** The definitions are already in the
client — the level descriptions arrive with the criteria — so there is no
fetch and therefore no load token or debounce needed for that reason.
**Whether any of the four properties still earn their place is the question**,
not whether to copy them.

**Report the two placements**: in the row, making it taller on hover, or
floating over the content. Measure both rather than choosing.

**Report what focus does that hover does not.** A focused segment stays
focused; a hovered one does not. Whether the wording dismisses on blur, on
arrow-key movement, or persists is a real difference.

### I3. The inline value

**The question.** What does putting the value after the level selection cost
the row?

Measure at 1240, 1920 and 3440, with the value present and absent, against
Round 30's 461 and 530.

**Report what it does at 1240**, where Round 30 found the reason already drops
to its own line and the criterion cell is 258px.

**Report whether the amount and the currency both fit inline**, since the
value is two controls, not one.

### I4. The reason at one or two lines

**Measure both.** One line at rest against two, at all three widths, with the
corpus lengths from Round 30 Phase 5 rather than invented strings.

**Report what happens on focus** in each case. Today one line expands to four.

**Report the scroll case**, which the business named: what a 659-character
reason does at two lines with a scroll.

### I5. The PROVISIONAL removal

**Report the count and the mechanism.** How many rows carry the prefix, in
which tables, and what removing it takes given `scoring_anchors` has no UPDATE
policy.

**Report whether anything reads the prefix** as a marker rather than as
wording. Round 30 Phase 4 found `OPP_ASSESS_NONE` kept a job so its vocabulary
note would survive; the same may be true here.

### I6. What the design cannot express

**Output item 4 has caught the brief's central premise being wrong four times
in ten rounds**, most recently the five-column row that did not fit at 1240 and
the 880px cap that was inert there.

---

## The plan to produce

Suggested shape, argue with it:

| Phase | Content |
|---|---|
| 0 | This investigation |
| 1 | The Qualification card, per I1 |
| 2 | PROVISIONAL removed |
| 3 | Hover and focus definitions on Budget confirmed |
| 4 | The inline value |
| 5 | The reason line count, decided by looking |
| 6 | Does it generalise? A judgement, not a build |
| 7 | Full walk and close-out |

**Phase 6 is the round's point.** The business asked to try this on one
criterion and then decide. If it generalises, the other six rows follow in a
later round. **If it does not, saying so is the correct outcome** and Round 29
Phase 4 and Round 30 Phase 5 both shipped no diff for that reason.

**Argue with the order.** If I1 shows the card was never wired, Phase 1 may be
a decision rather than a build.

---

## Verification requirements

**Measure against 461 and 530 at 1920, 769 and 838 at 1240**, re-measured
rather than quoted. Round 30 Phase 0 found the numbers it inherited measured a
state the business never sees.

**Use the corpus, not invented strings.** Round 30 Phase 5 established fifty
real reasons, median 14, longest 58, rendering at 372px, with truncation
beginning at 133. **A layout tuned to an invented string is fitting the design
to the test data**, refused twice in Round 30 including once in the direction
that cost the phase.

**Look at every phase.** Round 30 found `overflow` clips at the padding box
after two correct measurements said the geometry was fine.

**Calibrate on the kind of change each phase makes**, not on whatever the
probe measures. Three variants have now been recorded: blind for one phase,
half-inert from selector specificity, half-matched from a structural
assumption.

**Captures: assert the subject is visible and still rendered after the
capture.** A hover state is transient and Round 29 Phase 5 found a clipped
screenshot that was itself ending the hover.

**Every browser interaction at least three times in sequence without
reloading**, and route probes through the real controls rather than around the
unsaved-changes guard.

**Test Bed pixel-identical.** This round is Opportunity-only unless an
investigation says otherwise.

**Enumerate teardown from the database by this round's tag.**

---

## Explicit non-goals

- **Round C.** Still gated on whether the panel is quick enough.
- **Generalising to the other six criteria.** Phase 6 decides whether, not
  this round.
- **Test Bed's scoring panel.**
- **The app-wide `<p>` reset**, its 119-of-225 census recorded in Round 30.
- **The three-string vocabulary reconciliation.**
- **The Closed Lost hover wording.**
- Round D, the Reference tab round, reopening a loss, the open-decisions
  convention, `measurabilityConfirmed`, the approval snapshot.

---

## Output format

1. **I1 to I6**, each with the command run or the interaction performed, the
   actual output, and the finding.
2. **The I1 answer, stated plainly**: was the card ever wired, and should it
   exist.
3. **The I5 count**, before anything is removed.
4. **The phase plan**, with the argument for any departure.
5. **Anything that cannot be built as stated.**

Then stop and wait for sign-off.

---

# Phase 6 record: does it generalise

**No product diff.** A decision phase, and the decision did not need one.

---

## What was actually scoped, which corrects this brief

The brief lists four things built behind a named constant. **Two are.**

| | behind `OPP_HOVER_DEFINITIONS_KEY` |
|---|---|
| Hover and focus definitions | **yes** |
| The inline value | **yes** |
| The reason growing to fit | **no**, and never was |
| Phases 1 and 2 | no, and correctly so |

`growOppAssessReason` is wired unconditionally on every reason cell.
Measured: `growTargets: 7`. It has applied to all seven criteria since Phase
5 shipped, and Phase 5 measured it there.

---

## 1. Hover and focus definitions: GENERALISES, and should still wait

Measured by widening the gate in the live page and re-reading the panel:

| | scoped to one | generalised |
|---|---|---|
| popups | 1 | 7 |
| hover targets | 5 | 35 |
| focus targets | 5 | 35 |
| DOM nodes in the pane | 279 | **285** |
| pane height, 1240 | 769 | **769** |
| pane height, 1920 | 461 | **461** |
| row heights | identical | identical |

**Six DOM nodes and no layout change at either width.** Hovering a criterion
that never had one shows its own wording: Pricing model fit's Not applicable
reads "Not applicable where only one commercial model is on the table".

It works for free because the wording was already in the client for all seven
before this round: the definitions block has always rendered it. Phase 2's
reversioning is what makes it presentable, because all 35 anchors are now at
version 2 without the prefix.

**And it should still wait.** The business said "Let's get this item nailed
first" and they have not seen it: this round is not merged. Generalising now
would decide on their behalf the exact thing they asked to decide after trying
it. That is a procedural reason, not a technical one, and the distinction is
the point: it generalises, and it should not generalise yet.

---

## 2. The inline value: NOTHING TO GENERALISE, which is not a shortfall

**One of seven criteria carries a recorded answer.** On the other six the value
position renders nothing at rest and nothing while drafting, and their reason
keeps the full width:

| | value cell at rest | while drafting | reason |
|---|---|---|---|
| Budget confirmed | "SGD 450,000" | amount + currency | 718px |
| the other six | nothing | nothing | 817px |

Drafting Pricing model fit produces `amountInputs: 0, currencySelects: 0`, an
empty value position and an 817px reason.

So "generalises" is the wrong question for it. Widening its gate would change
nothing, because the thing it displays exists on one criterion.

**The finding that matters is which constant gates it.** It is gated by
`OPP_HOVER_DEFINITIONS_KEY`, the prototype constant, and the right reason is
`OPP_VALUE_CAPTURE_KEY`, which is what the editing controls already use.

Today the two hold the same string, so the behaviour is identical either way.
**It stops being identical the moment a second criterion is configured to
capture a value**, which Round C's twenty-five could do, or the moment the
round that generalises the hover retires the prototype constant and takes the
value's gate with it. Correct for every caller that exists.

**Recommended, not shipped: re-point `valueInline` at `OPP_VALUE_CAPTURE_KEY`.**
One line. It is not this phase's diff because the judgement does not need it,
and it should not be left for the round that removes the prototype scope to
discover.

---

## 3. The reason growing to fit: ALREADY GENERALISED

Never scoped. Phase 5 measured all seven: one line used of the four that were
shown, and +0px on focus at every width once the height followed the content.

Nothing to decide.

---

## 4. Phases 1 and 2: never criterion-scoped, and correctly

Phase 1 removed a card from the stage tab, which is per stage rather than per
criterion. Phase 2 reversioned all 35 anchors across all seven, deliberately
and on the business's decision, because leaving 30 rows carrying a retired
marker would make six criteria read as provisional while one did not.

Both are already whole.

---

## The answer

| | generalises | now |
|---|---|---|
| Hover and focus definitions | yes, +6 nodes, no layout cost | **no**: the business asked to try it first |
| The inline value | no-op, nothing to generalise | its gate should be re-pointed |
| The reason growing | already did | done |
| Phases 1 and 2 | already whole | done |

**One of the four is a real generalisation decision, and the answer is not
yet.** Two were never scoped, and one cannot be generalised because the thing
it shows exists once.

**Test Bed pixel-identical is not asserted, because nothing changed.** A
comparison across a phase that touched no file is a check that cannot fail.

---

# Phase 7: the gate correction, the full walk, and the round's close-out

## The gate correction

`valueInline` now reads `OPP_VALUE_CAPTURE_KEY` rather than
`OPP_HOVER_DEFINITIONS_KEY`. One line, no behaviour change today.

**Which is exactly why it had to be verified by making the two constants
differ.** With both on the same criterion a probe cannot tell which gate the
value follows and would pass either way. Pointed temporarily at a second
criterion:

| | value cell | popup |
|---|---|---|
| Budget confirmed | **yes** | no |
| Metrics and quantified value | no | **yes** |

Different rows, separately gated. Restored byte-identical by checksum, with no
temporary marker left behind.

## The walk

One Opportunity built at Qualification and walked to Proposal, clicking the
panel and the tab-line control. The four Solution Alignment payload fields and
three approvals went through the API and this is said rather than glossed.

Qualification, one criterion. Solution Alignment, six, three scored and saved
in one action. Proposal, seven, panel 461px. Both advances from the tab line.

A reason corrected without touching its level: one entry to two, level 1 to 1,
carried.

## The three things watched

**The hover against the unsaved-changes guard, and one of the two answers is
not what the phase expected.** Hovering all five segments left `warns: false,
dirty: 0, bar hidden`. **Arrow-keying did not.** Moving focus through a
radiogroup CHANGES THE SELECTION, natively, so it fires the change handler and
arms the guard: `warns: true, dirty: 1`.

That is correct behaviour and it is a real consequence Phase 3 did not name.
**Exploring the definitions by keyboard is not a read-only gesture**, where
exploring them by mouse is. Recorded rather than fixed: making it read-only
would mean a roving tabindex with manual selection, which is a decision about
the control rather than about the definitions.

**The reason growth against the save.** A save is a blur followed by a
re-render. Grown to 50px with an inline height before the save; after it, 30px
with no inline height and a 65px row. The cell returned to the stylesheet's one
line and left nothing behind.

**The stacking under real scrolling.** Bar 45, popup 50, checked segment 1, and
the popup rendered while the row was scrolled to the foot of the panel. The
segment did not reach the bar's band on this record, so that half was exercised
by Phase 4's injection rather than by the walk, which is said rather than
counted as covered.

## One thing the walk demonstrated that nothing asked it to

The value was entered as GBP 250,000 at Qualification and the criterion was
re-scored at Solution Alignment without retyping it. The panel now shows no
value cell, because the CURRENT entry carries no answer:

    Qualification        level 1  v2  answer {"amount":250000,"currency":"GBP"}
    Solution Alignment   level 2  v2  answer none

Round 26 Phase 3 decided that deliberately: an answer belongs to the entry that
recorded it, and carrying it forward would show a figure against an entry that
never recorded one. The walk met the rule live rather than by argument.

---

## Findings recorded

**A hardcoded claim has a shelf life, and nothing can catch it.** Round 21
Phase 5 wrote "No assessments configured for this stage" into a card as a
deliberate placeholder and it was TRUE. Round 25 Phase 2 configured a criterion
at Qualification and made it false. It sat there for five rounds until the
business read it and reported the assessments as lost. Nothing was lost: the
container id appeared exactly once in the repository, at its own creation, and
`git log -S` returned one commit whose subject is "placeholders". **A literal
has no source to disagree with**, which is why code and validations going stale
are catchable and this is not. Recorded in `CLAUDE.md` as the third variant of
Architecture rule 8.

**The same sentence is a hardcoded lie on one record type and a computed result
on the other.** "No documents configured for this stage" appears twice: once as
an unwired placeholder on Opportunity, once inside `renderTestBedDocuments`
behind `if (!names.length)`, derived from real data. **That is why grepping the
sentence does not settle it and the container id does**, and it is a good
reason the placeholder survived ten rounds.

**A fixture built after the migration could not answer the question it was
built for.** Phase 2 needed to know what the panel renders for an entry stamped
at version 1 once version 2 exists. The fixture was created after the migration
so every entry was version 2, and it would have demonstrated nothing while
appearing to demonstrate everything. A genuine version-1 entry was injected to
get a series reading [1,2,2,2].

**Three instruments, two invalid, and looking settled it.** Whether the
definition popup paints above the sticky save bar could not be answered by
`elementFromPoint`, which reports HIT TESTING and skips a
`pointer-events: none` element regardless of paint order: the same tool was
valid for the segment and blind for the popup. A clipped before-and-after pixel
diff returned IDENTICAL HASHES for two visibly different states, because
clipped captures were not re-rendered between shots, which is Round 29 Phase
5's fault in a new place. A full-viewport capture settled it.

**A script printed a conclusion line regardless of the result, twice.** The
paint probe printed "so it is above the bar" on a run whose hashes were
identical, and the walk printed "neither armed anything" on a run whose own
output showed arrow-keying arming the guard. **A probe that reports a verdict it
did not compute is the same family as a checker that cannot fail**, and both
lines are now computed from the values above them.

**A grep removed the PAGE EXCEPTION line the same run printed.** Phase 4
introduced a temporal dead zone, `renderOppAssessCriterion` threw, and the
filtered output still produced plausible numbers. It was caught only because
1087 and 193 were recognisable as Round 30 Phase 1's. **A recognisable stale
number is not a verification method.** Verification 16, and the runs are
captured whole.

**A stacking fault from Round 30 Phase 3.** A checked segment carries
`z-index: 1` so its border wins the edge it shares with its neighbours, right
among the five of them and wrong the moment one scrolls under a sticky bar at
`z-index: auto`. The bar was raised rather than the segments lowered, because
lowering gives the shared-border problem back.

**`scrollHeight` is `max(content, client)`, and the same fact broke the
instrument and would have broken the feature.** It reported four lines used of
four for a four-character reason, because it cannot measure content shorter
than its box. It is also why the implementation must assign `'auto'` before
reading it, or a grown box could never shrink.

**Two calibration variants this round added.** Phase 1 injected `display: none`
where the phase REMOVES a node, so the count dimension read 4 to 4: the wrong
KIND of change rather than the wrong place. Phase 3's Test Bed list height did
not move under an absolutely positioned popup, which was correct: **the obvious
dimension was correctly the wrong one**, and the count dimensions carried it.
Phase 6 added a third: an injection placed on a container the probe scanned the
descendants of.

**Terminus Documents now leads the stage-tab row by default rather than by
decision.** Round 21 ordered that row deliberately; Phase 1 removed the card
that led it and nothing re-ordered what was left. A card saying "nothing
configured" now sits ahead of two carrying real content. Recorded for the round
that fills it.

**The gate finding, now fixed rather than recorded.** Right behaviour reached
through the wrong reason, latent until two coinciding constants stop
coinciding.

---

## Rule 7

Enumerated from the conversation first, then checked against `git log`.

| Phase | | Commit |
|---|---|---|
| 0 | investigation and plan | `3bbaf6c` (the brief, on main) |
| 1 | the card that was never wired | `c5e6f38` |
| 2 | PROVISIONAL retired | `66f049a` |
| 3 | hover and focus definitions | `2a0f712` |
| 4 | the inline value | `3b45717` |
| 5 | the reason grows to its content | `8bd8079` |
| 6 | does it generalise, no diff | `bad3ff4` |
| 7 | the gate, the walk, this close-out | `82440a3` and this commit |

Seven phases signed off, seven commits on the branch, and Phase 0's boundary
commit is the brief on `main` at the branch point rather than a branch commit.

**The instrument the rule warns about** returns **1** against this brief, from
a heading about Phase 0 rather than a list of phases. Calibrated by appending
`## Phase 99`, reading 2, and removing it.

## `CURRENT_STATE.md`

**Regenerated**, because this round added a migration. Generated at `82440a3`
on a clean tree.

The diff reconciles against the phases:

| change | phase |
|---|---|
| `scoring_anchors` 50 to 85 rows | Phase 2 |
| seven criteria at `current_version` 2, versions 1 and 2 | Phase 2 |
| 72 to 73 migration files, the new one listed | Phase 2 |
| soft-deleted records 11563 to 12294, approvals and revisions up | this round's fixtures, all torn down |

**One change no phase accounts for, investigated rather than resolved
quietly.** Live opportunities moved: Qualification 2 to 0, Solution Alignment 1
to 3. Both records are owned by another account, and this session cannot write
to a record it does not own: the same UPDATE returns **0 rows affected** on one
of them and **1** on a record the test account owns, neither erroring. The
audit reader was calibrated at 4002 visible rows before its empty result for
those two was read as a reading. **They are the business's own work between
dumps, not this round's.**
