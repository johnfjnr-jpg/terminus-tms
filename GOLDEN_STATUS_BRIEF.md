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

QUEUED: John's Excel check of G1 and G5, then a one-commit stamp round;
factoring on the term screen (spec v1.10 first); probe triage; 23
harness rules cleanup; workflow audit_log gap.
