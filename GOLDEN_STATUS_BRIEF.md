ROUND: GOLDEN STATUS PER DEAL
Base: main at e052d5a (confirm by ls-remote; differs: STOP).
Branch: golden-status. First commit: this brief verbatim as
GOLDEN_STATUS_BRIEF.md. ls-remote base check at branch and merge.
Rule 18. NordVPN OFF, PUPPETEER_PATH set for the gate. Each phase reports
(REPORT_FOR_CHAT.md, OneDrive, pbcopy) and waits for sign-off.

SOURCE: 2026-11-15 golden status check. expectations.json holds ONE status
for all five deals; compute.mjs:308-321 resets it to PROVISIONAL on any
re-run, so R-TL1a's G1 change wiped G2 to G4's confirmation although
their 2,745 figures are byte-identical to 6550b09.

JOHN'S RULINGS (2026-11-15):
R-GS1 Status is recorded PER DEAL: each deal carries status, confirmedBy,
      confirmedOn. A change to one deal can never alter another's status.
R-GS2 G2, G3, G4: CONFIRMED, John Fryatt, 2026-09-28 (their figures are
      byte-identical to what he signed). G1 and G5: PROVISIONAL pending his
      Excel check. No deal is stamped CONFIRMED by this round other than
      G2 to G4, and only after their byte-identity is proved again here.
R-GS3 Stale text corrected: five deals, 4,734 figures, per-deal status,
      everywhere the 2026-11-15 check listed (gate comment, harness
      header, compute.mjs header generator, deals.mjs, engine.mjs,
      PRICING_LOGIC.md, DESIGN_PRINCIPLES.md current-state entry; leave
      historical round records alone). TEST_LOG_1_CLOSE_OUT.md:153's
      "remain CONFIRMED" gets a dated correction note, not a rewrite.
R-GS4 The "pricing may not move without this suite going red" message
      prints on EVERY run, with the per-deal status table.

PHASE 1: investigate (read-only). Every reader and writer of status,
confirmedBy, confirmedOn (compute.mjs, golden-deals-check, verify-all,
GOLDEN_DEALS.md generation, any probe). Prove G2-G4 byte-identity to
6550b09 again (calibrated). Propose the per-deal schema and how
compute.mjs decides: a deal whose figures are unchanged KEEPS its status;
a deal whose figures change resets to PROVISIONAL with confirmedBy/On
removed. STOP.

PHASE 2: build and prove.
- Per-deal schema; harness checks each deal (unknown status red;
  CONFIRMED without name and date red, per deal).
- Calibrate: change one G3 input, recompute: G3 resets to PROVISIONAL,
  G2 and G4 stay CONFIRMED, G1 and G5 stay PROVISIONAL; harness red on
  the moved figures; revert, byte-identical.
- Gate output shows the per-deal table and the R-GS4 message every run.
- Stale text per R-GS3.
STOP.

PHASE 3: DESIGN_PRINCIPLES (a confirmation is recorded where the thing
confirmed lives; one flag for five deals let one change erase four
sign-offs). CURRENT_STATE if affected. Full gate, no skips. Push-ready SHA.
STOP.

PHASE 1 SIGN-OFF (John, 2026-11-15), appended at the phase it launches:
- Schema: per-deal status/confirmedBy/confirmedOn; top-level status
  REMOVED. ACCEPTED.
- compute.mjs rule: carry status only when the deal's figures are
  byte-identical to the prior file; otherwise PROVISIONAL with no name or
  date; never writes CONFIRMED from nothing; missing/unparseable prior
  file resets all and says so; key reorder resets (safe direction).
  ACCEPTED. Superseded comment kept visible with a dated note.
- Harness checks 1 to 5, including missing status = red and PROVISIONAL
  with a name or date = red. ACCEPTED.
- GOLDEN_DEALS.md carries no status, only a pointer to where it lives.
  ACCEPTED.
- Gate echo of the harness's GOLDEN STATUS block via markers; missing
  markers on a passing stage fail the stage loudly. ACCEPTED.
- calibrate.mjs rebuilt in this round (dead since ee177d8): G1-only anchor
  for case 3, per-deal cases replace 5 to 7, case 1 expects G5. ACCEPTED.
- engine.mjs "all four": measure G5's Test Bed cost before rewording.
  ACCEPTED.
R-GS5 (ADDITION, John rules): each CONFIRMED deal carries
      confirmedFiguresSha256 = SHA-256 of JSON.stringify(figures, null, 2)
      at confirmation. Harness refuses CONFIRMED whose figures no longer
      hash to it, and CONFIRMED without the field. compute.mjs carries it
      with the status (identical figures give an identical hash).
      Calibrate: hand-edit one G2 figure leaving CONFIRMED fields: harness
      red naming G2; revert. The G2-G4 stamp in Phase 2 computes the hash
      from the re-proved byte-identical figures.

PHASE 2 SIGN-OFF (John, 2026-11-16), appended at the phase it launches:
Phase 2 ACCEPTED at 9116b25.
- Migration reset all five, G2-G4 stamped by hand from 6550b09 figures
  with hash refusal on mismatch: ACCEPTED.
- Refused deal shown as REFUSED and excluded from the CONFIRMED and
  PROVISIONAL lists: ACCEPTED.
- Calibrator false-silence (undefined === undefined) found and fixed:
  ACCEPTED as reported.
ADDITION (John rules): build the queued guard in Phase 3. A pure test,
  in npm test, asserting each calibrate.mjs case's anchor occurs exactly
  once in its target file at the committed tree. Calibrate: duplicate one
  anchor (as G5 did to case 3) and remove another; the test fails naming
  each case; revert, green.
Phase 3: the guard, DESIGN_PRINCIPLES entry (a confirmation is recorded
  where the thing confirmed lives; one flag for five deals let one change
  erase four sign-offs; a confirmation names the exact figures it
  confirmed), CURRENT_STATE if affected, full gate (NordVPN OFF,
  PUPPETEER_PATH set, no skips), push-ready SHA. Rule 18. Stop.

QUEUED: John's Excel check of G1 and G5, then a one-commit stamp round;
factoring on the term screen (spec v1.10 first); probe triage; 23
harness rules cleanup; workflow audit_log gap.
