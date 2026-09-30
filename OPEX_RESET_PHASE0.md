# OPEX_RESET, PHASE 0

Short. **No premise failed**, so the round proceeds.

---

## 0.1 R-TL2's DERIVED-MARGIN DISPLAY IS ON MAIN

Confirmed on `origin/main` at `518c591`, not on a local branch:

- `useDealForm.ts` carries the either-or clear (`R-TL2: THE OPEX EITHER-OR`);
- `OpexTable.tsx:54` computes `const override = stored !== '' && shown !== ''`,
  so a cleared cell falls back to the DERIVED figure and loses its override
  dress.

**That is the precondition R-RS3 rests on.** The reset clears the stored keys,
and what makes the rows then read correctly rather than blank is this display
rule, already in place.

---

## 0.2 THE FIELD, ITS FORMAT, AND THE DRESS

| | |
|---|---|
| field id | **`deal-targetMargin`** |
| label | "Target margin %" |
| contract | `numOrNull` |
| section | `structural` |
| payload key | `targetMargin` |
| **format registry** | **`'deal-targetMargin': 'percent'`**, `src/lib/field-formats.js:126` |

**The outline dress is `.btn-sm`** - the class the Key Customer Contacts Add
button wears (`KeyContacts.tsx:373`). `style.css:1331`:

```
font-family: var(--mono);   font-size: 10.5px;   letter-spacing: 0.08em;
text-transform: uppercase;  background: none;
border: 1px solid var(--hairline-strong);   color: var(--muted);
padding: 6px 14px;
```

**It is already upper case by rule**, which matters for R-RS1: the mockup's
`RESET TO TARGET MARGIN (30%)` comes from `text-transform`, so the label is
written in sentence case in the markup and the dress does the shouting.

**Its comment records why it is `.btn-sm` and not a bare button**: it shipped
bare, "which renders as a WHITE browser default on a dark screen".

---

## 0.3 TOTAL CONTRACT VALUE vs CONTRACT NET. REPORT ONLY

**They are the SAME derivation.** `totalContractValue`
(`opportunity-headline.js:36`) calls `calculateDeal(buildDealInputs(...))` and
returns `result.totals.contractNet` - the identical quantity the Commercials tab
labels "Contract net". There is no second definition and no second formula.

### What differs is what each is fed

| | reader | fed from | computed |
|---|---|---|---|
| **TCV**, header | `totalContractValue(headlinePayload, ...)`, `opportunities.js:394` | **the SAVED record**: `revResult.data.payload`, the current revision | server-side, on `GET /opportunities/:id` |
| **Contract net**, tab | `calculateDeal(...)` in `useDealForm.ts:133`, rendered at `panelParts.tsx:361` | **the FORM**: `readDealPayload(values, ui, catalogRates)` | client-side, on every keystroke |

**TCV READS THE SAVED RECORD. Contract net reads the form.**

### Which explains the evidence exactly

TCV **$1,131,445 held** while contract net read **$1,117,303** per-unit and
**$1,119,389** lump sum. Switching the installation arrangement is a FORM change:
the tab re-prices on the keystroke, and the header keeps reporting the deal as
last saved. The header did not fail to update - it is answering a different
question.

### Whether the two should differ

**They necessarily differ while the form is dirty**, because one is the saved
deal and the other is the deal on screen. That is not a defect in either.

**What the screen does not do is say which is which.** Both are rendered as
plain figures, and nothing distinguishes "the deal as saved" from "the deal as
edited". A reader comparing them has no way to know they are answers to
different questions, and the natural reading of two different numbers for one
concept is that one of them is wrong.

**No proposal is made and nothing is fixed here**, per the brief.

### What I did NOT rule out

- **The CATALOG each side uses.** The route passes `catalogResult.rates`; the
  panel passes its own `catalogRates` prop. I read both call sites and did not
  establish that the two are always the same batch. If they can differ, that is
  a SECOND source of divergence that would persist even on a clean form.
- **`test_bed_cost`.** Both pass it, and it reaches total cost rather than
  contract net, so it cannot move either figure. Stated because it is the kind
  of third input that looks like it might.
