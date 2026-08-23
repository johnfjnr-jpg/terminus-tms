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
