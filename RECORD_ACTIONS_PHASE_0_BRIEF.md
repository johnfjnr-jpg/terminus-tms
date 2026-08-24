# Record actions: document the built patterns, then converge

## Phase 0, investigation and plan

**Round number to be confirmed against the repo.** Round 28 merged to `main`
at `d445ab8`.

---

## What this phase is

**Investigation and a plan. No file edits, no migrations, no code, no
configuration changes.**

---

## Why this round exists

**Three times in this project the business has been asked to screenshot Test
Bed so a pattern could be learned:** the stage tab layout before Round 21, the
"Not yet at this stage" treatment in Round 27, and the record action bar now.

**`INTERACTION_STANDARDS.md` records what should happen and not what does.**
Round 28 Phase 0 found Section 5 specifying an unsaved-changes warning that is
not built, and its own header reads *"Specification only, not yet
implemented."* The reverse case, a pattern that is built and undocumented, has
no home in that file at all.

The consequence is measurable. Round 28 recorded nine instances of a fix built
for the screen that existed at the time. **Every one was a pattern nobody had
written down.** This is the same failure one level up: not a fix that missed a
screen, but a convention that exists only in the product and in one person's
memory.

**So the first phase of this round is documentation, and it is done by reading
the source, not by describing screenshots.**

---

## What the screenshots establish, and what they do not

Three screenshots were supplied. **Treat everything in this section as
unverified.** It is written from images by someone without repository access
and it is the input to an audit, not its conclusion.

**Appears to hold:**

| | |
|---|---|
| Position | Right end of the tab strip, outside the stage panel |
| Always present | `NEXT STAGE` |
| Only when dirty | `CANCEL` then `SAVE CHANGES`, save styled as primary |
| Scope | The same bar appears whether the edit is on Reference or on a stage tab |

**Explicitly uncertain, and the reason it is called out:**

The brief's author initially read the second screenshot as showing `NEXT
STAGE` **disabled while dirty** and stated it as a rule. A third screenshot
appears to show it enabled while dirty. **The greying in the second is more
likely the exit criteria being unmet.**

**Verify from source. Do not resolve it from the images.** If unsaved changes
do block stage progression, that is a real interaction rule and it must be
recorded. If they do not, the brief's author guessed wrong twice from
pictures, which is the whole argument for this round.

**A fourth pattern, previously unmentioned by anyone:** hovering a stage in
the chevron shows a panel listing that stage's outstanding requirements,
including stages the record has not reached. Opportunity has nothing like it.

---

## What Opportunity has today

| | |
|---|---|
| Save | A sticky bar at the foot of the assessment panel, appearing when dirty. Round 28 Phase 5 |
| Advance | Inside the stage panel, on the record's own stage tab only. Round 21 |
| Closed Lost | A secondary button beside the advance control. Round 21 |
| Chevron hover | Nothing |

**Three controls in three places**, against Test Bed's one.

**And a scope difference.** Round 28 Phase 5 chose an **assessment-scoped**
dirty registry, deliberately, because record-wide would have meant unifying
with `opportunity-reference.js`'s own working edit mechanism and would have
been a half-step toward the system-wide registry `INTERACTION_STANDARDS.md`
Section 5 specifies. **That reasoning stands and this round should not
casually overturn it.** But moving the bar to the tab line raises the question
from a different direction: a bar in a record-level position that only knows
about one panel's edits.

---

## Investigations

### I1. Document what is built, from source

**The question.** What are Test Bed's record-action conventions, read from the
code rather than described from images?

Report, for each, the file and function, the trigger, and the exact rule:

- **Where the action bar lives** in the markup, and whether it is inside or
  outside the tab strip element.
- **What makes `CANCEL` and `SAVE CHANGES` appear**, and what they are wired
  to. Round 28 Phase 0 found `#tb-save-all` wired to `saveTbFields` and drafts
  held in `tbEdits`.
- **Whether `NEXT STAGE` is ever disabled, and by what.** Unmet exit criteria,
  unsaved changes, not being on the record's current stage, or a combination.
  Round 22 found it disabled unless you are on the record's current stage tab.
  **Report every condition, and say which the screenshots were showing.**
- **The chevron hover panel**: what triggers it, what it lists, and how it
  resolves requirements for stages the record has not reached.
- **Anything else on the record-action surface that is built and
  undocumented.** This is the audit's real purpose and the list above is not
  exhaustive.

**Report what `INTERACTION_STANDARDS.md` says about each**, and classify:
specified and built, specified and not built, built and not specified.

### I2. What else is built and not specified

**Widen the same question beyond record actions.** Round 28 found nine
instances of a fix built for a screen that existed at the time, and Round 28
Phase 0 found `INTERACTION_STANDARDS.md` Section 5 specifying something
unbuilt.

**Report the size of the gap in both directions.** How many sections specify
behaviour that does not exist, and roughly how much built convention has no
section. **A count and a sample, not an exhaustive list**, since the point is
to size a documentation phase rather than to write it here.

### I3. Moving Opportunity's controls

**The question.** What does it take to move save, advance and Closed Lost to
the right of the Opportunity tab strip?

**The space measurement is a hard constraint.** Round 25 measured the
Opportunity strip at **876px in 876px with zero margin at 1240**, and Round 28
Phase 2 confirmed it wraps to two rows with nine tabs. **Three controls on the
right of that line needs measuring, not styling.** Report what fits at 1240
and 1920, and what happens on the second row.

Report where the advance control's Round 21 placement came from, and whether
moving it out of the stage panel breaks anything. **Test Bed's own rule is
that stage progression happens from inside the stage itself**, per its comment
at `app.js:3277`, and it enforces that by disabling the button off the current
stage tab rather than by placing it in the panel.

### I4. The save scope question, from the new direction

**The question.** If the bar moves to a record-level position, should it stay
assessment-scoped?

**Do not re-litigate Round 28 Phase 5's reasoning**, which was sound. Report
what Opportunity's Reference tab does today: `opportunity-reference.js` has its
own per-field open and discard mechanism with no bar. **Report what a
record-level bar that only knows about assessment edits would look like when
someone is editing a Reference field.**

**Report the options and do not choose.** One of them is leaving the scope
alone and accepting that the bar's position implies more than it covers.

### I5. Closed Lost has no Test Bed equivalent

**Test Bed has no lose-a-deal action**, so this is an extension rather than a
copy. Report where it would sit and what precedent applies, if any.

### I6. What the design cannot express

**Output item 4 has caught the brief's central premise being wrong three times
in eight rounds**, and this brief is written from three photographs. Expect it
to be wrong somewhere.

---

## The plan to produce

Suggested shape, argue with it:

| Phase | Content |
|---|---|
| 0 | This investigation |
| 1 | **Write the built patterns into `INTERACTION_STANDARDS.md`.** Documentation only, no behaviour |
| 2 | Move Opportunity's controls to the tab line, per I3 |
| 3 | The save scope decision, per I4 |
| 4 | Closed Lost placement, per I5 |
| 5 | The chevron hover, if the business wants it |
| 6 | Full walk and close-out |

**Phase 1 is first and it is not optional.** The round exists because the
patterns are undocumented; converging without writing them down would leave
the next round asking for screenshots again.

**Phase 1 records what is built.** It does not correct what is specified and
not built, and it does not build what is specified. Those are separate
problems and Section 5 is a known instance of the second.

---

## Verification requirements

**Phase 1 ships documentation, so its verification is that each recorded
statement is checkable against the source.** Cite file and line for each. **A
statement nobody can check is the failure this round is fixing.**

**Test Bed pixel-identical** for every phase that changes shared markup,
calibrated on the elements that phase changes, not on whatever the probe
happens to measure. Round 28 Phase 6 found a probe that fired correctly for
four phases and was structurally blind for the fifth.

**Every browser interaction at least three times in sequence without
reloading.**

**Look at it.** Whether three controls on a tab line read as a group or as
clutter is the property no assertion measures.

**Watch the third-state species.** Round 28 recorded a teardown that turned
three 401s into three empty arrays and reported clean while three fixtures sat
live, and a capture that passed both its guards with its subject outside the
frame under sticky positioning.

**Enumerate teardown from the database by tag.**

---

## Explicit non-goals

- **Round C.** Three lenses, twenty-five criteria. **Waiting on the business
  using the Round 28 panel in anger.**
- **The system-wide dirty registry** `INTERACTION_STANDARDS.md` Section 5
  specifies. Explicitly out, as it was in Round 28.
- **Building anything specified and not built.** Phase 1 records what exists.
- **Round D**, the Reference tab round, reopening a loss, the open-decisions
  convention, `measurabilityConfirmed`, surfacing the approval snapshot.
- **`INVARIANT 8`'s blind spots** and `CURRENT_STATE.md` not recording
  `scoring_scale_levels`. Both recorded, neither this round.

---

## Output format

1. **I1 to I6**, each with the command run, the actual output, and the
   finding.
2. **The `NEXT STAGE` disabling conditions**, stated plainly, with what the
   screenshots were actually showing.
3. **The I2 gap sizing**, as a count and a sample.
4. **The I3 measurement**, at 1240 and 1920.
5. **The I4 options**, with costs, not chosen.
6. **The phase plan**, with the argument for any departure.
7. **Anything in this brief that cannot be built as stated**, and there will
   be something, because it was written from photographs.

Then stop and wait for sign-off.
