# TEST BED UNITS: the build brief

Governing docs, read before anything: CLAUDE.md, DESIGN_PRINCIPLES.md,
TEST_BED_OLD_VS_NEW_AUDIT.md (the source of every item here, with file:line
evidence), TEST_BED_WORKFLOW_CORE_CLOSE_OUT.md (what Round A left open), and the
tms-round-method skill. Where this brief and CLAUDE.md disagree, CLAUDE.md wins
and the disagreement is a finding.

**Naming.** This round is NOT "Round B" in any filename. `ROUND_B_PHASE_0_BRIEF.md`
belongs to a closed round (the Opportunity assessment write path, Round 25).
Round A's brief called this work "Round B"; that label is retired here.

## Scope, by audit item

One mechanism, built as ONE piece: counts, unit slots, the count lock and its
correction. Not five phases, one per item.

| Item | Audit rank | What is wrong |
|---|---|---|
| **R1** | Regression, 1 of 1 | Opening the Installation tab silently POSTs `/units/derive` and creates unit records, reversing a recorded ruling that a write must not be the consequence of a read. **Ranked FIRST among the fixes.** Confirmed live on `origin/main` 2026-09-17: the derive POST fired on a real record (refused 403 only because the viewer did not own it). |
| **B4** | Broken live, 4 of 6 | Every unit save fails, three contract breaks deep: a route that does not exist, a wrapped body where the server reads flat keys, and a field name the server does not accept. |
| **L2** | Lost, 2 of 12 | Count correction, the way out of the count lock (new count plus a mandatory reason). Absent. |
| **L3** | Lost, 3 of 12 | Locked-count presentation: a locked count shown read-only, naming the value, the reason and where to correct it. Absent; locked counts stay editable and fail at save. |
| **L4** | Lost, 4 of 12 | Unit fields: latitude, longitude and state have no control. |

## Openers, before any fix

1. **The measurability live write proof**, closing Round A's exit gate point 1:
   a measurability confirmation recorded end to end through the real control
   on an owned fixture, and read back from the database.
2. **The K3 discriminating measurement**: per-test durations from two database
   suite runs at different floors, to explain the stage's 29% floor rise. The
   answer wanted is whether one test moved or all of them did.

## Carried items

- The route accepting a second contact in an already-linked role (Round A
  Phase 3 finding 1).
- K1: the edit-journal hook accepts untracked edits to a file already journaled.
- The server refusal text naming "a score of 1 or 2", which describes a
  configuration rather than reading it.
- A staleness treatment for captured fixtures (Round A's K2; exit-criteria-live.json
  was measured fresh at the Round A close, and nothing prevents it going stale).

## Rider clause

L7 (notes stage stamp), L8 (install-date ceiling), L10 (chevron hover popup),
L12 (the R&D tag) and C9 (the "Sensor Counts" title) ride ONLY if a phase
touches their file, and each is then its own named item in that phase's
report. None is in scope otherwise.

## Standing constraints

- Behaviour and data changes throughout, so the FULL treatment applies: Phase 0
  live reproduction before any fix, both-direction calibration on every new
  check, the gate on the exact tree.
- **Every fix is proven on the live screen, not by element presence.** A control
  that renders is not a control that works; the audit's six BROKEN LIVE items
  all rendered.
- Fixtures are captured from what the SERVER sends, never shaped to the reader
  (Verification 47, and its Round A extension).
- Tagged fixtures through the API only, torn down by tag. R1 creates unit rows
  as a side effect of a read, so every probe that opens the Installation tab
  records the rows it caused.
- Nothing pushes without John's explicit word after a stated gate result.

## PHASE 0: measure before build

Read-only against the product. Tagged fixtures through the API only, torn down
by tag. No fixes, no behaviour changes.

- **P0.1** the measurability live write proof (opener 1).
- **P0.2** K3 (opener 2): two full database-suite runs, per-test durations,
  diffed against the recorded earlier floor.
- **P0.3** B4 reproduced live on an owned fixture: all three contract breaks
  named with the request, the response and the code site of each.
- **P0.4** R1 reproduced live on an owned fixture: the derive POST captured and
  what it wrote read back; then no further interaction with that fixture's
  Installation tab, and its unit rows recorded for teardown.
- **P0.5** the current unit surface measured against the vanilla at 54001c5^ for
  L2, L3 and L4, by capability rather than element name.
- **P0.6** the carried second-contact route reproduced, both directions: the
  wrongful accept, and what a refusal should look like.

Deliverable: a Phase 0 report, delivered per the report convention, then a stop
for sign-off. The build phases are written after Phase 0, from its findings.
