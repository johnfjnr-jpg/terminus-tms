ROUND: COMMERCIALS FACTORING FIXES
Base: main at a5b8e80 (confirm by ls-remote; differs: STOP).
Branch: commercials-factoring. First commit: this brief verbatim as
COMMERCIALS_FACTORING_BRIEF.md. ls-remote base check at branch and merge.
Rule 18. NordVPN OFF, PUPPETEER_PATH set for the gate. Each phase reports
(REPORT_FOR_CHAT.md, OneDrive, pbcopy) and waits for sign-off.
No layout change (text and validation only); anything structural STOPS.

SOURCE: 2026-11-15 factoring investigation, and TERM_FACTORING Phase 1
(the repayments-past-the-contract finding).

DEFECTS:
D1 buildCashFlowModel builds rows only to `months`, so factoring
   repayments past the contract's last month are dropped and facInterest
   (the finance cost) is SHORT. Silent.
D2 deal-inputs.js:719 reads factoringRatePct(payload) ?? 1.5, and the
   calculator's parameter defaults to 1.5 (deal-calculator.js:310): a
   blank rate prices at 1.5% (Architecture 11).
D3 DealPanel.tsx:458 help text: "Rate multiplied by term is the total
   financing cost". Neither method computes that.
D4 statement.ts:364 sub-label "drivers: factored receipts and rate"; the
   engine advances COST (hardware, warranty, installation).

PROPOSED RULINGS (John confirms at Phase 1 sign-off):
R-CF1 The finance cost is ALWAYS the full loan schedule's interest,
      whatever the contract length. The cash flow still runs to the
      contract's last month.
R-CF2 New input: a factoring term above (contract months - 1) is refused
      on save, client and server, with the term screen's wording ("from 1
      to N, so every repayment falls inside the M-month contract").
R-CF3 Existing records already over the limit: priced per R-CF1 and
      flagged visibly ("factoring repayments run past the contract end";
      a stats-strip or statement note, no layout change). No data
      migration. Issued versions are frozen and are not repriced.
R-CF4 A blank rate with factoring on prices NOTHING and is flagged,
      exactly as a blank term already does (Rule 32). The ?? 1.5 and the
      calculator default go. A blank rate is refused on save like a
      blank term, if the term already is; Phase 1 measures which.
R-CF5 D3 and D4 wording corrected to what the engine computes.

PHASE 1: INVESTIGATE (read-only)
1. D1: confirm by measurement: a deal whose factoring term exceeds its
   contract, facInterest vs the full schedule's interest. Name every
   reader of facInterest / financeCost (statement, approval page, stats
   strip, totals, achieved margin, goldens).
2. GOLDENS: does G3 (or any golden) have repayments past its contract?
   Compute the full-schedule finance cost for each golden with factoring
   and say whether any pinned figure would move under R-CF1. If a
   CONFIRMED golden would move: STOP for John.
3. Records today (test data, read-only): how many live records and issued
   versions have factoring on with a term above contract - 1, or a blank
   rate. List them.
4. D2: every site that defaults the rate (client and server); how a blank
   term is handled today (Rule 32) and whether save refuses it.
5. Where a visible flag for R-CF3 can sit without layout change.
6. Approval page and frozen versions: confirm a frozen version's figures
   cannot change under R-CF1 (they hold frozen rates/inputs; does the
   approval page re-derive finance cost?).
STOP and report, with the rulings for John to confirm.

PHASE 2: BUILD AND PROVE
- R-CF1: finance cost from the full schedule; a calculator test with a
  term past the contract (straight and declining) equal to the term
  engine's loanSchedule F for the same loan (the parity test extended).
- R-CF2/R-CF4: refusals client and server with the exact wording; blank
  rate prices nothing and is flagged.
- R-CF3: the flag on an over-limit record.
- D3/D4 wording.
- Goldens: unmoved (or per John's Phase 1 ruling). Every existing test
  green. Calibrate each fix: undo it, its named test fails.
STOP.

PHASE 3: DESIGN_PRINCIPLES entry (a schedule truncated to its window
understated a cost silently; a fallback priced a rate nobody entered).
CURRENT_STATE if affected. Full gate, no skips. Push-ready SHA. STOP.

QUEUED, NOT THIS ROUND: probe triage (incl. a Term Pricing layout
guard); G1/G5 Excel check and stamp; term-screen CAPEX warning and ladder
note; staged vendor payments; workflow audit_log gap; harness rules
cleanup.

PHASE 1 SIGN-OFF (John, 2026-11-16), appended at the phase it launches:

Phase 1 ACCEPTED.

JOHN RULES:
R-CF1 CONFIRMED: finance cost always the full loan schedule's interest.
R-CF2 CONFIRMED, NARROWED: refuse only when the save CHANGES duration,
      factoring.termMonths or factoring.enabled and the result is over
      (contract months - 1). An existing over-limit record stays saveable
      on other fields.
R-CF3 CONFIRMED with OPTION (a): one derivation; issued versions re-derive
      under the corrected engine and carry the flag. Flag text: "Factoring
      repayments run past the contract end (month N[ to M]): the finance
      cost includes them; the cash flow and closing position do not."
      Single month reads "month 37", a range "months 37 to 40". Slots:
      statement sub-label, statement drawer note, approval page finance
      note/basis. No stats-strip change.
R-CF4 CONFIRMED, NARROWED: blank rate with factoring on prices NOTHING and
      is flagged (a rate-missing state beside factoringTermMissing),
      not refused on save. All three 1.5 defaults removed
      (deal-inputs.js:719, deal-calculator.js:310,
      numeric-payload.js:152), following Round 41 ruling 5 for the term.
R-CF5 CONFIRMED with the four wordings in the report.

QUEUED (high priority, its own round, before any real deal is approved):
store the approved figures at approval (option c). An approval page must
show the figures the approver signed; today an engine change moves them.
QUEUED: FB1, recovery-period limits tested but not called live.

Proceed to Phase 2. Prove each ruling, calibrate each fix, goldens
unmoved, the issued SMARTC-003 v2.0 measured before/after (+483, flagged).
Stop for sign-off.
