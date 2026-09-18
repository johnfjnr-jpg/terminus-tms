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

## Rulings of record, at the Phase 0 sign-off (John, 2026-09-18)

Appended at the phase they launch, before any work (CLAUDE.md build discipline 7).

- **R1.** Phase 0 is signed off by John, 2026-09-18.
- **R2. A buyer role is SINGLE-HOLDER.** One contact per role per Test Bed. The
  route refuses a second contact in an already-linked role with a 409 and a
  sentence naming the role, checked before the insert, per the estate's
  duplicate-is-a-sentence precedent (`src/routes/opportunities.js`). Joint
  holders are a deliberate roles feature later, not this round.
- **R3. B4's fix includes the server refusal.** A unit PATCH whose body carries
  no recognised key is answered 400 with a sentence, never a 200 that writes
  nothing and advances the revision (Phase 0 P0.3).
- **R4. The dev server binding fix rides this round** as its own calibrated
  commit: the host defaults to 127.0.0.1, and LAN exposure is opt-in via `HOST`.
  The macOS firewall is John's own action, not this round's.
- **R5. The K3 discriminating measurement runs in this round** as a diagnostic
  item. Measure, report, fix nothing.

## Rulings at the Phase 1 sign-off (John, 2026-09-18)

- **R6.** Phase 1 is signed off.
- **R7. The K3 remedy.** The fixture ledger PRUNES on a clean teardown, and the
  teardown test weighs all tags in ONE grouped query. No index: that is a
  migration a future measurement can argue for. Its own commit, calibrated by
  reporting the database stage's duration before and after on the same tree.
- **R8. The installer search list rendering open unprompted**, showing other
  Accounts' names, is promoted into this round's surface phase. The styling
  items (unit sub-tab labels, browser-default buttons) ride the rider clause.

## PHASE 2: B4, the unit save, as one mechanism with R3's refusal

- the client route corrected to `PATCH /test-beds/:id/units/:unitId`;
- the wrap removed, so the body is flat;
- the field name corrected to `serialNumber`;
- **R3, server-side:** a unit PATCH whose body carries no recognised key is
  answered 400 with a sentence naming what it refused, never a 200 that writes
  nothing, and no empty revision is appended.

Guard tests are proven red on the pre-fix tree, including the silent-200 shape
in its own test (a wrapped body and an unknown-key body each answered 400), then
green. Live proof on an owned tagged fixture: a serial typed into the row and
blurred, read back from the database, then rendered after a reload, with a
screenshot at 1440 opened and read. Both-direction calibrations per the round
method, and the full pre-commit suites on every commit.

L2, L3, L4 and R8 do not start until the word.

## Rulings at the Phase 2 sign-off (John, 2026-09-18)

- **R9.** Phase 2 is signed off.
- **R10. R7 closes as half-landed by measurement.** The prune is the fix, the
  per-tag weighing stays, and no RPC and no index without a future measurement
  arguing for them.
- **R11. The empty revision on a state-only unit PATCH is Phase 3 scope:** a
  revision is written only when it carries a change.
- **R12. `calibrate-live.mjs` rides this round as its own calibrated commit.**
  When it stops for any reason after writing an injection, it restores the source
  from its own snapshot, verifies the sha byte-identical, and only then removes
  the IN-FLIGHT marker and reports the stop. Calibrated both directions: a forced
  stop on a server-only injection leaves the tree byte-identical to HEAD, and a
  normal run still fires on its named test.

## PHASE 3: the unit surface (L2, L3, L4, R8, R11)

Vanilla parity by capability, each item guarded red-before and green-after:

- **L4.** The unit row offers serialNumber, latitude, longitude and a state
  select (Planned, Installed, Faulty, Removed), each saving flat through the
  fixed route and each read back from the database in the live proof. The index
  renders per row, with per-row save feedback.
- **L2.** Count correction returns on the Installation tab per open type: a new
  count plus a mandatory reason, Apply disabled until both are filled, sent as
  the vanilla sent it (`payload` plus `countCorrectionReason`), and the
  correction visible after a reload.
- **L3.** A locked count says so WHERE IT IS EDITED: the Commercials count field
  for a type with existing units renders locked, carrying the vanilla's sentence
  directing to the Installation tab. The after-the-fact 400 remains as the
  server's backstop, and the lock summary line stays.
- **R11.** A state-only PATCH writes a revision only when it carries a change; an
  empty patch appends nothing.
- **R8.** The installer search list renders CLOSED until the person types, and no
  other Accounts' names appear unprompted.

Live proof on an owned tagged fixture at 1440 covering all four unit fields saved
and re-read, a count correction applied with its reason, the locked-count
sentence at the Commercials field, and the installer list closed on a fresh
Installation tab. Screenshots opened and read. Unit and live calibrations both
directions, and the full pre-commit suites on every commit. The rider clause
applies if a phase file carries the styling items (sub-tab labels, default
buttons), each as its own named item in the report.

This is the last build phase before the round close.

## Rulings at the Phase 3 sign-off (John, 2026-09-18)

- **R13.** Phase 3 is signed off.
- **R14. R2 builds as PHASE 4, before the close.** K1, the server refusal text
  naming "a score of 1 or 2", and the captured-fixture staleness treatment carry
  to the next round, named in the close-out.

## PHASE 4: R2, the single-holder buyer role

- `POST /test-beds/:id/buyer-contacts` refuses a contact for a role already held
  on that Test Bed: **409**, checked BEFORE the insert, with a sentence naming
  the role, per the estate's duplicate-is-a-sentence precedent
  (`src/routes/opportunities.js:1327-1342`). The same-contact duplicate keeps its
  existing refusal.
- The guard is red first on the current tree: Phase 0's reproduction (Alpha
  linked, Beta accepted into the same role) becomes the failing test, then green.
- Both directions live on an owned tagged fixture: Beta refused with the role
  named, a different role still accepted, and the database showing one contact
  per role throughout, read back after a reload.
- The report counts whether any EXISTING record holds two contacts in one role,
  so we know whether the rule meets dirty data.
- Full pre-commit suites.

## THE ROUND CLOSE

CURRENT_STATE.md regenerated; `TEST_BED_UNITS_CLOSE_OUT.md` with what landed per
phase and its commits, the rulings R1 to R14, what carries, promotions PROPOSED
not landed, and the audit's B4, R1, L2, L3 and L4 marked closed against
`TEST_BED_OLD_VS_NEW_AUDIT.md`; the FULL merge gate on the branch, reported stage
by stage. No merge and no push, whatever the colour.

## PHASE 1: R1, a read never writes

With two riders ahead of it, each its own commit: 2.1 the binding fix (R4),
calibrated both directions; 2.2 the K3 measurement (R5), read-only.

- Remove the derive call from tab open (`stageLoad.ts` P7 and its host wiring).
  Deriving units happens on the button only.
- "Create the missing units" keeps working: visible when a count exceeds its
  units, and its click derives, proven live with the POST observed and units
  read back from the database.
- Calibration both directions on an owned tagged fixture: (a) opening the
  Installation tab with counts set and zero units sends ZERO non-GET requests and
  leaves units at 0 in the database; (b) the button sends exactly one derive POST
  and creates the correct number of units.
- A guard test that fails if tab open ever fires derive again, proven to redden
  on the pre-fix code, then green after.
- Live proof at 1440: a screenshot of the Installation tab freshly opened with
  counts set and units at 0, showing the button offered and nothing created.
- Full pre-commit suites on the commit. B4 does not start until the word.
