ROUND: TERM FACTORING AND CASH FLOW
Base: main at 86d62e9 (confirm by ls-remote; differs: STOP).
Branch: term-factoring. First commit: this brief verbatim as
TERM_FACTORING_BRIEF.md, together with prototypes/term-factoring-mockup.html
(John placed it; the mockup of record). ls-remote base check at branch and
merge. Rule 18. NordVPN OFF, PUPPETEER_PATH set for the gate. Each phase
reports (REPORT_FOR_CHAT.md, OneDrive, pbcopy) and waits for sign-off.
Mockup-first rule applies to the screen; geometry assertions cite it.

SOURCE: 2026-11-15 factoring investigation (second run), at e052d5a.

JOHN'S RULINGS (2026-11-15, amended 2026-11-16):
R-TF1 PO factoring on the term pricing screen: a section on the Payment
      terms tab, then a cash flow directly below it (approved mockup).
R-TF2 Purpose: factoring the client PO funds hardware procurement.
R-TF3 Advance defaults to hardware procurement cost (units x catalog unit
      cost, per product, summed), and can be typed over with any amount
      from 0. A note shows when it exceeds procurement cost. Lives in
      screen state like every quote input (quotes are not saved).
R-TF4 Controls: on/off, rate (% PER MONTH, as Commercials), term
      (months), Straight-line / Declining balance. Same arithmetic as
      Commercials buildLoanSchedule: straight = principal P/T monthly,
      interest on the opening balance; declining = level annuity payment.
      Repayments run from month 2 (the month after the advance), as
      Commercials.
R-TF5 Absorb | Pass through, the flanked DealToggle (Commercials'
      component, imported into the term screen; R-TP1 binds the engine,
      not the UI).
      ABSORB: price unchanged; factoring cost reduces profit.
      PASS THROUGH: the factoring cost is added to the price AT COST, no
      markup. Profit unchanged; margin % dips; no special margin handling.
R-TF6 Pass through details (defaults set by Claude, John may overrule):
      spread across products in proportion to each product's hardware
      cost; then per unit per month, to the cent, remainder on the last
      invoice; NOT escalated by CPI (a fixed cost recovered at cost).
      It enters Base TCV, the approval value and the margin floor check.
      Volume bands are unaffected (by units).
R-TF7 Never a factoring line on the client figures. The fee rises under
      Pass through; nothing names factoring there. Internal profit by
      product shows the factoring cost under Absorb.
R-TF8 Cash flow on the term screen: rows hardware procurement out,
      factoring advance in, client payments, hosting/service costs,
      factoring principal and interest out, net, running balance.
      Client payments = what Terminus receives: AFTER WHT, EXCLUDING GST.
      Receipts come from the term engine's own invoice schedule (Final,
      with CPI and month 0), not Commercials' structure rules.
      Headline: lowest balance with factoring and without (the model run
      twice), plus month of payback (spec section 9).
R-TF9 Engine: the cash flow and loan schedule are RE-IMPLEMENTED in the
      term engine in exact arithmetic (R-TP1: imports nothing;
      Architecture 14: no floats for money). The DISPLAY is shared with
      Commercials where it fits. A PARITY TEST feeds the same loan to both
      engines and requires the same schedule and total interest to the
      cent, both methods. Commercials code and the goldens are NOT
      changed by this round; any golden figure moving = STOP.
R-TF10 Timing: hardware procurement out and the factoring advance in are
      BOTH in MONTH 1 for now, as Commercials. Factoring repayments run
      from month 2. Client receipts follow the term schedule, including
      month 0.
R-TF11 Spec first: docs/pricing-spec.md amended to v1.10 before any engine
      code: Pass through, the advance, the cash flow rows and receipts
      basis, payback, timing, the R-TF6 defaults, and the 2026-10-29
      ruling ("factoring is an after-pricing adjustment to margin")
      recorded as now the Absorb setting.
R-TF12 Future-proof shape: the engine holds vendor payments and the
      factoring advance each as a schedule, a list of {month, amount},
      with exactly one entry at month 1 today. The screen shows one
      amount for each. No staging UI in this round. A test asserts the
      engine accepts a multi-entry schedule and the cash flow follows it
      (engine-level only), so staging later is a screen change.

PHASE 1: INVESTIGATE AND DRAFT THE SPEC (no engine or UI code)
1. Where hardware procurement cost per product is available under OPEX
   and CAPEX (today only CAPEX computes the total).
2. Where a deal-level amount can enter the fee per product per band
   without breaking the engine's "deal = exact sum of product lines".
   Propose the shape. Any shape that changes figures with factoring OFF:
   STOP.
3. Confirm month 1 timing works with the term schedule's month 0 (a
   CAPEX month-0 milestone shows as cash received before procurement).
   Report the lowest balance for one CAPEX and one OPEX example under
   this timing. No ruling needed unless something breaks.
4. Which Commercials display parts (cashflow.ts buildCashFlowRows,
   section5 card, DealToggle) the term screen can use unchanged, and
   what each needs.
5. The parity test's design: which Commercials function it calls, which
   inputs, how cents are compared to floats honestly.
6. DRAFT the v1.10 spec text as a diff to docs/pricing-spec.md, in the
   report only, NOT committed. Include worked figures for one Absorb and
   one Pass through example, computed by hand in the report.
STOP for John's approval of the spec text and a ruling on item 2.

PHASE 2: SPEC COMMIT AND ENGINE
Commit the approved spec text (docs only). Then the engine: loan schedule,
cash flow (vendor payments and advance as schedules per R-TF12),
pass-through allocation, payback, with-and-without lowest balance. Pure
tests from the spec's worked examples; parity test both methods; the
multi-entry schedule test; every term-pricing test green with factoring
off (126 today); goldens unmoved. Calibrate each new test. STOP.

PHASE 3: SCREEN
Build per the mockup. Prove: Absorb and Pass through figures match the
engine and the spec examples; client figure cards carry no factoring
word; advance override and its note; factoring off hides rate, term and
repayment (Commercials rule); cash flow rows and headline; no overprint
or overflow at 1240/1440/1920; probe-gaps green. Screenshots beside the
mockup. STOP.

PHASE 4: CLOSE
DESIGN_PRINCIPLES entry (the 2026-10-29 ruling's supersession; why
re-implement plus parity rather than share; the schedule shape for
staging). CURRENT_STATE if affected. Full gate. Push-ready SHA. STOP.

PHASE 1 SIGN-OFF (John, 2026-11-16), appended at the phase it launches:

Phase 1 ACCEPTED. Mockup moved to prototypes/ unchanged: accepted.
Where the mockup's illustrative figures differ from the rulings (timing,
per-unit spread, last repayment cents), the rulings govern.

RULINGS (John):
1. Fee shape APPROVED as item 2: pass-through on each product line beside
   its bands; F_p by hardware cost (last takes the remainder; by units if
   all hardware cost is 0); pt_p per unit per month to the cent;
   remainder r_p on the last invoice; bands untouched; under CAPEX added
   to sub(m) outside CPI.
2. Margin floor (4.4) under ABSORB reads the margin AFTER finance cost.
   Under Pass through it reads the margin including the pass-through.
   Amend the draft spec text accordingly.
3. Factoring term: 1 to T - 1; refuse longer. Commercials dropping
   repayments past the contract (facInterest short) QUEUED as a
   Commercials defect, top of the queue, not fixed here.
4. Two rows: Factoring principal, Factoring interest.
5. Payback reported for both runs, as drafted.
6. Blank rate or term while factoring is on: refused, not 0.
Also ACCEPTED: WHT on the pass-through as any fee; ladders exclude
factoring; DealToggle for all three toggles (on/off, method, treatment);
a term-side row builder emitting CFRow for CashFlowGrid, cents, R-TF8
labels (second builder of the shape, recorded); term-scoped .cf-cell
width rule, no Commercials CSS changed; parity test design incl. the
no-tie assertion; the isolation test's ALLOWED_IMPORTERS gains the parity
file with its reason.

SPEC: the v1.10 draft APPROVED with ruling 2 applied. Commit it (docs
only) as the first Phase 2 commit. FA-9's figures computed by hand and
added before its test is written.

Proceed to Phase 2 (engine). Stop for sign-off.

PHASE 2 SIGN-OFF (John, 2026-11-16), appended at the phase it launches:

Phase 2 ACCEPTED at 3e7b2d8.

SPEC CORRECTION APPROVED (implements rulings already given): commit the
proposed 4.3 and 9.3 wording as the first Phase 3 commit (docs only):
total_cost = Σ product_cost(p) including F under both treatments;
gross_profit and gross_margin are after finance; margin before finance =
(gross_profit + F) / Base TCV reported beside it under Absorb; profit
before finance = gross_profit + F; the floor reads gross_margin. Engine
unchanged; FA-3 figures unchanged.

ACCEPTED: test count 156 (runner) replaces the brief's 126; the journal
guard recovery; calibration case 8 re-scored and 8b added.

QUEUED: the intermittent database-suite failure (empty message, 24,283ms
failing vs 57,555ms passing, tearDown head count over record_revisions).
If it recurs in Phase 3's gate, report it with its duration; do not
re-run to green.

PHASE 3 NOTE: the internal line under each product on the Pricing tab
(bands vs product under Pass through) is ACCEPTED as a text line only.
If it needs any change to panel structure, STOP and photograph.

Proceed to Phase 3 (screen) as the brief states, rulings governing where
the mockup's illustrative figures differ. Stop for sign-off.

QUEUED, NOT THIS ROUND: staged vendor payments and staged factoring
drawdowns, on the term screen and in Commercials; Commercials wording
faults (help text "rate x term", statement "factored receipts", the
rate's ?? 1.5 fallback); Commercials Pass through (not requested);
G1/G5 Excel check and stamp; probe triage; calibrate.mjs scheduling;
harness rules cleanup; workflow audit_log gap.
