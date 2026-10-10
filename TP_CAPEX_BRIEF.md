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

---

## Rulings on Phase 0, appended at the phase they launch (2026-10-10), verbatim

TP_CAPEX: RULINGS ON PHASE 0 (Claude, under John's rulings of 2026-10-10). Resume the round.

Q1  CONFIRMED. C-1 applies under OPEX as well. Every escalated test reports BOTH figures:
    Base TCV (no CPI; margin, approval, profit table) and Final TCV (with CPI). T16 and T27 keep
    their escalated TCV as Final TCV.
Q2  CAPEX SUBSCRIPTION ESCALATION, spec v1.6 wording:
      base_fee      = round_half_up((Base TCV - CAPEX) / T, 2)      months 1..T-1
      base_fee(T)   = (Base TCV - CAPEX) - base_fee x (T-1)          month T carries the rounding
      sub(m)        = round_half_up(base_fee(m) x factor(k), 2)      k = contract year of month m
      factor(k) as spec section 7 (S, escalator_pct). Month T escalates its OWN base by year k's
      factor. Final TCV = CAPEX + sum of sub(m). CAPEX payments never escalate.
    Section 6's old CAPEX escalator formula (residue into upfront) is struck.
Q3  MODES for existing tests: T16 Published; T27 Locked; T22 Locked; T28 Published; T30 Locked;
    L1 Published. Deal value = Base TCV under Published, Final TCV under Locked.
Q4  ACCEPT YOUR PROPOSAL. The engine never sees milestone names; it validates shares, months,
    duplicates (by the row's milestone key passed as an opaque token) and count. The screen takes
    the list from src/lib/milestone-vocabulary.js. R-TP1 part 1 stands with NO exception; record
    the vocabulary module in the isolation test header. Do not edit CLAUDE.md for this.
Q5  TWO SCHEDULES. The BASE schedule (no CPI) feeds approval: margin, the margin floor, the profit
    table and margin after WHT. The FINAL schedule (with CPI) is what the client is invoiced: GST,
    gross-up, WHT, TCV incl. GST and the payment schedule shown. With no CPI they are the same
    schedule. The L1 foot holds on each schedule separately. Per-product figures are Base only;
    Final TCV is deal-level only (no CPI uplift is allocated to products).
Q6  APPROVAL ALWAYS FOLLOWS BASE TCV (John: "that is what the deal will be approved on").
    The Deal value card follows C-3 (Final under Locked). Subtitle the card "Pipeline value", not
    "Pipeline and approval value". The APPROVAL tag stays on Base TCV in every mode.
Q7  ACCEPT YOUR PROPOSAL. Every existing section the mockup omits stays as built. The four mockup
    columns lead the schedule, today's tax columns follow.
Q8  ACCEPT YOUR PROPOSAL. A straddling CAPEX payment's invoice carries two lines (hardware up to
    the boundary, SaaS above), each rounded per spec 8.1. Golden G-C6 below.
Q9  OPEX SPLIT WHT UNCHANGED (John's earlier ruling): hardware line = round_half_up(C-4 hardware
    figure / T, 2) flat, never escalated; service line = fee - hardware line. T25 and both B4
    positions keep their figures.
Q10 ACCEPT: Cash in year 1 = net invoices, months 0 to 12, before GST and WHT, on the schedule
    displayed.
Q11 ACCEPT: the margin banner is not built.
Q12 ACCEPT: under CAPEX the ladder shows Term and OPEX / cam / mo only; spec section 13's row
    closes; A1 ladder positions re-point or retire with reasoning. Re-point or retire
    prototypes/term-pricing/build-mockup.mjs and say which.
Q13 CORRECTION OF THE BRIEF: C-12 is narrowed to "the CAPEX structures do not inherit
    installation or annual invoicing from Commercials". PO factoring STAYS: keep spec section 6's
    closing line and section 9 as written (John, 2026-10-01: factoring stays in the cash flow).
Q14 ACCEPT: existing start-year select, default 2, shown for Published and Locked, hidden under None.

GOLDENS (copy into spec v1.6; never compute with the code under test)
Settings: the spec's settings (SafeSight 8,000 / 200; AQ 2,000 / 100; HEMIR 100,000 / 500;
anchor margin 90%; HW_UPFRONT_MARGIN 20%). Money in USD, half-up, cents.

UNCHANGED: T15 (CAPEX 1,200,000.00; subscription 269,818.77 months 1..60, no residue;
  TCV 17,389,126.20). T24. T25. Engine flow HW_UPFRONT_MARGIN 0 (CAPEX 960,000.00;
  subscription 273,818.77). T14. T31.
T16 (Published): Base TCV 156,799.80, margin 87.2%. Final TCV (projected) 166,494.36, year fees
  unchanged. Deal value 156,799.80.
T27 (Locked, S 3): Base TCV 156,799.80, margin 87.2%. Final TCV 162,558.36. Deal value 162,558.36.
T22 (Locked, S 2): CAPEX 1,200,000.00 month 0. Subscription by year 269,818.77 / 277,913.33 /
  286,250.73 / 294,838.26 / 303,683.40 (month 60 = 303,683.40, no residue).
  Base TCV 17,389,126.20, margin 86.2%. Final TCV 18,390,053.88 = deal value.
T28 (Published, S 3): CAPEX 1,200,000.00. Subscription by year 269,818.77 / 269,818.77 /
  277,913.33 / 286,250.73 / 294,838.26. Base TCV 17,389,126.20. Final TCV (projected)
  17,983,678.32. Deal value 17,389,126.20.
T30 (demo deal, 60, CAPEX Hardware, Hybrid Contract start m0 100%, Locked 3% S 2, single WHT 10%
  borne):
  Base, per product: SafeSight 17,389,126.20, 86.2%; AQ 2,245,484.40, 85.7%; HEMIR 2,384,000.40,
  89.1%. Deal Base TCV 22,018,611.00; gross profit 19,038,611.00, 86.5%.
  Base schedule: WHT 2,201,860.98; profit after WHT 16,836,750.02, 76.5%.
  Final schedule: CAPEX 1,550,000.00 m0; subscription 341,143.52 (months 1..12), 351,377.83
  (13..24), 361,919.16 (25..36), 372,776.74 (37..48), 383,960.04 (49..59), 383,959.81 (month 60).
  Final TCV 23,284,127.25 = deal value (CPI uplift 1,265,516.25). WHT on Final invoices
  2,328,412.62. Month 0: WHT 155,000.00, receives 1,395,000.00. Year-1 subscription invoice:
  WHT 34,114.35, receives 307,029.17.
  --qp with GST 9%: Final GST 2,095,571.38, TCV incl. GST 25,379,698.63
  (Base schedule: GST 1,981,675.18, incl 24,000,286.18).
L1 (OPEX, Published, S 3, split 5/10, gross-up ON, GST 9%):
  Final schedule unchanged: 162,558.36 / gross-up 17,477.04 / GST 16,203.36 / incl 196,238.76.
  Base schedule: 156,799.80 / gross-up 16,837.20 / GST 15,627.60 / incl 189,264.60.
v1.4 "product TCV same under OPEX and CAPEX": re-state on Base TCV (holds); Final is deal-level.
G-C5 CPI on G-C1 (Locked 3% S 2, no WHT): as T30's Final schedule. Final TCV 23,284,127.25.
G-C6 SPLIT WHT STRADDLE: demo deal, 60, Custom 2,000,000.00, Hybrid Contract start m0 100%,
  split 5% hardware / 10% SaaS, gross-up OFF, GST 0, no CPI.
  Month 0 invoice: hardware line 1,550,000.00, WHT 77,500.00; SaaS line 450,000.00, WHT 45,000.00;
  WHT 122,500.00, receives 1,877,500.00.
  Subscription 333,643.52 months 1..59, 333,643.32 month 60; WHT 33,364.35 each, 33,364.33 month 60.
  Total WHT 2,124,360.98. Warning (a) does not fire (CAPEX above hardware cost).

Probes: re-issue --qp, --tp2 and default from these figures; --pc flips to "OPEX per-camera
column shows under CAPEX". Calibration injections re-anchor on the new test names; each FIRED.

Continue: spec v1.6 commit -> tests fail first -> engine -> view -> probes -> sweep -> full gate
-> merge -> merged gate -> ls-remote -> "ready for John's push". STOP if any issued figure
disagrees with the spec text as written: report it, do not adjust it.
