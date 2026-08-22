# Opportunity stage restructure: Phase 0, investigation and plan

**Round number to be confirmed against the repo.** Round 19 closed on
branch `round-19-opportunity-documentation` at `0f4525a`, not pushed and
not merged. **Confirm whether Round 19 has been merged to `main` before
branching.** This round builds on its documentation changes.

---

## What this phase is

**Investigation and a plan. No file edits, no migrations, no code, no
configuration changes.**

Phase 0 answers the investigations below and produces a phase plan. The
plan is reviewed and signed off before anything is built.

---

## What this round is

The first Opportunity build round. It replaces the configured six-stage
model with the four-working-stage model recorded in
`OPPORTUNITY_DESIGN.md`, configures the gate rules, and proves the
workflow end to end with disposable scaffold criteria.

**The design record is updated as the first phase of this round**, not as
a separate round. It currently records these decisions as
"RECOMMENDED, UNDECIDED". They are now confirmed and the file is stale
until it says so.

---

## Decisions confirmed with the business, 2026-08-22

Build toward these. They are settled and are not open for
re-interpretation during the round.

| | Decision |
|---|---|
| **Stages** | Four working stages, two terminal states. Discovery / Qualification, Solution Alignment, Proposal, Negotiating / Contracting, Closed Won, Closed Lost |
| **Terminal states** | `is_terminal` and `reachable_from_any_stage` as columns on the stage row. The adjacency check reads the row. **Not a hardcoded exception** |
| **Closed Lost** | Reachable from any stage, carries the stage it died at, carries a reason from a configured list |
| **Approvals, Solution Alignment** | Commercial, Technical, Legal. **No Sales Lead, no separate Bid Review approval** |
| **Approvals, Proposal** | Commercial, Technical, Legal |
| **Approvals, Negotiating** | Commercial, Technical, Legal, as a final approval |
| **Approvals, Closed Won** | Sales Lead |
| **Approval order** | None. All required tracks in parallel, per `DESIGN_PRINCIPLES.md` Section 5 |
| **Bid/No Bid** | **Not a separate approval.** The three authorities at Solution Alignment constitute the decision. Reasoning recorded below |
| **Rejection** | Blocks the transition. Carries a reason from a configured list. "No Bid" is one of those reasons and produces a Closed Lost at 0 percent |
| **Probability** | Stage default, derived. Nullable per-record override carrying a reason, author and timestamp. Both values visible. Closed Lost is an explicit 0, not null |
| **Verbal award** | **No automatic probability step.** The sales lead adjusts and records why |
| **Assessment gate wording** | "Current", meaning an entry dated at or after entry to this stage, via `entry_stage_at_or_after`. **Not "updated"**, which is satisfied by re-saving identical numbers |
| **Assessment shape** | 1-to-5 scale, existing mechanism unchanged. **No condition-based derivation, no schema change** |
| **Assessment criteria** | **Not in this round.** Decided on paper in a separate conversation |
| **Scaffold** | Three disposable criteria, not one. Removed at the end of the round |

### Why there is no Bid Review approval, recorded so it is revisitable

The case for one is real: Commercial, Technical and Legal each answer a
domain question, and none of them is "should we spend the effort." A deal
can pass all three and still be one you should not bid, because an
incumbent will win it.

**It was rejected on scale, not on principle.** At current headcount the
three approvals are the same people in the same room, and the bid decision
is being made explicitly in conversation by everyone who would sit on a bid
review. A fourth approval would record something already decided by the
people clicking the other three. That is ceremony rather than governance.

**The part of the argument that survived is the reason code**, which is why
rejection carries one. Without it, declining to bid on relationship grounds
has to be dressed up as a pricing objection, and the Closed Lost reason
reporting is polluted at the source.

**Revisit when the approving parties are no longer the same people.**

### Watch item, recorded not built

With no Bid Review, the assessments have no formal consumer. They are exit
criteria feeding a judgement made in conversation.

**The six-month test: are the scores being maintained, or is somebody
re-saving the same numbers to clear the gate?** If the latter, the
instrument has died and the fix is either a real bid review or fewer
criteria. Record this in `OPPORTUNITY_DESIGN.md`. Do not build anything
against it.

---

## Read first

| Document | Why |
|---|---|
| `CLAUDE.md` | **Read from disk.** It changed twice in Round 19, in Phases 1 and 3. The injected snapshot may predate both |
| `OPPORTUNITY_DESIGN.md` | The authority. Ten open decisions, several of which the table above now closes |
| `DESIGN_PRINCIPLES.md` | Section 5, approvals and their ordering. Section 6, unbuilt. The 2026-08-22 Deferred scope bullet on staff fields |
| `PROTOTYPE_SPECIFICATION.md` | Sections 3 and 5, Opportunity Reference and Stage & Approvals tabs |
| `CURRENT_STATE.md` | Generated. Run its staleness test before relying on it |
| Round 19 close-out | What changed, and the four items it recorded |

---

## Standing rules with live traps in this round

- **Verification 17**, promoted last round. A probe distinguishing two
  states must be shown returning a different value in each. This round is
  full of before-and-after counts on stage rows.
- **Verification 14.** A check passing when both sides are absent is not a
  check. The `stage` versus `stage_name` column inconsistency already
  produced one null-versus-null artifact in Round 19.
- **Build discipline 2.** Confirmed is not verified. Database queries and
  browser tests, not inspection.
- **Rule 16.** Capture to a file, then grep the file.
- **Rule 9.** Branch before Phase 1, commit at every phase boundary.

---

## Investigations

Each states what counts as evidence. Report the finding whether or not it
matches the expectation.

### I1. What enforces stage validity, and what breaks when a stage row is deleted

**The question.** Is there a foreign key from `records.stage_name` to
`stage_definitions`, or is the relationship by string only?

This determines whether the restructure can update stage rows in place,
whether it must migrate records first, and whether deleting the old rows
fails outright.

**Method.** Dump the constraints on `records` and on `stage_definitions`.
Report every foreign key in either direction, and every check constraint on
`stage_name`.

**Also report the column naming.** `stage_definitions` uses `stage_name`.
`stage_probability_defaults` uses `stage`. Confirm which column each table
actually uses and whether anything joins them.

### I2. The adjacency check

**The question.** Where does the adjacency-only forward transition rule
live, what does it read, and what would it take for it to read
`is_terminal` and `reachable_from_any_stage` from the stage row?

Built in Round 9 Phase 4A, after a probe accidentally advanced a record two
stages and the transition succeeded because no gate rules existed for that
pair.

**Method.** Locate it in source. Report the file, the function, and how it
determines adjacency. State whether it derives adjacency from `sort_order`,
from a configured transition list, or otherwise.

**This determines the size of the column change**, which is the one
schema-level decision already confirmed.

### I3. `stage_probability_defaults`: what reads it

**The question.** Does anything read this table today?

Expected: nothing. Weighted pipeline forecast is not built. If that holds,
the table is currently a configuration record with no consumer, which makes
remapping it free.

**Method.** Search the whole of `src/` and `frontend/` for the table name
and for the column it exposes. **Calibrate the search** against a table
known to be read, so a zero is a measurement rather than a broken pattern.

Report the schema: columns, types, whether probability is an integer or a
decimal, and whether there is a uniqueness constraint per stage.

### I4. Test Bed conversion state, and what wiping would orphan

**The question.** Do any of the 63 Opportunity records originate from a
Test Bed conversion, and what state does the Test Bed side hold?

**Why it matters.** `conversion_criteria` carries `max_conversions: 1`. If
an Opportunity is deleted and the Test Bed remains marked as converted, the
Test Bed can never be converted again and there is nothing to show for it.

**Method.** Report how conversion is recorded, on which side, and how many
of the 63 carry it. Report both live and soft deleted.

### I5. Reference number counters

**The question.** If the 63 records were deleted, what happens to the
Opportunity reference counter?

Expected: nothing. Counters are atomic and independent of record existence,
so a fresh dataset would start at the next number rather than at 1.

**Method.** Report where the counter lives and its current value. State
whether resetting it is possible and what else that would affect. **Do not
reset anything.**

### I6. Hardcoded stage names outside the database

**The question.** Does any source file hardcode Opportunity stage names?

**Why it matters.** The stage vocabulary is meant to live as data. If
`Evaluation` or `Closing` appears in a frontend switch, a route, or a test,
the restructure breaks it silently.

**Method.** Search `src/`, `frontend/` and `scripts/` for each of the six
current stage names and each of the six new ones. Calibrate against a
string known present. Report every hit with its file and line, including
hits in tests, and say whether each is a real dependency or incidental.

### I7. Where a rejection reason would attach

**The question.** How is an approval decision currently stored, and what
would a configured reason list attach to?

**This is the only genuinely new machinery in the round**, so its size needs
to be known before it is planned. It follows the same shape as the Closed
Lost reason list: admin-editable rows, free text alongside.

**Method.** Report the approval record's structure: where the decision and
comment are stored, whether there is room for a reason reference, and
whether the Closed Lost reason list itself exists yet or is also to be
built.

### I8. Ownership, and who can write

**The question.** Writes are owner-only. Who owns the 3 live Opportunity
records, and would the restructure or the scaffold be blocked by that?

The widening question is recorded as a disagreement between
`OPPORTUNITY_DESIGN.md` and the Round 18A close-out, and remains unresolved
with the business. **Do not widen anything.** Report only whether it
obstructs this round.

`scripts/tests/ownership.test.mjs` pins the current boundary and its header
says the tests should fail if writes widen. Confirm those tests pass at the
start of the round, so a later failure is attributable.

---

## The plan to produce

Small phases, each with its own verification, each committing. Suggested
shape, to be argued with:

| Phase | Content |
|---|---|
| 0 | This investigation |
| 1 | `OPPORTUNITY_DESIGN.md` updated with the confirmed decisions. Documentation only |
| 2 | `is_terminal` and `reachable_from_any_stage` columns; adjacency check reads them |
| 3 | Stage restructure: new rows, records migrated, old rows removed |
| 4 | Probability: stage defaults remapped, override column with reason, author, timestamp |
| 5 | Gate rules: three forward transitions plus terminal transitions |
| 6 | Rejection reason codes. **Cuttable if larger than it looks** |
| 7 | Scaffold: three criteria, click through every transition including Closed Lost from Discovery |
| 8 | Remove the scaffold, verified from the database |

**Argue with this.** In particular, I2 may show that the adjacency change is
larger or smaller than a phase, and I7 may show that reason codes should be
their own round.

### The migration, and the test data question

**All 63 Opportunity records must be mapped.** 3 live, all Discovery. 60
soft deleted: Discovery 58, Negotiation 1, Proposal 1. Soft-deleted records
are never hard deleted, so leaving them pointing at stages that no longer
exist is not acceptable.

**The business has offered to delete the test data instead.** The
recommendation is to migrate first, then delete if still wanted. The
migration is small, the records are disposable, and this is the cheapest
rehearsal available for a stage restructure that will happen again on real
pipeline.

**Plan the deletion as an optional phase after the migration**, conditional
on I4 and I5 coming back clean. Do not plan it before.

---

## Explicit non-goals

- Deal and Risk assessment criteria or anchors. Separate conversation.
- Any condition-based scoring, derivation engine or scoring schema change.
- A Bid Review or Sales Lead approval track.
- `routing_rules`. Still zero rows, still not this round.
- Ownership widening.
- Server-side validation of staff fields. Open decision, not scheduled.
- The four dates and the revision event. Later round.
- `product_defaults`, `system_defaults`, or any Base Cost Data catalog.
- The 28 em dashes in `PROTOTYPE_SPECIFICATION.md`.
- Weighted pipeline forecast itself. This round configures the data it will
  read, not the forecast.

---

## Output format

1. **I1 through I8**, each with the command run, the actual output, and the
   finding. Where an expectation was stated, say whether it held.
2. **Any disagreement between a generated file and a hand-written one**,
   reported and not resolved.
3. **The phase plan**, with the argument for any departure.
4. **Anything in the confirmed decisions that cannot be built as stated.**
   These were settled in conversation without repository access. If one of
   them collides with how the engine actually works, say so now rather than
   discovering it in Phase 5.

Then stop and wait for sign-off.

---

## Round 20 outcome

The first Opportunity build round. Nine phases, 0 through 8, plus this
close-out. Phase 9, the optional deletion of the test data, was
deliberately skipped: the migration rehearsal had already delivered its
value, and deleting live records buys tidiness at the cost of an
unrehearsed operation.

### Rule 7 returned zero, and that is the second round it has done so

`grep -n "^## Phase\|^### Phase"` against this brief returns **0**, with the
`###` half included. The same pattern returns 5 against
`ROUND18A_FIX_BRIEF.md`, so the zero is a real absence rather than a broken
pattern. **This brief carries its phase list as a table, at lines 247 to
255**, and rule 7 counts headings.

Round 19 recorded the same thing and left it as a finding about the rule.
It has now happened twice in consecutive rounds, which makes it a property
of how briefs are written here rather than an accident. The two candidate
resolutions are unchanged: require phase headings in every brief, or widen
rule 7 to count a phase table. **Still not resolved, and now with a second
data point.**

Counted from the table, phases 0 through 8, each with an explicit sign-off
in the session transcript. This report does not sign off its own phase.

### What the round did

Five working stages and two terminal states replace six configured stages
that were never the model. `Qualification`, `Solution Alignment`,
`Proposal`, `Evaluation`, `Negotiating`, `Closed Won`, `Closed Lost`.
Terminal behaviour is two columns rather than a code exception. Probability
gained a per-record override that survives a transition. Thirty-one gate
rules configure the workflow, and the browser gained the control that
satisfies them.

### `CLAUDE.md` changed twice, in phases 2 and 9

**The next session must re-read it from disk.** The copy delivered at
session start is a snapshot, so a session following a round that edited it
receives the old version.

Both edits append to **Verification 17**, promoted last round, and both
came from that rule catching its own author:

- **Phase 2**: a probe can be specific, unique and correct and still fail
  to discriminate when the tool's granularity does not match the thing
  measured, as when a line-based search targets text wrapped across a line
  break.
- **Phase 9**: a probe can discriminate perfectly and be shown only part of
  the population, as when a paged API caps a scan at its default limit.

### The finding with the longest reach

**`renderTransitionSection` derived server-owned state a second time, in
the browser.** Phase 2 fixed `records.js` so a record in a terminal stage
is not offered a next stage. Phase 6 found the same computation,
`stages[currentIdx + 1]`, implemented independently in `frontend/app.js`,
where the server fix could never have reached it. Without the second fix a
lost deal would have been offered a button reading "Move to Qualification".

Build discipline rule 6 in its exact shape: a fix built for the surfaces
that existed is not a fix for the surface built beside it. **Worth a
deliberate search in a later round for other client-side derivations of
server-owned state. Not scheduled.**

### Recorded and not fixed

- **A foreign-key violation reaches the user as a raw Postgres 500.**
  `POST /records/:id/approvals` with a track absent from `approval_tracks`
  returns 500 carrying `violates foreign key constraint
  "approvals_track_fkey"`. Round 18A routed every write-error site through
  `src/lib/write-errors.js`, and that helper maps `42501` and nothing else.
  `23503` is the same defect wearing a different code. Its natural
  neighbour is the reason-codes round, which adds the first new constrained
  vocabulary since this was found.

- **Seventeen revisions still carry scaffold payload keys, and they are
  history rather than residue.** Six `scaffoldOne`, six `scaffoldTwo`, five
  `scaffoldThree`, all on ONE record, soft deleted, owned by a test
  account, with no live record carrying any. `record_revisions` is append
  only and `records` carries `ON DELETE RESTRICT` from it, so removing them
  is neither permitted nor desirable: a revision records what was true when
  it was written, including a criterion that existed then and does not now.
  **The precedent is established.** Round 11 Phase 1 retired
  `exitQualDataAndUseCase` together with its gate rule, and **50 revisions
  still carry that key today** with no rule naming it. Nobody should read
  either set as something left behind.

### The unstated approvals item is closed

v1.2 recorded three transitions with no stated approvals and deliberately
did not invent them. The business stated all three, so they are configured
rather than guessed:

- `Qualification` to `Solution Alignment`: **none**
- `Proposal` to `Evaluation`: **Commercial, Technical, Legal**
- `Evaluation` to `Negotiating`: **Commercial, Technical, Legal**

`Evaluation`'s own exit criteria arrived in the same conversation, so the
stage model no longer carries a "not yet stated" cell anywhere.

### Open decisions in `OPPORTUNITY_DESIGN.md`: seven

Asserted row by row rather than by count, since a total is the shape that
passes while wrong:

1. Revision event: series plus approval plus re-score as one thing
2. Deal Sheet freeze point after the stage compression
3. Staff fields have no server-side validation
4. `Account` is a third staff-field surface
5. Base Cost Data catalog
6. One stage vocabulary under four column names, joined by nothing
7. `approvals.comment` unused on all 229 rows, `tier` null on all 229

Eight at the end of Phase 1, seven now: the approvals item closed and
nothing new opened. No bolded row claims to be confirmed.

### Reconciliation

`CURRENT_STATE.md` regenerated. **Unlike Round 19 it was genuinely stale**:
13 tracked configuration sources changed since its recorded commit, seven
migrations and six route files. Every changed line is accounted for by a
phase.

- **`stage_definitions` 19 to 20 rows**, the six opportunity stages
  replaced by seven. Phase 3, with `Closed Lost` moved to 110 in Phase 7.
- **`stage_gate_rules` 61 to 92**, the 31 opportunity rules from Phase 5.
  The scaffold's three are absent, asserted by name in Phase 8.
- **`stage_probability_defaults` 6 to 7 rows**, remapped in the same
  migration as the stages. `Proposal` reads 40, not the carried-over 50.
- **`SALESPERSON_WRITABLE_KEYS` 35 to 54 keys**, the 19 exit criteria from
  Phase 5. The three scaffold keys were removed in Phase 8.
- **Routes 56 to 57**, the probability override endpoint from Phase 4.
- **Opportunity records by status** now read across the new vocabulary. 93
  live records, unchanged all round.
- **Soft-deleted rows grew by 598 and harness types by 47**, all from suite
  runs and phase fixtures. Zero live.

**One correction inside the reconciliation, and it was my own.** The first
regeneration listed `r20p2_1787389749442` and `r20p2inj_1787389787303` as
record types in their own right. They are Phase 2 fixtures, all 12 soft
deleted, and the standing residue check did not see them because it looks
for LIVE records. **They escaped the generator's fixture aggregation
because I prefixed them `r20p2_` rather than `harness_`.** Renamed to
`harness_r20p2*` so they aggregate honestly; nothing was deleted. A
synthetic record type that does not carry the harness prefix will be
reported as though it were a real one, permanently, because soft-deleted
records are never removed.
