# PER_CAMERA_AND_CAPEX_P0, Part B: the Commercials CAPEX structures, for Term Pricing

Report only. Nothing here is built. Every B1 statement was read from the code at
`b50a66a` (branch `per-camera`, base `fbf0cfe`) and is cited by file and line. B1
is code-read: nothing in it was executed for this report.

## B1. How Two-phase and Hybrid work today (deal-sheet code)

### What both structures share

- **The price never changes with the structure.**
  `contractNet = oneOffPrice + hostingMonthPrice × months`, where `oneOffPrice` is
  the hardware price plus the installation price
  (`src/lib/deal-calculator.js:244-247`). The structure decides only when cash
  arrives, in `buildCashFlowModel` (`deal-calculator.js:296`).
- **Which structures CAPEX offers.** Two-phase ("hardware recovery then hosting")
  and Hybrid ("milestone + hosting"), per John's ruling of 2026-09-26
  (`frontend-react/src/deal/section5.tsx:41`, `:53-54`). OPEX is the third,
  `single`.
- **A stored deal with no structure is read as Two-phase**
  (`src/lib/deal-inputs.js:701`).
- **Hosting is invoiced alongside, the same way under both.** Every month
  accrues `hostingMonthPrice` (`deal-calculator.js:437`). The invoicing input
  then groups the accruals:
  - **annual in advance:** each contract year's 12 accruals are billed in the
    year's first month;
  - **monthly:** billed as they accrue.

  It is `annualInvoicing` (`deal-calculator.js:440-450`), read from
  `payload.invoicing` with **annual as the reading when the field is absent**
  (`deal-inputs.js:711`).
- **Arithmetic is floating point.** Rounding happens only at display:
  - year buckets are `Math.round` (`frontend-react/src/deal/schedule.ts:19-24`);
  - milestone dollars are rounded to cents (`src/lib/milestone-schedule.js:82-87`);
  - tax is rounded to whole dollars on the whole contract
    (`deal-calculator.js:262-268`).

  **There is no residue rule anywhere.** No figure is forced to tie to the
  contract total.
- **WHT and GST are computed once on the whole contract net**
  (`deal-calculator.js:262-268`). They are not computed per invoice, and there
  is no hardware/SaaS split.

### Two-phase

- **Input:** `recoveryMonths`, a recovery period in whole months.
- **Default:** 12, from `system_defaults`
  (`supabase/migrations/20260830000001_system_defaults.sql:81`; live value read
  2026-10-10: 12).
  - It is written as an **initial value** when a deal is created as Two-phase
    (`src/lib/system-defaults.js:121-123`), or when it changes INTO Two-phase
    with the field absent (`system-defaults.js:189-196`).
  - It is not a read-time fallback. A blank stays blank, and the calculator
    gets `null` (`deal-inputs.js:710`, `deal-calculator.js:340-346`).
- **Limits enforced at save:** a non-negative whole number
  (`src/routes/opportunities.js:683-688`). That is the only check that runs.
- **Recovers:** the whole `oneOffPrice`, hardware AND installation, in equal
  monthly accruals of `oneOffPrice / recoveryMonths` for months 1 to R
  (`deal-calculator.js:431`, `:436`).
- **After month R:** hosting only.
- **No upfront invoice:** Two-phase has no month 0.

### Hybrid

- **Input:** up to 5 customer milestone rows (`milestone-schedule.js:42`;
  `frontend-react/src/deal/payload.ts:152`). Each row has:
  - a month (a non-negative whole number, `opportunities.js:818`);
  - a label;
  - a percentage (non-negative, at most 2 decimals).
- **No dollar figure is stored:** a stored `usd` is refused
  (`opportunities.js:803-830`).
- **A row counts only when month > 0 AND pct > 0** (`payload.ts:267`). The
  calculator applies the same filter (`deal-calculator.js:359-361`). **A
  month-0 milestone does not exist in Commercials today: it is dropped.**
- **Recovers:** each milestone is `round(pct% × oneOffPrice, cents)`
  (`milestone-schedule.js:82-87`), paid in its month (`deal-calculator.js:464-466`).
- **A recovery period has no meaning here** (Round 41 ruling,
  `deal-calculator.js:317-346`): `recov` is `null` under Hybrid.
- **Percentages that do not sum to 100% only WARN** (`customerScheduleWarning`,
  `frontend-react/src/deal/milestones.ts:168`, shown at `DealPanel.tsx:679`).
  The version route refuses only an unreconciled CONTRACTOR schedule
  (`src/routes/deal-sheet-versions.js:324-335`), never the customer one. So a
  Hybrid deal can collect more or less hardware cash than its price says, with
  a warning.

### PO factoring (both structures)

- **Principal:** hardware plus installation COST (`deal-calculator.js:384`,
  `:661`), advanced in month 1 (`:471`).
- **Repayment:** the loan schedule in `buildLoanSchedule`
  (`deal-calculator.js:37-62`), in months 2 to term + 1 (`:476`).
  - Method is straight or declining. When absent it is read as `'straight'`
    (`deal-inputs.js:721`).
  - Monthly rate: when absent it is read as **1.5%** (`deal-inputs.js:719`).
- **Term:** read, never substituted (`deal-calculator.js:363-381`). When
  factoring is switched on with no term, the initial value is written then
  (`system-defaults.js:233-240`):
  - under Two-phase, the recovery period;
  - otherwise, the admin default, 12 (`20260830000001_system_defaults.sql:82`).
- **Interest is a cost:** it is added to total cost and lowers achieved margin
  (`deal-calculator.js:672-676`).
- **If the facility is on and has no term,** the finance cost is `null` and the
  margin is flagged incomplete.

### Findings from the extraction (reported, not fixed; rule 10)

| # | Finding | Evidence |
|---|---|---|
| FB1 | **The recovery-period limits are not enforced anywhere live.** `validateRecoveryAgainstDuration` (recovery ≤ duration) and `recoveryState` (empty or zero blocks a version; under 12 warns) have **no caller outside tests**. A recovery longer than the contract accrues only through the last month, so hardware is under-collected with no message (the `m <= months` loop at `deal-calculator.js:435-437`). Code-read; not driven. | `git grep` for both names over `src/` and `frontend-react/src/`, tests excluded: definitions only (`system-defaults.js:323`, `:349`) |
| FB2 | `recoveryState` says it applies to "two-phase or hybrid" and would block a Hybrid version with no recovery period, while Round 41 ruled Hybrid has none. Inert today because of FB1, and live the day FB1 is wired. | `system-defaults.js:349-353` against `deal-calculator.js:317-346` |
| FB3 | The `factoringTermMonths` default's note reads "Hybrid factoring term. Two-phase follows the recovery period". The code applies the default to every structure except Two-phase, which includes `single`. | `20260830000001_system_defaults.sql:82` against `system-defaults.js:234-236` |

## B2. Proposed mapping of Term Pricing onto them

All of this is re-implemented in Term Pricing's own integer-cent arithmetic (B4).

**Unchanged by the mapping:**
- TCV, every product line, the SaaS monthly fee and its escalation (spec
  sections 4.3, 6 and 7);
- `hardware_upfront = Σ units × HW_COST / (1 − HW_UPFRONT_MARGIN)`.

**One quantity anchors both structures:**

```
H (the hardware amount) = TCV − Σ_k ( months_in_year(k) × service_year(k) )
```

This is exactly today's `upfront`: section 6's hardware amount plus the rounding
residue. Both structures share out H; neither re-derives it. That is what makes
T15, T22 and T30 reproduce by construction.

### Hybrid (Term Pricing)

- **Milestones:** up to the admin's row count, each with a month m ≥ 0 and a
  pct. Month 0 is the upfront invoice, which is Term Pricing's existing month 0.
  This **differs from Commercials**, which drops month 0 (B1).
- **The percentages must total exactly 100.00%, and the quote refuses
  otherwise.** This **differs from Commercials**, which only warns. A schedule
  that does not total 100% breaks the spec's tie rule (TCV is the invoices,
  exactly).
- **Amounts:**

  ```
  milestone_i = round_half_up( H × pct_i / 100, 2 )       for every row but the last
  last row    = H − Σ other rows                            (carries the residue, as the upfront does today)
  ```

  **Today's "hardware upfront" is one row: month 0, 100%.** Its amount is H, so:
  - T15 gives upfront 1,200,000.00 and service 269,818.77 × 60;
  - T22 gives upfront 1,200,000.00 and service fees by year 270,983.34 / 279,112.84 /
    287,486.23 / 296,110.81 / 304,994.14;
  - T30 gives upfront 1,550,000.04 and service fees by year 342,647.69 /
    352,927.12 / 363,514.94 / 374,420.39 / 385,653.00.

  All three are unchanged: no figure in them is recomputed.
- **Split-WHT lines:**
  - **Split on:** each milestone invoice is a hardware invoice at `wht_hw_pct`,
    and each monthly invoice is software as a service at `wht_saas_pct`. This is
    section 8.1's CAPEX row, read with n milestone invoices instead of one. T24
    reproduces with the single month-0 row.
  - **Split off:** every invoice at `wht_pct`.

### Two-phase (Term Pricing)

- **Input:** a recovery period R, a whole number with 1 ≤ R ≤ T. The quote
  refuses outside that range, unlike Commercials (FB1).
- **Hardware line:**

  ```
  hardware_line = round_half_up( H / R, 2 )     months 1 to R
  month 1's hardware line = H − (R − 1) × hardware_line     (carries the residue)
  ```

  - There is no month 0.
  - Months 1 to R invoice the hardware line plus that month's SaaS fee. Months
    R + 1 to T invoice the SaaS fee only.
  - **Illustration** (spec formulas, not the engine): T15 as Two-phase with
    R = 12 gives 100,000.00 hardware plus 269,818.77 SaaS in months 1 to 12,
    then 269,818.77.
  - **Position:** month 1 carries the residue, mirroring "the upfront carries
    it". The alternative is month R.
- **Split-WHT lines:**
  - **Split on:** months 1 to R carry **two lines**, hardware at `wht_hw_pct`
    and SaaS at `wht_saas_pct`. These are section 8.1's OPEX-split mechanics,
    with the hardware line being H / R instead of H / T. Months after R carry
    one SaaS line.
  - **Split off:** one line per invoice at `wht_pct`. That is the OPEX
    one-line rule, kept for the same reason: two lines at one rate can round a
    cent apart (T20).

### Commercials features this mapping does NOT carry over (named, not proposed; B4)

- **Installation in the hardware base.** Commercials recovers hardware plus
  installation. Term Pricing excludes installation (spec section 13).
- **Annual-in-advance invoicing.** Term Pricing invoices monthly only.
- **PO factoring.** Spec section 9 says factoring "stays in the cash flow".
  **Term Pricing has no cash flow built**: neither `term-pricing.js` nor the
  screen mentions factoring or payback.
  - If it is adopted, the Commercials shape maps one-to-one: hardware COST
    advanced in month 1; a straight or declining schedule at a monthly rate
    over a term; interest as a cost, so margin is reported before and after
    finance cost.
  - The term's initial value would be R under Two-phase and the admin default
    under Hybrid.
  - Separate scope. Not proposed here.

## B3. Proposed CAPEX per-camera columns for the ladder

Display only, never invoiced, the same footing as section 4.5's OPEX column.
SafeSight's own line, so AQ and HEMIR do not move it.

| Structure | Column | Definition |
|---|---|---|
| Hybrid | **Hardware / camera** (one-off) | `round_half_up( SafeSight units × HW_COST_ss / (1 − HW_UPFRONT_MARGIN) / SafeSight units, 2 )` = `HW_COST_ss / (1 − HW_UPFRONT_MARGIN)`. It is 10,000.00 at the spec's figures and is the same at every term. The residue is in H, not in any camera |
| Hybrid and Two-phase | **SaaS / camera / mo (year 1)** | SafeSight's share of the service fee: `s_ss = (product_TCV_ss − H_ss) / (12 × Σ factor(k))`, then `round_half_up( s_ss / SafeSight units, 2 )`. T15's 60-month row: 269,818.77 / 120 = 2,248.49 (half-up from 2,248.48975) |
| Two-phase | **Hardware / camera / mo (months 1 to R)** | `round_half_up( HW_COST_ss / (1 − HW_UPFRONT_MARGIN) / R, 2 )`, alongside the SaaS column. 833.33 at R = 12 |

With zero SafeSight units, every per-camera cell reads "-", as under OPEX.

## B4. Re-implement, never import (R-TP1)

- `scripts/tests/term-pricing-isolation.test.mjs` already enforces this in
  three ways:
  1. the engine imports nothing;
  2. an allowlist governs who may import it;
  3. no UI, database or network reference appears in its code.
- So none of `deal-calculator.js`, `milestone-schedule.js` or
  `system-defaults.js` may be reached from Term Pricing. Every rule above is
  restated in integer cents in `term-pricing.js`, with its own goldens copied
  from the spec.
- **Nothing beyond the mapping is proposed.** The items under "does NOT carry
  over" are named so a ruling can include or exclude them. They are not
  recommendations.

**Rulings this needs before a build:**
- the Two-phase residue month (1 or R);
- refusing versus warning on a Hybrid total that is not 100%;
- the CAPEX per-camera column set in B3.
