# Stage panels: the R8 measurement and the Pre-Site Assessment pilot

Model: Claude Opus 5 (1M context).
Branch `stage-panels`, five commits on top of `main` at `2a3ec1f` (which is
`origin/main` at `60db040` plus the Phase 0 report, docs only). Nothing merged,
nothing pushed.

---

## 1. What is NOT built

**R8 is measured and not built.** The ruling said measure first and build
nothing without the word, and nothing of it is built: no Qualification gate
rules, no criteria wording, no route change. Section 2 is the measurement and
the proposal, and it waits.

**R5, R6 and R7 are ruled and inherited rather than separately built.** The
install section below the row (R5) and Closed unchanged (R6) are measured as
part of the pilot and reported in section 4; the floors (R7) are what the grid
is sized from. No stage-specific work exists for any of them.

---

## 2. The R8 measurement, read-only

Instrument: `scripts/stage-panels/measure-r8.mjs`, on an owned tagged fixture,
each answer read back from the database. Teardown removed 2, remaining 0.

It was first run from a scratch file, which is not a measurement anybody else
can repeat. It is now in the repository and **re-run from there**, producing
`.verify/tb-stage-panels/r8-measurement-rerun.txt`, which is identical to the
original in every figure. The numbers below are that re-run's.

### 2.1 Where the approver fields live

- `terminus_staff`: **7 rows**, columns `id, name, title, created_at`. **No
  `user_id`**, so the staff directory does not link to `auth.users` at all.
- The per-record fields are **payload keys on the Test Bed**:
  `commercialAuthority`, `technicalAuthority`, `terminusLegalOwner` (and
  `terminusLead`), each offered as a staff **name**.
- `track_approvers`: 5 rows, **none for `test_bed`**.

So a Test Bed's approvers are three strings on the record, and nothing anywhere
turns one of those strings into a user who may approve.

### 2.2 What live Test Beds carry (counts only)

- Live Test Beds: **10**. Past Qualification: **8**.
- With any approver field missing or empty: **0**.
- With all three missing or empty: **0**.
- By field: `commercialAuthority` 0, `technicalAuthority` 0,
  `terminusLegalOwner` 0.

**There is no dirty data.** R8's gate can be introduced without a backfill and
without grandfathering: every record already past Qualification satisfies it.

### 2.3 What the grant route checks, measured both directions

On a fixture whose three authorities were all set to one named person:

- **A.** The **owner** grants Commercial: **403**, *"You own this record, so you
  cannot approve it. An approval has to come from somebody other than the person
  advancing the deal."*
- **B.** A **non-owner who is not the named authority** grants Commercial:
  **201**, and the row is in the database.
- **C.** The same person then grants **Technical: 201** and **Legal: 201**.
  Three approvals, all by one person, all accepted.

**The only thing the route checks is that you are not the owner.** The three
approver fields are display, not authority: any signed-in non-owner may grant
every track on any record. This is a finding about the system as it stands, not
about anything this round changed, and under build-discipline rule 10 it goes on
the list rather than into this round.

### 2.4 What R8 would take, proposed

1. **Three Qualification exit-criteria rules**, one per track, each satisfied
   when its payload field is non-empty. Configuration only: `stage_gate_rules`
   rows against `test_bed` at Qualification. No route change, no migration to the
   engine.
2. **Wording when unsatisfied**, in the criteria row's own voice: *"Requires a
   Commercial approver to be named"*, and likewise Technical and Legal.
3. **The backstop for a field emptied after Qualification.** The gate is
   evaluated at the stage it belongs to, so emptying `terminusLegalOwner` at Site
   Assessment passes every later gate. The honest options are (a) repeat the
   three rules at every stage that requires an approval of that track, which is
   data and costs nothing at runtime, or (b) leave it, on the grounds that the
   grant route does not read the field anyway. **(b) is only defensible while
   2.3 is true**, and if the route is ever taught to check the field, the
   backstop becomes required. My recommendation is (a), because it is rows.
4. **Enforcement is configuration only** for the naming gate. Making the named
   approver actually the person who may approve is a separate and larger item:
   it needs an identity for a staff member, which `terminus_staff` does not have.

**Nothing above is built.** It waits for your word.

---

## 3. The pilot, built as one mechanism

Commit `6ed5365`, with the correction in `c6afc2a`. The grid, the scoring
derivation, the documents condition, the approvals relocation and the approver
names are structural and reach every stage; Pre-Site Assessment is where the
proof was taken.

- **R2.** `.tb-stage-panels-row` is the estate's column grid at
  `minmax(430px, 1fr)`, derived from Phase 0's floors rather than picked: the
  widest pair member at 430 and the scoring card's 414px control row. Scoring
  spans the row until a third 430px column fits, which arithmetic puts at a
  1686px viewport (three columns and two 16px gutters need 1322px in a container
  that is the viewport less a constant 364px, measured at 1240 and 1440).
- **R1.** Order is scoring, documents, exit criteria. The standalone approvals
  panel is gone: its track list is now the exit criteria panel's **closing
  section**, and each track names the approver this Test Bed carries, or says
  none is named.
- **R3.** The documents panel renders only where the stage has documents, which
  removes Qualification's *"No documents configured for this stage."*
- **R4.** Scoring follows the gate; on a stage the gate asks nothing of, the card
  offers the criteria **already scored**, and renders not at all with nothing
  scored.

### 3.1 The defect the pilot found, and it was live

The approve control the relocation moved posted **`{ track }` alone**. The route
requires a decision and answered **400 in 0.66ms**, so the relocated control
could not grant anything. It is fixed in `c6afc2a` and guarded by a test that
asserts the **body**, because a refused POST looks exactly like a click that
worked.

This is authorship rather than a walk-past finding: the control was moved by
this round, so its being intact is part of the change.

---

## 4. Live proof

`scripts/stage-panels/probe-pilot.mjs`, run `pilot-reverted` on the committed
tree: **44/44 checks PASS**, teardown removed 3, remaining 0.

### 4.1 The row, measured

```
=== Pre-Site Assessment at 1440 ===
  row                            {"x":302,"y":751,"w":1076,"h":752}
    tb-stage-scoring-card        {"x":302,"y":751,"w":1076,"h":310}
    tb-stage-documents-section   {"x":302,"y":1077,"w":530,"h":83}
    tb-stage-exit-criteria-list  {"x":848,"y":1077,"w":530,"h":426}

=== Pre-Site Assessment at 1240 ===
  row                            {"x":302,"y":776,"w":876,"h":771}
    tb-stage-scoring-card        {"x":302,"y":776,"w":876,"h":310}
    tb-stage-documents-section   {"x":302,"y":1102,"w":430,"h":83}
    tb-stage-exit-criteria-list  {"x":748,"y":1102,"w":430,"h":446}
```

The pair is asserted as a **relationship**, not as a CSS property: equal `y`,
below scoring, each at the predicted width, each clearing the 301px documents
floor, scoring clearing its 414px floor.

### 4.2 The rest

- Approver lines read `Commercial: Josh Ward`, `Technical: Matous Kundrik`,
  `Legal: no approver named` at both widths.
- R4 offers exactly the two criteria already scored, and no unscored one.
- A **re-score through the real control**: 201, read back from
  `record_revisions` as a second entry with value 5 and the reason typed. It
  carries stage `Qualification`, which is the **record's** stage rather than the
  tab being viewed, because that is what the server stamps.
- The **NDA row still confirms**: 201, and a document record exists with status
  `approved`.
- An **approval still grants**: 201, and the row is in `approvals`.
- Documents render **exactly per the configuration table** on all eight stages:
  Qualification false, the middle six true, Closed no row at all.
- **R5**: the install section is 1076 wide against a 1076 row, below it.
- **R6**: Closed renders no panel row.

### 4.3 What this run does NOT establish

The approval step **hands the record to another user**, because the route
refuses an owner approving their own record. Everything after it, including the
walk of the other seven stages, is therefore measured **with the door closed**,
which the two walk screenshots show as the read-only banner. Row structure and
documents presence are properties of configuration rather than ownership, and
the Pre-Site measurements at both widths were taken while owned. The walk says
nothing about the editability of those six stages.

---

## 5. Opening the screenshots

Four captures read, per Verification 4. Two findings, both cosmetic, both
visible only by looking, and **both created by this round in the sense that rule
10's limit means**: the round put these panels beside each other.

1. **The pair carries no card chrome and the scoring card does.** Scoring is a
   bordered card with a `SCORING` eyebrow; the documents panel and the exit
   criteria panel are bare. Side by side in one row, the row reads as one framed
   card with two unframed columns hanging under it. Before this round they were
   stacked full-width, where the mismatch did not show.
2. **The three approver lines are spaced as paragraphs**, roughly 53px apart, so
   they read as three statements rather than one list of three tracks.

Neither is built. Both are one stylesheet rule each and I would take them at the
cosmetic tier on your word, with a before-and-after at all three widths.

---

## 6. Calibration, both directions

### 6.1 Unit, 9 injections, scored by WHICH named test failed

`.verify/tb-stage-panels/calib-unit.txt`. **9/9 FIRED**, reverted full React
suite **1197/1197 across 66 files**, all targets byte-identical.

| injection | the test that failed |
|---|---|
| documents renders after the exit criteria (both survive the swap) | the order is scoring, documents, exit criteria |
| the row loses the class the grid rule is written against | a grid row holds the panels |
| the approvals render outside the criteria panel | the approvals are INSIDE the criteria panel |
| the Commercial approver read from nowhere | each track names its configured approver |
| an empty approver field renders blank | each track names its configured approver |
| the approve click sends no decision | the approve click sends a decision |
| the documents panel on every stage again | Qualification has none, so the panel does not render |
| every criterion offered on every stage | the gate-asks-nothing case, and the nothing-scored case |
| a stage the gate asks nothing of offers nothing | the gate-asks-nothing case |

The first of those was rewritten after its first run. As first written it
**deleted** the documents panel rather than moving it, so it also failed R3's
presence test: it was not an order injection at all. The replacement is the pair
in the ruled order swapped for the same pair reversed, and it now fails the order
test alone.

### 6.2 Live, the two claims jsdom cannot hold

One injection per spec file, because the harness builds a whole spec into one
bundle and two faults can mask each other.

| injection | the check that failed | measured |
|---|---|---|
| the row is not a grid | 1440: the pair measures 530 and 530 | the pair stacked at 1076 each, on different rows |
| scoring stops spanning the row | 1440: scoring spans the whole row | scoring became a 530 column |

Both **FIRED**, both restored byte-identical with the marker removed, and the
reverted probe on the restored tree reads 44/44.

### 6.3 The harness change these needed, and the control that refused it

`calibrate-live.mjs` asserts the injection is what will be served by watching the
bundle move. A stylesheet is not bundled, so that check would have stopped a
healthy run.

The first version fetched the served stylesheet and read the injected text back.
**The estate's own guard refused the commit**: two files may call `fetch` and
this is not one of them, because a raw fetch is how a non-2xx goes silent. The
refusal was right and the better answer was underneath it. What the fetch was
proving is the **premise** that the disk copy is the served copy, and that is a
property of the server rather than of the run: `src/server.js` serves `frontend/`
from disk and sends `no-store`, and each probe launches a fresh browser profile.
The premise is now asserted once, from source, and the disk bytes having changed
is the whole claim.

Calibrated three ways: an undeclared directory stops, a directory the server does
not serve stops (naming it), and the healthy run proceeds and fires.

---

## 7. Commits

| commit | what |
|---|---|
| `2a3ec1f` | Phase 0 report (on `main`, docs only) |
| `a531d7a` | the brief, rulings R1 to R8 of record |
| `6ed5365` | the pilot: the ruled row as one mechanism |
| `c6afc2a` | the approve control sends the decision the route requires |
| `74ba097` | the probe and the calibrations, both directions |
| `2011a04` | the R8 measurement's own instrument, in the repository |

Full pre-commit suites on every commit: pure, react, typecheck, database, all
PASS on each.

---

## 8. What waits for you

1. **Your own on-screen walk** of Pre-Site Assessment and one other stage.
2. **R8**: build the three Qualification rules as proposed in 2.4, or not.
3. **The two cosmetic findings in section 5**: take them or leave them.
4. **The finding in 2.3** (any non-owner may grant every track) goes on the
   list, unless you rule otherwise.
5. Nothing merges and nothing pushes until you say so.
