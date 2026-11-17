ROUND: TP_LADDER. SafeSight priced from an admin price ladder. Spec v2.0.
Branch: tp-ladder from main. Precondition: git ls-remote origin main reads b5f2b7c (TP_MANUAL pushed). If not, STOP and report.
Rule 18 stands: never run git push.

PURPOSE
John has decided the manual ladder is SafeSight's price. Quotes take the list fee per term from a stored ladder instead of the formula. Everything downstream (bands, TCV, CAPEX, CPI, WHT, floor, Quote) is unchanged and runs off that list fee.

DECIDED (do not reopen; raise conflicts in Phase 0)
L-1  Price source per product and term: if the product has a ladder price for the term, list fee = that price. Otherwise the formula, unchanged. Every price on screen carries its source.
L-2  Volume bands apply on top, unchanged: band_fee = round_half_up(ladder_price x (1 - d)), discount only on the units inside each band.
L-3  Costs unchanged (HW_COST + HOSTING x T per unit). Floor 25% flags, never refuses.
L-4  New setting PRICE_LADDER_BY_PRODUCT, per product, admin-only to edit, same pattern as VOLUME_BANDS_BY_PRODUCT. Route PUT /api/term-pricing/ladder/:product. No route writes system_roles.
L-5  Save validation (refuses): a price for every term in TERMS, each above 0, at most 2 decimals. Checks (floor, client total, profit, at every band of that product) are warnings only.
L-6  Formula settings stay. The formula price stays on screen as "Calculated" for comparison.
L-7  The bands screen's worst-case grid gains the client-total and profit-fall checks per band, using the product's live price source.
L-8  A term in TERMS with no ladder price falls back to the formula, labelled "Formula: no ladder price for this term".
L-9  The manual comparison card stays, and gains "Fill from price ladder" when the product has one.
L-10 The code must work with the setting absent (all products on the formula). John applies the migration after his push.
L-11 No automated writes to live settings. The SafeSight seed lands only through the migration John applies.
L-12 Update the decision of record: SafeSight list fee comes from the ladder. OPEX still sets price and TCV; CAPEX is still payment timing only.
L-13 Layout changes only from the approved mockup (prototypes/term-pricing-ladder.html), which comes with the rulings. No view work before it is committed.

SEED (SafeSight, USD per camera per month)
12:2500.00  24:1500.00  36:1080.00  48:875.00  60:750.00  72:665.00  84:605.00  96:560.00  108:525.00  120:500.00

GOLDENS (spec costs: HW 8,000, hosting 200; bands 1/10/50/200 at 0/5/10/15%; Base, no CPI, OPEX)
LG-1 1 unit, every term. Fee = seed. Client total / profit / margin:
     12: 30,000.00 / 19,600.00 / 65.3%    24: 36,000.00 / 23,200.00 / 64.4%
     36: 38,880.00 / 23,680.00 / 60.9%    48: 42,000.00 / 24,400.00 / 58.1%
     60: 45,000.00 / 25,000.00 / 55.6%    72: 47,880.00 / 25,480.00 / 53.2%
     84: 50,820.00 / 26,020.00 / 51.2%    96: 53,760.00 / 26,560.00 / 49.4%
     108: 56,700.00 / 27,100.00 / 47.8%   120: 60,000.00 / 28,000.00 / 46.7%
     No flags.
LG-2 60 units, 120 months: monthly 28,450.00; Base TCV 3,414,000.00; cost 1,920,000.00; profit 1,494,000.00; margin 43.8%.
LG-3 60 units, 36 months: band fees 1,080.00 / 1,026.00 / 972.00; monthly 61,452.00; Base TCV 2,212,272.00; cost 912,000.00; profit 1,300,272.00; margin 58.8%.
LG-4 250 units, 60 months: band fees 750.00 / 712.50 / 675.00 / 637.50; monthly 169,012.50; Base TCV 10,140,750.00; cost 5,000,000.00; profit 5,140,750.00; margin 50.7%.
LG-5 Floor boundary, 1 unit, 120 months: HW 21,000.00 gives margin exactly 25.0%, no floor flag. HW 21,000.01 gives the floor flag.
LG-6 Bands grid, seed bands: no flags at any band. Band 4 changed to 30%: band 4 flags "Profit below" at 36, 48, 60, 72, 84, 96, 108 and 120, and the floor at 120 (fee 350.00, margin 23.8%).
LG-7 Ladder with 108 removed and TERMS unchanged: 108 is priced by the formula with the L-8 label. Report the figure; I will check it against the spec.
Existing goldens (G1 to G5, 4,734 figures; T-series; per-product) must be unchanged with no ladder present.

PHASE 0 (investigate, write the report, commit it, STOP)
P1  Where the engine takes the list fee today, per product and term (file, function, line). Where the ladder lookup goes with R-TP1 intact (engine imports nothing; ladder arrives in params).
P2  Settings loader: behaviour with the key absent, and with an unknown key present. Confirm L-10 holds.
P3  VOLUME_BANDS_BY_PRODUCT: storage shape, validation, route, admin screen. Propose the same for PRICE_LADDER_BY_PRODUCT.
P4  Which goldens, tests and probes price SafeSight by the formula, and whether they read fixtures or live settings.
P5  Persisted figures: does anything store term-pricing prices (opportunities, Commercials, quotes)? Would a live ladder change any of the 134 live records retroactively? Count them.
P6  Where TERMS lives, and how L-8 fits.
P7  bandMarginGrid: how L-7 adds the two checks.
P8  Every screen that shows a price or "Calculated" and needs a source label.
P9  Whether the queued probe-live.mjs stale TERMS assertion blocks this round's gate.
P10 Draft migration for my review, NOT applied: add PRICE_LADDER_BY_PRODUCT, rebuild term_pricing_settings_key_check to 10 keys, seed SafeSight with the SEED above, plus its rollback. Paste the full SQL in the report.
P11 Any conflict with L-1 to L-13, with a recommendation.

After rulings: spec v2.0 first, tests fail first in their own commit, engine, calibration injections each FIRE, view from the mockup, probes from the click, overlap sweep 1240..1920 step 40, full gate (26 stages), merge --no-ff, merged gate, ls-remote re-check, then "ready for John's push".

---

## Ruling on the precondition stop (John, 2026-11-16), appended at the phase it launches

1. Spec: bump v1.10 to v2.0. The major bump stands: the SafeSight price source changes.
2. Gate: the full gate as it stands today (27 stages). Any reference to "26 stages" in the brief means "the full gate".
3. Precondition: if origin/main is no longer b5f2b7c, use origin/main as read by ls-remote, provided b5f2b7c is an ancestor. Report the commit. If b5f2b7c is not an ancestor, STOP.
4. Finish the report edit you stopped, commit the Phase 0 report, and STOP as briefed. No build work before the rulings.

Applied: ls-remote origin main read a5b8e80b592511e173e2243e67fc801e2a4a86a6; b5f2b7c is its ancestor (git merge-base --is-ancestor, exit 0). tp-ladder branched from main at a5b8e80.

---

## Phase 0 sign-off (John, 2026-11-17), appended at the phase it launches

PHASE 0 SIGN-OFF: TP_LADDER

Phase 0 ACCEPTED.

JOHN RULES:
1. L-7: the two new checks ('total', 'profit') apply only to cells whose
   term AND previous term are both price-ladder priced. The floor check
   stays everywhere. QUEUED finding: the formula's discounted bands lose
   profit with term under PROFIT_STEP 0 (74 cases measured).
2. L-6 / M-8: the comparison reads the formula fee at one camera (band 1)
   directly, not termLadder. M-8's basis superseded for this, left visible
   in the spec. The comparison is WORDED "Formula" everywhere ("Formula,
   1 camera", "Fill from formula"); "Calculated" keeps its existing CAPEX
   remainder meaning only.
3. No route removes a product's price ladder this round; the spec says so.
4. FA-8: extend ALLOWED with the source fields and assert the no-ladder
   value 'formula'. FA-8 is then also the L-10 proof.
5. L-8 AMENDED: a product WITH a price ladder but no price at a term in
   TERMS prices NOTHING at that term and is flagged, source
   'ladder-missing', label "No price ladder price for N months". No
   formula fallback (same principle as R-CF4 and Round 41 ruling 5:
   absence is not substituted). Products with NO price ladder use the
   formula as today. Re-derive LG-7 under this ruling.
6. Naming: the new thing is always "price ladder" (priceLadder,
   PRICE_LADDER_BY_PRODUCT), never bare "ladder".
7. Source labels sit where a fee shows, not on totals. The mockup governs
   placement.
8. Migration draft accepted as written: it seeds SafeSight ONLY. It lands
   in supabase/migrations in the build phase; John applies it after his
   push, ledger row by hand as a separate statement.
9. P11.7 accepted: admin success path over HTTP against the recording
   database, live probe as non-admin (403, nothing landed), admin save
   proved in the browser.
10. AIR QUALITY AND HEMIR GET PRICE LADDERS. Terminus supplies the prices.
    They are entered by an admin through the price ladder editor after
    this round lands, NOT seeded by migration. Until then both stay on the
    formula. The editor and route must therefore accept any catalog
    product from day one (no SafeSight-only assumption anywhere), and the
    build proves a save for air_quality against the recording database.
    The spec records AQ and HEMIR as "price ladder pending, formula until
    entered".

SEQUENCE: close and push COMMERCIALS_FACTORING first. Return the checkout
to commercials-factoring now for its Phase 2 sign-off. TP_LADDER resumes
after that push, and builds nothing until John approves the mockup
(prototypes/term-pricing-ladder.html).

## Phase 0 addendum (John, 2026-11-17), appended verbatim at the phase it launches

PHASE 0 ADDENDUM: TP_LADDER (John, 2026-11-17). SUPERSEDES the Phase 0
sign-off where they conflict. Append verbatim to TP_LADDER_BRIEF.md as
its own commit first.

PRECONDITION: git ls-remote origin refs/heads/main must read e123cf6
(COMMERCIALS_FACTORING pushed). If not, STOP. Then switch to tp-ladder
and rebase it onto e123cf6; hook green; report the base.

MOCKUP APPROVED: prototypes/term-pricing-ladder.html (John placed it in
the working tree; commit it unchanged as the picture of record, v2,
Air Quality option a). Its figures are illustrative; the engine computes.

A1. THE FORMULA IS REMOVED. Every product prices from its price ladder
    (the LIST price). A product with no price ladder, or no price at a
    term, prices NOTHING and is flagged (amended L-8 extends to whole
    products: "No price ladder for <product>"). Remove ANCHOR_TERM,
    ANCHOR_MARGIN, SHORT_TERM_MARGIN, PROFIT_STEP from the engine,
    settings, Settings card and spec. HW_UPFRONT_MARGIN: list every
    reader first; if CAPEX or anything live reads it, KEEP it and say so;
    otherwise remove it too. PRICE_LADDER_BY_PRODUCT becomes REQUIRED
    for the screen to price (L-10's "absent = formula" is withdrawn;
    absent = not priced). The 74-case PROFIT_STEP finding is closed as
    moot.
A2. SEEDS, all three in the migration (USD per unit per month):
    safesight   12:2500 24:1500 36:1080 48:875 60:750 72:665 84:605
                96:560 108:525 120:500
    air_quality 12:1000 24:600 36:432 48:350 60:300 72:266 84:242
                96:224 108:210 120:200
    hemir       12:15000 24:9000 36:6480 48:5250 60:4500 72:3990
                84:3630 96:3360 108:3150 120:3000
    The migration drops the removed keys and narrows the key allowlist.
    Its rollback restores them with the values read live in Phase 0.
    John applies it after his push; ledger row by hand.
A3. CATALOG COSTS (John's figures): SafeSight hardware 8,000, hosting
    200/mo; Air Quality hardware 2,000, hosting 50/mo; HEMIR hardware
    100,000, hosting 200/mo. Read the live catalog. Where it differs,
    John rules GO AHEAD: issue ONE new cost batch through the existing
    batch mechanism (append-only, reason "John 2026-11-17, TP_LADDER"),
    never edit a batch in place. Before writing it, measure and report
    which live Opportunities' figures move and by how much. STOP if any
    CONFIRMED golden moves or any issued version's figures move.
A4. DEAL ADJUSTMENT (Pricing tab, per mockup frame A): a "Deal
    adjustment" card under Units. Either-or (R-O7): a deal discount %
    OR a deal fee per month at the chosen term; typing one derives the
    other. Order: list, then volume band, then deal discount. The
    discount applies at every term, so a term switch keeps it. Range
    0 to 99.9%; a deal fee above list is refused with a sentence
    (no premiums this round). Amber where a figure departs from list.
    Price card: Base TCV (deal), List TCV, Deal discount, Discount
    value, and "Approval signal: N% below list". Below 25% floor flags,
    never refuses. Screen-only: nothing is stored (P5 stands).
A5. COMPARE CARD RETIRED, with its tests and probe assertions
    re-pointed or removed, each with a stated reason.
A6. PRICE LADDER EDITOR (frames C and D): above Volume discount bands.
    Product picker, ten inputs, Discard / Save price ladder, catalog
    costs line, the checks chips and margin-per-band grid (L-7's checks
    on ALL cells now), and TWO CHARTS redrawn as you type: list price
    per unit per month by term, and profit per unit over the contract
    by term, one line per volume band. Plain SVG, no chart library.
    Prove each chart's points equal the grid's figures.
A7. Ruling 10 stands (any catalog product editable via the route), and
    the build proves an air_quality save against the recording database.
    No removal route (ruling 3 stands).
A8. Spec v2.0: OPEX price = price ladder; formula sections withdrawn
    and left visible as superseded; LG-1 to LG-7 re-derived on the
    price ladder; FA-8 asserts 'ladder' as the source.

PHASES: Phase 1 = engine, settings, migration draft, catalog
measurement (A3), with unit tests. Phase 2 = screen per mockup, proved
from the click. Phase 3 = DESIGN_PRINCIPLES, CURRENT_STATE, full gate,
merge, "ready for John's push". Continue between phases unless a STOP
condition fires; stop for John's sign-off after Phase 2.

## Rulings on Q1 and Q3 (John, 2026-11-17), appended verbatim at the phase they launch

TP_LADDER RULINGS (John, 2026-11-17)

Q1: OPTION (a). ANCHOR_TERM is renamed COMPARE_TERM, labelled "Compare
terms against" in the Settings card, default 36, must be a term in
TERMS. It derives no price; it only sets the "vs N months" column on
the Pricing tab and in the price ladder editor, and that column header
reads the setting ("vs 36 months" today). The other formula settings go
as A1 says. Migration renames the key (value kept); rollback renames it
back.

Q3: GO. The cost-basis block re-dating on issued versions is NOT a
figure move under A3's STOP. It is a pre-existing defect: any catalog
change re-dates it, because no version froze rates.batches. Write the
one batch (Air Quality hosting 100 -> 50, HEMIR hosting 500 -> 200,
reason "John 2026-11-17, TP_LADDER"), report the 11 moved Opportunities
before and after, and record in the round report that the 3,792 issued
versions' cost-basis block now names the new batch.
QUEUED, joined to the option (c) round (HIGH, before any real deal is
approved): versions freeze their batch reference at issue; the approval
page dates its cost basis from it; Closed Won figures do not move with
the catalog.

Proceed with the A1 to A8 build per the addendum. Stop for sign-off
after Phase 2.

## Ruling on the golden figures (John, 2026-11-17, Phase 1), recorded at the phase it launches

Asked in Phase 1: removing the formula moves 63 golden-test cases by cents
(the fixture ladder is v1.x's list fee to the cent, and discounted band fees
then round differently, 2,613.33 x 0.95 = 2,482.66 not 2,482.67, which
cascades through T6 into CAPEX, WHT, CPI and factoring). 24 cases are price
arithmetic; 39 are mechanics on top of the price.

John's answer: SPLIT. Price arithmetic is re-derived by an independent
integer-cents script, committed. Mechanics are re-based through the frozen
v1.10 engine from e123cf6 with only its list-fee read swapped for the price
ladder, run by a committed derivation script. The spec and the tests say
which figures came from which. The new mechanics figures are a labelled
regression snapshot, not hand-checked; v1.x's hand derivation of the
mechanics stands, because that code is unchanged.

## Phase 1 sign-off and the Phase 2 launch (John, 2026-11-17), appended verbatim

MIGRATION 20261117000001 APPLIED by John, wrapped in begin/commit;
ledger row recorded by hand. Confirm by reading term_pricing_settings
(7 keys, three ladders as seeded) and GET /api/term-pricing answering
200 on the served tree.

Phase 1 ACCEPTED.

Proceed to PHASE 2: the screen to the approved mockup
(prototypes/term-pricing-ladder.html), proved from the click:
- frame A: deal adjustment either-or, amber, price card with list TCV,
  discount, approval signal; a fee above list refused with its sentence;
- frame B: a no-price term row (drive it on a fixture, not live);
- frames C and D: the price ladder editor above Volume discount bands,
  both charts redrawn as typed, chart points equal to grid figures (A6),
  checks and margin grid; an admin save proved in the browser on a
  value you restore afterwards, a non-admin refused;
- re-point the probes this needs; the rest go to probe triage.
Phase 3 housekeeping: correct the migration header's "apply after the
push" to record that it was applied before, on John's ruling.
Stop for sign-off after Phase 2.
