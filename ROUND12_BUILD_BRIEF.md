# Round 12 build brief: scoring in place, anchors visible, exit criteria split

Source of truth: `CLAUDE.md`, `CURRENT_STATE.md`, `DESIGN_PRINCIPLES.md`,
`PROTOTYPE_SPECIFICATION.md`, `INTERACTION_STANDARDS.md`,
`ROUND11_BUILD_BRIEF.md`, `ROUND11A_FIX_BRIEF.md`. Read all seven before
starting.

Round 11 built the scoring framework and proved it works. This round makes
it usable. Every item came from the business scoring a real prospect and
finding that the instrument was present and unreachable.

Work through phases in order. Stop after each, report real test evidence,
wait for sign-off before starting the next.

---

## Scope boundaries, confirmed with the business

- **No anchor wording changes.** The business review has not happened. Eight
  recorded ambiguities and one structural finding are its input, and
  amending wording now substitutes a build decision for the review the
  framework was designed to receive. Displaying the anchors is this round;
  revising them is not.
- **No new criteria, no threshold changes, no gate rule changes to which
  criteria are required where.** `stage_gate_rules` ends this round
  unchanged at 61 total, 45 on `test_bed`. Phase 7's invariant 1 asserts
  it, so any change fails the suite, which is the intended behaviour.
- **Record history is Round 13.** The per-field change trail and criterion
  authorship surfaced from `audit_log`, requested three times by the
  business, moves behind this round.
- **The cross-tab batch save stays open.** Open item 16. Its remedy is a
  design decision, per-tab save bars or a save that names and links its
  failures, and it is not this round.

---

## Standing rules that bear on this round

`CLAUDE.md` applies in full. Four items bear directly:

1. **Verification rule 7, the counterfactual, and its relocation form.**
   This round moves a panel from one place to another and splits a list in
   two. Both are the shape where a positive check proves nothing: the thing
   appears in its new place, and the thing is gone from its old one.
   **Assert the count. Exactly one instance, not at least one.** Round 10
   shipped a duplicate Summary and a stale wrapper on exactly this.

2. **A walkthrough proves the path it walks.** Round 11A's finding, and it
   applies to every phase here. Before writing a driver, state how many of
   a thing a user would do before saving, and drive that number. The Phase
   8 driver scored one criterion at a time because the code was built that
   way, and the business scored five and pressed Save once.

3. **Layout: measure the container, not the element, and presence is not
   legibility.** Round 11 Phase 4 shipped six correct rows in an unusable
   panel that passed every programmatic check. Open the screenshot.

4. **Display renames stay display renames.** Phase 1 gives the panel a new
   title and a new home. No payload key, endpoint key or column moves.

---

## Phase 0: Investigate and report. No building.

Report before Phase 1 starts. Direct reads of real code and real data.

1. **Where the scoring panel renders today**, and what decides it. Report
   the markup, the renderer, and whether it is one panel referenced once or
   a block that would need duplicating per tab.

2. **How a stage tab decides what to render.** Round 9 Phase 6
   standardised the eight stage tabs and Round 10 Phase 7 added the Closed
   lifecycle panel keyed on last-in-`sort_order`. Report the mechanism, and
   specifically whether a panel can be shown on some stage tabs and not
   others from data rather than from a hardcoded list.

3. **What the exit criteria list currently returns and renders.** Round 9
   Phase 3 changed `GET /records/:id/exit-criteria?stage=` to return every
   requirement with a met flag rather than blocking only. Report the exact
   shape, which fields distinguish requirement types, and how
   `renderTbStageExitCriteria` decides what to draw.

4. **The tab-discard fault.** The business reports that selecting an
   Installer, and separately a Tech Team contact, returns them to the
   Reference tab. Reproduce it, and report the actual mechanism. The
   working hypothesis, to confirm or refute: the save triggers a record
   reload and `loadTestBedDetail()` resets `tbUserPickedTab`. Note that
   this behaviour was observed during Round 11 Phase 1 and read as a probe
   artefact rather than a product fault. **Report every other save path
   that reloads the record**, not just these two. Round 10 Phase 6 fixed
   the same shape for transitions and this is its third instance.

5. **The anchors as data.** Report how `scoring_criteria` and
   `scoring_anchors` are read today, whether any endpoint exposes anchor
   wording to the browser, and what a client would have to call to display
   the three anchors for a criterion at its current version.

6. **The Reference summary's neighbours.** Report the `.ref-cards` grid's
   current members and the `minmax(280px, 420px)` cap, so Phase 3's card
   sits in the existing grid rather than beside it.

7. **Baseline the suite.** `npm test` and `npm run test:db` passing on a
   clean checkout of `main` before anything is touched. Note that
   `PGRST303` has now been observed four times and clears on retry; if it
   fires, check residue before re-running.

---
---

## Amendments after Phase 0

Phase 0 returned three findings against this brief and two corrections that
simplify a phase. All are applied in place below. **The phase order also
changes**, which is the most consequential of them.

| # | Where | What changed |
|---|---|---|
| 1 | Phase order | **The tab-discard fix moves to Phase 1** and everything else shifts down |
| 2 | Phase 1 (was 5) | **Eleven** in-app save paths discard the tab, not two |
| 3 | Phase 5 (was 4) | The classification premise is **refuted**. `TB_EXIT_CRITERION_KEYS` holds only the four legacy tick keys |
| 4 | Phase 2.2 (was 1.2) | `rescore_through_stage` is **not needed**. The gate rules carry the derivation |
| 5 | Phase 3 (was 2) | **No endpoint and no extra request.** The anchors are already fetched and cached |

**Why the reorder, stated as the coupling rather than as a preference.**
`setTbMeasurability` and `recordTbScores` both reload the record, and every
reloading save discards the tab. So moving scoring onto the stage tabs while
that is true ships a panel that **ejects the user every time they use it** -
score a criterion on Site Assessment and land on Reference. The round would
have delivered its headline feature in a state where the feature's own use
undoes the placement the feature exists for. Fixing the discard first makes
the move safe; doing it second means shipping the fault and then removing it.

---

## Phase 1: Saves stop discarding the tab

**Moved from Phase 5 after Phase 0, see the coupling above.**

Selecting an Installer, and separately a Tech Team contact, returns the user
to Reference. The user is on the Installation and Commissioning tab, doing
Installation and Commissioning work, and the application moves them
somewhere else.

### 1.1 The real scope: eleven paths, not two

**AMENDED after Phase 0.** `loadTestBedDetail` has thirteen call sites. One
is genuine navigation and one, the transition path, is already handled by
`tbLandOnStageAfterLoad`. **The other eleven all reset `tbUserPickedTab` and
discard the tab:**

    addTbNote            setTbInstaller       setTbTechTeam
    addTbInstallNote     addTbUseCase         removeTbUseCase
    linkTbBuyer          setTbMeasurability   recordTbScores (both paths)
    saveTbDirtyEntries   saveInlineBuyerContact

**Round 8 Phase 1 recorded six of these. Round 11 added four more**
(Installer, Tech Team, measurability, scores) and none was considered against
this behaviour. Round 10 Phase 6 fixed only the transition path.

**The two the business reported are the two they happened to try.** They were
doing installation work, so they hit Installer and Tech Team. Nothing
distinguishes those two from the other nine, and fixing them specifically
would leave nine instances of a fault the business has already reported once.
**Fix the general case**, per the standing rule that a fix built for the
surfaces that existed is not a fix for the ones added later, now at four
confirmed instances.

### 1.2 What the fix must not trade away

A save that reloads the record must preserve the tab **and still refresh the
data**. Leaving the record stale to preserve the tab trades one fault for a
worse one.

Transitions must continue to land on the stage just entered, per Round 10
Phase 6. That behaviour is deliberate and is not the same thing as a save.

**Test evidence required:** select an Installer from the Installation and
Commissioning tab and confirm the tab is unchanged afterwards. Same for the
Tech Team contact. **Same for every one of the eleven paths**, asserted as a
table rather than on the two reported. Confirm the record's data is genuinely
refreshed after each save. Confirm transitions still land on the stage
entered.

**A note on driving this.** Phase 0's first probe reported six of seven paths
as KEEPING the tab, because it saved before the stage tab's own async load
had settled. Controlled for with a 2s settle it is 5/5 discarded, and 3/3
kept without one. **Let the tab settle before acting**, or the probe reports
the fault as absent.

---

## Phase 2: Scoring moves to the stage tabs

**This is a requirement rather than a preference, and the reason matters.**
At Site Assessment the gate correctly demands Physical Suitability and Data
Rights scored at or after that stage, and there is no way to do it from
that tab. The gate points at an affordance that is not where the gate is.
That is the same shape as the `child_record_status` rule Round 7 removed:
blocks correctly, offers no route from where the user is standing.

### 2.1 Placement and title

The panel renders **on the left of the stage tab**, ahead of Terminus
Documents, Exit Criteria and Approvals. Titled **Qualification Scoring**,
per the business.

### 2.2 Which criteria appear on which tab

**AMENDED after Phase 0: the gate rules alone carry this, and
`rescore_through_stage` is not needed for it.** The derivation is one rule:
**the criteria shown on stage S are the score-keyed
`payload_field_required` rules whose `from_stage` is S.** Run against live
data it reproduces the table below exactly, including which stages get no
panel.

**Keep `rescore_through_stage` as a cross-check rather than as an input.** It
agrees with the gate rules today, and a disagreement between them would be a
real finding: it would mean a criterion is permitted to be re-scored
somewhere no gate requires it, or required somewhere it is not permitted.
Asserting they agree is worth more than deriving from both.

**Never a hardcoded list**, and note that `loadTbStageDetailTab` already
contains both patterns eight lines apart: `isTerminal` is computed from
`stage_definitions` and is the pattern to follow, while the install section's
`stageName !== 'Installation and Commissioning'` is the pattern to avoid.
Both are pure visibility toggles on statically-mounted markup, so **no per-tab
duplication is needed.**

| Stage tab | Criteria shown |
|---|---|
| Qualification | All five, plus the measurability confirmation |
| Site Assessment | Physical Suitability, Data Rights |
| Monitoring and Analysis | Clear Use Case Requirements and Metrics |
| Every other stage | No panel at all |

**No panel means no panel**, not an empty card. Round 9 Phase 6.3
established that permanently-empty UI is worse than absent UI, and Round 10
Phase 7 established the exception: a panel that becomes meaningful and is
genuinely full when reached. A scoring panel on Pre-Site Assessment is the
first case, not the second.

### 2.3 The row layout constraint

**Confirmed by the business: a full-width row separates a criterion name
from its score far enough that the eye loses the connection.**

The panel needs width, because it carries the control, the anchors, the
comment field and the history. So the constraint is **not** a width cap on
the panel. It is a **measured maximum on the horizontal gap between a
criterion's name and its score**, which is the actual problem.

Choose the figure by measuring rather than by picking one, and state how it
was derived. Apply it at all three widths.

**Test evidence required:** confirm the panel renders on exactly the three
stage tabs above and on no others, asserted as a count across all eight
tabs rather than checked on the three. Confirm the criteria shown on each
match the table, verified against the gate rules and `rescore_through_stage`
rather than against a list in the code. Confirm scoring works from Site
Assessment and that the resulting entry carries `stage: 'Site Assessment'`,
verified server-side. Measure the name-to-score gap at 1240, 1920 and 3440.
Open the screenshots.

---

---

## Phase 3: A read-only summary on Reference

**BUILT OUT OF ORDER, and this note exists so rule 7's count at close-out
reads an accurate list rather than a reconstructed one.**

This was Phase 4 in the brief as amended after Phase 0, and the anchors phase
was Phase 3. The reorder after Phase 0 moved five phase numbers, and the
instruction that followed Phase 2 named "Phase 3" while describing the summary
card, so the summary was built third and the anchors fourth. The brief is
corrected here to match what was actually built, in that order, rather than
recording an intent the work did not follow.

**The anchors are deferred behind this, not dropped**, and they remain the
round's most important item: they are what the business meant by "I am scoring
blind". Nothing in the summary card depends on them, and nothing in the
anchors phase depends on the summary card, so the swap costs nothing beyond
this note.


Confirmed with the business. Removing scoring from Reference entirely would
mean a completed Test Bed's scores are only visible by opening the stage tab
where each was recorded, which makes the record harder to read as a whole.

### 3.1 Shape

**A card in the existing `.ref-cards` grid**, under the same
`minmax(280px, 420px)` cap as its neighbours. Not a full-width block. Five
rows of criterion name and current score, compact enough that the name and
its value sit close, consistent with every other panel on that tab.

### 3.2 Read-only, and evidently so

**A row that silently does nothing when clicked becomes a dead end the user
keeps trying.** It must be evident that scoring happens on the stage tab.
Choose the mechanism, state it, and do not build a control that looks
operable and is not, which is the reasoning Round 11 Phase 5 used for the
Tech Team dropdown when no Installer is set.

**Test evidence required:** confirm the card sits in the grid with its
neighbours at all three widths, container measured not element, no overflow.
Confirm it renders every criterion including unscored ones, and that
"Not scored" is distinguishable from a score. Confirm nothing on it is
editable, asserted structurally as Round 10 Phase 7 did for the Closed
panel: zero inputs, zero controls, zero click handlers. Open the
screenshots.

---

---

## Phase 4: The anchors become visible

**The business scored a real prospect and reported "I am scoring blind."**
Fifteen anchor rows exist, versioned, and nothing displays them at the point
of scoring, so the control is a 1-to-5 dropdown with no framework attached.
An inexperienced salesperson choosing a number from that has exactly the
problem the anchors were written to solve.

### 4.1 Inline, not on hover

The business suggested a hover popup. **Build it inline instead**, and
record the reasoning:

- The anchors are two to three sentences each. Hover tooltips are
  unreadable at that length.
- Hover does not exist on touch.
- The design intent is that scoring is a matching exercise rather than a
  recalled judgement. Hiding the instrument behind a gesture makes it
  optional.

When a criterion's score control opens, that criterion's anchors for 1, 3
and 5 display, at the **current version**. The user chooses between visible
descriptions.

**AMENDED after Phase 0: this needs no new endpoint and no additional
request.** `GET /api/scoring-criteria` already returns the wording, nested
`anchors[version][score]`, alongside `current_version` computed as
`max(version)`. The whole response is **4,480 bytes for all five criteria and
every version**. The browser already makes this call on first render and
caches it in `tbScoringCriteria` - **and discards the `anchors` key.** The
work is to stop discarding it and render it. The request-count evidence below
therefore has a known answer to confirm rather than a number to discover:
**one call, at first render, and none thereafter.**

### 4.2 What to expect

This will make Round 11 Phase 8's structural finding visible immediately:
every 5 anchor is a conjunction of three or four independent conditions,
real engagements satisfy most of them, and 2 and 4 as "between these"
cannot carry a gap that is not one dimension. **That is the intended
outcome, not a defect to design around.** The business review needs the
problem visible, not smoothed over.

Show 2 and 4 as selectable with no wording rather than hiding them or
inventing text.

**Test evidence required:** confirm the three anchors display for a
criterion whose control is open, and that they are the current version's
wording, proven by inserting a version 2 for one criterion and confirming
the panel shows v2 while a historical entry still resolves to v1. Confirm
anchors are not fetched per keystroke or per row render, and report the
request count for opening the panel and scoring all five. Confirm the
anchors do not truncate at 1240. Open the screenshots.

---

---

## Phase 5: The exit criteria split

Confirmed with the business, with the line drawn by them:

| Category | Requirements | Behaviour |
|---|---|---|
| **Data entry** | Duration, Est. Install Date, Est. Go Live, the three buyer roles | Show **only when unmet** |
| **Process** | The five scores, measurability, documents approved, approvals given | **Always show**, ticked or not |

The business's reasoning, recorded because it decides future cases: **the
tick is confirmation that a step was performed, and a step performed is
what you want visible in a process you are reinforcing. A date being filled
in is not a step, it is a field.**

### 5.1 The classification is a property of the requirement, not a list

`document_status` and `approval_obtained` are process.
`contact_role_linked` is data entry. `payload_field_required` is **both**,
which is the only untidy case: a date is data entry and a score key is
process.

**AMENDED after Phase 0. The premise above is refuted and is left visible
rather than deleted.** This brief asserted that `TB_EXIT_CRITERION_KEYS`
already distinguishes the two. **It does not.** That set now holds only the
four legacy tick keys; the five score keys and `measurabilityConfirmed` are
absent, because Round 11 Phase 2 deliberately kept score keys out of it and
out of `TEST_BED_WRITABLE_KEYS`. Deriving from it alone would have classified
**all six process requirements as data entry**, which is the exact opposite of
the intended behaviour and would have hidden every score the moment it was
ticked.

**Use this instead, measured against every live rule:**

    process = requirement_detail.min_length is present
              OR field is in TB_EXIT_CRITERION_KEYS

Two clauses, both reading data that already exists, and **still no per-rule
flag and no new column**. Verified against all fourteen
`payload_field_required` rules: the three dates and `installer_account_id`
fall to data entry, the five scores and `measurabilityConfirmed` to process
via `min_length`, and `exitMonAllMeetingActionsCompleted` to process via the
key set.

**One caveat, recorded as a caveat rather than resolved.** `min_length` means
"this field holds a series", which is not the same concept as "this is a
process step". It correlates exactly today because the only series-valued
requirements happen to be the scored ones. **It is a proxy, and a proxy that
is currently exact.** A future data-entry field holding a series would be
misclassified, and nothing would flag it. Recorded so that whoever adds such a
field recognises this rather than rediscovering it.

### 5.2 Approvals appear in two places, deliberately

Approvals show in the exit criteria and in the Approvals panel. The
business has confirmed this is not noise: the Approvals panel is where you
act, the exit criteria is where you see the process state as a whole.

**Test evidence required:** on a record with a mix of met and unmet
requirements in both categories, confirm every met data-entry requirement
is absent and every process requirement is present with correct tick state.
Assert absence by count, not by "the list looks shorter". Confirm the
transition endpoint's own behaviour is completely unchanged, which is the
thing this phase must not touch: it is a display change over
`computeBlocking()`'s output, not a change to what blocks.

---

## Phase 6: Regenerate and reconcile

Re-run `scripts/state-dump.mjs`, commit, reconcile line by line.

**`stage_gate_rules` must be unchanged at 61 total, 45 on `test_bed`.**
This round configures no gates. A change there is a defect, not a delta to
explain. `scoring_criteria` and `scoring_anchors` must be unchanged at 5
and 15 unless Phase 2's versioning proof left a v2 behind, which it must
not.

Account for every fixture, every consumed reference code and any harness
accumulation, and tear down before regenerating. Round 11 Phase 9's teardown
matched 2 of 26 on its first attempt and was caught only by the complement
check, so **select by what the round created rather than by relationship**.

---

## Documentation discipline

Update `DESIGN_PRINCIPLES.md` as decisions change. Record:

- **Why the panel moved**, stated as the gate-without-an-affordance problem
  rather than as a layout preference, so a future round does not move it
  back for tidiness.
- **The hover decision and its three reasons**, since the business
  suggested hover and the build does something else.
- **The data-entry versus process line**, in the business's own words,
  because it decides how future requirements are classified.
- **Phase 0 item 4's finding**, including that this behaviour was observed
  during Round 11 Phase 1 and read as a probe artefact. A real fault
  mistaken for a harness artefact is the mirror image of the four harness
  faults mistaken for product defects, and it is the more expensive
  direction.

Check the phase count with `grep -n "^## Phase\|^### Phase"` and confirm
every phase has an explicit sign-off before declaring the round complete.
Note that Round 11A recorded a phase that shipped no diff and was initially
miscounted: **a phase that ships no diff is still a phase.**