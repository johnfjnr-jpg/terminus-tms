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

## 2. Opportunity and Deal cost: NOT yet reconciled with source

The Opportunity path is a different calculation with a different rate source,
and it has **not** been brought into line with the deal sheet.

What it does today:

```
Hardware  =  SUM over type of ( units x unitCost )  +  warranty
Install   =  a lump sum, OR four per-unit lines (SafeSight split
             existing / new), OR a single zero line when installation
             is by others
Hosting   =  ( hoSafesight x safesightUnits + hoAqm x aqm
               + hoHemir x hemir )  x  months
Total     =  Hardware + Install + Hosting
             + financing + withholding borne + carried Test Bed cost
```

Rates come from the admin Base Cost catalog via `catalogToRates` and
`resolveRates`, not from hand-typed record fields.

### Proven divergences from the deal sheet

**`OPPORTUNITY_CALC_DIVERGENCES.md` IS THE AUTHORITY ON THESE AND THIS TABLE IS
A SUMMARY OF IT.** Two documents stating the same six facts is the second-reader
shape this estate has been caught by before (CLAUDE.md Verification 20), so the
worked examples, the numbers and the readings live in one place and this table
points at it. If the two disagree, that file is right and this one is stale.

Measured, not inferred. These need John's rulings before any are changed.

| # | deal sheet says | the code does | measured effect |
|---|---|---|---|
| S1 | warranty units are computed **per type**, `ceil(unitsOfThatType x pct)` | one `ceil` over the whole mix | on 2 SafeSight plus 2 AQ at 2%: source 2 units, code 1 |
| S2 | each warranty unit is valued at **its own type's unit cost** | valued at the **mix average** across all products | same case: source **$9,000**, code **$4,500**. The code understates by 100% |
| S3 | contract term is in **years**, floored at 1, multiplied by 12 | `duration` is used directly as **months**, no floor | a term of 1 means 12 months in the source and 1 month in the code |
| S4 | camera **total** is the input and new is derived, `new = total - existing` | existing and new are both inputs and units is their sum | different data model; the source also has a mismatch guard the code has no equivalent for |
| S5 | margin is clamped to `[0, 99.9]` and the price is **not** rounded | clamped to a `99` ceiling with no lower clamp, and the price **is** rounded | a negative margin behaves differently, and prices differ by rounding |
| S6 | two product types, camera and sensor | three, SafeSight, AQ and HEMIR | HEMIR post-dates the source. By extension its warranty is per type |

S2 is the sharpest: `DESIGN_PRINCIPLES.md:2325` already recorded the mix-average
treatment as a live concern once real rates arrived, and **the deal sheet
resolves it**. The source values warranty per type, which is what that entry
said the mix average gets wrong.

### What still has no answer

Whether `totalDealCostAll` should fold in financing, withholding borne and the
carried Test Bed cost is not settled by the deal sheet, which computes a
factoring schedule but reaches its own totals differently.

---

## 3. Everything else that computes cost

| site | status |
|---|---|
| `calculateHardwareAndWarranty` (`deal-calculator.js:107`) | runs as written. S1 and S2 apply |
| `buildCostGroup` (`:83`) | correct. Sums line costs |
| `priceFromCost` (`:66`) | S5 applies |
| `calculateContractTotals` (`:130`) | agrees with source on shape |
| `calculateDeal` (`:416`) | see section 2 |
| `buildCashFlowModel` (`:183`) | **not yet checked against source** |
| `calculateTax` (`:149`) | **not yet checked against source** |
| `buildLoanSchedule` (`:32`) | **not yet checked against source** |
| `catalogToRates`, `resolveRates` | correct per product. See `COST_CALC_AUDIT.md` F4 |
| `costBreakdown.ts`, `CostBreakdownCards.tsx`, `section4.tsx`, `approval-page.js` | display only, zero arithmetic, verified |

---

## 4. How to check a change against this document

1. **Run the contract test.** `node --test scripts/tests/test-bed-cost-contract.test.mjs`
   pins the acceptance case and the structural rules in section 1. It fails if
   Hardware, Install, Hosting or Total moves, if a warranty appears on a Test
   Bed, or if a price figure reaches the Test Bed path.
2. **Read the deal sheet, not the neighbouring code.** Derive the expected
   figures from `old - terminus-deal-sheet.html` and compare. A formula copied
   from an adjacent function reproduces that function's drift.
3. **Feed the acceptance case through the real production mapping**, not
   through the engine directly. The mapping is where the per-unit
   multiplication and the warranty zeroing live.
4. **Express the expectation, never restate it.** `2 x 8000 + 2 x 2000 + 2 x 200 x 6`
   beats `22400`. A hand-computed total is a second reader of the calculation
   and has been caught wrong in this estate before.
