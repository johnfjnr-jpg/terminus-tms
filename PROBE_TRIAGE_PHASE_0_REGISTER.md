# PROBE_TRIAGE Phase 0: the register of every file under scripts/

Generated 2026-11-18 from `git ls-files scripts` at 179eaa2 by a census run from the session scratchpad. **688 rows for 688 tracked files**, one each; the classes sum to the file count (WIRE 7, REPOINT 8, WIRED 145, MANUAL 68, TOOL 3, RETIRE 457).

Recommendations, not rulings. WIRE and REPOINT are proposals for the build; WIRED is today's gate; MANUAL stays unwired with the stated reason; RETIRE is deleted on ruling R6 (git history keeps every file).

## WIRE (7)

| file | guards | ran today | ms | writes | reason |
|---|---|---|---|---|---|
| `golden-deals/calibrate.mjs` | calibrates scripts/golden-deals-check: 17 injections | 17/17 fired (temp copy) | 2384 | source injections, temp copy only | the queued 'calibrate.mjs scheduling': alive, 17/17 FIRED, reverted green, 2.4s; injects into src/lib/deal-calculator.js and verify-all.mjs, so it runs in a TEMP COPY |
| `probe-closed-won-pricing-click.mjs` | R-FF4: pricing on a Closed Won deal is refused client and server, the sentence reaches the person, non-pricing edits land | not run: builds a fixture | est 35000 | fixture (tag ffwonclick, torn down; stage set by admin write, declared); screenshots into tracked prototypes/frozen-figures | the Closed Won lock; a break would let a won deal's price move |
| `probe-factoring-term-refusal.mjs` | R-CF2 over HTTP: a factoring term past the contract refused only when the save changes it; the success path lands | not run: builds a fixture | est 15000 | fixture (tag cftermref, torn down; legacy state through append_record_revision, declared) | cheap, HTTP only, the server half of a money refusal |
| `probe-frozen-figures-db.mjs` | R-FF5 no insert can create an issued row or one carrying frozen_figures, owner and service role; R-FF1 issue freezes; R-FF4 the raise derives the won version | not run: builds a fixture | est 30000 | fixture (tag ffdb, torn down; one approved request by admin write, declared) | the immutability of what an approver signed; HTTP only |
| `probe-unpriced-contract-value-click.mjs` | CONTRACT_VALUE: an unpriced deal reads -- in the stats cell, statement and strip; typing units turns all three into one figure; nothing written | not run: builds a fixture | est 25000 | fixture (tag cvunpriced, torn down); screenshot into tracked prototypes/contract-value | shipped yesterday, guards a money figure, small |
| `term-pricing/calibrate-ladder.mjs` | calibrates the v2.0 engine, settings and route tests (26 injections) | 26/26 fired (temp copy) | 9968 | source injections, temp copy only | alive: 26/26 FIRED, reverted green, 10.0s; injects into src, so the stage runs it in a TEMP COPY, never the served tree |
| `term-pricing/probe-ladder.mjs` | the price ladder screen to the approved mockup: term table, deal adjustment, editor read-only, both charts = grid, non-admin PUT 403 and the row does not move | PASS 96/96 | 16998 | one PUT, refused 403, row fingerprinted; screenshots to --out | current (v2.0 mockup), ALL PASS 96/96, 17.0s; the next round quotes from this screen |

## REPOINT (8)

| file | guards | ran today | ms | writes | reason |
|---|---|---|---|---|---|
| `leads/probe-gated-fields-reachable.mjs` | every server-gated lead field has a reachable input | not run: builds a fixture; known rotted |  | fixture, torn down | ROTTED (GATE_HYGIENE): targets ids removed by 956efb1. CLAUDE.md Verification 9 cites it as the instance, so it is repointed rather than deleted; MANUAL after |
| `leads/probe-lead-door.mjs` | the ownership door on a lead, both ways | not run: builds a fixture; known rotted |  | fixture, torn down | ROTTED, same cause; the door is a standing control; MANUAL after (leads is not the next round's area) |
| `term-pricing/calibrate.mjs` | calibrates the term pricing goldens and the R-TP1 isolation guard | STOP at J3 (temp copy) | 3626 | source injections, temp copy only | DEAD: J3 anchor found 0 times (the formula is gone), J2 SILENT on renamed tests. Drop the formula cases, keep J1 rounding and R-TP1, then run with calibrate-ladder in the same temp-copy stage |
| `term-pricing/probe-bands.mjs` | the band editor from the click, non-admin read-only and the bands PUT refused 403 | FAIL 24/27 | 5211 | one PUT, refused 403, fingerprinted | FAIL 3/27, all formula-era margins (10.4 = 10.3). Repoint the three; MANUAL (the ladder editor replaced the band editor as the admin surface that matters) |
| `term-pricing/probe-factoring.mjs` | PO factoring and the cash flow from the click: FA-3 to FA-7, off is absent, no overflow at 1240/1440/1920 | FAIL 84/113 | 144069 | screenshots to --out | FAIL 29/113: every failure a figure from spec v1.10's formula list fee. 144s is over budget alone; repoint figures to v2.0 and keep MANUAL, its layout half moves into probe-overlap's factoring-on state |
| `term-pricing/probe-live.mjs` | term_pricing_settings and system_roles RLS: a non-admin's direct writes refused, own-row only, no self-grant; route 403 | not run: writes live configuration | est 5000 | LIVE: system_roles insert/delete, term_pricing_settings ANCHOR_MARGIN | item 4. Writes live configuration (a temporary admin row, ANCHOR_MARGIN) and its teardown restores a HARDCODED 90/90/90 rather than the pre-run value. Rotted: ANCHOR_MARGIN no longer exists, so it throws a TypeError before its first write. Proposal: keep only the refusals, aimed at NO-OP values, delete the admin grant; then WIRE (est 5s) |
| `term-pricing/probe-overlap.mjs` | no overprint, no track below its content, every Term Pricing tab, 1240-1920 by 40 | FAIL 408, crashed | 84325 (partial) | OPEX section fixture (tag tp2ovA, torn down) unless --only=tp; screenshots into prototypes/term-pricing-tabs/built | the Term Pricing layout guard. Today: 408 FAIL in 84s and a crash. One REAL defect (price card List TCV overprints Deal discount, 1600-1920, 7-digit deals); one detector rot (a declared scroller, the cash flow grid, counted as its parent's need); the bands-state and manual-ladder sweeps assert retired states. Repoint, add a factoring-on state, wire at 1240/1440/1920; the 40px sweep MANUAL |
| `term-pricing/probe-screen.mjs` | the term screen's figures follow docs/pricing-spec.md, from the click, five modes | FAIL in all 5 modes | default 73717, tabs 65354, capex 71918, pc 12738, tp2 52385 | none; screenshots to --out | every mode FAILS: 89 failing checks, mostly removed-formula figures, the rest the ladder's changed columns, labels and note; five overflow failures at 1600/1920 corroborate the price card overprint. Repoint --tabs and --capex (Quote tab and CAPEX: the next round's area) to v2.0; retire default, --pc, --tp2 and --flow, which probe-ladder supersedes. MANUAL: 13-74s a mode |

## WIRED (145)

| file | role | reason |
|---|---|---|
| `adjacency/probe-gaps.mjs` | probe | A1 adjacency, R-US4 containment, A5 placement, ink, stage tabs. gate stage since GATE_HYGIENE G2 |
| `api-client.mjs` | library | reached by the gate: imported by scripts/tests/api-client.test.mjs |
| `check-browser-usable.mjs` | check | gate stage |
| `check-dist-fresh.mjs` | check | gate stage |
| `check-reachable.mjs` | check | gate stage |
| `check-session.mjs` | check | gate stage |
| `check-state-fresh.mjs` | check | gate stage |
| `edit.mjs` | tool | reached by the gate: named in scripts/tests/edit-guard.test.mjs |
| `fixtures.mjs` | library | reached by the gate: imported by scripts/tests/config-invariants.test.mjs |
| `golden-deals-check` | tool | gate stage |
| `golden-deals/calibration-cases.mjs` | library | reached by the gate: imported by scripts/tests/calibration-anchors.test.mjs |
| `golden-deals/compute.mjs` | tool | run by package.json:goldens:compute |
| `golden-deals/deals.mjs` | library | reached by the gate: imported by scripts/tests/commercials-factoring.test.mjs |
| `golden-deals/engine.mjs` | library | reached by the gate: imported by scripts/tests/commercials-factoring.test.mjs |
| `golden-deals/expectations.json` | data/output | reached by the gate: named in scripts/golden-deals-check |
| `golden-deals/subkey-census.mjs` | other-check | gate stage |
| `hooks/journal-guard.mjs` | tool | pre-commit hook |
| `lib/approver-gate-rows.mjs` | library | reached by the gate: imported by scripts/tests/config-invariants.test.mjs |
| `lib/edit.mjs` | library | reached by the gate: named in scripts/tests/enforcement.test.mjs |
| `lib/enumerate-controls.mjs` | library | read as TEXT by opportunity-headline.test.mjs (not executed); library of browser probes |
| `lib/fixture-record-types.mjs` | library | reached by the gate: imported by scripts/tests/gates.test.mjs |
| `lib/gate-verdict.mjs` | library | reached by the gate: imported by scripts/tests/gate-verdict.test.mjs |
| `lib/ink-overlap.mjs` | library | reached by the gate: imported by scripts/adjacency/probe-gaps.mjs |
| `lib/keep-alive.mjs` | library | reached by the gate: imported by scripts/probe-readonly-view.mjs |
| `lib/prompt-password.js` | library | reached by the gate: imported by scripts/sign-in.js |
| `lib/puppeteer.mjs` | library | reached by the gate: imported by scripts/tests/probe-loader.test.mjs |
| `lib/stage-echo.mjs` | library | reached by the gate: imported by scripts/tests/stage-echo.test.mjs |
| `lib/strip-comments.mjs` | library | reached by the gate: imported by scripts/tests/enforcement.test.mjs |
| `lib/top-level-names.mjs` | library | reached by the gate: imported by scripts/tests/no-undefined-globals.test.mjs |
| `lib/unbounded-select-allowlist.mjs` | library | reached by the gate: imported by scripts/tests/no-unbounded-select.test.mjs |
| `lib/unbounded-selects.mjs` | library | reached by the gate: imported by scripts/tests/no-unbounded-select.test.mjs |
| `pre-commit-suites.mjs` | tool | pre-commit hook |
| `probe-commercial-gate.mjs` | probe | gate stage |
| `probe-issue-target.mjs` | probe | gate stage |
| `probe-no-freeze.mjs` | probe | gate stage |
| `probe-preconditions.mjs` | probe | gate stage |
| `probe-pricing-approval.mjs` | probe | gate stage |
| `probe-proposal-issued.mjs` | probe | gate stage |
| `probe-readonly-view.mjs` | probe | gate stage |
| `probe-review-closes.mjs` | probe | gate stage |
| `probe-stage-probability.mjs` | probe | gate stage |
| `probe-term-initial-value.mjs` | probe | gate stage |
| `probe-version-approval.mjs` | probe | gate stage |
| `probe-version-gate.mjs` | probe | gate stage |
| `probe-version-order.mjs` | probe | gate stage |
| `probe-write-success.mjs` | probe | gate stage |
| `probe-zero-track-transition.mjs` | probe | gate stage |
| `refresh-session.js` | tool | reached by the gate: named in scripts/check-session.mjs |
| `seed.js` | tool | run by package.json:db:seed |
| `state-dump.mjs` | tool | run by package.json:state:dump |
| `term-pricing/capture-factoring-off-baseline.mjs` | library | reached by the gate: imported by scripts/tests/term-pricing.test.mjs |
| `term-pricing/factoring-off-baseline.json` | data/output | reached by the gate: relative path in scripts/tests/term-pricing.test.mjs |
| `term-pricing/v1-oracle.mjs` | library | reached by the gate: imported by scripts/term-pricing/capture-factoring-off-baseline.mjs |
| `tests/adopted-identity.test.mjs` | test | run by package.json:test |
| `tests/api-client.test.mjs` | test | run by package.json:test |
| `tests/approval-page.test.mjs` | test | run by package.json:test |
| `tests/approval-renders-snapshot.test.mjs` | test | run by package.json:test |
| `tests/approved-version.test.mjs` | test | run by package.json:test |
| `tests/attention-token.test.mjs` | test | run by package.json:test |
| `tests/calibration-anchors.test.mjs` | test | run by package.json:test |
| `tests/catalog-boundary.test.mjs` | test | run by package.json:test |
| `tests/class-rules.test.mjs` | test | run by package.json:test |
| `tests/client-preconditions.test.mjs` | test | run by package.json:test |
| `tests/clock-skew-budget.test.mjs` | test | run by package.json:test:db |
| `tests/clock-skew.test.mjs` | test | run by package.json:test |
| `tests/commercials-factoring.test.mjs` | test | run by package.json:test |
| `tests/commercials-wiring.test.mjs` | test | run by package.json:test |
| `tests/config-invariants.test.mjs` | test | run by package.json:test:db |
| `tests/contact-links.test.mjs` | test | run by package.json:test:db |
| `tests/contract-value.test.mjs` | test | run by package.json:test |
| `tests/contractor-staging.test.mjs` | test | run by package.json:test |
| `tests/convert-atomicity.test.mjs` | test | run by package.json:test |
| `tests/cost-basis.test.mjs` | test | run by package.json:test |
| `tests/cost-preview.test.mjs` | test | run by package.json:test |
| `tests/cost.test.mjs` | test | run by package.json:test |
| `tests/create-from-ownership.test.mjs` | test | run by package.json:test |
| `tests/currency-codes.test.mjs` | test | run by package.json:test |
| `tests/dead-selectors.test.mjs` | test | run by package.json:test |
| `tests/deal-inputs.test.mjs` | test | run by package.json:test |
| `tests/decision-surface.test.mjs` | test | run by package.json:test |
| `tests/edit-guard.test.mjs` | test | run by package.json:test |
| `tests/enforcement.test.mjs` | test | run by package.json:test |
| `tests/fixtures/deal-inputs-golden.json` | data/output | reached by the gate: relative path in scripts/tests/deal-inputs.test.mjs |
| `tests/fixtures/staleness-golden.json` | data/output | reached by the gate: relative path in scripts/tests/approval-page.test.mjs |
| `tests/format-dates.test.mjs` | test | run by package.json:test |
| `tests/frozen-figures.test.mjs` | test | run by package.json:test |
| `tests/gate-verdict.test.mjs` | test | run by package.json:test |
| `tests/gates.test.mjs` | test | run by package.json:test:db |
| `tests/hidden-not-overridden.test.mjs` | test | run by package.json:test |
| `tests/label-contrast.test.mjs` | test | run by package.json:test |
| `tests/latches.test.mjs` | test | run by package.json:test |
| `tests/lens-rollup.test.mjs` | test | run by package.json:test |
| `tests/live-form.test.mjs` | test | run by package.json:test |
| `tests/milestone-schedule.test.mjs` | test | run by package.json:test |
| `tests/no-casing-collision.test.mjs` | test | run by package.json:test |
| `tests/no-duplicate-ids.test.mjs` | test | run by package.json:test |
| `tests/no-secrets.test.mjs` | test | run by package.json:test |
| `tests/no-unbounded-select.test.mjs` | test | run by package.json:test |
| `tests/no-undefined-globals.test.mjs` | test | run by package.json:test |
| `tests/numeric-payload.test.mjs` | test | run by package.json:test |
| `tests/opex-fee-exact.test.mjs` | test | run by package.json:test |
| `tests/opex.test.mjs` | test | run by package.json:test |
| `tests/opportunity-cost-contract.test.mjs` | test | run by package.json:test |
| `tests/opportunity-dates.test.mjs` | test | run by package.json:test |
| `tests/opportunity-headline.test.mjs` | test | run by package.json:test |
| `tests/ownership.test.mjs` | test | run by package.json:test:db |
| `tests/panel-conformance.test.mjs` | test | run by package.json:test |
| `tests/payload-audit.test.mjs` | test | run by package.json:test |
| `tests/payload-diff.test.mjs` | test | run by package.json:test |
| `tests/probe-loader.test.mjs` | test | run by package.json:test |
| `tests/radar.test.mjs` | test | run by package.json:test |
| `tests/rate-resolution.test.mjs` | test | run by package.json:test |
| `tests/record-revision.test.mjs` | test | run by package.json:test:db |
| `tests/red-token.test.mjs` | test | run by package.json:test |
| `tests/reference-number.test.mjs` | test | run by package.json:test:db |
| `tests/request-pricing-approval.test.mjs` | test | run by package.json:test |
| `tests/revision-preconditions.test.mjs` | test | run by package.json:test |
| `tests/role-link-census.test.mjs` | test | run by package.json:test |
| `tests/seam-ledger.test.mjs` | test | run by package.json:test |
| `tests/stage-echo.test.mjs` | test | run by package.json:test |
| `tests/standards-staleness.test.mjs` | test | run by package.json:test |
| `tests/stats-grid-cells-match.test.mjs` | test | run by package.json:test |
| `tests/strip-comments.test.mjs` | test | run by package.json:test |
| `tests/stylesheet.test.mjs` | test | run by package.json:test |
| `tests/suite-names-resolve.test.mjs` | test | run by package.json:test |
| `tests/system-defaults.test.mjs` | test | run by package.json:test |
| `tests/teardown-scoping.test.mjs` | test | run by package.json:test:db |
| `tests/term-factoring-parity.test.mjs` | test | run by package.json:test |
| `tests/term-pricing-isolation.test.mjs` | test | run by package.json:test |
| `tests/term-pricing-route.test.mjs` | test | run by package.json:test |
| `tests/term-pricing-settings.test.mjs` | test | run by package.json:test |
| `tests/term-pricing.test.mjs` | test | run by package.json:test |
| `tests/test-bed-cost-contract.test.mjs` | test | run by package.json:test |
| `tests/transition-requests.test.mjs` | test | run by package.json:test |
| `tests/unit-slots.test.mjs` | test | run by package.json:test:db |
| `tests/vanilla-duplicates-frozen.test.mjs` | test | run by package.json:test |
| `tests/version-approval.test.mjs` | test | run by package.json:test |
| `tests/version-atomicity.test.mjs` | test | run by package.json:test:db |
| `tests/version-guard.test.mjs` | test | run by package.json:test |
| `tests/version-label-composer.test.mjs` | test | run by package.json:test |
| `tests/version-label.test.mjs` | test | run by package.json:test |
| `tests/version-pricing.test.mjs` | test | run by package.json:test |
| `tests/version-reason.test.mjs` | test | run by package.json:test |
| `verify-all.mjs` | library | reached by the gate: npm run verify |
| `verify-harness.mjs` | library | reached by the gate: imported by scripts/tests/clock-skew.test.mjs |

## MANUAL (68)

| file | guards | ran today | ms | writes | reason |
|---|---|---|---|---|---|
| `adjacency/calibrate.mjs` |  |  |  |  | calibrator of wired adjacency/probe-gaps.mjs; run when that check changes |
| `after-save/probe-after-save.mjs` |  |  |  |  | cited as evidence in DESIGN_PRINCIPLES.md; retiring it leaves a pointer to nothing (V7) |
| `assess-pane/probe-assess-pane.mjs` |  |  |  |  | cited as evidence in DESIGN_PRINCIPLES.md; retiring it leaves a pointer to nothing (V7) |
| `calibrate-composer-guard.mjs` |  |  |  |  | calibrator of wired tests/version-label-composer.test.mjs; run when that check changes |
| `calibrate-frozen-figures-sql.mjs` | calibrates the frozen-figures database guards as one rolled-back SQL block | not run: builds a fixture and emits SQL |  | fixture (tagged, --teardown); .scratch/ff-calibration.sql | its SQL is pasted by John into the dashboard (rule 14: no psql here); cannot be scheduled from this session |
| `census-form-identity.mjs` |  |  |  |  | named by frontend-react/src/deal/adopted-identity.ts: a committed capture or cited proof (V47) |
| `convert-atomicity/calibrate-migration-test.mjs` |  |  |  |  | calibrator of wired tests/convert-atomicity.test.mjs; run when that check changes |
| `create-from/calibrate-guards.mjs` |  |  |  |  | calibrator of wired tests/create-from-ownership.test.mjs; run when that check changes |
| `create-test-user.js` |  |  |  |  | named by src/supabase.js: a committed capture or cited proof (V47) |
| `deal-radar/probe-radar-unavailable.mjs` |  |  |  |  | cited as evidence in DESIGN_PRINCIPLES.md; retiring it leaves a pointer to nothing (V7) |
| `enforcement/calibrate.mjs` |  |  |  |  | calibrator of wired check-state-fresh.mjs; run when that check changes |
| `f5/calibrate-fix.mjs` |  |  |  |  | calibrator of wired tests/teardown-scoping.test.mjs; run when that check changes |
| `gate-race/calibrate-fix.mjs` |  |  |  |  | calibrator of wired tests/config-invariants.test.mjs; run when that check changes |
| `label-contrast/states.mjs` | disabled controls visibly dimmer (P1); active state not by colour alone (P2) | not run: builds a fixture |  | fixture, torn down | PROVISIONAL, not run (fixture); measure in R1 |
| `lead-card-ui/calibrate-p1.mjs` |  |  |  |  | calibrator of wired tests/format-dates.test.mjs; run when that check changes |
| `leads-card/calibrate-gate-verdict.mjs` |  |  |  |  | calibrator of wired tests/gate-verdict.test.mjs; run when that check changes |
| `leads/calibrate-followup-task.mjs` |  |  |  |  | calibrator of wired tests/api-client.test.mjs; run when that check changes |
| `opex-layout/probe-live.mjs` |  |  |  |  | named by frontend-react/src/__tests__/opex-layout.test.tsx: a committed capture or cited proof (V47) |
| `opportunity/probe-region-live.mjs` |  |  |  |  | named by frontend-react/src/__tests__/field-row-stability.test.tsx (+1): a committed capture or cited proof (V47) |
| `perf1/probe-one-fetch.mjs` | one /api/contacts fetch per load, plus a latency floor | PASS 13/13 | 46826 | none | PASS 13/13 but 46.8s and timing-sensitive: a latency floor against a fixed threshold is the lottery Verification 48 forbids in a gate |
| `probe-cost-basis-line.mjs` |  |  |  |  | named by frontend/style.css: a committed capture or cited proof (V47) |
| `probe-dead-selectors.mjs` | CSS rules that match nothing (candidates) | ran, no verdict by design | 6840 | none | prints candidates and has no verdict, so it cannot gate; the verdict half is scripts/tests/dead-selectors.test.mjs, wired |
| `probe-decision-feedback.mjs` | pending state, double-click guard, visible refusal on the banner clicked | not run: builds a fixture |  | fixture, torn down | PROVISIONAL, as probe-pulse; unattended half in decision-surface.test.mjs |
| `probe-factoring-term-refusal-click.mjs` | R-CF2 client half: the refusal reaches #deal-feedback and no PATCH leaves the browser | not run: builds a fixture | est 30000 | fixture (tag cfb1click, torn down); screenshots into tracked prototypes/commercials-factoring | CUT CANDIDATE 2: server half wired; client half partly in deal-save-routes.test.tsx |
| `probe-frozen-figures-render.mjs` | R-FF1/R-FF2 the approval page renders the stored figures in a browser | not run: builds a fixture | est 30000 | fixture (tag ffrender, torn down); screenshots into tracked prototypes/frozen-figures | CUT CANDIDATE 1: its HTTP half is in probe-frozen-figures-db and the differing branch is in frontend-react's frozen-figures render test |
| `probe-install-prose.mjs` |  |  |  |  | cited as evidence in DESIGN_PRINCIPLES.md; retiring it leaves a pointer to nothing (V7) |
| `probe-inventory/q1-wiring.mjs` | which detectors nothing runs (V9 unscheduled-detector scan) |  |  | none | static, read-only inventory instruments; q1 is the scan Verification 9 asks for. Kept until the PROBES.md coverage test (proposed) replaces q1; q2 ran today and is blind to the known-rotted leads probes |
| `probe-inventory/q2-rotted.mjs` | detectors naming ids no producer renders | ran: calibrated, 13 unexplained refs |  | none | static, read-only inventory instruments; q1 is the scan Verification 9 asks for. Kept until the PROBES.md coverage test (proposed) replaces q1; q2 ran today and is blind to the known-rotted leads probes |
| `probe-inventory/q2b-routes.mjs` | detectors calling routes the server does not serve |  |  | none | static, read-only inventory instruments; q1 is the scan Verification 9 asks for. Kept until the PROBES.md coverage test (proposed) replaces q1; q2 ran today and is blind to the known-rotted leads probes |
| `probe-inventory/q3-blind.mjs` | detectors measuring a property a broken state also satisfies |  |  | none | static, read-only inventory instruments; q1 is the scan Verification 9 asks for. Kept until the PROBES.md coverage test (proposed) replaces q1; q2 ran today and is blind to the known-rotted leads probes |
| `probe-numeric-inputs.mjs` | every numeric input refuses letters | not run: builds a fixture |  | fixture, torn down | PROVISIONAL, not run (fixture); no unwired reason recorded anywhere, so the header gains one; measure in R1 |
| `probe-panel-stability.mjs` | the stage panel does not flicker or reflow on re-read | not run: builds a fixture |  | fixture, torn down | PROVISIONAL, as probe-pulse |
| `probe-payment-layout.mjs` | payment panel parentage, three widths, hover, typed keystrokes | not run: builds a fixture |  | fixture, torn down | PROVISIONAL, as probe-pulse |
| `probe-pulse-stall.mjs` | a failing poll says so after two failures, clears on success | not run: builds a fixture |  | fixture, torn down | PROVISIONAL, as probe-pulse |
| `probe-pulse.mjs` | a screen follows a record somebody else changed within one poll | not run: builds a fixture |  | fixture, torn down | PROVISIONAL, not run (fixture). The stated unwired reason (no browser in the gate) failed as a premise; measure in R1 |
| `probe-revision-adoption.mjs` | the revision hook adopts a version-shaped response | not run: builds a fixture |  | fixture, torn down | PROVISIONAL, as probe-pulse; the audit half is wired |
| `probe-stage-tab-identity.mjs` | the stage dot follows the record, a selection survives a re-render, a landing lands | PASS 8/8 | 25787 | none (reads a live record) | PASS 8/8 in 25.8s. Its stated unwired reason (no browser in the gate) has FAILED as a premise. Reads ANY live opportunity at a stage: repoint to a fixture before it could be wired |
| `probe-stale-recover.mjs` | two tabs racing on one record: the second write recovers | not run: builds a fixture |  | fixture, torn down | PROVISIONAL, as probe-pulse |
| `probe-term-from-recovery.mjs` | factoring term takes recovery as an INITIAL value only | not run: builds a fixture |  | fixture, torn down | PROVISIONAL, as probe-pulse; one clause self-skips |
| `probe-version-actions.mjs` | version controls per stage; four buttons and a sentence on one line at 1240 | not run: builds a fixture |  | fixture, torn down | PROVISIONAL, as probe-pulse |
| `probe-version-range.mjs` | the version history stays readable as minors accumulate | not run: builds a fixture |  | fixture, torn down | PROVISIONAL, as probe-pulse |
| `scanner-window/calibrate.mjs` |  |  |  |  | calibrator of wired tests/contact-links.test.mjs; run when that check changes |
| `seed-test-opportunity.js` |  |  |  |  | named by src/supabase.js: a committed capture or cited proof (V47) |
| `sizing/probe-live.mjs` | the field sizing standard S1, S2, N1-N7, named the guard in DESIGN_PRINCIPLES | not run: builds a fixture |  | fixture, torn down | PROVISIONAL, not run (fixture). Not run since the deal panel changed in October; measure in R1, then decide WIRE or REPOINT |
| `stage-panels/measure-r8.mjs` |  |  |  |  | named by supabase/migrations/20260918000001_approvers_named_before_advancing.sql: a committed capture or cited proof (V47) |
| `stage-panels/probe-pilot.mjs` |  |  |  |  | named by frontend-react/src/__tests__/stage-panels.test.tsx: a committed capture or cited proof (V47) |
| `stage-panels/probe-w8b.mjs` | the save bar stays on screen at full scroll | not run: builds a fixture |  | fixture, torn down | PROVISIONAL, not run (fixture); measure in R1 |
| `teardown-integrity/calibrate-unbounded-guard.mjs` |  |  |  |  | calibrator of wired probe-version-order.mjs; run when that check changes |
| `term-pricing/calibrate-ladder-view.mjs` | calibrates probe-ladder.mjs (injections into TermPricingView.tsx, rebuild) | not run: rebuilds the served bundle |  | source injection into the served tree + rebuild | needed the day probe-ladder is calibrated in this round's build; it rebuilds the SERVED bundle, so it can never be a gate stage |
| `term-pricing/derive-v2-goldens.mjs` | tool: re-derives golden figures split per the TP_LADDER ruling |  |  | --apply rewrites test literals | cited as the derivation of record; not a check |
| `term-pricing/independent-price.mjs` | tool: independent integer-cents pricer |  |  | none | the independent derivation of record for the v2.0 goldens; not a check |
| `testbed-core/calibrate-live.mjs` |  |  |  |  | calibrator of wired check-dist-fresh.mjs; run when that check changes |
| `testbed-core/capture-buyers.mjs` |  |  |  |  | named by frontend-react/src/__tests__/fixtures/buyers-live.json (+2): a committed capture or cited proof (V47) |
| `testbed-core/capture-exit-criteria.mjs` |  |  |  |  | named by frontend-react/src/__tests__/fixtures/exit-criteria-live.json (+1): a committed capture or cited proof (V47) |
| `testbed-core/capture-patch.mjs` |  |  |  |  | named by frontend-react/src/__tests__/fixtures/testbed-patch-live.json (+1): a committed capture or cited proof (V47) |
| `testbed-core/capture-scoring.mjs` |  |  |  |  | named by frontend-react/src/__tests__/fixtures/scoring-live.json (+1): a committed capture or cited proof (V47) |
| `testbed-header/calibrate-grid-reconcile.mjs` |  |  |  |  | calibrator of wired tests/stats-grid-cells-match.test.mjs; run when that check changes |
| `testbed-header/probe-testbed-door.mjs` | the door on a Test Bed, both ways | not run: second account |  | fixture, torn down | needs the ownership-other account, which no gate session holds |
| `testbed-layout/probe-moves.mjs` |  |  |  |  | named by frontend-react/src/testbed/CommercialsCards.tsx: a committed capture or cited proof (V47) |
| `testbed-state/calibrate-r3.mjs` |  |  |  |  | calibrator of wired tests/payload-audit.test.mjs; run when that check changes |
| `testbed-state/probe-r1-live.mjs` |  |  |  |  | named by frontend-react/src/testbed/CommercialsCards.tsx: a committed capture or cited proof (V47) |
| `testbed-units/capture-units.mjs` |  |  |  |  | named by frontend-react/src/__tests__/fixtures/units-live.json (+3): a committed capture or cited proof (V47) |
| `testbed-walk2/probe-walk2.mjs` |  |  |  |  | named by frontend-react/src/__tests__/testbed-walk2-layout.test.tsx: a committed capture or cited proof (V47) |
| `ui-hygiene/calibrate-teardown.mjs` |  |  |  |  | calibrator of wired tests/teardown-scoping.test.mjs; run when that check changes |
| `ui-standards-leads/calibrate-p1.mjs` |  |  |  |  | calibrator of wired tests/panel-conformance.test.mjs; run when that check changes |
| `walk3/calibrate-attention.mjs` |  |  |  |  | calibrator of wired tests/attention-token.test.mjs; run when that check changes |
| `walk4/probe-section-order.mjs` | the Commercials sections in the ruled order | not run: builds a fixture |  | fixture, torn down | PROVISIONAL, not run (fixture); cited by DealPanel.tsx; measure in R1 |
| `walk8/probe-deal-whole.mjs` | deal-form section parentage, no retired blocks, no duplicate ids | not run: builds a fixture |  | fixture, torn down | PROVISIONAL, not run (fixture); measure in R1 |

## TOOL (3)

| file | role | reason |
|---|---|---|
| `await-run.sh` | tool | operator tool, not a check |
| `rehearse-revert.mjs` | tool | operator tool, not a check |
| `sign-in.js` | tool | operator tool; read as TEXT by no-secrets.test.mjs, not executed |

## RETIRE (457)

| file | role | reason |
|---|---|---|
| `.lay.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `adjustments/measure.mjs` | other-check | round-scoped other-check, unwired, uncited by any governing doc or source; git history keeps it |
| `adjustments/probe-working-version.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `approve-figures/calibrate.mjs` | calibrate | round-scoped calibrate, unwired, uncited by any governing doc or source; git history keeps it |
| `approve-figures/census-test-versions.mjs` | other-check | round-scoped other-check, unwired, uncited by any governing doc or source; git history keeps it |
| `approve-figures/probe-live.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `approve-figures/probe-p0-zeros.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `approve-path/calibrate.mjs` | calibrate | round-scoped calibrate, unwired, uncited by any governing doc or source; git history keeps it |
| `approve-path/probe-live.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `approve-path/probe-p0-click-paths.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `approve-path/probe-p0-overrides.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `baselines/opex-row-levels-main.json` | data/output | round output or proposal file, not a check |
| `calibrate-e2-old-code.mjs` | calibrate | round-scoped calibrate, unwired, uncited by any governing doc or source; git history keeps it |
| `calibrate-freeze.mjs` | calibrate | round-scoped calibrate, unwired, uncited by any governing doc or source; git history keeps it |
| `contact-mode/calibrate-cmode.mjs` | calibrate | round-scoped calibrate, unwired, uncited by any governing doc or source; git history keeps it |
| `contact-mode/probe-p0-cache.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `contact-mode/probe-p1-modes.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `contact-swap/calibrate-r8.mjs` | calibrate | round-scoped calibrate, unwired, uncited by any governing doc or source; git history keeps it |
| `contact-swap/census-p0.mjs` | other-check | round-scoped other-check, unwired, uncited by any governing doc or source; git history keeps it |
| `contact-swap/disposition.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `contact-swap/p2-presence.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `contact-swap/p2-visibility.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `contact-swap/probe-r7-industry.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `contact-swap/probe-r8-swap.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `contact-swap/shot-completion.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `contact-swap/shot-contact.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `convert-atomicity/deleter-census.mjs` | other-check | round-scoped other-check, unwired, uncited by any governing doc or source; git history keeps it |
| `convert-atomicity/ledger-insert-census.mjs` | other-check | round-scoped other-check, unwired, uncited by any governing doc or source; git history keeps it |
| `convert-atomicity/probe-contact-function.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `convert-atomicity/probe-conversion-limit.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `convert-atomicity/probe-convert-function.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `convert-atomicity/probe-convert-race.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `convert-atomicity/probe-routes-preserved.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `convert-atomicity/reconcile-round.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `convert-atomicity/residue-attribute.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `convert-atomicity/residue-calibrate.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `convert-atomicity/residue-probe.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `convert-atomicity/residue-summary.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `convert-atomicity/revert-direction.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `convert-atomicity/walk-convert.mjs` | other-check | round-scoped other-check, unwired, uncited by any governing doc or source; git history keeps it |
| `create-bug/probe-p0-repro.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `create-bug/probe-p1-userpath.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `create-from/classify.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `create-from/evidence-census.mjs` | other-check | round-scoped other-check, unwired, uncited by any governing doc or source; git history keeps it |
| `create-from/helper-read.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `create-from/probe-create-from.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `create-from/probe-flows-unchanged.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `create-from/probe-source-owned.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `create-from/teardown-evidence.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `deal-dynamics/probe-rollups.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `deal-radar/probe-inpage-move.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `deal-radar/probe-overlay-fixture.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `deal-radar/probe-radar-layout.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `deal-radar/probe-radar.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `dealsheet/calibrate-c2.mjs` | calibrate | round-scoped calibrate, unwired, uncited by any governing doc or source; git history keeps it |
| `dealsheet/calibrate.mjs` | calibrate | round-scoped calibrate, unwired, uncited by any governing doc or source; git history keeps it |
| `dealsheet/probe-c1-statement.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `dealsheet/probe-c2-editing.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `dealsheet/probe-e1-distance.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `dealsheet3/calibrate.mjs` | calibrate | round-scoped calibrate, unwired, uncited by any governing doc or source; git history keeps it |
| `dealsheet3/census-blank-controls.mjs` | other-check | round-scoped other-check, unwired, uncited by any governing doc or source; git history keeps it |
| `dealsheet3/probe-effective-values.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `dealsheet3/shot-drawer-before.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `door-1920/diagnose.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `door-1920/replicate.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `enforcement/census.mjs` | other-check | round-scoped other-check, unwired, uncited by any governing doc or source; git history keeps it |
| `f5/decompose.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `f5/find-crossing.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `f5/measure-growth.mjs` | other-check | round-scoped other-check, unwired, uncited by any governing doc or source; git history keeps it |
| `f5/under-load.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `f5/variance.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `gate-race/natural-rate.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `gate-race/reproduce.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `golden-deals/probe-staged-live.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `grid-width/calibrate-barmeasure.mjs` | calibrate | round-scoped calibrate, unwired, uncited by any governing doc or source; git history keeps it |
| `grid-width/calibrate-p1.mjs` | calibrate | round-scoped calibrate, unwired, uncited by any governing doc or source; git history keeps it |
| `grid-width/probe-p0.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `grid-width/probe-p0b.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `grid-width/probe-p1.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `group-a/probe-group-a.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `group-b/probe-p0-b2.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `group-b/probe-p0-look.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `label-contrast/census.mjs` | other-check | round-scoped other-check, unwired, uncited by any governing doc or source; git history keeps it |
| `label-contrast/preview.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `label-contrast/proposal-b.css` | data/output | round output or proposal file, not a check |
| `label-contrast/proposal.css` | data/output | round output or proposal file, not a check |
| `lead-card-ui/census-timestamps.json` | data/output | round output or proposal file, not a check |
| `lead-card-ui/census-timestamps.mjs` | other-check | round-scoped other-check, unwired, uncited by any governing doc or source; git history keeps it |
| `lead-card-ui/probe-p0-lcuf.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `lead-card-ui/probe-p0b-lcuf.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `lead-card-ui/probe-p0c-lcuf.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `lead-card-ui/probe-p0d-lcuf.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `lead-card-ui/probe-p1-lcuf.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `lead-card-ui/probe-p1b-align.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `leads-card/probe-card-widths.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `leads-card/probe-card.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `leads-card/probe-completion-refresh.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `leads-card/probe-grid-dirty.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `leads-card/probe-nurture.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `leads-card/probe-p0-csfix.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `leads-card/probe-p0-polish.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `leads-card/probe-polish.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `leads-card/probe-qualify-conversion.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `leads-card/probe-qualify-route.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `leads-cleanup/probe-p0-confirm.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `leads-cleanup/probe-p1-lcc.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `leads-details/census-detail-retirement.mjs` | other-check | round-scoped other-check, unwired, uncited by any governing doc or source; git history keeps it |
| `leads-details/probe-p0-ldc.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `leads-details/probe-p0b-ldc.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `leads-details/retirement-inventory.json` | data/output | round output or proposal file, not a check |
| `leads/calibrate-new-lead-grid.mjs` | calibrate | round-scoped calibrate, unwired, uncited by any governing doc or source; git history keeps it |
| `leads/probe-followup-task.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `leads/probe-graduation.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `leads/probe-lead-detail-behaviour.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `leads/probe-leads-list.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `leads/probe-lifecycle.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `leads/probe-new-lead-grid.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `leads/probe-nurture-dom.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `leads/probe-p3-layout.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `lib/react-reach.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `opex-layout/calibrate.mjs` | calibrate | round-scoped calibrate, unwired, uncited by any governing doc or source; git history keeps it |
| `opex-layout/probe-p0-widths.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `opex/calibrate.mjs` | calibrate | round-scoped calibrate, unwired, uncited by any governing doc or source; git history keeps it |
| `opex/probe-live.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `opex/probe-p0-geometry.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `opportunity/probe-p0-followup-census.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `opportunity/probe-p0-red-census.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `opportunity/probe-p0-title-census.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `opportunity/probe-p0-top-region.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `opportunity/probe-r2-notes-orphaned.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `opportunity/probe-r3-followup.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `opportunity/probe-r4-live-states.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `opportunity/probe-r4-red-compare.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `opportunity/probe-r5-buttons.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `payfix2/calibrate-interpreter.mjs` | calibrate | round-scoped calibrate, unwired, uncited by any governing doc or source; git history keeps it |
| `payfix2/calibrate.mjs` | calibrate | round-scoped calibrate, unwired, uncited by any governing doc or source; git history keeps it |
| `payfix2/canary.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `payfix2/cols.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `payfix2/inspect.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `payfix2/migrate.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `payfix2/preconditions.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `payfix2/probe-interpreter.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `payfix2/probe-live.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `payfix2/probe-migrated.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `payfix2/probe-p0.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `payfix2/rates-check.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `payment-fix-census.mjs` | other-check | round-scoped other-check, unwired, uncited by any governing doc or source; git history keeps it |
| `payment-fix/calibrate.mjs` | calibrate | round-scoped calibrate, unwired, uncited by any governing doc or source; git history keeps it |
| `payment-fix/photograph-f5.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `payment-fix/probe-f5-width.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `payment-fix/probe-live.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `payment-fix/probe-p0.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `payment-rail/calibrate.mjs` | calibrate | round-scoped calibrate, unwired, uncited by any governing doc or source; git history keeps it |
| `payment-rail/probe-live.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `payment-rail/probe-p0.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `perf1/calibrate.mjs` | calibrate | round-scoped calibrate, unwired, uncited by any governing doc or source; git history keeps it |
| `perf1/phase0-route.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `perf1/phase0-views.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `perf1/phase0-who.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `photograph-reset-placement.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `polish/calibrate.mjs` | calibrate | round-scoped calibrate, unwired, uncited by any governing doc or source; git history keeps it |
| `polish/probe-live.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `polish/probe-m5-divergence.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `polish/probe-m5-live.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `polish/probe-m5.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `polish/probe-p0-layout.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `polish/probe-readback.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `probe-c2-awaiting-panel.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `probe-direct-paths.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `probe-e2-fee-ties-live.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `probe-e2-opex-reset.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `probe-freshness.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `probe-g2-approved-version.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `probe-h2-empty-rates.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `probe-label-convergence-live.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `probe-opex-row-levels.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `probe-raise-controls.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `probe-screen-findings.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `probe-scrollable.mjs` | probe | is-scrollable set iff the grid overflows. ROTTED: requires #deal-form-vanilla, removed 2026-09-21; the claim is held by frontend-react deal-identity.test.tsx, whose comment naming this file is corrected |
| `probe-strip-layout.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `probe-tl2-either-or.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `probe-transition-render.mjs` | probe | a transition re-renders the panel (borderline). ROTTED: calls window.openRefField, which no longer exists (GATE_HYGIENE; q2-rotted also flags ref-input-summary) |
| `probe-usability-batch.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `probe-version-join.mjs` | probe | version/approval join and the refused-write banner. FAIL 8/11. Anchored on live TT-SGP-SMARTC-118's history, which has moved; its 'refused write' PASSES FOR THE WRONG REASON (409 Closed Won lock, not ownership) and it sends a real PATCH to a record somebody else owns. The join is held by the pure version-approval tests |
| `probe-w4-score-500.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `probe-wlc1-version-fields.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `probe-wtl2-key-contacts.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `query-hybrid-recovery.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `record-creation/caller-census.mjs` | other-check | round-scoped other-check, unwired, uncited by any governing doc or source; git history keeps it |
| `record-creation/invariant-census.mjs` | other-check | round-scoped other-check, unwired, uncited by any governing doc or source; git history keeps it |
| `record-creation/reconcile-round.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `record-creation/route-name-sweep.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `record-creation/type-census.mjs` | other-check | round-scoped other-check, unwired, uncited by any governing doc or source; git history keeps it |
| `round-b/calibrate-r6r2.mjs` | calibrate | round-scoped calibrate, unwired, uncited by any governing doc or source; git history keeps it |
| `round-b/capabilities.json` | data/output | round output or proposal file, not a check |
| `round-b/census-capabilities.mjs` | other-check | round-scoped other-check, unwired, uncited by any governing doc or source; git history keeps it |
| `round-b/probe-baseline.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `round-b/probe-r6-account.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `round4/calibrate-reason.mjs` | calibrate | round-scoped calibrate, unwired, uncited by any governing doc or source; git history keeps it |
| `round4/calibrate-reason.out.txt` | data/output | round output or proposal file, not a check |
| `round4/diagnose.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `round4/reason-survives.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `round4/reason-survives.out.txt` | data/output | round output or proposal file, not a check |
| `round4/repeat-save.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `round4/visual-card.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `round4/visual-card.out.txt` | data/output | round output or proposal file, not a check |
| `round4/walk-card.mjs` | other-check | round-scoped other-check, unwired, uncited by any governing doc or source; git history keeps it |
| `round4/walk-card.out.txt` | data/output | round output or proposal file, not a check |
| `round4/works-under.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `round5/calibrate-textarea.mjs` | calibrate | round-scoped calibrate, unwired, uncited by any governing doc or source; git history keeps it |
| `round5/census.json` | data/output | round output or proposal file, not a check |
| `round5/door.json` | data/output | round output or proposal file, not a check |
| `round5/inject-phase1.mjs` | other-check | round-scoped other-check, unwired, uncited by any governing doc or source; git history keeps it |
| `round5/inject-phase1.out.txt` | data/output | round output or proposal file, not a check |
| `round5/inject-phase2.out.txt` | data/output | round output or proposal file, not a check |
| `round5/typing-probe.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `round5/typing-probe.out.txt` | data/output | round output or proposal file, not a check |
| `round5/visual-account.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `round5/visual-account.out.txt` | data/output | round output or proposal file, not a check |
| `round5/visual-reference.out.txt` | data/output | round output or proposal file, not a check |
| `round5/walk-reference.out.txt` | data/output | round output or proposal file, not a check |
| `round6/enumerate-retirement.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `round6/inject-phase-0.mjs` | other-check | round-scoped other-check, unwired, uncited by any governing doc or source; git history keeps it |
| `round6/inject-phase-1.mjs` | other-check | round-scoped other-check, unwired, uncited by any governing doc or source; git history keeps it |
| `round6/inject-phase-2.mjs` | other-check | round-scoped other-check, unwired, uncited by any governing doc or source; git history keeps it |
| `round6/inject-phase-2b.mjs` | other-check | round-scoped other-check, unwired, uncited by any governing doc or source; git history keeps it |
| `round6/inject-phase-2c.mjs` | other-check | round-scoped other-check, unwired, uncited by any governing doc or source; git history keeps it |
| `round6/inject-phase-r.mjs` | other-check | round-scoped other-check, unwired, uncited by any governing doc or source; git history keeps it |
| `round6/walk-close-date.mjs` | other-check | round-scoped other-check, unwired, uncited by any governing doc or source; git history keeps it |
| `round6/walk-contact.mjs` | other-check | round-scoped other-check, unwired, uncited by any governing doc or source; git history keeps it |
| `round7/door-tb.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `round7/inject-accounting.mjs` | other-check | round-scoped other-check, unwired, uncited by any governing doc or source; git history keeps it |
| `round7/inject-phase-1a.mjs` | other-check | round-scoped other-check, unwired, uncited by any governing doc or source; git history keeps it |
| `round7/inject-phase-1b-item2.mjs` | other-check | round-scoped other-check, unwired, uncited by any governing doc or source; git history keeps it |
| `round7/inject-phase-1b.mjs` | other-check | round-scoped other-check, unwired, uncited by any governing doc or source; git history keeps it |
| `round7/inject-phase-2b-s2.mjs` | other-check | round-scoped other-check, unwired, uncited by any governing doc or source; git history keeps it |
| `round7/inject-phase-2b.mjs` | other-check | round-scoped other-check, unwired, uncited by any governing doc or source; git history keeps it |
| `round7/inject-phase-2c.mjs` | other-check | round-scoped other-check, unwired, uncited by any governing doc or source; git history keeps it |
| `round7/inject-phase-2d-s2.mjs` | other-check | round-scoped other-check, unwired, uncited by any governing doc or source; git history keeps it |
| `round7/inject-phase-2d-s3.mjs` | other-check | round-scoped other-check, unwired, uncited by any governing doc or source; git history keeps it |
| `round7/inject-phase-2d.mjs` | other-check | round-scoped other-check, unwired, uncited by any governing doc or source; git history keeps it |
| `round7/tb-app-surface.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `round7/tb-view-surface.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `round7/walk-tb-2e.mjs` | other-check | round-scoped other-check, unwired, uncited by any governing doc or source; git history keeps it |
| `round7/walk-tb-save.mjs` | other-check | round-scoped other-check, unwired, uncited by any governing doc or source; git history keeps it |
| `round8/css-readers.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `round8/dead-shell-code.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `round8/delete-dead-shell.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `round8/inject-phase-1.mjs` | other-check | round-scoped other-check, unwired, uncited by any governing doc or source; git history keeps it |
| `round8/inject-phase-2.mjs` | other-check | round-scoped other-check, unwired, uncited by any governing doc or source; git history keeps it |
| `round8/readers-of-is-not-mine.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `round8/retired.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `round8/walk-estate.mjs` | other-check | round-scoped other-check, unwired, uncited by any governing doc or source; git history keeps it |
| `rpc-writes/measure-20.mjs` | other-check | round-scoped other-check, unwired, uncited by any governing doc or source; git history keeps it |
| `rpc-writes/sweep-load.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `scanner-window/reproduce.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `scanner-window/scope.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `scoring/probe-f-com.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `scoring/probe-fcom-fields.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `scoring/probe-p0.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `scoring/probe-r6-linger.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `scoring/probe-r7-budget.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `scoring/probe-step3-live.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `sibling-surfaces/probe-sibling-rest.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `sibling-surfaces/probe-sibling-writes.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `sizing/calibrate.mjs` | calibrate | round-scoped calibrate, unwired, uncited by any governing doc or source; git history keeps it |
| `sizing/census.mjs` | other-check | round-scoped other-check, unwired, uncited by any governing doc or source; git history keeps it |
| `sizing/measure-formats.mjs` | other-check | round-scoped other-check, unwired, uncited by any governing doc or source; git history keeps it |
| `slider-direction/calibrate.mjs` | calibrate | round-scoped calibrate, unwired, uncited by any governing doc or source; git history keeps it |
| `slider-direction/probe-knob.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `stage-panels/apply-r10-rows.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `stage-panels/live-specs/grid.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `stage-panels/live-specs/r11-chrome.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `stage-panels/live-specs/span.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `stage-panels/live-specs/w10-slot.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `stage-panels/live-specs/w5-queue.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `stage-panels/probe-buttons.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `stage-panels/probe-contact-visibility.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `stage-panels/probe-r10-invariant.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `stage-panels/probe-r10.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `stage-panels/probe-r11.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `stage-panels/probe-w34.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `stage-panels/probe-w5-pairs.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `stage-panels/probe-w5-refusal.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `stage-panels/probe-w5.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `stage-panels/probe-walk2.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `stage-panels/recheck-dirty-data.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `stage-panels/server-specs/contact-sticky.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `stage-panels/server-specs/r10-label.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `stage-panels/server-specs/r10-missing.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `stage-panels/server-specs/r11-list.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `stage-panels/server-specs/w5-reload.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `stage-panels/server-specs/w5-voice.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `stage-panels/server-specs/w6-select.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `stage-panels/server-specs/w8b-sticky.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `stage-panels/unit-specs/buttons.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `stage-panels/unit-specs/pilot.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `stage-panels/unit-specs/w5-queue.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `stage-panels/unit-specs/walk2.mjs` | other-check | round-scoped other-check, unwired, uncited by any governing doc or source; git history keeps it |
| `standard-rollout/diag-account.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `standard-rollout/probe-p0.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `standard-rollout/probe-p1.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `teardown-cost/calibrate-retry.mjs` | calibrate | round-scoped calibrate, unwired, uncited by any governing doc or source; git history keeps it |
| `teardown-cost/measure-20.mjs` | other-check | round-scoped other-check, unwired, uncited by any governing doc or source; git history keeps it |
| `teardown-cost/measure-a.mjs` | other-check | round-scoped other-check, unwired, uncited by any governing doc or source; git history keeps it |
| `teardown-cost/measure-b.mjs` | other-check | round-scoped other-check, unwired, uncited by any governing doc or source; git history keeps it |
| `teardown-integrity/audit-page-cap-live.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `teardown-integrity/audit-page-cap.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `teardown-integrity/census-handover-sites.mjs` | other-check | round-scoped other-check, unwired, uncited by any governing doc or source; git history keeps it |
| `teardown-integrity/measure-21.mjs` | other-check | round-scoped other-check, unwired, uncited by any governing doc or source; git history keeps it |
| `teardown-integrity/measure-vanilla-retirement.mjs` | other-check | round-scoped other-check, unwired, uncited by any governing doc or source; git history keeps it |
| `term-pricing/calibrate-view.mjs` | calibrate | calibrated probe-screen's claims by injecting into TermPricingView.tsx. its anchors are TP_TABS/TP_CAPEX screen code and its probe is being cut to two modes; rebuilt from the repointed probe-screen if that is ever wired |
| `testbed-commercials/calibrate-recovery.mjs` | calibrate | round-scoped calibrate, unwired, uncited by any governing doc or source; git history keeps it |
| `testbed-core/P0_EVIDENCE_INDEX.md` | data/output | round output or proposal file, not a check |
| `testbed-core/calibrate-p1-live.mjs` | calibrate | round-scoped calibrate, unwired, uncited by any governing doc or source; git history keeps it |
| `testbed-core/calibrate-p1.mjs` | calibrate | round-scoped calibrate, unwired, uncited by any governing doc or source; git history keeps it |
| `testbed-core/calibrate-p2-live.mjs` | calibrate | round-scoped calibrate, unwired, uncited by any governing doc or source; git history keeps it |
| `testbed-core/calibrate-p2.mjs` | calibrate | round-scoped calibrate, unwired, uncited by any governing doc or source; git history keeps it |
| `testbed-core/calibrate-unit.mjs` | calibrate | round-scoped calibrate, unwired, uncited by any governing doc or source; git history keeps it |
| `testbed-core/live-specs/p3-addenda.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `testbed-core/live-specs/p3-buyers.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `testbed-core/live-specs/p4-riders-a.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `testbed-core/live-specs/p4-riders-b.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `testbed-core/live-specs/p4-riders-c.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `testbed-core/live-specs/p5-r12-a.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `testbed-core/live-specs/p5-r12-b.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `testbed-core/probe-p0.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `testbed-core/probe-p1-exit.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `testbed-core/probe-p2-score.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `testbed-core/probe-p3-addenda.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `testbed-core/probe-p3-buyers.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `testbed-core/probe-p4-riders.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `testbed-core/probe-p5-r12.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `testbed-core/unit-specs/p3-buyers.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `testbed-core/unit-specs/p4-riders.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `testbed-core/unit-specs/p5-r12.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `testbed-header/probe-overdue-acceptance.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `testbed-header/probe-transition-stamp.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `testbed-layout/probe-p0.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `testbed-layout/probe-r4.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `testbed-state/calibrate-r1-move.mjs` | calibrate | round-scoped calibrate, unwired, uncited by any governing doc or source; git history keeps it |
| `testbed-state/probe-r2-followup.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `testbed-state/probe-r2-live.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `testbed-state/probe-r3-split.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `testbed-units/calibrate-r3-server.mjs` | calibrate | round-scoped calibrate, unwired, uncited by any governing doc or source; git history keeps it |
| `testbed-units/calibrate-server.mjs` | calibrate | round-scoped calibrate, unwired, uncited by any governing doc or source; git history keeps it |
| `testbed-units/k3-per-test.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `testbed-units/k3-query-timing.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `testbed-units/live-specs/p1-r1-a.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `testbed-units/live-specs/p1-r1-b.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `testbed-units/live-specs/p2-b4-a.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `testbed-units/live-specs/p2-b4-b.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `testbed-units/live-specs/p3-l3.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `testbed-units/live-specs/p3-r8.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `testbed-units/probe-p0.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `testbed-units/probe-p1-r1.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `testbed-units/probe-p2-b4.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `testbed-units/probe-p3-surface.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `testbed-units/probe-p4-r2.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `testbed-units/prune-ledger.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `testbed-units/server-specs/r2-single-holder.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `testbed-units/unit-specs/p1-r1.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `testbed-units/unit-specs/p2-b4.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `testbed-units/unit-specs/p3-surface.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `testbed-walk2/build-harness.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `testbed-walk2/calibrate-w6.mjs` | calibrate | round-scoped calibrate, unwired, uncited by any governing doc or source; git history keeps it |
| `testbed-walk2/probe-dot.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `ui-hygiene/calibrate-enumeration.mjs` | calibrate | round-scoped calibrate, unwired, uncited by any governing doc or source; git history keeps it |
| `ui-hygiene/calibrate-help-exemption.mjs` | calibrate | round-scoped calibrate, unwired, uncited by any governing doc or source; git history keeps it |
| `ui-hygiene/calibrate-widget-door.mjs` | calibrate | round-scoped calibrate, unwired, uncited by any governing doc or source; git history keeps it |
| `ui-hygiene/census-door.mjs` | other-check | round-scoped other-check, unwired, uncited by any governing doc or source; git history keeps it |
| `ui-hygiene/enumerate-write-surface.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `ui-hygiene/probe-door-interaction.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `ui-hygiene/probe-p23-server-proofs.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `ui-hygiene/probe-server-refuses.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `ui-hygiene/probe-server-rejects.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `ui-standards-leads/probe-p0-conformance.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `ui-standards-leads/probe-p0b-door.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `ui-standards-leads/probe-p1-conformance.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `ui-standards/census-f3.json` | data/output | round output or proposal file, not a check |
| `ui-standards/census-f3.mjs` | other-check | round-scoped other-check, unwired, uncited by any governing doc or source; git history keeps it |
| `ui-standards/probe-p0-panels.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `ui-standards/probe-p1-panels.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `walk-round3.mjs` | other-check | round-scoped other-check, unwired, uncited by any governing doc or source; git history keeps it |
| `walk10/ab-page-lifetime.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `walk10/calibrate.mjs` | calibrate | round-scoped calibrate, unwired, uncited by any governing doc or source; git history keeps it |
| `walk10/probe-header-align.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `walk11/calibrate.mjs` | calibrate | round-scoped calibrate, unwired, uncited by any governing doc or source; git history keeps it |
| `walk11/probe-d1-card.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `walk11/probe-d2-fit.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `walk11/probe-d3-install-margin.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `walk11/probe-phase0.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `walk12/probe-g1-g6-terms.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `walk12/probe-g7-payment.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `walk12/probe-g8-scrollbar.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `walk12/probe-g9-labels.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `walk3/live-specs/rk-move.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `walk3/live-specs/rk-panel.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `walk3/probe-amber-adopt.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `walk3/probe-btn-attention-shot.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `walk3/probe-rk-live.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `walk3/probe-rk-second-surface.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `walk3/probe-rp-prompts.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `walk3/probe-rv7-shot.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `walk3/probe-v2-v3.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `walk3/probe-v4-loss.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `walk3/probe-v4-siblings.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `walk3/probe-v4-variants.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `walk3/probe-v4.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `walk3/probe-v8.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `walk3/rk-spec.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `walk3/rp-spec.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `walk3/server-specs/v8-reserved.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `walk4/calibrate-hosting-override.mjs` | calibrate | round-scoped calibrate, unwired, uncited by any governing doc or source; git history keeps it |
| `walk4/calibrate-hybrid-panel.mjs` | calibrate | round-scoped calibrate, unwired, uncited by any governing doc or source; git history keeps it |
| `walk4/calibrate-notes-header.mjs` | calibrate | round-scoped calibrate, unwired, uncited by any governing doc or source; git history keeps it |
| `walk4/calibrate-override-ui.mjs` | calibrate | round-scoped calibrate, unwired, uncited by any governing doc or source; git history keeps it |
| `walk4/probe-hosting-override.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `walk4/probe-hybrid-panel.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `walk4/probe-milestone-grid.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `walk4/probe-notes-header.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `walk4/probe-p0-commercials.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `walk5/calibrate-key-contacts.mjs` | calibrate | round-scoped calibrate, unwired, uncited by any governing doc or source; git history keeps it |
| `walk5/calibrate-layout.mjs` | calibrate | round-scoped calibrate, unwired, uncited by any governing doc or source; git history keeps it |
| `walk5/probe-key-contacts.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `walk5/probe-layout.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `walk5/probe-notes-line.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `walk5/probe-p0.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `walk6/calibrate-n2-n3-n4.mjs` | calibrate | round-scoped calibrate, unwired, uncited by any governing doc or source; git history keeps it |
| `walk6/probe-contractor-ambiguity.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `walk6/probe-n1-ambiguity.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `walk6/probe-n2-install.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `walk6/probe-n3-n4.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `walk7/f1-data.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `walk7/f1-names.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `walk7/f2-shape.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `walk7/probe-f1-owned.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `walk7/probe-f1-picker.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `walk7/probe-f2-fit.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `walk7/residue.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `walk8/measure-terms.mjs` | other-check | round-scoped other-check, unwired, uncited by any governing doc or source; git history keeps it |
| `walk8/probe-item3-state.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `walk8/probe-tax-line.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `walk8/writer-census.mjs` | other-check | round-scoped other-check, unwired, uncited by any governing doc or source; git history keeps it |
| `walk9/calibrate-k2-k3-k4.mjs` | calibrate | round-scoped calibrate, unwired, uncited by any governing doc or source; git history keeps it |
| `walk9/probe-k1-fit.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `walk9/probe-k2-k4.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `walk9/probe-k3-dialogue.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `walk9/probe-k3-removal.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `write-auth/policy-census.mjs` | other-check | round-scoped other-check, unwired, uncited by any governing doc or source; git history keeps it |
| `write-auth/probe-document-details.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `write-auth/probe-issue-and-request.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `write-auth/probe-owner-scoped.mjs` | probe | round-scoped probe, unwired, uncited by any governing doc or source; git history keeps it |
| `write-auth/route-census.mjs` | other-check | round-scoped other-check, unwired, uncited by any governing doc or source; git history keeps it |
| `write-auth/teardown-r10.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `write-auth/teardown-r11.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
| `write-auth/teardown-r3-sibling.mjs` | tool | round-scoped tool, unwired, uncited by any governing doc or source; git history keeps it |
