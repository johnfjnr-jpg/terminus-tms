# Terminus Term Pricing: Specification v1.2.2

**Status:** Approved for prototype build (John, 1 Oct 2026). Margin levels to be tuned to market later.
**Supersedes:** v1.1 (1 Oct 2026) and v1.0 (Neil, 30 Sep 2026)
**Amended (v1.2.1, John, 1 Oct 2026):** TERMS as a parameter; anchor and short-term margins per product; tax rounding and WHT base; test cases T20 and T21. Every figure in sections 10 and 11 is unchanged.
**Amended (v1.2.2, John, 1 Oct 2026):** with an escalator, the CAPEX monthly service fee escalates like the OPEX fee and TCV stays identical to the OPEX TCV (section 6); test case T22. Every earlier figure is unchanged.

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
| `payment_structure` | choice | `opex` (monthly) or `capex` (hardware upfront, section 6) |
| `escalator_pct` | percent, optional | Blank or 0 means none (section 7) |
| `gst_pct` | percent | Per deal, 0 allowed (section 8) |
| `wht_pct`, `wht_gross_up` | percent, yes/no | Per deal (section 8) |

## 3. Configurable parameters (admin settings, never hard-coded)

| Parameter | Value | Notes |
|---|---|---|
| `HW_COST[product]` | from the TMS catalog | Hardware cost per unit, one-off |
| `HOSTING_MONTHLY[product]` | from the TMS catalog | Hosting cost per unit per month |
| `TERMS` | 12, 24, 36, 48, 60, 72, 84, 96, 120 months | The terms offered. `steps_above` counts positions in this list |
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

`steps_above(T)` is the position of T in `TERMS` above 36 (48 → 1, 60 → 2, … 120 → 6).

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

### 4.4 Margin floor

`gross_margin` below `MARGIN_FLOOR` shows a visible flag. The quote still prices.

## 5. Money handling

- Decimal or integer-cent arithmetic only. Never floating point.
- Round only invoiced and displayed figures, half-up, to 2 decimal places. Margins and savings display to 1 decimal place.
- Every quote shows its payment schedule, not just the total.

## 6. Payment structures (TCV never changes)

| Structure | What the client pays |
|---|---|
| `opex` | `monthly_total` every month for the term |
| `capex` | A hardware amount upfront, then a monthly service fee for the term |

**CAPEX split:**

```
hardware_upfront = Σ products ( units × HW_COST / (1 − HW_UPFRONT_MARGIN) )
monthly_service  = round_half_up( (TCV − hardware_upfront) / T, 2 )
upfront          = TCV − monthly_service × T          (carries any rounding residue)
```

Upfront + monthly service × term = TCV exactly. Terminus recovers its hardware cash on day one; the monthly service fee carries the remaining margin.

**CAPEX with an escalator (section 7):** the monthly service fee escalates like the OPEX fee, and TCV stays identical to the OPEX TCV.

```
s                = (TCV − hardware_upfront) / (12 × Σ_{k=1..years} (1 + escalator)^(k−1))
service_year(k)  = round_half_up( s × (1 + escalator)^(k−1), 2 )
upfront          = TCV − Σ_k ( 12 × service_year(k) )          (carries any rounding residue)
```

The TMS prototype maps `capex` onto its existing two-phase and hybrid payment structures. PO factoring stays in the cash flow (section 9).

## 7. Optional annual escalator

```
fee_year(k) = round_half_up( fee_year(1) × (1 + escalator_pct)^(k − 1), 2 )     per band, k = 1 … ceil(T/12)
TCV (net)   = Σ months ( fee for that month's contract year )
```

The client-facing saving always quotes year-1 fees. Costs are held flat in v1.2, so the escalator raises margin.

## 8. Tax

| Tax | Treatment |
|---|---|
| GST | Added on top of every invoice: invoiced = net × (1 + `gst_pct`). Never inside margin or TCV (net) |
| WHT | As the existing TMS gross-up toggle: with gross-up on, fees rise so that Terminus receives the net price after WHT; with it off, WHT reduces Terminus's receipts and shows as a cost |

Quotes show TCV net, GST, and TCV including GST separately.

Tax amounts round half-up to cents per invoice line. WHT applies to the fee before GST, never to the GST.

## 9. Cash flow

The quote shows monthly receipts (net, by payment structure) against costs (hardware at deployment, hosting monthly), cumulative position, and month of payback. PO factoring, when switched on, shows its cost and its effect on timing. **Margin is reported before and after finance cost.**

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
| T16 | 1 unit, 60, escalator 3% | year fees 2,613.33 / 2,691.73 / 2,772.48 / 2,855.66 / 2,941.33; TCV 166,494.36; margin 88.0% | Escalator |
| T17 | 1 unit, 18 months | error | Term not offered |
| T18 | all units 0 | error | No units |
| T19 | T6 with `MARGIN_FLOOR` 90% | flag shown, quote still prices | Floor flags, never refuses |
| T20 | T6, WHT 10%, gross-up ON | monthly invoice 322,020.86; WHT 32,202.09; Terminus receives 289,818.77 (= T6 monthly total) | Gross-up |
| T21 | T6, WHT 10%, gross-up OFF | monthly invoice 289,818.77; WHT 28,981.88 borne; Terminus receives 260,836.89 | WHT borne |
| T22 | T6 as `capex` with escalator 3% | TCV 18,464,248.32; upfront 1,200,000.00; service fees by year 270,983.34 / 279,112.84 / 287,486.23 / 296,110.81 / 304,994.14; upfront + Σ = TCV | CAPEX service fee escalates |

Also test: changing any parameter (for example `ANCHOR_MARGIN` to 80%, or `PROFIT_STEP` to 1,000.00) flows through with no code change.

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
| Linking a quote to an opportunity's TCV | After the demo, with a "one deal, one price" rule |
