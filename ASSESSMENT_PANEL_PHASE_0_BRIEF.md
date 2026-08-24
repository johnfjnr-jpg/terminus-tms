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
