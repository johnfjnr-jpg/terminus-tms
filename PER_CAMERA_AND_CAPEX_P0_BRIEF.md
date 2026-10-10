ROUND: PER_CAMERA_AND_CAPEX_P0
Base: origin/main expected <TILE_FIT pushed SHA> (ls-remote; mismatch, STOP). Branch per-camera.
First commit: this brief verbatim as PER_CAMERA_AND_CAPEX_P0_BRIEF.md.

PART A (build; cosmetic plus a small engine addition): OPEX per-camera column
A1 Term ladder, OPEX only: new column "Per camera / mo" directly after the monthly fee column =
   SafeSight line monthly total (after banded volume discount) / SafeSight units, round half-up to
   cents. "-" when SafeSight units = 0. Under CAPEX the column is not shown yet (Part B decides it).
A2 SPEC FIRST (v1.5, own commit): definition above, plus T31 (120 SafeSight, 40 AQ, 2 HEMIR, OPEX,
   catalog costs; COPY, computed outside the engine): per camera 12: 8,009.44; 24: 4,928.89;
   36: 3,902.04; 48: 2,972.74; 60: 2,415.16; 72: 2,043.44; 84: 1,777.92; 96: 1,578.79;
   108: 1,423.90; 120: 1,299.99.
A3 STOP with ladder screenshots at 1240, 1600 and 1920 for John's approval BEFORE the gate.

PART B (REPORT ONLY, no code): the Commercials CAPEX structures, for Term Pricing to adopt
B1 Extract from the deal-sheet code exactly how Two-phase and Hybrid work today: inputs (recovery
   period, milestones, their defaults and limits), what portion of price each recovers, how hosting
   is invoiced alongside, rounding and residue rules, how PO factoring attaches. Cite file and line.
B2 Propose how Term Pricing maps onto them: hardware amount (today hardware cost at HW_UPFRONT_MARGIN),
   the SaaS monthly fee (TCV minus hardware, escalated per section 7), split-WHT lines per structure,
   and today's "hardware upfront" as Hybrid with one 100% milestone at month 0 (T15, T22, T30 must
   reproduce unchanged).
B3 Propose the CAPEX per-camera columns for the ladder (hardware per camera, SaaS fee per camera).
B4 Re-implement, never import (R-TP1). Propose nothing beyond the mapping.

EXIT for Part A after approval: goldens incl. T31 exact; G1 to G5 unchanged; overlap sweep zero;
full gate (NordVPN quit, resolver clean); merge --no-ff; merged gate; ls-remote re-check; stop at
"ready for John's push". Never git push.

---

RULINGS (John, 2026-10-10), appended at the phase they launch (the exit):
R1 SafeSight ANCHOR_MARGIN 50% stays as set: the margin formula is under review and is a live
   setting, not a defect. OPEX drives the price; CAPEX is payment timing on the same TCV. Probes
   keep proving the spec figures via --spec; live data is not changed by this round.
R2 Accept the wrapped "Per camera / mo" heading at 1240 as built.
A3 APPROVED: run the exit (overlap sweep, goldens, full gate with NordVPN quit, merge --no-ff,
   merged gate, ls-remote re-check), stop at "ready for John's push". Never git push.
Part B rulings, recorded in the close-out for the next round (nothing built here):
 B-1 Two-phase hardware residue carried by month 1.
 B-2 Hybrid milestone percentages must total exactly 100% or the quote refuses.
 B-3 CAPEX per-camera column set as proposed, subject to a mockup approved by John before build.
 B-4 Today's "hardware upfront" becomes Hybrid with one milestone, month 0, 100%; T15, T22, T30
     unchanged.
 B-5 Principle of record: OPEX sets the price and TCV; CAPEX structures (Two-phase, Hybrid) only
     schedule payment of that same TCV.
QUEUED: FB1 (deal-sheet recovery period longer than the contract silently under-collects hardware)
as a pricing defect; FB2 and FB3 alongside it.
