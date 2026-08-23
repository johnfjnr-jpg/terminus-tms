# Assessment fixes: history display, exit criteria swap, value capture

## Phase 0, investigation and plan

**Round number to be confirmed against the repo.** Round 25 (Round B) merged
to `main` at `1310d56`.

---

## What this phase is

**Investigation and a plan. No file edits, no migrations, no code, no
configuration changes.**

---

## What this round is

The business used the Assessment tab on a real opportunity and reported four
things. Two are defects, one is a design decision now taken, and one is
already scoped to Round C.

**This round is not Round C.** The other three lenses and the remaining
twenty-five criteria are unchanged and out of scope.

---

## The four items as reported

### 1. The history display is one behind. Defect.

Verbatim: *"it looks like the reason record is displaying 1 save behind what
I am entering. My last reason was verified 2, this is what we got"* and
*"When I enter verified 3 for the reason it is only showing verified 2."*

The screenshot shows the history list on Budget confirmed with `verified 2`
newest, `new vrified` below it, and the current value reading **Verified**
correctly.

**Reproduce before diagnosing.** The likely cause is the shape Round 21 Phase
1 fixed for exit criteria: a re-render from a stale source after a
successful write. Round 25 Phase 6 established that scores travel in the
record payload rather than a separate fetch, and criteria are cached per
page. If the panel re-renders from the cached record without refreshing it,
the display shows the state before the write while the select holds what was
just chosen.

**Round 25 Phase 6 verified entry counts against the database**, which would
pass while the display lagged. That is the gap in the earlier verification
and it is worth naming rather than only fixing.

Note two entries share a timestamp of `06:39` in the screenshot, so
**confirm the off-by-one rather than inferring it from the image.**

### 2. Value capture on Budget confirmed. Design, now decided.

Verbatim: *"I entered verified but it only asked me for a reason, not for the
actual data which I thought we were requesting."*

**Background, because this was deferred deliberately and is now reopened by
use.** The business confirmed during design that criteria carrying an answer
as well as a confirmation should store the answer. Round B's brief deferred
it, on the grounds that no read path exists and shipping a write nobody can
query repeats the loss reason, which Round 21 stored and nothing displays to
this day.

**The cost of the deferral is now visible: the reason field is being used as
a data field.** In real use that becomes a budget figure and its source typed
into free text, which is unqueryable. The deferral did not avoid capturing
the value; it moved it somewhere it cannot be read.

**Decision: a narrow first pass on Budget confirmed only.** Not the other
six Commercial criteria, not the binaries, not Timeline or Funding
mechanism. The business's reasoning: it is the criterion actually used, the
shape is simple, and it will show whether the value belongs beside the score
before twenty-five more criteria are configured around the answer.

**Report the options and their costs.** The value is a figure with a
currency. Where it lives, whether it is per entry or per criterion, and
whether it is queryable are all open. **Do not choose.**

**One thing to size explicitly: is this general or specific?** A value on one
criterion could be a `value` field on the score entry that only Budget uses,
or a per-criterion declaration that a criterion carries a typed answer. The
first is cheaper and the second is what twenty-five more criteria would need.
Report both.

### 3. Exit criteria swap. Configuration, decided.

Verbatim: *"Where are the timeline, commitment to move forward as part of the
assessment?"*

**The finding underneath.** Qualification's exit criteria are Budget,
Timeline and Commitment to move forward, built in Round 20 before the
assessment existed. The assessment now carries **Budget confirmed** at
Qualification with five levels, a reason, an author and a history.

**Those are the same fact in two places and nothing keeps them in step.** A
tick can be set while the assessment reads Unknown, or the assessment can
read Verified while the transition is refused for want of a tick. Once
Organisational lands in Round C, Timeline and Commitment duplicate too.

**The decision, taken with the business:**

| | |
|---|---|
| Qualification | **Remove** Budget, Timeline, Commitment. **Add** Assessment reviewed |
| Solution Alignment | **Add** Assessment reviewed. Existing criteria unchanged |
| Proposal | **Add** Assessment reviewed. Existing criteria unchanged |
| Negotiating | **Add** Assessment reviewed. Existing criteria unchanged |

**Why a tick rather than the rollup rule.** Round A built
`assessment_current`, which computes whether every criterion required at a
stage or earlier carries a current entry. The business chose a person
recording that they read the assessment instead.

The reasoning, recorded because it will be re-litigated: a computed rollup
tightens silently as criteria are configured, and is satisfiable by ticking
through every criterion at Unknown. **A named person saying they reviewed it
is one deliberate act, attributed and dated, that does not tighten.** It is
also consistent with the earlier decision that the criteria inform and the
approvals gate; a rollup rule would have quietly made the criteria gate
again.

**`assessment_current` is therefore built, exercised on a synthetic record
type in Round A, and not used.** Recorded as such, not removed. It may be
wanted later.

**The business framing to record with the decision:** four rows, removable
by four deletes if the tick turns out to be a formality. Cheap to try and
cheap to reverse.

**One watch item, recorded not built.** A tick saying "I read it" is
satisfiable without reading it, the same risk as the reason on an incomplete
approval. The six-month test already in `OPPORTUNITY_DESIGN.md` covers it: if
nobody ever declines to tick it, the honest move is to remove it rather than
harden it.

### 4. Organisational criteria. Round C. Not this round.

Timeline declared, Economic Buyer identified, Prioritisation and Champion
identified are all Organisational, which Round C configures. Only Commercial
is live, which is why Budget confirmed appears alone.

**Working as scoped.** The business's report reads as a defect because a lens
sub-tab saying "no criteria configured yet" is less informative than a stage
showing what is missing. **No change here**, but report whether the empty
lens wording could say more, for Round C to consider.

---

## Read first

| Document | Why |
|---|---|
| `CLAUDE.md` | **From disk** |
| Round 25's Phase 0 report and close-out | The panel, the write path, the caching |
| Round 21 Phase 1 | The stale-source re-render, the closest precedent for item 1 |
| Round 20 | Where Qualification's three exit criteria were configured |
| `OPPORTUNITY_DESIGN.md` | The Assessments section, and the cumulative-rollup subsection added in Round 25 Phase 1 |
| `CURRENT_STATE.md` | Generated, and **known blind**: it cannot see four assessment tables, nor `lens_id`, `scale_id` or `reason_required` |

---

## Investigations

### I1. The history defect, reproduced

**Reproduce it in the browser before forming a theory.** Score a criterion,
read the history, score it again, read it again. **At least three saves in
sequence without reloading**, which is the standard this project set after
Round 21's blocker survived a walk that clicked once.

Report what the history renders from, and whether the current value and the
history come from the same source. **The screenshot shows the current value
correct and the history stale**, which suggests two sources.

**Watch for the probe faults this round is prone to.** Round 25 Phase 6 and
Phase 7 both hit a fixed delay racing a second round trip, and Phase 7 hit a
wait already satisfied by the previous render which produced a convincing
off-by-one that read exactly like a product defect. **This round is
investigating an off-by-one.** Wait on state only the new write satisfies.

### I2. Value capture: the options

Report where a typed value could live and what each costs.

- **On the score entry**, alongside `value`, `reason`, `at`, `by`. Cheapest.
  Every entry carries it whether or not the criterion uses one.
- **A per-criterion declaration** that a criterion carries a typed answer,
  with the type. What twenty-five more criteria would need.
- **Something else**, if the codebase suggests one.

**Report the query cost.** Round 23 found no GIN or jsonb index anywhere and
the series lives only in the newest revision's payload. A value stored and
unqueryable is the loss-reason outcome again, so report honestly what
"which deals had a budget over 500K" would cost.

**Report whether a currency is needed.** Terminus sells into Singapore, the
UK and elsewhere. A bare number is ambiguous and a number with a currency is
a second field.

### I3. The exit criteria swap

Report what removing three criteria from a live stage takes, and what adding
one to four stages takes.

**Report the effect on the three live Opportunities.** They sit at
Qualification. Report whether any has ticked Budget, Timeline or Commitment,
and what happens to those payload values when the criteria are removed.
**Removing a gate rule does not remove the data**, and a stale payload key
with no rule naming it is the `exitQualDataAndUseCase` situation Round 21
Phase 8 found, where fifty revisions still carry a key retired in Round 11.

Report whether `Assessment reviewed` is a payload field like the others, and
whether it needs adding to `SALESPERSON_WRITABLE_KEYS`. **Round 20 Phase 5
found a gate whose field is not writable is a wall rather than a gate.**

### I4. The empty lens wording

The three unconfigured lenses read "No Commercial criteria are configured for
this opportunity yet" with the lens named.

**Report whether it could say more** without promising a shape nobody has
designed. For Round C to consider; no change here.

### I5. What the design cannot express

Output item 4 has caught the brief's central premise being wrong three times
in six rounds. **If any of this collides with the engine, say so now.**

---

## The plan to produce

Suggested shape, argue with it:

| Phase | Content |
|---|---|
| 0 | This investigation |
| 1 | The history defect |
| 2 | The exit criteria swap |
| 3 | Value capture on Budget confirmed, per the I2 decision |
| 4 | Full walk and close-out |

**Argue with it.** If I2 shows value capture is larger than a phase, it may
belong in its own round. If I3 shows the swap touches live data in a way that
needs care, it may need splitting.

---

## Verification requirements

**Test Bed pixel-identical**, calibrated at each step against an injected
one-row change, as every phase of Rounds A and B.

**Every browser interaction at least three times in sequence without
reloading.**

**Wait on state only the new write satisfies.** Round 25 hit this twice, and
this round is investigating an off-by-one, which is the failure mode a stale
wait produces.

**Look at the result.** Round A Phase 4 shipped no diff and found a
three-phase-old defect by looking. Round B Phase 6 found eye travel growing
without limit by measuring the rendered text edge rather than the box.

**Enumerate teardown from the database by tag.** Round 25 Phase 7 lost two
fixtures because `head` closed the pipe and killed the process before its
`finally`, which is a third route to the Round 21 outcome.

---

## Explicit non-goals

- **Round C.** The other three lenses, the remaining twenty-five criteria,
  the provisional-anchor marker decision.
- **Value capture on anything but Budget confirmed.** Explicitly narrowed by
  the business.
- **A read path or index for stored values.** Report the cost; do not build
  it.
- **`assessment_current` rollup rules.** Built, unused, and staying that way.
- **The Risk assessment.** Not designed.
- **Coverage and confidence, creation checks, reason on incomplete
  approval.** Round D.
- **`measurabilityConfirmed`.** Its own round.
- The Reference tab round, reopening a loss, the open-decisions table
  convention, rule 7, the `CURRENT_STATE.md` blind spot, `INVARIANT 8` not
  seeing `assessment_current`, `approver_id` resolving to nobody.

---

## Output format

1. **I1 to I5**, each with the command run or the interaction performed, the
   actual output, and the finding.
2. **The I2 options**, with costs, presented for a decision and not chosen.
3. **The phase plan**, with the argument for any departure.
4. **Anything that cannot be built as stated.**
5. **Any disagreement between a generated file and a hand-written one**,
   reported and not resolved.

Then stop and wait for sign-off.
