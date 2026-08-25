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
