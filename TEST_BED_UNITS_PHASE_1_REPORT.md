# TEST BED UNITS: Phase 1 report (audit R1: a read never writes), with riders R4 and R5

**Model: Claude Opus 5 (claude-opus-5[1m]). Branch `test-bed-units`. Nothing pushed. B4 has not started.**

## Not done, first

- **K3 has no query plan.** PostgREST refused EXPLAIN (PGRST107). Going "through a function" would need a database function, which is a migration and outside a read-only rider, so it was not attempted. The timing evidence below stands without the plan.
- **K3 does not test scaling with total rows at two table sizes.** A read-only rider cannot change the table's size. What it does show is that one query costs the same whether its tag matches 0 rows or 1,677.
- **The full merge gate was not run.** The instruction asked for the pre-commit suites on each commit, and every commit below passed them.

## Commits (6, all on `test-bed-units`)

| Commit | What | Pre-commit hook |
|---|---|---|
| `3a9249c` | Brief: rulings R1 to R5 of record and the Phase 1 scope, before any work | PASS pure, react, typecheck, database 188.3s |
| `ec44b9d` | R4: the dev server binding | PASS, database 157.7s |
| `0aefff9` | R5: the K3 query measured alone (instrument) | PASS, database 168.2s |
| `676d540` | Phase 1: opening a tab never derives; the button alone does | PASS, database 188.1s |
| `a7bae97` | Phase 1 live instruments | PASS, database 171.1s |
| (this report) | | |

**Server diff this phase:** `src/server.js` only (R4). No route or migration changed.

## Step 1: rulings of record (`3a9249c`)

R1 to R5 are appended to `TEST_BED_UNITS_BRIEF.md` under "Rulings of record, at the Phase 0 sign-off (John, 2026-09-18)", with the Phase 1 scope beneath them, before any code:

| Ruling | Summary |
|---|---|
| R1 | sign-off |
| R2 | a buyer role is single-holder |
| R3 | an empty unit PATCH is refused with a 400 |
| R4 | the server binds 127.0.0.1 by default |
| R5 | K3 is a diagnostic item |

## Rider 2.1: the dev server binding (R4, `ec44b9d`)

`src/server.js`: `const host = process.env.HOST ?? '127.0.0.1'`, then `fastify.listen({ port, host })`, with the reasoning at the site. **Calibrated both directions against a restarted server:**

| Condition | Listener | 127.0.0.1 | localhost | LAN 192.168.18.115 |
|---|---|---|---|---|
| **Before** (0.0.0.0, the running server) | `*:3000` | 200 | - | **200** |
| **After, no HOST** (dev server restarted from the fix) | `127.0.0.1:3000` | **200** | **200** | **000, refused** |
| **HOST=0.0.0.0** (second instance on PORT 3099, stopped after) | `*:3099` | 200 | - | **200** |

The dev server was restarted from the committed fix (pid 2069, `npm run dev`), and localhost answers **200**. The one probe that reads an origin, `probe-readonly-view.mjs`, defaults to `http://localhost:3000/`, so it is unaffected. The macOS firewall is John's action, per R4.

## Rider 2.2: K3 measured (R5, `0aefff9`, read-only, nothing fixed)

The moving test (`teardown-scoping.test.mjs:145`) weighs each ledger tag with:
`record_revisions.select('id', {count:'exact', head:true}).ilike('payload->>name', '<tag>%')`

`scripts/testbed-units/k3-query-timing.mjs`, 5 samples each, minimum reported:

| Query | Rows matched | Min | Samples (ms) |
|---|---|---|---|
| `record_revisions` total count | 115,915 | 168ms | 812/248/225/178/168 |
| weigh `a1deep` (the test's own, heavy) | **1,677** | **307ms** | 484/395/307/359/358 |
| weigh `a1pad1` | 375 | 344ms | 412/359/344/420/355 |
| weigh one run's tag `TBUNITS-P06-...` | 6 | 323ms | 361/413/409/408/323 |
| weigh `zz-no-such-tag` (**zero population**, control) | **0** | **307ms** | 460/307/315/443/405 |
| **the whole weighing loop, once, as the test runs it** | 31,746 over 105 tags | **38.4s** | one pass |

**Answer 1: yes, the ilike-over-JSON scan is the cost of each query, and it does not depend on the tag population.** A tag matching nothing costs the same 307ms minimum as a tag matching 1,677 rows, so every weigh reads the whole of `record_revisions`. **The EXPLAIN that would confirm a sequential scan was refused**:

```
{"message":"None of these media types are available: application/vnd.pgrst.plan+text; for=\"application/json\"; options=analyze","code":"PGRST107"}
```

**Answer 2: the test's cost scales with (ledger tag count) x (full-table scan), not with the tag population.**
- **The ledger is append-only.** `rememberTag` (`scripts/fixtures.mjs:133-138`) is the only writer of `.scratch/fixture-tags.json`, and nothing prunes it. It holds **107 tags; 80 of them carry a timestamp from 2026-09-17**, created by this session's probes (TBCORE-P4 29, TBCORE-P0 14, and so on). The other 27 carry no timestamp.
- **The ledger file was born 2026-09-15 22:16**, 54 minutes before the 34.0s baseline gate (09-15 23:10). That baseline weighed a nearly empty ledger.
- **Estimate, from measured values rather than measured directly:** 80 added tags x the loop's own average of 0.366s per tag (38.4s / 105) comes to about **29s of the +43s** rise. The rest (the population query, pad fixtures, `record_revisions` growth) is not separated.
- **Growth in total rows is not tested at two sizes**, because a read-only rider cannot change the table.

**The Phase 0 instrument failure is explained.** My Phase 0 count queried `records.payload->>name`, and **`records` has no `payload` column** (payload lives in `record_revisions`). With `head: true` a HEAD response carries no body, so the error message arrived empty. The same shape fails again here in 171ms with `{"message":""}`. It was an instrument aimed at a column that does not exist, not a timeout.

## Phase 1: R1, a read never writes (`676d540`)

**Built:**
- `stageLoad.ts` no longer has an `onDeriveUnits` dependency, and the P7 call is gone. The site now carries the superseding reason, quoting the vanilla's own ruling: "A write must not be the consequence of a read."
- `StageTabs.tsx` no longer wires derive into the loader. `deps.onDeriveUnits` now reaches **only** the units pane's button (`onDerive={deps.onDeriveUnits}`).
- The host's `onDeriveUnits` (the POST and the reload of units) is unchanged and serves the button.

**Superseded, stated:** the existing loader test "P7 units are derived only for the stage that owns them" asserted **exactly one derive on opening Installation**, which is the regression written as a contract. It now asserts that opening any tab derives nothing, even with a derive callback smuggled into the loader's dependencies.

### The guard test: red before, green after

`frontend-react/src/__tests__/testbed-units-derive.test.tsx`, 3 tests, through the **real host**. It is driven by `fixtures/units-live.json`, captured from the routes by `scripts/testbed-units/capture-units.mjs`:
- the bed with counts;
- the empty units list;
- derive answering 200 `created: 3`;
- the units list after.

Every API call is recorded.

**Red on the pre-fix code** (committed tree `0aefff9`, fix not yet applied), 3 of 3 failing. The first failure names the derive assertion:

```
AssertionError: opening the tab POSTed /units/derive: expected [ { method: 'POST', …(1) } ] to have a length of +0 but got 1
AssertionError: expected undefined to be 'Create the missing units'
TypeError: Cannot read properties of null (reading 'click')
```

**Green after the fix:** 29/29 across the guard file and `testbed-stage-tabs.test.ts`; typecheck clean.

**Unit calibration, `calibrate-unit.mjs` with spec `scripts/testbed-units/unit-specs/p1-r1.mjs`: 3 of 3 FIRED on their named tests. The React suite passed 1174/1174 after each injection was reverted.**

| Injection | Fired on |
|---|---|
| derive re-wired to showing the install section (host level) | "opening the Installation tab sends NO write, and derive never fires" |
| the loader calls a derive dependency on Installation | "P7 opening ANY tab derives nothing, Installation and Commissioning included" |
| the button no longer derives | "the BUTTON derives: exactly one derive POST, and the pane shows the units the route returned" |

### Live proof: probe-p1-r1.mjs, 10/10 (run `p1-r1-2`)

Owned tagged fixture, with counts set through the API (SafeSight 2, Air Quality 1, HEMIR 0) and **0 units**:

```
A  the tab really loaded: the stage loader read this stage, and the pane had its units list  (1 stage read, 1 units read at mount)
   opening the tab sent ZERO non-GET requests, any origin  (none)
   and no /units/derive request at all  (0)
   the DATABASE still holds 0 units for the bed  (0)
   the button is offered, enabled, in view and reachable by a click  (hit: true)
   the pane says 3 planned, 0 built  ("3 planned, 0 built, 3 to derive")
B  the click sent exactly ONE derive POST, answered 200
   and no other write  (1 non-GET)
   the DATABASE now holds 3 units (SafeSight 2 + Air Quality 1)  (3)
   the pane reads them back: 3 planned, 3 built
teardown: removed 5 (test_bed,account,unit,unit,unit), remaining 0
```

**The first run was 9/10, and the failure was my probe, not the product.** It asserted that opening the tab reads `GET /units`, but the host reads the units list once on mount, not per tab. The check now anchors on the stage loader's own read for the Installation stage, which only a real tab-open sends. That is Verification 17: a probe must be shown to discriminate on the system under test.

**Live calibration, `calibrate-live.mjs`, one injection per spec, sources and committed bundle restored byte-identical each time:**

| Spec | Injection | Result |
|---|---|---|
| `p1-r1-a` | derive re-wired to tab open | **FIRED**: "opening the tab sent ZERO non-GET requests" (a POST /units/derive observed) and "the DATABASE still holds 0 units" (3). Teardown removed the 3 units |
| `p1-r1-b` | the button disconnected | **FIRED**: "the click sent exactly ONE derive POST" and "the DATABASE now holds 3 units" (0) |

**Screenshot, opened and read:** `.verify/tb-units/p1-r1-2/p1-install-tab-fresh-1440.png`, captured after every measurement, of the page with the button scrolled into view. It shows the Installation tab freshly opened, reading **"3 planned, 0 built, 3 to derive"**, **"No SafeSight units yet."**, **"3 units planned and not yet created."**, and the **Create the missing units** button. Nothing has been created.

**Residue:** `LIVE: 0` for probe-identity records created since 2026-09-17T13:00Z; live units created since then: 0.

## Seen in the screenshot, NOT created by Phase 1 (Rule 10: on the list)

These are on the Installation tab and predate this phase. Each is visible in the capture:
- The installer search list renders **open**, over the Tech Team heading, listing other Accounts' names ("looney tunes cartoons", "walt disney Studios Ltd", ...) with nobody typing.
- The unit type sub-tabs are browser-default buttons, and the **active SafeSight tab shows no readable label** (a blank white box). "Air Quality" and "HEMIR" render as small white buttons.
- The install-note input and its "Add note" button are browser defaults, flush against the units summary line.

## For the list

- K3's remedy options, for a ruling, not taken:
  - prune the append-only ledger on a clean teardown;
  - weigh tags from a single grouped query instead of one full scan per tag;
  - index the name expression.
- The three screenshot defects above.

## What this does not establish

- **B4, L2, L3 and L4.** Not started, as instructed.
- **K3's query plan.** EXPLAIN refused.
- **K3's scaling with total rows**, which cannot be varied read-only. How much of K3's rise the 80 added tags explain is an estimate from measured values.
- **Whether a VPN or LAN peer could reach the old binding from another host.** The before and after measurements are from this machine.
