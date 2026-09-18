# TEST BED UNITS: Phase 3 report (the unit surface: L4, L2, L3, R8, R11), with R12

**Model: Claude Opus 5 (claude-opus-5[1m]). Branch `test-bed-units`. Nothing pushed. This is the last build phase before the close.**

## Not done, first

- **The full merge gate was not run.** Every commit passed the pre-commit suites; the gate belongs to the close.
- **Two defects were found by this phase's own live probe and fixed inside it** (the unit queue's stale revision, and the pane's untreated controls). Both are named below.
- **Latitude and longitude are saved as the person typed them.** The server validates ranges; nothing here formats or rounds.

## Commits (5, all on `test-bed-units`)

| Commit | What | Pre-commit database stage |
|---|---|---|
| `07f7a3e` | Brief: rulings R9 to R12 and the Phase 3 scope, before any work | 168.9s |
| `c4a443b` | R12: a stop after an injection restores before it exits | 112.5s |
| `c802fc6` | Phase 3: L4, L2, L3, R8 and R11 | 205.2s |
| `f772440` | Phase 3: the queue's own revision, and the estate's treatments | 112.6s |
| `e88c8cf` | Phase 3 instruments: calibrations and the locked line's grammar | 153.3s |
| (this report) | | |

**Server diff this phase:** `src/routes/test-beds.js` only, the R11 rule. No migration.

## R12: a stop restores (`c4a443b`)

**The defect, in one line:** `stop()` calls `process.exit`, and `process.exit` does not run a `finally` block, so every stop between the first injection and the end of the try left the injected source on disk. Measured in Phase 2: a server-only injection tripped "the bundle did not change", exited 3, and left `src/routes/test-beds.js` mutated under a `--watch` dev server, so the next spec's run measured a server with R3 disabled.

**Calibrated both directions:**

| Direction | Result |
|---|---|
| **a forced stop** (the server-only spec, `p2-b4-a`) | `STOPPED: the bundle did not change ...` then `restored from the snapshots, byte-identical; marker removed`. `src/routes/test-beds.js` sha equals HEAD's: `3a71bf101ca6` |
| **a normal run** (`p1-r1-a`) | still **FIRED** on its named checks, sources and committed bundle restored byte-identical, marker removed |

The normal path still REBUILDS and compares, which proves the restored source produces the committed bundle. A stop restores from the snapshot BYTES, because a stop may itself be a failed build. If that restore fails the marker stays, and the message says so.

## Phase 3, by item

Each was red before and green after. The guard file is `frontend-react/src/__tests__/testbed-units-surface.test.tsx`, driven through the real host by `units-live.json` captured from the routes.

**Red first, on the pre-fix tree: 8 of 10 failing.** The two that passed are negative claims (a type with no units offers no correction; a count with no units stays editable), which is what they should do before and after.

### L4: the row's four fields

The row now carries its **index**, **serialNumber**, **latitude**, **longitude** and a **state select** over the vanilla's four states, each saving alone and flat through the route Phase 2 fixed, with the row's own feedback.

Live (`p3-final3`, 19/19):

```
the row offers index, serial, latitude, longitude and the four states
  ({"index":"1","serial":true,"lat":true,"lon":true,"state":["Planned","Installed","Faulty","Removed"]})
four saves, each its own flat PATCH, all accepted
  (200:serialNumber | 200:latitude | 200:longitude | 200:state)
the DATABASE holds the serial, the latitude and the longitude
  ({"serialNumber":"SN-...","latitude":"1.2345","longitude":"103.8198"})
and the unit's STATE is Installed on the record
the row reports its own save   (Saved)
and all four are on the screen after a reload
```

### L2: count correction

On the Installation tab, per open type, for a type that HAS units: a new count, a mandatory reason, Apply dead until both are filled, sent as the vanilla sent it.

```
the open type offers a correction, and Apply is dead with nothing filled in
still dead with a count and no reason
and live once both are filled in
Apply sent the vanilla's body and the server accepted it
  ({"status":200,"body":{"payload":{"safesightCameras":"5"},"countCorrectionReason":"two were never installed","expected_revision":2}})
the DATABASE holds the corrected count   (5)
and the corrected count is on the screen after a reload   (6 planned, 6 built; the payload sums to 6)
```

**A correction that RAISES a count creates the slots**, which is the server reconciling (`src/routes/test-beds.js`), so the pane reads 6 planned and 6 built rather than 5. My first probe asserted "5 planned" and was wrong about the product, not the other way round.

### L3: the lock where the field is

A Commercials count for a type with units renders locked, carrying the value, the fact and the destination. A type with no units stays an ordinary editable field. The server's 400 remains the backstop, and the Installation tab's summary line stays.

```
the SafeSight count renders locked, naming the count and where to correct it
  ("No. of SafeSight Cameras 5 Locked: 5 units exist. Correct it on the Installation and Commissioning tab.")
and a type with no units stays an ordinary editable field
the server still refuses a reasonless count change
  (400 SafeSight units already exist, so this count is locked. A correction needs a reason.)
```

**One departure from the vanilla's own sentence, stated:** it read "1 unit exist" at a count of one (`test-bed-detail.js:1036`). The verb agrees here. Found by opening the screenshot.

### R8: the installer list

It renders CLOSED until somebody types, and the empty state goes with it: "No matches." for a term nobody typed is an answer to a question nobody asked.

```
the installer list is CLOSED until somebody types  ({"search":true,"results":0,"nomatch":false,"resultsText":""})
the installer row is inside the capture           ({"top":471,"bottom":529,"vh":1000})
and typing opens it                               (5 results)
and clearing the box closes it again              (0 results)
```

**Four existing installer tests assumed the open list** (narrowing, the own-Account mark, and two feedback tests). Each now types first; their claims are unchanged.

### R11: a revision only when it carries a change

Measured on the live route, before and after:

```
BEFORE: {"status":200,"revision":"1 -> 2","newRevisionPayload":{"unitIndex":1,"stateSource":"Person"},"unitStatus":"Installed"}
AFTER:  {"status":200,"revision":"1 -> 1","newRevisionPayload":"(none appended)","unitStatus":"Installed"}
```

**What is given up, stated at the site:** with no append there is no revision precondition on a state-only write, so two people setting the state at once no longer collide. The state is one value, last-writer-wins is what a status column is, and the alternative is a revision that records nothing. R3 still refuses a body with no recognised key, so the only way to an empty patch is a real state change.

## Two defects this phase's own probe found

**1. The unit queue offered a revision that had already been consumed.** The row's four fields saving in one burst read `200:serialNumber | 409:latitude | 409:longitude | 200:state`, and the row told a person editing alone that **somebody else had changed the unit**.

- The queue was built once with the FIRST render's deps, and its Q3 revision came from `unitById`, which reads the HOST's state. The host learns the new revision only when React re-renders, which has not happened between two links of one chain.
- Two changes: the pane reads its deps through a ref (the same remedy `StageTabs` uses for the loader), and the queue holds the unit **the route last returned**, which is what the vanilla did with its own array (`test-bed-detail.js:3049-3060`).
- Invisible until this phase, because the row had ONE field and a single blur is a single write. Architecture 8: an unchanged path meeting a new demand.

**2. The rider clause, from the 1440 screenshot.** Each item is in a Phase 3 file:

| Item | What was wrong | Fixed as |
|---|---|---|
| the type sub-tabs | `sub-tab` without the estate's `detail-tab`, so browser-default buttons, and `.sub-tab.active` sets colour WHITE: the open tab's label was white on a white button | `detail-tab sub-tab` |
| the row's inputs | no `type` attribute, and the estate styles `input[type="text"]`, so the rule never matched | `type="text"`, plus `.tb-unit-row` columns so the fields line up |
| the install-note input and button | the same untyped input; the button had no class | `type="text"` and `btn-sm` |

**The stylesheet invariant caught my first attempt**: `var(--grey)` is not in the palette, and an undefined custom property drops the declaration silently. It is `--muted`.

## Calibration

**Unit, `scripts/testbed-units/unit-specs/p3-surface.mjs`: 8 of 8 FIRED on their named tests**, reverted React suite **1188/1188**: latitude's control removed; a state missing from the select; a field saving under a key the route does not take; the queue forgetting the route's revision; Apply live without a reason; the correction sent without its reason; the locked count rendered as an ordinary field; the installer list open with no search.

**One injection came back SILENT and the silence was the TEST, not a missing detector** (Verification 51). The revision-handover test was first written through the mounted component, and React re-renders between the two links there, so the host is current either way and the test could not fail with the queue's memory removed. It moved to the queue itself, where the host NEVER updates, and the injection then fired. The component-level attempt was removed, with the reason recorded at the site.

**Live, one injection per spec, sources and committed bundle restored byte-identical each time:**

| Spec | Injection | Result |
|---|---|---|
| `p3-r8` | the list renders with no search term | **FIRED** on "the installer list is CLOSED until somebody types" (16/18) |
| `p3-l3` | the locked count is an ordinary field again | **FIRED** on "the SafeSight count renders locked ..." (17/18) |

## Screenshots, opened and read (1440)

- `.verify/tb-units/p3-5/p3-unit-row-1440.png`: the rows with type, index, serial, latitude, longitude, state and "Saved", the readable type tabs, and the correction control below.
- `.verify/tb-units/p3-6/p3-commercials-locked-1440.png`: SafeSight and Air Quality locked with their sentences; HEMIR still an ordinary row.
- `.verify/tb-units/p3-final3/p3-installer-closed-1440.png`: the installer row with an empty search box and **no list**, the note input and ADD NOTE in the estate's treatment.

**One capture was superseded**: the first installer shot was the page above the fold and did not contain the row, so it showed nothing about the claim. The probe now scrolls the row into view and **asserts it is inside the frame** before shooting (Verification 4).

## Process notes

- **The journal guard refused two commits, correctly.** Once for a captured fixture (now declared generated in Phase 2), and once here for two unrouted edits to a probe that had become tracked. The probe was restored from HEAD, re-applied through `edit.mjs`, and diffed against the intended text before committing.
- **One probe run failed on a 30s navigation timeout** with no checks reached, and passed on the next run. Environment, not a finding: the same tree read 19/19.
- **Residue:** LIVE 0. **Ledger: 2 tags**, holding at what R7's prune leaves.

## For the list (Rule 10), not acted on

- **A state-only write has no revision precondition** (R11's stated trade).
- **The unit row has no per-field validation.** Latitude and longitude are refused by the server with its own message; the row shows that message and does not pre-empt it.
- **Carried and unchanged:** the buyer-role single-holder rule (R2, not yet built), K1's journal hole, the "a score of 1 or 2" refusal text, and the captured-fixture staleness treatment.

## What this does not establish

- **That B4's other fields behave under a burst on a slow connection.** The burst is proven in the queue and once live at four writes.
- **Anything at 1240 or 3440.** The live proofs are 1440, as instructed.
- **R2**, the single-holder buyer role: ruled in Phase 2's sign-off, not built, and not in Phase 3's scope.
