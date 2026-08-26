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
