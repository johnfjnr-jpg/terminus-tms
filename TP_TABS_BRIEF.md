ROUND: TP_TABS (term pricing: three-tab redesign)
Follow the tms-round-method skill. Never run git push. Gates run with NordVPN quit.

PRECONDITIONS
- git ls-remote origin main shows 206a377 (TP_CAPEX). If not, STOP: John has not pushed.
- John has placed prototypes/term-pricing-tabs.html (approved mockup, John 2026-10-11). Commit it
  with this brief, verbatim, as TP_TABS_BRIEF.md, as the round's first commit. Missing: STOP.
- Branch tp-tabs off origin/main.

PURPOSE
John's walkthrough (2026-10-11) found the single-page screen confusing. The approved mockup
splits it into three tabs: Pricing (the price, set by OPEX), Payment terms (how the client
pays it), Quote (the read-only result). LAYOUT ONLY: no ladder, CAPEX or tax calculation
changes, apart from T-4's partial-allocation preview. The ladder calculation is the NEXT round;
do not touch it.

RULINGS (John, 2026-10-11)
T-1  THREE TABS: 1 Pricing | 2 Payment terms | 3 Quote. A header strip on every tab shows Base
     TCV and the Payment basis. A finished tab shows a tick. Each tab ends with a "Next" button.
     Tab state survives switching tabs.
T-2  PRICING TAB, top to bottom:
     (a) Units strip: one input per product.
     (b) Choose the term: the ladder, every term, columns Term | Monthly fee (yr 1) |
         SafeSight / cam / mo | vs 36 months | Base TCV | Margin. Clicking a row selects it.
     (c) Price breakdown for the chosen term: Product | Band | Discount | Units |
         Fee / unit / mo | Monthly | Base TCV | Margin, a subtotal row per product, a highlighted
         Deal total row.
     Right column: the price card (Base TCV with APPROVAL tag, monthly fee, term, gross profit,
     margin, margin floor status).
     Everyone sees margins: no role-based hiding. Ladder SETTINGS stay admin-only, as today.
T-3  PAYMENT TERMS TAB, sections in this order:
     Payment basis: OPEX | CAPEX, default OPEX. The label is "Payment basis", not "Pricing basis".
     Under CAPEX only (absent from the DOM under OPEX):
       CAPEX amount: Hardware (shows its value on the button) | Custom.
       How CAPEX is paid: Monthly instalments | Milestones. These are the term-pricing labels
         for the existing Two-phase and Hybrid structures; engine names and Commercials labels
         are unchanged.
         Monthly instalments: "Spread over" quick picks 6 | 12 | 18 | 24 | 36 plus a months
         input (1 to T), default 12; the instalment and last-month figure shown beneath.
         Milestones: the existing milestone editor (dropdown from the shared vocabulary, month,
         share, amount, add up to 5).
       Monthly subscription: read-only figure with its formula line.
       Monthly breakdown: Months | CAPEX instalment (or CAPEX milestone) | Subscription |
         Monthly invoice. Consecutive equal months grouped into ranges; milestone rows carry the
         milestone name; Total row ties to Base TCV.
     Annual increase: None | Published CPI | Locked rate (rate and start year when not None).
     Tax: GST; WHT None | Single rate | Split; gross-up where it exists today.
     Right column: "What the client pays" summary, plus a readiness card when the quote is not
     ready, naming what is missing.
T-4  LIVE MILESTONE AMOUNTS (John's walkthrough finding). Each milestone row shows its amount
     as soon as its share is typed: round_half_up(CAPEX x share, 2). While shares total below
     100%: an "Allocated" row and an amber "Still to allocate" row (share and amount) under
     the milestone table; an amber "Not yet scheduled" row in the Monthly breakdown carrying the
     unallocated amount, so the Total still ties to Base TCV; the subscription and breakdown stay
     visible; the quote is NOT READY (the Quote tab and Next are blocked with the reason).
     The last-row rounding rule applies only once shares total exactly 100%.
     This is an engine addition (a partial-allocation preview returning per-row amounts, the
     allocated and unallocated share and amount, and status "incomplete"): spec v1.7 first.
     Golden T4-G1, copy into the spec: demo deal, 60 months, Custom 1,000,000.00, Milestones:
     Contract start m0 50% = 500,000.00; Installation complete m4 30% = 300,000.00; allocated
     80% = 800,000.00; unallocated 20% = 200,000.00; subscription 350,310.18 months 1..59,
     350,310.38 month 60; breakdown invoices m0 500,000.00, m4 650,310.18; status incomplete.
     Over 100%: refused as today, with the excess named.
T-5  QUOTE TAB: headline tiles, then the payment schedule, then profit.
     Tiles: Base TCV (APPROVAL, margin) | Final TCV (DEAL VALUE tag under Locked; only when CPI is
     not None) | CAPEX (under CAPEX) | Subscription yr 1 (CAPEX) or Monthly fee yr 1 (OPEX) |
     Cash in year 1 (with the OPEX comparison under CAPEX).
     Schedule: Months | CAPEX | Subscription | Invoice by default. A "Show tax detail" switch
     adds today's GST / WHT / received columns. The fitted font may remain for the detail view
     only; the default four-column view uses the standard figure size.
     Profit card (Base): Product | Base TCV | Margin, Deal row, gross profit, and the CPI uplift
     line (marked not in approval) when CPI applies.
T-6  Final TCV and Deal value appear ONLY on the Quote tab and ONLY when CPI is not None. The
     Pricing tab shows Base only. The old "Price, set by OPEX" card and Deal value card retire.
T-7  NOTHING ELSE MOVES. All v1.6 term-pricing goldens unchanged; npm run goldens (G1 to G5)
     unchanged; Commercials untouched. Recording "one payment-terms pattern for TMS" as a queue
     item for Commercials convergence is the only Commercials action.

PHASE 0 (investigate, then STOP with a report)
1. Inventory every section, control and figure on today's term pricing screen and map each to
   its tab and position in the mockup, or to "retired by T-6". Anything with NO home in the
   mockup: list it, do not drop it silently.
2. Name the probes, sweeps and photograph scripts that address today's layout, and how each
   re-points to the tabs.
3. Propose the engine API for T-4's preview, and confirm the v1.6 refusals still hold for a
   complete allocation.
4. Name any conflict between this brief, the mockup, the spec or CLAUDE.md.
STOP. Report. Wait for rulings.

AFTER RULINGS (normal round method)
spec v1.7 (T-4 only) -> tests fail first -> engine -> view -> probes from the click for the five
mockup states (Pricing; OPEX payment terms; CAPEX milestones incomplete; CAPEX monthly
instalments over 12; Quote with Locked CPI) plus every tab under OPEX and CAPEX -> calibration
injections each FIRED -> overlap sweep 1240..1920 step 40, every tab and state, zero ->
full gate (26 stages) -> merge --no-ff -> merged gate -> ls-remote -> "ready for John's push".

---

RULINGS ON PHASE 0, AS RECEIVED (appended at the phase they launch, build discipline 7)

TP_TABS: RULINGS ON PHASE 0 (Claude, under John's approval of the mockup 2026-10-11). Resume.

DEPARTURE ACCEPTED: the mockup as five PNGs in prototypes/term-pricing-tabs/. Probes assert
labels as the images show them.

C1  (a) ADOPTED. Engine v1.7 adds per band: Base TCV (units x band fee x T), cost
    (units x (HW_COST + HOSTING x T)), gross profit, margin on price. The screen does no money
    arithmetic. Goldens (copy into v1.7; demo deal, 60 months, spec settings):
      SafeSight 1-9: 9 units, fee 2,613.33, monthly 23,519.97, Base TCV 1,411,198.20, 87.2%
      SafeSight 10-49: 40 units, 2,482.67, 99,306.80, 5,958,408.00, 86.6%
      SafeSight 50-199: 71 units, 2,352.00, 166,992.00, 10,019,520.00, 85.8%
      Air Quality 1-9: 9 units, 973.33, 8,759.97, 525,598.20, 86.3%
      Air Quality 10-49: 31 units, 924.67, 28,664.77, 1,719,886.20, 85.6%
      HEMIR 1-9: 2 units, 19,866.67, 39,733.34, 2,384,000.40, 89.1%
    Product and deal rows must equal the sum of their bands (existing v1.4 figures unchanged).
C2  YES. v1.7 amends spec 4.5: the Pricing ladder shows all columns whatever the basis. C-10's
    text stays visible, struck. Display only.
N1  ADOPTED: ladder rows focusable, Enter/Space selects.
N2  ADOPTED: settings card at the bottom of Pricing, collapsed, admin edits / everyone reads.
N3  ADOPTED: drop the List fee column.
N4  AMENDED: the Quote profit card is Product | Base TCV | Gross profit | Margin, Deal row.
    Gross profit per product STAYS (John asked for profit broken down by product, 2026-10-09;
    the mockup omitted it in error). Units and cost columns drop.
N5  ADOPTED: WHT borne and gross profit after WHT, with the after-WHT margin, under gross
    profit when WHT is borne.
N6-N9, N11, N12  ADOPTED as proposed.
N10 ADOPTED: Rules card retires; Split WHT sentence under Tax when Split is chosen.
T-4 API ADOPTED as proposed (capexAllocation beside priceQuote). Incomplete: unallocated cents
    = CAPEX - sum of rows, so the breakdown ties to the cent; v1.7 states this. Blank share =
    null amount, counts 0%, status incomplete.
C3-C11  ADOPTED as proposed. C12 noted.
label-contrast P1 fix: ADOPTED in this round, reported as a TP_CAPEX-caused defect.
Retiring the four photograph scripts: ADOPTED; outputs stay as the record.

Continue: spec v1.7 (T-4, C1, C2) -> tests fail first -> engine -> view -> probes (--tabs and
re-pointed modes) -> calibration -> sweep 1240..1920 step 40 + 3440 capture -> full gate ->
merge -> merged gate -> ls-remote -> "ready for John's push". STOP if any issued figure
disagrees with the spec text as written.

ADDENDUM: John has added prototypes/term-pricing-tabs/term-pricing-tabs.html, the same five
states as the PNGs. Commit it. Use it as the text reference for labels and figures; the PNGs stay
the visual reference. If the HTML and a PNG disagree on any label or figure, STOP and report the
difference; do not choose.

---

RECORDED AGAINST THE RULINGS (Claude, at launch)

- The addendum's file name does not exist. What John added is five zip exports, one .dc.html
  artboard per state (commit 149b4c6). Those five are the text reference. Against the PNGs they
  agree on every word and figure (measured, calibrated; Phase 0 report section 0), so the
  addendum's stop does not fire.
- C1's six goldens checked against the spec text before launch: each band's Base TCV is units x
  fee x 60, its cost units x (HW_COST + HOSTING x 60) (SafeSight 20,000.00, AQ 8,000.00, HEMIR
  130,000.00 a unit), and each margin rounds as issued; the bands sum to the v1.4 product
  figures. No disagreement.
- C13 (the visual treatment, added to the report after the rulings were drafted) is not ruled.
  Position under the standing delegation: as TP_CAPEX's C-13, content, structure, order, labels
  and behaviour binding; type and colour from the estate's tokens. Revisitable.
