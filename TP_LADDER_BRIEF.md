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
