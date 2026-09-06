# Migration Round 3, Session E (run 3): Payment Terms

**Ratchet before:** 1 id, 34 classes.
**Ratchet after:** **0 ids**, 14 classes.
**Delta: the last id and 20 classes.** Gate green at 21 stages. Not pushed.

Regions landed: **`#deal-section-5` in full** - the payment region, the payment
card, all three ring-radio groups, the recovery input and its readout, the
hybrid milestone table, and the PO factoring panel - plus **section 4's summary
notices** and the **help dots**.

Every id in the adoption list now renders.

---

## 1. A drift the tests were protecting

**React's `factoringToggle` said `PO factoring enabled`. The vanilla says
`Factoring enabled`.** The titles differed too: an invented pair against the
vanilla's `Factoring is on. Click to turn it off.`

The switch sits inside a panel already headed **PO factoring**, so the longer
label repeated the heading on every render.

**Nothing caught it because `deal-surfaces.test.ts` asserted the React
wording** - a test written to agree with the implementation rather than with the
screen it replaces. Both helper and test now carry the vanilla's own strings.

**The neighbouring one was checked rather than assumed**: `grossUpToggle` reads
`Gross up enabled` on both sides, and its titles match. Only factoring had
drifted.

---

## 2. Two things the vanilla does that React had not

**`label[for]`, not a wrapping label.** `CensusField` wrapped its input in a
label with no `for`. The vanilla writes `<label for="deal-factoring-ratePct">`,
and those ids are in the adoption list **because** they are `label[for]`
targets. With implicit labelling only, the id stops being load-bearing: the next
rename breaks click-to-focus and nothing visible fails. It now sets `htmlFor`.

**`minCash` was undeclared.** The calculator computes the cash trough
(`deal-calculator.js:300`) and the vanilla reads it, but React's `CashFlow`
interface never declared it - so the summary notice had nothing to read, and the
panel could not say whether cash goes negative, **which is the one thing that
notice is for**.

---

## 3. Behaviours, enumerated before building

Section 5, from `updateStructureButtons` (:1686), `updateStructureVisibility`
(:1697), `updateInvoicingButtons` (:1706), `updateFactoringButtons` (:1712) and
the recovery readout (:912). Eleven tests, red before green.

P1 a ring radio marks the choice · P2 the top schedule row goes under hybrid ·
P3 so does the invoicing group, because hybrid brings its own · P4 the recovery
INPUT is twoPhase only · P5 single shows a READOUT of the duration, and says it
is **not set** rather than showing zero months · P6 the hybrid group is hybrid
only · P7 both invoicing groups mark the same choice · P8 the factoring switch
says its state and what a click does · P9 its fields are hidden until it is on ·
P10 the method toggle marks the method.

A ring radio is three elements - ring, dot, label - because the stylesheet
animates the dot **inside** the ring; a flattened version styles as a bullet.

---

## 4. Injection calibration

Verified-snapshot harness over four files, restore checked after each, final
reverted run green.

| injection | verdict |
|---|---|
| no ring radio is ever marked active | FIRED |
| the recovery input shows under every structure | FIRED |
| the factoring fields are never hidden | FIRED |
| a blank duration reads as zero months | FIRED |
| the invoicing hidden class moves off the group the vanilla names | FIRED |
| the factoring switch loses the vanilla wording again | FIRED |
| the help dot is dropped from the label | FIRED |
| **both cash moods show at once** | **SILENT**, then FIRED |

**The silent one is a population fault, not a detector fault.** The panel
fixture's cash goes negative, so the positive line was hidden anyway and an
always-visible warning still left exactly one showing. `SummaryNotices` is now
driven directly with positive, negative and absent cash, and the injection
fires. Verification 25: the reading has to be taken where the fault can appear.

**The same shape caught me writing a test.** My first notice test asserted
"cash stays positive" on that fixture. It tested my expectation, not the panel.
It now asserts the invariant the panel actually claims - the two moods share one
trough sentence and differ only in the verdict.

---

## 5. What is left: 14 classes, no ids

| where | classes |
|---|---|
| sections 1-2 interior | `unit-card`, `unit-cards`, `form-grid`, `col-mono`, `data-row-label` |
| section 3 | `terms-cards`, `terms-achieved`, `terms-field-row` |
| section 6 | `cashflow-scroll`, `deal-cashflow-col`, `empty-state` |
| applied by JS, not in the static markup | `int-only`, `is-computed`, `is-scrollable` |

**`is-scrollable` is applied by a `ResizeObserver` measuring `scrollWidth`
against `clientWidth`.** jsdom has no layout, so both are 0 and the class can
never appear in this environment. That is a real limit of the instrument rather
than a gap in the render, and it wants a browser measurement at Session F's
visual comparison rather than a unit test. `int-only` and `is-computed` are the
same family and are named here so the next run checks them rather than assuming.

Nothing live changed. `initOpportunityDealPanel` is still unregistered and the
vanilla form is still the Commercials surface.
