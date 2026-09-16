# Cost calculation audit

**Taken 2026-09-16, on `round-testbed-recovery` at `71eb442`.** Read only.
Nothing in this audit changed a line of product code.

Commissioned by the business as a trust-verification pass over every cost
calculation in the estate: extract the formula each site actually runs, feed
it a known worked example, and report what it produces against what is
correct.

---

## What is NOT established, first

CLAUDE.md build discipline 15: the first section about an unfinished item says
it is unfinished, before any account of what was done.

### The source of truth did not arrive, so the comparison against it is not done

The instruction named a deal-sheet HTML file, lines 536-556, as the source of
truth, to be provided by the business. **No file was provided, and nothing in
the repository matches that description.** Checked rather than assumed:

| candidate | lines | what is actually at 536-556 |
|---|---|---|
| `terminus-tms-mockup.html` | 427 | the file ends before line 536 |
| `Terminus Ops.dc.html` | 11,391 | Lead-card markup. Its cost logic is at 6486-6530 |
| `Prototype-110826/Terminus Ops.dc.html` | 11,391 | byte-identical to the above |
| `frontend/index.html` | 3,234 | contact-notes markup |

Every `.html`, `.js`, `.ts` and `.tsx` file in the tree longer than 556 lines
was swept for cost logic in that line range. Nothing matches.

**So two of the four commissioned steps are NOT done:**

- the line-by-line comparison of each formula against the deal sheet, and
- the enumeration of every place the code disagrees with the deal sheet.

The in-repo prototype was deliberately NOT substituted for it. The business was
explicit that the source is their own document and that the codebase drifted
from it, so a prototype in this repository is evidence about what was built,
not about what was agreed. CLAUDE.md Verification 31 is the same point.

### What that leaves unanswerable today

Every finding below about **warranty** is a behaviour measurement, not a verdict
against source. Whether a 2 percent default is right, whether `ceil()` to a
whole unit is right, and whether a Test Bed should carry no warranty at all are
all decided by the missing document.

---

## The census: 13 sites compute cost, 4 display it

The first census regex missed `src/routes/test-beds.js`, because that file
wraps its operands in `num()` and the identifier is therefore not adjacent to
the operator. A census that cannot find a site already known to exist is not a
census (CLAUDE.md Verification 12), so it was rebuilt and re-run before any
claim was made from it.

| # | site | what it computes |
|---|---|---|
| 1 | `src/lib/deal-calculator.js:107` `calculateHardwareAndWarranty` | hardware cost, warranty units, warranty cost |
| 2 | `src/lib/deal-calculator.js:83` `buildCostGroup` | per-line and group totals |
| 3 | `src/lib/deal-calculator.js:66` `priceFromCost` | price from cost and margin |
| 4 | `src/lib/deal-calculator.js:130` `calculateContractTotals` | `totalDealCost` |
| 5 | `src/lib/deal-calculator.js:376` `calculateTestBedCost` | Test Bed total |
| 6 | `src/lib/deal-calculator.js:416` `calculateDeal` | `totalDealCostAll`, achieved margin |
| 7 | `src/lib/deal-calculator.js:183` `buildCashFlowModel` | monthly cost and cash rows |
| 8 | `src/lib/deal-calculator.js:149` `calculateTax` | WHT, GST, `whtBorne` |
| 9 | `src/lib/deal-calculator.js:32` `buildLoanSchedule` | factoring interest |
| 10 | `src/routes/test-beds.js:24` `buildTestBedCostBreakdown` | Test Bed rate by quantity mapping |
| 11 | `src/lib/deal-inputs.js:361` `buildDealInputs` | Opportunity rate by quantity mapping |
| 12 | `src/lib/base-costs.js:144` `catalogToRates` | catalog rows to flat rate keys |
| 13 | `src/lib/rate-resolution.js:71` `resolveRates` | override against catalog |

**Proven non-computing**, by a comment-stripped scan (CLAUDE.md Verification 39,
prose must not satisfy a check meant for code):

- `frontend-react/src/testbed/costBreakdown.ts` and `CostBreakdownCards.tsx`:
  **zero** arithmetic-bearing lines after stripping.
- `frontend-react/src/deal/section4.tsx` and `src/lib/approval-page.js`: a first
  detector flagged 17 and 13 lines. On inspection every one is a JSX id, a CSS
  class name or warning prose. Both read engine output only. The detector fired
  for the wrong reason and was corrected rather than trusted.
- `frontend/index.html`: containers only, no arithmetic.

**There is exactly one cost engine.** The documentation asserts this; this audit
verified it rather than taking it.

---

## 1. Test Bed: the current engine MATCHES the acceptance case exactly

The business's acceptance case, per their ruling (the simple version: per type,
no warranty, no margin, no factoring):

> 2 SafeSight, unit $8,000, install $2,000, hosting $200 per month, duration 6.
> Correct answer: Hardware $16,000, Install $4,000, Hosting $2,400, Total $22,400.

Run through `buildTestBedCostBreakdown`, which is the real production mapping
called by `GET /test-beds/:id`, by the `PATCH` that maintains
`accumulated_cost`, and by `POST /test-beds/calculate`. Not a re-derivation.

| component | correct | code produces now | verdict |
|---|---|---|---|
| Hardware | $16,000 | **$16,000** | MATCH |
| Install | $4,000 | **$4,000** | MATCH |
| Hosting (term) | $2,400 | **$2,400** | MATCH |
| **Total** | **$22,400** | **$22,400** | **MATCH** |

Supporting figures from the same run: hosting per month $400, months 6,
warranty cost $0.

**Three supplementary cases, all passing:**

- The same payload with **string** values, which is what `<input type="number">`
  actually saves: total $22,400.
- A payload carrying `warrantyPct: 10`: warranty cost still $0 and total still
  $22,400. The route hardcodes 0 and genuinely never reads the payload key.
- The pure suite, `scripts/tests/cost.test.mjs`: 22 of 22 pass.

### The Test Bed formula, as the code runs it

```
hardware     = SUM over t of (unitCost_t    x units_t)     t in SafeSight, AQ, HEMIR
install      = SUM over t of (installCost_t x units_t)     one-off, 3 lines
hostingMonth = SUM over t of (hostingCost_t x units_t)
hostingTerm  = hostingMonth x months                       months = testBedDuration
warranty     = round(ceil(totalUnits x pct/100) x avgHwCost)   pct forced to 0
total        = hardware + install + hostingTerm
```

Rates are hand-typed payload fields on the record. Unit counts are
`safesightCameras`, `airQualitySensors`, `hemirSensors`.

---

## 2. The discrepancies

None of these changes the worked example above. Each was measured, not reasoned
about.

### F1. The warranty `ceil()` makes the rate inert on small deals

Code does: `warrantyUnits = ceil(totalUnits x pct/100)`, then values that whole
unit at the mix average cost.

Measured on the 2-unit acceptance deal:

```
pct = 0.1  ->  0.002 units  ->  ceil 1  ->  $8,000
pct = 1    ->  0.020 units  ->  ceil 1  ->  $8,000
pct = 2    ->  0.040 units  ->  ceil 1  ->  $8,000
pct = 5    ->  0.100 units  ->  ceil 1  ->  $8,000
pct = 10   ->  0.200 units  ->  ceil 1  ->  $8,000
pct = 50   ->  1.000 units  ->  ceil 1  ->  $8,000
```

Every non-zero rate from 0.1 percent to 50 percent produces the identical
$8,000. Only zero against non-zero has any effect, and $8,000 is 50 percent of
the hardware cost on this deal. `DESIGN_PRINCIPLES.md:2325` records the
mixed-deal version of this concern; that the percentage becomes meaningless
below one unit is not recorded anywhere.

**Correct behaviour is UNKNOWN pending the deal sheet.**

### F2. Test Bed and Opportunity disagree by $8,000 on the identical physical deal

Same 2 units, same rates, same 6 months, zero margin:

```
Test Bed engine      $22,400
Opportunity engine   $30,400      difference $8,000, 36 percent
```

Cause: Test Bed passes `warrantyPct: 0` explicitly; Opportunity takes the
system default of 2, which F1 turns into a whole unit. A Test Bed converting to
an Opportunity jumps by $8,000 on unchanged hardware.

### F3. A cleared warranty box silently re-prices at 2 percent

Measured through `buildDealInputs`, which is the production path:

```
warrantyPct = 0            ->  engine receives 0  ->  warranty $0      total $22,400
warrantyPct = "" (cleared) ->  engine receives 2  ->  warranty $8,000  total $30,400
warrantyPct = null         ->  engine receives 2  ->  warranty $8,000  total $30,400
key absent                 ->  engine receives 2  ->  warranty $8,000  total $30,400
```

This is a fallback living in the calculation. CLAUDE.md Architecture rule 11
forbids exactly this: "If the user clears the field, the field is empty and the
sheet says the value is not recorded. It does not quietly reappear."

`initialPayload` does correctly write the default into the record at creation,
so the estate holds the value in two places, and the calculation-time one wins
whenever a user clears the box.

### F4. A null rate COLUMN zeroes a line and neither warning fires

Both surfaced missing-rate warnings key off `catalogToRates().missing`, which is
**per product**. A product row that exists but carries a null install or hosting
column is not "missing", so the warning cannot name it.

Measured, with a SafeSight row present and `install_cost_new` null:

```
catalogToRates().missing :  ["air_quality", "hemir"]      SafeSight absent from the list
resolveRates().absent    :  [..., "inSsNew", ...]         names it, and nothing reads it
install line cost        :  $0
totalDealCost            :  $18,400   against a true $22,400
shortfall                :  $4,000
```

The warning would name AQ and HEMIR while the $4,000 that actually moved the
total is SafeSight's.

**To be fair to the code, the per-PRODUCT case is handled properly** and is
surfaced on two live surfaces: `frontend-react/src/deal/basis.ts:36` on the deal
panel, and `src/lib/approval-page.js:679` on the approval page, which says in
terms that "Those units price at ZERO cost, so the margin above is higher than
the deal will achieve." This finding is narrower than a silent zero: it is the
per-rate-key case that the per-product warning cannot see.

`resolveRates()` already computes the per-key `absent` list. No production
consumer reads it.

### F5. A comment contradicts the code directly beneath it

`src/lib/deal-inputs.js:398` reads:

> rates[...] and no `?? 0`: an absent rate is absent, and resolveRates omits the
> key entirely rather than inventing a zero.

The four install lines under it are `(rates.inSsExisting ?? 0)`,
`(rates.inSsNew ?? 0)`, `(rates.inAqm ?? 0)`, `(rates.inHemir ?? 0)`, and the
three hosting lines at 409-412 carry the same. The behavioural half of the claim
is true on the per-product path (F4); the literal half is false against the
lines it sits on.

### F6. A blank Test Bed duration prices hosting at zero months

```
testBedDuration = 6       ->  months 6  ->  hostingTerm $2,400  ->  total $22,400
testBedDuration = "" blank->  months 0  ->  hostingTerm $0      ->  total $20,000
```

`num()` coerces blank to 0 with no mark on screen. The same shape as the
`recoveryMonths` finding that Architecture rule 11 was written from.

### F7. The built warranty default of 2 disagrees with the prototype's 10

Recorded as an open question at `DESIGN_PRINCIPLES.md:2325`. F1 shows the
choice between 2 and 10 changes nothing at all below roughly one warranty unit,
so this matters on large deals only.

### F8. Hosting over the term is computed in two places

`src/lib/deal-calculator.js:135` computes `hostingGroup.rawTotalCost * months`
inside the engine. `frontend-react/src/deal/rows.ts:72-73` computes it again for
display, using a `months` separately derived by `durationPresentation(payload)`.
They agree today by carrying the same formula, not by sharing a value. CLAUDE.md
Verification 20.

### F9. A standing document states a rate field is editable when it is not

`DESIGN_PRINCIPLES.md:2614` lists `warrantyPct` among the Test Bed rate fields
that "stay freely editable through the ordinary PATCH allowlist". It was removed
from `TEST_BED_WRITABLE_KEYS` in Round 7 Phase 8 and a PATCH naming it is now
rejected. `CURRENT_STATE.md:482`, generated by parsing the real source, does not
list it. The correction exists at `DESIGN_PRINCIPLES.md:2760`; line 2614 carries
no forward marker, so read alone it is false.

---

## 3. Opportunity and Deal: audited for BEHAVIOUR, not validated against source

The Opportunity path was fully traced and executed. Its formula is:

```
hardware     = SUM over t of (unitCost_t x units_t)  +  warranty
install      = lump sum, OR 4 per-unit lines (SafeSight split existing/new),
               OR a single zero line when installation is by others
hostingMonth = hoSafesight x (ssExisting + ssNew) + hoAqm x aqm + hoHemir x hemir
totalDealCost    = hardware + install + hostingMonth x months
totalDealCostAll = totalDealCost + financeCost + whtBorne + testBedCost
```

Rates come from the admin catalog through `catalogToRates` and `resolveRates`,
not from hand-typed payload fields. That is a genuine structural difference from
Test Bed and is by design.

On the acceptance deal with warranty explicitly 0 it produces **$22,400**,
agreeing with Test Bed. With warranty left blank it produces **$30,400**.

**It has NOT been validated against the deal sheet, because the deal sheet was
never received.** Warranty treatment, the `ceil()` step, the four-line versus
three-line install shape, and whether `totalDealCostAll` should fold in
financing and withholding are all source questions. This path needs the same
check the Test Bed got, the moment the file arrives.

---

## 4. Every other cost calculation, one line each

| site | verdict |
|---|---|
| `calculateTestBedCost` (5) | MATCHES the acceptance case exactly. $22,400. |
| `buildTestBedCostBreakdown` (10) | MATCHES. Correct per-unit multiply, warranty forced to 0, proven ignored. |
| `calculateHardwareAndWarranty` (1) | Arithmetic runs as written. `ceil()` behaviour is F1. Against source: UNVERIFIED. |
| `buildCostGroup` (2) | Correct. Sums line costs. Computes a price internally; no Test Bed caller reads it, verified by grep. |
| `priceFromCost` (3) | Correct and margin-clamped at 99. Not on any Test Bed path. |
| `calculateContractTotals` (4) | Same shape as Test Bed's total. Agrees at $22,400. Against source: UNVERIFIED. |
| `calculateDeal` (6) | Agrees at $22,400 with warranty 0. Adds finance, WHT and carried Test Bed cost into a second total. Against source: UNVERIFIED. |
| `buildDealInputs` (11) | Rate by quantity mapping correct. Carries F3, F4 and F5. |
| `catalogToRates` (12) | Correct per product. Cannot report a null column, which is F4. |
| `resolveRates` (13) | Correct. Computes an `absent` list that no consumer reads. |
| `buildCashFlowModel` (7) | NOT exercised by this audit. Needs its own pass. |
| `calculateTax` (8) | NOT exercised by this audit. Needs its own pass. |
| `buildLoanSchedule` (9) | NOT exercised by this audit. Needs its own pass. |
| `costBreakdown.ts`, `CostBreakdownCards.tsx` | No arithmetic. Display only. Verified comment-stripped. |
| `section4.tsx`, `approval-page.js` | No arithmetic. Read engine output only. |
| `rows.ts` | Recomputes hosting over the term. F8. |
| `frontend/index.html` | No arithmetic. Containers only. |

Sites 7, 8 and 9 are cash flow, tax and factoring. They are cost-bearing, they
were enumerated, and they were **not** fed a worked example in this pass. That
is a stated gap, not a clean result.

---

## Reproducing this

The harnesses ran against the real modules with the real environment loaded:

```
node --env-file=.env <harness>.mjs
```

The Test Bed acceptance check, in full:

```js
import { buildTestBedCostBreakdown } from './src/routes/test-beds.js'

const r = buildTestBedCostBreakdown({
  safesightCameras: 2, airQualitySensors: 0, hemirSensors: 0,
  ssUnitCost: 8000, aqUnitCost: 0, hemirUnitCost: 0,
  ssInstallCost: 2000, aqInstallCost: 0, hemirInstallCost: 0,
  ssHostingCost: 200, aqHostingCost: 0, hemirHostingCost: 0,
  testBedDuration: 6,
})
// hardware 16000, install 4000, hostingTerm 2400, totalCost 22400
```

---

## Next, and nothing here is fixed

1. **The deal sheet.** Until it arrives, F1, F2, F3 and F7 have no correct
   answer to be measured against, and the Opportunity path has no verdict.
2. **F4, F5, F6, F8 and F9 do not need the deal sheet.** They are internal
   inconsistencies, provable and fixable today.
3. **Cash flow, tax and factoring** need the same worked-example treatment.
4. When each proven-wrong path is fixed, the formula is written into the
   repository so it is never re-derived wrongly again. No standing document
   currently states any cost formula: the only executable statement of the Test
   Bed arithmetic is `scripts/tests/cost.test.mjs:198`.
