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

---

# Phase 0 report

Round 29. Investigation only, no code. Signed off 2026-08-24.

Round number confirmed against the repo: the highest `Merge Round N` is 28, at
`d445ab8`. The brief was committed to `main` before branching, and the branch
was taken from `main` rather than from `d445ab8` so it carries its own scope
from the start, per build discipline rule 9.

**Three of four screenshot premises were wrong.** That is the round's own
argument demonstrated on its own input.

---

## I1. What is built, read from source

### The action bar

`.tb-tab-actions` is INSIDE the tab strip element, its last child after the ten
stage tabs, pinned right by `margin-left: auto`
(`frontend/index.html:873-877`). Round 7 Phase 6 built it, replacing BOTH a
separate save-bar banner line AND a "Stage Transition" section.

Two feedback elements sit under the row and are deliberately not merged,
`tb-save-feedback` and `tb-next-stage-feedback`. The rationale is written
beside them: one says "your edit was refused", the other "this transition is
blocked", and a shared element would let the second overwrite the first.

### Cancel and Save changes

`updateTbSaveBar()`, `frontend/test-bed-detail.js:2589`:

```js
const dirtyCount = Object.values(tbEdits).filter(e => e.draft !== e.orig).length
const show = dirtyCount > 0 || tbInvalidFields.size > 0
```

Both toggle on `show`. `saveBtn.disabled = tbInvalidFields.size > 0`, so an
invalid numeric field disables Save rather than letting the value travel to the
server to be refused. **The bar stays visible at dirtyCount 0 while a field is
invalid**, because `tb-save-feedback` sits alongside and hiding the controls
would hide the message explaining the block.

### The chevron hover panel

`wireTbChevronHover()`, `frontend/app.js:1495`, Round 7 Phase 9. Trigger:
`mouseover` on `.chevron-item[data-stage]`, debounced 180ms; a load token; a
`mouseleave` on the WRAPPER so moving the pointer into the popup is not a
leave; and the chevron itself has never had a click handler in this app's
history.

It lists `result.data.blocking` from
`GET /api/records/:id/exit-criteria?stage=<name>`, or "Nothing outstanding."

**Unreached stages resolve by construction, not by a special case.** The
endpoint "never validates whether a reachable stage was requested, only which
`stage_gate_rules` rows get looked up" (`src/routes/records.js:290-299`).

---

## The NEXT STAGE conditions. BOTH readings were wrong

`refreshTbNextStageButton()`, `frontend/app.js:4240`, is the ONLY writer of
`#tb-next-stage-btn.disabled`. Writers elsewhere in `frontend/`: zero.

| # | Condition | Label |
|---|---|---|
| 1 | `!nextStage`, the record is at its final stage | changes to "Final stage" |
| 2 | `!onCurrentStageTab`, the open tab is not `stage-<record.status>` | stays "Next Stage" |

```
refreshTbNextStageButton mentions tbEdits:      0
refreshTbNextStageButton mentions criteria/met: 0
  calibration, it does mention 'nextStage':     3
```

**Unsaved changes do not disable it. Unmet exit criteria do not disable it
either.** Unmet criteria are refused at the SERVER: `attemptTransition` posts,
receives a 422 with `blocking[]`, and renders the list into
`tb-next-stage-feedback`. The button is clickable and the refusal is explained.

**The screenshots were showing condition 2**, the user on a tab that is not the
record's current stage. That is the only disabling the comments call a
confirmed business rule: stage progression happens from inside the stage
itself.

---

## I2. The gap, as a count and a sample

**Specified and not built.** Five numbered sections. The header reads "Status:
Specification only, not yet implemented" and **that is false**: section 4's
focus trapping is built at 42 sites, section 3's error treatment at 35, and
section 5's discard-confirm halves are built and named in its own body. Only
section 5's SYSTEM-WIDE REGISTRY is genuinely unbuilt. Sections 1 and 2 are
partial, 27 `tabindex` and 8 `Enter` handlers.

**Built and not specified**, ten sampled mechanisms each carrying a written
rationale in code comments:

| mechanism | in source | in the standards |
|---|---|---|
| Next Stage and its two rules | 2 | 0 |
| the tab-line action bar | 3 | 0 |
| chevron hover popup | 59 | 0 |
| load-token race discipline | 32 | 0 |
| sub-tab strip component | 10 | 0 |
| definitions disclosure | 10 | 0 |
| sticky save bar | 18 | 0 |
| pending vs confirmed tick mark | 2 | 0 |
| "Not yet at this stage" | 3 | 0 |
| mandatory reason on a revision | 13 | 6 |

**Ten of ten have zero coverage.** The tenth's six hits are the English word
"reason", not the mechanism, checked rather than counted.

---

## I3. The strip. THE CONSTRAINT IS INVERTED

| | tabs | tabs total | rows | rightmost tab ends | free at right |
|---|---|---|---|---|---|
| Test Bed 1240 | 10 | 1304px | 2 | 843 | **33px** |
| Test Bed 1920 | 10 | 1304px | 1 | 1484 | **72px** |
| Opportunity 1240 | 9 | **832px** | 2 | 193 | **683px** |
| Opportunity 1920 | 9 | 832px | 1 | 992 | **564px** |

Both strips are 876px at 1240 and 1556px at 1920, both `flex-wrap: wrap`.
**Test Bed already carries three controls, 135px, in the tighter strip.**

The brief's "876px in 876px with zero margin" does not describe the current
strip. Three controls on Opportunity's tab line is not a space problem.

---

## I4. Reference HAS a bar, and Opportunity has three dirty mechanisms

The brief says Reference has its own per-field mechanism "with no bar". It has
one: `#ref-edit-bar` (`frontend/index.html:1493`) with `#ref-cancel-all` and
`#ref-save-all`, driven by `updateRefEditBar()`
(`frontend/opportunity-reference.js:387`), reporting "N fields open, M
changed". Accounts reuses the same `.ref-edit-bar` class.

| | mechanism | refs |
|---|---|---|
| Opportunity assessment | `oppAssessDirtyKeys` | 10 |
| Opportunity reference | `refEdits` / `dirtyEntries` | 10 |
| Test Bed | `tbEdits` | 30 |

**Opportunity has three dirty mechanisms; Test Bed has one.**

### The options, not chosen

| | What | Cost |
|---|---|---|
| A | Leave both scopes, move only the assessment bar to the tab line | Cheapest. A record-level position implying record-level scope while covering one panel. Two bars can be visible at once |
| B | Unify assessment and Reference behind one bar | Touches a working mechanism, which Round 28 Phase 5 declined for reasons that still apply |
| C | Move only advance and Closed Lost; leave save where it saves | Keeps save beside its scope. Does not reproduce Test Bed's grouping |

---

## I5. Closed Lost has no Test Bed equivalent

`close-lost`, `closeLost`, `abandon`, `Closed Lost` all return 0 in
`test-bed-detail.js`; calibration, `stage` returns 79. No precedent to copy.
Opportunity's is a `btn-ghost` beside the `btn-primary` advance, with the
rationale written beside it, one primary action on this panel, and it opens a
prompt with `returnFocusTo` wired: section 4's pattern applied without section
4 mentioning it.

---

## I6. What the design could not express

Four premises checked, THREE wrong: the NEXT STAGE rule in both readings, the
strip being tight, and Reference having no bar. The one that held: the bar is
at the right end of the tab strip, outside the stage panel, `NEXT STAGE` always
present, the other two only when dirty.

---

## Cannot be built as stated

**"Move save, advance and Closed Lost to the tab line" is not one move**,
because there is no single Opportunity save. Two bars cover different scopes.

**The chevron hover is construction, not a port.** `#tb-chevron-wrap` is static
markup and Opportunity has no chevron strip at all, so the per-record lifecycle
differs. The static wrap is precisely why Test Bed's listener is attached once.

**Phase 1 cannot be documentation-only and honest** without correcting the
status header, which is a statement about what is built.

---

## The accepted phase plan

| Phase | Content | Change |
|---|---|---|
| 0 | This investigation | as briefed |
| 1 | The built patterns into `INTERACTION_STANDARDS.md`, including the status header | briefed 1, widened by one line |
| **2** | **The save-scope decision, per I4** | **briefed 3, moved before the move** |
| 3 | Move the controls to the tab line | briefed 2 |
| 4 | Closed Lost placement | briefed 4 |
| 5 | The chevron hover, per the business | briefed 5, and it is construction |
| 6 | Full walk and close-out | briefed 6 |

**I4 moves before the move**: you cannot move "the save bar" before deciding
which of two bars it is. The original ordering would either move one and leave
the other, which is the false implication, or force the scope decision inside a
phase scoped as a layout change.

---

# Phase 2: the save scope, measured

**A decision phase. No code, and the decision is not taken here: it is
recommended and awaits sign-off.**

## What two dirty bars actually looks like

**Today they can never both be on screen.** Measured on one record at 1240:

| State | assessment bar | reference bar | both on screen |
|---|---|---|---|
| clean, on Reference | hidden | hidden | **false** |
| assessment drafted, on Assessment | visible, 876x71 | hidden | **false** |
| plus a Reference field open, on Reference | **not on screen** | visible, 420x56 | **false** |

In the third row `assessDirty` is 1 and `refDirty` is 1: **both scopes are dirty
at the same time**, and the assessment bar is not hidden by its own class. It is
invisible because its ancestor tab panel is. Only the open tab's bar renders.

**Nothing prevents both being dirty.** `refEdits` is reset only in
`renderReferenceTab()` (`frontend/opportunity-reference.js:252`), which runs on
record load; the Opportunity tab switcher only toggles `hidden` on panes
(`frontend/app.js:245`); and Round 28 Phase 1 clears the assessment maps on a
record change, not on a tab change. So the state is reachable by an ordinary
sequence and is held indefinitely.

## Option A, previewed rather than argued

The assessment bar was reparented into the tab strip client-side, with no code
change, to photograph the proposal:

| | |
|---|---|
| both on screen | **true** |
| assessment bar | tab strip, second row, 416px wide at left 762 |
| reference bar | 157px below, inside the Reference panel |
| vertical gap | 157px |

**It fits.** The bar lands in the free space Phase 0 measured, 683px at 1240.
**Space was never the problem.**

**Looked at, it reads as confusion rather than as two controls**, for four
reasons that are visible in the capture and are not matters of styling:

1. The record-level bar says **"1 assessment ready to record"** while the reader
   is on **Reference**. It describes work on a tab that is not on screen.
2. **Two Cancel buttons**, 157px apart, cancelling different things.
3. **RECORD and SAVE**, two words for the same act, on one screen.
4. The bar sits in the tab strip's **second row**, beside the wrapped tabs, so
   its position says "record level" while its content says "one tab".

## How rare, and the honest answer

**Nothing prevents it, and it is unlikely rather than blocked.**

- Reference is the landing tab, so the natural order is Reference then
  Assessment, not the reverse.
- Reaching it takes a deliberate sequence: draft an assessment, switch tab,
  open a Reference field.
- **But it is exactly what someone scoring an assessment does when they notice
  the Opportunity name is wrong**, and there is no warning on leaving the
  Assessment tab with a draft: Round 28 Phase 7's guard covers a record change
  and a page unload, deliberately, because a tab change loses nothing.

**Option A would make it more likely, not less.** A bar visible from Reference
invites a press from Reference, and the press would record an assessment the
reader cannot see.

## The recommendation: OPTION C, awaiting sign-off

**Move advance and Mark Closed Lost to the tab line. Leave both save bars with
the panels they save.**

**The reasoning, and it is the part worth keeping.** Test Bed's bar carries
Save because **Test Bed's save IS record-level**: one dirty map, `tbEdits`
(`frontend/test-bed-detail.js:15`), covering every field on the record. Its
grouping is a CONSEQUENCE of its single scope, not a layout convention to copy.

Opportunity has three mechanisms and no single record-level save. Putting a
panel-scoped save in a record-level position copies the position without the
property that earns it, and the capture is what that costs.

**Advance and Closed Lost are genuinely record-level**: they act on
`records.status`, not on any panel's edits, so the tab line is where they
belong on both record types.

**This is not a dead end for option B.** When the system-wide registry
`INTERACTION_STANDARDS.md` Section 5 specifies is built, Opportunity's save
becomes record-level for real and can join the bar then. Option C is the step
that does not have to be undone. Option A is the step that would.

**What C does not do**, stated so it is a choice rather than an omission: it
does not reproduce Test Bed's three-control grouping. Opportunity would carry
two controls on the tab line and Test Bed three, and that difference is
principled rather than accidental.

---

# Phase 4: the prominence judgement. NOTHING CHANGES

**Phase 3 already moved Closed Lost, so what remained was the prominence
judgement found by looking. It is measured here, three treatments were
previewed, and the recommendation is that nothing changes.**

## The mechanism, from source

`.btn-primary:disabled` and `.btn-ghost` resolve to the SAME colours
(`style.css:1619` and `:1637`): `--muted` text, `--hairline-strong` border. The
only difference is that the disabled rule adds `opacity: 0.5`.

**So a disabled primary is an enabled ghost at half opacity.** The dominance is
not a matter of taste; it is one declaration.

## Measured, as rendered

Effective alpha, the colour's own alpha times the element's opacity, which is
what the eye receives:

| State | advance text | lost text | ratio |
|---|---|---|---|
| the record's own stage tab | **1.0** (green) | 0.5 | 0.5x, correct |
| any other tab | 0.25 | 0.5 | **2x, inverted** |
| a Closed Won record | 0.25 | 0.25 | 1x, both disabled |

**Advance is disabled on 8 of the 9 tabs**, counted by clicking every tab and
reading the button. So the inverted state is the default, not an edge case.

## The argument tested rather than accepted

Phase 3 said the dominance is "arguably correct, since it is the only available
action there." **That reason does not survive.** Round 21 Phase 7's own comment,
now recorded at Section 10, says the intent is that giving both equal weight
"would put an irreversible action alongside the routine one with nothing to
tell them apart". The current state does not give equal weight; it gives the
irreversible one double, on 8 of 9 tabs. A state that exceeds the thing the
design was written to prevent is not defended by saying it is informative.

**A different reason does survive, and it is the one the recommendation rests
on.** The consequence of pressing Mark Closed Lost is not a lost deal. It is a
dialogue headed "Mark this opportunity Closed Lost", carrying a mandatory
reason, an explicit "This cannot be undone" warning and a confirm
(`frontend/app.js:833` onward). **Prominence tracking consequence is satisfied
at the point of consequence, which is the dialogue, not the border.** The
realistic cost of a curiosity click is a wasted dialogue open.

## The three treatments, previewed and looked at

| | Effect | Verdict |
|---|---|---|
| **A, as built** | lost 0.5 text in a 0.22 border; advance 0.25 in a 0.11 border | The Closed Lost box is what the eye lands on. The 2x is perceptible, because at these levels it is the difference between barely there and readable |
| **D, drop the border** | lost 0.5 text, no box | Removes the affordance that says it is a control. Beside a bordered button, a bare label reads as a caption |
| **D2, drop the border and dim to `--muted-2`** | lost 0.32 text, no box | **Inverts the problem.** The disabled bordered button becomes the more prominent element, so the screen says the thing you cannot do matters more than the thing you can |

**Every remedy costs something real**, and the structural reason is that
availability and prominence pull opposite ways here: any enabled control
outweighs any disabled one, because that is what disabled means. The two
principles cannot both hold for adjacent controls where one is disabled by
default.

## The recommendation

**No change, and no diff.** Manufacturing one would trade a measured 2x for an
affordance loss or an inversion, both of which are worse.

**No Test Bed comparison was run**, because nothing changed and a comparison
that cannot fail is not evidence.

## What would make this worth revisiting

Stated so the decision has an expiry rather than being permanent by default:

- **A reported mis-click.** The dialogue is the guard, and if it is being
  reached by accident the guard is doing work it should not have to.
- **A second irreversible action joining the tab line.** One available
  irreversible control beside one disabled routine one is the case measured
  here; two would change the reading.
- **A disabled treatment that is not `opacity: 0.5`.** The whole effect follows
  from one declaration shared app-wide, so if that is ever revisited for other
  reasons, this pairing should be re-measured rather than assumed.

---

# Phase 6: the full walk, and the round's close-out

## The walk

One Opportunity through Qualification, Solution Alignment and Proposal, scoring
and saving from the panel, advancing from the tab line, hovering chevrons at
each stage; then a second record marked Closed Lost from the tab line.

**The walk found no problem.** Every round before this one found something in
the walk the targeted phases did not, so that is stated plainly rather than
taken as proof the walk was thorough.

### The three things this round made worth watching

**Advance from the tab line, and the tab following the record.** Round 22 built
that behaviour and Phase 3 moved the control that triggers it. At both
transitions the control was disabled off the record's own stage tab and enabled
on it, and after the move the open tab was the record's NEW stage:
Qualification to Solution Alignment, then Solution Alignment to Proposal, with
`activeStage` matching the record each time.

**An unsaved draft, then the tab-line controls.** Round 28 Phase 7's guard
covers a record change and a page unload, and the tab line is a surface it had
never met. Measured at two stages: switching to a stage tab with a draft held
raised no dialogue and discarded nothing, and the unload guard was still armed
while the draft was held. **The tab line changed no part of that**, which is the
right answer: a tab switch loses nothing, so warning about it would be false.

**A chevron hover while a save is in flight.** The load token and the save's own
sequencing had never run against each other. At both stages the save reported
"Recorded 1 of 1", the popup showed the stage the pointer was resting on and
never another, and exactly one exit-criteria request was issued.

### Closed Lost from the tab line

The dialogue carried its heading, its reason picker and the "cannot be undone"
warning. After confirming, the database read Closed Lost, advance read "Final
stage" disabled, Mark Closed Lost was disabled, and the record landed on
Reference with no active stage tab, which is correct: Closed Lost carries
`reachable_from_any_stage` and therefore has no tab to land on.

---

## Rule 7, under its corrected wording

**Sign-offs enumerated from the conversation FIRST, then `git log`.** The order
is the control: a list derived from the commits and checked against the commits
is a check against itself.

| Sign-off | Commit |
|---|---|
| Phase 0 | `64aec69` |
| Phase 1 | `e232e2c` |
| Phase 2 | `640dcd7` |
| Phase 3 | `36b1b8b` |
| Phase 4 | `a210e55` |
| Phase 5 | `7de8d1a` |
| Phase 6 | this commit |

Six sign-offs before this one, six commits, one to one, none missing. Plus
`34ebad6` on `main`, the brief committed before the branch was cut: instructed
work, not a phase.

## `CURRENT_STATE.md`: NOT regenerated

**This round changed no migration, no seed and no route.** The full diff against
`main` is five files: two documents and three frontend files. Measured:
`git diff --name-only main..HEAD -- supabase/migrations supabase/seeds
src/routes` returns **0**, and the same command over `frontend` returns 3, so
the query was reading the range.

---

## Records carried beyond the phase list

### R1. Seven premise corrections, and the count is itself a finding

**Enumerated rather than tallied**, because a running count is exactly the kind
of number this round has been about.

**From the brief, which was written from photographs by someone without
repository access, and said so:**

1. `NEXT STAGE` is disabled while the record is dirty. **Wrong.**
2. The greying is more likely the exit criteria being unmet. **Also wrong.** The
   only writer of that button's disabled state disables on two conditions,
   final stage and not-on-the-current-stage-tab, and references neither
   `tbEdits` nor any criteria state.
3. The strip is at 876px in 876px with zero margin, so a third control would
   overflow at 1240. **Wrong**, and inverted: nine tabs total 832px with 683px
   free, while Test Bed carries three controls with 33px free.
4. Opportunity's Reference tab has no bar. **Wrong.** `#ref-edit-bar` exists and
   reports "N fields open, M changed".

**Mine:**

5. "Built at 42 sites" and "35 sites" in Phase 1. **Line counts presented as
   site counts**; 42 lines hold 53 occurrences. Corrected before that phase
   committed.
6. "Opportunity has no chevron strip at all", Phase 0. **Wrong**: it has one,
   rendered by the same shared `renderChevronStrip()`. **The cause was a `grep`
   truncated by `head -12`, read as a complete result.**
7. "The per-record lifecycle differs", Phase 0. **Wrong**: Opportunity's strip
   is static markup too, so the Round 18 exposure is identical rather than new.

**Four from the brief, three mine, seven in total.** The running tally in
conversation reached "six, five mine and two yours", which is both internally
inconsistent and misattributed. Recording the enumeration rather than the tally
is the point: **a count nobody can re-derive is the thing this round exists to
stop.**

Separately, and not a premise: my Phase 3 argument that the prominence was
"arguably correct because it is the only available action" did not survive
Phase 4.

### R2. The standards file caught an argument one phase after being written

Phase 1 wrote Round 21 Phase 7's rationale into Section 10: *giving both equal
weight would put an irreversible action alongside the routine one with nothing
to tell them apart.*

**Phase 4 then used that sentence to defeat an argument Phase 3 had made.**
The document written this round caught the reasoning of this round, one phase
after being written.

**That is the first time the standards file has done the job it was created
for**, and it is the round's own justification demonstrated rather than
asserted. The alternative history is visible: without Section 10 the argument
would have stood, because nobody would have gone looking for a comment in
`app.js` to refute a styling judgement.

### R3. A wrong number, written down, load-bearing a round later

`renderOppAdvanceControl` carried: *"Phase 2 measured the eight-tab strip at
876px in 876px, zero margin, so a ninth control there would overflow it at
1240px."*

**That is why Mark Closed Lost was in the panel at all.** The number was wrong,
it was written down, and a design decision rested on it a round later.

Corrected in place rather than left to be inherited. This is the failure
Sections 6 to 10 exist to prevent, found in the wild inside the round that
created them.

### R4. Moving a control renames it

**Every reference to the old name is a silent failure waiting.** Phase 3 created
two, both found:

- The Closed Lost failure path wrote to `#transition-feedback`, which lived in
  the stage panel and no longer existed. Its `if (fb)` guard meant it would
  **report a failure to nothing** rather than throw.
- `returnFocusTo` still named `opp-close-lost-btn-<stage>`, an id that lost its
  suffix in the move. **Round 22 Phase 3 fixed that exact line once already**,
  for the same reason: an id that resolves in the mind and not in the document,
  whose failure is swallowed by an optional call.

### R5. Availability and prominence pull opposite ways

`.btn-primary:disabled` and `.btn-ghost` resolve to the SAME colours; the
disabled rule adds `opacity: 0.5`. **A disabled primary is an enabled ghost at
half opacity.** Measured: on the record's own stage tab advance carries 1.0 text
alpha against Closed Lost's 0.5, correct; on every other tab it is 0.25 against
0.5, inverted. **Advance is disabled on 8 of 9 tabs**, counted by clicking every
tab.

**The structural finding, which is a property of any such pairing rather than a
bug in this one:** any enabled control outweighs any disabled one, because that
is what disabled means. "Prominence tracks consequence" and "disabled means
dimmer" cannot both hold for adjacent controls where one is disabled by default.

Nothing changed, because every remedy costs more than it buys: dropping the
border removes the affordance, and dimming further **inverts** the problem so
the disabled control dominates the available one. The recommendation rests on
the consequence being guarded at the point of consequence, which is the
dialogue rather than the border.

**Three conditions would make it worth revisiting**, so the decision has an
expiry: a reported mis-click; a second irreversible action joining the tab line;
or a change to the shared `opacity: 0.5` disabled treatment.

### R6. Two stale things agreeing is not a working check

The fixture teardown was still tagged `R28`, and it only caught this round's
fixture because the setup script's tag was stale in the same direction.
**Updating one and not the other would have produced a clean zero over a tag
nothing carried.** The false-clean species in a new mechanism: the previous
instance turned three 401s into three empty arrays, this one would have turned
a rename into an empty sweep.

### R7. A capture that ends the state it is capturing

**Two consecutive captures came out byte-identical with no popup in either**,
while the DOM read immediately before each said it was rendered at 373px tall.
The clipped screenshot resets pointer state, so the frame is taken **after**
`mouseleave` has fired.

**Before-only is what let the first two through.** The fix generalises: **any
capture of a transient state needs the state confirmed on both sides of the
shutter.**

Its predecessor in the same phase is milder and worth keeping beside it: the
first in-frame guard checked the popup's **position but not its visibility**, so
it passed on a hidden element, which a rect satisfies trivially.

### R8. The half-inert calibration

Injecting into `.chevron-popup` and `.chevron-item` fired 5 differences, and
**only the `.chevron-popup` half landed**. `.chevron-strip.many .chevron-item`
outranks a bare `.chevron-item`, so that half of the injection was overridden
and proved nothing.

**Specificity can make a calibration inert without making it silent.** The
instrument reported a number, and the number came entirely from the half that
worked. Claiming only what the working half proves is the difference between a
calibrated instrument and one that looks calibrated.

### R9. The document does not claim a completeness it lacks

Phase 0 sampled ten built mechanisms with written rationales and found **ten
with zero coverage**. Phase 1 documented **five of them**, in Sections 6 to 10.

The remaining five are **named and explicitly not recorded** in the document
itself: the load-token discipline, the sub-tab strip, the definitions
disclosure, the pending tick mark, and the mandatory reason on a revision.

**Naming is not recording, and a list that pretended otherwise would be the same
failure one level down.** The three-way classification carries the same
restraint: Sections 1 and 2 are marked PARTIAL rather than forced into
built-or-not, because 27 `tabindex` attributes and 8 `Enter` handlers is neither
nothing nor the standard.

### R10. One wording decision, with the business

Hovering **Closed Lost** in the chevron says "Nothing outstanding." The popup
answers *what would block leaving this stage*, and for a stage nobody leaves the
answer is vacuously nothing, which reads as *you have met the requirements* when
the truth is *there are none, and you can always come here*.

**The discriminator is `to_stage === null`, not the requirement count.** It is
shared with Test Bed's `Closed`, which has the same shape, so changing it
changes both popups. Reported with the test ready; not changed.
