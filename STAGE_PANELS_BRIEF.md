# STAGE PANELS: the build brief

Governing docs, read before anything: CLAUDE.md, DESIGN_PRINCIPLES.md,
`TEST_BED_OLD_VS_NEW_AUDIT.md`, and the tms-round-method skill. Where this brief
and CLAUDE.md disagree, CLAUDE.md wins and the disagreement is a finding.

**Evidence base: `STAGE_PANELS_PHASE_0_REPORT.md`** (commit `2a3ec1f`). Its
measured floors, its viewport thresholds and its per-stage configuration table
are what every ruling below rests on, and its three corrections to the scoping
premises stand: the "453px scoring floor" was a rendered HEIGHT, thirds do not
hold at 1240 or 1440, and the documents rule changes Qualification alone.

**Branch:** `stage-panels`, off `main` at `2a3ec1f` (which is `origin/main`
`60db040` plus that report, docs only), by John's ruling at the precondition.

## Rulings of record (John, 2026-09-18)

- **R1. Panel order on every non-terminal stage: Scoring, Terminus Documents,
  Exit Criteria.** The standalone Approvals panel is REMOVED; the approval track
  list renders INSIDE the Exit Criteria panel as its closing section, controls
  intact and behaviour unchanged, and it shows per track the configured approver
  for this Test Bed (the Terminus Commercial, Technical and Legal approver
  fields). If those fields do not exist per record (R8 establishes this), the
  display names the track without an approver. **Row-level merge of approval
  actions into criteria rows is on the list, not this round.**
- **R2. Layout: the estate's min-width column grid** (the `.ref-cards` shape)
  with a **430px column minimum**, so 1240 and 1440 render scoring full width
  with documents and exit criteria paired, and wider displays gain columns with
  no named breakpoints. **Scoring spans the full row width wherever fewer than
  three columns fit.**
- **R3. The Documents panel renders only when the stage has document
  requirements.** Per Phase 0's P0.2 table this changes **Qualification only**,
  removing its placeholder line.
- **R4. Scoring presence.** On the gate-demanding stages (Qualification, Site
  Assessment, Monitoring and Analysis) the card behaves as today. On other
  non-terminal stages it shows ONLY criteria already carrying a score, open for
  re-scoring under R10's per-stage Record scope; **with no scored criteria and no
  recorded measurability, the card does not render.**
- **R5.** The install section stays full width below the panel row on
  Installation and Commissioning.
- **R6.** Closed is unchanged: the closed-record panel, no stage panels.
- **R7. Floors are reading A** (controls never crush): **scoring 414px,
  documents 301px**; exit criteria rows wrap.
- **R8. MEASURE FIRST, and build nothing of it without John's explicit word after
  the report.** The ruling: *a Test Bed with no approvers configured is BLOCKED AT
  QUALIFICATION*. The three approver configurations become Qualification exit
  criteria, so nothing passes to Pre-Site Assessment without Commercial,
  Technical and Legal approvers named.

## STEP 2: the R8 measurement (read-only, reported before any build commit)

- Do per-record Terminus approver fields exist on Test Beds today? Where are they
  configured (record fields, staff directory, elsewhere), and what do live
  records carry?
- What does the approval-grant route check now: can any authenticated user grant
  any track, or is the granter validated against configuration? Measured both
  directions on an owned tagged fixture, each read back from the database.
- Dirty data: live Test Beds past Qualification with any approver field missing
  or empty, **counts only**.
- Proposed in the report: the three Qualification gate rules, their criteria-row
  wording when unsatisfied, the backstop for a track whose approver field is
  emptied after Qualification, and whether enforcement needs route changes or
  configuration only.

## STEP 3: the pilot, proven on Pre-Site Assessment

**Built as ONE MECHANISM.** The grid, the scoring derivation, the documents
condition, the approvals relocation and the approver-name display are structural
and reach every stage. **The pilot is where proof happens, not a stage fork.**

Guard tests, red first on the current tree, each proven to fail before the
change: the full-width stack as the failing layout claim; the standalone
approvals panel as the failing R1 claim; the Qualification documents placeholder
as the failing R3 claim; the scoring card hidden on a stage with scored criteria
as the failing R4 claim.

Live proof on an owned tagged record at **1440 AND 1240**, Pre-Site Assessment,
the record carrying Qualification scores: panel order and widths from the DOM;
scoring full width showing the scored criteria; documents and exit criteria
paired at 530/430; approval tracks inside the criteria panel with approver names
where configured; a re-score recorded through the real control and read back with
its stage stamp; the NDA row still confirmable; an approval still grantable from
the relocated list, read back from the database. Screenshots at both widths,
opened and read.

Then a walk of the other six non-terminal stages at 1440: layout holds, documents
exactly per the P0.2 table, scoring per R4, Closed unchanged, with screenshots
for Qualification and Installation and Commissioning.

Unit and live calibrations both directions, each injection fired on its named
test with sources restored byte-identical, and the full pre-commit suites on
every commit. Nothing merges and nothing pushes.
