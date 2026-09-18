# STAGE PANELS: Phase 0 report (read-only measurement)

**Model: Claude Opus 5 (claude-opus-5[1m]). `main` at `60db040`, equal to `origin/main`, clean tree. No build, and the only commit is this report.**

## Not done, first

- **Nothing was built.** Every figure below is measured on the current tree.
- **One premise in the brief is wrong and is corrected below:** the "453px scoring floor from Round A" is not a width floor. It is the rendered HEIGHT of the blocked list in Phase 4's probe output. **No width floor for any stage panel existed before this report.**
- **The exit-criteria floor is a judgement, not a hard stop**, because its rows wrap. It is reported both ways.

## P0.1 The current render: Pre-Site Assessment, owned record, live

**Today the stage tab is a STACK of full-width panels, and the scoring card is not among them.**

| | 1440 | 1240 |
|---|---|---|
| container (`tb-tab-stage-detail`) | x=302, **w=1076** | x=302, **w=876** |
| DOM and visual order | documents -> exit criteria -> approvals -> (scoring, hidden) -> (install section, hidden) | same |
| documents panel | visible, w=1076, h=83 | visible, w=876, h=83 |
| exit criteria panel | visible, w=1076, h=135 | visible, w=876, h=135 |
| approvals panel | visible, w=1076, h=63 | visible, w=876, h=63 |
| scoring card | **present, hidden** | present, hidden |
| criteria rows | 3 | 3 |

**The container is the viewport minus a constant 364px** (1440-1076 and 1240-876 both give 364: the sidebar and the page gutters). That constant is what makes the thresholds below computable.

**Screenshot opened and read:** `.verify/tb-stage-panels/p0-pre-site-1440.png`. It shows, top to bottom: the stage heading "Pre-Site Assessment", the NDA document row with its URL box and CONFIRM, then "3 of 3 outstanding to move to Site Assessment" with its three rows, then the approval tracks. Each spans the full width, and there is no scoring card.

## P0.2 Documents: what the route returns, what feeds it, what renders

**`GET /api/test-beds/:id/document-requirements?stage=Pre-Site Assessment` -> 200**, two keys:

```json
{ "reference_docs": [ { "document_name": "NDA" } ],
  "completable_documents": [ { "document": "NDA", "required_status": "approved",
    "current_status": null, "document_record_id": null, "document_location": null } ] }
```

**The rows behind it:** `reference_docs` comes from `stage_reference_docs` (`record_type`, `stage_name`, `document_name`), and `completable_documents` is derived from `stage_gate_rules` rows of `requirement_type = 'document_status'`, whose `requirement_detail` is `{"status":"approved","document":"<name>"}`.

**The configuration whole, for every stage** (test_bed):

| stage | reference docs | completable docs | score-keyed gate rules FROM the stage | all gate rules from it |
|---|---|---|---|---|
| Qualification | 0 | 0 | **6** (scoreRolloutPath, scoreClientCommitment, scoreUseCaseRequirementsAndMetrics, scorePhysicalSuitability, scoreDataRights, measurabilityConfirmed) | 14 |
| Pre-Site Assessment | 1 (NDA) | 1 | 0 | 3 |
| Site Assessment | 3 (Site Assessment Report, Compliance and Data Protection, Partnership and Test Bed Agreement) | 3 | **2** (scorePhysicalSuitability, scoreDataRights) | 8 |
| Installation and Commissioning | 1 (Site Installation Document) | 1 | 0 | 5 |
| Monitoring and Analysis | 2 (Test Bed Performance, Review Meeting Minutes) | 2 | **1** (scoreUseCaseRequirementsAndMetrics) | 7 |
| Review and Completion | 1 (Test Bed Close Out Report) | 1 | 0 | 4 |
| Decommissioning | 1 (Site Decommissioning Report) | 1 | 0 | 4 |
| Closed | 0 | 0 | 0 | 0 |

**Every stage's reference-doc count equals its completable-doc count**, and both are zero on exactly two stages: **Qualification and Closed**.

**What renders today, measured on all eight tabs:** the documents panel renders on **seven of eight** (all but Closed). On Qualification, where nothing is configured, it renders its own empty line: **"No documents configured for this stage."** So the ruled "render only when the stage has document requirements" changes exactly one live stage today, Qualification, and removes one line of text there.

## P0.3 The vanilla at 54001c5^

The old screen put the three panels in **ONE ROW**, in `index.html` inside `#view-test-bed-detail`:

```html
<div class="ref-cards" id="tb-stage-panels-row">
  <div class="pg-card hidden" id="tb-stage-scoring-card"> ... Qualification scoring ...
  <div class="pg-card"> Terminus Documents   -> #tb-stage-documents-section
  <div class="pg-card"> Exit Criteria        -> #tb-stage-exit-criteria-list
  <div class="pg-card"> Approvals            -> (the track list)
```

**Its order was already scoring, documents, exit criteria, approvals**, which is the ruled order plus approvals. Its layout came from the estate's own class:

```css
.ref-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; align-items: start; }
```

That is **not** a one-third rule: it is "as many equal columns as fit at 280px minimum". At a 1076px container it yields three columns of ~348px; at 876px, three of ~281px; below ~872px it drops to two, and below ~576px to one. **The vanilla therefore already had the responsive behaviour the ruling describes, by a mechanism that never names a count.**

Its own comments record two decisions worth citing: the scoring card is **hidden by default and revealed only when the derivation says so**, and the panels are hidden wholesale on the terminal stage, which "renders no panels at all rather than three empty cards".

## P0.4 The layout mechanism

- **`frontend-react/src/testbed/StageTabs.tsx` owns it**, and there is **no layout container at all**: the four panels are siblings in one block, so they stack full width. `.ref-cards` is not used on stage tabs (the Reference and Commercials tabs use it).
- **One change rolls out to every stage structurally.** The stage tab is rendered once, for whichever stage is active, so a grid introduced there reaches all eight without per-stage work.
- **What decides which panels a stage gets, today:**
  - documents, exit criteria and approvals: always rendered on a non-terminal stage, each through `ReadPanel`, which shows a pending state, an error, or its `empty` sentence;
  - the scoring card: `hidden={card.hidden || (!criteria.length && !measurability)}`, so it is in the DOM on every non-terminal stage and revealed only where the derivation yields criteria;
  - the install section: `hidden` unless the stage is Installation and Commissioning;
  - **Closed** is terminal and renders the closed-record panel INSTEAD of the panels; measured, all four panels are absent there.
- **What would break a naive three-column rule:**
  - **Closed** has no panels at all, so the grid must not be introduced above the terminal branch;
  - **Qualification** has no documents, so a third column would be an empty card unless the ruled render-only-when-required lands with it;
  - **five of eight stages have no scoring**, so "scoring on every stage" is a behaviour change, not a layout change (P0.7);
  - **approvals is a fourth panel** and the ruling names three (P0.5).

## P0.5 Every other panel on a stage tab today

| Panel | Where it renders | Which stages |
|---|---|---|
| **Approvals** (`tb-stage-approval-row`, the shared track list) | inside the stage tab, after exit criteria | all seven non-terminal stages (measured visible on each) |
| **Install section** (installer, tech team, install notes) | inside the stage tab, hidden by CSS unless the stage owns it | Installation and Commissioning only |
| **Units** (`tb-units-pane`, `LockedCounts`) | inside the install section | Installation and Commissioning only |
| **Next Stage feedback** (`tb-next-stage-feedback`) | above the panels, written by the shell | every stage tab |
| **Next Stage button** | in the tab row, right-aligned | every stage tab, enabled on the record's current stage |
| **Closed record panel** | replaces the panels | Closed only |
| Summary, Notes, follow-up task, the stat strip, the chevron | **above** the tab row, not per stage | every tab |

**A three-panel ruling has to say where approvals sits**, and what happens to the install section on Installation and Commissioning, where a three-column row would be followed by a full-width section.

## P0.6 The split, measured

**Floors, measured from the panels' own content** by cloning each panel off-screen and reading it at `min-content` and `max-content`, plus the widest row containing a control:

| Panel | measured on | min-content | max-content | widest control row |
|---|---|---|---|---|
| Scoring card | Qualification (5 criteria + measurability) | 148 | **444** | **414** ("Can the proposed sensors capture what would be measured? Not ...") |
| Scoring card | Site Assessment (2 criteria) | 148 | 420 | 390 |
| Documents | Site Assessment (3 documents) | 88 | **301** | **301** (name, status, CONFIRM) |
| Documents | Pre-Site Assessment (1 document) | 88 | 234 | 234 |
| Exit criteria | Site Assessment (8 rows) | 100 | **427** | none (rows carry no controls; they wrap) |
| Exit criteria | Qualification (14 rows) | 81 | 403 | none |
| Approvals | Qualification | 87 | 109 | none |

**Two honest readings of the floor**, because they answer different questions:
- **A. Controls must not crush:** scoring **414**, documents **301**, criteria **0** (it wraps). Binding floor **414**.
- **B. Nothing wraps mid-sentence:** scoring **444**, documents **301**, criteria **427**. Binding floor **444**.

**The container is `viewport - 364`, and the estate's gutter is 16px.** So:

| Arrangement | 1440 (container 1076) | 1240 (container 876) |
|---|---|---|
| one third each (2 gutters) | **348px** per panel | **281px** per panel |
| scoring full width, documents and criteria paired (1 gutter) | scoring 1076, pair **530** each | scoring 876, pair **430** each |
| full stack | 1076 | 876 |

**Where each arrangement holds its floors** (viewport = 3 x floor + 396 for thirds; 2 x floor + 380 for the pair):

| Arrangement | holds from, reading A (414) | holds from, reading B (444) |
|---|---|---|
| **one third each** | **1638px** | **1728px** |
| scoring full width + pair | 1208px (pair floor 414) | 1234px (pair floor 427, the criteria line) |
| full stack | any width at which the container clears 444 | same |

**So the one-third-each candidate does NOT hold at 1440 or at 1240.** At 1440 each third is 348px against a 414px control row: the scoring card's own question line and its Score select would crush. The arrangement first holds at about **1638px**, which is a 1728px-wide window or a 3440 display.

**The scoring-full-width-plus-pair arrangement holds at both 1440 and 1240**, with 530px and 430px against a 427px worst line: it clears at 1240 by 3px on reading B, and by 16px on reading A. **That is a floor with no margin**, so it is worth deciding deliberately rather than discovering at 1280.

## P0.7 Scoring presence, per stage, today

Measured on one owned record at 1440, all eight tabs:

| stage | scoring card | criteria offered | criteria rows in the exit panel |
|---|---|---|---|
| Qualification | **visible** | 5 | 14 |
| Pre-Site Assessment | present, hidden | 0 | 3 |
| Site Assessment | **visible** | 2 | 8 |
| Installation and Commissioning | present, hidden | 0 | 5 |
| Monitoring and Analysis | **visible** | 1 | 7 |
| Review and Completion | present, hidden | 0 | 4 |
| Decommissioning | present, hidden | 0 | 4 |
| Closed | absent (terminal) | 0 | 0 |

**Three of eight stages show it**, and the set matches the configuration exactly: the card renders where `stage_gate_rules` carries score-keyed `payload_field_required` rules whose `from_stage` is that stage.

**What "scoring on every stage" would meet:**
- **Data: nothing blocks it.** The five criteria exist for `test_bed` globally; `scoring_criteria` is not per stage. The card reads its series from the record payload, which is stage-independent.
- **Routes: nothing blocks it.** `POST /test-beds/:id/scores` takes a criterion and a score and records the stage from the record's own status. Phase 0 of the units round proved the write end to end.
- **The derivation is the blocker, and it is a choice:** `deps.scoringCriteria(stage)` is `criteriaForStage(allCriteria, stage)`, which filters by the gate rules' `from_stage`. Rendering on every stage means changing what the card is FOR: today it offers what the gate demands here; the ruling would make it offer what can be re-scored now.
- **R10's per-stage Record scope still holds** and becomes more load-bearing: five more stages would each carry their own Record button and their own draft set.
- **The gate is unaffected**, because a score recorded at a stage satisfies rules that ask for a score "at or after" that stage; it cannot un-satisfy an earlier one.
- **The one real question is what the card SHOWS on a stage with no rules**: all five criteria, or only those already scored, or a re-score affordance for the ones the gate has already taken. That is a product ruling, and nothing measured here decides it.

## Corrections to the brief's premises

1. **"The 453px scoring floor from Round A"**: 453px is the rendered HEIGHT of the blocked transition list in Round A Phase 4 (`13 items, 453px`), not a scoring width. Round A Phase 3's addendum measured the scoring card at 876/1556/3076 wide, which is the container at each viewport, and established no floor. **The floors in P0.6 are the first ones measured.**
2. **"one third each ... dropping to scoring-full-width-plus-pair as floors demand"**: measured, thirds do not hold at either width the estate tests. The drop is not a narrow-window fallback, it is the arrangement for 1240 and 1440.
3. **"The Documents panel renders ONLY when the stage has document requirements"** changes exactly one live stage, Qualification, where it currently prints "No documents configured for this stage."

## For John's rulings

1. **Where does APPROVALS sit** in a three-panel row: a fourth column, below the row, or paired with something?
2. **Thirds at 1440 are below the scoring card's floor.** Accept the pair arrangement as the design at 1240 and 1440, or shrink the scoring card's content (the question line is what sets 414px)?
3. **What does the scoring card show on a stage the gate asks nothing of?**
4. **Does the install section stay full width** below the panel row on Installation and Commissioning?
5. **Closed renders no panels** today, which already matches "no exit criteria there". Confirm nothing changes on that tab.

## Process note: one red commit attempt, and why it was the network

The first attempt to commit this report was REFUSED by the pre-commit hook:

```
FAIL  database  286.9s
  ✖ tearDown reaches a record beyond row 1,000 of its own tag population (130154.7ms)
    Error: hand deep: TypeError: fetch failed
```

**Read as Verification 48 asks**: that test has run at 32.9 to 38.7s since R7's
prune, and the stage at ~110s. A 130s test inside a 287s stage, failing on
`fetch failed` rather than on an assertion, is the connection.

Re-run alone with nothing else running: **102/102 in 121s**, the same test at
**38.7s**, and Supabase answering in 0.26s. **Nothing was changed between the two
runs.** Recorded rather than retried silently, because a retry that is not
reported is how a real intermittent failure gets lost.

## What this does not establish

- **Anything at 1920 or 3440.** The brief named 1440 and 1240, and the thresholds above are computed from the measured constant, not sampled at those widths.
- **How the panels behave once re-laid out.** Every floor here is from today's content in today's full-width panels; a narrower column may wrap text in ways only a screenshot will show.
- **Whether scoring on every stage is wanted**, only that nothing in the data or the routes prevents it.
- **Anything about other record types.** Every measurement is `test_bed`.
