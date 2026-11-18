# PROBE_TRIAGE Phase 0 report

Branch `probe-triage` off `origin/main` 4c16917 (confirmed by `ls-remote`). First commit 179eaa2 is the brief, verbatim. Read-only phase: no source, configuration or record was changed. The full per-file register is `PROBE_TRIAGE_PHASE_0_REGISTER.md` (688 rows).

## 1. What was not done, first

- **Fixture-building probes were not run.** The brief allows a run only where a probe is read-only and safe. `freshOpportunity` writes records even though `tearDown` removes them by tag. Of the 52 hand-classified rows, 31 were not run: 24 build a fixture, 1 builds a fixture and emits SQL, 2 are known rotted, 2 rebuild the served bundle, 1 needs a second account and 1 writes live configuration. Their pass/fail is **unmeasured**, and the fixture probes' runtimes in section 4 are **estimates**. Ruling R1 asks for one measured run.
- **`term-pricing/probe-live.mjs` was not run.** It writes live configuration.
- **Two calibrators were not run:** `calibrate-view.mjs` and `calibrate-ladder-view.mjs`. They rebuild the served React bundle.
- **`calibrate-frozen-figures-sql.mjs` was not run.** Its output is SQL for you to paste (rule 14).
- **The approver session (`session-ref-approver.json`) expired 2026-11-16.** Nothing here needed it.

## 2. The register (item 1)

**Population.** All 688 files `git ls-files scripts` returns, not only those named `probe-*` or `calibrate*`. Coverage is asserted three ways:
- the census classifies 688 of 688;
- the register's classes sum to 688;
- the register document carries 688 file rows, counted from the document.

**Wired** means reached by the gate: a `verify-all.mjs` stage, a `package.json` script the gate runs, the pre-commit hook, or anything those import, spawn or open by a relative path.
- The detector was calibrated on 8 known cases: the gate stages read wired; both `probe-live.mjs` and `golden-deals/calibrate.mjs` read unwired.
- **It produced a false RETIRE on its first run.** Two JSON fixtures are opened by wired tests through `new URL('./fixtures/...', import.meta.url)`, which an import scan cannot see. The detector now resolves every relative string literal, and both read WIRED.
- **Build discipline 3, the reassuring verdict.** Two "wired" rows are only read as TEXT by a test, never executed: `sign-in.js` (now TOOL) and `lib/enumerate-controls.mjs` (labelled as text-read).

| class | count | meaning |
|---|---|---|
| WIRED | 145 | in the gate today: 23 stages, 91 via `package.json`, 2 hook, 29 reached by import or path |
| WIRE | 7 | proposed for the gate |
| REPOINT | 8 | stale figures or selectors; fix, then wire or keep manual |
| MANUAL | 68 | kept, unwired, reason stated |
| TOOL | 3 | operator tools, not checks |
| RETIRE | 457 | round-scoped, unwired, uncited by any governing document or source |

**How the 457 RETIRE rows were decided, so the rule can be challenged rather than the rows.** A file goes to RETIRE only when all five hold:
- not wired;
- not named by `src/`, `frontend/`, `frontend-react/src`, `supabase/` or `.githooks` (19 such files are MANUAL: committed captures behind React fixtures, per Verification 47);
- not a calibrator of a WIRED check (20 such are MANUAL);
- not cited in `CLAUDE.md`, `DESIGN_PRINCIPLES.md`, `CURRENT_STATE.md`, `INTERACTION_STANDARDS.md`, `docs/pricing-spec.md`, `OPPORTUNITY_DESIGN.md`, `PROTOTYPE_SPECIFICATION.md` or `MERGE_GATE.md` (14 such);
- not imported by a kept file.

A sample of 22 RETIRE rows was read by hand; all were phase proofs, walks, injections, teardowns or round outputs.

## 3. The triage set, classified (item 2)

52 hand-classified rows:
- the GATE_HYGIENE 27 (one of them, `probe-gaps`, already wired) plus `probe-transition-render`;
- this week's probes and calibrators;
- every unwired `term-pricing/` file;
- the four `probe-inventory` scanners;
- two re-labelled text-read rows.
- **The list of 27 is not in the repository.** It is in your OneDrive copy of `2026-11-15_GATE_HYGIENE_PHASE_1.md`, section 4, read from there.
- **"calibrate.mjs scheduling"** is taken to mean `scripts/golden-deals/calibrate.mjs`. It is queued beside the G1/G5 golden stamp, and DESIGN_PRINCIPLES records it dead for six weeks because nothing ran it. Position taken, revisitable.

### Measured today (read-only runs, one at a time, output to files)

| file | result | time | recommendation |
|---|---|---|---|
| `term-pricing/probe-ladder.mjs` | **ALL PASS 96/96** | 17.0s | **WIRE** |
| `golden-deals/calibrate.mjs` (temp copy) | **17/17 FIRED**, reverted green, bytes identical | 2.4s | **WIRE**, in a temp copy |
| `term-pricing/calibrate-ladder.mjs` (temp copy) | **26/26 FIRED**, 0 SILENT, reverted green | 10.0s | **WIRE**, in a temp copy |
| `term-pricing/calibrate.mjs` (temp copy) | **DEAD**: J3 anchor found 0 times; J2 SILENT on renamed tests | 3.6s to the stop | REPOINT, then into the same stage |
| `term-pricing/probe-screen.mjs`, 5 modes | FAIL in every mode, **89 failing checks**. Most are removed-formula figures (T1 Base TCV expected 151,999.92, live 38,880.00); the rest are the ladder's changed columns, labels and note. Five "no figure broken or clipped" failures at 1600 and 1920 **independently corroborate the price card overprint** below | 13 to 74s a mode | REPOINT `--tabs` and `--capex` (the Quote tab and CAPEX: next round's area); retire the other modes, which `probe-ladder` supersedes; MANUAL |
| `term-pricing/probe-factoring.mjs` | FAIL 29 of 113, all spec v1.10 figures (FA-3 monthly fee expected 289,818.77, live 83,175.00) | **144.1s** | REPOINT; MANUAL (too slow); its layout half moves into `probe-overlap` |
| `term-pricing/probe-bands.mjs` | FAIL 3 of 27, formula-era margins | 5.2s | REPOINT; MANUAL |
| `term-pricing/probe-overlap.mjs --only=tp` | 408 FAIL, then a crash | 84.3s (partial) | REPOINT, then **WIRE at 1240/1440/1920** (ruling R4) |
| `perf1/probe-one-fetch.mjs` | PASS 13/13 | 46.8s | MANUAL: a latency floor against a fixed threshold is Verification 48's lottery in a gate |
| `probe-dead-selectors.mjs` | ran; no verdict by design | 6.8s | MANUAL; its verdict half is the wired `dead-selectors.test.mjs` |
| `probe-stage-tab-identity.mjs` | PASS 8/8 | 25.8s | MANUAL; it reads any live opportunity at a stage, so it would need a fixture before wiring |
| `probe-version-join.mjs` | FAIL 8 of 11 | 31.1s | **RETIRE** (below) |

**`probe-overlap`'s 408 failures are three different things.**
1. **A REAL DEFECT on the live screen.** On the price card, the List TCV figure runs into the "Deal discount" label for any seven-digit deal, at every width from 1600 to 1920, in all eight Pricing states. Seen in a capture at 1600 on 120/40/2 units: `5,376,326.40DISCOUNT`, no gap. It is absent at 1240 to 1560. The three-column row came in with TP_LADDER P2 on 2026-11-17. Rule 10 queues it, but **the layout guard cannot be wired green while it stands** (ruling R3).
2. **Detector rot.** `tp-main` is reported needing 7,460px on every Payment terms state. Measured: the document is 1240 wide at 1240, `tp-main` is exactly its own width, and the 4,540px belongs to `cashflow-grid`, a declared scroller (`cashflow-scroll is-scrollable`). The capture shows no overflow. `shrunkBelowContent` counts a contained scroller's content as its parent's need; the cash flow card postdates the probe.
3. **Retired states.** The band-editor "state was reached" checks, and the manual-ladder sweep that times out on a card TP_LADDER retired.

**`probe-version-join` passes a refusal for the wrong reason (Verification 14), and sends real writes.**
- It POSTs a transition request to live TT-SGP-SMARTC-118 and PATCHes `warrantyPct: 9` on the first opportunity somebody else owns, today TT-SGP-MANUFI-002.
- "A write that cannot be recovered is REFUSED" PASSED on a **409 carrying the Closed Won sentence**. The PATCH was stopped by the Closed Won lock, not by ownership, so the ownership refusal it claims was never exercised.
- Its V3.0 claims rest on SMARTC-118's live history, which has since gained a V5.0.
- **Nothing landed**, measured:
  - zero `audit_log` rows anywhere in the table since 2026-11-18T00:00Z, from a query shown reading 1,657 rows since 2026-11-17;
  - no revisions today on either record.

### Not run (fixture builders); classification provisional

| file | guards | recommendation |
|---|---|---|
| `probe-frozen-figures-db.mjs` | R-FF5 immutability (owner and service role), R-FF1 freeze at issue, R-FF4 won version derived | **WIRE** |
| `probe-closed-won-pricing-click.mjs` | R-FF4: Closed Won pricing refused client and server, the sentence reaches the person | **WIRE** |
| `probe-unpriced-contract-value-click.mjs` | an unpriced deal reads `--` in all three places; nothing written | **WIRE** |
| `probe-factoring-term-refusal.mjs` | R-CF2 over HTTP, refusal and success path | **WIRE** |
| `probe-frozen-figures-render.mjs` | the approval page renders stored figures | MANUAL, cut candidate 1 |
| `probe-factoring-term-refusal-click.mjs` | R-CF2 client half | MANUAL, cut candidate 2 |
| `calibrate-frozen-figures-sql.mjs` | the frozen-figures SQL guards, rolled back | MANUAL (you paste it) |
| `sizing/probe-live.mjs`, `label-contrast/states.mjs`, `probe-numeric-inputs.mjs`, `walk4/probe-section-order.mjs`, `walk8/probe-deal-whole.mjs`, `stage-panels/probe-w8b.mjs` | standing rules (register) | MANUAL, provisional until R1 |
| `leads/probe-gated-fields-reachable.mjs`, `leads/probe-lead-door.mjs` | lead fields reachable; the lead door | REPOINT (known rotted; CLAUDE.md V9 cites the first), then MANUAL |
| `testbed-header/probe-testbed-door.mjs` | the Test Bed door | MANUAL: needs the ownership-other account |
| `probe-scrollable.mjs`, `probe-transition-render.mjs` | | **RETIRE**: rotted on removed vanilla (`#deal-form-vanilla`, `window.openRefField`) |
| the 11 other Round 41 probes (`probe-pulse`, `-pulse-stall`, `-panel-stability`, `-decision-feedback`, `-revision-adoption`, `-version-range`, `-term-from-recovery`, `-version-actions`, `-stale-recover`, `-payment-layout`) | Round 41 behaviours | MANUAL, provisional until R1 |

**A failed premise behind the twelve Round 41 probes (Verification 29).** `verify-all.mjs:395-480` records them as "deliberately not a stage" because puppeteer is not a dependency, so a browser stage would be red on a machine without one. GATE_HYGIENE G1 and G2 reversed that: browser stages are now required and a skip is a red verdict. **The stated reason no longer holds**, so their status is re-taken in R1 rather than inherited.

**The static rot scanner cannot settle the provisional rows.** `probe-inventory/q2-rotted.mjs` ran calibrated and flags only `probe-transition-render` among the 27. It does not flag the three GATE_HYGIENE already showed rotted, so its silence on the rest is not evidence (Verification 13).

## 4. Gate time (item 3)

**Today: 955s for the last full gate** (2026-11-17 23:43, 27 stages, green). The seven most recent full runs ran 894 to 1,075s. The slowest stages are `probe-gaps` 196s and the database suite 146s.

**Proposed additions:**

| addition | time | basis |
|---|---|---|
| golden calibration, temp copy | 2.8s | measured: 2.4s plus 0.4s for the copy |
| term pricing calibrations, temp copy | ~16s | measured: 10.0s, plus `calibrate.mjs` repointed (3.6s to its stop, est. 6s whole) |
| `probe-ladder` | 17.0s | measured |
| `probe-frozen-figures-db` | est. 30s | the last gate's 14 fixture-building HTTP stages ran 17.9 to 75.0s, median 34.5s |
| `probe-closed-won-pricing-click` | est. 35s | same basis, plus a browser |
| `probe-unpriced-contract-value-click` | est. 25s | same basis, smaller probe |
| `probe-factoring-term-refusal` | est. 15s | HTTP only, one fixture |
| `probe-live`, refusals only | est. 5s | four PostgREST calls and two HTTP |
| `probe-overlap` at three widths, plus factoring on | est. 30s | 84s covered 18 widths of two tabs, about 4.7s a width |
| **total** | **about 176s** (36s measured, 140s estimated) | **within +240s** |

**Ranked by what a break would cost, if measurement in R1 lands over budget.** Cut from the bottom:
1. `probe-frozen-figures-db`: a signed approval's figures could change.
2. `probe-closed-won-pricing-click`: a won deal's price could move.
3. Golden calibration: the golden stage silently dead again, as for six weeks.
4. Term pricing calibrations: the same, for term pricing.
5. `probe-ladder`: the next round's screen.
6. `probe-unpriced-contract-value-click`: a dollar figure on an unpriced deal.
7. `probe-factoring-term-refusal`: a factoring term past the contract.
8. `probe-live` refusals: settings RLS.
9. `probe-overlap` at three widths.

Cut candidates 1 and 2 (`-render`, `-click`) would add about 60s more, landing near the ceiling, which is why they are proposed MANUAL.

## 5. `probe-live` (item 4)

**What it writes:**
- a temporary `system_roles` admin row for john+test2, then deletes it;
- `term_pricing_settings.ANCHOR_MARGIN` set to 80 for SafeSight, then restored.

**Two faults beyond the write.**
1. **Its teardown restores a HARDCODED `{90, 90, 90}`**, not the value it read before the run. Any setting you had changed would be overwritten with 90.
2. **It cannot run today.** Live `term_pricing_settings` now holds 7 keys, and `ANCHOR_MARGIN`, `SHORT_TERM_MARGIN` and `PROFIT_STEP` are gone. It throws a TypeError at the decimals line, before its first write.

**Live state, read-only.** Every `updated_by` is null or your account. `system_roles` holds one row, yours. There is no residue from its 2026-10-02 run.

**Proposal.** Keep only what nothing else proves, which is live Postgres RLS:
- a non-admin's direct update and upsert refused;
- no self-grant;
- `system_roles` own-row only;
- the route GET reads `isAdmin false` and the PUT is refused 403.

Each attempted write targets the row's **current** value, so a broken RLS moves `updated_at`/`updated_by` (detected) and changes no configuration. **The temporary admin grant is deleted**: the admin success path is already proved against the route in `term-pricing-route.test.mjs` (A7, 0.1) and by your walk. Then WIRE, at about 5s. The alternative is RETIRE, losing the only live RLS check on settings.

## 6. Live data check (stop condition)

**No probe was found to have written live data.**
- `scripts/state-dump.mjs` was regenerated to a scratch copy and diffed against the committed `CURRENT_STATE.md` from be9e6e8. Every configuration section is identical. Only fixture counts moved: 131 more soft-deleted rows, 134 live unchanged, consistent with last night's close gate tearing down after itself.
- The committed file was put back and confirmed byte-identical with `cmp`.
- The settings fingerprint was identical before and after today's runs; the two probes that send refused PUTs did not move it.

## 7. Rulings asked for

- **R1.** A measured run of every fixture-building triage probe before wiring. Each run is tagged and torn down, with a residue query by tag before and after; about 25 minutes. It settles the provisional rows and replaces section 4's estimates. **Recommend yes, as Build step 1.**
- **R2.** The WIRE set:
  - the 7 WIRE rows;
  - `probe-live` (R5), `term-pricing/calibrate.mjs` and `probe-overlap`, each after its repoint;
  - the calibrators as one stage running in an OS temp copy, never the served tree.
- **R3.** The price card overprint (section 3) is fixed in this round, as the precondition of the layout guard going green. It is a screen change and authored by TP_LADDER, so it is your call. The alternative is to queue it and leave the guard unwired.
- **R4.** `probe-overlap` runs in the gate at 1240, 1440 and 1920, while the 40px sweep (A2) stays MANUAL. The detector stops counting a declared scroller (`overflow-x: auto|scroll`) as its parent's need, and gains a factoring-on state to cover the factoring and cash flow cards.
- **R5.** `probe-live` as proposed in section 5, or retired.
- **R6.** Delete the 457 RETIRE files. Git history keeps every one, and historical round reports stay records of their commit. Recommend yes. The alternative is leaving them, which keeps the stale formula figures runnable.
- **R7.** Wired probes write their screenshots to `.verify/` (gitignored), not to the tracked `prototypes/` folders their current `SHOT_DIR`s name. As written, every gate run would dirty the tree.
- **R8.** The DESIGN_PRINCIPLES rule gets a mechanism: a pure-suite test that fails on any `scripts/**` `probe-*` or `calibrate*` file that is neither a gate stage nor listed in `docs/PROBES.md` with a disposition. It replaces `probe-inventory/q1-wiring.mjs`. It makes the "or the round says why not" half gateable. Whether the reason is good stays judgement.

## 8. Queued, not this round (rule 10), unless ruled otherwise

- The price card overprint, if R3 is no.
- On another owner's Closed Won record, the PATCH route answers the Closed Won lock before ownership. Measured, not a defect: the order of two refusals.
- `term-pricing/calibrate-view.mjs` and `calibrate-ladder-view.mjs` rebuild the served bundle, so they can never be gate stages.
- `probe-gaps` stays 196s of the gate; unchanged here.

## 9. What surprised

- **The two Term Pricing probes most current with the screen disagree in kind.** `probe-ladder` is all green. `probe-overlap` found the one real layout defect on the same screen, in a state `probe-ladder` never types: a deal large enough for seven digits.
- **The golden calibrator, recorded as dead for six weeks, is alive and takes 2.4s.** What kept it unscheduled was that it injects into the served tree. Running it from `process.cwd()` in a copy costs 0.4s.
