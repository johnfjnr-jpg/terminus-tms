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
