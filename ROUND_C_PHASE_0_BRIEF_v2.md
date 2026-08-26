# Round C: the remaining lenses

## Phase 0, investigation and plan

**Round number to be confirmed against the repo.** Round 32 merged to `main`
at `6ffe6a5`.

**This brief supersedes an earlier draft of Round C** written before Round 32.
Two things it left open are now settled and folded in: the level hover is
general and `OPP_HOVER_DEFINITIONS_KEY` is retired, and the exit panel carries
four lens rollups. **Do not work from the earlier draft if a copy is in the
repo; report it if one is.**

---

## What this phase is

**Investigation and a plan. No file edits, no migrations, no code, no
configuration changes.**

---

## What this round is

**The round that has been waiting since Round B**, held behind a gate the
business has now closed: *"The panel is easy to use now."*

Four rounds held it and each was right. Round 28 found the panel tiring, Round
29 found the controls in the wrong place, Round 30 found 217px of undeclared
margin and a rejected approach documented in Round 12's own code and taken
anyway, Round 31 found a card that had been lying since Round 25, Round 32
found a question nobody could locate and three of four lenses reading
"None at this stage".

**Configuring twenty-three criteria into any of those panels would have built
the problem four times larger.**

**Most of this round is rows.** That is what Round B's split was for: prove the
seam once, configure against it after. The seam is proven and has been used on
a real deal.

**Two things in it are not rows**, and they are why this is not one
configuration phase.

---

## What Round 32 settled that this round inherits

| | |
|---|---|
| The level definition hover | **General**, all seven criteria. `OPP_HOVER_DEFINITIONS_KEY` retired |
| The criterion question | On a hover popup with a dotted underline and `cursor: help`, plus `aria-describedby` |
| The exit panel | Four lens rollups, **stage scoped**, three states, **a display not a gate** |
| Rollup wording | A fraction, not a tick. `Commercial 1 of 1`, and `None at this stage` where a lens has no criteria at that stage |
| Satisfied | Every criterion at **Not applicable, Buyer confirmed or Verified** |

**Three of four rollups read "None at this stage" until this round.** That is
what it is clearing.

---

## The twenty-three

**Twenty-five in the superset, minus two.**

**Strategic fit** and **Reference deployment requirement** were settled in
Round 26 as **creation checks**, answered when the opportunity is created and
gating nothing. **They belong to Round D** and are out of scope.

**Champion identified moved** from Solution Alignment to Qualification in Round
26, because a deal with no champion is not qualified. **The spreadsheet has not
been updated.** Work from this brief and report the discrepancy rather than
resolving it silently.

| Lens | Total | Evidence state | Binary |
|---|---|---|---|
| Organisational | 8 | 8 | 0 |
| Technical | 7 | 6 | 1 |
| Legal | 8 | 0 | **8** |

### Stage allocation

**Qualification**: Economic Buyer identified, Prioritisation, Trigger event /
timeline, Champion identified, Need / problem definition, Procurement route and
compliance. **Six**, joining Commercial's Budget confirmed for seven.

**Solution Alignment**: Buying committee mapped, Decision process, Internal
pain owner, Political dynamics, Decision criteria, Solution fit, Integration
complexity, Delivery feasibility, Pilot or proof-of-concept requirement, Data
and architecture requirements, Paper process, Export control and licensing
status, Data protection and residency, Liability insurance and indemnity, Local
content or offset requirements, Anti-corruption and integrity due diligence.
**Sixteen.**

**Proposal**: IP ownership and licensing terms. **One.**

---

## The two things that are not rows

### Nine binary criteria, and Opportunity has never had one

All seven configured Opportunity criteria are evidence-state.

Round A Phase 4 rendered a binary through the score path in a probe and shipped
no diff, recording four findings. **Three are stale and one is a decision:**

| | |
|---|---|
| The anchor-label defect | Fixed in Round B Phase 1 |
| An unanchored criterion rendering as blank rows and "Version null" | Fixed in Round B Phase 6, disabled with a stated reason |
| The two treatments reading as different features | **Open**, and Round 30 rebuilt the row entirely since |
| The vocabulary | Round B Phase 6 chose **"Assess..."** and **"Not assessed"** as the destination, deliberately a third string with the reconciliation owed |

**Round 30 replaced the select with a five-segment control and Round 32 gave
every segment a hover.** What a two-segment version of that looks like has
never been seen, and Round A's findings describe a panel that no longer
exists.

### The binary scale carries no descriptions

Round 31 Phase 0 measured `scoring_scale_levels`: seven rows, five with a
description and **two without — the Binary confirmation scale**.

The five-level descriptions were written by the business in Round 28. **The
binary scale's two have never been written**, and nine criteria need them.

---

## Anchor drafting: the rule

**Confirmed with the business:** *"Code can write it, we can correct later."*
That is what happened for the Commercial seven, which they then judged in use
and had the middle three retired from in Round 30.

The superset carries a **Strong evidence** column and a **Weak evidence / red
flag** column per criterion. Those are the two ends.

**Round 30's split is the template, not a rule.** It kept per-criterion wording
at **Not applicable** and **Verified** and retired the middle three to the
generic scale descriptions, on the reasoning that the step from hypothesis to
confirmed is *who said it*, which is the same for every criterion.

**That split was arrived at by reading the seven Commercial anchors side by
side.** The same reading must happen for these, and it may come out
differently.

| Level | Source |
|---|---|
| Not applicable | **A judgement per criterion.** When is this legitimately not applicable? Two of the Commercial seven say *rarely applicable*, constraining its use where the dishonest answer is most tempting |
| Unknown | Generic, unless the criterion has a diagnostic cue. Metrics kept one |
| Our hypothesis | Generic |
| Buyer confirmed | Generic |
| Verified | **The Strong evidence column rewritten as a state.** What counts as corroboration genuinely differs |

**No `PROVISIONAL` prefix.** Round 31 retired it from all 35 Commercial anchors
as version 2, on the business's decision.

**Report the count before writing.** Fourteen evidence-state criteria at five
levels is seventy rows if every one gets per-criterion wording; Round 30's split
makes it twenty-eight. **The nine binary criteria need two levels each, not
five.**

---

## Investigations

### I1. What a binary criterion looks like in the Round 30 row

**Build a probe criterion and look at it.** Round A Phase 4's findings predate
the row entirely.

Report against the current row: segment widths, whether two segments in a
control sized for five reads as one control or as two chips, what the hover
shows, and what the reason and value cells do.

**Report the vocabulary.** Round B Phase 6 named "Assess..." and "Not assessed"
as the destination. Report what the row says today for an unassessed criterion
and whether a binary needs different words.

### I2. The binary scale's descriptions

Report the two levels as configured and what they would need to say. The
five-level descriptions read: *Not applicable / Unknown at this time / Our
hypothesis, a Terminus assumption / Buyer confirmed, stated by a named person /
Verified, evidenced, corroborated or documented.*

**A binary is a different kind of claim.** Propose wording. **Do not choose;
the business writes or corrects it.**

### I3. The rollups at real counts

Round 32 built them against Commercial alone, with three lenses reading "None
at this stage".

**Report what each rollup reads at each stage once configured**, and whether
the fraction still explains itself at sixteen criteria on one stage.

**Report the satisfied mapping against binary criteria.** A binary has two
levels. **Which one satisfies?** Confirmed satisfies and Not confirmed does
not is the obvious reading, and obvious is not a reason — a binary has no Not
applicable, so a criterion that genuinely does not apply has nowhere to say so.
**That is a real question and it may change the binary scale's design.**

### I4. The panel at eight criteria per lens

**Measure, do not estimate.**

Criteria are visible from introduction through Negotiating, so the deepest
stage shows the most. Report the per-lens count at each stage and the panel
height for the largest.

Round 30 measured seven at **461px at rest and 530px drafting at 1920**, 769
and 838 at 1240, re-measured by Round 31 and Round 32. **Report what eight
does.**

**Report the longest criterion name and question.** Round 30 sized the
criterion cell to 258px for "Competition, including do-nothing" at 227px, and
found one row at 86px against the others' 66 when that arithmetic was wrong by
8px. **"Anti-corruption and integrity due diligence" and "Pilot or
proof-of-concept requirement" are both longer.**

### I5. The rollup property nobody has met yet

**Report, do not build.**

Round A built `assessment_current` cumulatively and Round B deliberately
inserted **zero rows**, with the property that a rule requiring seven today
would silently require thirty after this round.

**That property is now live.** Record it for the round that ever inserts one.

### I6. What the design cannot express

**Output item 6 has caught the brief's central premise being wrong five times
in twelve rounds**, most recently the lens-wide satisfaction rule that
disagreed with itself on live data.

---

## The plan to produce

Suggested shape, argue with it:

| Phase | Content |
|---|---|
| 0 | This investigation |
| 1 | The binary scale's descriptions, per I2 |
| 2 | A binary criterion in the row, per I1 |
| 3 | Organisational configured |
| 4 | Technical configured |
| 5 | Legal configured |
| 6 | Full walk and close-out |

**Legal is eight of eight binary**, so Phase 5 depends entirely on Phases 1 and
2. That ordering is deliberate.

**Argue with it.** If I1 shows a binary reads badly in the row, Phase 2 grows
and Legal waits behind it. If the three lens phases are genuinely identical
work, they may merge.

---

## Verification requirements

**Measure the panel at every phase that adds criteria**, at 1240, 1920 and
3440, against Round 30's numbers **re-measured rather than quoted**. Round 30
Phase 0 found the numbers it inherited measured a state the business never
sees.

**Measure the exit card too.** It is 420px wide at all three widths and Round
32 grew it 152px with three lenses empty.

**Look at every lens once configured.** Round 31 Phase 1 found an unfilled live
card and an unwired placeholder are both 60px of title; Round 30 found
`overflow` clips at the padding box after two correct measurements said the
geometry was fine; Round 32 found a question arriving at 4.83:1 against 15.29:1
six pixels above.

**Anchors are a migration.** `scoring_anchors` declares only a select policy;
an API update returns `error: none, rows affected: 0`, reporting success and
changing nothing.

**INVARIANT 9 must pass and be shown capable of failing.** Round 31 Phase 2 did
this by injecting an entry stamped at a nonexistent version.

**Calibrate on the kind of change each phase makes.** Recorded variants: blind
for one phase, half-inert from selector specificity, half-matched from a
structural assumption, wrong kind of change rather than wrong place, the
obvious dimension correctly being the wrong one, an injection landing where the
probe does not scan, and Round 32's three-way blind check where a page had none
of the elements under test.

**Verification 18 applies directly:** one green result may have several
independent causes, each visible only after the previous is fixed.

**No probe prints a conclusion it has not computed.** Three instances in two
rounds.

**Capture the whole run, never through a filter.** Round 31 Phase 4's `grep`
removed the `PAGE EXCEPTION` line the same run printed; Round 32 killed a run
by piping through `head`.

**Waits must be counterfactual-safe.** Round 32's walk produced two apparent
product defects from a wait already satisfied by the previous render.

**Enumerate teardown from the database by this round's tag**, and check the
extractor reads the field it thinks it reads. Round 32's residue sweep filtered
on a nested field and would have returned zero however much residue existed.

**Test Bed pixel-identical**, on a page that contains the elements under test.

---

## Explicit non-goals

- **Creation checks.** Strategic fit and Reference deployment requirement.
  Round D.
- **Inserting `assessment_current` rollup rules.** Report the property.
- **The Risk assessment.** Not designed.
- **Coverage and confidence, reason on incomplete approval.** Round D, with
  Round 32's per-lens refinement recorded.
- **`measurabilityConfirmed`** and the three-string vocabulary reconciliation.
- **The value's treatment beyond Budget confirmed.** The business: *"We can
  work on the particular value to be recorded for the assessments later."*
- **A roving tabindex for the segments.** Recorded, not fixed.
- The app-wide `<p>` reset and its 119-of-225 census, Terminus Documents
  leading the row, the Closed Lost hover wording, the Reference tab round,
  reopening a loss, the open-decisions convention, the approval snapshot, the
  eight remaining undocumented mechanisms.

---

## Output format

1. **I1 to I6**, each with the command run or the interaction performed, the
   actual output, and the finding.
2. **The I1 verdict, with a capture**: does a binary read in the current row.
3. **The I2 proposal**, for the business to write or correct.
4. **The I3 answer on Not applicable**, which may change the binary scale.
5. **The anchor row count**, before anything is written.
6. **The phase plan**, with the argument for any departure.
7. **Anything that cannot be built as stated.**

Then stop and wait for sign-off.

---

# Phase 0 report

Round 33, 2026-08-26. Branch `round-33-remaining-lenses`, cut from `main` at
`afbddee` after the brief was committed. Server restarted from that tree, token
refreshed.

**No configuration changed.** Re-queried at the end: `scoring_criteria` 12 rows
as before, `scoring_scale_levels` 5 of 7 carrying a description as before,
`scoring_anchors` 85. Every probe in this phase was a **client-side injection
into `oppCriteria`**, which goes through `renderOppAssessCriterion` unchanged
and touches no table.

**No earlier Round C brief exists.** Checked four ways before the brief was
committed and reported then: no filename match in the working tree, no `*_v2*`
file of any kind, no path matching `round_c` in 46 branches or all of history,
and no markdown file carrying "remaining lenses" other than
`OPPORTUNITY_DESIGN.md`. The instruction's superseded-brief line was itself the
sixth instance of output item 7.

---

## I1. What a binary looks like in the Round 30 row

**The injection is faithful.** The probe object was asserted to carry exactly
the API's key set for a real criterion (`id, record_type, criterion_key, name,
asks, sort_order, rescore_through_stage, scale_id, lens_id, levels, stages,
anchors, current_version`), and it does.

### The control

| | Five-level | Binary |
|---|---|---|
| Level group | 453px | **179px, 40%** |
| Segments | 103, 72, 106, 114, 61 | 101, 79 |
| Row at 1240 / 1920 | 110 / 66 | 130 / 86 **when the name wraps**, 109 / 65 when it does not |

**The 20px is the NAME, not the control.** Both probes carried a binary; the
one that measured 130/86 was "Export control and licensing status" at 232px in
a 230px slot. That is I4's problem appearing inside I1's, and it is worth
separating because the obvious reading is that a binary row is taller.

### The finding: a binary breaks the grid, but only in a lens that mixes

Round 30's stated purpose for three fixed columns was that *every name starts
at the same x, every level label ends at the same x, every control sits in the
same place.* A 179px group in a row sized for 453px satisfies the first and
breaks the other two.

Measured at 1920, distinct left edges of the reason column within one lens:

| Lens | Composition | Reason column starts at | |
|---|---|---|---|
| Organisational | 8 five-level | `[739]` | aligned |
| **Technical** | **6 five-level, 1 binary** | **`[739, 465]`** | **broken, 274px apart** |
| Legal | 8 binary | `[465]` | aligned, at a different x from the others |

**Looked at, the Technical lens is the one that reads as a defect.** Six rows
carry a joined five-segment bar ending at the same x with the reason beginning
just after it; the seventh has two small chips and a reason field starting
350px further left. It does not read as a different kind of criterion, it reads
as a broken row.

**Legal, all eight binary, reads perfectly well.** Two chips are legible as a
control when every row has them. So the defect is not "binary in the row", it
is **binary and five-level in the same lens**, which is exactly what Technical
is and what Round 24 says Legal may also be.

At 1240 the question does not arise: the reason wraps to its own line on every
row, so all left edges read 0.

### Unanchored

Round B Phase 6's treatment holds unchanged for a binary: `data-unanchored`
set, both inputs `disabled`, the reason cell `disabled`, and the level hover
withheld. It is the state every one of these criteria is in between its
`scoring_criteria` row and its anchors migration.

### The vocabulary, and it is worse for a binary

**The row says nothing at all for an unassessed criterion.** `OPP_ASSESS_NONE`
is "Not assessed" and lives in the collapsed detail region's "This assessment"
section, not on the row. Round 30 Phase 4's comment says the segments *"say a
criterion is unassessed, but they say it by silence."*

**Silence is legible against five levels and nearly illegible against two.**
Nothing selected among Not applicable / Unknown / Our hypothesis / Buyer
confirmed / Verified can only mean "no judgement". Nothing selected among **Not
confirmed / Confirmed** means "no judgement" but reads as "not confirmed",
which is a claim the record has not made. **The unassessed state and the
negative state are one keystroke and no pixels apart.**

That is a vocabulary problem the five-level scale does not have, and it is the
same problem I3 raises from the other end.

---

## I2. The binary scale's descriptions, proposed not chosen

**Live, read from `scoring_scale_levels` rather than from the migration:**

| Value | Label | `reason_required` | `description` |
|---|---|---|---|
| 1 | Not confirmed | false | **NULL** |
| 2 | Confirmed | false | **NULL** |

Zero criteria point at this scale. The five-level scale has 5 of 5
descriptions, so the null count is a measurement rather than a broken read.

### The structural consequence nobody has named

`wordingFor = anchorSet[l.value] ?? l.description ?? ''`.

**Round 30's split works because the five-level scale has generic
descriptions to fall back to.** It retired the middle three per-criterion
anchors and the hover still says something, because the scale supplies it.

**The binary scale supplies nothing.** A binary criterion without per-criterion
anchors at both levels renders an empty hover box. So either the two
descriptions get written, or **all nine binary criteria must carry
per-criterion anchors at both levels, with no split available.**

### Proposed wording, for the business to write or correct

Offered because the brief asks for a proposal. **Not a decision.**

| Value | Label | Proposed description |
|---|---|---|
| 1 | Not confirmed | *Not established, or established and negative* |
| 2 | Confirmed | *Established as true, by a named source or a document* |

The five-level set describes **who says so** and rises through it. A binary
describes **whether it is settled**, so the proposal names the source at the
positive end only, and deliberately makes level 1 carry two meanings, because
the scale as configured has nowhere else to put them. **That doubling is the
problem I3 describes, and it is why the wording proposal should not be settled
before the I3 decision.**

---

## I3 and I5, one finding on two surfaces

**Both are a set growing underneath a rule, and neither surface can see the
other.**

### The gate side, already recorded

`OPPORTUNITY_DESIGN.md:750`: `assessment_current` resolves its set at
evaluation time, so *"a rule requiring seven criteria after the Commercial lens
is configured requires thirty-two once the remaining lenses land. A record that
satisfied the gate one week fails the next, and nothing in `stage_gate_rules`
will have changed to explain it."*

**Zero such rows exist and none is inserted this round.** The property is now
live in the sense that the set it would resolve over is about to quadruple.
Measured: a rule written today against Qualification would resolve over **1**
criterion in Commercial and **7** after this round.

### The display side, new

The rollup satisfies on Not applicable, Buyer confirmed or Verified. **A binary
has no Not applicable.** Under the rule as it stands, `Confirmed` satisfies and
`Not confirmed` does not, so a criterion that genuinely does not apply to a
deal has nowhere to say so and **reads as unsatisfied for the life of the
record.**

Nine criteria are binary, and the ones most likely not to apply are exactly the
Legal eight: export control on a domestic deal, local content on a deal with no
offset regime, anti-corruption diligence on a deal with no intermediary.

**A Legal rollup that can never reach 8 of 8 stops being read.** That is the
same failure the criteria informed rather than gated to avoid, arriving through
the display instead.

### The recommendation

**Yes, the binary scale should change before nine criteria are configured
against it, and the cheapest correct change is a third level.**

| Value | Label |
|---|---|
| 1 | Not applicable |
| 2 | Not confirmed |
| 3 | Confirmed |

**Why a third level rather than a rule exception.** The satisfying set is
already `{Not applicable, Buyer confirmed, Verified}` by value. Adding Not
applicable at value 1 on the binary scale makes the existing rule correct for
both scales with **no special case in `oppLensRollup`**, no second computation
path, and the same word carrying the same meaning on both scales, which is what
Architecture rule 3 asks for.

**Why now rather than later.** `scoring_anchors` is append-only and a new level
means every binary criterion needs an anchor at it. Nine criteria configured
against a two-level scale and then migrated is nine `scoring_criteria` rows,
eighteen anchors and a version bump; done first it is one migration and
twenty-seven anchors written once.

**Why this is a decision and not a build detail.** It renames the scale: a
three-level "Binary confirmation" is not binary. Round 24 recorded *"binary
criteria remain two-state"* as a decision, and this reverses it. It also
reopens whether the ninth criterion, Technical's single binary, should be
binary at all.

**The counter-argument, stated fairly.** The doubled meaning could stay and
"Not confirmed" could be read as "not established either way", with a reason
carrying the nuance. That costs nothing now and makes every Legal rollup read
short forever, and the business would be reading a number they know to be
wrong. Round 26 chose a manual tick over a computed rollup precisely to avoid
a number nobody trusts.

---

## I4. The panel at real counts

**Per lens, per stage, once configured**, computed from the mapping below and
measured in the live panel, identical at 1240, 1920 and 3440:

| Stage | Commercial | Organisational | Technical | Legal |
|---|---|---|---|---|
| Qualification | 1 | 4 | 1 | 1 |
| Solution Alignment | 6 | 8 | 7 | 7 |
| Proposal, Evaluation, Negotiating | 7 | 8 | 7 | 8 |

**No lens ever shows sixteen.** The brief asks whether the fraction still
explains itself at sixteen criteria on one stage; sixteen is the count of new
criteria introduced at Solution Alignment across all lenses, and **the largest
any single lens reaches is eight**. `0 of 8` explains itself exactly as `0 of
7` does.

### Panel heights, re-measured rather than quoted

Against the seven Commercial criteria measured live in the same run at 769px
(1240) and 461px (1920 and 3440):

| Lens | Criteria | 1240 | 1920 / 3440 |
|---|---|---|---|
| Commercial, today | 7 | 769 | 461 |
| Organisational | 8, none wrapping | **879** (+110) | **527** (+66) |
| Technical | 7, two wrapping | **809** (+40) | **501** (+40) |
| Legal | 8, four wrapping | **959** (+190) | **607** (+146) |

**Legal is the tallest panel** and 8 criteria alone do not explain it: 190px at
1240 against Organisational's 110px for the same count. The difference is four
wrapped names at 20px each.

### The names, and six of them do not fit

The criterion cell is 258px and the name gets **230px** of it. Measured in the
row's own font:

| Width | Name | Stage |
|---|---|---|
| **281px** | Anti-corruption and integrity due diligence | Solution Alignment |
| 247px | Pilot or proof-of-concept requirement | Solution Alignment |
| 241px | Local content or offset requirements | Solution Alignment |
| 237px | Data and architecture requirements | Solution Alignment |
| 236px | Procurement route and compliance | Qualification |
| 232px | Export control and licensing status | Solution Alignment |

**Six of twenty-three exceed 230px.** Today **zero of seven** do, and the
widest live name is "Competition, including do-nothing" at 227px, which is what
Round 30 sized the cell to. The widest new name is **54px wider than the cell
was designed for**.

Widening the cell to fit 281px costs 51px from the reason column at every
width, on every row, for one criterion. Accepting the wrap costs 20px of height
on six rows. **Neither is obviously right and the phase that configures Legal
should decide it with the panel in front of it.**

---

## I6. What the design cannot express

### 1. The brief never states which lens each criterion is in

The lens table gives totals: Organisational 8, Technical 7, Legal 8. The stage
allocation gives 23 names across three stages. **There is no join between
them**, and Phases 3, 4 and 5 are named per lens.

**It is derivable, but only by arithmetic and only with two guesses.** Legal's
eight are nameable with confidence. Organisational must take 4 of the 10
remaining Solution Alignment names and Technical 6, which forces **"Decision
criteria" into Technical**, where it reads oddly. And Technical's single binary
is not identified anywhere; "Pilot or proof-of-concept requirement" is the only
plausible candidate.

Every measurement above uses that derived mapping. **It should be confirmed
before Phase 3, not assumed.**

### 2. Round 24 and this brief disagree about Legal

`DEAL_ASSESSMENT_PHASE_0_BRIEF.md:112`: *"Six of the Legal seven are binary."*
Seven Legal criteria, one of them not binary.

This brief: Legal 8, **0 evidence-state, 8 binary**.

**Both cannot be true**, and the difference is exactly the criterion that would
make Legal a mixed lens, which I1 shows is the only composition that breaks the
grid. If Round 24 is right, Legal breaks the same way Technical does and Phase
5 inherits Phase 2's fix; if this brief is right, Legal is safe and only
Technical needs it.

### 3. Round 24 defers a value on three binary criteria

`DEAL_ASSESSMENT_PHASE_0_BRIEF.md:149`: *"Three binary criteria carry an answer
as well as a confirmation: procurement route is open tender or sole source or
framework, data residency is PDPA or GDPR or local."*

This round's non-goals put the value beyond Budget confirmed out of scope,
which is right. **Recorded because two of those three are being configured this
round**, and the deferral is easier to honour deliberately than to rediscover.

### 4. The brief's own output numbering is off by one

I6 says *"Output item 6 has caught the brief's central premise being wrong"*
while the output list makes item 6 the phase plan and item 7 the premise check.
Round 32's brief had the same off-by-one in the same place. Harmless, and worth
one line because it is now twice.

### 5. "Champion identified", as the brief instructs, reported not resolved

Round 26 moved it from Solution Alignment to Qualification and the spreadsheet
was never updated. This brief places it at Qualification, consistent with Round
26 and with `DEAL_ASSESSMENT_PHASE_0_BRIEF.md:108`. **The discrepancy is with
the spreadsheet only**, and it is reported rather than resolved.

---

## The anchor row count, before anything is written

| | Criteria | Per criterion | Rows |
|---|---|---|---|
| Evidence-state, all five levels per criterion | 14 | 5 | 70 |
| Evidence-state, Round 30's split | 14 | 2 | **28** |
| Binary, **no split available** | 9 | 2 | **18** |
| Binary, if a third level is added | 9 | 3 | 27 |

**Minimum as the scales stand: 46 rows.** Maximum without the split: 88.

**The nine binary rows are not optional**, whichever way the split question
goes, because the binary scale has no generic descriptions to fall back on.
That is the asymmetry to carry into Phase 1: writing the two scale descriptions
is what would make a split possible at all.

---

## The phase plan

The brief's shape survives with **one insertion and one reordering**, and both
follow from I1 and I3.

| Phase | Content |
|---|---|
| 0 | This investigation |
| **1** | **The binary scale: the Not applicable decision, then its descriptions** |
| **2** | **The row: one control width, so a mixed lens keeps its grid** |
| 3 | Organisational configured, 8 criteria, 0 binary |
| 4 | Technical configured, 7 criteria, 1 binary, the mixed lens |
| 5 | Legal configured, 8 criteria, 8 binary |
| 6 | Full walk and close-out |

**Phase 1 grows to carry the I3 decision**, because the scale's shape must be
settled before its wording is written: a third level changes what level 1 says.
The brief had Phase 1 as wording alone.

**Phase 2 is now a fix rather than a look.** The brief framed it as *"a binary
criterion in the row"* with *"if I1 shows a binary reads badly, Phase 2 grows"*.
I1 shows it reads badly in exactly one composition, and the repair is a width
on `.opp-assess-levels` so a two-segment group occupies the column a
five-segment one does. That is small, and it must land before Phase 4.

**Phases 3, 4 and 5 are not identical work and should not merge.** Phase 3 is
eight ordinary criteria and is the one to establish the anchor drafting rhythm
on. Phase 4 is the only mixed lens and is where Phase 2's fix is proven. Phase
5 is eight binaries, four wrapped names, and the tallest panel in the
application.

**Ordering unchanged: Legal last.** The brief's reason holds and I1 strengthens
it.

---

## Anything that cannot be built as stated

1. **Phases 3, 4 and 5 cannot start without the lens mapping**, which the brief
   does not contain. Derived above; confirm before Phase 3.
2. **The Legal binary count is contradicted by Round 24.** Eight of eight, or
   seven with one evidence-state. It changes whether Legal is a mixed lens.
3. **The binary scale cannot express "not applicable"**, and under the rollup
   rule that is not a gap in wording but a rollup that can never complete.
   Recommended above; it is the business's decision.
4. **A binary criterion cannot use Round 30's anchor split**, because the scale
   has no generic descriptions. Eighteen anchors are mandatory unless Phase 1
   writes the two descriptions first.
5. **Six of twenty-three names do not fit the criterion cell.** Not a blocker;
   a decision between 51px of reason column and 20px of height on six rows.

---

# The confirmed lens mapping

**Settled with the business at the Phase 0 sign-off.** Phase 0 derived this by
arithmetic from the lens totals and the stage list, because the brief states
both and never states the join. **This table is the join.** Phases 3 to 5 work
from it rather than from the derivation.

Two things the derivation could not settle, now confirmed:

- **Technical's single binary is "Pilot or proof-of-concept requirement".**
- **"Decision criteria" is Technical and evidence-state.**

| # | Lens | Introduced at | Criterion | Scale |
|---|---|---|---|---|
| 1 | Organisational | Qualification | Economic Buyer identified | Evidence |
| 2 | Organisational | Qualification | Prioritisation | Evidence |
| 3 | Organisational | Qualification | Trigger event / timeline | Evidence |
| 4 | Organisational | Qualification | Champion identified | Evidence |
| 5 | Organisational | Solution Alignment | Buying committee mapped | Evidence |
| 6 | Organisational | Solution Alignment | Decision process | Evidence |
| 7 | Organisational | Solution Alignment | Internal pain owner | Evidence |
| 8 | Organisational | Solution Alignment | Political dynamics | Evidence |
| 9 | Technical | Qualification | Need / problem definition | Evidence |
| 10 | Technical | Solution Alignment | Decision criteria | Evidence |
| 11 | Technical | Solution Alignment | Solution fit | Evidence |
| 12 | Technical | Solution Alignment | Integration complexity | Evidence |
| 13 | Technical | Solution Alignment | Delivery feasibility | Evidence |
| 14 | Technical | Solution Alignment | **Pilot or proof-of-concept requirement** | **Confirmation** |
| 15 | Technical | Solution Alignment | Data and architecture requirements | Evidence |
| 16 | Legal | Qualification | Procurement route and compliance | Confirmation |
| 17 | Legal | Solution Alignment | Paper process | Confirmation |
| 18 | Legal | Solution Alignment | Export control and licensing status | Confirmation |
| 19 | Legal | Solution Alignment | Data protection and residency | Confirmation |
| 20 | Legal | Solution Alignment | Liability insurance and indemnity | Confirmation |
| 21 | Legal | Solution Alignment | Local content or offset requirements | Confirmation |
| 22 | Legal | Solution Alignment | Anti-corruption and integrity due diligence | Confirmation |
| 23 | Legal | Proposal | IP ownership and licensing terms | Confirmation |

**Totals reconcile:** Organisational 8 evidence, Technical 6 evidence and 1
confirmation, Legal 8 confirmation. Twenty-three, fourteen evidence-state, nine
confirmation, matching the brief's lens table exactly.

**Technical is the only mixed lens in the system.** Organisational is
uniformly evidence-state, Legal uniformly confirmation, Commercial's seven
uniformly evidence-state. Phase 0 measured that a mixed lens is the only
composition whose reason column fails to align, so **Technical is what Phase 2
exists for and why Phase 4 sits behind it.**

## Recorded against Round 24, not resolved

`DEAL_ASSESSMENT_PHASE_0_BRIEF.md:112` reads *"Six of the Legal seven are
binary."* **Legal is eight of eight.** The business has confirmed it, and the
discrepancy is recorded here rather than corrected in that brief, because both
documents were written from the same superset and the disagreement is evidence
about the superset rather than a typo in one of them.

The count matters beyond bookkeeping: a seventh Legal criterion on the evidence
scale would have made Legal a second mixed lens, and mixed is the only
composition that breaks.
