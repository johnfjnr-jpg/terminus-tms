# Round B: Opportunity assessment write path and Assessment tab

## Phase 0, investigation and plan

**Round number to be confirmed against the repo.** Round 24 (Round A) merged
to `main` at `99e6c6b`.

---

## What this phase is

**Investigation and a plan. No file edits, no migrations, no code, no
configuration changes.**

---

## What this round is

**The riskiest round in the sequence.** Round A built the mechanism and
changed nothing a user can see. This round builds the Opportunity side of it.

**There is no Opportunity-side scoring code at all.** The write route
`POST /test-beds/:id/scores` is Test Bed specific in three named ways, and
the panel `renderTbScores` lives in `test-bed-detail.js`.

**Rounds 21 and 22 found five separate cases of Test Bed-specific code that
silently did nothing for Opportunity**, one of which had been live in
production since Round 9. The scoring write path is the known sixth
candidate and it is what this round builds.

**Scope: one lens, Commercial, configured to prove the seam.** The other
three lenses and the remaining criteria are Round C. Configuring 32 criteria
is rows; proving that an Opportunity score writes, reads, renders and
survives a stage change is where the risk sits, and doing both together
means debugging a seam while debugging wording.

---

## What Round A established

**Do not re-investigate.** Confirm anything a change depends on, but the
mechanism is built and merged.

| | |
|---|---|
| `scoring_lenses` | Four rows. `scoring_criteria.lens_id` nullable, so Test Bed's five carry null |
| `scoring_scales`, `scoring_scale_levels` | Shared scales. `scoring_criteria.scale_id` nullable, **null means the legacy 1-to-5, resolved server-side in one place** |
| `reason_required` | Per level, replacing the inline `score <= 2`. Test Bed's levels 1 and 2 carry it |
| `scoring_criterion_stages` | `(criterion_id, stage, required)`. **Visibility, not gating.** Eight Test Bed rows derived from gate rules |
| `assessment_current` | New `stage_gate_rules` requirement type, `{label, entry_stage_at_or_after}`. **Cumulative**: resolves every criterion required at that stage or earlier. **Zero rows exist** |
| Empty-set guard | A rollup with no required criteria returns 422, not a vacuous pass |
| `src/lib/scoring-levels.js` | One definition of the legacy default and its flags |

**The rollup resolves every scoring criterion for the record type.** A second
instrument on the same record type, which Risk will be, needs a
discriminator. Named in the migration, not designed. **Not this round.**

---

## The defect this round must fix, by name

**Round A Phase 2 changed the anchor-number span from `${n}` to `${label}`.**

Test Bed's level labels are `"1"` through `"5"`, so it is pixel-identical
there. **It is broken for any word-labelled scale**, which is every scale the
Deal assessment uses. The label lands in a slot styled for a single
character: "Not confirmed" wraps to two lines, renders in the green numeric
badge treatment, and collides with the wording column beside it.

Architecture rule 8 in its exact form: correct for every caller that exists,
wrong for the one being built now.

**Fixing it is in scope. Inheriting it silently is not.**

### Three further findings from Round A Phase 4, for judgement rather than fix

Reported when a binary criterion was rendered through the score path:

1. **The language differs.** The score path prompts "Score..." and reads "Not
   scored"; the hardcoded `measurabilityConfirmed` block prompts "Confirm..."
   and reads "Not confirmed". **This is a decision, not a defect**, and it
   falls due when `measurabilityConfirmed` becomes a row in its own later
   round. Report a recommendation; do not change Test Bed.
2. **An unanchored criterion renders as two empty rows and the literal
   "Version null".** Reachable, because `INVARIANT 8` requires anchors only
   for *gated* criteria and Round A separated visibility from gating.
   **Decide what a visible-but-ungated criterion with no anchors renders
   as.**
3. **The two treatments read as different features.** May resolve on its own.
   Report whether it still does after this round's panel work.

---

## The design, settled with the business

### Structure

**Assessment is a top-level tab**, alongside Reference and Commercials, with
**four sub-tabs, one per lens**.

It is not a card on the stage tab. Round 23 measured why: the card is 420px
wide at every viewport, and twenty criteria extrapolates to 1759px in that
column, taller than a laptop viewport, as one of four cards.

**The ninth tab is one CSS declaration.** Round 24 I3 measured it:
`#tb-detail-tabs` carries `flex-wrap: wrap; row-gap: 4px` and lays ten labels
out as two rows of five at 1240px without overflowing. `#opp-detail-tabs` is
`nowrap`, so a ninth tab protrudes 7px. **The remedy is proven on the sibling
strip and costs a second row, not a layout redesign.**

**`createSubTabs` already exists**, generic, with two consumers since Round 16
Phase 1. It generates its own strip and panes scoped to a mount, with an
`adopt` option. **Its parameter list is a destructuring allowlist**, so a new
option is silently discarded until the definition names it. Architecture rule
9.

### The scale

Five levels: **Not applicable, Unknown, Our hypothesis, Buyer confirmed,
Verified.**

**The scale measures confidence in a data point, not progress toward a
goal.** The step from Our hypothesis to Buyer confirmed is *who said it*; the
step from Buyer confirmed to Verified is *one source or two*. Both are
checkable by someone who was not in the meeting, which is what makes them
attackable in a bid review.

**The wording is provisional and must be seeded as such.** The business has
deliberately deferred nailing the anchor wording until real deals have been
scored, on the grounds that anchors are configured rows and revising them is
a row edit. **Mark it provisional in the seed** so a later reader does not
take it as settled. This is the Test Bed lesson applied deliberately rather
than repeated.

**Two open items the business set aside, recorded not resolved:**

- **Not applicable does not apply to every criterion.** Budget confirmed
  always applies; anti-corruption due diligence genuinely does not apply to a
  Singapore commercial buyer. That points to two scales, four levels and
  five, assigned per criterion. Round A made scales shared and per-criterion,
  so this is configuration.
- **Verified needs a floor.** Two people at the same buyer saying the same
  number is one source twice. Whether independence is stated in the anchor or
  left to bid review is undecided.

**Neither blocks this round.** One lens, provisional wording.

### The gate is the approval, not the criteria

Criteria do not gate transitions. **Commercial, Technical and Legal approvals
gate them**, and the criteria are what those approvers read.

**All three approvers see all four lenses.** The lens sub-tabs organise
reading, not ownership. There is no fourth track and Organisational has no
approver, which is intended.

Above the criteria sits **one rollup exit criterion per stage**: every
criterion required at that stage or earlier carries an entry dated at or
after entry to the stage. `assessment_current` expresses it and Round A
exercised both branches on a synthetic record type.

**An approver may approve with unanswered criteria, recording why.** That is
Round D and is not built here.

---

## Read first

| Document | Why |
|---|---|
| `CLAUDE.md` | **From disk** |
| Round 24's Phase 0 report and close-out | The sizing and the mechanism. Do not repeat |
| `OPPORTUNITY_DESIGN.md` | The Assessments section |
| `INTERACTION_STANDARDS.md` | **Load-bearing.** A new tab, sub-tabs, a new panel |
| `PROTOTYPE_SPECIFICATION.md` | Sections 3 and 5 |
| `DESIGN_PRINCIPLES.md` | Round 11 Phases 1 to 8, and Round 16 Phase 1 for `createSubTabs` |
| `CURRENT_STATE.md` | Generated, and **known blind**: it cannot see four of this work's tables, nor `lens_id`, `scale_id` or `reason_required` |

---

## Investigations

### I1. The write path, and what it takes to make it record-type agnostic

**The question.** `POST /test-beds/:id/scores` is Test Bed specific in three
named ways: two hardcoded `record_type = 'test_bed'`, and a hardcoded reason
rule now replaced by `reason_required`. What does an Opportunity write path
take?

Report the options and their costs: generalise the existing route,
add a parallel Opportunity route, or extract a shared handler.

**Report on `appendPayloadSeriesEntry` specifically.** Round 23 found it was
extracted so writers share one path, and **the score path still calls
`appendRecordRevision` directly.** `src/lib/units.js` names this as its
cautionary case. A new writer makes it three writers of one shape.

**Report the ownership trap.** Round 24 Phase 6 found the API test user is a
different account from the live records' owner, `266a2812` against
`75425a02`. **A fixture with the wrong owner passes every gate and fails at
the write, which reads exactly like the gate failing.** This round creates
fixtures constantly.

### I2. The read path and the panel

**The question.** `GET /api/scoring-criteria` is generic and takes
`?record_type=`. What else does the panel need, and how much of
`renderTbScores` is reusable?

Report what is genuinely shared versus what is Test Bed shaped. **Assume
nothing is generic until shown**: that assumption has been wrong five times
in three rounds.

**Report the anchor-label defect's blast radius.** Which call sites render
the span, and whether fixing it touches Test Bed's rendering at all. **Test
Bed must stay pixel-identical**, and the fix must be verified against a
word-labelled scale as well, since pixel-identical on Test Bed is exactly the
result the defect already produces.

### I3. The Assessment tab and the lens sub-tabs

**The question.** What does adding a ninth top-level tab take, and what does
mounting four sub-tabs inside it take?

Report the wrap fix measured at 1240 and 1920, not estimated, and what the
second row does to the layout below it.

Report `createSubTabs`'s full parameter list and what its two existing
consumers pass. **A new option is silently discarded until the definition
names it.**

Report where the Assessment tab's content is loaded and when: on record load,
on tab click, or on sub-tab click. **Round 22 measured a one-second window
where a stage panel is on screen with its advance control not yet rendered.**
This tab has four sub-tabs and a criteria fetch, so the same question applies
before it becomes visible.

### I4. Configuring one lens

**The question.** What does it take to configure Commercial for Opportunity,
end to end?

The five-level scale row, the criteria rows with `lens_id` and `scale_id`,
provisional anchor wording, and `scoring_criterion_stages` rows.

Report which Commercial criteria to use. The business's superset places
**Budget confirmed at Qualification** and **Metrics / quantified value,
Funding mechanism, Pricing model fit, Competition including do-nothing, and
ROI / payback expectation at Solution Alignment**, with **Commercial fit at
Proposal**. Report whether all seven should be configured or a subset, and
argue for it.

**Report whether `assessment_current` rows should be inserted in this
round.** Round A deliberately inserted none because a rule over an empty set
would read as satisfied, and the empty-set guard now makes that a 422. With
criteria existing, a rule becomes meaningful and also **starts blocking real
transitions on the four live Opportunities.** That is a decision, not an
implementation detail.

### I5. What the design cannot express

The design was settled in conversation without repository access. **Output
item 4 has caught the brief's central premise being wrong three times in five
rounds.** If any of it collides with the engine, say so now.

---

## The plan to produce

Small phases, each verifying, each committing. Suggested shape, argue with
it:

| Phase | Content |
|---|---|
| 0 | This investigation |
| 1 | The anchor-label defect. **First**, because everything after it renders word-labelled scales |
| 2 | The write path, per I1 |
| 3 | The Assessment tab and the wrap fix |
| 4 | The four lens sub-tabs, mounted, three empty |
| 5 | The panel: criteria, levels, anchors, reasons |
| 6 | Configure Commercial, per I4 |
| 7 | Full walk: score, re-score, advance a stage, confirm currency |
| 8 | Close-out |

**Argue with it.** If I1 shows the write path is larger than a phase, it may
need splitting; if I2 shows `renderTbScores` is barely reusable, Phase 5
grows.

---

## Verification requirements

**Test Bed must stay pixel-identical**, verified at 1240 and 1920 with the
comparison calibrated at each step against an injected one-row change. Round
A did this every phase and it is the standard.

**The anchor-label fix must be verified against a word-labelled scale.**
Pixel-identical on Test Bed is what the defect already produces, so Test Bed
alone cannot verify the fix.

**Every browser interaction performed at least three times in sequence
without reloading.** Round 21's blocker survived a full walk because the walk
clicked once, and Round 22's survived because the walk clicked the
destination tab.

**Look at the result.** Presence is not legibility. Round A Phase 4 shipped no
diff and found a three-phase-old defect by looking.

**Calibrate every absence-shaped check**, and confirm any probe
distinguishing two states returns different values in each.

**Watch for the third-state species.** Round 24 recorded five instances: a
401 hashed as a baseline, an expired session surfacing as a type error, a
stale token producing an empty fixture id, a `--watch` contaminated 500, and
a 401 labelled ALLOWED. **Four of the five were caught only because the probe
happened to print a status beside its verdict.** No rule is proposed; the
species is named so it is recognised.

---

## Explicit non-goals

- **The Risk assessment.** Not designed. Deal only.
- **The other three lenses and the remaining criteria.** Round C.
- **Coverage and confidence display, creation checks, the reason on an
  incomplete approval.** Round D.
- **Migrating `measurabilityConfirmed`.** Its own small round once Opportunity
  is proven, where its blast radius is the only thing under test.
- **Confirmed value** for procurement route and data residency. Deferred until
  a read path exists.
- **Nailing the anchor wording**, the two-scales question, and the Verified
  independence floor. Business conversation, after real deals.
- The Reference tab round, reopening a loss, the open-decisions table
  convention, rule 7, the `~1s` panel window, the loss reason display,
  `approver_id` resolving to nobody, the `CURRENT_STATE.md` blind spot.

---

## Output format

1. **I1 to I5**, each with the command run, the actual output, and the
   finding.
2. **The phase plan**, with the argument for any departure.
3. **The `assessment_current` decision from I4**, presented for review, since
   it would begin blocking transitions on live records.
4. **Anything in the design that cannot be built as stated.**
5. **Any disagreement between a generated file and a hand-written one**,
   reported and not resolved.

Then stop and wait for sign-off.

---

## Round 25 outcome, Round B of the multi-round plan

Nine stages, 0 through 8. The riskiest round in the sequence, and the seam it
was built to test held: there is now Opportunity-side scoring code, it shares
one handler with Test Bed, and Test Bed's scoring panel is pixel-identical at
1240 and 1920 at every stage of the round, with the comparison calibrated at
each step against an injected one-row change.

### Rule 7 returned a plausible number again

`grep -c "^## Phase\|^### Phase"` returns **1** against this brief. The real
count is **9**, carried as a table. Calibrated: the same pattern returns 5
against `ROUND18A_FIX_BRIEF.md`.

The single match is `## Phase 0, investigation and plan`, a section heading
ABOUT the first stage rather than the list of them. That is the Round 22
failure exactly: not a zero that is obviously broken, but a number that looks
like an answer.

Six consecutive rounds now. **Round 24 established the premise is wrong rather
than the pattern**: briefs carry their phase list as a table, or carry none at
all because the round was planned in conversation. This round is the first
where the rule matched a heading that exists and still gave the wrong count.

Counted from the commits: phases 1 through 7 signed off in the transcript,
plus Phase 0 and this close-out.

### Two explicit column lists that outlived their schema

**`GET /api/scoring-criteria` selected an explicit column list written before
`lens_id` existed.** Every `c.lens_id` arrived as `undefined`, so no criterion
matched any lens and the panel rendered nothing. The filter was correct, the
data was correct, and the join silently could not happen.

**This is the second instance of one shape.** Round 24 Phase 7 recorded that
`scripts/state-dump.mjs` fetches `scoring_criteria` with a seven-column list
that excludes `lens_id` and `scale_id`, so both are invisible in the generated
file. Neither of us connected the two at the time: the same mistake, in a
route and in a generator, found five phases apart.

The shape is worth naming: **an explicit column list is a snapshot of the
schema on the day it was written, and nothing tells it when the schema moves.**
A `select('*')` would have carried both. The list exists for good reasons, and
the cost is that adding a column is two edits in two files, one of which
nobody is looking at.

### "Assess..." and "Not assessed" is the destination

Round A Phase 4 found two vocabularies: the score path prompts "Score..." and
reads "Not scored"; the hardcoded `measurabilityConfirmed` block prompts
"Confirm..." and reads "Not confirmed". Neither fits a five-level named scale.
"Score" asks for a number the scale does not have; "Confirm" implies two
outcomes where there are five.

**Chosen: "Assess..." and "Not assessed", after the instrument.** It is
deliberately a third string, and that is only defensible because it is the
DESTINATION rather than one more option. It covers five-level and binary
alike, so the round that migrates `measurabilityConfirmed` has a target that
fits both treatments.

**Recorded here so that round converges on it rather than choosing again.**
Three strings is worse than two unless one of them is where everything is
going.

### The eye travel, and why the first number was wrong

Uncapped, the distance from a criterion name to its control grew with the
viewport: **397px at 1240, 1077px at 1920, 2597px at 3440**, without limit.

**The first measurement read 16px.** The name span is `flex: 1 1 auto`, so its
BOX fills the row while its TEXT sits at the left edge, and measuring
`getBoundingClientRect()` gives the distance between two boxes that are
touching. Measuring the rendered text with a Range gave the real figure.

Capped at **880px**, the content width at 1240, which is where the panel had
already been looked at and read correctly. The same cap fixes a second thing:
the anchor wording ran the full row, so a 12px line at 1556px was roughly 200
characters. Now stable at ~400px at all three widths.

### The unanchored criterion, closed

Round 24 Phase 4 found it renders as two blank rows and the literal "Version
null". It is reachable because `INVARIANT 8` covers only
`payload_field_required` rules.

**Decided: disabled, with a stated reason.** The score endpoint answers 409 to
a criterion with no anchors, so a select offered there is one that cannot
succeed, and a control guaranteed to fail is worse than one that says why.
Verified against an anchored criterion in the same panel: disabled, zero blank
rows, no "Version null".

### Verification 6 twice in one round, both self-caught

Both were fixed delays racing a second round trip, and both produced a
confident wrong reading rather than a failure.

- **Phase 6**, a 1200ms wait after Record. The commit POSTs and then re-reads,
  so the panel showed "Not assessed" while the database already held the
  entry.
- **Phase 7**, a 400ms wait after opening the tab, compounded by a wait the
  PREVIOUS render already satisfied. Together they produced 0, 1, 6 where 1,
  6, 7 was right: a clean off-by-one that read exactly like a stale-stage
  defect. It was resolved by instrumenting the filter in the page rather than
  by reasoning about it, which showed the filter was correct before any theory
  was formed.

A third fault in the same phase: a presence check written as
`getElementById(...)?.querySelector(...) !== null`, which yields `undefined`
before the mount runs, and `undefined !== null` is TRUE. Verification 14's
family: compare presence first, then value.

### A third route to the same residue

Live records read 96 rather than 94 at the end of Phase 7. Two fixtures
survived because the probe was piped through `head`, which closed the pipe and
killed the process before its `finally` teardown ran.

**That is the third distinct route to the Round 21 outcome**, after a probe
that threw before recording its id and a stale token that produced an empty
fixture id. The cleanup was correct in all three; what varied was whether it
got to run. Torn down by enumerating from the database by tag: 11,237
revisions scanned paged, 57 carrying a tag so the scan was not blind, 23
tagged records, 2 live, both soft deleted and re-queried.

### Recorded and not fixed

- **`INVARIANT 8` still cannot see `assessment_current`.** It filters on
  `payload_field_required` rules naming a field, and the rollup rule names
  none. Latent while zero rollup rows exist, and extending it in a round that
  ships none would be a branch nothing exercises.
- **The provisional-anchor marker, deferred to Round C by name.** All 35
  wordings begin with the literal `PROVISIONAL`, which is stronger than a
  comment and lives inside text a later round rewrites, so the marker leaves
  silently when someone improves an anchor. The evidence that a comment is not
  enough is in the repository: `scoring_model.sql` carries the same warning in
  almost the same words over Test Bed's fifteen anchors, and they have been
  read as settled ever since. Round C populates twenty-five more and writes
  wording nobody has tested, which is where a queryable marker matters.

### What the generated file can now see, and what it still cannot

This round's route changes made three things visible: the **seven Commercial
criteria as rows**, their **anchors as a count** (15 to 50), and the **two new
routes** (59 to 61).

Everything else remains invisible, and the blind spot is unchanged in shape:

- `scoring_lenses`, `scoring_scales`, `scoring_criterion_stages` and
  `closed_lost_reasons` appear once each, as a migration FILENAME.
  `scoring_scale_levels` appears **zero times**, because its name is not in a
  filename.
- `lens_id`, `scale_id` and `reason_required` appear **zero times**, against a
  calibration of `rescore_through_stage`, which the same section prints. The
  criteria table is dumped with a fixed six-column list.

So the file now records seven criteria without recording which lens or scale
any of them uses, which is the configuration that makes them work.

### Open decisions in `OPPORTUNITY_DESIGN.md`

**Seven bolded rows, none claiming Confirmed**, asserted individually:

1. Revision event: series plus approval plus re-score as one thing
2. Deal Sheet freeze point after the stage compression
3. Staff fields have no server-side validation
4. `Account` is a third staff-field surface
5. Base Cost Data catalog
6. One stage vocabulary under four column names, joined by nothing
7. `approvals.comment` unused on all 229 rows, `tier` null on all 229

**The table still has two conventions for open and they disagree at seven
versus ten**, found in Round 22 and unchanged: 21 rows, 7 bolded, and 3
further marked Undecided without bolding, being Deal assessment criteria, Risk
assessment criteria, and Is a loss reversible.

**One of those three moved this round and the table does not say so.** "Deal
assessment criteria: Undecided, conversation before build" now describes seven
configured criteria across three stages with anchors and stage rows. It is
partially answered rather than undecided, and twenty-five criteria remain.
Reported, not resolved.

Row 7's figure is stale again: `approvals` holds **335** rows, not 229. The
claim survives, `comment` non-null on 0 and `tier` on 0, and no rejection has
ever been recorded.

### Reconciliation

`CURRENT_STATE.md` regenerated at `bc5f023`. Four tracked configuration
sources changed, one migration and three routes. Every diff line accounted
for:

- **`scoring_criteria` 5 to 12 rows**: the seven Commercial criteria.
- **`scoring_anchors` 15 to 50**: the 35 provisional anchors, printed as
  scores defined per version rather than as wording.
- **Routes 59 to 61**: `POST /api/opportunities/:id/scores` and
  `GET /api/scoring-lenses`.
- **Migrations 69 to 70**: the Commercial lens configuration.
- **Live records 94, unchanged.** Every fixture torn down and re-queried,
  including the two that escaped in Phase 7.
- **Soft deleted 10624 to 11121, approvals 326 to 335**: walk and phase
  fixtures, none on a live record.
- **No new sections**, which is the blind spot above rather than an omission.
