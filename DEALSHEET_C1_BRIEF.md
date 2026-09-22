# Deal Sheet C1: the statement view, read-only slice

Branch `dealsheet-1`, off `main` at `a98368d`, confirmed equal to
`origin/main` by `git ls-remote`. Rule 18 governs.

**Both preconditions met.** `origin/main` is `a98368d`, and walk 11's D3 is on
it: `MARGIN_KEYS` carries `inLump`, the Installation row renders
`pg-price-inGroup`, and `deal-margin-inLump` exists.

Design reference: `prototypes/deal-sheet-option-c.html`, placed by John and
committed here.

---

## PHASE 0 (a): EVERY FIGURE ON THE DEAL SHEET SUMMARY

All of it is built by `buildDealRows` in `frontend-react/src/deal/rows.ts`
from one `result` object. Traced:

| figure | derivation |
|---|---|
| one-off price | `hardwareGroup.rawTotalPrice + installGroup.rawTotalPrice` |
| hosting over the term | `hostingGroup.rawTotalPrice * months` |
| revenue, contract value net | `result.totals.contractNet` |
| hardware cost ex warranty | `hardwareGroup.rawTotalCost` minus the `hwWarranty` row's cost, **found by KEY not by index** |
| warranty provision | the `hwWarranty` row's `rawCost` |
| installation cost | `installGroup.rawTotalCost` |
| hosting cost over the term | `hostingGroup.rawTotalCost * months` |
| PO factoring interest | `result.financeCost` |
| Test Bed cost | `result.testBedCost` |
| WHT borne | `result.tax.whtBorne` |
| total cost | `result.totalDealCostAll` |
| gross margin | `contractNet - totalDealCostAll` |
| achieved margin and its accent | `marginPresentation(result.achievedMargin, payload)` |

**One derivation each, with ONE exception, and it is already recorded.**

### The one genuine second reader, carried not caused

`rows.ts` computes the hosting term itself:

```ts
const hoPrice = hostingGroup.rawTotalPrice * months
const hoCost  = hostingGroup.rawTotalCost  * months
```

while `calculateContractTotals` already returns `hostingTermPrice` for the
price half. They agree by carrying the same formula, not by sharing a value -
Verification 20's shape - and the site says so, citing
`COST_CALC_AUDIT.md F8`. **It is not converged because there is no
`hostingTermCost` on the deal path to take the cost half from**: the
`hostingTermCost` that exists at `deal-calculator.js:499` belongs to a
different function.

**This round does not converge it and must not widen it.** The statement
reads the SAME two expressions, from the same module, so the count of readers
stays at two rather than becoming three.

### A dead constant, found while tracing

```ts
/** The six cost rows the ruling says Total cost is the visible sum of. */
export const COST_ROW_LABELS_FROM = 3
export const COST_ROW_COUNT = 6
```

**There are SEVEN cost rows** - R-O8 split the warranty out and the comment
four lines above it says "SEVEN cost rows, contiguous" - **and both constants
are exported and read by NOBODY.** Architecture 9's fourth variant sitting
beside Verification 9's dead-guard clause. Reported, not deleted: it is not
this round's build.

---

## PHASE 0 (b): R-O7, THE SECOND PRICING MODE

- **Where it lives**: `hostingPriceMode` is `'margin'` or `'perUnit'`, owned
  by the deal form and written to the payload beside `hostingUnitFees`, the
  monthly fee for ONE unit of a type.
- **What it writes**: `deal/payload.ts` collects the fees; `deal-inputs.js`
  turns a fee into a `priceOverride` on that hosting line.
- **THE PART THAT MATTERS FOR THIS BUILD**: the override flows through
  `buildCostGroup` like any other line - `rawPrice = overridden ?
  Math.round(priceOverride) : priceFromCost(cost, marginPct)` - so
  **`hostingGroup.rawTotalPrice` is correct in BOTH modes**. A statement
  reading the group totals is right under either, and needs no branch on the
  mode.

---

## PHASE 0 (c): WHAT THE APPROVAL VERSION SNAPSHOT RENDERS

**Not these rows.** `src/lib/approval-page.js` builds its own presentation: a
step list (`Units`, `Term`, `Cost basis`, `Discount or override`, `Risk
terms`) and a bridge of named effects (withholding tax, GST, warranty
provision, finance cost, peak cash exposure, Test Bed cost carried in), with
version labels and a baseline comparison.

`buildDealRows` has exactly one caller, `DealPanel.tsx:357`. **So this round
cannot reach the approval snapshot**, and nothing here changes what an
approver sees.

---

## WHAT CONTRADICTS THE DESIGN, REPORTED BEFORE BUILDING

**The mockup's MONEY OUT has four cost lines plus factoring and WHT. The real
sheet has SEVEN cost lines**, and the extra one is
`Test Bed cost, carried from conversion`.

It is a real cost: `result.testBedCost`, carried when an Opportunity is
converted from a Test Bed, and it is inside `totalDealCostAll`. **Omitting it
would make MONEY OUT fail to sum to Total cost**, which is the one property a
statement exists to have (Verification 21: a reconciliation that cannot fail
is not a reconciliation).

**Taken: the line is included.** The mockup is a design for the shape, not a
census of the lines.

### And the position, where the reading is mine

"Replacing the current summary's position" against "existing panels unchanged
this round". The summary section holds TWO things: the matrix, and a
disclosure column of pricing cards **whose margin boxes are where a person
edits**.

**Taken: the statement replaces the MATRIX. The disclosure column stays
untouched.** Removing it would delete the editing surface a round before C2
adds editing to the statement, which cannot be what "read-only slice" means.
Recorded here because it is a judgement, and it is one commit to reverse.
