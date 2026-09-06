# Migration Round 3, Session E (run 1): section 4

**Ratchet before:** 7 ids, 70 classes outstanding.
**Ratchet after:** 5 ids, 43 classes outstanding.
**Delta: 2 ids and 27 classes adopted.** Gate green at 21 stages. Not pushed.

Region landed: **`#deal-section-4`, Deal Sheet Summary** - the section frame, the
disclosure, the summary column with the matrix in its real container, the
cost-basis block and both pricing cards.

---

## 1. THE DEFECT THIS FOUND, and it would have shipped with the swap

**`useCatalogRates` read `data.rates`. The route does not return that key.**

`GET /api/base-costs` answers `{ as_of, products }`, and the vanilla derives the
rates by running the products through `catalogToRates`. The React query read
`r.data.rates`, which is `undefined` against the real server, so **every rate
would have been `{}` and every cost on the screen `$0`** - the indistinguishable
zero the vanilla's own comments say this round exists to remove.

**Nothing could have caught it, because every React test supplied
`{ rates: RATES }`.** The fixture was shaped to the implementation rather than
to what the server produces, which is Verification 47 exactly. The type
annotation on the call even said `{ products?: unknown[] }`, and the line below
it read `.rates` off that.

Fixed by reading through `catalogToRates`, the same function the vanilla calls,
and the fixture is now **one shared definition** in `__tests__/fixtures.ts`
producing the real `{ as_of, products }` shape, imported by all five deal test
files rather than five copies drifting apart.

---

## 2. Two more findings, both from moving code rather than reading it

**Duplicate ids.** Moving the seven pricing-card margin inputs into section 4
left the generic census loop rendering them too, so `deal-margin-hwSs` named
**two elements** and `readPayload` would read whichever the DOM returned first.
Nothing fails on a duplicate id; the browser simply picks one. There is now an
explicit detector - exactly one element per id, across all three fixture shapes -
and it is calibrated by re-introducing the duplicate.

**And the first fix was too wide.** Excluding all eleven `MARGIN_KEYS` from the
census loop dropped four inputs nothing else renders: the installation margins
are priced in the Installation section, which is what section 4's per-unit
signpost points at. **The census count test caught it**, which is what that test
is for. The exclusion is now the seven keys the cards own, named individually.

---

## 3. Behaviours, enumerated from the vanilla before anything was built

From `renderPricingCards` (:356), `renderCatalogNotice` (:445), the disclosure
listener (:1931) and the signpost toggle (:1663). 14 tests, red before green.

| | behaviour |
|---|---|
| B1 | the disclosure label is a **span** beside the chevron, never the button's own `textContent`, which would delete the chevron the CSS rotates so the indicator works exactly once |
| B2 | `detail-open` goes on the **row**, not the panel: the row becomes two columns, and hiding the panel alone leaves a one-column grid with a gap |
| B3 | `aria-expanded` tracks the state |
| B4 | the units figure is the hardware total |
| B5 | a row note reads `N units x $cost` |
| B6 | the warranty note reads `pct% of N units = W unit(s)`, singular at one |
| B7 | every hosting figure carries the `perMonthFigure` wording, totals included, because the same hosting is priced over the term three sections below |
| B8 | a blank margin box prices at target, so the **placeholder** carries the target rather than the box carrying a value nobody entered |
| B9 | an overridden line says so, in a class and in the title |
| B10 | the per-unit signpost appears exactly when the rows it points at do |

**My own B6 expectation was wrong and the test caught me, not the code.** It
recomputed the warranty units as `Math.round(85 x 12%)` and read 10, where the
calculator ceilings 10.2 to 11. The claim B6 makes is about the **wording**, so
the count is now read back out of the rendered sentence and the sentence
asserted around it, including the pluralisation. Restating the calculator in a
test is a second reader.

Values are read through the presenters the vanilla uses - `perMonthFigure`,
`numericOrDefault`, `toNumberOrNull`, `ageInDays`, `stalenessBand`,
`catalogToRates` - never reimplemented.

---

## 4. Injection calibration

Verified-snapshot harness, full-path keys, restore checked after every
injection, final reverted run green.

| injection | verdict |
|---|---|
| `detail-open` moved onto the panel | **FIRED**, by B2 |
| the label written as the button's own text, destroying the chevron | **FIRED**, by B1 |
| the hosting period wording dropped | **FIRED**, by B7 |
| the target made the box's value rather than its placeholder | **FIRED**, by B8 |
| the census renders the margin inputs again | **FIRED**, and now by the dedicated duplicate-id detector rather than only indirectly |

---

## 5. Two re-points the move forced

- **`a numOrUndefined box shows "no override"`** now measures the four
  installation margins. The claim is unchanged; where it is measured moved,
  because the seven card margins carry the vanilla's own treatment - the target
  as placeholder. `'no override'` was a React invention. The card treatment is
  asserted separately as B8, so both are covered.
- **The seam test's `catalogRates` expectation** was a second hand-kept copy of
  the rates. It now derives them from the shared fixture's products through
  `catalogToRates`, so there is one source.

---

## 6. What is left

**5 ids, 43 classes.** Concentrated in `#deal-section-5` (Payment Terms with the
`ring-radio` set, `payment-card`, `po-factoring-panel`), `#deal-sections-1-2`
(the intake columns and `unit-card`), `#deal-section-3` (`terms-cards`), and
`#deal-section-6` (`cashflow-scroll`, `empty-state`).

**The latch feature is still not built** - `latch`, `latch-all-row`,
`latch-row--intake` and the five section ids remain outstanding, and it is
behaviour rather than markup. It is the largest single item left.

Nothing live changed. `initOpportunityDealPanel` is still unregistered and the
vanilla form is still the Commercials surface.
