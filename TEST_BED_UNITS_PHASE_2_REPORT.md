# TEST BED UNITS: Phase 2 report (audit B4 with ruling R3), and R7

**Model: Claude Opus 5 (claude-opus-5[1m]). Branch `test-bed-units`. Nothing pushed. L2, L3, L4 and R8 have not started.**

## Not done, first

- **R7 landed HALF as ruled, and the other half was reverted on measurement.** The ledger prune is in and is the whole of the gain. "Weigh all tags in ONE grouped query" was built, measured **worse twice**, and reverted. It needs your ruling (below).
- **L2, L3, L4 and R8** are untouched, as instructed.
- **The full merge gate was not run.** Every commit passed the pre-commit suites.

## Commits (5, all on `test-bed-units`)

| Commit | What | Pre-commit database stage |
|---|---|---|
| `5b34294` | Brief: rulings R6, R7, R8 and the Phase 2 scope, before any work | 160.5s |
| `c2767ef` | R7: the ledger prunes on a clean teardown; dead entries swept once | 104.8s |
| `2d680e5` | Phase 2: B4's three breaks and R3's refusal | 109.8s |
| `079864c` | Phase 2 instruments: live specs and R3's own calibration harness | 101.0s |
| (this report) | | |

**Server diff this phase:** `src/routes/test-beds.js`, +17 lines, the R3 refusal. No migration.

## R7: the ledger prune (`c2767ef`), and the half that was reverted

**What is in:**
- `tearDown` prunes the tags it swept, placed after its own re-query has proved none of them is live, so a dirty teardown throws before reaching it.
- `scripts/testbed-units/prune-ledger.mjs` clears entries written before that existed, in one grouped query: **all 107 ledger tags had no live record**, so the ledger went **107 to 2**.

**Calibrated on the same tree, database suite alone, nothing else running:**

| Run | Stage | The moving test | Ledger |
|---|---|---|---|
| **before** | **143s** | **71.2s** | 112 tags |
| after, grouped query only | 201s | 131.9s | 107 |
| after, grouped query, ledger pruned | 208s | 136.2s | 2 |
| **after, prune only (what is committed)** | **100s** | **32.9s** | 2 |

Since then the hook's database stage reads **99 to 110s**, against 150 to 190s before.

**Why the grouped query lost, measured rather than argued.** Per-tag counts use `head: true`, so the server counts and returns no rows. One grouped query has to **fetch the matching rows** to tally them per tag, and PostgREST pages them 1,000 at a time: 31,746 rows over 107 tags. Counting scans; fetching scans and transfers. **The ruling's premise, that the per-tag scans were the cost, is right; the remedy costs more than the disease** (Verification 29: a premise that fails means the decision is re-taken, not re-weighed).

**Your ruling, please:** leave the weighing per tag now that the ledger is short (2 tags today, and it prunes itself), or take a different grouping. A per-tag grouped count needs an RPC, which is a migration, which R7 rules out for now.

## Phase 2: B4 and R3 (`2d680e5`)

**The three breaks, each fixed at its own site:**

| Break | Was | Now |
|---|---|---|
| the route | `PATCH /api/units/:unitId`, which does not exist (`TestBedHost.tsx`) | `PATCH /api/test-beds/:id/units/:unitId` |
| the wrap | `{ payload: { [field]: value } }`, which the server does not read | flat: `{ [field]: value, expected_revision }` |
| the field name | `serial`, on both the read and the write (`UnitsPane.tsx`) | `serialNumber`, the key the route returns and accepts |

**R3, server-side** (`src/routes/test-beds.js`): a unit PATCH whose body carries no recognised key is answered **400** with `No unit field to save. This route takes flat keys: serialNumber, latitude, longitude, stateSource, state.` and **no revision is appended**. `state` counts as recognised, because it is applied against `records.status` and is a real write.

**Why R3 is part of B4 rather than a nicety:** measured in Phase 0, with only the route corrected the server answered **200** to a wrapped body and to an unknown key, stored nothing, and advanced the unit's revision. A B4 fix that stopped at the route would have looked finished.

### Live proof: probe-p2-b4.mjs, pre-fix and post-fix

Owned tagged fixture, one SafeSight unit created deliberately through the derive route.

**Pre-fix (`p2-pre`), on the tree before the fix: 1/14.** The single pass is the positive control, which is what makes the other thirteen readable:

```
FAIL  the save goes to the REAL route          (/api/units/36e6d77f-...)
FAIL  the body is FLAT and names serialNumber  ({"payload":{"serial":"SN-..."},"expected_revision":1})
FAIL  the route answered 200                   (404)
FAIL  the DATABASE holds the typed serial      (before null, after null)
FAIL  the row says Saved                       ("Not Found")
      a WRAPPED body   -> {"status":200,"revision":"1 -> 2"}      <- the silent 200
      an UNKNOWN key   -> {"status":200,"revision":"2 -> 3"}      <- the silent 200
      the OLD name     -> {"status":200,"revision":"3 -> 4"}      <- the silent 200
PASS  the route still ACCEPTS a real key, stores it and moves the revision
```

**Post-fix (`p2-post`): 14/14.**

```
A  the save goes to the REAL route, PATCH /test-beds/:id/units/:unitId
   the body is FLAT and names serialNumber   ({"serialNumber":"SN-1789685217140","expected_revision":1})
   the route answered 200
   the DATABASE holds the typed serial       (before null, after "SN-1789685217140")
   exactly one new unit revision             (1 -> 2)
   the row says Saved
   and it is still on the screen after a reload
B  a wrapped body is REFUSED 400, not answered 200
   and no revision is appended for it        (2 -> 2)
   the refusal NAMES what it would accept
   an unknown key is REFUSED 400             (2 -> 2)
   the old field name alone is REFUSED 400
   the route still ACCEPTS a real key, stores it and moves the revision  (2 -> 3)
```

**The server was restarted from the changed source before the probe ran**, and the running process was confirmed to carry the refusal (CLAUDE.md build discipline 9's stale-server clause).

**Screenshot, opened and read:** `.verify/tb-units/p2-post/p2-unit-serial-1440.png`. After the reload it shows the SafeSight row carrying `SN-1789685217140`, with "1 planned, 1 built" and "1 count locked: units exist. SafeSight 1" above it.

### Guard tests, red before and green after

`frontend-react/src/__tests__/testbed-units-save.test.tsx`, 3 tests through the real host, driven by `units-live.json` captured from the routes. The capture was extended to include a unit that **carries** a serial, so the prefill test reads the route's own shape.

- **The silent-200 shape has its own test:** the probe's section B, which is red pre-fix on "a wrapped body is REFUSED 400" and "an unknown key is REFUSED 400", both reading 200 with the revision moving.
- **Unit calibration, `scripts/testbed-units/unit-specs/p2-b4.mjs`: 4 of 4 FIRED on their named tests**, reverted React suite **1177/1177**: the route reinstated, the wrap reinstated, the field name reinstated on the write, and the field name reinstated on the read.
- **Live calibration spec b** (break 1 back in the client): **FIRED** on "the save goes to the REAL route" and "the DATABASE holds the typed serial"; sources and bundle restored byte-identical.
- **R3's own calibration**, `scripts/testbed-units/calibrate-r3-server.mjs`:

```
snapshot verified, sha 3a71bf101ca6
INJECTED (R3 disabled): a wrapped body -> {"status":200,"error":null,"unitRevision":2}
probe on the injected server: 8/14, FIRED on "a wrapped body is REFUSED 400" +
  "and no revision is appended for it" + "an unknown key is REFUSED 400"
restored: sha 3a71bf101ca6, byte-identical to the snapshot: true
AFTER RESTORE (R3 live again): a wrapped body -> {"status":400,"error":"No unit field to save...","unitRevision":1}
```

## Two harness findings, both from this phase's own runs

1. **`calibrate-live.mjs` STOPS on a server-only injection, and leaves the injection applied.** It requires the injected source to change the served bundle, which is right: a bundle that did not change is not the thing it built. But a route change never touches the bundle, so it stopped with `STOPPED: the bundle did not change` **after writing the injection**, leaving `src/routes/test-beds.js` mutated and its IN-FLIGHT marker in place. The dev server runs under `--watch`, so the mutated route went live.
   - **What it cost:** the next spec's run (spec b) executed against a server with R3 disabled, so its section B read 200s. Its own verdict was unaffected, and it was re-run clean afterwards.
   - **Recovered with the discipline the harness itself uses:** the route file was restored from the harness's own snapshot, the snapshot's sha and the restored sha compared and equal (`3a71bf101ca6`), the file confirmed equal to HEAD, and the marker removed only then.
   - **This is Verification 44's own shape**: a harness that stops mid-flight must restore or refuse to continue. It refuses the next run correctly, and it does not undo the write. **Not fixed here** (it is Round A's instrument and this phase is B4); `calibrate-r3-server.mjs` shows the shape a fix would take.
2. **A silence that was my own environment, not a missing detector.** The first R3 calibration reported SILENT with the probe printing nothing: I ran it without the browser variables, so the probe died before its first check. Re-run with them, it FIRED on three named checks. Verification 51's caveat exactly: explain the silence before believing it.

**One more, small:** the pre-commit journal guard refused the Phase 2 commit because `units-live.json` is written by the capture script, not by hand. Captured fixtures are now declared generated in `scripts/hooks/journal-guard.mjs`, with the reason at the site.

## Residue and state

- **Residue:** LIVE 0 for probe-identity records created since 22:00Z.
- **Ledger:** 2 tags.
- **Working tree:** clean; the route file byte-identical to HEAD.

## For the list (Rule 10), not acted on

- **R7's grouped query**, above, for your ruling.
- **`calibrate-live.mjs` leaving an injection applied when it stops.**
- **A state-only unit PATCH still appends an empty revision.** R3 refuses a body with no recognised key; `{ state: 'Installed' }` alone is recognised, is applied to `records.status`, and still writes a revision carrying `{}`. Unchanged by this phase, and visible now that the neighbouring case is refused.
- **R8 and the styling items**, as ruled: not started.

## What this does not establish

- **L2, L3 and L4.** Not started.
- **Latitude, longitude and state through the UI.** The row still offers only the serial, so only that field's contract is proven end to end. The route accepts the others, and the probe exercises `serialNumber` alone.
- **That the grouped query could not be made cheap another way.** It was measured as built, and reverted.
