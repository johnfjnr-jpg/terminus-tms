# Cost calculations

**The standing reference for how this system computes cost.** Written
2026-09-16 after an audit found that no document in the estate stated any cost
formula, and the only executable statement of the Test Bed arithmetic was a
test file.

This document exists so cost logic is never re-derived from nothing again. A
change to any cost calculation is checked against this document, and against
the source it cites, before it is built.

## Where authority lives

| | |
|---|---|
| **Source of truth** | `old - terminus-deal-sheet.html`, `computeModel()` at line 512. The cost logic is lines 530 to 556. |
| **Integration spec** | `old-terminus-deal-sheet-spec.md` |
| **This document** | what the code computes today, and where it agrees or disagrees with that source |
| **The audit** | `COST_CALC_AUDIT.md`, the measurement this document was written from |

The deal sheet is John's own calculator and it outranks the codebase. Where
the code and the deal sheet disagree, **the deal sheet is right and the code
is a finding**, not the other way round. The in-repo Claude Design prototype
(`Terminus Ops.dc.html`) is evidence about what was once built and is not a
source of truth for arithmetic.

---

## 1. Test Bed cost, and this is VERIFIED against source

A Test Bed is Terminus-funded research and development. It is **cost only**:
there is no price, no margin and no client billing anywhere on this path.

### The formula

Three product types, computed the same way for each: **SafeSight**,
**AQ Sensor**, **HEMIR**.

```
Hardware  =  SUM over type of ( units_type  x  unitCost_type )

Install   =  SUM over type of ( units_type  x  installCost_type )

Hosting   =  SUM over type of ( units_type  x  hostingCost_type )  x  durationMonths

Total     =  Hardware  +  Install  +  Hosting
```

Every rate is **per unit**. The install rate is per unit, one off. The hosting
rate is per unit per month, and is multiplied by the duration to reach the
term figure.

### Rules that are part of the formula

1. **NO WARRANTY.** A Test Bed carries no customer warranty commitment, so the
   warranty provision is zero. It is neutralised **by data**, not by a separate
   code path: `buildTestBedCostBreakdown` passes `warrantyPct: 0` explicitly
   into the shared engine. A `warrantyPct` sitting in a record payload is not
   read. Verified: a payload carrying `warrantyPct: 10` still produces a zero
   warranty and an unchanged total.

   An explicit `0` is required and removing the field would not achieve it.
   Two independent defaults of `2` exist, one in the route and one as the
   engine's own parameter default, and either silently reinstates a warranty
   when the key is absent.

2. **RATES ARE HAND-TYPED ON THE RECORD.** Test Bed rates are ordinary payload
   fields edited on the record: `ssUnitCost`, `aqUnitCost`, `hemirUnitCost`,
   `ssInstallCost`, `aqInstallCost`, `hemirInstallCost`, `ssHostingCost`,
   `aqHostingCost`, `hemirHostingCost`. They do **not** come from the admin
   Base Cost catalog, which is the Opportunity's source. This is deliberate.

3. **DURATION IS IN MONTHS**, from `testBedDuration`. A duration of zero means
   zero hosting cost. That is correct behaviour and the remedy is to enter a
   duration; it is not a defect.

4. **UNIT COUNTS** are `safesightCameras`, `airQualitySensors`, `hemirSensors`.

5. **NO PRICE FIELD IS EVER READ.** The shared `buildCostGroup` computes a
   `rawPrice` internally because it is shared with the priced Opportunity path.
   Nothing on the Test Bed path reads it. Only `rawCost`, `rawTotalCost` and
   `totalCost` are read.

6. **INSTALL IS THREE LINES, NOT FOUR.** The Opportunity splits SafeSight
   installation into existing and new infrastructure. Test Bed unit counts
   never carried that distinction, so three lines is the correct shape for this
   record type rather than a simplification.

### The acceptance case

**This is the case a change must still pass.** Set by John, 2026-09-16.

> 2 SafeSight units, unit cost $8,000, install cost $2,000, hosting cost $200
> per month, duration 6 months.

| component | required |
|---|---|
| Hardware | **$16,000** |
| Install | **$4,000** |
| Hosting | **$2,400** |
| **Total** | **$22,400** |

Worked: hardware `2 x 8,000 = 16,000`. Install `2 x 2,000 = 4,000`. Hosting
`2 x 200 = 400` per month, `400 x 6 = 2,400`. Total
`16,000 + 4,000 + 2,400 = 22,400`.

**Any calculation not producing this is wrong.**

### Verified against the deal sheet

The same case run through the deal sheet's own `computeModel()` cost lines,
transcribed verbatim with only the DOM reads replaced by parameters:

```
units only      16,000     matches
install total    4,000     matches
hosting x term   2,400     matches
TOTAL COST      22,400     matches
```

**One presentational difference, and it is not an arithmetic one.** The deal
sheet groups units, install and warranty together into a single
`hardwareCostPool` ($20,000 on this case). This system reports Hardware and
Install as separate figures. The **sum is identical**; only the grouping on
screen differs. Test Bed reports them separately because a go/no-go decision
wants to see installation cost on its own.

**One deliberate departure.** The deal sheet's contract term is entered in
**years** and floored at one (`termYears = max(1, round(term))`,
`termMonths = termYears x 12`), so it cannot express a six-month term at all.
A Test Bed is short by nature, so `testBedDuration` is in **months** with no
floor. This is why the Test Bed has its own duration field rather than reusing
the deal sheet's term.

### Where it is implemented

| | |
|---|---|
| Engine | `src/lib/deal-calculator.js:376` `calculateTestBedCost` |
| Mapping | `src/routes/test-beds.js:24` `buildTestBedCostBreakdown` |
| Enforced by | `scripts/tests/test-bed-cost-contract.test.mjs` |

`buildTestBedCostBreakdown` is the single mapping point. `GET /test-beds/:id`,
the `PATCH` that maintains `accumulated_cost`, and
`POST /test-beds/calculate` all run through it, so a preview and a save agree
by construction rather than by agreement.

**There is exactly one cost engine.** The browser adds nothing up: it sends
draft values and renders what comes back. Verified by a comment-stripped scan
of the display layer finding zero arithmetic-bearing lines.

---

## 2. Opportunity and Deal cost, RULED BY JOHN 2026-09-16

The Opportunity is a **priced** deal: it has a customer, a margin and a
contract. Everything below was ruled by John after the codebase was measured
against the deal sheet, and it **supersedes the deal sheet wherever the two
disagree**, because the deal sheet predates HEMIR and predates the move to a
term in months.

### The formula

Three product types throughout: **SafeSight**, **AQ Sensor**, **HEMIR**.

```
HARDWARE      SafeSight   total units   x  SafeSight unit cost
              AQ Sensor   units         x  AQ unit cost
              HEMIR       units         x  HEMIR unit cost

INSTALLATION  SafeSight   existing      x  existing-infrastructure rate
                        + new           x  new-infrastructure rate
                          where new = SafeSight total - existing
              AQ Sensor   units         x  AQ install rate
              HEMIR       units         x  HEMIR install rate

WARRANTY      count = ceil( SafeSight units x warranty % )
              cost  = count x ( SafeSight unit cost + existing-infra rate )

HOSTING       SUM over type of ( units x hosting rate )  x  durationMonths

TOTAL COST    hardware + installation + warranty + hosting
```

### The rules that are part of it

1. **THE WARRANTY IS SAFESIGHT ONLY.** The count is a percentage of the
   SafeSight units, rounded **up** to a whole unit. AQ Sensors and HEMIRs on the
   same deal do not create a warranty unit and do not change what one is worth.
   A warranty provision is a spare SafeSight.

2. **A WARRANTY UNIT IS VALUED AT A UNIT PLUS ITS EXISTING-INFRASTRUCTURE
   INSTALL.** A spare goes where a unit already stands, so it carries the
   existing-infra install rate, never the new-infra one.

3. **THE WARRANTY CARRIES NO MARGIN.** It is a cost pass-through: it appears as
   its own P&L line on the deal sheet and reaches the customer's price at
   exactly what it cost. Margin applies to everything else. **A consequence
   worth stating: the achieved margin therefore lands BELOW the target**, and
   that is correct rather than a defect. On the worked deal below, a 30% target
   achieves 29.40%.

4. **NO WARRANTY ON A TEST BED, EVER.** Section 1 governs there and passes
   `warrantyPct: 0`. The two record types share one engine and differ by data.

5. **THE TERM IS IN MONTHS**, used directly, with no floor and no multiplying by
   twelve.

6. **THE TOOL CANNOT PRICE BELOW COST.** The margin is clamped to a floor of
   zero before the uplift, so a negative margin returns the cost rather than a
   discount. The upper clamp of 99 remains, and it is a guard against dividing
   by zero rather than a policy.

7. **RATES COME FROM THE ADMIN BASE COST CATALOG**, resolved by `resolveRates`,
   not hand-typed on the record. This is the opposite of the Test Bed and is
   deliberate.

### The acceptance cases

**A. Warranty.** 100 SafeSight at $8,000, existing-infra install $2,000,
warranty 2%: count `ceil(100 x 0.02) = 2`, cost `2 x (8,000 + 2,000)` =
**$20,000**. Adding 500 AQ and 500 HEMIR does not move either figure.

**B. Installation split.** SafeSight total 10, of which 3 existing so 7 new, at
$2,000 existing and $20,000 new; AQ 5 at $500; HEMIR 2 at $5,000:
`3 x 2,000 + 7 x 20,000 + 5 x 500 + 2 x 5,000` = **$158,500**.

**C. The full deal.** SafeSight 10 (3 existing, 7 new) at $8,000; AQ 5 at
$2,000; HEMIR 2 at $25,000; installs as B; hosting $200 / $100 / $500 per unit
per month; 12 months; target margin 30%; warranty 2%.

| | cost | price |
|---|---|---|
| Hardware, the three types | $140,000 | $200,001 |
| Warranty, 1 unit at $10,000 | $10,000 | **$10,000, at cost** |
| Installation | $158,500 | $226,428 |
| Hosting, $3,500 per month over 12 | $42,000 | $60,000 |
| **Total deal cost** | **$350,500** | |
| **Contract net** | | **$496,429** |
| **Achieved margin** | | **29.40%** |

### The six divergences, and how each was ruled

Measured in `OPPORTUNITY_CALC_DIVERGENCES.md`, which holds the worked numbers.

| # | ruling |
|---|---|
| S1 warranty count | **CODE WAS WRONG, FIXED.** The count is per the SafeSight total, not the mix. |
| S2 warranty valuation | **CODE WAS WRONG, FIXED.** Valued at a SafeSight unit plus existing-infra install, not the mix average. The largest gap measured: $9,000 against $4,500 on one case and $33,000 against $16,337 on another. |
| S3 contract term | **CODE WAS RIGHT, SOURCE IS STALE.** Months, direct. Recorded as a decision. |
| S4 SafeSight unit model | **CODE WAS RIGHT, SOURCE UNDOCUMENTED.** Total and existing, new is the remainder. The record holds existing and new and their sum IS the total, so the arithmetic already matched; what was missing was the decision written down. |
| S5 margin clamp | **FIXED as defence in depth.** A lower clamp of zero makes below-cost pricing impossible at the calculator. Measured before building: `targetMargin` and every `marginOverrides` key were already refused with a 400 at the only write path, so no negative margin could reach the engine through the API. This closes the branch for a future caller that does not go through that route. |
| S6 HEMIR | **CODE WAS RIGHT, SOURCE PREDATES IT.** HEMIR is a real third hardware type. Recorded as a decision. |

**What the S2 fix moved on live fixtures**, and it is the shape the old rule
produced: on a deal carrying one $100,000 HEMIR against 15 SafeSight at $8,000,
the mix average valued its single warranty unit at $15,000. A spare SafeSight
plus its install is $10,000. The $5,000 difference flowed through the cash
position and the factoring interest, and `DESIGN_PRINCIPLES.md:2325` predicted
exactly that distortion.

### Where it is implemented

| | |
|---|---|
| Warranty | `src/lib/deal-calculator.js:107` `calculateHardwareAndWarranty` |
| Margin clamp | `src/lib/deal-calculator.js:66` `priceFromCost` |
| Groups and totals | `calculateDeal` and `calculateContractTotals` |
| Rate to input mapping | `src/lib/deal-inputs.js:361` `buildDealInputs` |
| Enforced by | `scripts/tests/opportunity-cost-contract.test.mjs` |

### What still has no answer

Whether `totalDealCostAll` should fold in financing, withholding borne and the
carried Test Bed cost is not settled by the deal sheet or by these rulings.


## 3. Everything else that computes cost

| site | status |
|---|---|
| `calculateHardwareAndWarranty` (`deal-calculator.js:107`) | **rewritten to the ruled warranty model.** S1 and S2 closed |
| `buildCostGroup` (`:83`) | correct. Sums line costs |
| `priceFromCost` (`:66`) | **clamped at both ends.** S5 closed |
| `calculateContractTotals` (`:130`) | agrees with source on shape |
| `calculateDeal` (`:416`) | see section 2 |
| `buildCashFlowModel` (`:183`) | **not yet checked against source** |
| `calculateTax` (`:149`) | **not yet checked against source** |
| `buildLoanSchedule` (`:32`) | **not yet checked against source** |
| `catalogToRates`, `resolveRates` | correct per product. See `COST_CALC_AUDIT.md` F4 |
| `costBreakdown.ts`, `CostBreakdownCards.tsx`, `section4.tsx`, `approval-page.js` | display only, zero arithmetic, verified |

---

## 4. How to check a change against this document

1. **Run BOTH contract tests.** They are in the pure suite, so `npm test` runs
   them, and either can be run alone:

   ```
   node --test scripts/tests/test-bed-cost-contract.test.mjs
   node --test scripts/tests/opportunity-cost-contract.test.mjs
   ```

   The Test Bed one fails if Hardware, Install, Hosting or Total moves, if a
   warranty appears on a Test Bed, or if a price figure reaches that path. The
   Opportunity one fails if the warranty count stops being SafeSight-only, if a
   warranty unit stops being valued at a unit plus its existing-infra install,
   if the warranty starts taking margin, if the install split changes, if the
   term stops being months, or if any margin can price below cost. **Both were
   calibrated by injection, five and six faults respectively, each fired on its
   own named assertion and each reverted byte-identical.**
2. **Read the deal sheet, not the neighbouring code.** Derive the expected
   figures from `old - terminus-deal-sheet.html` and compare. A formula copied
   from an adjacent function reproduces that function's drift.
3. **Feed the acceptance case through the real production mapping**, not
   through the engine directly. The mapping is where the per-unit
   multiplication and the warranty zeroing live.
4. **Express the expectation, never restate it.** `2 x 8000 + 2 x 2000 + 2 x 200 x 6`
   beats `22400`. A hand-computed total is a second reader of the calculation
   and has been caught wrong in this estate before.
