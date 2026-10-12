ROUND: TP_MANUAL (term pricing: manual ladder comparison, SafeSight per camera)
Follow the tms-round-method skill. Never run git push. Gates run with NordVPN quit.

PRECONDITIONS
- git ls-remote origin main shows 943a938 (TP_BANDS). If not, STOP.
- John has placed prototypes/term-pricing-manual-ladder/term-pricing-manual-ladder.html
  (approved mockup, John 2026-10-12). Commit it with this brief, verbatim, as
  TP_MANUAL_BRIEF.md, as the first commit.
- Branch tp-manual off origin/main.

PURPOSE
A comparison tool: the user types a monthly price per SafeSight camera for each term and sees
how it performs against the calculated ladder. COMPARISON ONLY: it never prices a quote,
never changes settings, stores nothing. No migration. No change to any existing figure.

RULINGS (John, 2026-10-12)
M-1  SAFESIGHT ONLY, per camera, for now. One camera, the product's FIRST volume band, Base
     figures (no CPI). Cost per camera = HW_COST + HOSTING x T from the live catalog/settings.
M-2  SCRATCH: prices live in the view only; cleared when the user leaves Term Pricing. They
     survive switching tabs within Term Pricing. Nothing persisted.
M-3  EVERYONE sees and uses it (margins are not hidden from sales, John 2026-10-11).
M-4  PLACEMENT: a card on the Pricing tab, below the term ladder, titled
     "Compare a manual ladder · SafeSight per camera", with "Fill from calculated" (copies each
     term's calculated per-camera fee into the inputs) and "Clear".
M-5  COLUMNS per term: Term | Your price / mo (input, money format) | Calculated / mo |
     Difference (your / calculated - 1) | vs 36 (your / your 36-month price - 1; "list" on the
     36 row; "-" when 36 is blank) | Margin (on price) | Profit / camera | Client total
     (your price x T) | Check.
M-6  CHECKS, each row against the PREVIOUS NON-BLANK row: "Profit below <n> months" when profit
     falls; "Client total below <n> months" when client total falls; "Below the floor" when
     margin < MARGIN_FLOOR (exact comparison). Flagged rows in amber. Summary chips above the
     table: floor, client total, profit, each ✓ or ⚠ with the terms named.
M-7  A BLANK price skips that term (no row figures, no checks against it). A price that is not
     a positive amount with at most 2 decimals shows the estate's field error.
M-8  ENGINE does the arithmetic (R-TP1 / no money arithmetic in the view): a pure export
     manualLadder(prices, params) in src/lib/term-pricing.js returning per-term rows with
     calculated fee, difference, vs36, margin, profit, total and flags, plus the summary.
     "Calculated" is the existing ladder's per-camera fee for the first band (T31's basis
     with one camera), not a new formula.
M-9  Percentages display to one decimal, half-up; money to cents.

PHASE 0 (short; investigate, then STOP with a report)
1. Confirm the engine already exposes the one-camera, first-band calculated fee per term, and
   name the function.
2. Propose manualLadder's exact signature and return shape.
3. Name any conflict with this brief, the mockup, the spec or CLAUDE.md.
STOP. Report.

GOLDENS (spec v1.9; copy, never compute with the code under test; spec settings, anchor 90%)
MG-1 Prices 12: 2,500.00; 24: 1,500.00; 36: 1,100.00; 48: 900.00; 60: 800.00; 72: 700.00;
     84: 620.00; 96: 560.00; 108: 520.00; 120: 500.00.
     term | calculated | difference | vs 36 | margin | profit | client total | check
     12  | 8,666.67 | -71.2% | +127.3% | 65.3% | 19,600.00 | 30,000.00 | ok
     24  | 5,333.33 | -71.9% | +36.4%  | 64.4% | 23,200.00 | 36,000.00 | ok
     36  | 4,222.22 | -73.9% | list    | 61.6% | 24,400.00 | 39,600.00 | ok
     48  | 3,216.67 | -72.0% | -18.2%  | 59.3% | 25,600.00 | 43,200.00 | ok
     60  | 2,613.33 | -69.4% | -27.3%  | 58.3% | 28,000.00 | 48,000.00 | ok
     72  | 2,211.11 | -68.3% | -36.4%  | 55.6% | 28,000.00 | 50,400.00 | ok
     84  | 1,923.81 | -67.8% | -43.6%  | 52.4% | 27,280.00 | 52,080.00 | Profit below 72 months
     96  | 1,708.33 | -67.2% | -49.1%  | 49.4% | 26,560.00 | 53,760.00 | Profit below 84 months
     108 | 1,540.74 | -66.2% | -52.7%  | 47.3% | 26,560.00 | 56,160.00 | ok (equal is not a fall)
     120 | 1,406.67 | -64.5% | -54.5%  | 46.7% | 28,000.00 | 60,000.00 | ok
     Summary: floor ok; client total ok; profit falls at 84, 96.
MG-2 Blank 72: the 84 row compares against 60 (profit 27,280.00 < 28,000.00: flagged
     "Profit below 60 months").
MG-3 36 blank: every vs 36 shows "-".
MG-4 Floor: 120 at 300.00 gives client total 36,000.00, profit 4,000.00, margin 11.1%:
     "Below the floor" and "Client total below 108 months" (with MG-1's 108).

AFTER PHASE 0 (normal round method)
spec v1.9 -> tests fail first -> engine -> view -> probes from the click (the mockup state;
Fill from calculated; Clear; blank rows; leaving and returning clears; tab switch keeps) ->
calibration injections each FIRED -> overlap sweep 1240..1920 step 40 with the card empty,
filled and flagged -> full gate -> merge --no-ff -> merged gate -> ls-remote ->
"ready for John's push".

RULINGS ON PHASE 0 (appended verbatim at the phase they launch, CLAUDE.md build discipline 7)

TP_MANUAL: RULINGS ON PHASE 0 (Claude, under John's approval 2026-10-12). Resume.

MOCKUP PATH: the move to the brief's path is accepted.
C1  ACCEPTED: manualLadder({ product, prices }, params); the view passes 'safesight'.
C2  CORRECTION OF MG-4 (Claude's omission): MG-4 raises ALL THREE flags: "Below the floor",
    "Client total below 108 months", "Profit below 108 months". Order everywhere: floor,
    client total, profit; one flag per line in Check.
C3  ACCEPTED wording. OK: "At or above the {floor}% floor at every priced term"; "Client total
    never falls with a longer term"; "Profit never falls with a longer term". Fail: "Below the
    {floor}% floor at {n} term(s) ({terms})"; "Client total falls at {n} term(s) ({terms})";
    "Profit falls at {n} term(s) ({terms})". {floor} from settings.
C4  ACCEPTED: header "vs {ANCHOR_TERM} months".
C5  ACCEPTED: prices held in the view, reset when navToken changes; nothing else changes.
C6  KEPT AS RULED, with the card's column headed "Calculated, 1 camera" and the note
    "One SafeSight camera, first volume band ({x}%)", derived.
C7  ACCEPTED: the card renders whenever the settings price, in the ladder's place in the order.
C8  ACCEPTED: hardware, hosting and first-band discount in the note come from manualLadder.
C9  ACCEPTED: "Enter a monthly price above 0, to the cent." with aria-invalid; commas accepted.
C10 ACCEPTED: U+2212 minus and "+" as the ladder prints them; hyphen only for an absent vs 36.
C11 ACCEPTED: empty state as proposed; no chips until one price is entered.

Continue: spec v1.9 (with MG-4 as corrected) -> tests fail first -> engine -> view -> probes ->
calibration -> sweep -> full gate -> merge -> merged gate -> ls-remote ->
"ready for John's push".
