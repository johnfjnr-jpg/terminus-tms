ROUND: TP_CAPEX (term pricing CAPEX restructure: two TCVs, CAPEX amount, Two-phase and Hybrid)
Follow the tms-round-method skill. Never run git push. Gates run with NordVPN quit.

PRECONDITIONS
- git ls-remote origin main shows 54ab35b (PER_CAMERA_AND_CAPEX_P0). If not, STOP: John has not pushed.
- John has placed prototypes/term-pricing-capex.html (approved mockup, John 2026-10-10). Commit it on
  the round branch with the brief. If it is missing, STOP.
- Branch tp-capex off origin/main. First commit: this brief, verbatim, as TP_CAPEX_BRIEF.md.

PRINCIPLE OF RECORD (supersedes B-5 wording and the Part B mapping in PER_CAMERA_AND_CAPEX_P0_PART_B.md)
OPEX sets the price. CAPEX is a way of paying part of that price earlier, against a client CAPEX budget.
The remainder is paid as a monthly subscription. CPI is an uplift on the subscription, never on CAPEX.

RULINGS (John, 2026-10-10)
C-1  BASE TCV = the OPEX ladder TCV with no escalator. Base TCV drives approval, margin, the margin
     floor flag, the profit table and the volume discount. It is identical under OPEX and CAPEX.
C-2  FINAL TCV = Base TCV plus the CPI uplift. Under OPEX the uplift applies to the monthly fee; under
     CAPEX to the subscription only. With no CPI, Final TCV = Base TCV.
C-3  CPI MODE: None | Published CPI | Locked rate. Each takes a rate and a start year S (existing
     control). Published CPI: Final TCV is labelled "projected" and the deal value stays Base TCV.
     Locked rate (a negotiated fixed figure): Final TCV is contractual and becomes the deal value.
     DEAL VALUE = Base TCV unless the mode is Locked rate, then Final TCV.
C-4  CAPEX AMOUNT: toggle Hardware | Custom. Hardware (default) = sum over products of
     units x HW_COST / (1 - HW_UPFRONT_MARGIN), rounded half-up to cents ONCE at deal level
     (demo deal: 1,550,000.00). Custom = any amount typed, kept exactly as entered.
     Refuse unless 0 < CAPEX < Base TCV.
C-5  SUBSCRIPTION: base fee = round_half_up((Base TCV - CAPEX) / T, 2) for months 1..T-1;
     month T carries the rounding so that CAPEX + sum of base subscription = Base TCV exactly.
     CPI applies to the subscription using the EXISTING spec escalator rule (see Phase 0 item 2).
     CAPEX payments never escalate.
C-6  STRUCTURES (CAPEX only):
     Two-phase: recovery period R, default 12, editable, 1..T. Instalment = round_half_up(CAPEX / R, 2)
       for months 1..R-1; month R carries the rounding. Subscription runs months 1..T alongside.
     Hybrid (default under CAPEX): up to 5 milestone rows. Each row = Milestone (dropdown, the SAME
       list as Commercials), Month (integer input, 0..T, 0 = contract start), Share %, Amount (read-only).
       Default: one row, Contract start, month 0, 100%. Shares must total exactly 100% or the quote is
       refused. Amount = round_half_up(CAPEX x share, 2), last row carries the rounding. A milestone may
       appear once per schedule. Months must be non-decreasing down the rows; refuse otherwise.
       A milestone in month m >= 1 adds to that month's invoice; month 0 is its own invoice.
C-7  ROUNDING GOES ON THE LAST ITEM EVERYWHERE: last instalment, last milestone, last month.
     Supersedes Part B's "month 1 carries residue".
C-8  SPLIT WHT: the hardware rate applies to CAPEX payments up to the hardware value (the C-4 Hardware
     figure), taken in payment order; any CAPEX above the hardware value and all subscription take the
     SaaS rate. Single WHT applies to the whole invoice. WHT before GST and gross-up behaviour as in
     spec v1.5. WHT is never allocated to products.
C-9  WARNINGS (show, never refuse): (a) CAPEX below hardware COST: "Terminus funds X of hardware";
     (b) base subscription fee below the deal's monthly hosting cost.
C-10 PER-CAMERA: no per-camera CAPEX figure anywhere. Under CAPEX the ladder shows Term and
     OPEX / cam / mo only (T31 unchanged). Remove the CAPEX per-camera columns.
C-11 SHARED MILESTONE LIST: the milestone names (Contract start, Hardware delivered to site,
     Installation complete, Commissioning, Go live, Final acceptance) are defined ONCE and used by
     both Commercials and term pricing. Amend R-TP1 in CLAUDE.md: "except the shared milestone
     vocabulary (names only, no pricing logic)". Commercials behaviour must not move: goldens G1 to G5
     unchanged is the proof.
C-12 NOT CARRIED into term pricing: installation, annual invoicing, PO factoring.
C-13 LAYOUT: per prototypes/term-pricing-capex.html. Content and behaviour are binding. Visual
     language (cards, toggles, tiles, schedule table) follows the existing term pricing screen.
     Price card: Base TCV (APPROVAL tag), Final TCV, OPEX monthly fee year 1 (reference), Deal value.
     Quote tiles under CAPEX: CAPEX, Subscription, Cash in year 1 (vs OPEX), Base or Final TCV.
     Payment schedule columns: Months | CAPEX | Subscription | Invoice.

PHASE 0 (investigate, change nothing, then STOP with a report)
1. Locate the Commercials milestone list and every reader of it. Propose the shared module path.
2. Quote the current spec's escalator rule verbatim (formula, rounding, start year, how the residue
   month escalates). Do NOT compute CPI goldens; Claude issues them from the rule.
3. List every existing T-test and golden touching CAPEX or "hardware upfront" (expected: T14, T15,
   T22, T30, plus any probe figures) with inputs and current expected figures. Claude issues the new
   figures; do not derive them.
4. List the WHT rates the probes use for split WHT, so Claude can issue a split-WHT golden.
5. Confirm the demo deal inputs (120 SafeSight, 40 AQ, 2 HEMIR, 60 months, spec 90% margins via the
   browser copy of settings) reproduce Base TCV 22,018,611.00 and hardware cost 1,240,000.00.
6. Name any part of this brief that conflicts with the code, the spec or CLAUDE.md.
STOP. Report. Wait for Claude's rulings and the remaining goldens.

GOLDENS ALREADY ISSUED (spec v1.6; copy into the spec, never compute with the code under test)
Demo deal, 60 months, no CPI. Base TCV 22,018,611.00 in every case.
G-C1 Hybrid default: Contract start, month 0, 100%: CAPEX 1,550,000.00. Subscription 341,143.52
     months 1..59, 341,143.32 month 60. Final TCV 22,018,611.00. Deal value = Base TCV.
     Cash in year 1 5,643,722.24 (OPEX year 1: 4,403,722.20).
G-C2 Custom 1,000,000.00, Hybrid: Contract start m0 30% = 300,000.00; Hardware delivered to site m3
     40% = 400,000.00; Commissioning m6 30% = 300,000.00. Subscription 350,310.18 months 1..59,
     350,310.38 month 60. Invoices: m0 300,000.00; m3 750,310.18; m6 650,310.18. Warning (a):
     Terminus funds 240,000.00. Cash in year 1 5,203,722.16.
G-C3 Two-phase, Hardware amount, R = 12: instalment 129,166.67 months 1..11, 129,166.63 month 12.
     Invoices 470,310.19 months 1..11, 470,310.15 month 12, 341,143.52 months 13..59, 341,143.32
     month 60. Cash in year 1 5,643,722.24.
G-C4 Refusals: CAPEX 0; CAPEX = Base TCV; shares totalling 99.9% and 100.1%; duplicate milestone;
     month > T; months decreasing; R = 0; R > T.
PENDING after Phase 0: CPI goldens (Locked 3% from year 2 on G-C1), re-issued T14/T15/T22/T30,
split-WHT golden.

AFTER RULINGS (normal round method)
spec v1.6 commit first (C-1..C-13, goldens) -> tests fail first -> engine -> view -> probes from the
click (--spec) including the four mockup states -> calibration injections each FIRED -> overlap sweep
1240..1920 step 40, all states, zero -> full gate (26 stages) -> merge --no-ff -> merged gate ->
ls-remote re-check -> "ready for John's push". Isolation R-TP1 holds except C-11.

RIDER R-1: CURRENT_STATE.md gains a dump of term_pricing_settings (live values, incl. SafeSight
anchor margin 50%), so no reader assumes the spec's 90%.
