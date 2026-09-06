# Migration Round 3, Session E (run 4): the interiors, and the ratchet's floor

**Ratchet before:** 0 ids, 14 classes.
**Ratchet after:** 0 ids, **1 class** - and that one cannot be rendered in this
environment by any markup.
**Delta: 13 classes.** Gate green at 21 stages. Not pushed.

Regions landed: **sections 1 and 2** (unit cards, the installation form grid and
the per-unit table), **section 3's terms cards**, and **section 6's cash-flow
column**. The screen is structurally adopted.

---

## 1. The one class left is the instrument, not the render

`is-scrollable` is applied by a `ResizeObserver` comparing `scrollWidth` against
`clientWidth`. **Measured in the suite's own environment rather than asserted:**

```
jsdom scrollWidth: 0  clientWidth: 0  ->  is-scrollable would be false
typeof ResizeObserver in jsdom: undefined
```

Both are 0 for every possible markup, so **no render could put that class on
screen here.** It is a measurement that belongs in a browser, and Session F's
visual comparison is where it gets taken. It stays named in the list rather than
being deleted, because a name quietly dropped is indistinguishable from one that
was never needed.

The other two JS-applied classes were **not** unreachable, only unbuilt:
`is-computed` belongs on the derived customer-milestone cell, and `int-only` is
an explicit opt-in the delegated guard in `app.js` reads. Both are now rendered.

---

## 2. Four things found by moving the code

**`deal-installResp` is not a census field.** `renderField` returned null and
the installation form grid rendered empty. The responsibility is UI state - it
selects which pricing branch the calculator takes rather than being a priced
value - so it is a real select bound to `ui`, and the duplicate
`ui-installResp` scaffold select in section 3 is gone. One control, one id.

**`CashFlowGrid` already owned `#deal-cashflow-grid`**, plus its own empty state
(*"No cash flow to show yet."*) and its own closing figure. The vanilla renders
those as **siblings** of the grid. Nesting my section around it would have
produced a duplicate id, so the grid keeps the id and the ref - the scrollable
mark has to sit on the node that actually scrolls - and the section took the
empty state and the closing.

**The empty state was reading the wrong condition.** `hasFlow={!!cashFlow}` is
true with a blank duration, because the calculator returns a cash flow with zero
rows. The grid decides it has nothing to draw on `months.length`; the empty
state now uses the same test, so the two cannot disagree about whether there is
anything to show.

**The install totals row had the wrong cell count.** Two blank cells put the
totals under *Rate* and *Margin*; the vanilla has three, which puts them under
**Cost** and **Price**. A row that renders is not a row that is right, and a
cell count can be wrong by exactly the amount that still looks like a table.

---

## 3. `bare` inputs, because a column header is a label

The four per-unit rate inputs and four installation margins live in table cells
whose **column header** names them. Rendering them through `CensusField` would
have repeated "SafeSight, existing infra" inside every cell.

`CensusField` gained a `bare` mode: the visible text goes, the wrapper keeps
`data-contract` so the census contract test still holds, and the accessible name
moves to `aria-label`. The input keeps a name without the screen repeating one.

---

## 4. Injection calibration

Verified-snapshot harness over four files, restore checked after each, final
reverted run green. **Eight injections, eight fired.**

unit cards flattened · every install row reading the same unit count · the lump
summary dropping where the figure is carried · every responsibility group
showing at once · the achieved row inventing its own accent · the cash-flow
empty state never showing · the computed cell losing its class · the contractor
month losing its `int-only` opt-in.

---

## 5. Re-points this run forced

- **`install-table` / `install-signpost` / `install-contractor-group`** were
  empty scaffold divs carrying a `hidden` **attribute**; the real markup uses a
  `hidden` **class**. Reading the attribute on the real elements would have
  returned false for every state - a check that runs, passes, and asks nothing.
  The claim, that the signpost appears exactly when the rows it points at do, is
  unchanged.
- **`cashflow-closing`** moved with the closing figure, from the grid to the
  section.

---

## 6. Where this leaves Session F

Every id and every class in the adoption list renders, except the one that
cannot render in jsdom at all. The remaining Session F work is unchanged: the
swap, the 22-check workflow probe against the React form, the 38 behavioural
blocks, the three-width visual comparison - **which is also where
`is-scrollable` gets its measurement** - the remaining injections, and the
written revert procedure.

Nothing live changed. `initOpportunityDealPanel` is still unregistered and the
vanilla form is still the Commercials surface.
