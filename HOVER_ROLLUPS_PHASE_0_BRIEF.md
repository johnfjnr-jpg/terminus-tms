# Criterion hover and lens rollups

## Phase 0, investigation and plan

**Round number to be confirmed against the repo.** Round 31 merged to `main`
at `9510199`.

---

## What this phase is

**Investigation and a plan. No file edits, no migrations, no code, no
configuration changes.**

---

## What this round is

Two things, both raised by the business after using the Round 31 panel.

**1. The criterion's question is not findable.** Verbatim: *"For Budget
confirmed, where is 'Is money identified and committed' seen? Is it a hover
over the Budget confirmed field? It's not showing at the moment except in the
history pull down."*

**2. Four lens rollups on the exit criteria panel**, so a stage tells you at a
glance which lenses are complete.

**Round C waits behind this round**, on the business's own decision. The
rollups are what make twenty-three criteria manageable, so configuring them
first would mean meeting twenty-three criteria in a panel not yet made
legible. That is the same ordering that held Round C behind four rounds of
panel work, and it was right each time.

---

## 1. The question text

**Round 30 Phase 2 moved it off the row deliberately.** Name plus question is
521px, and with the level control that is 848px of the 876px a 1240 pane has.
It went into the definitions block as the region's lead sentence, and the name
carries it as a `title` attribute.

**The business could not find it.** Either the `title` is gone, or a `title` is
too quiet.

**The decision, confirmed with the business: make the hover work properly.**
Not back on the row — the cost is measured and it does not fit at 1240, where
137px remains after the criterion cell and segments.

**The mechanism exists.** Round 31 Phase 3 built a hover-and-focus popup for
the level definitions: floating rather than in-row, because in-row moved the
six rows below down 36px under the pointer; no debounce, measured rather than
inherited; centred then clamped; identity read from the element at hover time.

**Two of §8's four properties transfer and two do not.** Round 31 established
which and why. **Re-derive rather than copy** — a criterion name is not a
segment and the fourth property inverted last time.

---

## 2. The four lens rollups

**Confirmed with the business, and the answers to three questions resolve what
would otherwise be a contradiction.**

| | |
|---|---|
| **What** | Four rollups on the exit criteria panel: Commercial, Organisational, Technical, Legal |
| **Satisfied when** | Every criterion in that lens is at **Not applicable, Buyer confirmed or Verified** |
| **Not applicable counts** | Yes. It is a complete answer that closes the question, which is why Round 28 decided it requires no reason |
| **Manual or computed** | **Computed.** A display |
| **Display or gate** | **A display.** The approvals still gate |
| **Alongside or instead of Assessment reviewed** | **Alongside.** That tick stays manual and unchanged from Round 26 |

### Why "a display" resolves the tension

The business initially described the rollups in terms that read as a gate, and
a gate would have reopened two settled decisions.

**Round 26 settled that the criteria inform and the approvals gate**, choosing
a manual Assessment reviewed tick over a computed rollup because a computed
rollup tightens silently as criteria are configured and is satisfiable by
clicking through everything at Unknown.

**Round B established that no threshold gate is expressible**: the evaluator
checks array length and entry stage and never reads the value.

**A computed display needs neither.** It reads the same series the Assessment
panel already reads and counts. **No `assessment_current` rule, no gate-rule
mechanism, no engine change**, and Round 26's decision stands untouched.

### One mapping that is a judgement rather than an obvious consequence

Not applicable, Buyer confirmed and Verified satisfy. **That leaves Unknown and
Our hypothesis as the two unsatisfied states.**

Unknown is plainly a gap. **Our hypothesis is a real answer that is not yet
confirmed**, and it will read as a gap. That is probably right — a lens full of
hypotheses is not a lens to be confident in — but it is a judgement and should
be recorded as one rather than as arithmetic.

### The acknowledgement, and it is Round D's

The business also described: *"if not, and the stage approvals are provided, we
check and confirm that whoever has clicked approve accepts all the criteria are
not present but they are happy to progress to the next stage."*

**That is Round D's incomplete-approval reason**, designed in Round B and
deferred: an approver may approve with unanswered criteria, recording why.

**Per lens rather than per approval is sharper** than what Round B specified —
"Legal approved with three criteria unanswered, reason recorded" is a more
useful record than "approved with gaps somewhere."

**Not this round.** Recorded so Round D meets the refinement rather than the
original.

---

## Investigations

### I1. What happened to the question text

**The question.** Is the `title` attribute still on the criterion name, and
does it work?

Report from source and from the live page. **Round 30 Phase 2 put it there;
Round 30 Phases 3 and 4 and Round 31 Phase 4 all rewrote that row.**

**If it is gone**, that is a regression and the round should say which phase
removed it.

**If it is present**, report what a native `title` actually does — its delay,
its styling, whether it is reachable by keyboard — and whether "too quiet" is
the honest diagnosis.

Report where else the question renders. The business found it in the
disclosure, which is where Phase 2 put it as the region's lead sentence.

### I2. The hover mechanism

**The question.** How much of Round 31 Phase 3's popup transfers to a criterion
name?

Report each of its properties and whether it earns its place here:

- **Floating rather than in-row.** Round 31 measured in-row moving the rows
  below down 36px under the pointer. **Does a criterion-name hover have the
  same problem?** The name is at the row's left edge, not among five segments.
- **No debounce**, refused on measurement: five shows for five segments in a
  667ms sweep, no hide between them. **A criterion name is one target, not
  five.** Re-derive.
- **Centred then clamped.** Round 31 found a 62px overhang at 1240 on the
  rightmost segment. A left-edge element clamps on the other side, or not at
  all.
- **Identity at hover time.** Transferred last time; report whether it applies.

**Report focus.** Round 31 gave the segments hover and focus, and the business
has since said the arrow keys add no value. **A criterion name is not
focusable today.** Whether it should become so is a decision, and the
definitions block already carries the question for anyone who cannot hover.

**Report whether one popup or two.** The level popup exists. A criterion popup
showing a different string could reuse the element or need its own, and two
popups that can both be open is a state nobody has designed.

### I3. What the exit panel looks like with four rollups

**The question.** What does the exit criteria panel render today, and what do
four rollups do to it?

Report the current panel per stage: how many requirements, what they read,
and the panel's height at 1240 and 1920.

Round 31's screenshot showed Qualification with one requirement, *Assessment
reviewed*, and the panel at roughly 200px. **Solution Alignment carries four
in Round 30's configuration and will carry more.**

**Report where four rollups sit** relative to the existing requirements, and
whether they read as requirements or as something else. They are a display and
the rest of that panel gates, so a rollup that looks like a gate would be
lying.

### I4. Computing satisfaction

**The question.** What does the exit panel need to compute a lens rollup, and
does it already have it?

The Assessment panel reads criteria with their `lens_id` and the record's
series. **Report whether the exit panel has access to the same data**, or
whether this needs a fetch it does not currently make.

**Report the empty cases**, because they are not the same:

- A lens with **no criteria configured at all** — three of four today.
- A lens with criteria, **none assessed**.
- A lens whose criteria are **all Not applicable**.

**The first is the one to get right.** Three lenses are empty until Round C,
and "satisfied" and "nothing to satisfy" must not render the same.

### I5. What the design cannot express

**Output item 4 has caught the brief's central premise being wrong five times
in eleven rounds.**

---

## The plan to produce

Suggested shape, argue with it:

| Phase | Content |
|---|---|
| 0 | This investigation |
| 1 | The criterion hover |
| 2 | The lens rollups on the exit panel |
| 3 | Full walk and close-out |

**Small, and it should stay small.** Round C is twenty-three criteria and it is
waiting.

**Argue with it.** If I4 shows the exit panel cannot see the assessment data,
Phase 2 grows.

---

## Verification requirements

**Captures of a hover state need the subject asserted visible and still
rendered after the capture.** Round 31 Phase 3 found the shutter ends the hover
**even on a full-viewport capture with no clip**, and captured the focus path
instead. **A criterion name may have no focus path**, so report how the hover
is evidenced before relying on an image.

**Round 31 Phase 4 found three instruments and two invalid.**
`elementFromPoint` reports hit-testing, and a `pointer-events: none` popup
reports whatever is underneath. A clipped pixel diff returned identical hashes
for two visibly different states.

**Calibrate on the kind of change each phase makes.** Six variants recorded.

**No probe prints a conclusion it has not computed.** Twice in Round 31.

**Capture the whole run, never through a filter.**

**Measure the exit panel at 1240, 1920 and 3440** before and after, re-measured
rather than quoted.

**Test Bed pixel-identical.** Opportunity-only.

**Enumerate teardown from the database by this round's tag.**

---

## Explicit non-goals

- **Round C.** Waiting on this round.
- **The incomplete-approval acknowledgement.** Round D, with the per-lens
  refinement recorded.
- **Any gate.** The rollups are a display. The approvals gate.
- **`assessment_current` rules.** Still zero, still deliberate.
- **A roving tabindex for the segments.** Recorded in Round 31, not fixed.
- The three-string reconciliation, `measurabilityConfirmed`, the app-wide `<p>`
  reset, Terminus Documents leading the row, the Closed Lost hover wording, the
  Reference tab round, reopening a loss, the open-decisions convention, the
  approval snapshot.

---

## Output format

1. **I1 to I5**, each with the command run or the interaction performed, the
   actual output, and the finding.
2. **The I1 answer, stated plainly**: is the `title` present, and is "too
   quiet" the right diagnosis.
3. **The I4 empty cases**, and how each should read.
4. **The phase plan**, with the argument for any departure.
5. **Anything that cannot be built as stated.**

Then stop and wait for sign-off.
