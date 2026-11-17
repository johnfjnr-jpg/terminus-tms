# Terminus Term Pricing: Specification v2.0

**Status:** Approved for prototype build (John, 1 Oct 2026). Margin levels to be tuned to market later.
**Supersedes:** v1.1 (1 Oct 2026) and v1.0 (Neil, 30 Sep 2026)
**Amended (v1.2.1, John, 1 Oct 2026):** TERMS as a parameter; anchor and short-term margins per product; tax rounding and WHT base; test cases T20 and T21. Every figure in sections 10 and 11 is unchanged.
**Amended (v1.2.2, John, 1 Oct 2026):** with an escalator, the CAPEX monthly service fee escalates like the OPEX fee and TCV stays identical to the OPEX TCV (section 6); test case T22. Every earlier figure is unchanged.
**Amended (v1.2.3, John, 2 Oct 2026):** test case T23, a multi-product deal on real catalog costs, so the T14 behaviour can be proven on the screen (TEST-B is not in the catalog). Every earlier figure is unchanged.
**Amended (v1.3, John, 2 Oct 2026, rulings B1 to B6 of TERM_PRICING_2):** the default `TERMS` runs every year to ten, adding 108 months (B1); WHT is a typed rate with a separate gross-up switch (B3), optionally split between the hardware and the software-as-a-service invoice lines (B4); the escalator starts in a chosen contract year (B6); test cases T24 to T28. Every earlier figure is unchanged: rows 10.1 and 10.2 gain 108, and `steps_above(120)` becomes 7 while `PROFIT_STEP` is 0.
**Amended (v1.4, John, 5 Oct 2026, QUOTE_PANEL):** per-product totals in section 4.3 (each product's TCV, cost, gross profit and margin, summing exactly to the deal); WHT is never allocated to a product; test cases T29 and T30. Every earlier figure is unchanged.
**Amended (v1.5, John, 10 Oct 2026, PER_CAMERA_AND_CAPEX_P0):** the term ladder's OPEX per-camera fee (section 4.5); test case T31. Every earlier figure is unchanged.
**Amended (v1.6, John, 10 Oct 2026, TP_CAPEX, rulings C-1 to C-13 and Q1 to Q14):** OPEX sets the price; CAPEX is a way of paying part of it earlier, against a client CAPEX budget, and the remainder is a monthly subscription; CPI is an uplift on the subscription, never on CAPEX. Two TCVs: **Base TCV** (no CPI) carries approval, margin, the margin floor, the profit table and the volume discount; **Final TCV** (with CPI) is what the client is invoiced (section 4.3). A CPI mode (section 7). The CAPEX amount, Two-phase and Hybrid payment, and the subscription (section 6). Split WHT on CAPEX payments (section 8.1). Cash in year 1 (section 9). Warnings (section 6.4). Under CAPEX the ladder shows the OPEX per-camera fee only (section 4.5). **Figures that move:** T16, T22, T27, T28 and T30 now report Base and Final separately (section 11); every other earlier figure is unchanged. Test cases G-C1 to G-C6 and the L1 pair (section 11.1).
**Amended (v1.7, John, 11 Oct 2026, TP_TABS, rulings T-4, C1 and C2):** per-band totals in section 4.3 (each band's Base TCV, cost, gross profit and margin, summing exactly to its product) (C1); the term ladder shows every column whatever the payment basis (section 4.5) (C2); the milestone allocation preview, which reports a Hybrid schedule whose shares are still being entered, and the excess named when they total above 100% (section 6.2) (T-4); test cases T4-G1 and B-1 to B-6 (section 11.3). **Every earlier figure is unchanged.**
**Amended (v1.8, John, 12 Oct 2026, TP_BANDS, rulings TB-1 to TB-9):** volume bands are configured **per product**, 2 to 6 bands each, as a start and a discount, with "To" derived (section 3.1) (TB-1 to TB-5); the rules a band set must meet and the wording that refuses a broken one, shared by the editor and the server (section 3.2) (TB-6); the margin check, every band at every term, flagged against the floor and never refusing (section 10.4) (TB-7); test cases BG-1 to BG-5 (section 11.4). The rulings are cited TB-1 to TB-9 so they do not collide with test cases B-1 to B-6 of v1.7. **Every product is seeded with the v1.7 bands, so every earlier figure is unchanged** (BG-5).
**Amended (v1.9, John, 12 Oct 2026, TP_MANUAL, rulings M-1 to M-9 and C1 to C11):** a manual ladder comparison, SafeSight per camera: the user types a monthly price for each term and sees it against the calculated one-camera fee, with margin, profit, client total and three checks (section 4.6); test cases MG-1 to MG-4 (section 11.5). **Comparison only: it never prices a quote, changes no setting and stores nothing, so every earlier figure is unchanged.**
**Amended (v1.10, John, 2026-11-16, TERM_FACTORING, rulings R-TF1 to R-TF12 and the Phase 1 sign-off):** PO factoring on the quote: an advance that funds hardware procurement, a loan schedule (straight-line or declining balance, rate per month), and the factoring cost either ABSORBED (price unchanged, profit falls) or PASSED THROUGH at cost (price rises by exactly the cost, profit unchanged) (sections 9.2 to 9.4); the margin floor reads the margin after finance cost (4.4); the cash flow with its rows, receipts basis, timing, lowest balance with and without factoring, and month of payback (sections 9.5, 9.6); test cases FA-1 to FA-9 (section 11.6). **With factoring off, every earlier figure is unchanged** (FA-8).
**Amended (v2.0, John, 2026-11-17, TP_LADDER: the Phase 0 sign-off, its addendum A1 to A8, and the rulings on Q1 and on the golden figures):** **THE FORMULA IS REMOVED.** Every product prices from its **price ladder**, the LIST price per unit per month at each term, set by an admin per product (sections 3, 3.3, 4.1). A product with no price ladder, or no price at a term, prices nothing and says so (4.1, amended L-8). `ANCHOR_TERM` is renamed `COMPARE_TERM` and derives no price: it only sets the "vs N months" column (Q1). `ANCHOR_MARGIN`, `SHORT_TERM_MARGIN` and `PROFIT_STEP` are withdrawn; `HW_UPFRONT_MARGIN` stays, because CAPEX reads it. A **deal adjustment**, a deal discount or a deal fee, either-or, after the bands, with an approval signal (4.7, A4). The manual ladder comparison is retired (4.6, A5). The margin check gains the client-total and profit checks on every cell and reads a price ladder as typed (10.4, A6). **Figures that move:** every case with units beyond band 1, by cents, because a discounted band fee is now rounded from a list fee that is itself to the cent (section 10's preamble says how each was re-derived). Test cases LG-1 to LG-7 and DA-1 to DA-7 (section 11.7).



**Purpose:** Price a Terminus deal so that longer contracts give the client a visibly lower monthly fee while Terminus earns at least as much profit as on a 36-month contract. **v2.0 (L-12, A1):** the list price of each product at each term is now the admin's price ladder rather than a formula, so "earns at least as much" is a property the ladder is checked for (the margin check's profit check, 10.4) rather than one the arithmetic guarantees. The price sets the deal's Total Contract Value (TCV). How the client pays (monthly OPEX, or hardware upfront on a CAPEX budget) changes when cash arrives, never what the deal is worth.

---

## 1. What changed from v1.1

| v1.1 | v1.2 | Why |
|---|---|---|
| 90% MARKUP at 36 months | 90% MARGIN on price at 36 months | Josh's figures are margin |
| A fixed saving % per term | LEVEL PROFIT: every term from 36 months up earns the 36-month profit; the client's saving falls out of the maths | Works for any product's cost mix; Terminus never earns less for a longer commitment |
| Terms 36 to 120 months | Terms 12, 24, 36, 48, 60, 72, 84, 96, 120 months | 1- and 2-year terms required |
| SafeSight only | SafeSight, AQ and HEMIR, each priced on its own costs | All products in the demo |
| No tax, no escalator, simple upfront split | GST, WHT, optional annual escalator, CAPEX upfront at hardware cost plus a hardware margin | John's clarifications |

## 2. Inputs

| Input | Type | Rules |
|---|---|---|
| `units[product]` | integer per product | ≥ 0 each; at least one product ≥ 1 |
| `term_months` | integer | One of `TERMS` (section 3). Anything else is refused with a clear error |
| `payment_structure` | choice | `opex` (monthly) or `capex` (a CAPEX amount plus a monthly subscription, section 6) |
| `cpi_mode` | choice (v1.6) | `none`, `published` or `locked` (section 7). Default `none`. A non-zero `escalator_pct` with no mode is refused, so an existing caller cannot be given a meaning it did not ask for |
| `escalator_pct` | percent, optional | The CPI rate. Blank or 0 means none (section 7). Ignored under `cpi_mode` `none` |
| `escalator_start_year` | integer | The contract year the escalator first applies, `S` in section 7. At least 2; default 2. A year past the term's last year means the escalator never applies within the term |
| `capex_amount` | choice (v1.6, `capex` only) | `hardware` (default) or `custom` (section 6.1) |
| `capex_custom` | money (v1.6) | With `capex_amount` `custom`: any amount, kept exactly as entered, at most 2 decimals |
| `capex_structure` | choice (v1.6, `capex` only) | `hybrid` (default) or `two_phase` (section 6.2) |
| `milestones` | rows (v1.6, `hybrid`) | 1 to 5 rows of: milestone (an opaque key; the screen offers the shared milestone vocabulary), month (integer 0 to T), share (percent). Default: one row, Contract start, month 0, 100% |
| `recovery_months` | integer (v1.6, `two_phase`) | `R`, 1 to T, default 12 |
| `gst_pct` | percent | Per deal, 0 allowed (section 8) |
| `wht_pct` | percent | Per deal, 0 up to but not including 100; blank is 0 (section 8) |
| `wht_gross_up` | yes/no | One switch for every invoice line (section 8) |
| `wht_split` | yes/no | Off: `wht_pct` applies to every invoice line. On: `wht_hw_pct` and `wht_saas_pct` apply instead (section 8) |
| `wht_hw_pct`, `wht_saas_pct` | percent each | With `wht_split` on: WHT on the hardware line and on the software-as-a-service line, each 0 up to but not including 100; blank is 0 |
| `factoring` | yes/no (v1.10) | Default off. Off: no advance, no schedule, no factoring cost, and every figure is as v1.9 |
| `factoring_advance` | money (v1.10) | Default `hardware_cost` (section 6.1), recomputed as units change until typed over. Any amount from 0, at most 2 decimals. Above `hardware_cost` a note shows; it never refuses. Not saved (a quote is not saved) |
| `factoring_rate_pct` | percent PER MONTH (v1.10) | From 0 up to but not including 100, as Commercials. Blank is refused while factoring is on (a rate nobody entered is not 0) |
| `factoring_term_months` | integer (v1.10) | 1 up to `T − 1`, so the last repayment, in month `term + 1`, falls inside the contract. Longer is refused. Blank is refused while factoring is on |
| `factoring_method` | choice (v1.10) | `straight` (default) or `declining` |
| `factoring_cost_treatment` | choice (v1.10) | `absorb` (default) or `pass_through` |

## 3. Configurable parameters (admin settings, never hard-coded)

| Parameter | Value | Notes |
|---|---|---|
| `HW_COST[product]` | from the TMS catalog | Hardware cost per unit, one-off |
| `HOSTING_MONTHLY[product]` | from the TMS catalog | Hosting cost per unit per month |
| `TERMS` | 12, 24, 36, 48, 60, 72, 84, 96, 108, 120 months | The terms offered. This is the default; the live setting is an admin's to change |
| `PRICE_LADDER[product]` | see 3.3 | v2.0: the LIST price per unit per month at each term in `TERMS`, per product. Stored as `PRICE_LADDER_BY_PRODUCT`. REQUIRED for a product to price: a product without one prices nothing (4.1) |
| `COMPARE_TERM` | 36 months | v2.0 (Q1): "Compare terms against". Sets the "vs N months" column (4.5) and DERIVES NO PRICE. Must be one of `TERMS` |
| ~~`ANCHOR_TERM`~~ | ~~36 months~~ | SUPERSEDED by v2.0, renamed `COMPARE_TERM` with its value kept. Was "the list-price term" of the formula |
| ~~`ANCHOR_MARGIN[product]`~~ | ~~90% each product~~ | WITHDRAWN by v2.0 (A1) with the formula. Was margin on price at the anchor term |
| ~~`SHORT_TERM_MARGIN[product]`~~ | ~~90% each product~~ | WITHDRAWN by v2.0 (A1). Was margin on price below the anchor |
| ~~`PROFIT_STEP`~~ | ~~0.00~~ | WITHDRAWN by v2.0 (A1). Was extra profit per term step above 36 months |
| `VOLUME_BANDS[product]` | see 3.1 | Banded discount on the monthly fee, per product (v1.8, TB-1). Stored as `VOLUME_BANDS_BY_PRODUCT` |
| `HW_UPFRONT_MARGIN` | 20% | Margin on the hardware price in the CAPEX option. 0 = at cost. v2.0: KEPT, because CAPEX's hardware value (6.1) reads it |
| `MARGIN_FLOOR` | 25% | Whole-deal margin below this shows a flag; it never refuses |
| `CURRENCY` | USD | |

**Every margin in this spec is margin on price:** margin = profit ÷ price. Price from a margin: price = cost ÷ (1 − margin).

### 3.1 Volume bands (banded, like tax bands)

**Per product (v1.8, TB-1).** Each product has its own bands. Every product starts on these (the seed, and the bands every figure in sections 10 and 11 uses unless a case says otherwise):

| Units of a product in the band | Discount on those units' monthly fee |
|---|---|
| 1 to 9 | 0% |
| 10 to 49 | 5% |
| 50 to 199 | 10% |
| 200 and above | 15% |

Bands count units **per product line**, on that product's own bands. A 60-unit SafeSight line prices units 1 to 9 at 0%, 10 to 49 at 5% and 50 to 60 at 10%.

**A band is a start and a discount (TB-3).** Band 1 starts at 1. A band's "To" is the next band's start less 1, and the last band runs "and above"; "To" is derived and never stored. A product has 2 to 6 bands (TB-2). Each band's discount applies to the units inside it, and only to them (TB-5, unchanged).

### 3.2 The rules a band set must meet (v1.8, TB-3, TB-4, TB-6)

The editor checks as an admin types and the server checks again before it saves; the server is the authority. Both use one function, so the wording is the same in both places. Every broken rule is reported, one line each, in band order; while any is broken the set is not saved, and a band whose start is invalid shows "?" as the previous band's "To".

| Rule | Refused with |
|---|---|
| Band 1 starts at 1 | Band 1 always starts at 1. Fix this to save. |
| Each later start is above the previous start | Band 4 must start above 5, where band 3 starts. Bands cannot overlap. Fix this to save. |
| A start is a whole number | Band 3 must start at a whole number of units. Fix this to save. |
| At least 2 bands | A product needs at least 2 bands. Add a band to save. |
| At most 6 bands | A product can have at most 6 bands. Remove a band to save. |
| Discounts never fall as volume rises; equal is allowed | Band 4's discount must be at least 10.0%, band 3's. Discounts never fall as volume rises. Fix this to save. |
| A discount is below 100% | Band 6's discount must be below 100%. Fix this to save. |
| A discount is a number from 0, to one decimal place | Band 2's discount must be a number from 0 to below 100, with at most one decimal place. Fix this to save. |

The band numbers and figures in each message are the ones the set in hand breaks. Only an admin may change bands (TB-8); everyone can read them.

### 3.3 The price ladder, and the rules a set must meet (v2.0, A1, A6, L-5)

Each product has its own price ladder: a price per unit per month for every term in `TERMS`, the product's LIST price. The volume bands (3.1) apply on top. Only an admin may change one, one product at a time, through the price ladder editor (A6); any catalog product can have one (A7). **There is no removal**: a product's price ladder can be changed, not deleted (ruling 3).

The editor checks as an admin types and the server checks again before it saves; one function, so the wording is the same in both. Every broken rule is reported, in term order, prices for terms outside `TERMS` last:

| Rule | Refused with |
|---|---|
| Every term in `TERMS` has a price | Enter a price for 36 months. Every offered term needs one. Fix this to save. |
| A price is above 0, to the cent (commas are ignored) | The 60-month price must be above 0, to the cent, for example 1080.00. Fix this to save. |
| No price for a term outside `TERMS` | 18 months is not an offered term. Remove its price, or add the term to TERMS first. Fix this to save. |

A saved price is stored to two decimals ("2,500" is 2500.00). **A stored price ladder is not refused for a missing or stray term** once saved, because an admin can change `TERMS` afterwards: a term in `TERMS` with no price prices nothing (4.1), and a price for a term no longer offered is kept and read by nothing.

The checks that WARN (the floor, the client total, the profit, at every band) are the margin check's (10.4), on the prices as typed.

## 4. Calculation rules (per product line)

### 4.1 The list fee per unit (v2.0: the price ladder)

```
list_fee(T)       = PRICE_LADDER[product][T]                (a price to the cent; v2.0, A1)
cost(T)           = HW_COST + HOSTING_MONTHLY × T
saving_vs_compare = 1 − list_monthly(T) / list_monthly(COMPARE_TERM)     (display only; negative means a premium)
```

**No price, no price (amended L-8, A1).** A product with no price ladder prices nothing at any term: "No price ladder for {product}". A product with a price ladder but no price at a term in `TERMS` prices nothing at that term: "No price ladder price for {n} months". Nothing is substituted: not another term's price, not another product's, not a formula. A quote at such a term is refused; the term ladder (4.5) shows the row, says why, and does not let it be chosen. With no price at `COMPARE_TERM` the "vs" column says "-".

Every line uses its own product's price ladder, `HW_COST` and `HOSTING_MONTHLY`. Every price on screen carries its source, "Price ladder", where a fee shows (ruling 7).

SUPERSEDED by v2.0, WITHDRAWN and left visible (A1):

```
cost(T)        = HW_COST + HOSTING_MONTHLY × T
anchor_profit  = cost(ANCHOR_TERM) × ANCHOR_MARGIN[product] / (1 − ANCHOR_MARGIN[product])

price(T) = cost(T) / (1 − SHORT_TERM_MARGIN[product])                if T < ANCHOR_TERM
price(T) = cost(T) + anchor_profit + PROFIT_STEP × steps_above(T)    if T ≥ ANCHOR_TERM

list_fee(T)    = price(T) / T
saving_vs_36   = 1 − list_fee(T) / list_fee(ANCHOR_TERM)      (display only; negative means a premium)
```

~~`steps_above(T)` is the position of T in `TERMS` above 36 (48 → 1, 60 → 2, … 108 → 6, 120 → 7 with the default `TERMS`).~~

~~Every line uses its own product's `HW_COST`, `HOSTING_MONTHLY`, `ANCHOR_MARGIN[product]` and `SHORT_TERM_MARGIN[product]`.~~ (v1.x's formula, by which every term up from 36 earned the 36-month profit. The purpose line at the top of this spec described it; under v2.0 whether a longer term earns Terminus more is the price ladder's to decide, and the margin check's profit check (10.4) says when it does not.)

### 4.2 The invoiced fee for each band (rounded to cents FIRST)

```
band_fee(T, band) = round_half_up( list_fee(T) × (1 − band.discount), 2 )
```

### 4.3 Deal totals

```
monthly_total  = Σ products Σ bands ( units_in_band × band_fee )
TCV (net)      = monthly_total × T                     (no escalator; see section 7)
total_cost     = Σ products ( units × cost(T) )
gross_profit   = TCV − total_cost
gross_margin   = gross_profit / TCV × 100
```

**The tie rule:** TCV always equals the invoiced fees × months, exactly. Nothing is re-summed from rounded parts.

**Per product (v1.4).** Each product line carries its own totals, from its own invoiced band fees:

```
product_TCV(p)     = Σ its bands Σ contract years ( units_in_band × fee_year(k) × months_in_year(k) )
                                                          (fee_year(k) escalated per section 7)
product_cost(p)    = units(p) × cost(T)
product_profit(p)  = product_TCV(p) − product_cost(p)
product_margin(p)  = product_profit(p) / product_TCV(p) × 100
Σ products ( product_TCV, product_cost, product_profit ) = TCV, total_cost, gross_profit    exactly
```

**Per band (v1.7, C1).** Each band within a product line carries the same four totals, on Base, from the band's own year-1 invoiced fee:

```
band_TCV(b)     = units_in_band × band_fee(T, b) × T            (year-1 fee, Base: no CPI)
band_cost(b)    = units_in_band × cost(T)                       cost(T) = HW_COST + HOSTING_MONTHLY × T, in cents
band_profit(b)  = band_TCV(b) − band_cost(b)
band_margin(b)  = band_profit(b) / band_TCV(b) × 100
Σ its bands ( band_TCV, band_cost, band_profit ) = product_TCV(p), product_cost(p), product_profit(p)    exactly
```

They are display figures for the price breakdown, so the screen does no arithmetic on money; no other figure reads them.

**Pass through (v1.10).** Under `pass_through` each product line carries a pass-through amount `F_p` (section 9.4) beside its bands. Then `product_TCV(p) = Σ its bands ( band_TCV ) + F_p`, and `product_cost(p) = units(p) × cost(T) + F_p` under BOTH treatments. The bands themselves are unchanged: a band's fee, units and totals are as 4.2 and above, so `Σ its bands + F_p = product_TCV(p)` exactly. `Base TCV = Σ products ( product_TCV )` holds as before. With factoring off, `F_p = 0` and this paragraph changes nothing.

**With factoring on (v1.10, corrected at the Phase 2 sign-off), `total_cost = Σ products ( product_cost(p) )`**, so it carries `F` under both treatments, and `gross_profit` and `gross_margin` are AFTER finance cost. The deal stays the exact sum of its lines. SUPERSEDED, left visible: the formula `total_cost = Σ products ( units × cost(T) )` above read alone excluded `F`, which broke the sum of the lines and, under `pass_through`, would have raised profit by `F`.

A product's TCV is the same under `opex` and `capex`: the payment structure changes when cash arrives, never what a line is worth (section 6). **WHT is never allocated to a product.** It is withheld per invoice, and an invoice is not a product, so WHT borne is reported for the whole deal only (gross profit after WHT, and the margin after WHT).

**Base TCV and Final TCV (v1.6, C-1, C-2, Q1, Q5).** The figures above are written with the escalator applied; v1.6 separates the two:

```
Base TCV   = monthly_total (year 1) × T                      no CPI; identical under opex and capex
Final TCV  = Σ the FINAL schedule's net invoices             with CPI (section 7)
             opex:  Σ months ( fee for that month's contract year )      (the section 7 TCV)
             capex: CAPEX + Σ months sub(m)                               (section 6.3)
CPI uplift = Final TCV − Base TCV                            0 under cpi_mode none, or with no rate
```

- **Base TCV carries approval**: the gross profit, the margin, the margin floor flag (4.4), the per-product totals and the volume discount are all on Base TCV, with year-1 fees, in every CPI mode. `product_TCV(p)` is therefore `Σ its bands ( units_in_band × fee_year(1) ) × T`, and the products sum to Base TCV exactly. **No CPI uplift is allocated to a product**; Final TCV is deal-level only.
- **Two schedules.** The BASE schedule (no CPI) feeds approval: margin, the margin floor, the profit table, and the margin after WHT (WHT borne on the Base schedule's invoices). The FINAL schedule (with CPI) is what the client is invoiced: GST, gross-up, WHT, TCV incl. GST and the payment schedule shown. With no CPI they are the same schedule. Section 8's tie, TCV (net) + WHT gross-up + GST = TCV incl. GST, holds on each schedule separately.
- **Deal value** = Base TCV, unless `cpi_mode` is `locked`, then Final TCV (section 7). **Approval always follows Base TCV**, in every mode.

SUPERSEDED by v1.6 and left visible: v1.4 wrote `product_TCV(p)` with `fee_year(k)` escalated, and TCV, margin and the profit table all priced on the escalated fees (T16's margin 88.0%, T30's 87.3%).

### 4.4 Margin floor

`gross_margin` below `MARGIN_FLOOR` shows a visible flag. The quote still prices.

**With factoring on (v1.10, Phase 1 ruling 2):** the flag reads `gross_margin`, which with factoring on is AFTER finance cost under `absorb` (9.3) and includes the pass-through under `pass_through` (9.4), because `total_cost` carries `F` (4.3). With factoring off it is the v1.9 `gross_margin`, so nothing moves. SUPERSEDED in wording at the Phase 2 sign-off, left visible: "under `absorb` the flag reads the margin AFTER finance cost, `(gross_profit − F) / Base TCV`".

### 4.5 Per camera, OPEX (v1.5)

The term ladder shows, under `opex`, what one SafeSight camera costs the client per month at each term:

```
per_camera(T) = round_half_up( safesight_monthly_total(T) / units[SafeSight], 2 )
safesight_monthly_total(T) = Σ SafeSight bands ( units_in_band × band_fee(T, band) )     (year 1, after the banded volume discount)
```

Shown as "-" when `units[SafeSight]` is 0. Display only: it is never invoiced and never feeds TCV, so it may differ from any band fee by the banding average.

**v2.0 (Q1, A4):** the saving or premium is against `COMPARE_TERM`, read on the LIST monthly (banded, before the deal adjustment), and the per-camera fee is LIST. With a deal adjustment the ladder shows the list fee and the deal fee per month, and Base TCV and the margin are the deal's. A term with no price is a row that prices nothing and says why (4.1).

**Whatever the payment basis (v1.7, C2):** the ladder shows every column (the term, the year-1 monthly fee, this per-camera fee, the saving or premium against the anchor term, Base TCV and the margin), the same figures under `opex` and `capex`. The ladder prices every term as OPEX, Base, no CPI, so the price is chosen before, and apart from, how it is paid. There is no per-camera CAPEX figure anywhere: CAPEX is one deal-level payment. Display only: no figure moves (T31 unchanged).

SUPERSEDED by v1.7, left visible: ~~**Under `capex` (v1.6, C-10):** the ladder shows the term and this OPEX per-camera fee only, the same figure as under `opex` (T31 unchanged). There is no per-camera CAPEX figure anywhere: CAPEX is one deal-level payment. The ladder prices every term as OPEX, Base, no CPI, so a CAPEX amount or schedule that suits one term cannot refuse the ladder.~~ And v1.5 before it read "Under `capex` the column is not shown (not yet decided; section 13)."

### 4.6 Manual ladder comparison (v1.9, TP_MANUAL), RETIRED by v2.0 (A5), left visible

**RETIRED.** Its "Calculated" figure read the formula, which v2.0 removed. The price ladder editor (3.3, 10.4) carries what the comparison was for: a typed price per term with its client total, profit and margin, and the three checks. The section below is v1.9's, kept as the record.

A comparison only. It never prices a quote, never changes a setting and stores nothing (M-2). One product, named by the screen (C1; SafeSight today, M-1), one unit, Base figures, no CPI.

For each term `T` in `TERMS` with a typed price `P(T)`:

```
calculated(T)  = per_camera(T) of section 4.5 with units[product] = 1     (cents; the first band's fee)
total(T)       = P(T) × T
cost(T)        = HW_COST + HOSTING_MONTHLY × T
profit(T)      = total(T) − cost(T)
margin(T)      = profit(T) / total(T)
difference(T)  = P(T) / calculated(T) − 1
vs_anchor(T)   = P(T) / P(ANCHOR_TERM) − 1     ("list" at ANCHOR_TERM; "-" when P(ANCHOR_TERM) is not entered)
```

A price is a positive amount with at most 2 decimals; commas are ignored. A blank price skips its term: no figures, and no check against it. A price that is not valid is refused for its term ("Enter a monthly price above 0, to the cent.") and is treated as blank (M-7, C9).

**Checks, in this order, each row against the PREVIOUS row with a price (M-6, C2):**

1. "Below the floor" when `margin(T) < MARGIN_FLOOR`, an exact comparison;
2. "Client total below {n} months" when `total(T)` is below the previous row's;
3. "Profit below {n} months" when `profit(T)` is below the previous row's.

Equal is not a fall. **Summary**, shown once a price is entered (C3, C11): "At or above the {floor}% floor at every priced term" or "Below the {floor}% floor at {n} term(s) ({terms})"; "Client total never falls with a longer term" or "Client total falls at {n} term(s) ({terms})"; "Profit never falls with a longer term" or "Profit falls at {n} term(s) ({terms})".

Percentages are shown to one decimal, half-up, with "+" and "−" (U+2212); money to cents (M-9, C10).

### 4.7 The deal adjustment (v2.0, A4)

Sales adjusts one deal's price, on screen, by EITHER a deal discount % OR a deal fee per month at the chosen term (R-O7). Typing one derives the other. **Order: list, then the volume bands (4.2), then the deal discount.** Nothing is stored (P5).

```
list_monthly(T)  = Σ lines Σ bands ( units_in_band × band_fee(T, band) )      (year 1)
discount D       = the % typed / 100,  or  1 − deal_fee_typed / list_monthly(T₀)  (exact, T₀ the term it was typed at)
deal_monthly(T)  = round_half_up( list_monthly(T) × (1 − D), 2 )
line share       = round_half_up( (list_monthly − deal_monthly) × line_list_monthly / list_monthly, 2 ), the last line taking the remainder
year-k discount  = round_half_up( line share × CPI factor(k), 2 )            (7; year 1 is the share itself)
Base TCV         = deal_monthly × T;  List TCV = list_monthly × T;  discount value = List TCV − Base TCV (before any pass-through)
```

- **D applies at every term**, so switching the term keeps the discount. A fee typed at T₀ prices back to itself at T₀ to the cent, because D is exact.
- **Range:** 0 to 99.9%, at most one decimal place when typed as a %. A deal fee above list is refused: "A deal fee of {fee} a month is above the list fee of {list} at {T₀} months. A deal fee can be at or below list, not above it." (no premiums this round). Both given is refused: "Give a deal discount or a deal fee, not both." 0, or a fee equal to list, is no adjustment.
- **The approval signal:** any discount off list reads "Approval signal: {N}% below list". The floor (4.4) flags and never refuses, on the deal's margin.
- **Applied at deal level, not per band:** the band rows stay LIST figures; the lines carry their share, so the deal is still the exact sum of its lines. Under CAPEX the subscription is built on the deal's Base TCV (6.3). With no adjustment every figure is the list one.

## 5. Money handling

- Decimal or integer-cent arithmetic only. Never floating point.
- Round only invoiced and displayed figures, half-up, to 2 decimal places. Margins and savings display to 1 decimal place.
- Every quote shows its payment schedule, not just the total.

## 6. Payment structures (TCV never changes)

| Structure | What the client pays |
|---|---|
| `opex` | `monthly_total` every month for the term |
| `capex` | A CAPEX amount, paid Two-phase or Hybrid, plus a monthly subscription for the term (v1.6) |

**Principle (v1.6).** OPEX sets the price. CAPEX is a way of paying part of that price earlier, against a client CAPEX budget; the remainder is paid as a monthly subscription. CPI is an uplift on the subscription, never on CAPEX. **Rounding goes on the last item everywhere** (C-7): the last instalment, the last milestone and the last month.

### 6.1 The CAPEX amount (C-4)

```
hardware_value = round_half_up( Σ products ( units × HW_COST / (1 − HW_UPFRONT_MARGIN) ), 2 )     rounded ONCE, at deal level
hardware_cost  = Σ products ( units × HW_COST )
CAPEX          = hardware_value                     capex_amount = hardware (default)
               = capex_custom, exactly as entered   capex_amount = custom
```

Refused unless 0 < CAPEX < Base TCV.

### 6.2 How CAPEX is paid (C-6)

**Hybrid** (the default under `capex`): 1 to 5 milestone rows, each a milestone, a month `m` (an integer, 0 to T; 0 = contract start) and a share.

```
amount(i)    = round_half_up( CAPEX × share(i), 2 )        every row but the last
amount(last) = CAPEX − Σ the other rows                    the last row carries the rounding
```

Refused unless the shares total exactly 100%, no milestone appears twice, and the months never decrease down the rows. Above 100% the refusal names the excess (v1.7, T-4): "The milestone shares total 120%, 20% (200,000.00) over. They must total exactly 100%.", the excess amount being `Σ round_half_up( CAPEX × share(i), 2 ) − CAPEX`.

**The allocation preview (v1.7, T-4).** While the shares are being entered, the schedule is reported before it is complete, so each row's amount shows as soon as its share is typed. It is a separate result from the quote, which is unchanged: a quote is priced only from a complete allocation.

```
status         = complete      Σ shares = 100% and every row has a share: the quote prices, and the
                               amounts are the quote's own (the last row carries the rounding, above)
                 incomplete    Σ shares < 100%, or a row has no share yet
                 over          Σ shares > 100%
amount(i)      = round_half_up( CAPEX × share(i), 2 )      EVERY row, while not complete (no row carries rounding)
                 none for a row with no share yet, which counts as 0%
allocated      = Σ shares,  Σ amount(i)
unallocated    = 100% − Σ shares,  CAPEX − Σ amount(i)      incomplete only
excess         = Σ shares − 100%,  Σ amount(i) − CAPEX      over only
```

The unallocated AMOUNT is `CAPEX − Σ amount(i)`, not `round_half_up( CAPEX × unallocated share, 2 )`, which may differ by a cent: it is what makes the breakdown tie. Every other refusal of this section and of 6.1 still applies to each row as it is entered (count, milestone, duplicate, month, order, a share that is not a percentage, 0, or above 100%).

While incomplete, the monthly breakdown is the Base schedule (no CPI) of the rows that have amounts, with the subscription of section 6.3, which does not depend on how CAPEX is split, plus one row "not yet scheduled" carrying the unallocated amount, so:

```
Σ breakdown net invoices + unallocated = Base TCV         exactly
```

While over, no breakdown is built (it could not tie). Neither incomplete nor over prices a quote: the quote stays refused (`SHARES_TOTAL`) until the allocation is complete. A milestone in month `m` ≥ 1 adds to that month's invoice; month 0 is its own invoice. The milestone names are the shared milestone vocabulary, also used by Commercials (names only, no pricing logic); the calculator treats a milestone as an opaque key and checks only that no key repeats.

**Two-phase:** a recovery period `R`, an integer 1 to T, default 12.

```
instalment     = round_half_up( CAPEX / R, 2 )             months 1 … R−1
instalment(R)  = CAPEX − instalment × (R − 1)              month R carries the rounding
```

The subscription runs months 1 … T alongside.

The CAPEX structures do not inherit installation or annual invoicing from Commercials (C-12 as narrowed by Q13).

### 6.3 The subscription (C-5, Q2)

```
base_fee      = round_half_up( (Base TCV − CAPEX) / T, 2 )          months 1 … T−1
base_fee(T)   = (Base TCV − CAPEX) − base_fee × (T − 1)             month T carries the rounding
sub(m)        = round_half_up( base_fee(m) × factor(k), 2 )         k = the contract year of month m
```

`factor(k)` is section 7's (`S`, `escalator_pct`), and is 1 for every year with no CPI. Month T escalates its OWN base by year k's factor. **CAPEX payments never escalate.**

Under `pass_through` (v1.10, section 9.4), `sub(m) = round_half_up( base_fee(m) × factor(k), 2 ) + pass_through(m)`, with `base_fee` computed as above from Base TCV less `F` (the banded figure), so CPI never reaches the pass-through. Then `CAPEX + Σ_{m=1..T} sub(m) = Base TCV` on the Base schedule, exactly.

```
CAPEX + Σ_{m=1..T} base_fee(m) = Base TCV       exactly (the Base schedule)
CAPEX + Σ_{m=1..T} sub(m)      = Final TCV      (the Final schedule)
```

Each month's net invoice is that month's CAPEX payment, if any, plus `sub(m)`.

### 6.4 Warnings (C-9): shown, never refused

- (a) CAPEX below hardware cost: "Terminus funds X of hardware", X = `hardware_cost − CAPEX`.
- (b) The base subscription fee (`base_fee`) below the deal's monthly hosting cost, `Σ products ( units × HOSTING_MONTHLY )`.

SUPERSEDED by v1.6, left visible so the change can be read (C-5, C-7 and Q2 strike both formulas):

> **CAPEX split:** `hardware_upfront = Σ products ( units × HW_COST / (1 − HW_UPFRONT_MARGIN) )`; `monthly_service = round_half_up( (TCV − hardware_upfront) / T, 2 )`; `upfront = TCV − monthly_service × T` (carries any rounding residue). Upfront + monthly service × term = TCV exactly. Terminus recovers its hardware cash on day one; the monthly service fee carries the remaining margin.
>
> **CAPEX with an escalator (section 7):** the monthly service fee escalates like the OPEX fee, and TCV stays identical to the OPEX TCV. `s = (TCV − hardware_upfront) / (12 × Σ_{k=1..years} factor(k))`; `service_year(k) = round_half_up( s × factor(k), 2 )`; `upfront = TCV − Σ_k ( 12 × service_year(k) )` (carries any rounding residue). `factor(k)` is section 7's. Before v1.3 it was written `(1 + escalator)^(k−1)`, which is `factor(k)` with `S` = 2.

The TMS prototype maps `capex` onto its existing two-phase and hybrid payment structures. PO factoring stays in the cash flow (section 9), and v1.10 adds its pricing treatments (9.3, 9.4).

## 7. Optional annual escalator

```
factor(k)   = 1                                     for k < S
factor(k)   = (1 + escalator_pct)^(k − S + 1)       for k ≥ S
fee_year(k) = round_half_up( fee_year(1) × factor(k), 2 )     per band, k = 1 … ceil(T/12)
TCV (net)   = Σ months ( fee for that month's contract year )
```

`S` is `escalator_start_year` (section 2), at least 2, default 2. With `S` = 2 this is the v1.2 formula, `(1 + escalator_pct)^(k − 1)`, so T16 and T22 are unchanged. A 12-month term has no year 2, so the escalator has no effect on it; nor does it on any term whose last year is before `S`.

The client-facing saving always quotes year-1 fees. Costs are held flat in v1.2, so the escalator raises margin.

**CPI mode (v1.6, C-2, C-3, Q14).** The escalator is the CPI, and it has a mode:

| `cpi_mode` | Rate and `S` | Final TCV | Deal value |
|---|---|---|---|
| `none` | not taken | = Base TCV | Base TCV |
| `published` | taken | **projected**: labelled as a projection at an assumed rate | Base TCV |
| `locked` | taken (a negotiated fixed figure) | **contractual** | Final TCV |

Under `opex` the uplift applies to the monthly fee (the `fee_year(k)` above, per band). Under `capex` it applies to the subscription only (section 6.3). With no CPI, Final TCV = Base TCV. **The margin is on Base TCV in every mode** (section 4.3), so the escalator no longer raises the reported margin. SUPERSEDED, left visible: "so the escalator raises margin" above was true while margin priced on the escalated TCV.

## 8. Tax

| Tax | Treatment |
|---|---|
| GST | Added on top of every invoice: invoiced = net × (1 + `gst_pct`). Never inside margin or TCV (net) |
| WHT | A typed rate per invoice line (`wht_pct`, or with `wht_split` on `wht_hw_pct` and `wht_saas_pct`) and one gross-up switch for every line: with gross-up on, the line's invoice rises so that Terminus receives the line's net after WHT; with it off, WHT reduces Terminus's receipts and shows as a cost |

Quotes show TCV net, GST, and TCV including GST separately.

Tax amounts round half-up to cents per invoice line. WHT applies to the fee before GST, never to the GST.

### 8.1 Invoice lines and WHT (v1.3)

```
gross-up ON:   line_invoice = round_half_up( line_net / (1 − wht_line), 2 )
gross-up OFF:  line_invoice = line_net
line_wht       = round_half_up( line_invoice × wht_line, 2 )        (either way)
Terminus receives line_invoice − line_wht
```

| Structure | `wht_split` off | `wht_split` on |
|---|---|---|
| `capex` | **One line per invoice** at `wht_pct`, on the whole invoice: CAPEX payment and subscription together (C-8) | **v1.6 (C-8, Q8):** `wht_hw_pct` applies to CAPEX payments up to `hardware_value` (section 6.1), taken in payment order; CAPEX above `hardware_value` and every subscription amount take `wht_saas_pct`. An invoice carries at most one line per rate: a hardware line and a SaaS line. A CAPEX payment that straddles `hardware_value` splits across the two lines, each rounded per this section. SUPERSEDED, left visible: "The upfront invoice is hardware, at `wht_hw_pct`; each monthly service invoice is software as a service, at `wht_saas_pct`" |
| `opex` | **One line**: each monthly invoice at `wht_pct` on its whole fee. This is what keeps T20 and T21 exact: two lines at the same rate would each round separately and can differ by a cent (T6 gross-up at 10% gives 322,020.85 as two lines against T20's 322,020.86) | **Two lines** on each monthly invoice: hardware = `round_half_up(hardware_value / T, 2)`, flat for the whole term and never escalated (`hardware_value` as section 6.1, at `HW_UPFRONT_MARGIN`; v1.6 Q9, unchanged in effect), at `wht_hw_pct`; service = that month's fee minus the hardware line, at `wht_saas_pct`. An escalator therefore raises the service line only |

GST is added per invoice line, on the line's invoice amount, rounded half-up.

**Which schedule (v1.6, Q5):** every tax figure is computed per invoice on a schedule. The Final schedule's are what the client is invoiced (GST, gross-up, WHT, TCV incl. GST). The margin after WHT uses the WHT borne on the Base schedule, so it is on the same basis as the margin it reduces.

## 9. Cash flow and PO factoring

### 9.1 Purpose (v1.2, kept)

The quote shows monthly receipts against costs, the running balance, and month of payback. PO factoring, when switched on, shows its cost and its effect on timing. **Margin is reported before and after finance cost** (under `absorb`, 9.3).

SUPERSEDED in wording by v1.10, left visible: "The quote shows monthly receipts (net, by payment structure) against costs (hardware at deployment, hosting monthly), cumulative position, and month of payback." Receipts are now defined in 9.5.

### 9.2 The advance and the loan schedule (v1.10, R-TF2 to R-TF4)

Factoring the client PO funds hardware procurement. The advance `A` is `factoring_advance` (section 2). With rate `r = factoring_rate_pct / 100` per month and term `n`:

```
straight:   principal(i) = A / n                                   i = 1 … n
            interest(i)  = r × balance before month i's repayment
declining:  payment      = A × r / (1 − (1 + r)^−n)                 (A / n when r = 0)
            interest(i)  = r × balance before month i's repayment
            principal(i) = payment − interest(i); month n clears the balance
```

The schedule is held exactly. Each month's interest is rounded half-up to cents on its own; each month's principal is rounded half-up to cents and month `n` carries the remainder, so Σ principal = `A` exactly. **The factoring cost `F` = Σ the monthly interest cents.** These are Commercials' formulas (deal-calculator `buildLoanSchedule`), and a parity test holds the two to the cent (R-TF9).

SUPERSEDED in wording, left visible: Commercials' help text calls "rate multiplied by term" the total cost. Neither method computes that; straight-line interest is `r × A × (n + 1) / 2`.

### 9.3 Absorb (v1.10; the 2026-10-29 ruling)

**John, 2026-10-29, ruled in conversation and first written down here: "factoring is an after-pricing adjustment to margin."** v1.10 keeps that ruling as the `absorb` treatment, the default, and it is no longer the only one.

The price is unchanged: every fee, Base TCV, Final TCV and the schedule are as with factoring off. `F` is a cost:

```
profit after finance  = gross_profit                     (4.3, total_cost carries F)
margin after finance  = gross_margin                     the margin floor (4.4) reads this
profit before finance = gross_profit + F                 reported beside it
margin before finance = (gross_profit + F) / Base TCV    reported beside it
```

SUPERSEDED in wording at the Phase 2 sign-off, left visible: `profit after finance = gross_profit − F`; `margin before finance = gross_margin (4.3, unchanged)`; `margin after finance = (gross_profit − F) / Base TCV`. They wrote `gross_profit` for the before-finance figure, which the corrected 4.3 makes the after-finance one. No figure moves: FA-3 is 86.2% before and 85.8% after either way.

Per product, `product_cost(p)` includes `F_p` (9.4), so the internal profit table shows the factoring cost by product.

### 9.4 Pass through (v1.10, R-TF5 to R-TF7)

The factoring cost is added to the price AT COST, with no markup. Profit is unchanged and the margin falls, by arithmetic and with no special margin handling.

```
F_p             = round_half_up( F × hardware_cost(p) / hardware_cost, 2 )   each product but the last, in line order
F_last          = F − Σ the other F_p                                        by units if hardware_cost is 0
pt_p            = round_half_up( F_p / ( units(p) × T ), 2 )                 per unit per month
r_p             = F_p − pt_p × units(p) × T                                  on the last invoice; may be negative
pass_through(m) = Σ_p units(p) × pt_p                                        m = 1 … T
                + Σ_p r_p                                                    also, in month T
```

- **Not escalated by CPI**: it is a fixed cost recovered at cost. Under `opex` it is added to each month's fee after section 7; under `capex` to the subscription (6.3).
- **It enters Base TCV**, the approval value, the margin floor check (4.4) and, under `locked`, the deal value. Volume bands are unaffected: they count units.
- **The client figures never name it.** The monthly fee rises; nothing on a client figure says factoring.
- WHT and GST apply to it as to the rest of the invoice line it sits on (section 8).

**T-6 SUPERSEDED FOR PO FACTORING ONLY (John, TERM_FACTORING Phase 3 sign-off, 2026-11-16).** T-6 is a TP_TABS ruling (`TP_TABS_BRIEF.md`, 2026-10-11) that was never written into this spec, so it is quoted here, left visible, with the supersession beside it.

> T-6 (TP_TABS, as written): "Final TCV and Deal value appear ONLY on the Quote tab and ONLY when CPI is not None. The Pricing tab shows Base only. The old "Price, set by OPEX" card and Deal value card retire."
>
> As the screen built it (`TermPricingView.tsx`, at `654bc67`): "T-2, T-6: THE PRICE. The OPEX Base quote at the chosen term, from the units alone, so nothing on Payment terms can move or refuse it."

**For PO factoring only, the first half no longer holds.** Factoring may MOVE the Pricing tab's price: under `pass_through`, Base TCV and the approval value (9.4); under `absorb`, the margin the floor reads (4.4, 9.3). **The refusal half stands:** a factoring input the engine refuses never refuses the price. The price is shown without factoring, the refusal is shown on the factoring card, and the quote is blocked until it is fixed. Every other Payment terms input still moves nothing on the Pricing tab, and T-6's placement of Final TCV and Deal value is unchanged.

### 9.5 The cash flow (v1.10, R-TF8, R-TF10, R-TF12)

Months 0 to T. A month 0 appears only when the schedule has a month-0 invoice.

| Row | Month by month |
|---|---|
| Hardware procurement | out: the vendor payment schedule, a list of {month, amount}; today one entry, month 1, `hardware_cost` |
| Factoring advance | in: the advance schedule, a list of {month, amount}; today one entry, month 1, `A` |
| Client payments | in: each invoice of the FINAL schedule as Terminus receives it, after WHT and excluding GST (`invoice − WHT`, section 8.1), month 0 included |
| Hosting and service costs | out: `Σ products ( units × HOSTING_MONTHLY )`, months 1 … T |
| Factoring principal | out: `principal(i)` in month `d + i`, for an advance drawn in month `d` |
| Factoring interest | out: `interest(i)` in month `d + i` |
| Net | the sum of the rows above, in less out |
| Running balance | the cumulative net |

**Each advance entry is its own facility** at the same rate, term and method, repaid from the month after it is drawn; `F` is the sum over entries. Today there is one entry in month 1, so repayments run months 2 … `n + 1` (R-TF10), and `n ≤ T − 1` keeps them inside the term.

### 9.6 The headline (v1.10)

- **Lowest balance with factoring**: the lowest running balance, months 0 … T, and its month (the earliest, on a tie).
- **Lowest balance without factoring**: the same quote priced and run with factoring off. Under `pass_through` that is also the price without the pass-through.
- **Month of payback**: the first month from which the running balance stays at or above 0 to the end of the term, reported for each run; "none within the term" if there is no such month.

### 9.7 Cash in year 1 (v1.6, Q10, kept)

**Cash in year 1 (v1.6, Q10):** the net invoices of months 0 to 12, before GST and WHT, on the schedule displayed (the Final schedule). Under `capex` it is shown against the OPEX figure for the same deal and CPI, the OPEX net invoices of months 1 to 12. Under `pass_through` (v1.10) it includes the pass-through, since it is invoiced.

## 10. Reference tables (the implementation must reproduce these exactly)

Reference product SafeSight: `HW_COST` 8,000.00, `HOSTING_MONTHLY` 200.00. Parameters as in section 3.

**v2.0: THE REFERENCE FIXTURE, AND WHERE EACH FIGURE COMES FROM.** These tables and sections 11 to 11.6 are the formula's cases, kept as the regression suite. Their fixture is a price ladder carrying **v1.x's band-1 list fee at each term, to the cent** (table 10.1's "Monthly fee"; TEST-B, AQ on the v1.x catalog costs 2,000.00 and 100.00, and HEMIR on 100,000.00 and 500.00, the same way). A discounted band fee is then rounded from a list fee that is itself to the cent, so it can differ by a cent from v1.x's (60 months at 5%: 2,613.33 × 0.95 = 2,482.66, where v1.x had 2,482.66), and every case with units beyond band 1 moves by cents. **Every figure that moved was re-derived as John ruled (TP_LADDER brief, "Ruling on the golden figures"):** PRICE ARITHMETIC (10.1 to 10.3, T1 to T14, T19, T23, T29, T31, B-1 to B-6, BG-1 to BG-3) by an independent integer-cents pricer written from this spec; MECHANICS (CAPEX, WHT, GST, CPI, factoring, the cash flow) through the frozen v1.10 engine (e123cf6) with only its list-fee read swapped for the price ladder. The mechanics figures are a REGRESSION SNAPSHOT, not hand-checked; v1.x's hand derivation of the mechanics stands because that code is unchanged. Where both routes reach a figure they agree. The v1.x figures are in this file's history at e123cf6. The v2.0 cases on the live seed are in 11.7.

### 10.1 Per unit, 1 to 9 units

| Term | Monthly fee | vs 36-month fee | TCV per unit | Cost per unit | Profit per unit | Margin |
|---|---|---|---|---|---|---|
| 12 | 8,666.67 | +105.3% | 104,000.04 | 10,400.00 | 93,600.04 | 90.0% |
| 24 | 5,333.33 | +26.3% | 127,999.92 | 12,800.00 | 115,199.92 | 90.0% |
| 36 | 4,222.22 | list | 151,999.92 | 15,200.00 | 136,799.92 | 90.0% |
| 48 | 3,216.67 | −23.8% | 154,400.16 | 17,600.00 | 136,800.16 | 88.6% |
| 60 | 2,613.33 | −38.1% | 156,799.80 | 20,000.00 | 136,799.80 | 87.2% |
| 72 | 2,211.11 | −47.6% | 159,199.92 | 22,400.00 | 136,799.92 | 85.9% |
| 84 | 1,923.81 | −54.4% | 161,600.04 | 24,800.00 | 136,800.04 | 84.7% |
| 96 | 1,708.33 | −59.5% | 163,999.68 | 27,200.00 | 136,799.68 | 83.4% |
| 108 | 1,540.74 | −63.5% | 166,399.92 | 29,600.00 | 136,799.92 | 82.2% |
| 120 | 1,406.67 | −66.7% | 168,800.40 | 32,000.00 | 136,800.40 | 81.0% |

Profit varies by cents only, from fee rounding.

### 10.2 Band fees (monthly, per unit)

| Term | 1 to 9 (0%) | 10 to 49 (5%) | 50 to 199 (10%) | 200+ (15%) |
|---|---|---|---|---|
| 12 | 8,666.67 | 8,233.34 | 7,800.00 | 7,366.67 |
| 24 | 5,333.33 | 5,066.66 | 4,800.00 | 4,533.33 |
| 36 | 4,222.22 | 4,011.11 | 3,800.00 | 3,588.89 |
| 48 | 3,216.67 | 3,055.84 | 2,895.00 | 2,734.17 |
| 60 | 2,613.33 | 2,482.66 | 2,352.00 | 2,221.33 |
| 72 | 2,211.11 | 2,100.55 | 1,990.00 | 1,879.44 |
| 84 | 1,923.81 | 1,827.62 | 1,731.43 | 1,635.24 |
| 96 | 1,708.33 | 1,622.91 | 1,537.50 | 1,452.08 |
| 108 | 1,540.74 | 1,463.70 | 1,386.67 | 1,309.63 |
| 120 | 1,406.67 | 1,336.34 | 1,266.00 | 1,195.67 |

### 10.3 Worst-case margin (every unit at that band's fee)

| Term | 0% | 5% | 10% | 15% |
|---|---|---|---|---|
| 36 | 90.0% | 89.5% | 88.9% | 88.2% |
| 60 | 87.2% | 86.6% | 85.8% | 85.0% |
| 84 | 84.7% | 83.8% | 82.9% | 81.9% |
| 120 | 81.0% | 80.0% | 78.9% | 77.7% |

### 10.4 The margin check (v1.8, TB-7)

Beside the band editor, for the product shown and the bands as typed: every band at every term in `TERMS`, each cell the 10.3 worst case (every unit at that band's fee, margin on price):

```
band_fee(T, band)   as 4.2, on the candidate bands
cost(T)             = HW_COST + HOSTING_MONTHLY × T
margin(T, band)     = ( band_fee × T − cost(T) ) / ( band_fee × T ) × 100
flagged             margin(T, band) < MARGIN_FLOOR, compared exactly (a cell shown as 25.0% that is 24.96% is flagged)
```

**v2.0 (A6, L-7): three checks on every cell, in the order floor, client total, profit.** Beside the floor: "Client total below {n} months" when a cell's client total (`band_fee × T`) is below the same band's previous term WITH a price, and "Profit below {n} months" when its profit is. Equal is not a fall. A term with no price is a gap: no figures, and the next priced term compares across it. In the price ladder editor the grid reads the price ladder AS TYPED, so an admin sees the checks before saving. SUPERSEDED, left visible: v1.8 flagged the floor only, and Phase 0's 74-case profit-step finding is moot because the formula is gone. Each check's summary reads "Above the {floor}% floor at every band", "Client total never falls with a longer term", "Profit never falls with a longer term", or names the cells that fail.

A flagged cell **warns and never refuses**: the bands still save. The warning names the count and each breach, then says: "You can still save. A quote is flagged for approval only when its whole-deal margin falls below the floor." (the flag of 4.4 is on the whole deal, so a band's worst case below the floor does not by itself flag any quote).

Below the grid, the fee per unit per month for every band at 36, 60, 84 and 120 months, from the same figures (a term not in `TERMS` is not shown). While the set breaks a rule of 3.2, neither the grid nor the fee table shows figures; each reads "Fix the band rules to see the margin check."

## 11. Test cases (must pass)

SafeSight at the reference costs unless stated. `TEST-B` is a **test fixture, not a real product**: `HW_COST` 2,000.00, `HOSTING_MONTHLY` 50.00.

| # | Inputs | Expected | Why |
|---|---|---|---|
| T1 | 1 unit, 36 | TCV 151,999.92, margin 90.0% | Base case |
| T2 | 9 units, 36 | TCV 1,367,999.28 | Top of band 1 |
| T3 | 10 units, 36 | TCV 1,512,399.24, margin 89.9% | First unit in band 2 |
| T4 | 49 units, 60 | TCV 7,369,582.20 | Top of band 2 |
| T5 | 50 units, 60 | TCV 7,510,702.20 | Band 3; MORE than T4 (no cliff) |
| T6 | 120 units, 60 | TCV 17,389,102.20, margin 86.2% | Demo-sized deal |
| T7 | 199 units, 84 | TCV 29,411,221.56 | Top of band 3 |
| T8 | 200 units, 84 | TCV 29,548,581.72 | Band 4; MORE than T7 (no cliff) |
| T9 | 250 units, 120 | TCV 38,039,136.00, margin 79.0% | Largest, lowest-margin case |
| T10 | 1 unit, 12 | TCV 104,000.04 | Shortest term |
| T11 | 5 units, 24 | TCV 639,999.60 | Two-year term |
| T12 | TEST-B 1 unit, 36 | TCV 38,000.16, monthly fee 1,055.56 | Second cost mix |
| T13 | TEST-B 30 units, 60 | TCV 1,134,829.80, margin 86.8% | Second product, banded |
| T14 | T6 + T13 on one deal | TCV 18,523,932.00 | Multi-product: lines add, bands count per line |
| T15 | T6 as `capex` | upfront 1,200,000.00 + 269,818.37 × 60 = 17,389,102.20 | CAPEX split ties to TCV |
| T16 | 1 unit, 60, CPI `published` 3% (S 2) | Base TCV 156,799.80, margin 87.2%. Final TCV (projected) 166,494.36; year fees 2,613.33 / 2,691.73 / 2,772.48 / 2,855.66 / 2,941.33. Deal value 156,799.80 | Escalator; Base and Final (v1.6) |
| T17 | 1 unit, 18 months | error | Term not offered |
| T18 | all units 0 | error | No units |
| T19 | T6 with `MARGIN_FLOOR` 90% | flag shown, quote still prices | Floor flags, never refuses |
| T20 | T6, WHT 10%, gross-up ON | monthly invoice 322,020.41; WHT 32,202.04; Terminus receives 289,818.37 (= T6 monthly total) | Gross-up |
| T21 | T6, WHT 10%, gross-up OFF | monthly invoice 289,818.37; WHT 28,981.84 borne; Terminus receives 260,836.53 | WHT borne |
| T22 | T6 as `capex` (Hardware, Hybrid default), CPI `locked` 3% (S 2) | CAPEX 1,200,000.00 month 0. Subscription by year 269,818.37 / 277,912.92 / 286,250.31 / 294,837.82 / 303,682.95 (month 60 = 303,682.95, no residue). Base TCV 17,389,102.20, margin 86.2%. Final TCV 18,390,028.44 = deal value | CAPEX subscription escalates; CAPEX does not (v1.6) |
| T23 | SafeSight 120 + AQ 30, 60 months; AQ at the catalog's `HW_COST` 2,000.00 and `HOSTING_MONTHLY` 100.00 | AQ band fees 973.33 (1 to 9) and 924.66 (10 to 49); AQ line 1,690,669.80; deal TCV 19,079,772.00; cost 2,640,000.00; margin on price 86.2% | Multi-product on real catalog costs (T14 on the screen) |
| T24 | T6 as `capex`, `wht_split` on, hardware 5%, service 10%, gross-up OFF | WHT on upfront 60,000.00, Terminus receives 1,140,000.00; WHT per service invoice 26,981.84, Terminus receives 242,836.53; total WHT borne 1,678,910.40 | Split WHT, CAPEX |
| T25 | T6 as `opex`, `wht_split` on, hardware 5%, service 10%, gross-up ON, GST 0 | hardware line 20,000.00 → invoice 21,052.63, WHT 1,052.63, receives 20,000.00; service line 269,818.37 → invoice 299,798.19, WHT 29,979.82, receives 269,818.37; invoice total 320,850.82 | Split WHT, OPEX two lines |
| T26 | 1 unit, 108 | TCV 166,399.92; margin 82.2% | The ten-year ladder's new term |
| T27 | 1 unit, 60, CPI `locked` 3% from year 3 | Base TCV 156,799.80, margin 87.2%. Final TCV 162,558.36; year fees 2,613.33 / 2,613.33 / 2,691.73 / 2,772.48 / 2,855.66. Deal value 162,558.36 | Escalator start year; Locked (v1.6) |
| T28 | T6 as `capex` (Hardware, Hybrid default), CPI `published` 3% from year 3 | CAPEX 1,200,000.00. Subscription by year 269,818.37 / 269,818.37 / 277,912.92 / 286,250.31 / 294,837.82. Base TCV 17,389,102.20. Final TCV (projected) 17,983,653.48. Deal value 17,389,102.20 | CAPEX with a later CPI start; Published (v1.6) |
| T29 | SafeSight 120 + AQ 40 + HEMIR 2, 60 months, `opex`, no escalator | SafeSight TCV 17,389,102.20, cost 2,400,000.00, profit 14,989,102.20, 86.2%; AQ 2,245,465.80, 320,000.00, 1,925,465.80, 85.7%; HEMIR 2,384,000.40, 260,000.00, 2,124,000.40, 89.1%; deal 22,018,568.40, 2,980,000.00, 19,038,568.40, 86.5% | Per-product totals sum to the deal |
| T30 | the same units, 60 months, `capex` (Hardware, Hybrid Contract start m0 100%), CPI `locked` 3% (S 2), single WHT 10% borne | **Base, per product:** SafeSight 17,389,102.20, 86.2%; AQ 2,245,465.80, 85.7%; HEMIR 2,384,000.40, 89.1%. Deal Base TCV 22,018,568.40; gross profit 19,038,568.40, 86.5%. **Base schedule:** WHT 2,201,856.78; profit after WHT 16,836,711.62, 76.5%. **Final schedule:** CAPEX 1,550,000.00 m0; subscription 341,142.81 (months 1..12), 351,377.09 (13..24), 361,918.41 (25..36), 372,775.96 (37..48), 383,959.24 (49..59), 383,959.01 (month 60). Final TCV 23,284,081.89 = deal value (CPI uplift 1,265,513.49). WHT on Final invoices 2,328,408.18. Month 0: WHT 155,000.00, receives 1,395,000.00. Year-1 subscription invoice: WHT 34,114.28, receives 307,028.53. **With GST 9%:** Final GST 2,095,567.42, TCV incl. GST 25,379,649.31 (Base schedule: GST 1,981,670.98, incl 24,000,239.38) | Per product on Base; Final deal-level only; WHT whole-deal only (v1.6) |
| T31 | SafeSight 120 + AQ 40 + HEMIR 2, `opex`, catalog costs: per camera at every term (section 4.5) | 12: 8,009.45; 24: 4,928.89; 36: 3,902.04; 48: 2,972.74; 60: 2,415.15; 72: 2,043.43; 84: 1,777.92; 96: 1,578.78; 108: 1,423.90; 120: 1,300.00 | Per camera divides the SafeSight line only; AQ and HEMIR do not move it |

Also test: changing any parameter (for example `ANCHOR_MARGIN` to 80%, or `PROFIT_STEP` to 1,000.00) flows through with no code change.

**Unchanged by v1.6:** T14, T15 (CAPEX 1,200,000.00; subscription 269,818.37 months 1..60, no residue; TCV 17,389,102.20), T24, T25, T31, and the flow case `HW_UPFRONT_MARGIN` 0 (CAPEX 960,000.00; subscription 273,818.37). v1.4's "a product TCV is the same under `opex` and `capex`" is restated on Base TCV, where it holds; Final TCV is deal-level.

### 11.1 CAPEX payment cases (v1.6)

The demo deal: SafeSight 120 + AQ 40 + HEMIR 2, 60 months, the settings of section 3 (SafeSight 8,000 / 200; AQ 2,000 / 100; HEMIR 100,000 / 500; anchor margin 90%; `HW_UPFRONT_MARGIN` 20%). No CPI unless stated. Base TCV 22,018,568.40 in every case.

| # | Inputs | Expected | Why |
|---|---|---|---|
| G-C1 | `capex`, Hardware, Hybrid default (Contract start, month 0, 100%) | CAPEX 1,550,000.00. Subscription 341,142.81 months 1..59, 341,142.61 month 60. Final TCV 22,018,568.40. Deal value = Base TCV. Cash in year 1 5,643,713.72 (OPEX year 1: 4,403,713.68) | The default |
| G-C2 | `capex`, Custom 1,000,000.00, Hybrid: Contract start m0 30%; Hardware delivered to site m3 40%; Commissioning m6 30% | Milestones 300,000.00 / 400,000.00 / 300,000.00. Subscription 350,309.47 months 1..59, 350,309.67 month 60. Invoices: m0 300,000.00; m3 750,309.47; m6 650,309.47. Warning (a): Terminus funds 240,000.00. Cash in year 1 5,203,713.64 | Custom amount; milestones add to their month's invoice |
| G-C3 | `capex`, Hardware, Two-phase, R = 12 | Instalment 129,166.67 months 1..11, 129,166.63 month 12. Invoices 470,309.48 months 1..11, 470,309.44 month 12, 341,142.81 months 13..59, 341,142.61 month 60. Cash in year 1 5,643,713.72 | Two-phase; the last instalment carries the rounding |
| G-C4 | refusals | CAPEX 0; CAPEX = Base TCV; shares totalling 99.9% and 100.1%; a duplicate milestone; a month > T; months decreasing; R = 0; R > T | Each refused |
| G-C5 | G-C1 with CPI `locked` 3% (S 2), no WHT | As T30's Final schedule. Final TCV 23,284,081.89 | CPI on the subscription only |
| G-C6 | `capex`, Custom 2,000,000.00, Hybrid Contract start m0 100%, split WHT 5% hardware / 10% SaaS, gross-up OFF, GST 0, no CPI | Month 0 invoice: hardware line 1,550,000.00, WHT 77,500.00; SaaS line 450,000.00, WHT 45,000.00; WHT 122,500.00, receives 1,877,500.00. Subscription 333,642.81 months 1..59, 333,642.61 month 60; WHT 33,364.28 each, 33,364.26 month 60. Total WHT 2,124,356.78. Warning (a) does not fire | Split WHT straddling the hardware value |
| L1 | 1 unit, 60, `opex`, CPI `published` 3% from year 3, split WHT 5% / 10%, gross-up ON, GST 9% | Final schedule: TCV 162,558.36; gross-up 17,477.04; GST 16,203.36; incl. GST 196,238.76. Base schedule: TCV 156,799.80; gross-up 16,837.20; GST 15,627.60; incl. GST 189,264.60 | The tax tie holds on each schedule |

### 11.2 Superseded figures (v1.5), left visible

| # | v1.5 inputs | v1.5 expected |
|---|---|---|
| T16 | 1 unit, 60, escalator 3% | year fees 2,613.33 / 2,691.73 / 2,772.48 / 2,855.66 / 2,941.33; TCV 166,494.36; margin 88.0% |
| T22 | T6 as `capex` with escalator 3% | TCV 18,464,248.32; upfront 1,200,000.00; service fees by year 270,983.34 / 279,112.84 / 287,486.23 / 296,110.81 / 304,994.14; upfront + Σ = TCV |
| T27 | 1 unit, 60, escalator 3% from year 3 | year fees 2,613.33 / 2,613.33 / 2,691.73 / 2,772.48 / 2,855.66; TCV 162,558.36; margin 87.7% |
| T28 | T6 as `capex`, escalator 3% from year 3 | TCV 18,027,745.92; upfront 1,200,000.00; service fees by year 270,527.21 / 270,527.21 / 278,643.03 / 287,002.32 / 295,612.39; upfront + Σ = TCV |
| T30 | the same units, 60 months, `capex`, escalator 3% from year 2, WHT 10% borne | SafeSight TCV 18,464,248.32, 87.0%; AQ 2,384,313.00, 86.6%; HEMIR 2,531,396.40, 89.7%; deal TCV 23,379,957.72, gross profit 20,399,957.72, 87.3%; upfront 1,550,000.04; service fees by year 342,647.69 / 352,927.12 / 363,514.94 / 374,420.39 / 385,653.00; WHT borne 2,337,995.72; gross profit after WHT 18,061,962.00, 77.3% |

### 11.3 v1.7 cases (TP_TABS)

The demo deal of 11.1, 60 months, the settings of section 3. No CPI.

| # | Inputs | Expected | Why |
|---|---|---|---|
| T4-G1 | `capex`, Custom 1,000,000.00, Milestones: Contract start m0 50%; Installation complete m4 30% | Contract start 500,000.00; Installation complete 300,000.00; allocated 80% = 800,000.00; unallocated 20% = 200,000.00; subscription 350,309.47 months 1..59, 350,309.67 month 60; breakdown invoices m0 500,000.00, m4 650,309.47; status incomplete | The allocation preview (T-4) |
| B-1 | `opex`, the per-band totals | SafeSight 1-9: 9 units, fee 2,613.33, monthly 23,519.97, Base TCV 1,411,198.20, 87.2% | Per band (C1) |
| B-2 | as B-1 | SafeSight 10-49: 40 units, 2,482.66, 99,306.40, 5,958,384.00, 86.6% | |
| B-3 | as B-1 | SafeSight 50-199: 71 units, 2,352.00, 166,992.00, 10,019,520.00, 85.8% | |
| B-4 | as B-1 | Air Quality 1-9: 9 units, 973.33, 8,759.97, 525,598.20, 86.3% | |
| B-5 | as B-1 | Air Quality 10-49: 31 units, 924.66, 28,664.46, 1,719,867.60, 85.6% | |
| B-6 | as B-1 | HEMIR 1-9: 2 units, 19,866.67, 39,733.34, 2,384,000.40, 89.1% | |

Each product's bands sum to its v1.4 figures (T29), unchanged.

### 11.4 v1.8 cases (TP_BANDS)

The settings of section 3, anchor margin 90%, catalog costs. Copied from the TP_BANDS brief; never computed by the code under test.

| # | Inputs | Expected | Why |
|---|---|---|---|
| BG-1 | SafeSight bands 1/10/50/200/500/1000 at 0/5/10/15/20/30%; 1,000 units; 60 months, `opex` | band fees 2,613.33 / 2,482.66 / 2,352.00 / 2,221.33 / 2,090.66 / 1,829.33; units 9 / 40 / 150 / 300 / 500 / 1; monthly 2,189,184.70; Base TCV 131,351,082.00; margin 84.8% | Six configured bands (TB-1, TB-2, TB-9) |
| BG-2 | HEMIR bands 1/2/5/10 at 0/5/10/15%; 2 units; 60 months | fees 19,866.67 (1 unit) and 18,873.34 (1 unit); monthly 38,740.01; Base TCV 2,324,400.60; margin 88.8% | A product's own bands (TB-1) |
| BG-3 | The margin check, SafeSight 30% band (worst case) | 12 months fee 6,066.67, margin 85.7%; 36: 2,955.55, 85.7%; 60: 1,829.33, 81.8%; 120: 984.67, 72.9% | Section 10.4 (TB-7) |
| BG-4 | Refusals, server and editor | band 1 start not 1; a start not above the previous; 1 band; 7 bands; a falling discount; a discount of 100 or more; a non-whole start | Each refused with its 3.2 wording (TB-6) |
| BG-5 | The seed (3.1) on every product | every v1.7 figure (sections 10, 11, 11.1 to 11.3) unchanged | Nothing moved (TB-1) |

### 11.5 v1.9 cases (TP_MANUAL), RETIRED by v2.0 with section 4.6, left visible

The settings of section 3, anchor margin 90%, `PROFIT_STEP` 0, SafeSight catalog costs (8,000.00 hardware, 200.00 a month hosting). Copied from the TP_MANUAL brief, with MG-4 as corrected by ruling C2; never computed by the code under test.

**MG-1.** Prices 12: 2,500.00; 24: 1,500.00; 36: 1,100.00; 48: 900.00; 60: 800.00; 72: 700.00; 84: 620.00; 96: 560.00; 108: 520.00; 120: 500.00.

| Term | Calculated | Difference | vs 36 | Margin | Profit | Client total | Check |
|---|---|---|---|---|---|---|---|
| 12 | 8,666.67 | −71.2% | +127.3% | 65.3% | 19,600.00 | 30,000.00 | ok |
| 24 | 5,333.33 | −71.9% | +36.4% | 64.4% | 23,200.00 | 36,000.00 | ok |
| 36 | 4,222.22 | −73.9% | list | 61.6% | 24,400.00 | 39,600.00 | ok |
| 48 | 3,216.67 | −72.0% | −18.2% | 59.3% | 25,600.00 | 43,200.00 | ok |
| 60 | 2,613.33 | −69.4% | −27.3% | 58.3% | 28,000.00 | 48,000.00 | ok |
| 72 | 2,211.11 | −68.3% | −36.4% | 55.6% | 28,000.00 | 50,400.00 | ok |
| 84 | 1,923.81 | −67.8% | −43.6% | 52.4% | 27,280.00 | 52,080.00 | Profit below 72 months |
| 96 | 1,708.33 | −67.2% | −49.1% | 49.4% | 26,560.00 | 53,760.00 | Profit below 84 months |
| 108 | 1,540.74 | −66.2% | −52.7% | 47.3% | 26,560.00 | 56,160.00 | ok (equal is not a fall) |
| 120 | 1,406.67 | −64.5% | −54.5% | 46.7% | 28,000.00 | 60,000.00 | ok |

Summary: floor ok; client total ok; profit falls at 84, 96.

| # | Inputs | Expected | Why |
|---|---|---|---|
| MG-2 | MG-1 with 72 blank | the 84 row compares against 60: profit 27,280.00 below 28,000.00, flagged "Profit below 60 months" | The previous row WITH a price |
| MG-3 | MG-1 with 36 blank | every vs 36 shows "-" | No anchor price |
| MG-4 | MG-1 with 120 at 300.00 | client total 36,000.00, profit 4,000.00, margin 11.1%; flags, in order, "Below the floor", "Client total below 108 months", "Profit below 108 months" | All three checks on one row (C2) |

### 11.6 v1.10 cases (TERM_FACTORING)

T6 (SafeSight 120, 60 months, `opex`, no CPI, no tax: monthly 289,818.37, Base TCV 17,389,102.20, cost 2,400,000.00) and the 11.1 demo deal, the settings of section 3. Copied from the TERM_FACTORING Phase 1 report and its sign-off, computed by hand; never computed by the code under test.

| # | Inputs | Expected | Why |
|---|---|---|---|
| FA-1 | Loan 960,000.00, 1.0%/month, 12 months, straight | principal 80,000.00 every month; interest 9,600.00, 8,800.00 … 800.00 (800 × (13 − k)); F = 62,400.00 | Straight-line, opening balance |
| FA-2 | Loan 960,000.00, 1.0%/month, 12 months, declining | month 1: principal 75,694.84, interest 9,600.00; month 2: 76,451.79, 8,843.05; month 12: 84,450.34, 844.50; Σ principal 960,000.00; F = 63,538.05 | Declining, level payment |
| FA-3 | T6 with factoring on, advance default (960,000.00), FA-1's facility, `absorb` | Price unchanged: monthly 289,818.37, Base TCV 17,389,102.20. Profit 14,989,102.20 before finance, 14,926,702.20 after; margin 86.2% before, 85.8% after; the floor reads 85.8% | Absorb |
| FA-4 | FA-3 with `pass_through` | pt 8.67 per unit per month; remainder −24.00 on month 60. Monthly 290,858.77 months 1..59, 290,834.77 month 60. Base TCV 17,451,502.20; cost 2,462,400.00; profit 14,989,102.20 (unchanged); margin 85.9%. SafeSight 1 to 9 band fee still 2,613.33 | Pass through at cost; bands untouched |
| FA-5 | Demo deal, `opex`, advance default (1,240,000.00), 1.0%/month, 12 months, straight, `pass_through` | F = 80,600.00. F_p: SafeSight 62,400.00, AQ 5,200.00, HEMIR 13,000.00. pt: 8.67, 2.17, 108.33; remainders −24.00, −8.00, +0.40. Pass-through 1,343.86 a month, month 60 −31.60 more. Monthly 368,320.00 months 1..59, 368,288.40 month 60. Base TCV 22,099,168.40; profit 19,038,568.40 (T29's, unchanged); margin 86.2% (T29: 86.5%). Per product: SafeSight 17,451,502.20 / 85.9%; AQ 2,250,665.80 / 85.6%; HEMIR 2,397,000.40 / 88.6% | Allocation by hardware cost; per product |
| FA-6 | FA-5 as `capex`, G-C1 (Hardware, Hybrid Contract start m0 100%) | CAPEX 1,550,000.00 m0. Subscription 342,486.67 months 1..59, 342,454.87 month 60 (G-C1's 341,142.81 / 341,142.61 plus the pass-through). Base TCV 22,099,168.40 | Pass through under CAPEX, outside CPI |
| FA-7 | FA-3's cash flow | Month 1: client 289,818.37, hosting −24,000.00, procurement −960,000.00, advance +960,000.00, net 265,818.37. Month 2: principal −80,000.00, interest −9,600.00, net 176,218.37, balance 442,036.74. Month 13: interest −800.00, net 185,018.37, balance 2,433,238.81. Month 60 balance 14,926,702.20 (= profit after finance). Lowest with factoring 265,818.37 at month 1, payback month 1; without −694,181.23 at month 1, payback month 4 | Rows, timing, headline |
| FA-8 | Every case in sections 10 and 11 with factoring off | every figure unchanged | Nothing moved |
| FA-8 (v2.0, A8) | The same captured population with factoring off, against the frozen v1.10 engine on the same price ladder | every captured output identical, field by field; the only fields v2.0 adds are the price source, the list monthly and the deal adjustment's, carrying their no-adjustment values; the price source is 'ladder' on every line and unit | The formula's removal, `COMPARE_TERM` and the deal adjustment move nothing else |
| FA-9 | Engine only: advance schedule [{month 1, 600,000.00}, {month 7, 360,000.00}], 1.0%/month, 12 months, straight | Facility 1: principal 50,000.00 months 2..13, interest 500 × (13 − k) = 6,000.00 … 500.00, total 39,000.00. Facility 2: principal 30,000.00 months 8..19, interest 300 × (13 − k) = 3,600.00 … 300.00, total 23,400.00. Advance row +600,000.00 month 1, +360,000.00 month 7. Month 8: principal 80,000.00 (50,000.00 + 30,000.00), interest 6,600.00 (3,000.00 + 3,600.00). F = 62,400.00 | The schedule shape for staging (R-TF12) |

### 11.7 v2.0 cases (TP_LADDER)

The live seed (A2) on SafeSight's spec costs, the seed bands (3.1), Base, no CPI, `opex`. LG-1 to LG-6 are copied from the TP_LADDER brief, checked independently in integer cents at Phase 0; DA-1 and DA-2 from the approved mockup's frame A (prototypes/term-pricing-ladder.html), worked by hand there; never computed by the code under test.

| # | Inputs | Expected | Why |
|---|---|---|---|
| LG-1 | 1 unit, every term | fee = the seed; client total / profit / margin: 12: 30,000.00 / 19,600.00 / 65.3%; 24: 36,000.00 / 23,200.00 / 64.4%; 36: 38,880.00 / 23,680.00 / 60.9%; 48: 42,000.00 / 24,400.00 / 58.1%; 60: 45,000.00 / 25,000.00 / 55.6%; 72: 47,880.00 / 25,480.00 / 53.2%; 84: 50,820.00 / 26,020.00 / 51.2%; 96: 53,760.00 / 26,560.00 / 49.4%; 108: 56,700.00 / 27,100.00 / 47.8%; 120: 60,000.00 / 28,000.00 / 46.7%. No flags | The ladder is the list price |
| LG-2 | 60 units, 120 months | monthly 28,450.00; Base TCV 3,414,000.00; cost 1,920,000.00; profit 1,494,000.00; 43.8% | Bands on the ladder |
| LG-3 | 60 units, 36 months | band fees 1,080.00 / 1,026.00 / 972.00; monthly 61,452.00; Base TCV 2,212,272.00; cost 912,000.00; profit 1,300,272.00; 58.8% | |
| LG-4 | 250 units, 60 months | band fees 750.00 / 712.50 / 675.00 / 637.50; monthly 169,012.50; Base TCV 10,140,750.00; cost 5,000,000.00; profit 5,140,750.00; 50.7% | |
| LG-5 | 1 unit, 120 months, HW 21,000.00 then 21,000.01 | exactly 25.0%, no flag; then the floor flag | The floor is exact (4.4) |
| LG-6 | The margin check, seed bands; then band 4 at 30% | no flag at any band; then band 4 "Profit below" at 36 to 120 (the first against 24 months) and the floor at 120 (fee 350.00, margin 23.8%); the client total never falls | 10.4, every check on every cell |
| LG-7 | The seed with 108 removed, `TERMS` unchanged (re-derived under amended L-8) | 108 prices nothing: "No price ladder price for 108 months"; every other term prices on the seed; the grid has a gap at 108 and compares 120 with 96 | 4.1, no substitute |
| DA-1 | 1 SafeSight + 1 Air Quality (A3 costs: 2,000.00 and 50.00), 36 months, 5.0% deal discount | Base TCV 51,710.40; List TCV 54,432.00; discount 5.0%; discount value 2,721.60; deal fee 1,436.40; gross profit 32,710.40; 63.3%; "Approval signal: 5.0% below list" | Frame A, the price card (4.7) |
| DA-2 | DA-1 at every term | list fee / deal fee / per camera at list / vs 36 / Base TCV / margin: 12: 3,500.00 / 3,325.00 / 2,500.00 / +131.5% / 39,900.00 / 67.4%; 36: 1,512.00 / 1,436.40 / 1,080.00 / list / 51,710.40 / 63.3%; 60: 1,050.00 / 997.50 / 750.00 / −30.6% / 59,850.00 / 58.2%; 120: 700.00 / 665.00 / 500.00 / −53.7% / 79,800.00 / 49.9% (every row, frame A) | Frame A, the term table (4.5, 4.7) |
| DA-3 | DA-1 with a deal fee typed at 36: 1,436.40; then 1,436.41 | 1,436.40 is exactly 5%, and 60 months is then 997.50 (the discount is kept); 1,436.41 is kept to the cent, split 53.99 SafeSight and 21.60 Air Quality; "vs 36" stays on list (−71/54 at 12 months) | Either-or (4.7) |
| DA-4 | Refusals | a fee above list; 99.95% and 5.25% (one decimal); 100%; both given; a fee to three decimals; a term not offered. 99.9% is allowed (1.51 a month); 0 and a fee equal to list are no adjustment | 4.7 |
| DA-5 | 1 SafeSight, 36 months, 70% off | 324.00 a month; Base TCV 11,664.00; profit −3,536.00; the floor flag; the quote prices | Flags, never refuses |
| DA-6 | 1 SafeSight, 36 months, 5% off, CPI locked 3% from year 2 | monthly by year 1,026.00 / 1,056.78 / 1,088.48; Final TCV 38,055.12; Base TCV 36,936.00 | The discount every year (4.7, 7) |
| DA-7 | DA-1 as `capex`, Hardware | CAPEX 12,500.00 at month 0; subscription 1,089.18 a month, 1,089.10 in month 36; Base TCV 51,710.40 | The subscription on the deal's Base TCV (6.3) |

## 12. Implementing in the TMS prototype

- Built through the TMS round method, as a standalone Term Pricing screen first. It does not touch the existing Commercials engine or its golden deals.
- CLAUDE.md carries a scoped rule: "The term pricing calculator follows docs/pricing-spec.md exactly: no hard-coded parameters, no floats for money. This rule does not govern the deal-sheet engine."
- Sections 10 and 11 become the calculator's golden figures, copied from this spec, never computed by the code under test.

## 13. Not yet decided

| Item | Current position |
|---|---|
| ~~Market level of the 90% anchor margin~~ | SUPERSEDED by v2.0: there is no anchor margin; the price ladder is the market price, an admin's to set (A1) |
| Upgrade credit (short term extended to 36+ reprices from day one) | Recommended; not in v1.2 |
| Early-termination charge (reprice to the term actually served) | Recommended; not in v1.2 |
| Installation | Excluded; must be recovered in full on 12- and 24-month terms when added |
| Warranty | Excluded for now |
| Cost escalation | Costs held flat |
| ~~Per-camera columns under `capex` (hardware per camera, service fee per camera)~~ | **CLOSED (v1.6, C-10, Q12):** no per-camera CAPEX figure anywhere; ~~under `capex` the ladder shows the term and the OPEX per-camera fee only~~ (superseded by v1.7, C2: the ladder shows every column whatever the basis; section 4.5) |
| Linking a quote to an opportunity's TCV | After the demo, with a "one deal, one price" rule |
| A split OPEX invoice whose service line would fall below zero (the hardware line exceeds the month's fee, possible only with unusual admin margins) | The quote refuses with a clear error rather than invoice a negative line (implementation position, TERM_PRICING_2) |
| Staged vendor payments and staged factoring drawdowns on the screen | The engine takes schedules (9.5); the screen shows one amount each (v1.10, R-TF12) |
| Factoring timing other than month 1 | Month 1 for procurement and the advance, as Commercials (R-TF10) |
