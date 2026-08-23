# Deal assessment: Phase 0, investigation and multi-round plan

**Round number to be confirmed against the repo.** Round 23 was the
mechanism sizing and produced no diff beyond its own brief.

---

## What this phase is

**Investigation and a plan. No file edits, no migrations, no code, no
configuration changes.**

Round 23 sized the scoring mechanism. **The design has moved since**, in ways
that make three parts of it cheaper and one part new. This phase sizes what
changed and produces a plan across more than one round.

**This is a large body of work.** There is no Opportunity-side scoring code
at all, and Rounds 21 and 22 found four separate cases of Test Bed-specific
code that silently did nothing for Opportunity. Expect the plan to split.

---

## The design, settled with the business

### Structure

**Assessment becomes a top-level tab**, alongside Reference and Commercials,
**with four sub-tabs, one per lens**: Commercial, Organisational, Technical,
Legal.

It is not a card on the stage tab. Round 21 built an Assessments placeholder
there and Round 23 measured why it cannot hold this: the card is 420px wide
at every viewport, and twenty criteria extrapolates to 1759px in that column,
taller than a laptop viewport, as one of four cards.

**The tab row was measured at 876px in 876px with zero margin at 1240px.** A
ninth tab overflows. That is a known constraint, not a discovery to make
mid-build.

### The scale: five levels, and this is the important reversal

| Level | Meaning |
|---|---|
| 1 | Not applicable |
| 2 | Unknown |
| 3 | Our hypothesis |
| 4 | Buyer confirmed |
| 5 | Verified |

**This is the built mechanism, used properly.** Earlier drafts of this design
had a four-level evidence-state scale that did not fit a five-point column,
and the business's decision that approvers must be able to record "not
applicable" landed it back on five.

Every level is defined. **Every level carries exactly one condition.** That is
the property the Test Bed anchors lack, where a 5 averages several conditions
joined by an implicit AND and 2 and 4 carry no wording at all.

**Binary criteria remain two-state.** Round 23 found binary already exists and
works: `measurabilityConfirmed` stores through the same series shape and
gates through the same rule, though as a hardcoded special case rather than a
`scoring_criteria` row.

### The gate is the approval, not the criteria

**This is the decision that reshapes the build.**

Criteria do not gate transitions. **Commercial, Technical and Legal approvals
gate them**, and the criteria are the information those approvers read.

Round 23 confirmed no threshold gate is expressible today: the evaluator
checks array length and entry stage and never inspects the value. **That is
not a thing to build. It is what exists.**

**An approver may approve a lens with unanswered criteria.** The business is
explicit: the decision-makers are trusted to make the call. **But the reason
is required and recorded**, with author, timestamp and track, the same shape
as every other reason in this system.

"Not applicable" is the honest path for a criterion that does not apply, and
it leaves nothing unanswered. **The reason is reserved for approving despite
genuinely not knowing**, which is the case worth recording.

### Visibility is separated from requirement

Round 23 found that a criterion appears at a stage **if and only if a gate
rule there names it.** Visibility and requirement are currently the same
thing.

**They must be separated.** Criteria now display and can be scored without
blocking any transition. This is the single largest mechanical consequence of
the gate decision above.

### The criteria

32 in the business's superset. Stage allocation after the decisions taken in
conversation:

**Qualification, 7**

| Lens | Criterion | Treatment |
|---|---|---|
| Commercial | Budget confirmed | Five-level |
| Organisational | Economic Buyer identified | Five-level |
| Organisational | Prioritisation | Five-level |
| Organisational | Trigger event / timeline | Five-level |
| Organisational | Champion identified | Five-level |
| Technical | Need / problem definition | Five-level |
| Legal | Procurement route and compliance | Binary |

**Solution Alignment, 21.** The remaining Commercial, Organisational and
Technical criteria plus the Legal block. Six of the Legal seven are binary.

**Proposal, 2.** Commercial fit, five-level. IP ownership and licensing
terms, binary.

**Creation checks, 2, not stage criteria and not gates:** Strategic fit and
Reference deployment requirement. Both are binary, both are answerable when
the opportunity is created, and neither gains proof over time. Reference
deployment requirement matters disproportionately because Terminus is
pre-revenue.

### Reconciliation with the spreadsheet

**The spreadsheet has not been updated with the last two decisions.** Work
from this brief, not the sheet, and report the discrepancy rather than
resolving it silently.

| | Sheet says | Brief says |
|---|---|---|
| Champion identified | Solution Alignment | **Qualification** |
| Strategic fit | Qualification | **Creation check** |
| Reference deployment requirement | Qualification | **Creation check** |

Totals reconcile: 7 + 21 + 2 stage criteria, plus 2 creation checks, is 32.

### Displayed, not scored

**Coverage and confidence per lens.** Twelve of eighteen answered; six
Verified, four Buyer confirmed, two Our hypothesis. Both are derived from
data the system already holds.

**Not one blended figure.** A lens at 80 percent coverage where everything is
Our hypothesis is not equivalent to one at 40 percent where everything is
Verified, and a single number cannot say that.

### Deferred, deliberately

**Confirmed value.** Three binary criteria carry an answer as well as a
confirmation: procurement route is open tender or sole source or framework,
data residency is PDPA or GDPR or local. Storing the value would make
"which procurement routes do we win" answerable.

**Not in this work.** Round 23 found no GIN or jsonb index anywhere and the
series lives only in the newest revision's payload, so the read path the
value exists for does not exist. Shipping the write without the read repeats
Round 21's loss reason, which is stored and displayed nowhere to this day.

---

## What Round 23 already established

**Do not re-investigate these.** Confirm they still hold if a change depends
on them, but the sizing is done.

| | Finding |
|---|---|
| The 1-to-5 assumption | Exactly four places: the `scoring_anchors` CHECK, `test-beds.js:1691`, and two hardcoded `[1,2,3,4,5]` arrays in the frontend |
| Storage | `record_revisions.payload[criterion_key]`, append-only series, entries `{at, by, value, anchorVersion, stage}` plus optional comment and reason. Validates nothing about contents |
| Gate evaluator | Generic. `min_length` checks array length, `entry_stage_at_or_after` checks entry stage. Neither reads the value |
| Read route | `GET /api/scoring-criteria` is generic, takes `?record_type=` |
| Write route | `POST /test-beds/:id/scores` is Test Bed specific: two hardcoded `record_type`, hardcoded `1..5`, hardcoded `score <= 2` reason rule |
| Panel | `renderTbScores` is Test Bed specific |
| `INVARIANT 8` | Requires every gated criterion to carry anchors |
| `INVARIANT 9` | Derives completeness per criterion from its own anchors, so it accommodates any number of levels |
| Accumulation | Already the mechanism. Criteria are stage-scoped by gate rule |
| `appendPayloadSeriesEntry` | Extracted so writers share one path, but the score path still calls `appendRecordRevision` directly. `units.js` names this as its cautionary case |
| Live usage | 59 scoring entries across 7 live records |

**Round 23's recommended split, which this plan should build on:** binary as
a first-class row and panel options derived from anchors is small; the
Opportunity write path and panel is large and is where the risk sits.

---

## Read first

| Document | Why |
|---|---|
| `CLAUDE.md` | **From disk** |
| Round 23's Phase 0 report | The sizing. Do not repeat it |
| `OPPORTUNITY_DESIGN.md` | The Assessments section, and the ten undecided rows |
| `DESIGN_PRINCIPLES.md` | Round 11 Phases 1 to 8 |
| `INTERACTION_STANDARDS.md` | Load-bearing. A new tab, sub-tabs, and a reason dialogue |
| `CURRENT_STATE.md` | Generated. Run its staleness test |

---

## Investigations

Three items the Round 23 sizing did not cover, plus two carried forward.

### I1. Reason on an incomplete approval

**The question.** What would it take for an approver to approve a lens with
unanswered criteria and record why?

`approvals` holds `id, record_id, revision_number, track, tier, approver_id,
decision, comment, decided_at, created_at, stage`. Round 21 Phase 4 found
`comment` is **non-null on zero of 229 rows** and no rejection has ever been
recorded.

Report: whether `comment` is the right home or whether this needs its own
column; how the approval is submitted today and where a prompt would sit;
whether the existing reason dialogue, which Round 22 Phase 3 extended with an
optional picklist, is reusable a third time.

**Report what "unanswered" means mechanically.** The approver approves a
track, and the criteria carry a lens. **Track and lens are not the same
vocabulary.** Commercial, Technical and Legal are approval tracks; Commercial,
Organisational, Technical and Legal are lenses. **Organisational has no
approver.** Report how they map and flag it as a finding if they cannot.

### I2. Separating visibility from requirement

**The question.** Criteria must display and be scoreable without gating any
transition. What does that take?

Round 23 established that `renderTbStageScoring` derives visible criteria from
that stage's own gate rules. Report what else would drive visibility: a
column on `scoring_criteria`, a new table, a gate rule with a non-blocking
flag, or something else.

**Report whether Test Bed is affected.** Its five criteria are visible because
they are gated. A change to how visibility is derived must leave them
rendering exactly as they do now, and that is a claim to measure rather than
assert.

### I3. The ninth tab

**The question.** The Opportunity tab row is 876px in 876px at 1240px with
zero margin. Assessment makes nine.

Report the options measured, not estimated: shorter labels, wrapping, a
scrolling strip, a different layout. Report what Test Bed does, since its
strip carries ten labels.

**Report the sub-tab mechanism too.** Four lens sub-tabs inside the Assessment
tab is a second level of tabs. Round 21 found `createTabStrip` with an
`adopt()` method for dynamically added buttons. Report whether it nests.

### I4. The five-level scale, confirmed not assumed

Round 23 found the four hardcoded places and that `INVARIANT 9` derives
completeness per criterion.

**Confirm the five-level scale needs no mechanism change at all**, since it is
five levels with wording at every one, which is what the mechanism was built
for. If anything assumes the *Test Bed* levels specifically rather than five
levels generally, that is a finding.

**Report the `score <= 2` reason rule.** On this scale, 1 is Not applicable
and 2 is Unknown. A mandatory reason on both is arguably right, but by
coincidence. Report what it would take to make it data-driven per criterion.

### I5. Creation checks

**The question.** Strategic fit and Reference deployment requirement are
binary, answered when the opportunity is created, and gate nothing.

Report where they would live. They are not stage criteria and not scoring
criteria in the current sense. Report whether the opportunity creation flow
has anywhere to put them, and what the two conversion paths would do, since
Round 21 Phase 8 found the Contact route never reads `request.body`.

---

## The plan to produce

**A multi-round plan, not a single phase list.** Round 23 recommended
splitting and this design is larger than what it sized.

Suggested shape, to be argued with:

| Round | Content |
|---|---|
| A | Mechanism: binary as a first-class row, panel options derived from anchors, `score <= 2` made data-driven, visibility separated from requirement. **Test Bed must render identically throughout** |
| B | The Opportunity write path and the Assessment tab with lens sub-tabs. The largest and riskiest piece |
| C | The 32 criteria configured, coverage and confidence display, creation checks, reason on incomplete approval |

**Argue with the split.** In particular, if I1 shows the approval reason is
larger than it looks, it may deserve its own round; and if I3 shows the tab
row cannot take a ninth tab without a layout change, that may need to come
first.

---

## Explicit non-goals

- The Risk assessment. Not designed. **Deal only.**
- Confirmed value. Deferred with reasons above.
- Any change to Test Bed's five criteria or their anchor wording. **Test Bed
  behaviour must not change at all.**
- The Reference tab round, reopening a loss, the open-decisions table
  convention. Queued separately.
- Rule 7, the `~1s` panel window, the loss reason display, `approver_id`
  resolving to nobody.
- `product_defaults` and Section 6. The business raised admin-held unit,
  hosting and installation cost defaults during this design conversation.
  **That is Section 6, already recorded as unbuilt, and it is not this work.**
- Client-owned cloud. Raised and parked by the business as a commercial-model
  fork rather than a field.

---

## Output format

1. **I1 through I5**, each with the command run, the actual output, and the
   finding.
2. **The track-versus-lens mapping**, reported as a finding if Organisational
   has no approver.
3. **The multi-round plan**, with the argument for any departure.
4. **Anything in the design that cannot be built as stated.** This design was
   settled in conversation without repository access, and output item 4 has
   caught the brief's central premise being wrong twice in four rounds.
5. **Any disagreement between a generated file and a hand-written one**,
   reported and not resolved. The spreadsheet discrepancy above is already
   known; report any others.

Then stop and wait for sign-off.

---

## Standing rules with live traps here

- **Verification 17.** Six probe faults were self-caught in Round 22 alone.
- **Build discipline 2.** Confirmed is not verified.
- **Architecture rule 8.** Four cases of Test Bed-specific code silently doing
  nothing for Opportunity were found in Rounds 21 and 22. The scoring write
  path is a fifth candidate and is already known to be Test Bed specific.
- **Architecture rule 9.** A destructuring parameter list is an allowlist that
  silently discards what it does not name.

---

## Round 24 outcome, Round A of the multi-round plan

Seven stages of work, 0 through 6, plus this close-out. Round A was the
mechanism round: it built no Opportunity feature and was never meant to. Its
whole constraint was that Test Bed does not change, and it did not.

### Rule 7 returned zero for a new reason

`grep -c "^## Phase\|^### Phase"` returns **0** against this brief, calibrated
at **5** against `ROUND18A_FIX_BRIEF.md`. That is the fifth consecutive round
the rule has failed, after three zeros and Round 22's plausible 1.

**This time the zero is correct and the rule is asking the wrong question.**
This brief deliberately contains no phase list. It commissioned an
investigation that produced a MULTI-ROUND PLAN, and Round A's phase list was
written in the Phase 0 report and signed off in conversation. There is nothing
in the brief for the rule to count, and there should not be.

So the rule's premise, that a round's phase list lives in its brief as
headings, has now failed in two distinct ways: briefs that carry the list as a
table, and briefs that carry no list because the round was planned elsewhere.
Counted from the commits: phases 1 through 6, each signed off in the session
transcript, plus this close-out. This report does not sign off its own stage.

### What Round A built

| | |
|---|---|
| 1 | `scoring_lenses`, four rows, and a NULLABLE `scoring_criteria.lens_id` |
| 2 | `scoring_scales` and `scoring_scale_levels`, a nullable `scale_id`, and the two hardcoded `[1,2,3,4,5]` arrays derived from them |
| 3 | `reason_required` per level, replacing an inline `score <= 2`, plus `src/lib/scoring-levels.js` |
| 4 | Nothing. Binary was already expressible after 2 and 3. The stage looked instead, and found a defect three stages old |
| 5 | `scoring_criterion_stages`, separating visibility from requirement |
| 6 | `assessment_current`, the rollup rule, built and exercised on a synthetic record type |

### The defect Round B must not inherit

**The anchor block renders the level LABEL in a slot styled for a single
character.** Introduced in Round A stage 2, when the anchor row's number span
changed from `${n}` to `${label}`.

**It is pixel-identical for Test Bed and broken for every word-labelled
scale.** Test Bed's labels are "1" to "5", so nothing shows. The Deal
assessment's are "Not applicable", "Our hypothesis", "Buyer confirmed": each
wraps onto two lines inside a narrow green numeric badge and collides with the
wording column beside it. That is EVERY scale the Deal assessment will use,
not only the binary one.

Architecture rule 8 in its exact shape, introduced in a stage that was signed
off, and invisible until something rendered a scale that did not exist yet.
**Named here for Round B's list rather than left to be rediscovered**, because
Round B rebuilds that panel and "it gets fixed anyway" is how a known defect
becomes a rediscovered one.

### Three more findings from looking at binary

- **The vocabulary splits.** A binary through the score path prompts
  "Score..." and reads "Not scored". The hardcoded `measurabilityConfirmed`
  block prompts "Confirm..." and reads "Not confirmed". Two binary criteria in
  one card, using different words for the same act. **This is a decision, not
  a fix**: when `measurabilityConfirmed` becomes a row, both cannot stand, and
  it should be decided rather than settled by whichever renders last.
- **An unanchored binary renders as broken**: two empty anchor rows and the
  literal "Version null". That case is reachable, because `INVARIANT 8` only
  requires anchors for GATED criteria and this round separated visibility from
  gating.
- **The two treatments read as different features.** Yes/No with no anchor
  block beside Not confirmed/Confirmed with one.

### A probe species with five instances, named and not yet ruled on

Verification 17 covers a probe that cannot tell two states apart. **This is a
different thing: a probe running against a THIRD state nobody meant to
measure.** It does not report a wrong answer about the right subject; it
reports a right answer about the wrong one.

1. **The 401 hashed as a baseline.** A response body hashed for a
   byte-identical comparison, where the body was `{"error":"unauthorized"}`.
   Two such hashes match perfectly.
2. **The expired session in Round 22**, which surfaced as
   `contacts.find is not a function` rather than as an auth failure.
3. **The stale token that produced an empty fixture id**, so a browser probe
   ran against a record id of `""` and reported cleanly on a page that had
   loaded nothing.
4. **The `--watch` contaminated baseline.** The dev server had already loaded
   the edited route against the un-migrated schema, so the "before" capture
   was a 500: neither the before state nor the after state.
5. **The 401 labelled ALLOWED**, and the worst of the five, because it printed
   four consecutive clean passes on a gate that was never reached.

**No rule proposed.** Five instances is worth naming before anyone decides
what to do about it, and four of the five were caught only because the probe
happened to print a status or a length alongside its verdict.

### Two mechanisms, one visible outcome

Stage 6 case D returned **403 and it was not the gate**. The rollup passed and
the write was refused afterwards, which reads exactly like the rollup failing.

The cause is worth carrying into Round B by itself: **the API test user is a
different account from the owner of the live records**, `266a2812` against
`75425a02`. A fixture created with the wrong owner passes every gate and then
fails at the write, and Round B creates fixtures constantly.

### Recorded rather than encoded

`scoring_anchors.score` carries `check (score between 1 and 5)`.
**`scoring_scale_levels.value` deliberately carries no such check.** A scale
using values outside that range can therefore exist and cannot carry anchor
wording. Adding a second 1-to-5 check would have looked considered while
making the constraint harder to lift, and both seeded scales sit inside the
range. Named in the migration, where the next person meets it.

The same choice was made twice more this round, and it is becoming the round's
habit: the missing instrument discriminator on `assessment_current` is
recorded in that migration, and the reason for the nullable `lens_id` in its
own.

### The generated file's blind spot is now five tables and two columns wide

`CURRENT_STATE.md` cannot see:

- `closed_lost_reasons`, from Round 21
- `scoring_lenses`
- `scoring_scales`
- `scoring_scale_levels`
- `scoring_criterion_stages`

Four of the five appear once each, as a migration FILENAME. **`scoring_scale_levels`
appears zero times**, because its name is not in a filename: it is created
inside the scales migration.

**The blind spot has a second shape nobody had named.** The generator fetches
**eleven tables by name**, and it fetches `scoring_criteria` with an explicit
seven-column list. So `lens_id` and `scale_id`, both added this round to a
table the file DOES dump, are equally invisible. It is not only unknown tables;
it is unnamed columns on known ones.

A file whose stated job is recording what is configured now omits five
configuration tables and two configuration columns. Not fixed here.

### Open decisions in `OPPORTUNITY_DESIGN.md`

**Seven bolded rows, none claiming Confirmed**, asserted individually:

1. Revision event: series plus approval plus re-score as one thing
2. Deal Sheet freeze point after the stage compression
3. Staff fields have no server-side validation
4. `Account` is a third staff-field surface
5. Base Cost Data catalog
6. One stage vocabulary under four column names, joined by nothing
7. `approvals.comment` unused on all 229 rows, `tier` null on all 229

**The table has two conventions for open and they disagree at seven versus
ten**, found in Round 22 and unchanged. Twenty-one rows, seven bolded, and
three further rows marked Undecided without bolding: Deal assessment criteria,
Risk assessment criteria, and **Is a loss reversible**. The third governs
wording already shipped.

Row 7's own figure is now stale: `approvals` holds **326** rows, not 229. The
claim survives, `comment` is non-null on **0 of 326** and `tier` on 0 of 326,
and no rejection has ever been recorded. The number is a document-versus-data
drift rather than a wrong claim.

### Reconciliation

`CURRENT_STATE.md` regenerated at `24d13cf`. Eight tracked configuration
sources changed, five migrations and three routes. Every diff line is
accounted for:

- **Migrations 64 to 69**: the round's five, one per stage that shipped one.
- **Registered routes 60 to 60**: unchanged, correct. Three route FILES were
  edited and no endpoint was added or removed.
- **Live records 94, unchanged.** Every fixture this round created was torn
  down and re-queried.
- **Soft deleted 10068 to 10624**: suite runs and stage fixtures.
- **`approvals` 229 to 326**: fixture approvals from Round 22's walks and this
  round's, none on a live record.
- **One live Opportunity moved from Solution Alignment to Closed Won.** This
  is the business's own record, walked on 2026-08-22, and the previous
  generation predated it.
- **No new sections.** Explained above, and the finding rather than an
  omission.
