# Opportunity stage tab: panel order and advance behaviour

**Round number to be confirmed against the repo.** Round 21 merged to `main`
at `8aab336`.

**This is a short round.** Two items, both reported by the business after
using Round 21's output. It is deliberately not the Reference tab rebuild,
which is the larger piece of work and follows this.

---

## Phase 0 is investigation and a plan

No file edits, no migrations, no code, no configuration changes.

---

## The two items, as reported

**1. The stage panels are in the wrong order.** They should read
**Assessments, Terminus Documents, Exit Criteria, Approvals**, left to
right, matching Test Bed.

**2. Advancing a stage shows no panels.** The advance control moves the
record, the green dot moves with it, and the panel area is empty until the
stage tab is clicked manually.

**Confirmed with the business: the tab should follow the record to the new
stage.** You advance because you are now working the next stage.

---

## Why item 2 is not a one-line fix

Three things make it worth care.

**`oppUserPickedTab` is directly implicated.** Round 21 Phase 1 introduced it
so that a user's tab click survives an in-flight page load, which was the
second of the two causes behind the reported blocker. **Advancing is the case
where the system should move the tab and the user has not asked it to.** If
the guard treats an advance the way it treats a page load, the tab will not
follow. If it is cleared too eagerly, the Phase 1 race returns. That race is
Round 5 Phase 7's Test Bed bug, which went unported for sixteen rounds, so
reintroducing it would be expensive.

**Test Bed almost certainly solves this already.** It has had an advance
control and per-stage tabs for ten rounds. **Read what it does from source
and follow it**, as Round 21 Phase 3 did for the non-current-tab rule, rather
than inventing behaviour. If Test Bed does *not* solve it, that is a finding
about Test Bed and should be reported rather than fixed here.

**The terminal case differs.** Advancing into Closed Won should land on the
Closed Won tab, which renders one card rather than four. Different landing
behaviour, and the one least likely to be covered by a test.

---

## The finding underneath, which matters more than either item

**Round 21 Phase 9 walked a record to Closed Won and to Closed Lost and did
not catch item 2.** The walk advanced and then clicked the next stage's tab,
because a harness clicks by DOM query and does not notice that a human would
be looking at an empty screen.

That is the same shape as the original blocker, where the harness completed
three ticks only because it clicks hidden rows regardless of visibility.

**A test that navigates deliberately cannot see a navigation defect.**

This belongs in the round as a recorded finding, not only as a fix. It also
shapes the verification below: **after every advance, assert what is on
screen without touching the tab strip.**

---

## Read first

| Document | Why |
|---|---|
| `CLAUDE.md` | **From disk.** It changed twice in Round 20 |
| `INTERACTION_STANDARDS.md` | Load-bearing. Focus and navigation behaviour |
| `OPPORTUNITY_DESIGN.md` | Seven open decisions |
| Round 21 close-out | Especially Phases 1, 3 and 5, and the six-instance finding |
| `CURRENT_STATE.md` | Generated. Run its staleness test |

---

## Investigations

### I1. Test Bed's behaviour after advancing

**The question.** When a Test Bed advances a stage, what happens to the
active sub-tab?

Report from source: which function handles the advance, whether it switches
the tab, whether it clears `tbUserPickedTab`, and in what order relative to
the re-render.

**Then confirm it live.** Advance a Test Bed and report what is on screen
without clicking anything.

**If Test Bed does not follow the record, say so.** That is a finding about
Test Bed, and Opportunity should still follow per the business decision, but
the two would then diverge and that needs recording rather than hiding.

### I2. What happens on Opportunity today, measured

**Reproduce it.** Advance an Opportunity through the browser and report the
active tab, the visible panels and what a user would see, **without clicking
the tab strip**.

Repeat for **three consecutive advances in one session without reloading**,
since that is the reported experience and a single advance may behave
differently from the second.

### I3. The `oppUserPickedTab` interaction

**The question.** What exactly does the guard do, when is it set, when is it
cleared, and what would each candidate change do to the Phase 1 race?

**State the race explicitly**: an early tab click during an in-flight load,
which Phase 1 fixed and which must still pass afterwards.

Report the options for distinguishing a system-initiated tab change from a
page-load default. **Do not choose one.** This comes back for review.

### I4. Panel order: decision or construction order

**The question.** Is Opportunity's current panel order a deliberate choice or
an artefact of the build sequence?

Round 21 added panels in Phases 3, 4 and 5, and the row may simply reflect
that. Report Test Bed's order from source, Opportunity's order, and whether
anything other than markup position determines it.

### I5. The terminal landing case

**The question.** What happens when a record advances into Closed Won?

Closed Won hides the four-panel row and renders a single completed-record
panel, keyed on `is_terminal`. Report what the tab should do and whether the
same mechanism carries.

---

## The plan to produce

Small phases, each verifying, each committing. Suggested shape, argue with it:

| Phase | Content |
|---|---|
| 0 | This investigation |
| 1 | Panel order |
| 2 | Advance follows the record, per the I3 decision |
| 3 | Terminal landing case |
| 4 | Verification: repeated advances, no tab clicking |

**If I1 shows Test Bed already solves this cleanly, Phases 2 and 3 may
merge.** If Test Bed does not solve it, Phase 2 grows and the divergence
needs recording.

---

## Verification requirements

**After every advance, assert what is on screen without touching the tab
strip.** This is the round's central lesson and it is not optional. A
verification that clicks the destination tab cannot see this defect.

**Three consecutive advances in one session without reloading.**

**The Phase 1 race must still pass.** An early tab click during an in-flight
load must survive. Verify it explicitly rather than assuming the change did
not touch it.

**Look at the result.** Presence is not legibility, and no assertion in Round
21 caught an empty panel area after an advance.

**Calibrate every absence-shaped check**, and confirm any probe distinguishing
two states returns different values in each.

---

## Explicit non-goals

- The Reference tab rebuild, the four Reference-tab defects, and the
  `refFieldRow` fork. Next round.
- Deal and Risk assessments. The Assessments panel stays a placeholder.
- Rule 7, `test-bed-name-suggestion`, `approver_id`, the `CURRENT_STATE.md`
  table blind spot, Test Bed's static tab strip. All recorded, none this
  round.
- Rejection reason codes, `routing_rules`, the four dates, the revision
  event.
- The Exit Criteria and Approvals duplication.

---

## Output format

1. **I1 through I5**, each with the command run or the interaction
   performed, the actual output, and the finding.
2. **Any disagreement between a generated file and a hand-written one**,
   reported and not resolved.
3. **The I3 options**, presented for a decision and not chosen.
4. **The phase plan**, with the argument for any departure.
5. **Anything that cannot be built as stated.** These items were settled from
   a business report without repository access.

Then stop and wait for sign-off.
