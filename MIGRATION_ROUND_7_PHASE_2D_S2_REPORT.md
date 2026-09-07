# Round 7 Phase 2d, session 2: the view's load and render

**Precondition:** session 1 committed at `f69160d`, 21-stage gate green, the
`app.js` enumeration asserting 14 names / 365 lines.

**No swap.** The vanilla Test Bed is still live.

---

## THE INCIDENT FIRST: this session's own harness destroyed the work it was calibrating

**Recorded first because it is the most useful thing in the session**, and
because it is the THIRD instance of the shape Verification 44 names.

**The mechanism, and it is specific to a sweep that deliberately injects a
HANG.** The last injection removes a guard against an infinite render loop.
Injections 1 to 14 each fail in a second or two, so the run raced through them,
applied number 15, and hung. The shell killed the whole process at its own
two-minute wall. **The restore never ran and the mutation stayed on disk.**

**THE SECOND RUN THEN SNAPSHOTTED THE MUTATION AS THE ORIGINAL** and faithfully
restored it after every injection. The damage was not merely left behind; **it
was blessed.** Every subsequent injection reported `-1 failed` in exactly 20
seconds - Verification 48's signature, a stage that produced no result - because
the guard was gone and the suite hung every time.

**It surfaced because the suite hung afterwards, which is luck rather than a
control.** Had the removed guard been anything quieter, the loss would have
travelled into the commit.

### Two fixes, both in the harness

**A kill-detector.** The harness writes `.in-flight` in its snapshot directory
before the first injection and removes it only after the final byte-for-byte
comparison. A run that finds one **REFUSES** and names the directory to restore
from, rather than snapshotting the wreckage.

**No-result is a STOP, not a verdict.** Verification 48 says a harness must
never score a run that produced nothing. The injection whose expected result IS
a hang now declares `expectHang: true`, so a timeout is evidence for that one
and a hard stop for every other.

---

## The enumeration, before and after

| | names with no React counterpart | vanilla lines |
|---|---|---|
| **before** | 14 | 365 |
| **after** | **7** | **123** |

Seven gaps closed in the same commit: `renderTestBedDetail`,
`loadTestBedDetail`, `tbLandOnStageAfterLoad`, `tbArrivingFresh`,
`tbFreshNavigation`, `currentTestBed`, `tbDetailStages`.

---

## What was built

Enumerated first as **L1-L8, R1-R7**, then tests red first
(`Failed to resolve import "../testbed/viewLoad"`). **20 tests: 11 on the
model, 9 on the rendered halves**, the latter driving the whole host.

**L1 is the behaviour worth naming.** The arrival flag is spent at the TOP of a
load, before the fetch can fail. A flag cleared only by the renderer survives a
failed load, and the **next** call - a save - then reads as an arrival and jumps
to Reference. That is the original fault reintroduced through its own fix, and
the test asserts the second consume after a failed first.

**L2's default is inverted rather than patched at call sites.** Twelve of the
vanilla's thirteen load sites are saves and one is a navigation. Making each
caller pass *do not reset* leaves the thirteenth, added later, inheriting the
fault - this project's standing rule at four confirmed instances.

**L5's door needs all three**, and the absent-id cases fail OPEN here on
purpose: with nobody signed in the question cannot be answered, and answering it
*yes* would lock a record nobody owns. The edit attempt is where it fails
closed. **RLS is the boundary; this stops work that will be refused.**

**R6 has no special case and must not grow one.** Round 10 Phase 6 excepted the
final transition from landing because Closed rendered nothing; Round 10 Phase 7
gave Closed a real panel and removed the exception. The injection that
reintroduces it fires.

---

## Two defects this session's own changes introduced, both found by a hang

**1. An infinite render loop.** The panel reports drafts from an effect keyed on
`rows.changes`, which has a fresh object identity every render. Making
`onDraftsChange` set state turned that identity churn into a loop. **Before this
session the callback only scheduled a preview and set no state**, so the churn
was harmless - Architecture 8 exactly, an unchanged path meeting a new demand.

**2. `[].entries` is a FUNCTION.** The history read was `r.data?.entries ?? []`.
A response of `[]` has an `entries` property - `Array.prototype.entries` - so
the nullish fallback never fires and the panel receives a function to map over.
Now `Array.isArray`, with a test that feeds a bare array on every route.

**That second one came back SILENT with zero failures on its first sweep**,
because the fixtures had already been corrected to each route's real shape and
nothing exercised the wrong one. Verification 51's classification named it a
missing assertion, and it was.

---

## Calibration

`scripts/round7/inject-phase-2d-s2.mjs`. **15/15 detected, reverted run GREEN,
all three files byte-identical.**

The 2c view-gate was re-anchored after the seven closures and re-run: **6/6.**

---

## Standing detectors

| detector | result |
|---|---|
| accounting (both populations) | 12/12 |
| duplicate ids | 3/3 |
| computed visibility | 2/2 |
| casing collisions | 2/2 |

---

## Surprises

**1. A harness that injects a hang is a different animal.** Every other
injection in this project fails fast. This one cannot, by construction, and that
is what turned a two-minute shell timeout into a silent source loss.

**2. `Array.isArray` is not defensive programming here, it is correctness.** The
nullish operator is the natural reading and it is wrong for exactly the shape
the route can return.

**3. The suite hanging is a worse failure mode than the suite failing**, and
this session had both from the same root. A hang gives no test name, no
assertion, and no diff - the only signal is that nothing comes back.

---

## What remains before the swap

**7 names, 123 lines** - session 3 of Phase 2d:

| lines | name |
|---|---|
| 44 | `confirmStageDocument` |
| 22 | `convertTestBed` |
| 19 | `saveStageDocumentUrl` |
| 11 | `applyConfirmedApproval` |
| 11 | `refreshTbStagePanels` |
| 10 | `wireTestBedConvertOnce` |
| 6 | `resetTestBedConvertForm` |

---

## Gate

**All 21 stages passed.** Pure 485/485, database 94/94, react **851/851**, all 0
fail, typecheck clean, 14 HTTP probes. Every figure parsed from the run.

The react suite grew by 20 this session (831 to 851).

**Not pushed. No swap. Phase 2e is not reachable until the enumeration reads
zero gaps.**
