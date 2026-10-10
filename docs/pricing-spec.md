# Terminus Term Pricing: Specification v1.6

**Status:** Approved for prototype build (John, 1 Oct 2026). Margin levels to be tuned to market later.
**Supersedes:** v1.1 (1 Oct 2026) and v1.0 (Neil, 30 Sep 2026)
**Amended (v1.2.1, John, 1 Oct 2026):** TERMS as a parameter; anchor and short-term margins per product; tax rounding and WHT base; test cases T20 and T21. Every figure in sections 10 and 11 is unchanged.
**Amended (v1.2.2, John, 1 Oct 2026):** with an escalator, the CAPEX monthly service fee escalates like the OPEX fee and TCV stays identical to the OPEX TCV (section 6); test case T22. Every earlier figure is unchanged.
**Amended (v1.2.3, John, 2 Oct 2026):** test case T23, a multi-product deal on real catalog costs, so the T14 behaviour can be proven on the screen (TEST-B is not in the catalog). Every earlier figure is unchanged.
**Amended (v1.3, John, 2 Oct 2026, rulings B1 to B6 of TERM_PRICING_2):** the default `TERMS` runs every year to ten, adding 108 months (B1); WHT is a typed rate with a separate gross-up switch (B3), optionally split between the hardware and the software-as-a-service invoice lines (B4); the escalator starts in a chosen contract year (B6); test cases T24 to T28. Every earlier figure is unchanged: rows 10.1 and 10.2 gain 108, and `steps_above(120)` becomes 7 while `PROFIT_STEP` is 0.
**Amended (v1.4, John, 5 Oct 2026, QUOTE_PANEL):** per-product totals in section 4.3 (each product's TCV, cost, gross profit and margin, summing exactly to the deal); WHT is never allocated to a product; test cases T29 and T30. Every earlier figure is unchanged.
**Amended (v1.5, John, 10 Oct 2026, PER_CAMERA_AND_CAPEX_P0):** the term ladder's OPEX per-camera fee (section 4.5); test case T31. Every earlier figure is unchanged.
**Amended (v1.6, John, 10 Oct 2026, TP_CAPEX, rulings C-1 to C-13 and Q1 to Q14):** OPEX sets the price; CAPEX is a way of paying part of it earlier, against a client CAPEX budget, and the remainder is a monthly subscription; CPI is an uplift on the subscription, never on CAPEX. Two TCVs: **Base TCV** (no CPI) carries approval, margin, the margin floor, the profit table and the volume discount; **Final TCV** (with CPI) is what the client is invoiced (section 4.3). A CPI mode (section 7). The CAPEX amount, Two-phase and Hybrid payment, and the subscription (section 6). Split WHT on CAPEX payments (section 8.1). Cash in year 1 (section 9). Warnings (section 6.4). Under CAPEX the ladder shows the OPEX per-camera fee only (section 4.5). **Figures that move:** T16, T22, T27, T28 and T30 now report Base and Final separately (section 11); every other earlier figure is unchanged. Test cases G-C1 to G-C6 and the L1 pair (section 11.1).

**Purpose:** Price a Terminus deal so that longer contracts give the client a visibly lower monthly fee while Terminus earns at least as much profit as on a 36-month contract. The price sets the deal's Total Contract Value (TCV). How the client pays (monthly OPEX, or hardware upfront on a CAPEX budget) changes when cash arrives, never what the deal is worth.

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

## 3. Configurable parameters (admin settings, never hard-coded)

| Parameter | Value | Notes |
|---|---|---|
| `HW_COST[product]` | from the TMS catalog | Hardware cost per unit, one-off |
| `HOSTING_MONTHLY[product]` | from the TMS catalog | Hosting cost per unit per month |
| `TERMS` | 12, 24, 36, 48, 60, 72, 84, 96, 108, 120 months | The terms offered. `steps_above` counts positions in this list. This is the default; the live setting is an admin's to change |
| `ANCHOR_TERM` | 36 months | The list-price term |
| `ANCHOR_MARGIN[product]` | 90% each product | Margin on price at the anchor term, per product |
| `SHORT_TERM_MARGIN[product]` | 90% each product | Margin on price for terms below the anchor, per product |
| `PROFIT_STEP` | 0.00 USD per unit per term step | Extra profit per step above 36 months. 0 = level profit |
| `VOLUME_BANDS` | see 3.1 | Banded discount on the monthly fee |
| `HW_UPFRONT_MARGIN` | 20% | Margin on the hardware price in the CAPEX option. 0 = at cost |
| `MARGIN_FLOOR` | 25% | Whole-deal margin below this shows a flag; it never refuses |
| `CURRENCY` | USD | |

**Every margin in this spec is margin on price:** margin = profit ÷ price. Price from a margin: price = cost ÷ (1 − margin).

### 3.1 Volume bands (banded, like tax bands)

| Units of a product in the band | Discount on those units' monthly fee |
|---|---|
| 1 to 9 | 0% |
| 10 to 49 | 5% |
| 50 to 199 | 10% |
| 200 and above | 15% |

Bands count units **per product line**. A 60-unit SafeSight line prices units 1 to 9 at 0%, 10 to 49 at 5% and 50 to 60 at 10%.

## 4. Calculation rules (per product line)

### 4.1 The list fee per unit (full precision)

```
cost(T)        = HW_COST + HOSTING_MONTHLY × T
anchor_profit  = cost(ANCHOR_TERM) × ANCHOR_MARGIN[product] / (1 − ANCHOR_MARGIN[product])

price(T) = cost(T) / (1 − SHORT_TERM_MARGIN[product])                if T < ANCHOR_TERM
price(T) = cost(T) + anchor_profit + PROFIT_STEP × steps_above(T)    if T ≥ ANCHOR_TERM

list_fee(T)    = price(T) / T
saving_vs_36   = 1 − list_fee(T) / list_fee(ANCHOR_TERM)      (display only; negative means a premium)
```

`steps_above(T)` is the position of T in `TERMS` above 36 (48 → 1, 60 → 2, … 108 → 6, 120 → 7 with the default `TERMS`).

Every line uses its own product's `HW_COST`, `HOSTING_MONTHLY`, `ANCHOR_MARGIN[product]` and `SHORT_TERM_MARGIN[product]`.

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

### 4.5 Per camera, OPEX (v1.5)

The term ladder shows, under `opex`, what one SafeSight camera costs the client per month at each term:

```
per_camera(T) = round_half_up( safesight_monthly_total(T) / units[SafeSight], 2 )
safesight_monthly_total(T) = Σ SafeSight bands ( units_in_band × band_fee(T, band) )     (year 1, after the banded volume discount)
```

Shown as "-" when `units[SafeSight]` is 0. Display only: it is never invoiced and never feeds TCV, so it may differ from any band fee by the banding average.

**Under `capex` (v1.6, C-10):** the ladder shows the term and this OPEX per-camera fee only, the same figure as under `opex` (T31 unchanged). There is no per-camera CAPEX figure anywhere: CAPEX is one deal-level payment. The ladder prices every term as OPEX, Base, no CPI, so a CAPEX amount or schedule that suits one term cannot refuse the ladder. SUPERSEDED, left visible: v1.5 read "Under `capex` the column is not shown (not yet decided; section 13)."

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

Refused unless the shares total exactly 100%, no milestone appears twice, and the months never decrease down the rows. A milestone in month `m` ≥ 1 adds to that month's invoice; month 0 is its own invoice. The milestone names are the shared milestone vocabulary, also used by Commercials (names only, no pricing logic); the calculator treats a milestone as an opaque key and checks only that no key repeats.

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

The TMS prototype maps `capex` onto its existing two-phase and hybrid payment structures. PO factoring stays in the cash flow (section 9).

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

## 9. Cash flow

The quote shows monthly receipts (net, by payment structure) against costs (hardware at deployment, hosting monthly), cumulative position, and month of payback. PO factoring, when switched on, shows its cost and its effect on timing. **Margin is reported before and after finance cost.**

**Cash in year 1 (v1.6, Q10):** the net invoices of months 0 to 12, before GST and WHT, on the schedule displayed (the Final schedule). Under `capex` it is shown against the OPEX figure for the same deal and CPI, the OPEX net invoices of months 1 to 12.

## 10. Reference tables (the implementation must reproduce these exactly)

Reference product SafeSight: `HW_COST` 8,000.00, `HOSTING_MONTHLY` 200.00. Parameters as in section 3.

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
| 12 | 8,666.67 | 8,233.33 | 7,800.00 | 7,366.67 |
| 24 | 5,333.33 | 5,066.67 | 4,800.00 | 4,533.33 |
| 36 | 4,222.22 | 4,011.11 | 3,800.00 | 3,588.89 |
| 48 | 3,216.67 | 3,055.83 | 2,895.00 | 2,734.17 |
| 60 | 2,613.33 | 2,482.67 | 2,352.00 | 2,221.33 |
| 72 | 2,211.11 | 2,100.56 | 1,990.00 | 1,879.44 |
| 84 | 1,923.81 | 1,827.62 | 1,731.43 | 1,635.24 |
| 96 | 1,708.33 | 1,622.92 | 1,537.50 | 1,452.08 |
| 108 | 1,540.74 | 1,463.70 | 1,386.67 | 1,309.63 |
| 120 | 1,406.67 | 1,336.33 | 1,266.00 | 1,195.67 |

### 10.3 Worst-case margin (every unit at that band's fee)

| Term | 0% | 5% | 10% | 15% |
|---|---|---|---|---|
| 36 | 90.0% | 89.5% | 88.9% | 88.2% |
| 60 | 87.2% | 86.6% | 85.8% | 85.0% |
| 84 | 84.7% | 83.8% | 82.9% | 81.9% |
| 120 | 81.0% | 80.0% | 78.9% | 77.7% |

## 11. Test cases (must pass)

SafeSight at the reference costs unless stated. `TEST-B` is a **test fixture, not a real product**: `HW_COST` 2,000.00, `HOSTING_MONTHLY` 50.00.

| # | Inputs | Expected | Why |
|---|---|---|---|
| T1 | 1 unit, 36 | TCV 151,999.92, margin 90.0% | Base case |
| T2 | 9 units, 36 | TCV 1,367,999.28 | Top of band 1 |
| T3 | 10 units, 36 | TCV 1,512,399.24, margin 89.9% | First unit in band 2 |
| T4 | 49 units, 60 | TCV 7,369,606.20 | Top of band 2 |
| T5 | 50 units, 60 | TCV 7,510,726.20 | Band 3; MORE than T4 (no cliff) |
| T6 | 120 units, 60 | TCV 17,389,126.20, margin 86.2% | Demo-sized deal |
| T7 | 199 units, 84 | TCV 29,411,221.56 | Top of band 3 |
| T8 | 200 units, 84 | TCV 29,548,581.72 | Band 4; MORE than T7 (no cliff) |
| T9 | 250 units, 120 | TCV 38,039,088.00, margin 79.0% | Largest, lowest-margin case |
| T10 | 1 unit, 12 | TCV 104,000.04 | Shortest term |
| T11 | 5 units, 24 | TCV 639,999.60 | Two-year term |
| T12 | TEST-B 1 unit, 36 | TCV 38,000.16, monthly fee 1,055.56 | Second cost mix |
| T13 | TEST-B 30 units, 60 | TCV 1,134,842.40, margin 86.8% | Second product, banded |
| T14 | T6 + T13 on one deal | TCV 18,523,968.60 | Multi-product: lines add, bands count per line |
| T15 | T6 as `capex` | upfront 1,200,000.00 + 269,818.77 × 60 = 17,389,126.20 | CAPEX split ties to TCV |
| T16 | 1 unit, 60, CPI `published` 3% (S 2) | Base TCV 156,799.80, margin 87.2%. Final TCV (projected) 166,494.36; year fees 2,613.33 / 2,691.73 / 2,772.48 / 2,855.66 / 2,941.33. Deal value 156,799.80 | Escalator; Base and Final (v1.6) |
| T17 | 1 unit, 18 months | error | Term not offered |
| T18 | all units 0 | error | No units |
| T19 | T6 with `MARGIN_FLOOR` 90% | flag shown, quote still prices | Floor flags, never refuses |
| T20 | T6, WHT 10%, gross-up ON | monthly invoice 322,020.86; WHT 32,202.09; Terminus receives 289,818.77 (= T6 monthly total) | Gross-up |
| T21 | T6, WHT 10%, gross-up OFF | monthly invoice 289,818.77; WHT 28,981.88 borne; Terminus receives 260,836.89 | WHT borne |
| T22 | T6 as `capex` (Hardware, Hybrid default), CPI `locked` 3% (S 2) | CAPEX 1,200,000.00 month 0. Subscription by year 269,818.77 / 277,913.33 / 286,250.73 / 294,838.26 / 303,683.40 (month 60 = 303,683.40, no residue). Base TCV 17,389,126.20, margin 86.2%. Final TCV 18,390,053.88 = deal value | CAPEX subscription escalates; CAPEX does not (v1.6) |
| T23 | SafeSight 120 + AQ 30, 60 months; AQ at the catalog's `HW_COST` 2,000.00 and `HOSTING_MONTHLY` 100.00 | AQ band fees 973.33 (1 to 9) and 924.67 (10 to 49); AQ line 1,690,682.40; deal TCV 19,079,808.60; cost 2,640,000.00; margin on price 86.2% | Multi-product on real catalog costs (T14 on the screen) |
| T24 | T6 as `capex`, `wht_split` on, hardware 5%, service 10%, gross-up OFF | WHT on upfront 60,000.00, Terminus receives 1,140,000.00; WHT per service invoice 26,981.88, Terminus receives 242,836.89; total WHT borne 1,678,912.80 | Split WHT, CAPEX |
| T25 | T6 as `opex`, `wht_split` on, hardware 5%, service 10%, gross-up ON, GST 0 | hardware line 20,000.00 → invoice 21,052.63, WHT 1,052.63, receives 20,000.00; service line 269,818.77 → invoice 299,798.63, WHT 29,979.86, receives 269,818.77; invoice total 320,851.26 | Split WHT, OPEX two lines |
| T26 | 1 unit, 108 | TCV 166,399.92; margin 82.2% | The ten-year ladder's new term |
| T27 | 1 unit, 60, CPI `locked` 3% from year 3 | Base TCV 156,799.80, margin 87.2%. Final TCV 162,558.36; year fees 2,613.33 / 2,613.33 / 2,691.73 / 2,772.48 / 2,855.66. Deal value 162,558.36 | Escalator start year; Locked (v1.6) |
| T28 | T6 as `capex` (Hardware, Hybrid default), CPI `published` 3% from year 3 | CAPEX 1,200,000.00. Subscription by year 269,818.77 / 269,818.77 / 277,913.33 / 286,250.73 / 294,838.26. Base TCV 17,389,126.20. Final TCV (projected) 17,983,678.32. Deal value 17,389,126.20 | CAPEX with a later CPI start; Published (v1.6) |
| T29 | SafeSight 120 + AQ 40 + HEMIR 2, 60 months, `opex`, no escalator | SafeSight TCV 17,389,126.20, cost 2,400,000.00, profit 14,989,126.20, 86.2%; AQ 2,245,484.40, 320,000.00, 1,925,484.40, 85.7%; HEMIR 2,384,000.40, 260,000.00, 2,124,000.40, 89.1%; deal 22,018,611.00, 2,980,000.00, 19,038,611.00, 86.5% | Per-product totals sum to the deal |
| T30 | the same units, 60 months, `capex` (Hardware, Hybrid Contract start m0 100%), CPI `locked` 3% (S 2), single WHT 10% borne | **Base, per product:** SafeSight 17,389,126.20, 86.2%; AQ 2,245,484.40, 85.7%; HEMIR 2,384,000.40, 89.1%. Deal Base TCV 22,018,611.00; gross profit 19,038,611.00, 86.5%. **Base schedule:** WHT 2,201,860.98; profit after WHT 16,836,750.02, 76.5%. **Final schedule:** CAPEX 1,550,000.00 m0; subscription 341,143.52 (months 1..12), 351,377.83 (13..24), 361,919.16 (25..36), 372,776.74 (37..48), 383,960.04 (49..59), 383,959.81 (month 60). Final TCV 23,284,127.25 = deal value (CPI uplift 1,265,516.25). WHT on Final invoices 2,328,412.62. Month 0: WHT 155,000.00, receives 1,395,000.00. Year-1 subscription invoice: WHT 34,114.35, receives 307,029.17. **With GST 9%:** Final GST 2,095,571.38, TCV incl. GST 25,379,698.63 (Base schedule: GST 1,981,675.18, incl 24,000,286.18) | Per product on Base; Final deal-level only; WHT whole-deal only (v1.6) |
| T31 | SafeSight 120 + AQ 40 + HEMIR 2, `opex`, catalog costs: per camera at every term (section 4.5) | 12: 8,009.44; 24: 4,928.89; 36: 3,902.04; 48: 2,972.74; 60: 2,415.16; 72: 2,043.44; 84: 1,777.92; 96: 1,578.79; 108: 1,423.90; 120: 1,299.99 | Per camera divides the SafeSight line only; AQ and HEMIR do not move it |

Also test: changing any parameter (for example `ANCHOR_MARGIN` to 80%, or `PROFIT_STEP` to 1,000.00) flows through with no code change.

**Unchanged by v1.6:** T14, T15 (CAPEX 1,200,000.00; subscription 269,818.77 months 1..60, no residue; TCV 17,389,126.20), T24, T25, T31, and the flow case `HW_UPFRONT_MARGIN` 0 (CAPEX 960,000.00; subscription 273,818.77). v1.4's "a product TCV is the same under `opex` and `capex`" is restated on Base TCV, where it holds; Final TCV is deal-level.

### 11.1 CAPEX payment cases (v1.6)

The demo deal: SafeSight 120 + AQ 40 + HEMIR 2, 60 months, the settings of section 3 (SafeSight 8,000 / 200; AQ 2,000 / 100; HEMIR 100,000 / 500; anchor margin 90%; `HW_UPFRONT_MARGIN` 20%). No CPI unless stated. Base TCV 22,018,611.00 in every case.

| # | Inputs | Expected | Why |
|---|---|---|---|
| G-C1 | `capex`, Hardware, Hybrid default (Contract start, month 0, 100%) | CAPEX 1,550,000.00. Subscription 341,143.52 months 1..59, 341,143.32 month 60. Final TCV 22,018,611.00. Deal value = Base TCV. Cash in year 1 5,643,722.24 (OPEX year 1: 4,403,722.20) | The default |
| G-C2 | `capex`, Custom 1,000,000.00, Hybrid: Contract start m0 30%; Hardware delivered to site m3 40%; Commissioning m6 30% | Milestones 300,000.00 / 400,000.00 / 300,000.00. Subscription 350,310.18 months 1..59, 350,310.38 month 60. Invoices: m0 300,000.00; m3 750,310.18; m6 650,310.18. Warning (a): Terminus funds 240,000.00. Cash in year 1 5,203,722.16 | Custom amount; milestones add to their month's invoice |
| G-C3 | `capex`, Hardware, Two-phase, R = 12 | Instalment 129,166.67 months 1..11, 129,166.63 month 12. Invoices 470,310.19 months 1..11, 470,310.15 month 12, 341,143.52 months 13..59, 341,143.32 month 60. Cash in year 1 5,643,722.24 | Two-phase; the last instalment carries the rounding |
| G-C4 | refusals | CAPEX 0; CAPEX = Base TCV; shares totalling 99.9% and 100.1%; a duplicate milestone; a month > T; months decreasing; R = 0; R > T | Each refused |
| G-C5 | G-C1 with CPI `locked` 3% (S 2), no WHT | As T30's Final schedule. Final TCV 23,284,127.25 | CPI on the subscription only |
| G-C6 | `capex`, Custom 2,000,000.00, Hybrid Contract start m0 100%, split WHT 5% hardware / 10% SaaS, gross-up OFF, GST 0, no CPI | Month 0 invoice: hardware line 1,550,000.00, WHT 77,500.00; SaaS line 450,000.00, WHT 45,000.00; WHT 122,500.00, receives 1,877,500.00. Subscription 333,643.52 months 1..59, 333,643.32 month 60; WHT 33,364.35 each, 33,364.33 month 60. Total WHT 2,124,360.98. Warning (a) does not fire | Split WHT straddling the hardware value |
| L1 | 1 unit, 60, `opex`, CPI `published` 3% from year 3, split WHT 5% / 10%, gross-up ON, GST 9% | Final schedule: TCV 162,558.36; gross-up 17,477.04; GST 16,203.36; incl. GST 196,238.76. Base schedule: TCV 156,799.80; gross-up 16,837.20; GST 15,627.60; incl. GST 189,264.60 | The tax tie holds on each schedule |

### 11.2 Superseded figures (v1.5), left visible

| # | v1.5 inputs | v1.5 expected |
|---|---|---|
| T16 | 1 unit, 60, escalator 3% | year fees 2,613.33 / 2,691.73 / 2,772.48 / 2,855.66 / 2,941.33; TCV 166,494.36; margin 88.0% |
| T22 | T6 as `capex` with escalator 3% | TCV 18,464,248.32; upfront 1,200,000.00; service fees by year 270,983.34 / 279,112.84 / 287,486.23 / 296,110.81 / 304,994.14; upfront + Σ = TCV |
| T27 | 1 unit, 60, escalator 3% from year 3 | year fees 2,613.33 / 2,613.33 / 2,691.73 / 2,772.48 / 2,855.66; TCV 162,558.36; margin 87.7% |
| T28 | T6 as `capex`, escalator 3% from year 3 | TCV 18,027,745.92; upfront 1,200,000.00; service fees by year 270,527.21 / 270,527.21 / 278,643.03 / 287,002.32 / 295,612.39; upfront + Σ = TCV |
| T30 | the same units, 60 months, `capex`, escalator 3% from year 2, WHT 10% borne | SafeSight TCV 18,464,248.32, 87.0%; AQ 2,384,313.00, 86.6%; HEMIR 2,531,396.40, 89.7%; deal TCV 23,379,957.72, gross profit 20,399,957.72, 87.3%; upfront 1,550,000.04; service fees by year 342,647.69 / 352,927.12 / 363,514.94 / 374,420.39 / 385,653.00; WHT borne 2,337,995.72; gross profit after WHT 18,061,962.00, 77.3% |

## 12. Implementing in the TMS prototype

- Built through the TMS round method, as a standalone Term Pricing screen first. It does not touch the existing Commercials engine or its golden deals.
- CLAUDE.md carries a scoped rule: "The term pricing calculator follows docs/pricing-spec.md exactly: no hard-coded parameters, no floats for money. This rule does not govern the deal-sheet engine."
- Sections 10 and 11 become the calculator's golden figures, copied from this spec, never computed by the code under test.

## 13. Not yet decided

| Item | Current position |
|---|---|
| Market level of the 90% anchor margin | To be tuned to market (John, 1 Oct 2026) |
| Upgrade credit (short term extended to 36+ reprices from day one) | Recommended; not in v1.2 |
| Early-termination charge (reprice to the term actually served) | Recommended; not in v1.2 |
| Installation | Excluded; must be recovered in full on 12- and 24-month terms when added |
| Warranty | Excluded for now |
| Cost escalation | Costs held flat |
| ~~Per-camera columns under `capex` (hardware per camera, service fee per camera)~~ | **CLOSED (v1.6, C-10, Q12):** no per-camera CAPEX figure anywhere; under `capex` the ladder shows the term and the OPEX per-camera fee only (section 4.5) |
| Linking a quote to an opportunity's TCV | After the demo, with a "one deal, one price" rule |
| A split OPEX invoice whose service line would fall below zero (the hardware line exceeds the month's fee, possible only with unusual admin margins) | The quote refuses with a clear error rather than invoice a negative line (implementation position, TERM_PRICING_2) |
