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

---

# Round 26 close-out

Branch `round-26-assessment-fixes`, off `main` at `cd59c57`. Four phases,
each committed at its boundary, each signed off before the next began.

| Phase | Commit | What shipped |
|---|---|---|
| 1 | `a4972d8` | The current entry's own block: reason, author, timestamp, and the history relabelled |
| 2 | `7f6cc39` | The exit criteria swap: three Qualification rules out, `assessmentReviewed` in at four stages |
| 3 | `c11a2fd` | Value capture on Budget confirmed: an `answer` beside the level and the reason |
| 4 | this commit | The full walk, `CURRENT_STATE.md`, and this record |

## Rule 7 check, and its calibration

    grep -n "^## Phase\|^### Phase" ASSESSMENT_FIXES_PHASE_0_BRIEF.md

Returns **1**. The round ran **four** phases.

Calibrated three ways, because a count that disagrees with the truth is
worth nothing until the instrument is shown to work. The narrow `^## Phase`
pattern Round 10 got wrong returns 1 here as well, so this brief does not
discriminate between the two patterns. Injecting `### Phase 99: calibration`
takes the wide pattern to 2 and removing it returns it to 1, so the pattern
can see a `###` heading and the file is unmodified afterwards.

**The instrument works and the premise is false**, which is exactly what
Round 24 established. This is a Phase 0 brief: it carries one `## Phase 0`
heading and a section called "The plan to produce". The phase list was
produced in the Phase 0 report and lives in the conversation, not in the
file, so there is nothing in the brief for the grep to count.

**Seventh failure, and the fifth distinct way.** The rule as written assumes
the brief carries its phase list as headings. For every brief in the
one-brief-per-round shape it does not. The rule's action is still worth
performing, because performing it is what surfaces the mismatch; what should
change is what the result is compared against. **The phase list has to be
enumerated from the sign-offs**, which is what the table above does.

## The walk

One Opportunity from Qualification through Solution Alignment to Proposal,
scoring on the Assessment tab, ticking and advancing on the stage tab, in one
browser session with no reload.

**Every strip click was counted and named**, because the constraint under
test is about clicks that should not be needed:

| # | What for |
|---|---|
| 1 | Open the Assessment tab to score at Qualification |
| 2 | Reach the tick and the advance control |
| 3 | Look at the Assessment tab at Solution Alignment |
| 4 | Return from the Assessment tab to the control |
| 5 | Look at the Assessment tab at Proposal |

**Five clicks, and zero of them were needed to reach the next stage's control
after an advance.** Both advances landed on the correct stage tab with that
stage's exit criteria already rendered and the advance control already
present, with the click counter unmoved. The four excursions are the
Assessment tab and the stage tab being different tabs on one strip, which is
the design, not a landing fault.

Stored at the end: review entries at `["Qualification","Solution Alignment"]`,
and a Budget series of `3 @ Qualification {750000 GBP}` then
`4 @ Solution Alignment {820000 GBP}`. The stage on each entry is written
server-side from the record's own status, never sent by the client.

### What the walk found

**The review row renders on stage tabs the record has not reached, and
clicking it there writes a real entry and changes nothing on screen.**

Criteria are tickable on any stage tab. That was ported from Test Bed and is
correct for every rule that existed when it was built, because those rules
are bare presence checks: ticking one from a future tab sets the field and
the row turns met everywhere. `assessmentReviewed` is the first Opportunity
rule whose met-ness depends on the record's stage, and the interaction has
never met one before.

Measured, with the record at Qualification and the Proposal tab open:

| | met | tickable | feedback |
|---|---|---|---|
| before the click | false | yes | none |
| after the click  | false | yes | none |

The write landed. `assessmentReviewed` gained
`{stage: "Qualification"}`, because the server dates the entry from the
record, and Proposal's rule requires an entry at or after Proposal.
Calibration: switching to Qualification's own tab shows that same write as
met=true, so the click worked and only the clicked row is inert.

**This is Architecture rule 8 for the ninth time**, and it is the symptom
Phase 2 named at the level of a missing function: a control that does nothing
is indistinguishable from a gate refusing. Here the user gets no feedback at
all, and the row invites the click again.

**Not fixed in this round.** It is a containment decision rather than a
defect in what Phase 2 built, the harm is confusion rather than wrong data,
and the two candidate fixes differ in what they say about the design. Either
the row stops being tickable on tabs other than the record's own stage for
rules carrying `entry_stage_at_or_after`, or the click reports why it did not
take. Recorded here for the round that chooses.

## Findings and decisions recorded beyond the phase list

**The history defect's real cause.** The panel was never one save behind. It
rendered `series.slice(0, -1)`, deliberately hiding the newest entry so the
history would not repeat the level shown in the header, and nothing else on
screen carried that entry's reason, author or timestamp. The newest save was
absent, not stale, and "one behind" is what absence looks like when the rows
below it are correct.

**Round 25 Phase 6 verified entry counts against the database and passed
while the display lagged.** The check asked whether the write had landed. It
had. The claim that mattered was whether the entry was visible, and no count
of rows in `record_revisions` can answer that. This is Verification 3 in its
plainest form: a check that could pass while the claim is false.

**The verb finding.** `entry_stage_at_or_after` built its blocking message as
"Requires <label> scored at or after <stage>". The verb was hardcoded because
the clause had only ever gated scores, and these are the first rules where it
gates something else: it would have read "Requires Assessment reviewed scored
at or after Qualification". Made a property of the rule with a default of
`scored`, so all three existing Test Bed rules read byte-identically and the
four new ones carry `"verb": ""`. Additive, not a fork.

**The second empty-set trap, after Round A Phase 6.** A Test Bed message check
passed by running `every()` over an empty array: the Test Bed chosen for the
comparison had already satisfied the rules whose messages were being compared,
so there were no messages and the assertion was vacuously true. Re-run against
a fixture where the rules actually fire, it compared two real messages. Same
family as Verification 14: a check reached with nothing to compare reports
success.

**The two-edit script that aborted on its second anchor.** A Phase 2 edit
script asserted on both anchors before writing either, failed the second, and
wrote neither. Re-running only the half that had failed left
`recordOppAssessmentReview` undefined while its call site existed, so clicking
the row threw `ReferenceError` and the page did nothing. **The symptom matters
as much as the cause**: a missing function reads as a UI that does nothing,
which is exactly what a gate refusing looks like. The walk finding above is
the same symptom arrived at from the opposite direction.

**The currency consolidation.** Reusing `bidCurrency`'s picklist by copying
its ten options would have satisfied the instruction and created a third copy
to drift. Instead the two static option lists in `index.html` were removed and
all three selects now fill from one `CURRENCY_CODES` array. Two lists removed,
one source, three consumers. Verified the deal panel still offers the same ten
codes in the same order and still defaults to USD.

**The unconstrained answer shape.** The server checks that the amount is
finite and non-negative and that the currency is one of the ten. It does not
check which criteria may carry an answer, because nothing yet declares that. A
later writer's typo in the criterion key is silent, and an answer posted
against ROI and payback is accepted and stored, demonstrated rather than
asserted. The cost was accepted in exchange for no migration and no
per-criterion type vocabulary. Recorded in `src/lib/score-entry.js` under a
heading a future writer meets before adding a second such criterion, and in
`OPPORTUNITY_DESIGN.md`, not only here.

**The current entry without a figure.** A re-score that types no figure
records none, so the figure sits on an earlier entry and not on the current
one. Looking at the Phase 3 screenshot found it; no assertion would have,
because every property a check can name was correct. The history rows now
carry the figure so it stays on the page. Carrying the old figure forward onto
the new entry was rejected: it would show an amount against an act that never
recorded one, the same class as a computed rollup presented as a person's
judgement. **Whether a figure should be required above some level is a rule
for Round C**, recorded in `OPPORTUNITY_DESIGN.md` as a choice rather than an
oversight.

**The live-data effect, measured on the real records.** All three live
Qualification Opportunities held none of the three keys the migration removes.
Asked through `GET /records/:id/exit-criteria` after the migration, each
returns exactly one requirement and one unmet:

    TT-SGP-SMARTC-001: 1 requirement, unmet ["Assessment reviewed"]
    TT-SGP-SMARTC-002: 1 requirement, unmet ["Assessment reviewed"]
    TT-SGP-SMARTC-003: 1 requirement, unmet ["Assessment reviewed"]

Three deals blocked by three things nobody had done are now blocked by one
thing one person can do. That is what the swap was for.

**The three orphaned payload keys, left deliberately.** The one Closed Won
record still holds `exitQualBudget`, `exitQualTimeline` and
`exitQualCommitment`, confirmed present after the migration. Removing a rule
does not remove data. Round 20 Phase 8 established the same thing where fifty
revisions still carry a key retired in Round 11: a revision records what was
true when it was written, and rewriting history to match today's configuration
would be the larger mistake.

## `CURRENT_STATE.md`: the blind spot, and whether this round changes it

**Searched with `grep -a`, calibrated first.** Plain `grep` for
`stage_gate_rules` in `scripts/state-dump.mjs` returns 0 with exit status 1,
because the file holds two literal NUL bytes; `grep -a` returns 3; a
known-absent string returns 0 under `-a`. The instrument separates absence
from failure before any absence is reported.

**The first probe did not discriminate and was replaced.** Counting mentions
of `scoring_lenses` in `CURRENT_STATE.md` returns 1, and so does
`scoring_criteria`, which is fully dumped. Both counts are 1 for opposite
reasons. Re-asked as "is there a `## \`<table>\`` section heading":

| Table | Own section |
|---|---|
| `scoring_criteria` | yes |
| `scoring_anchors` | yes |
| `stage_gate_rules` | yes |
| `scoring_lenses` | **no** |
| `scoring_scales` | **no** |
| `scoring_scale_levels` | **no** |
| `scoring_criterion_stages` | **no** |

Calibration: a name that cannot be a section returns 0.

**The single mentions are migration filenames.** Lines 490, 491 and 493 are
`20260823000001_scoring_lenses.sql` and its neighbours. So the file's
migration ledger records that four tables were created while its configuration
sections behave as though they do not exist, and a search for the table name
returns a hit that reads like coverage. `scoring_criteria`'s printed column
list also omits `scale_id` and `lens_id`, the two columns Round 24 added.

**That is the same fault as Round 25 Phase 6's**, where `lens_id` was missing
from `GET /api/scoring-criteria`'s explicit column list and zero criteria
rendered: an explicit column list that outlived the schema. Three instances
now, two of them in the generator.

**This round does not change it, and adds one thing beneath it.** No table and
no column were added, so nothing new became invisible at the schema level. But
the `answer` structure lives inside `record_revisions.payload`, which the
generator does not and should not print, and no configuration table declares
it. **Nothing generated can record that value capture exists.** That is the
accepted cost of the score-entry option, stated in the terms this file
measures in.

**Not fixed here.** Adding four sections and two columns to the generator
would produce a `CURRENT_STATE.md` diff that no phase of this round accounts
for, which is the reconciliation rule pointing the other way. The generator's
own note on `asks` says when to do it: the column is added and committed
before the values change, so the right moment is the start of Round C.

## The regenerated diff, reconciled

Every line accounted for by a phase:

| Diff | Phase |
|---|---|
| `stage_gate_rules` 92 to 93 rows: three Qualification rules out, four in | 2 |
| `payload_field_required` for opportunity 19 to 20 | 2 |
| `assessmentReviewed` added to the 54 literal writable keys, now 55 | 2 |
| `POST /api/opportunities/:id/assessment-reviewed`, 61 routes to 62 | 2 |
| `20260824000001_assessment_reviewed.sql`, 70 migrations to 71 | 2 |
| Soft-deleted, revision and approval counts up | Fixtures from all four phases |
| Git commit SHA | This round |

**Two of the four phases produced no diff at all, by construction.** The
generator parses `supabase/migrations`, `supabase/seeds` and `src/routes`.
Phase 1 changed `frontend/` only and Phase 3 changed `frontend/` and
`src/lib/`, so neither is visible. Stated rather than glossed: the
reconciliation is complete, and it is complete over a file that cannot see
half this round.

## Teardown and residue

Enumerated from the database, not from any file a probe wrote.

- **94 live records**, the same 94 as before the round, all owned by
  `john@terminustechnologies.io`. No other account owns a live record, so
  there is no probe residue and no interactive-test-account residue.
- Four live Opportunities: three at Qualification, one Closed Won. Unchanged.
- **18 approvals created since 2026-08-23 across 6 records, and all 6 records
  are soft deleted.** Calibrated: the same query run against the earlier date
  range finds 9 live records, so the probe can see a live one.
- Every fixture the walk created was soft deleted and confirmed by re-querying
  `deleted_at`, never by trusting the delete's own result. No
  `reference_number_counters` row was touched.

## Suites

`npm test` 25 of 25. `npm run test:db` 59 of 59. Both green at every phase
boundary and again at close.
