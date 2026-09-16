# Opportunity calculation: divergences from the deal-sheet source

**Verification read, 2026-09-16. NOTHING IS FIXED.** Same standing as the Test
Bed audit: measure first, rule second, fix third.

**Source of truth:** `old - terminus-deal-sheet.html`, committed at `c7f2f40`.
`computeModel()` begins at line 512; the cost logic is lines 530 to 556, and
`priceFromMargin()` is line 481. The deal sheet outranks the codebase. Where
they disagree the deal sheet is right and the code is a finding, unless John
rules the difference deliberate.

**Every number below was produced by running both sides**, the code through its
real modules and the source through a verbatim transcription of those lines with
only the `num("id")` DOM reads replaced by parameters. Nothing here is reasoned
from reading.

**Some of these are probably deliberate.** A judgement is offered on each one,
marked as such. It is a reading, not a ruling.

---

## S1. Warranty unit count

**Code:** one `ceil` over the whole mix.
`warrantyUnits = ceil(totalUnits x pct/100)`, `src/lib/deal-calculator.js:113`.

**Source:** a `ceil` **per product type**, then added.
`warrantyUnitsCamera = Math.ceil(totalCameras * warrantyPct)` and
`warrantyUnitsSensor = Math.ceil(sensors * warrantyPct)`, lines 533 and 534.

**Worked example.** 2 SafeSight and 2 AQ Sensor at 2%.

| | units |
|---|---|
| source | **2** (1 camera + 1 sensor) |
| code | **1** |
| gap | **1 unit** |

The code under-provisions because a single `ceil` over 4 units rounds 0.08 up to
one, where the source rounds each type's 0.04 up separately.

**Reading: this looks like drift, not a decision.** A warranty provision is a
spare unit of a specific product, and half a spare SafeSight is not a spare AQ
Sensor.

---

## S2. Warranty valuation. THE LARGEST GAP MEASURED

**Code:** every warranty unit is valued at the **mix average** cost.
`avgHwCost = hardwareCost / totalUnits`, then
`warrantyCost = round(warrantyUnits x avgHwCost)`,
`src/lib/deal-calculator.js:112-114`.

**Source:** each type's warranty units are valued at **that type's own unit
cost**.
`warrantyCost = warrantyUnitsCamera * cameraUnitCost + warrantyUnitsSensor * sensorUnitCost`,
line 535.

**Worked examples.**

| case | source | code | gap |
|---|---|---|---|
| 2 SafeSight at $8,000 + 2 AQ at $1,000, warranty 2% | **$9,000** | **$4,500** (avg $4,500) | **$4,500**, the code understates by 100% |
| 100 SafeSight at $8,000 + 1 AQ at $25,000, warranty 1% | **$33,000** | **$16,337** (avg $8,168.32) | **$16,663**, the code understates by 102% |

**This resolves a question the estate already had open.**
`DESIGN_PRINCIPLES.md:2325` recorded the mix-average treatment as a live problem
the moment real rates arrived, and worked the arithmetic on a 20-SafeSight plus
one HEMIR deal. **The deal sheet answers it: per type.**

**Reading: this is a bug.** It is the same fault that entry predicted, and the
source has always said otherwise.

---

## S3. Contract term units

**Code:** `duration` is used **directly as months**, with no floor. The panel
label says so: `Hosting price over ${months} months`,
`src/lib/deal-inputs.js:301`.

**Source:** the term is entered in **years**, rounded, **floored at one**, and
multiplied by twelve.
`termYears = Math.max(1, Math.round(num("term")))`, `termMonths = termYears * 12`,
lines 513 and 514.

**Worked example**, hosting at $400 per month.

| the figure entered | source | code | gap |
|---|---|---|---|
| 1 | 12 months, **$4,800** | 1 month, **$400** | **$4,400** |
| 3 | 36 months, **$14,400** | 3 months, **$1,200** | **$13,200** |
| 0 | 12 months, **$4,800** (floored) | 0 months, **$0** | **$4,800** |

**Reading: probably deliberate, and it still needs a ruling**, because the two
cannot both be right and the field is the same field. The Test Bed already has a
proven reason to be in months: a six-month test bed cannot be expressed in the
source's units at all. If the Opportunity is also months, the source is simply
superseded here and should be recorded as such. **The `0` row is the dangerous
one either way**: the source guarantees a term of at least a year, the code
prices a contract at nothing.

---

## S4. SafeSight unit model

**Code:** `ssExisting` and `ssNew` are **both inputs**, and the unit count is
their **sum**. `ssUnits: ssExisting + ssNew`, `src/lib/deal-inputs.js:420`.

**Source:** the **total** is the input and the new count is **derived**.
`camerasNew = Math.max(0, camerasTotal - camerasExisting)`, line 522, with a
mismatch guard at line 524:
`totalCameras = camerasMismatch ? camerasExisting : camerasTotal`.

**Worked example.** Existing 3, and the other figure entered as 10, install
$2,000 per existing unit and $20,000 per new unit.

| | units | install |
|---|---|---|
| source, reading 10 as the TOTAL | **10** | **$146,000** |
| code, reading 10 as NEW | **13** | **$206,000** |
| gap | **3 units**, which is **$24,000** of hardware at $8,000 per unit | **$60,000** |

**The mismatch guard has no equivalent in the code.** With existing 12 against a
total of 10 the source uses **12** units; the code would use **22**.

**Reading: probably a deliberate model change**, since two independent counts are
a reasonable design. The gap is only realised if a user believes they are
entering a total. **The absent mismatch guard is worth a separate look**
regardless of the ruling.

---

## S5. Margin clamp and rounding

**Code:** `Math.min(99, marginPct || 0)` and the result is **rounded**.
`priceFromCost`, `src/lib/deal-calculator.js:66-69`. There is **no lower
clamp**, so a negative margin passes straight through.

**Source:** `Math.min(Math.max(marginPct, 0), 99.9)` and the result is **not
rounded**. `priceFromMargin`, line 481-484.

**Worked examples**, cost $1,000.

| margin | source | code | gap |
|---|---|---|---|
| 99.9% | **$1,000,000** | **$100,000** | **$900,000**, the code's ceiling of 99 caps it |
| -50% | **$1,000** (clamped to 0) | **$667** | **$333**, the code prices BELOW cost |
| 33% | **$1,492.54** | **$1,493** | **$0.46**, rounding only |

**Reading: the negative-margin case is a bug** and is the one that matters at
realistic inputs, because it produces a price below cost silently. The 99 against
99.9 ceiling and the rounding are both defensible choices that should simply be
recorded as decisions.

---

## S6. Product types

**Code:** three types, SafeSight, AQ Sensor and **HEMIR**.

**Source:** two, camera and sensor. **There is no HEMIR anywhere in the deal
sheet.**

**Worked example.** 2 HEMIR at $25,000, install $5,000 per unit, hosting $75 per
unit per month, 12 months: the code totals **$61,800**, and **the source has no
rule that reaches any of it.**

**Reading: HEMIR post-dates the source and this is expected.** What it means is
that every rule above has to be **extended** to HEMIR by analogy rather than
read off the source, and the analogy is the per-type treatment in S1 and S2. It
is recorded here so that extension is a decision somebody takes rather than an
assumption somebody inherits.

**Related, and already on the record:** `src/lib/base-costs.js:45` notes that
only SafeSight's `installNew` is mapped, so the stored
`install_cost_new` figures for AQ Sensor and HEMIR are **read by nothing**.

---

## Summary

| # | what | gap on the worked example | reading |
|---|---|---|---|
| S1 | warranty unit count | 1 unit | drift |
| S2 | warranty valuation | **$4,500**, and **$16,663** on the second case | **bug** |
| S3 | term years against months | **$4,400** on a 1 | probably deliberate, needs recording |
| S4 | SafeSight unit model | 3 units, **$24,000** hardware, **$60,000** install | probably deliberate; missing guard is separate |
| S5 | margin clamp and rounding | **$333** below cost on a negative margin | negative case is a **bug** |
| S6 | HEMIR absent from source | **$61,800** outside the model | expected, needs an extension decision |

## What happens next

1. **John rules on each**, deliberate or bug.
2. Each one ruled a bug is fixed **against the source**, not against the
   neighbouring code.
3. The Opportunity formula is then written into `COST_CALCULATIONS.md` the way
   the Test Bed formula already is, **with a contract test enforcing it**, so it
   is drift-checked from then on.

## Reproducing

The harness runs both sides of every row above. The source side is a verbatim
transcription of lines 481 and 512 to 556; the code side calls the real modules.
The Test Bed contract test, `scripts/tests/test-bed-cost-contract.test.mjs`, is
the model for what the Opportunity equivalent should look like once the rulings
land.
