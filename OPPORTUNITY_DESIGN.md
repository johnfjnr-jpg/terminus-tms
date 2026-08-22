# Opportunity design record

**This is a design record, not a build brief.** It captures decisions taken
with the business and the reasoning behind them. Round briefs are written
from it.

It exists because the Test Bed build repeatedly found decisions that had
been made carefully, recorded nowhere, and then re-litigated months later
by someone who could see only the result. `PROTOTYPE_SPECIFICATION.md`
carries what the prototype does, `DESIGN_PRINCIPLES.md` carries why the
build is as it is, `CURRENT_STATE.md` carries what is configured, and this
carries what Opportunities is meant to become.

Written after the Test Bed lifecycle was completed and proven in use across
Rounds 9 to 18A.

---

## Status of every item in this document

Nothing here is uniformly settled, and treating it as though it were is how
a design record becomes a liability. Every substantive item carries one of
three markers, and FINDING has two states.

| Marker | Meaning |
|---|---|
| **CONFIRMED** | Decided with the business. Build against it |
| **RECOMMENDED, UNDECIDED** | An advisor's proposal with reasoning. The business has not chosen. Do not build against it |
| **FINDING, UNRESOLVED** | A disagreement or gap found and reported. Needs investigation, not a build decision |
| **FINDING, ANSWERED** | The same finding after investigation settled it, with the date and the measurement recorded. It keeps the FINDING lineage so a resolved finding stays visibly a finding rather than becoming a decision. Distinct from CONFIRMED, which is a business decision rather than a measured fact |

---

## Version history

**v1.2, 2026-08-22.** The confirmed decisions for Round 20, the first
Opportunity build round. The stage set is settled as seven rows and the
decisions this document carried as RECOMMENDED, UNDECIDED are now either
CONFIRMED or explicitly out of the round. Changes:

1. **Five working stages, not four.** Evaluation is reinstated as a stage
   in its own right, on this document's own rule.
2. Stored stage names and sort orders fixed. Sort orders are spaced by 20.
3. Terminal states confirmed as columns, not a named code exception.
4. **Bid/No Bid confirmed as NOT a separate approval.** The three
   authorities at Solution Alignment constitute the decision.
5. Probability confirmed as a stored column with a nullable override.
6. Two findings from the Round 20 Phase 0 investigation recorded.
7. The six-month watch item on the assessments recorded.

**v1.1, 2026-08-22.** Amended after reading `CURRENT_STATE.md`,
`DESIGN_PRINCIPLES.md` and `PROTOTYPE_SPECIFICATION.md` against v1.0.
Changes:

1. Added the configured-state findings. **The configured Opportunity
   stages are not the stage model in this document**, which changes the
   shape of the first round.
2. Recorded three supersessions of `DESIGN_PRINCIPLES.md` Section 5 that
   v1.0 made silently.
3. Added Bid/No Bid as a confirmed approval, with the rejection semantics
   left open.
4. Extended the assessments through Negotiating, confirmed with the
   business.
5. Recorded the approval gap the four-stage compression created.
6. Reframed Section 6 from stale documentation to a missing control.
7. Added the scaffold approach and the traps in it.

v1.0 reasoning is retained throughout rather than deleted, per the
documentation rule in `CLAUDE.md`.

---

## What Opportunities is

**A gate-governed sales pipeline**, not a pipeline where stages are labels a
salesperson sets. **CONFIRMED.**

Confirmed with the business, in their terms: the workflow supports a
salesperson in directing the activities required at each stage, and it
supports deal governance. A standard way to review opportunities as a
business so effort is not wasted on deals that cannot be won. A pipeline
where salespeople progress opportunities without governance is not a good
place to be.

**The Test Bed engine transfers directly.** Stage definitions, gate rules,
approvals, documents, scored criteria, exit criteria, the reason mechanism,
the sub-tab component and the atomic revision writer are all record-type
agnostic.

**What does not transfer is the content.** Test Bed is cost-only with no
client billing, which is why one of its criteria asks whether the data is
worth having. An Opportunity has a price, a margin, a contract and a
competitor. The questions are different questions.

---

## Findings against the configured state

**Read this before writing any round brief.** `CLAUDE.md` states that where
`CURRENT_STATE.md` and a hand-written document disagree, the generated file
is right about what exists, and the disagreement is a finding. These are
those findings, taken against the state dump at commit
`dd7459a94c40c045857e43c96c0acb3d799c29b8`.

### Finding 1. The configured Opportunity stages are not the stage model

**FINDING, UNRESOLVED.** This is the largest one and it changes the shape
of the first round.

v1.0 stated that Opportunity "already has stage definitions and zero gate
rules configured, which is exactly where Test Bed sat before Round 9." The
second half is verified true. The first half is true and misleading.

| This document's stage model | `stage_definitions`, live, 6 rows |
|---|---|
| Discovery / Qualification | Discovery |
| Solution Alignment | Qualified |
| Proposal | Proposal |
| Negotiating / Contracting | Evaluation |
| Closed Won | Negotiation |
| Closed Lost | Closing |

The live model is the earlier six-stage list. It includes `Evaluation`,
which this document rejects by name. **Neither terminal state exists as a
row.** There is no `Closed Won` and no `Closed Lost`.

**Consequence.** The first Opportunity round is a stage restructure, not
gate configuration. It touches live data: 3 live Opportunity records sit in
`Discovery`, and 60 soft-deleted rows carry values from the old list,
including `Negotiation` and `Proposal`. Soft-deleted rows are never hard
deleted, so a migration that ignores them leaves orphaned status values
behind.

### Finding 2. `stage_probability_defaults` is a second stage-derived list

**FINDING, UNRESOLVED.**

Six configured rows, keyed to the old stage names: Discovery 10, Qualified
20, Proposal 50, Evaluation 60, Negotiation 90, Closing 100. This document
does not mention weighted pipeline value anywhere.

This is the same shape as the Opp Status column dropped below: a second
thing keyed to stage that nothing keeps in step. It is already in the
database. A restructure orphans all six rows.

**A decision on weighted pipeline value is needed before the restructure,
not after.** Three options: carry the table forward remapped to the new
stages, drop it because nobody uses the number, or replace probability with
something the business actually forecasts against. Undecided.

### Finding 3. There is no Sales Lead approval track

**FINDING, UNRESOLVED.**

`approval_tracks` holds six rows: Commercial, Finance, Internal, Legal,
Senior, Technical. The stage model below names Sales Lead approvals at
three stages. That track does not exist.

Two related observations in the same table. `Senior` still carries the
description "Tier to be defined when routing_rules is built" while
migration `20260819000008_gate_config_transition_7_and_drop_senior.sql`
dropped it from Test Bed. And `routing_rules` holds **0 rows**, which
`DESIGN_PRINCIPLES.md` Section 5 already flagged at Milestone 2 and which
is still true. The tiered Commercial escalation described there, and still
described on the `approval_tracks.Commercial` row, has never worked.
Opportunity is the record type it was designed for.

### Finding 4. Approval ordering is not expressible

**FINDING, RESOLVED BY SUPERSESSION.** See the supersessions section below.

v1.0's Negotiating stage read "Sales Lead, then final Commercial,
Technical, Legal." `stage_gate_rules` approval rows carry no sequence key,
so ordering within a stage cannot be expressed. More importantly,
`DESIGN_PRINCIPLES.md` Section 5 states as a design decision that there is
no required order between tracks. v1.0 reversed a recorded principle
without recording it.

**Resolved: the ordering is dropped.** Sequencing approvals adds machinery
to enforce a courtesy that a business of this size does not need.

### Finding 5. Conversion is not unconditional

**FINDING, WORDING ONLY.** `conversion_criteria` carries
`{"max_conversions":1}`. This document says Test Bed conversion is
"unconditional." It is unconditional **on stage** and capped at one.
Reworded below.

### Finding 6. Staff directory: it exists, and the fields store a name

**FINDING, ANSWERED 2026-08-22 by direct query.** This entry recorded a
contradiction between `PROTOTYPE_SPECIFICATION.md` and `CURRENT_STATE.md`
and asked for the database to be queried. That was done. Both halves are
now settled, and the second one is the answer this document needed.

**The directory exists.** `terminus_staff`, a small reference table holding
name and title, seeded with the seven real staff names by migration,
`GET`-only, no admin UI. Built 2026-08-16. The apparent contradiction was
that `PROTOTYPE_SPECIFICATION.md` Section 3 described the position before
that date and had never been revisited. Section 3 now carries the
supersession, so the two documents agree.

**The fields store a name as text, not a reference to a staff row.**
Measured across live and soft-deleted Opportunity and Test Bed records:
zero UUIDs and 48 name strings, every one an exact match for a
`terminus_staff.name`. The dropdown constrains entry client-side and
creates no reference, and there is no server-side validation.

**The full record, including how it was measured and what else the query
surfaced, is the 2026-08-22 entry under `## Deferred scope` in
`DESIGN_PRINCIPLES.md`**, beginning "The staff dropdowns constrain input
but create no reference". It sits alongside the 2026-08-16 entry that
records the directory itself. There is no separate dated entry: one record
of one finding.

**What this means for the model below.** The assessments are scored by a
named Sales Lead and challenged in bid review, and attribution to a
free-text string is not attribution. **Bid Review cannot route to a person
as these fields stand**, and `routing_rules` holds zero rows, so nothing
routes off them today either. Two consequences follow into the open
decisions: staff fields have no server-side validation, and `Account` is a
third staff-field surface that no document described.

**Score attribution is not affected.** A score entry's author is written
server-side from the authenticated session and never accepted from the
client, settled in Round 11. Who recorded a score and who is named as Sales
Lead on the record are two different attributions, and only the second was
ever in question.

---

## Supersessions of `DESIGN_PRINCIPLES.md` Section 5

v1.0 changed three recorded decisions without recording the change. The
superseded reasoning is stated here so it is visible rather than deleted.

| Section 5 said | This document says | Resolution |
|---|---|---|
| Approvals have **no required order**, requested in parallel, stated as a design decision | Negotiating: "Sales Lead, then final Commercial, Technical, Legal" | **Section 5 stands. The ordering is dropped.** CONFIRMED |
| Bid/No Bid is an **approval at the gate into Proposal**, flagged explicitly as an assumption awaiting confirmation | Appeared only as prose describing what the assessments inform | **Section 5 stands and is now confirmed.** See below |
| T&Cs confirmed **gates entry to Proposal** | T&Cs reviewed is an **exit criterion of Solution Alignment** | **This document stands.** Same effect, better mechanism: an approval records that someone signed, a criterion records what they signed against |

---

## The stage model

**CONFIRMED**, subject to Finding 1: this is the intended model, not the
configured one.

**CONFIRMED v1.2: seven rows, five working stages and two terminal states.**
These are the stored `stage_name` values exactly as they will be written,
not labels. Sort orders are spaced by 20 so a stage can be inserted later
without renumbering, which the adjacency check already tolerates because it
compares position in the ordered list rather than sort_order arithmetic.

| # | `stage_name` | `sort_order` | Probability | Terminal |
|---|---|---|---|---|
| 1 | `Qualification` | 10 | 10 | |
| 2 | `Solution Alignment` | 20 | 20 | |
| 3 | `Proposal` | 40 | 40 | |
| 4 | `Evaluation` | 60 | 60 | |
| 5 | `Negotiating` | 80 | 80 | |
| 6 | `Closed Won` | 100 | 100 | `is_terminal` |
| 7 | `Closed Lost` | 0 | 0 | `is_terminal`, `reachable_from_any_stage` |

| Stage | The question | Exit criteria | Approvals to exit |
|---|---|---|---|
| **Qualification** | Is it real. Budget, timeline, authority, commitment | Budget, Timeline, Commitment to move forward | **Not yet stated** |
| **Solution Alignment** | Can we win it. Requirements, decision makers, competition, relationships, terms | Technical solution understood, Buyers known, Key stakeholders, Terms and conditions reviewed, Deal assessment current, Risk assessment current | Commercial, Technical, Legal |
| **Proposal** | Production and submission | Pricing approved, Contract terms and variations approved, Implementation schedule agreed, Proposal documentation approved, Deal assessment current, Risk assessment current | Commercial, Technical, Legal |
| **Evaluation** | Client-led. They assess, we respond | **Not yet stated** | **Not yet stated** |
| **Negotiating** | Both sides converge. Re-pricing, verbal award, contract | Scope changes approved, Pricing changes approved, Technical clarifications completed, Legal issues resolved, Commercials approved, Deal assessment current, Risk assessment current | Commercial, Technical, Legal, as a final approval |
| **Closed Won** | Executed | Contract executed | Sales Lead, on entry |
| **Closed Lost** | Reachable from any stage | None | |

Five working stages, two terminal states, **four forward transitions** plus
the terminal ones.

**Three transitions carry no stated approvals**, and they are marked above
rather than filled in: `Qualification` to `Solution Alignment`,
`Proposal` to `Evaluation`, and `Evaluation` to `Negotiating`. Two of them
are new with the Evaluation split. **Not invented here.** A gate rule that
nobody asked for is worse than an absent one, and the same discipline
governed `20260815000000_test_bed_flat_stages.sql`, which left six of eight
test_bed transitions with no gate rows rather than guess at them.

**Changes from v1.1**, each recorded below: Evaluation is a stage again;
Bid Review is not an approval; the approvals at Solution Alignment are the
three authorities alone; and the assessments are current at Negotiating as
well. "Updated" has become "current", which is a real change and not a
wording preference.

### Why "current" rather than "updated"

**CONFIRMED.** The standard in this project is that a good criterion can be
checked by asking a question with a yes or no answer that means something.
"Updated" passes that test and means nothing: it is satisfied by re-saving
identical numbers.

The criterion is that **a scoring entry exists dated at or after entry to
this stage.** That is expressible today with no build. The
`entry_stage_at_or_after` key already exists in `requirement_detail` and is
in live use on three Test Bed gate rules. It is a row edit.

### Why five stages, superseding "why four and not seven"

**CONFIRMED v1.2. Evaluation is reinstated as a stage in its own right.**
Evaluation and Negotiating have different exit criteria: Evaluation is
client-led and we respond, Negotiating is where both sides converge. This
document's own rule, stated in the superseded reasoning immediately below,
is that **a distinction needing its own exit criteria is a stage rather
than a label.** The rule was written to be applied and this is the first
application of it.

The compression of Clarification and Closing into Negotiating stands. The
compression of Evaluation into it does not.

**This narrows the approval gap below without closing it.** With Evaluation
separate, the boundary a proposal crosses on its way to the client is a
real transition again, and Proposal's Commercial, Technical and Legal
approvals fire on it. What is still open is a revision made **while in**
Evaluation or Negotiating, because neither transition carries approvals
yet. The gap moved from structural to unpopulated, which is a better place
for it to be but is not the same as fixed.

### Superseded v1.2: why four stages and not seven

An earlier draft had Clarification, Negotiation and Closing as separate
stages. They were compressed into Negotiating/Contracting because all three
describe one activity: the deal is submitted and is now being resolved.

**The cost, accepted deliberately:** time spent in each cannot be reported
separately. Three stages for one activity is false precision, and the dates
below recover most of what the split would have given.

**If a distinction later turns out to need its own exit criteria, that is
a stage rather than a label.** The compression went as far as it should and
no further.

**The compression had a second cost, not seen in v1.0.** See the approval
gap below.

### Why Solution Alignment rather than Evaluation

It names the work rather than the position, and it does not collide with
the client's own evaluation of the bids.

**Amended v1.2.** Both stages now exist, so the reasoning above is about
naming stage 2 rather than about choosing between the two. `Evaluation` at
stage 4 IS the client's own evaluation of the bids, which is exactly what
that word should mean, and it sits where the client is doing it.

### Legal at Solution Alignment is not premature

It looks early, before a proposal exists. It is not, and the reason is the
business's own: a tender carries terms and conditions requiring either
complete acceptance or stated variations, and **variations affect price**.
You cannot price a tender until you know which terms you are accepting.

So the criterion is stated explicitly rather than left inside the Legal
approval: *terms and conditions reviewed, acceptance or variations
identified.* An approval records that someone signed. A criterion records
what they signed against.

---

## The approval gap the compression created

**FINDING, UNRESOLVED. This is the most serious gap in v1.0 and it is not
in the open decisions list.**

`DESIGN_PRINCIPLES.md` Section 5 required that **every new or revised
commercial document be approved before being sent**, as a document-level
gate scoped to the document type, not to the Opportunity stage. It is
stated there as a standing requirement, not an option.

The four-stage model replaced Evaluation and Negotiation with one stage
whose approvals are exit criteria. **An exit criterion fires when you leave
the stage.** Under the model as written in v1.0, a re-priced proposal goes
to the client with no approval at all, and the Commercial approval happens
later, once the deal has already been committed at that price.

This document's own words, in the revised-submission section: a deal
revised four times is a different deal from one revised once, and that is
what is worth seeing when reviewing why margin eroded. **The instrument to
observe the erosion was designed in and the control that would prevent it
was designed out.**

### The proposed resolution

**RECOMMENDED, UNDECIDED.** It also resolves the revised-submission open
decision, which is why the two are stated together.

A revised submission is **one event with three consequences**, not three
separate features:

1. An append-only series entry carrying date, price and margin at that
   revision.
2. A Commercial approval required **before** it is sent.
3. A required re-score of both assessments.

Designing them as one thing gives the reporting question its answer, the
Section 5 control back, and the living-assessment requirement its natural
trigger. The mechanism is `appendPayloadSeriesEntry`, which Round 11
proved, plus one document-scoped gate rule.

**Carrying price and margin in the entry, rather than date and note alone,
is the part that matters.** A series of dates records frequency. The stated
purpose is to understand margin erosion, and dates alone cannot answer it.

### The related unaddressed point: the Deal Sheet freeze

**FINDING, UNRESOLVED.**

Section 5 froze the Deal Sheet at Proposal to Evaluation, naming it as the
natural point the immutable-approved-snapshot principle applies. **That
transition no longer exists.** The freeze point needs renaming to Proposal
to Negotiating, and a re-price after freeze needs a new version rather than
an edit to an approved snapshot.

---

## Bid/No Bid

> **SUPERSEDED v1.2, 2026-08-22. CONFIRMED: Bid/No Bid is NOT a separate
> approval.** The three authorities at Solution Alignment, Commercial,
> Technical and Legal, constitute the decision between them.
>
> **Rejected on scale, not on principle.** The case for a fourth approval
> is real: each of the three answers a domain question and none of them is
> "should we spend the effort", so a deal can pass all three and still be
> one you should not bid. But at current headcount the three approvals are
> the same people in the same room, and the bid decision is already being
> made explicitly in conversation by everyone who would sit on a bid
> review. A fourth approval would record something already decided by the
> people clicking the other three. That is ceremony rather than governance.
>
> **The part of the argument that survived is the reason code.** Without
> one, declining to bid on relationship grounds has to be dressed up as a
> pricing objection, and the Closed Lost reason reporting is polluted at
> the source. Reason codes are out of Round 20 and are their own round.
>
> **Revisit when the approving parties are no longer the same people.**
>
> Consequently `Bid Review` as a track name is withdrawn rather than
> undecided, and Finding 3 no longer blocks anything.

**Superseded v1.1 reasoning, retained: Bid/No Bid is an approval, at the
gate into Proposal.**

This confirms the assumption `DESIGN_PRINCIPLES.md` Section 5 flagged for
confirmation and never received. It is the point real sales and technical
effort starts being invested, and it is where the two assessments are
consumed.

**It needs a track, and no suitable one exists.** See Finding 3.

**RECOMMENDED, UNDECIDED: name the track `Bid Review` rather than `Sales
Lead`.** It names the decision rather than the person, which is the same
reasoning that produced Solution Alignment over Evaluation, and it survives
the person changing.

### The open question: what does rejection mean

**RECOMMENDED, UNDECIDED. Do not build either behaviour until this is
settled.**

The business stated: approval goes to the next stage, No Bid gives a Closed
Lost. The intent is clear. The mechanism is not, and the two available
readings behave very differently.

**The problem.** The engine's rejection is `decision = 'rejected'` with a
comment, and across the whole system it means **"not yet, fix this."** A
rejected Commercial approval on a Test Bed means the pricing needs work. If
rejection on one track also means the deal dies, one control carries two
incompatible meanings, and the ability to reject a bid review for the
reason it is most often rejected, come back when the price is fixed, is
lost.

| Option | Behaviour | Assessment |
|---|---|---|
| Rejection auto-transitions to Closed Lost | One click kills a deal irreversibly, with no reason captured beyond a comment | **Not recommended.** Overloads a control used elsewhere to mean revise |
| **Rejection blocks. Closed Lost is a separate deliberate act with reason "No Bid"** | Bid review says no, the transition is refused, someone then closes the deal and records why | **Recommended** |

The second costs nothing, needs no engine change, and **makes "No Bid" a
row in the Closed Lost reason list**, so deals killed by governance are
counted separately from deals lost to a competitor. That is the
qualified-out versus lost distinction this document already argues for,
applied one stage later.

---

## Closed Lost

**Reachable from any stage, and it carries the stage it died at.**
**CONFIRMED.**

Deals die everywhere. Discovery goes quiet, the proposal is rejected, you
are not shortlisted, you lose on price, and even a verbal award can be
withdrawn. A one-way ladder cannot express that.

### Why the stage is carried rather than lost

If Closed Lost is simply a stage, every lost deal looks identical and the
information is destroyed. **The business needs to know where deals die**,
and separately needs to know how effective Test Beds are as a sales tool,
which is the question "of the Opportunities that came from Test Beds, how
many were lost, and at which stage".

A stage recoverable only from `audit_log` is a question nobody will ask.

### Qualified Out and Lost are the same transition and different events

A deal disqualified at Discovery is a **good** outcome: governance worked
and the effort was not spent. A deal lost at Negotiating is a bad one:
everything was spent and someone else won.

Both are Closed Lost. **The reason distinguishes them**, and "qualified
out" is what the reasons at Discovery mean. "No Bid" is the same shape one
stage later.

Restricting Closed Lost to qualified deals was considered and rejected: an
unqualified deal you stop working still has to go somewhere, and a third
terminal state is more machinery for less information.

### Reasons are configured rows

Free text tells you nothing across fifty deals. A short admin-editable
list, stored as rows, with free text alongside. Same shape as the scoring
anchors: **the vocabulary is data, not code**, so revising it is a row edit
rather than a build.

### The adjacency exception, and why it should be a column

Round 9 Phase 4A made forward transitions adjacency-only, with backward
moves permitted and ungated. **Discovery to Closed Lost is a four-stage
skip and would be refused.** That check exists to stop skipping, and it was
built after a probe accidentally advanced a record two stages and the
transition succeeded because no gate rules existed for that pair.

v1.0 recorded this as needing "a named exception," to be recorded as a
deliberate weakening.

**CONFIRMED v1.2: a stage property, not a named exception.** Add
`is_terminal` and `reachable_from_any_stage` as columns on the stage row,
and have the adjacency check read the row.

**`is_terminal` blocks OUTBOUND transitions, which is not a detail.**
Round 20 Phase 0 confirmed against the source that backward transitions to
any earlier stage are currently unrestricted; only forward moves are
adjacency-checked. `Closed Won` at 100 and `Closed Lost` at 0 are adjacent
in the ordered list, so without outbound blocking **a won deal could be
advanced into lost**, and any terminal record could be sent back to
Qualification. The column has to refuse departures, not only arrivals.

**One further site is in scope**, found in the same investigation:
`src/routes/records.js:316` derives the stage a record is heading for as
`stages[currentIdx + 1]`, so it will offer a terminal row as the next stage
unless it excludes them.

The reason this is now clearly better than a named exception is Finding 1:
**`Closed Won` and `Closed Lost` do not exist as rows and have to be
created from scratch anyway.** The data-driven version therefore costs
nothing over the hardcoded one, nothing is weakened, and the next terminal
state is a row rather than a code change. A hardcoded exception would also
break the standing rule that gate vocabulary lives as data.

### Probability, confirmed v1.2

**CONFIRMED: the stored column stays. No read-time derivation.**

Add `probability_override_pct`, nullable, alongside a reason, an author and
a timestamp. `transitions.js` writes the stage default **only when the
override is null**. Both values are visible. `Closed Lost` is an explicit 0
rather than null, so a lost deal reads as nought percent rather than as
unknown.

**No automatic step on verbal award.** The sales lead adjusts and records
why, which is what the override is for.

**Why this is not a small change.** Round 20 Phase 0 tested the existing
mechanism rather than reading it: a fixture Opportunity had
`probability_pct` set to a sentinel 77, was transitioned Discovery to
Qualified through the real API, and read back **20**, the Qualified stage
default. **The reset fires on every transition today**, so an override
added without changing that write path would be destroyed by the next stage
change. The comment at `src/routes/transitions.js:623`, which records that
the reset "has never once fired", describes the state before the Round 7
`.maybeSingle()` fix on the following line and is historical.

### Open

**Is a loss reversible?** A deal that goes quiet and returns a quarter
later is common. Reopening the same Opportunity keeps the history and
muddies the pipeline count; a new one keeps the count clean and loses the
connection. Either is defensible. **UNDECIDED.**

---

## Opp Status: dropped, and why

An earlier draft carried a status column alongside the stage: Unqualified,
Qualified, Proposal Development, Proposal Submitted, Evaluation,
Negotiation, Final Submission, Closed Won, Closed Lost.

**It was dropped**, and the reasoning is worth keeping because the idea is
a natural one and will recur.

**It was a second stage list.** Most values were derivable from the stage,
and nothing made the two move together. This project has found that failure
repeatedly: two tables holding document names as independent strings, two
lists of writable keys, two controls selecting one unit type. A second
thing that moves is a second thing that drifts.

**Note, added v1.1: `stage_probability_defaults` is exactly this failure,
already configured.** See Finding 2. The argument below was made against a
proposed column while an existing one sat in the database unmentioned.

**The values that were not derivable were substages**, and they had no
governance. Proposal Development and Proposal Submitted are positions
within Proposal, moved by hand, with no exit criteria and no approvals.
That is exactly the ungoverned pipeline the stage model exists to avoid,
sitting inside a governed one.

**The age argument does not need it.** Every transition is already in
`audit_log` with a timestamp and a real actor, so time in stage is a query
and it is exact. A hand-set status is the least reliable way to measure
duration: the day somebody forgets to move it, the number is wrong and
nothing shows it.

**What the substages actually marked were events**, each with a date the
salesperson knows on the day it happens.

---

## Dates, replacing the status column

**CONFIRMED.**

| Date | Marks |
|---|---|
| Submitted | The proposal went to the client |
| Clarifications received | The client came back with questions |
| Revised submission | A re-priced or revised proposal went back |
| Verbal award | Non-contractual confirmation of the award |

Unambiguous, dated, and they cannot drift the way a hand-set label does.

**None of these four keys exists.** `SALESPERSON_WRITABLE_KEYS` holds 35
literal keys and none of them is one of these. It has `actualClose`,
`estGoLive` and `actualGoLive` only. Adding a date field is therefore a
two-place change, the field and the allowlist, and `CLAUDE.md` Architecture
rule 9 is the reason that trap is worth naming: a key added to a call is a
no-op until the definition names it too, and it fails silently.

### Revised submission is not shaped like the others

Submitted, clarifications received and verbal award happen once. **A
revised submission can happen several times.** A tender that comes back
twice for re-pricing produces two revisions, and a single date field
records only the last, silently losing the first.

**A deal revised four times is a different deal from one revised once**,
and that is exactly the sort of thing worth seeing when reviewing why
margin eroded.

**RECOMMENDED, UNDECIDED, and no longer a standalone question.** See the
approval gap section: the series is one of three consequences of a single
revision event, and it carries price and margin rather than a note.

---

## Assessments

**Two scored instruments, maintained rather than taken once. CONFIRMED.**

- **Deal assessment** asks how good this deal is: fit and winnability, the
  things that make you want it.
- **Risk assessment** asks what could go wrong: delivery, commercial and
  contractual exposure, the things that make a won deal a bad one.

A deal can score well on one and badly on the other, and **that combination
is exactly what governance exists to catch**, which is why one blended
score would be worse than two.

### What the business confirmed, v1.1

| | Confirmed |
|---|---|
| **Does a score gate numerically?** | **No.** Both instruments inform a human decision. The gate is completeness, that a current score exists, never a threshold |
| **Who scores?** | **The Sales Lead**, challenged in bid review |
| **How long do they live?** | **Through the whole opportunity life.** Clarifications can introduce things that change both. The framework must support assessment at any point, not only at two gates |
| **What consumes them?** | The **Bid/No Bid approval** into Proposal |

**The first of these must be stated explicitly wherever the criteria are
written, because the next reader will assume a score at a gate means a
minimum score.** It does not. It means a current score exists.

**The second changes what a good criterion is.** A score challenged in bid
review is not a measurement, it is **a position taken by a named person
that another person is expected to attack.** A criterion is good if it can
be disputed with evidence. A criterion that invites "I feel this is a 4" is
not attackable and is therefore worthless in the only forum that consumes
it. It also means the scoring UI must show the reason text prominently: the
reason is what gets challenged, not the number. Round 11 already stores
author, timestamp, reason and anchor version per entry.

**The third changes the stage model**, and the change is already made in
the table above.

### Where they sit, v1.1

| Stage | Requirement |
|---|---|
| Discovery | None |
| Solution Alignment | Both current. Exit criterion |
| Proposal | Both current. Exit criterion |
| **Negotiating / Contracting** | **Both current. Exit criterion. Added v1.1** |

Editable at any point in the life, required fresh at three gates. The
mechanism already supports both halves:

| Need | Mechanism |
|---|---|
| Editable throughout | `scoring_criteria.rescore_through_stage = 'Negotiating'` |
| Fresh entry required at each gate | `stage_gate_rules` with `entry_stage_at_or_after` |
| Triggered by a clarification that changes the deal | The revision event, see the approval gap section |

**Discovery carries no scored assessment.** Its three criteria are facts:
budget, timeline, commitment. Qualification asks whether the deal is real,
and that is a checklist and a Sales Lead decision rather than a judgement
requiring anchors.

### Maintained, not taken once

Test Bed's criteria are scored at a gate and re-scored at two later ones. A
maintained score has a current value at all times and changes as the deal
develops. **The mechanism already supports this**: Round 11 built
append-only entries with author, timestamp, reason and anchor version, and
Round 12 made re-scoring available wherever a gate requires it. What
changes is when a score is required, not how scoring works.

### The criteria and anchors are undecided, deliberately

**This is the part to get right in conversation before building**, and the
reason is the Test Bed build's most expensive lesson.

The scoring mechanism took four rounds and works. **The anchors are still
unrevised and carry nine recorded problems.** `CURRENT_STATE.md` confirms
the shape directly: 15 anchor rows, **version 1 only**, scores 1, 3 and 5
defined on every criterion. Half the scale has never been written and there
has never been a second version.

Those anchors were written in a design conversation, read as sound, and
failed on contact with a real engagement. **The failure only surfaced when
the business scored an actual prospect.**

So for Opportunities: decide the criteria in conversation, test them on
paper against a real opportunity, and build after.

### What the nine problems actually are, classified

**Added v1.1.** `DESIGN_PRINCIPLES.md` records them verbatim, which is
right. They are not nine wording faults. They fall into five classes, and
every class is structural. Any new instrument must be tested against all
five before it is built.

| Class | Recorded items |
|---|---|
| Compound conjunction, with no rule for partial satisfaction | 1, 5, 7, and the structural finding |
| An undefined term inside the anchor: does a committee count, is "executive sponsor" title or authority | 2, 4 |
| Both adjacent anchors false in their distinguishing clause, so the score is chosen by elimination rather than supported | 1, 3 |
| A missing category: impossible is not unknown; partial coverage; who did the confirming | 5, 6, 7 |
| Branch list not exhaustive, or the question drifted from what the anchors measure | 8, 9 |

Class 4 has a sharp instance worth carrying forward as a writing rule:
Physical Suitability 5 **describes an artefact where the distinguishing act
is an assessment.** Drawings had been supplied and nobody had looked at
them. On a fast read, "we have photographs" satisfies it.

### The evidence that should be weighed before choosing the instrument shape

**Added v1.1. RECOMMENDED, UNDECIDED.**

`DESIGN_PRINCIPLES.md` records a measurement from the Round 11 Phase 8
walkthrough that this document did not carry: **eight hesitations across
five scaled criteria, and zero on the one binary.** Same person, same
session, same engagement. Its own conclusion is that the difficulty was not
in judging the engagement, it was in mapping a judgement onto a scale whose
endpoints are compound and whose middle is undescribed.

**This document assumes two 1-to-5 anchored instruments because that is
what the engine built. That assumption deserves to be challenged before a
single criterion is written.**

The structural finding already offered three options and called the first
"scoring the conditions individually and deriving the number." That is the
one the evidence supports and the one nobody picked up.

**The proposal.** Each criterion becomes a short list of binary conditions.
The scorer answers yes or no to each. The number is derived server-side
from the count. Rollout Path stops being one 5 anchor naming four
conditions and becomes four questions.

| | |
|---|---|
| **Why** | Removes the compound-conjunction failure by construction rather than by careful writing. Fills the empty middle, because three of four is a real describable state. Eliminates scores chosen because they are "between." Matches the only part of the instrument that worked in the walkthrough. Produces conditions that are attackable in bid review, which is what the business confirmed the instrument is for |
| **Cost** | The derived score is a computation and must live in the server-side engine. One path, no browser copy. This is the standing rule from Round 17A Phase 6 |
| **What it does not fix** | Undefined terms. "Does a committee count" is a bad question whether asked as an anchor or as a checkbox. That needs a writing rule: every condition must be checkable by someone who was not in the meeting |
| **Honest counter-argument** | Binary conditions lose nuance, and a count treats all conditions as equal weight when one may be load-bearing. The structural finding named that as its second option. Both may be needed |
| **Schema consequence** | Conditions under criteria under two named instruments is **two levels of grouping. `scoring_criteria` has neither.** It is flat, keyed by `record_type`, with no instrument column. Decide the shape before writing the migration |
| **Not in scope** | Whether Test Bed's five criteria later move to the same shape. Do not scope it now, but do not design Opportunity in a way that forecloses it |

### Anchor and condition construction rules

**RECOMMENDED, UNDECIDED.** Whatever shape is chosen, these apply.

1. One condition per statement. No implicit AND. A second condition means a
   second criterion or a second checkbox.
2. Every level worded. No blanks.
3. Observable by a third party who was not in the meeting.
4. Scoreable from evidence in the record or the CRM. If it requires
   knowledge only in the salesperson's head, it is unverifiable and will
   drift.
5. Describes an act, not an artefact, wherever the distinguishing thing is
   an act.
6. Attackable. If it cannot be disputed with evidence, bid review cannot do
   its job.
7. **Tested on paper against two real opportunities before build: one won
   and one lost. If the lost one scores well, the instrument is wrong.**

### The separating rule between Deal and Risk

**RECOMMENDED, UNDECIDED.** Without a rule the two instruments will
correlate, which destroys the reason for having two.

> **If we won this deal tomorrow, would this condition still be a problem?**

| Answer | Instrument |
|---|---|
| No, it evaporates on award | Deal assessment |
| Yes, it survives award and lands on delivery | Risk assessment |

Competitive position evaporates on award. Incumbent relationship
evaporates. Non-standard payment terms do not. Unproven integration does
not. Customer technical maturity does not.

**This exposes a structural question the design has not asked.** A risk
assessment that dies at Closed Won is built for the wrong moment. Delivery,
commercial and contractual exposure become operationally relevant the day
you win. If the risk record cannot carry into the delivery record, sales is
being asked to assess risk for a decision that is over by the time the risk
matters. Design it to carry forward, the same way Test Bed conversion
carries reference, account and cost.

---

## The scaffold approach

**CONFIRMED: use one borrowed Test Bed criterion to prove the stage-gate
workflow before the real criteria are decided.** The workflow operates the
same way as Test Bed.

This is the right sequencing. It separates "does the pipeline work" from
"are the criteria right", and the second question needs real deals to
answer. Building the assessments last is not a delay. It is the only way to
avoid repeating Round 11, whose central lesson is that anchors written in a
design conversation read as sound and fail on contact with a real
engagement.

**Three traps, each with a recorded precedent.**

### Trap 1. A copied criterion becomes a real one

`scoring_criteria` is keyed by `record_type`, so scaffolding on Opportunity
means inserting new rows. **There are 3 live Opportunity records in
Discovery.** Somebody will score a real deal on a criterion about mounting
sensors.

Mitigations, all cheap: key the rows `scoreScaffold1`, `scoreScaffold2`,
`scoreScaffold3`; name them so no business user could mistake them; give
them one deliberately meaningless anchor set.

**Do not copy the Physical Suitability wording.** Its anchors are two of
the nine recorded failures, items 6 and 7. A copied anchor becomes the
template for the real ones by accident.

### Trap 2. Removal must be verified from the database

`CLAUDE.md` Verification rule 11: enumerate teardown from a tag the
fixtures carry, never from a file the harness wrote. **The scaffold rows are
configuration, not fixtures**, so the harness sweep will not catch them, and
neither will the `harness_*` check. Any scores written against them are real
`record_revisions` on real Opportunity records.

Decide before Phase 1 how the scaffold comes out and what asserts that it
did. Re-query and confirm zero remain.

### Trap 3. One criterion proves the gate, not the panel

**Round 11A is the precedent and it is exact.** A driver written alongside
the feature exercised the shape the code was built for. `recordTbScore` took
one score, so the driver recorded one score at a time, and **scoring five
things and pressing Save once was never tried by anyone until the business
tried it**, at which point `.find()` where `.filter()` was meant cost
four-fifths of a save.

A single scaffold criterion cannot exercise the multi-criterion save path at
all, which is exactly the path that broke. **Scaffold with three criteria,
not one.** The extra two cost nothing and they are the difference between
testing the gate and testing the panel.

---

## Test Bed conversion

**Unchanged. Available at any stage. CONFIRMED.**

Confirmed with the business: it exists to carry the data forward and keep
the unique reference, and the real world dictates when it happens. It also
makes it possible to understand how effective Test Beds are as a
prospective sales tool, which is a reporting question rather than a gate.

**Wording corrected v1.1 per Finding 5:** unconditional **on stage**, and
capped at one conversion per Test Bed by `conversion_criteria`
(`{"max_conversions":1}`). v1.0 said "unconditional", which the configured
row contradicts.

Reference, account and cost carry across. Buyer contacts deliberately do
not, pending a role-mapping decision open since the Test Bed build.

---

## Carried in from the Test Bed build

Things that will bear on Opportunities and are already known.

### `DESIGN_PRINCIPLES.md` Section 6 is a missing control, not stale documentation

**Reframed v1.1. FINDING, UNRESOLVED.**

v1.0 called Section 6 stale and said reconciling it is the first thing any
commercial-model work must do. Read against the deferred-scope entry and
the writable keys, the problem is sharper than staleness.

Section 6 assumes `product_defaults` supplies unit, mounting and hosting
costs. **That table does not exist.** The deferred-scope entry in
`DESIGN_PRINCIPLES.md` states it plainly: Base Cost Data is a stopgap and
the cost lines are freely editable payload fields on the Opportunity
itself. `SALESPERSON_WRITABLE_KEYS` confirms it, with the cost keys
writable per record.

**Every Opportunity therefore carries its own private cost basis, and
nothing compares them.** Two deals priced in the same week can use
different hardware costs, and margin approval is computed against whatever
the salesperson typed. The server-side engine rule guarantees one
calculation path. It does not guarantee one set of inputs.

That is a commercial control gap, and it sits directly under the Commercial
approval that Bid/No Bid and the Proposal gate are about to make
load-bearing. **The recommendation is not to build the catalog now. It is
to stop calling it a documentation problem.**

### The commercial model itself is in good shape

Confirmed with the business: the calculations provide the right level of
support and the cash flow tool is valuable. There may be pricing areas not
yet considered, and the basic framework is sound.

### Live cost calculation computes server-side

Round 17A Phase 6 established the rule with the business: no second cost
engine. The browser posts draft values to a calculate-only route and
renders what comes back. The cash flow tool must use the same engine, which
is the reason the rule matters beyond one tab.

**Applies to any derived assessment score.** If a score is computed from
conditions, it is computed in one place, server-side.

### Ownership is being widened

Reads are team-wide and writes are owner-only, which is a single-user model
nobody chose. The business has confirmed writes widen to any authenticated
user. `owner_id` becomes provenance rather than permission. Whatever that
change lands as applies to Opportunities too.

**Note added v1.1:** this interacts with the assessments. A score is
attributed to the Sales Lead who took it and challenged in bid review, so
`owner_id` becoming provenance is the right direction, and the score's own
`by` field is the attribution that matters, not record ownership.

### Optimistic concurrency is deferred

Not rejected. Two people editing one field still resolves
last-writer-wins. Locking was considered and rejected: it does not address
the common case of two people editing different fields, and it brings stale
locks, timeouts and override permissions with it.

---

## Proposed round shape

**RECOMMENDED, UNDECIDED.** Recorded here so the reasoning is visible; the
brief itself is a separate document.

Given Finding 1, the first Opportunity round is a restructure with the
scaffold inside it, not a gate-configuration round.

| Phase | Content |
|---|---|
| 1 | Stage restructure. Replace the six old stages, create Closed Won and Closed Lost, migrate 3 live and 60 soft-deleted records, resolve `stage_probability_defaults` |
| 2 | `Bid Review` track. Closed Lost reason rows including "No Bid" |
| 3 | Gate rules for the three forward transitions. Approvals and non-scored exit criteria only |
| 4 | Scaffold criteria, three not one. Click through every transition including Closed Lost from Discovery |
| 5 | Remove the scaffold. Verified from the database |

The four dates and the revision event are a **separate, later round**, and
should follow a real deal running through the pipeline, because the
revision-plus-approval-plus-rescore design deserves testing against a real
clarification rather than an imagined one.

---

## The six-month test on the assessments

**Recorded v1.2. Watch item, not a build item. Do not build anything
against this.**

With no Bid Review approval, the assessments have no formal consumer. They
are exit criteria feeding a judgement made in conversation.

**The test: in six months, are the scores being maintained, or is somebody
re-saving the same numbers to clear the gate?** If the latter, the
instrument has died, and the fix is either a real bid review or fewer
criteria rather than more enforcement.

The "current" criterion, an entry dated at or after entry to the stage,
makes re-saving visible but does not make it meaningful: a re-save with
identical numbers satisfies it and is exactly the failure this test is
looking for.

---

## Findings from the Round 20 Phase 0 investigation

Recorded as findings, not fixes. Neither is scheduled.

### FINDING, UNRESOLVED. One stage vocabulary, four column names, no joins

The same set of strings is stored under four different column names in four
tables, with **no foreign key between any of them** and no check
constraint anywhere:

| Table | Column |
|---|---|
| `records` | `status` |
| `stage_definitions` | `stage_name` |
| `stage_probability_defaults` | `stage` |
| `stage_gate_rules` | `from_stage`, `to_stage` |

`records.status` is plain `text not null`. Deleting a `stage_definitions`
row does not fail and orphans every record holding that status silently,
which is why the Round 20 migration has to move records itself.

**It has already cost something twice.** A Round 19 probe read `r.stage`
where the column is `stage_name`, compared `undefined` against a stage name
and reported a confident false, which is Verification 14's shape. The same
naming split is why `stage_probability_defaults` has to be remapped in the
same migration as `stage_definitions`: nothing links them, so nothing
complains when they disagree.

### FINDING, UNRESOLVED. `approvals.comment` and `tier` unused on all 229 rows

`approvals` carries `decision`, `comment`, `tier` and `stage`. Across all
229 rows: **`decision` is `approved` on every one**, `comment` is null on
every one, and `tier` is null on every one.

**No rejection has ever been recorded in this system.** The rejection path
is not merely unbuilt, it is entirely unexercised, which is Architecture
rule 8's shape exactly: correct for every caller it has, and untested for
the caller Round 20's blocking rejection will be.

`comment` is sitting where a reason would go. Whether the reason-code round
uses it or adds a reference column is that round's decision, but the field
already exists and has never held anything.

---

## Open decisions

| Item | Status |
|---|---|
| Deal assessment criteria | Undecided. Conversation before build. Explicitly out of Round 20 |
| Risk assessment criteria | Undecided. Depends on the first |
| Instrument shape: 1-to-5 anchors or derived from binary conditions | Confirmed v1.2. 1-to-5, existing mechanism unchanged, no schema change and no condition-based derivation |
| Bid/No Bid rejection semantics: auto-close or block | Confirmed v1.2. Rejection blocks the transition. The reason it carries is a separate round |
| `Bid Review` as the track name | Withdrawn v1.2. There is no Bid Review approval, so there is no track to name |
| `stage_probability_defaults`: remap, drop, or replace | Confirmed v1.2. Remapped in the same migration as the stage rows, with per-row values asserted |
| Terminal stages as columns (`is_terminal`, `reachable_from_any_stage`) or a named code exception | Confirmed v1.2. Columns. `is_terminal` blocks outbound transitions |
| **Revision event: series plus approval plus re-score as one thing** | **Undecided. Recommended. Out of Round 20** |
| **Deal Sheet freeze point after the stage compression** | **Undecided. The five-stage set changes which transition it should name** |
| Is a loss reversible | Undecided |
| Closed Lost reason list contents | Confirmed as configured rows, contents undecided |
| Staff directory: does `terminus_staff` exist and what does it hold | Answered 2026-08-22. It exists; the fields store a name as text. See Finding 6 |
| **Staff fields have no server-side validation** | **Open. The option list is client-side only, so any string can be written to `lead` through the ordinary PATCH path. Explicitly out of Round 20** |
| **`Account` is a third staff-field surface** | **Open. Its own `terminusLead`, described in no document until 2026-08-22; one live Account holds a name** |
| **Base Cost Data catalog** | **Finding. Recorded as a control gap, not scheduled** |
| `routing_rules` empty, Commercial tiering never worked | Finding. Not scheduled. Confirmed still 0 rows at Round 20 Phase 0 |
| **One stage vocabulary under four column names, joined by nothing** | **Finding v1.2. Not scheduled. See the findings section above** |
| **`approvals.comment` unused on all 229 rows, `tier` null on all 229** | **Finding v1.2. Not scheduled. Sits where a reason would go** |
| **Approvals unstated on three transitions** | **Open v1.2. Qualification to Solution Alignment, Proposal to Evaluation, Evaluation to Negotiating. Not invented** |
| Closed Lost stage-at-death storage | Confirmed v1.2. A server-written key on `opportunity_details`, deliberately NOT in `SALESPERSON_WRITABLE_KEYS` |
| Buyer contact role mapping | Open since the Test Bed build |
