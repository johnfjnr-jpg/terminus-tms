# TEST BED UNITS: Phase 0 report (measure before build)

**Model: Claude Opus 5 (claude-opus-5[1m]). Branch `test-bed-units`, off `main` at `02534a9`. Nothing pushed. No fixes and no behaviour changes.**

## Not done, first

- **The build phases are not written.** The brief says they follow from this report.
- **P0.2 (K3) answers "one test or all", but does not explain why that one test grew.** The population query that would explain it failed on its own calibration row (below).
- **P0.5 carries no screenshot of the unit pane.** The 1440 capture shows the Installation tab above the pane, so the P0.5 claims rest on live DOM reads, not on the image.

## Precondition

- `git fetch origin`: `origin/main` = `5a60aeb`.
- Local `main` = `02534a9`, exactly **1** commit ahead (the convention commit) and 0 behind.
- Working tree clean.
- **Holds.**

## Item zero: the dev server binding (report only, nothing changed)

| What | Measured |
|---|---|
| Listen call | `src/server.js:204`: `await fastify.listen({ port, host: '0.0.0.0' })`. Hardcoded since `ecabeb3` (Milestone 1). `HOST` is not read, and not set in `.env` |
| Live listener | `node 93948 ... TCP *:3000 (LISTEN)`: **all interfaces** |
| Interfaces present | `lo0` 127.0.0.1; `en1` 192.168.18.115 (LAN); `utun2` 100.66.231.212 (NordVPN NordLynx, **connected**) |
| Answers on | 127.0.0.1 -> 200; **192.168.18.115 (LAN address) -> 200**; 100.66.231.212 -> no answer from this machine within 3s |
| macOS firewall | **Disabled** (state 0); incoming to node **permitted** |
| The log line "listening at http://100.66.231.212:3000" | Fastify printing one of the bound addresses. It is not a VPN-only binding |

**Verdict: it binds all interfaces, not localhost only and not the VPN address specifically.**
- **LAN:** anything that can reach this Mac on its network can reach the app, because the firewall is off. I proved the socket answers on the LAN address from this machine. I did not test from another host.
- **VPN:** not answering from this machine. Whether a VPN peer can reach it is **not measured and not answerable from here**. NordVPN's 100.64.0.0/10 range is also its Meshnet range, so it depends on whether Meshnet is enabled, which is a dashboard setting.

**Rule 13 risk:** the rule forbids public hosting until sign-in is restricted in the application. Binding `0.0.0.0` with the firewall off is **not publishing, but it is the precondition's exposure in miniature.** On a shared or public network, the sign-in screen and API are reachable by anyone on that network. Sign-in still accepts any Google identity that the Supabase project allows. The mitigation is still the OAuth console's Testing mode, not the application.

**Recommended fix (not applied):**
1. `host: process.env.HOST ?? '127.0.0.1'` in `src/server.js`, so localhost is the default and LAN exposure is opt-in and visible.
2. Turn the macOS firewall on.

Both are one-line changes. The first is a server change and belongs to a round that scopes it.

## Step 1: the brief

`TEST_BED_UNITS_BRIEF.md`, commit **`a54e095`**, docs only. It holds:
- the scope (R1 ranked first, B4, L2, L3, L4, as one mechanism);
- the two openers;
- the four carried items;
- the rider clause (L7, L8, L10, L12, C9);
- the standing constraints;
- the Phase 0 list.

**Departure, stated: the brief is committed on a new branch, `test-bed-units`, not on `main`.** CLAUDE.md build-discipline rule 9 is "create the round branch before Phase 1 begins", and Phase 0 needed committed instruments. `main` is untouched at `02534a9`.

## P0.1 Measurability: the live write, proven (opener 1, closing Round A exit gate point 1)

Owned fixture at Qualification, driven through the real `tb-measurability-select` on the Qualification stage tab:

| Step | Evidence |
|---|---|
| Control before | enabled, visible, reads "Not confirmed" |
| Request | `POST /api/test-beds/:id/measurability` with body `{"confirmed":true}`, answered **201**: `{"entry":{"at":"2026-09-17T13:31:24.802Z","by":"john+test@...","value":true,"stage":"Qualification"},"entries":1,"record_revision_number":2}` |
| Database | revision **1 -> 2**; `payload.measurabilityConfirmed` = `[{"at":"2026-09-17T13:31:24.802Z","by":"john+test@...","stage":"Qualification","value":true}]` |
| Screen after | value reads **"Yes"**; entry line "17/09/26 21:31:24 john+test@... Yes at Qualification"; no error |
| Gate | Qualification exit criteria row "Sensors can capture what would be measured" reads **met: true** |

**VERDICT: WRITE PROVEN.** It was sent, stored as true, shown on screen, and the gate reads it met. **Round A exit gate point 1 is closed.**

## P0.2 K3: ONE test moved, not all of them

Two full `npm run test:db` runs, back to back, with nothing else running. The dev server was idle, and an idle, hung `edit.mjs` call of mine was waiting on stdin during run 2 (killed afterwards, no CPU):

| Run | Wall | Sum of per-test durations | Load at start |
|---|---|---|---|
| run 1 (13:23Z) | 152s (`duration_ms` 152166.6) | 134.0s | 5.18 |
| run 2 (13:26Z) | 156s (`duration_ms` 156430.8) | 137.8s | 1.50 |

**The baseline is the lowest-floor serial run on record:** the gate at 2026-09-15 23:10 (`verify-6855904760916.txt`), stage 110.1s, per-test sum 92.4s, 102 tests.
- **Why that run:** the suite went serial in `0b0f87e` (2026-09-14 15:05). Earlier gate outputs ran files concurrently, where per-test sums exceed wall time (for example 105.7s summed in a 39.8s stage), so they are not comparable.
- **The earlier "112.5s floor"** came from pre-commit hooks, which keep no per-test output. This gate is the closest per-test record to it.

Parsed by `scripts/testbed-units/k3-per-test.mjs`, which reads each run's own lines:

```
tests present in every run: 102; only in later runs: 0
summed growth over shared tests, base -> min(later): +46.8s
  +43.0s  34045 -> 77033 / 77788  tearDown reaches a record beyond row 1,000 of its own tag population
  +1.8s    2971 -> 4833 / 4731    tearDown sweeps its own tag AND leaves another round's tag standing
  +0.3s    1250 -> 1543 / 1805    child_record_status clears when a matching child exists
  +0.3s    1743 -> 2000 / 2189    INVARIANT: no stage_gate_rules row or approvals.stage names a stage absent ...
  +0.2s     690 -> 947 / 905      999 to 1000 boundary: padding grows, nothing truncates
the top 5 movers account for 97% of the summed growth
```

**Answer: one test.** `scripts/tests/teardown-scoping.test.mjs:145`, "tearDown reaches a record beyond row 1,000 of its own tag population", accounts for **+43.0s of +46.8s (92%)**. A second teardown test adds +1.8s. Every other test is within noise. No test was added, so the count is 102 throughout.

**Its history across every serial gate output kept on disk:**

| When | Duration |
|---|---|
| 09-14 22:45 | 34.2s |
| 09-15 09:32 to 17:23 | 37.7, 41.6, 40.2, 44.3, 67.6, 45.5s |
| 09-15 23:10 | 34.0s |
| 09-16 | 60.3, 55.4, 48.3, 47.9, 58.5s |
| 09-17 gates | 76.3, 81.8, 75.8, 74.7, 85.7s |
| This phase's two runs | 77.0, 77.8s |

**The floor of that one test doubled in three days. That is the stage's 29% floor rise.**

**What it scales with, NOT established.** The test builds its sweep set from "the heaviest historical tags, until the population is over the cap", counted exactly by `payload->>name ilike <tag>%` across `records` (80,094 rows now). So its cost plausibly tracks the accumulated fixture population, which every database run adds to.

**My attempt to count that population failed on its own calibration row** (a `TBCORE%` count, known present, returned an error with an empty message). So it is not a measurement. It is consistent with an unindexed `ilike` over JSON, but that is unproven.

**Next discriminating measurement:** time that query alone at two table sizes, or `EXPLAIN` it through a function.

## P0.3 B4 reproduced live: all three breaks, separated

Owned fixture, one SafeSight unit created **deliberately** by `POST /units/derive` (the button's path), so it does not depend on R1. A serial typed into the unit row on the Installation tab, then blurred:

| | Request | Response | Database | Code site of the break |
|---|---|---|---|---|
| **UI save** (as shipped) | `PATCH /api/units/<unitId>` with body `{"payload":{"serial":"SN-P03-UI"},"expected_revision":1}` | **404** `Route PATCH:/api/units/<id> not found` | revision 1 -> 1; `serialNumber` null. Row reads "Not Found" | - |
| **Break 1: route** | client calls `/api/units/:unitId` | the server's route is `PATCH /test-beds/:id/units/:unitId` | - | `frontend-react/src/testbed/TestBedHost.tsx:623-625`; the server at `src/routes/test-beds.js:1841` |
| **Break 1 fixed, body still wrapped** | `PATCH /test-beds/:id/units/:unitId` with `{"payload":{"serial":"SN-WRAPPED"},"expected_revision":1}` | **200**, unit returned with `serialNumber: null` | revision **1 -> 2**; stored keys `[unitIndex, stateSource]`; **nothing written** | **Break 2, the wrap:** `TestBedHost.tsx:625`, `{ payload: { [field]: value } }`, while the server reads flat keys at `test-beds.js:1877-1880` |
| **Breaks 1+2 fixed, field still `serial`** | `{"serial":"SN-FLAT-SERIAL","expected_revision":2}` | **200**, `serialNumber: null` | revision **2 -> 3**; **nothing written** | **Break 3, the name:** `UnitsPane.tsx:59-61` writes `'serial'`; the server accepts only `serialNumber, latitude, longitude, stateSource` at `test-beds.js:1878` (plus `state` at `1850`) |
| **Positive control: all three fixed** | `{"serialNumber":"SN-CONTROL","expected_revision":3}` | **200**, `serialNumber: "SN-CONTROL"` | revision 3 -> 4; `serialNumber` **stored** | - |

**A finding beyond the audit's description: breaks 2 and 3 are SILENT.** Fixing only the route would turn a visible 404 into a **200 that writes nothing and advances the unit's revision.** The route appends a revision carrying an empty patch and answers success. That is Verification 40's "a 2xx is not a write", produced by the server when it accepts a body with no recognised keys. **A B4 fix that stops at the route would look finished.**

## P0.4 R1 reproduced live: a read created unit records

Owned fixture, counts set through the API (SafeSight 2, Air Quality 1, HEMIR 0), units 0.

| Step | Evidence |
|---|---|
| Derive POSTs before the tab | **0** |
| Opening the Installation and Commissioning tab, with **no click inside it** | **1** `POST /api/test-beds/:id/units/derive`, body `{}`, **200**, `{"created":3, ...}` |
| Units in the database | **0 -> 3**, all Planned: `aaf5743c-...` (13:31:34.93Z), `7bb2b85c-...` (13:31:35.14Z), `5d1569c2-...` (13:31:35.37Z) |
| Interactions with that fixture's Installation tab afterwards | **0** |
| Teardown | tag `TBUNITS-P04-1789651871625`: removed account, test_bed and all **3 units**; remaining 0 |

**VERDICT: R1 REPRODUCED.** Opening the tab is a write. The mechanism is `stageLoad.ts:74-76` (`if (isInstall) deps.onDeriveUnits?.()`), which calls the host's `onDeriveUnits` at `TestBedHost.tsx:618-621`.

**It fired on every fixture whose Installation tab was opened:** P0.3 and P0.5 each logged one derive POST on opening. Those were idempotent, because their units already existed.

## P0.5 The unit surface against the vanilla at 54001c5^, by capability

Owned fixture with SafeSight 2 and Air Quality 1, units created deliberately (3). Read live at 1440:

| Capability | Vanilla at 54001c5^ | Current (merged main), measured | Status |
|---|---|---|---|
| **L3: a locked count says it is locked, where it is edited** | `renderTbSensorCounts` replaces the count field with `tbLockedCountRow`: the number, "Locked: N units exist. Correct it on the Installation and Commissioning tab." (`test-bed-detail.js:1030-1046`) | Commercials count rows for SafeSight (2), Air Quality (1) and HEMIR (0) are **ordinary editable rows**: not read-only, tab stop 0, no lock text anywhere on the tab | **ABSENT where edited** |
| **L3: the consequence** | the field is not offered | Editing SafeSight and pressing Save sends `PATCH {"payload":{"safesightCameras":"23"}}`, answered **400** "SafeSight units already exist, so this count is locked. A correction needs a reason." The screen shows that sentence **after** the attempt; the stored value stays 2. (The probe's select-all did not take, so it typed 23, not 3. The refusal is the same.) | **refused at save, not prevented** |
| **L3: a lock summary** | per count row | One line on the **Installation** tab: "2 counts locked: units exist. SafeSight 2, Air Quality 1" (`LockedCounts`) | **PARTIAL**, on a different tab from the fields |
| **L2: count correction (new count plus a mandatory reason)** | `renderTbCountCorrection` on the Installation tab, per open type: count input, "Why is the count wrong?" input, Apply (disabled until both filled), sent as `payload` plus `countCorrectionReason` (`test-bed-detail.js:3239-3281`) | Correction area **empty** (innerHTML length 0); no reason input anywhere in the view. The only control in that slot is "Create the missing units", shown only when a count exceeds its units | **ABSENT.** Counts are uncorrectable from the UI, while the server accepts `countCorrectionReason` |
| **L4: unit fields per row** | table per type: index, serial (`serialNumber`), latitude, longitude, state select (Planned/Installed/Faulty/Removed), per-row feedback (`test-bed-detail.js:2924-2951`) | First SafeSight row: text "SafeSight", **one** control, `input:tb-unit-serial-<id>` (and that save is B4-broken). `GET /units` already returns `serialNumber, latitude, longitude, state, index, stateSource, revision_number` | **ABSENT:** latitude, longitude, state and index. **DIFFERS:** serial is bound to the wrong key |
| **Derive: the slots are created by a person** | read-only render; a button creates them ("A write must not be the consequence of a read", `test-bed-detail.js:3099-3104`) | "Create the missing units" button **exists** (`UnitsPane.tsx:76-84`), **and** opening the tab derives anyway (R1) | **BOTH:** the vanilla's button plus the regression |

Header summary on the Installation tab: "3 planned, 3 built".

## P0.6 The carried route: a second contact in an already-linked role

Owned fixture, two contacts (Alpha, Beta) on the bed's Account, through the API:

| Attempt | Response | Rows for "Client Commercial Buyer" |
|---|---|---|
| Link Alpha | **201** `{"ok":true,"role":"Client Commercial Buyer","contact_id":"<Alpha>"}` | 1 |
| **Link Beta, same role (the wrongful accept)** | **201** `{"ok":true, ...,"contact_id":"<Beta>"}` | **2**. `GET /test-beds/:id` returns both, each named |
| Link Alpha again, same role (the one refusal that exists) | **409** `{"error":"That would duplicate a value this record already has. Reload and try again."}` | 2 |

Audit rows `buyer_contact_linked`: 2.

**Why the two differ:** `record_contacts` is unique on the same record, contact and role (`unique (record_id, contact_id, role)`, `20260812000003_record_contacts.sql:27`, which governs the text `role` this route writes; the `role_id` and `role_other` partials are `20260827000003_record_contacts_role_reference.sql:116-123`). **Nothing constrains one contact per role**, and the route (`src/routes/test-beds.js`, POST `/test-beds/:id/buyer-contacts`) checks role validity, contact existence and Account match, but never whether the role is already held.

**What a refusal should look like, per the estate's own precedent** (`src/routes/opportunities.js:1327-1342`: "A DUPLICATE IS A SENTENCE, NOT A 500"): a **409** with a sentence naming the situation, checked before the insert. For example, "That role already has a contact on this Test Bed." Today's generic 409 names neither the role nor the contact, and it covers only the same-contact case.

**Open question for John:** is a buyer role single-holder? The schema, the route and the vanilla (one read-only display per role) do not agree on this today.

## Instruments (new files, committed with this report)

- `scripts/testbed-units/probe-p0.mjs`: sections P01, P04, P03, P05, P06, each on its own tagged fixture, torn down by tag. **UNWIRED.**
- `scripts/testbed-units/k3-per-test.mjs`: per-test duration parser and differ for database-suite outputs.

**Runs:**
- `p0-1`: P01, P04 and P03 completed. **P05 timed out** (a network-idle wait never settled after the save) before its Installation read. Its fixture was still torn down.
- `p0-2`: P05 and P06, **exit 0**. The P05 wait was replaced by a fixed settle after the PATCH was observed done, and step logs were added.

**Teardown:** every tag reported `remaining 0`, including all derived units:

| Tag | Removed |
|---|---|
| P01 | 2 |
| P04 | 5 |
| P03 | 3 |
| P05 (twice) | 5 each |
| P06 | 4 |

## For the list (Rule 10), not acted on

- **The dev server binds all interfaces with the firewall off** (item zero). The fix is recommended above; it is a server change.
- **The unit PATCH route accepts a body with no recognised key, answers 200 and appends an empty revision** (P0.3). Relevant to B4's fix, and a Verification 40 shape in the server itself.
- **The buyer-contacts route performs no ownership check of its own** (read in P0.6's source; not exercised). The door is client-side. Named, not measured.

## What this does not establish

- **Why the teardown test's population grew**, or that the `ilike` is the cost (P0.2).
- **Whether a VPN peer can reach the dev server** (item zero).
- **Any unit-surface layout or visual claim.** P0.5 is DOM reads; the capture does not contain the pane.
- **The vanilla's count correction and unit table live.** They are read from source at 54001c5^, not run.
