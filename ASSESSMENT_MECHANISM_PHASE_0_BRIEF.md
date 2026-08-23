# Deal assessment mechanism: Phase 0, investigation only

**Round number to be confirmed against the repo.** Round 22 merged to `main`
at `e370ca7`.

---

## What this phase is

**Investigation. No file edits, no migrations, no code, no configuration
changes. No plan for a build round either, until this is reviewed.**

This is unusual: normally Phase 0 produces a phase plan. Here it produces a
sizing, because **the design has arrived at three scoring treatments and the
built mechanism supports one.** Whether that is a small extension or a
significant piece of work determines whether the design survives contact
with the engine, and neither the business nor this brief can know that from
outside the repository.

---

## The design, settled with the business

Two instruments were always intended: **Deal assessment** (how good is this
deal) and **Risk assessment** (what could go wrong). **Only the Deal
assessment is designed. Risk is untouched and out of scope here.**

The business produced a superset of 32 qualification criteria across four
lenses, drawn from BANT, MEDDIC/MEDDICC/MEDDPICC, SPICED and CHAMP, plus
Terminus-specific additions covering hardware sales into government and
infrastructure procurement. **Eight of the 32 are selected for a first pass**,
two per lens, deliberately light so the business can see how the instrument
behaves before committing to the rest.

### The eight

| Lens | Qualification | Solution Alignment |
|---|---|---|
| Commercial | Budget confirmed | Competition, including do-nothing |
| Organisational | Economic Buyer identified, Timeline declared | |
| Technical | Need / problem definition | Solution fit |
| Legal | Procurement route | Data protection and residency |

Plus two further binary checks at Qualification: **Strategic fit** and
**Reference deployment requirement**.

### The three scoring treatments

**This is the whole reason for this investigation.**

| Treatment | Shape | Used by |
|---|---|---|
| **Evidence state** | Four ordered levels: Unknown, Our hypothesis, Buyer confirmed, Verified | Budget, Economic Buyer, Timeline, Need, Competition, Solution fit |
| **Binary** | Confirmed / not confirmed | Strategic fit, Reference deployment requirement |
| **Confirmed value** | Confirmed / not, **plus a value from a configured list** | Procurement route, Data protection and residency |

**The built mechanism is a 1 to 5 score with per-level anchors**, five
criteria, `record_type = 'test_bed'`, 15 anchor rows at version 1.

### Why the evidence-state model is not a preference

It has a property the 1-to-5 anchors demonstrably lack: **every level is
defined and each level is one condition.** The Test Bed anchors carry a 5
averaging several conditions joined by an implicit AND, with nothing written
at 2 or 4. Evidence state removes that failure by construction rather than by
careful writing.

**Mapping four states onto 1 to 5 recreates the exact failure**, leaving one
number with nothing written against it. That mapping is not an acceptable
answer to the sizing question below.

### Why confirmed value exists

Three of the binary criteria carry an answer as well as a confirmation.
Confirming that the procurement route is known says nothing about whether it
is open tender, sole source or a framework agreement.

**The business has stated that insight from the collected data is the point
of the instrument.** "Which procurement routes do we win" needs the route
stored as queryable data. A note in a reason field is unqueryable, and
unqueryable is indistinguishable from absent when someone comes to look.

The configured-list shape already exists in this codebase:
`closed_lost_reasons`, built in Round 21, is a uuid-referenced,
admin-editable, `GET`-only table with an `active` flag.

---

## Read first

| Document | Why |
|---|---|
| `CLAUDE.md` | **From disk** |
| `OPPORTUNITY_DESIGN.md` | The Assessments section, and the ten undecided rows |
| `DESIGN_PRINCIPLES.md` | Round 11 Phases 1 to 8, the scoring mechanism and the anchor record |
| `PROTOTYPE_SPECIFICATION.md` | The Test Bed scoring panel |
| `CURRENT_STATE.md` | Generated. Run its staleness test |

**One caution on the anchor record.** `DESIGN_PRINCIPLES.md` records eight
hesitations from a business walkthrough, and this brief previously treated
that as evidence the 1-to-5 scale fails. **The business has since said much
of that scoring was test data clicked through for convenience.** Treat the
recorded anchor problems as real observations about the anchors, and do not
treat the hesitation count as a measurement of the instrument. Do not build
an argument on it.

---

## Investigations

### I1. What the scoring mechanism actually is

**The question.** End to end, how does a score get from a criterion
definition to a stored value and back onto the screen?

Report `scoring_criteria` and `scoring_anchors` in full: every column, every
constraint, every foreign key. Report the write path, the read path, the gate
rule integration via `payload_field_required` and `entry_stage_at_or_after`,
and the panel rendering.

**Report what is record-type agnostic and what is Test Bed specific.**
Round 21 found the tab strip, the transition handler and the approval
submitter were each written for Test Bed and would have silently done
nothing for Opportunity. **Assume nothing here is generic until shown.**

### I2. Sizing the three treatments

**The question this phase exists to answer.** For each of the three, what
would it take?

For each treatment report: schema changes, write path changes, read path
changes, gate rule expressibility, panel rendering, and whether Test Bed's
existing five criteria are affected.

**Evidence state.** Four ordered levels, no per-level anchors in the Test Bed
sense, since the level names are the definitions. Is this a variant of the
existing scale or a different thing?

**Binary.** Two states. Report whether this is trivially the existing
mechanism with two levels, or whether something assumes five.

**Confirmed value.** A confirmation plus a value referencing a configured
list. `closed_lost_reasons` is the nearest precedent. Report whether the
scoring mechanism can carry a reference at all, or whether this is a separate
structure that happens to appear in the same panel.

**Then report the shape.** Is this one mechanism with a `scale_type` column,
three mechanisms sharing a panel, or something else? **Do not choose. Report
the options with their costs.**

### I3. Stage scoping, and whether criteria accumulate

`scoring_criteria` carries `rescore_through_stage`, and the Test Bed panel
shows criteria tagged with the stage they were scored at.

**The question.** Can criteria be introduced at different stages and
accumulate, rather than a fixed set being re-scored?

**Why it matters.** The business intends the assessment to grow: four
criteria at Qualification, four more arriving at Solution Alignment, more
from the superset later. Test Bed's model is a fixed set re-scored at later
gates. **These may be the same mechanism or may not.**

Report whether a criterion can be required current at some stages and not yet
exist at others, and what a criterion introduced at Solution Alignment shows
on the Qualification tab of a record that has already passed it.

### I4. Where the panel goes

Round 21 built an Assessments placeholder as the first card on every stage
tab, reading `No assessments configured for this stage.`

**The question.** What does that placeholder do today, and what would fill it?

Report how the Test Bed scoring panel renders and how far it is reusable.
Report what happens on a stage with no assessment criteria, since Evaluation
and Negotiating would have none in the first pass.

**Report the count problem.** Four criteria at Qualification is light. If the
superset grows to twenty by Proposal, report what the panel does with that
volume and whether the existing rendering carries.

### I5. Gate expressibility

`OPPORTUNITY_DESIGN.md` settles that assessments are **exit criteria at
Solution Alignment, Proposal and Negotiating**, that the requirement is
**completeness rather than a threshold**, and that "current" means an entry
dated at or after entry to this stage via `entry_stage_at_or_after`.

**The question.** Can that be expressed for each of the three treatments?

Specifically: can a gate require that an evidence-state criterion has a
current entry without requiring a particular level? **No threshold gates
anything** and a rule that accidentally required Verified would block every
deal.

### I6. Insight, and what the data would actually support

The business's stated purpose is insight from how deals develop.

**Report what is stored per scoring entry** — author, timestamp, reason,
anchor version — and therefore what could be queried later without a
migration.

**Report honestly on volume.** At the current rate of opportunity creation,
say how long before there is enough data for cross-deal patterns to be
distinguishable from noise. **This is a caution, not a reason to build less.**
The per-deal narrative is available from deal one; the statistics are not.

### I7. Anything the design cannot express

The eight criteria, three treatments and the accumulate-over-stages model
were designed in conversation without repository access.

**If any of it collides with the engine, say so now.** Output item 4 in
previous rounds has caught the brief's central premise being wrong twice.

---

## What this phase produces

**Not a phase plan.** A sizing, so the business can decide whether the design
is affordable as specified or needs narrowing.

1. **I1 to I7**, each with the command run, the actual output, and the
   finding.
2. **The three treatments, each sized**, with the options for structuring
   them and their costs. Not chosen.
3. **A recommendation on scope**, in the form: what is a small round, what is
   a large one, and what should be deferred.
4. **Anything in the design that cannot be built as stated.**
5. **Any disagreement between a generated file and a hand-written one**,
   reported and not resolved.

Then stop.

---

## Explicit non-goals

- The Risk assessment. Not designed.
- The remaining 24 criteria in the superset.
- Anchors or wording for the four evidence-state levels. Those are a business
  conversation and follow this sizing.
- The Reference tab round, the reopening of a loss, the open-decisions table
  convention. All queued separately.
- Rule 7, the `~1s` panel window, the loss reason display.
- Any change to Test Bed's existing five criteria or their anchors.

---

## Standing rules with live traps here

- **Verification 17.** Every probe distinguishing two states shown returning
  different values in each. Six probe faults were self-caught in Round 22
  alone.
- **Build discipline 2.** Confirmed is not verified. This phase reports on
  code and schema, so every claim about behaviour needs a query or a run
  behind it, not a reading.
- **Architecture rule 8.** A lookup that silently drops an unknown caller.
  Round 21 and 22 found four instances of Test Bed-specific code that would
  have done nothing for Opportunity. Assume more.
