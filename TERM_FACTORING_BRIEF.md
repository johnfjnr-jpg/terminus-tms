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

QUEUED, NOT THIS ROUND: staged vendor payments and staged factoring
drawdowns, on the term screen and in Commercials; Commercials wording
faults (help text "rate x term", statement "factored receipts", the
rate's ?? 1.5 fallback); Commercials Pass through (not requested);
G1/G5 Excel check and stamp; probe triage; calibrate.mjs scheduling;
harness rules cleanup; workflow audit_log gap.
