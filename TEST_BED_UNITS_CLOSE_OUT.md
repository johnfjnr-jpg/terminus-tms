# TEST BED UNITS: round close-out

**Model: Claude Opus 5 (claude-opus-5[1m]). Branch `test-bed-units`, 23 commits off `main` at `02534a9`. Nothing pushed, nothing merged.**

## Not done, first

- **Nothing is pushed and nothing is merged**, whatever the gate says.
- **Promotions are PROPOSED, not landed.** CLAUDE.md is unchanged by this round.
- **Three items carry to the next round**, named below: K1's journal hole, the "a score of 1 or 2" refusal text, and a staleness treatment for captured fixtures.
- **The full gate is GREEN**: 24 of 24 stages on `b8605a3`, the final committed tree. Stage by stage below.

## What landed, per phase

| Phase | What | Commits |
|---|---|---|
| Brief | scope by audit item, carries, openers, rider clause | `a54e095` |
| **Phase 0** | measurements only: the measurability write proven, K3 localised, B4 and R1 reproduced live, L2/L3/L4 measured by capability, the second-contact route reproduced | `05b4f65` |
| Rulings R1 to R5 | appended at the phase they launched | `3a9249c` |
| **R4** | the dev server binds 127.0.0.1 by default; the LAN is opt-in through `HOST` | `ec44b9d` |
| **R5** | K3 measured alone: one weigh query costs ~310ms whatever it matches, and the test ran one per ledger tag | `0aefff9` |
| **Phase 1 (audit R1)** | opening a tab never derives units; the button alone does | `676d540`, `a7bae97`, report `4417502` |
| Rulings R6 to R8 | | `5b34294` |
| **R7** | the fixture tag ledger prunes on a clean teardown; 107 dead entries swept once | `c2767ef` |
| **Phase 2 (audit B4 + R3)** | the save reaches the route with a flat body and the right key; a body the route cannot read is refused 400 | `2d680e5`, `079864c`, report `7d07453` |
| Rulings R9 to R12 | | `07f7a3e` |
| **R12** | a calibration stop after an injection restores from its snapshot before it exits | `c4a443b` |
| **Phase 3 (L4, L2, L3, R8, R11)** | the row's four fields and index; count correction with its reason; the lock where the field is; the installer list closed until typed; a revision only when it carries a change | `c802fc6`, `f772440`, `e88c8cf`, report `2a1de86` |
| Rulings R13, R14 | | `bb5feb0` |
| **Phase 4 (R2)** | a buyer role is single-holder, refused 409 before the insert with the role named | `49c8b20` |
| Close | CURRENT_STATE.md regenerated | `b083122` |

**Server diff for the round:** `src/routes/test-beds.js` (+72 lines: R3's refusal, R11's rule, R2's refusal) and `src/server.js` (+10: R4's host). **No migration.**

## The audit items, marked closed

Against `TEST_BED_OLD_VS_NEW_AUDIT.md`, the units piece its own scope split names ("FIX ROUND B, units: B4, R1, L2, L3, L4 as one piece"):

| Item | Audit rank | State | Proof |
|---|---|---|---|
| **R1** Opening the Installation tab silently derives units | Regression, 1 of 1 | **CLOSED** | Phase 1: opening the tab sends ZERO non-GET requests and leaves 0 units; the button sends exactly one derive and creates 3. Guard red before, green after; 3 unit injections and 2 live specs fired |
| **B4** Every unit save fails, three contract breaks deep | Broken live, 4 of 6 | **CLOSED** | Phase 2: the real route, a flat body, `serialNumber`. Live 1/14 before, 14/14 after, the typed serial read back from the database and still on screen after a reload. R3 makes the two silent breaks loud |
| **L2** Count correction | Lost, 2 of 12 | **CLOSED** | Phase 3: per open type, a new count with a mandatory reason, Apply dead until both, the vanilla's own body, applied live and visible after a reload |
| **L3** Locked-count presentation | Lost, 3 of 12 | **CLOSED** | Phase 3: the Commercials count for a type with units renders locked, naming the value, the fact and the destination; a type with none stays editable; the server's 400 remains the backstop |
| **L4** Unit fields | Lost, 4 of 12 | **CLOSED** | Phase 3: index, serialNumber, latitude, longitude and the four states, each saving alone and flat; all four read back from the database and after a reload |

**Also closed, from outside the units scope:**
- **Round A's exit gate point 1** (Phase 0): the measurability write proven end to end, stored, shown, and read as met by the gate.
- **The carried second-contact route** (Phase 4, R2).
- **R8**, the installer list opening unprompted, found by reading a Phase 1 screenshot.

**Unchanged and still open in the audit:** L7, L8, L10, L12 and C9 (the rider clause; none of their files was touched except where named in Phase 3's report), and everything in Sections 4 and 5 that was never in scope.

## The rulings, R1 to R14

| | Ruling | Where it stands |
|---|---|---|
| R1 | Phase 0 signed off | - |
| R2 | a buyer role is single-holder | **built, Phase 4** |
| R3 | an unreadable unit PATCH is refused 400, never a silent 200 | **built, Phase 2** |
| R4 | the dev server binds localhost by default | **built** |
| R5 | K3 is a diagnostic item: measure, fix nothing | **measured** |
| R6 | Phase 1 signed off | - |
| R7 | the ledger prunes; the teardown test weighs in one grouped query | **half built.** The prune landed and is the whole gain. The grouped query was built, measured worse twice (71.2s to 131.9s and 136.2s) and reverted: counting returns no rows, grouping must fetch and page 31,746 of them |
| R8 | the installer list renders closed | **built, Phase 3** |
| R9 | Phase 2 signed off | - |
| R10 | R7 closes as half-landed by measurement; no RPC, no index | **accepted** |
| R11 | a revision only when it carries a change | **built, Phase 3** |
| R12 | a calibration stop restores before it exits | **built** |
| R13 | Phase 3 signed off | - |
| R14 | R2 builds as Phase 4; three items carry | **done** |

## Measurements worth keeping

**The database gate stage, before and after R7:**

| | Stage | The teardown test | Ledger |
|---|---|---|---|
| before | 143s | 71.2s | 112 tags |
| after | 100s | 32.9s | 2 tags |

Pre-commit database stages since then read 99 to 205s, the spread being the estate's own noise rather than the ledger.

**Dirty data for R2, counted at the close:** of 251 `record_contacts` rows on test beds, **2 role slots hold more than one contact, and both are on soft deleted beds.** No live Test Bed is in a state the new rule would refuse.

## Defects this round found in its own work, and fixed

1. **The unit queue offered a consumed revision** (Phase 3). Four fields saving in one burst read `200/409/409/200`, with the row blaming another person. The queue was built once with the first render's deps, and read the revision from the host's state, which no write updates until React re-renders. It now reads deps through a ref and holds the unit the route last returned.
2. **The pane's controls wore no treatment** (Phase 3, the rider clause): the active type tab was white on white, the inputs had no `type` so the estate's `input[type="text"]` never matched, and the note button had no class.
3. **`calibrate-live.mjs` left an injection on disk when it stopped** (found in Phase 2, fixed as R12). `process.exit` does not run a `finally`.
4. **The locked-count sentence read "1 unit exist"**, which the vanilla also read. The verb agrees now.

## What carries to the next round

- **K1:** the edit-journal hook accepts untracked edits to a file that already carries one tracked edit.
- **The server refusal text naming "a score of 1 or 2"**, which describes a configuration rather than reading it.
- **A staleness treatment for captured fixtures.** `exit-criteria-live.json` was measured fresh at Round A's close; `units-live.json` and the rest have no such check, and the captured fixtures are now declared generated in the journal guard.
- **From the Rule 10 list:**
  - a state-only unit write has no revision precondition (R11's stated trade);
  - the unit row has no per-field validation: latitude and longitude are refused by the server and the row shows that message;
  - the macOS firewall is off (R4's other half, John's own action);
  - R7's grouped query, closed by R10 unless a future measurement argues for an RPC or an index.

## Promotions to CLAUDE.md, PROPOSED not landed

**P1. Extend Verification 47 (the harness reproduces how production invokes the code) with a clause about WHICH LAYER re-renders.** Twice this round an injection came back SILENT because the test drove the component rather than the unit under test: the derive-clear in Round A, and this round's revision-handover test, where React re-renders between two links of a chain and the host is current either way. The check: **when the claim is about what one call passes to the NEXT one, test the thing that holds the value, not the screen that displays it.** A component test can only prove the value survives a render.

**P2. Extend Verification 44 with the exit path.** A harness that stops after writing an injection must restore before it exits, and `process.exit` does not run `finally`. Measured: a server-only injection left a mutated route under a `--watch` server, and the next calibration measured a disabled rule. The check: **every stop path between the first injection and the final restore is itself a restore path**, and the marker stays only when the restore fails.

**Not proposed:** R3's "a 2xx is not a write" is Verification 40 as written, and this round is another instance rather than a new rule.

## Residue and state

- **Residue:** LIVE 0 for probe-identity records.
- **Ledger:** 2 tags.
- **CURRENT_STATE.md** regenerated at `49c8b20`. Live record counts are unchanged by the round (131 live, and `unit` live counts identical); the soft deleted counts carry this round's fixtures.

## The full merge gate, on the branch

`npm run verify` on `b8605a3`, nothing else running: **All 24 stages passed.**

| Stage | Result | Time |
|---|---|---|
| reachability | PASS | 0.1s |
| session precondition | PASS | 0.4s |
| pure suite | PASS 582/582 | 4.2s |
| database suite | PASS 102/102 | 202.4s |
| react typecheck | PASS | 0.6s |
| react suite | PASS 1188/1188 | 14.8s |
| react bundle freshness | PASS | 0.6s |
| HTTP precondition probe | PASS | 30.2s |
| HTTP version-approval probe | PASS | 34.7s |
| HTTP pricing-approval probe | PASS | 50.0s |
| HTTP review-closes probe | PASS | 88.9s |
| HTTP term initial-value probe | PASS | 71.5s |
| HTTP stage-probability probe | PASS | 14.0s |
| HTTP version-gate probe | PASS | 25.4s |
| HTTP no-freeze probe | PASS | 24.2s |
| HTTP version-order probe | PASS | 19.4s |
| HTTP commercial-gate probe | PASS | 30.0s |
| HTTP readonly-view probe | PASS | 77.3s |
| CURRENT_STATE staleness | PASS | 0.2s |
| browser dependency is functional | PASS | 0.7s |
| HTTP write success probe | PASS | 26.1s |
| HTTP issue-target probe | PASS | 27.7s |
| HTTP proposal-issued probe | PASS | 72.5s |
| HTTP zero-track transition probe | PASS | 16.5s |

**The working tree was clean and the branch was at its final commit.** The
database stage read 202.4s here against 100s measured right after R7's prune, in
a run whose HTTP probes were unusually fast (14 to 50s against 53 to 97s in
Round A's green gate): the machine, not the suite.

**This paragraph rides that gate** (Verification 48 (a)): it is markdown, no gate
stage reads it, and it is the only commit after `b8605a3`.

## What this round does not establish

- **Anything at 1240 or 3440.** Every live proof is 1440, as instructed.
- **A joint-holder buyer role.** R2 rules single-holder, and a second holder would need the screen, the gate rule and the route to agree about which contact the role means.
- **Why the teardown test's ledger had grown**, beyond the append-only writer: the ledger file predates this round by two days.
- **That the units surface is complete against the vanilla beyond L2, L3 and L4.** The audit's other lost items are untouched by ruling.
