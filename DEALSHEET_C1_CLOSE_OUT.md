# Deal Sheet C1: close-out

Branch `dealsheet-1`, off `main` at `a98368d`, both preconditions confirmed:
`origin/main` equal, and walk 11's D3 present.

---

## RECONCILED BY COUNTING

| | Commit |
|---|---|
| Brief and Phase 0, with the mockup committed | `7c64a00` |
| The statement, read-only | `c1c7dce` |
| Live: the prefix collision and the full-width move | `358bf36` |
| Calibration 5/5 | `b5f9e6b` |
| Close-out and `CURRENT_STATE.md` | this commit |

**Rulings in force: 1**, the C1 instruction. Nothing was ruled in
conversation during the round.

---

## WHAT WAS BUILT

A read-only Deal Sheet statement in the summary's position: **MONEY IN**
(hardware one-off, installation, hosting over the term) to a revenue total,
**MONEY OUT** (seven cost lines including PO factoring and withholding tax)
to a total cost, and **RESULT** (profit, achieved margin against target).

- A **sticky reconciling strip** - revenue, total cost, profit, achieved
  margin with its target - pinned while the tab scrolls.
- Each money-in line and the factoring and WHT lines open a **read-only
  drawer** carrying their drivers: the unit table with per-line margins, the
  installation cost and its milestone schedule, the hosting rates per month
  and over the term, the factoring basis, the tax treatment.
- An **expand-all** control.
- **Existing panels unchanged.**

---

## NO NEW ARITHMETIC, AND IT IS ASSERTED RATHER THAN CLAIMED

`buildDealStatement` reads the same expressions `buildDealRows` reads, out of
the same `result`. Where a derivation already has an owner, the owner is
called: a drawer's margin is the group's own `impliedMarginPct`, a milestone's
dollars come from `milestoneUsdFor`, the accent comes from
`marginPresentation`.

The guard is an **equality against `buildDealRows`, figure by figure**, on a
fixture built the way the system builds one - `buildDealInputs` then
`calculateDeal` - and the fixture is asserted non-zero first, so no equality
can pass by being about nothing.

**Live, the claim holds on the real surface.** Typing 55% into the OLD
panel's SafeSight margin box moved the strip from `$1,261,453` to
`$1,388,438` and `27.9%` to `34.5%`, and the strip and the sheet still agreed
afterwards. **21/21 at 1440 and 1240.**

---

## PHASE 0'S ANSWERS

**(a)** Every figure traced to one derivation, with **one exception this
round did not cause and did not widen**: `rows.ts` multiplies the hosting
group by the months itself while `calculateContractTotals` already returns
`hostingTermPrice`. There is no `hostingTermCost` on that path to converge the
other half to. The statement reads the same two expressions, so the count of
readers stays at two.

**(b)** R-O7's price override writes `hostingPriceMode` and
`hostingUnitFees`, which `buildDealInputs` turns into a `priceOverride` per
line. It flows through `buildCostGroup` like any other line, so the group
totals are correct in both modes and the statement needs no branch on it.

**(c)** The approval version snapshot renders its own step and bridge
presentation and does not call `buildDealRows`, which has exactly one caller.
**This round cannot reach what an approver sees.**

---

## WHAT THE ROUND FOUND IN ITS OWN WORK

1. **The class prefix collided with the approval page.** `.ds-row` has
   existed at `style.css:2064` since the approval view was built - `display:
   flex`, worn by `ApprovalRow.tsx`, and "ds" means deal sheet there too. My
   rows inherited that flex, so every row-line became a flex ITEM and shrank
   to its content: **headers 327px from their columns at 1440, 227px at
   1240**. Caught because the assertion is a RELATIONSHIP - the header's right
   edge against its column's - where a rule asserting `display: grid` would
   have passed, the grid being present in a box the wrong size. Renamed whole
   to `stmt-`, not just the colliding member.
2. **The labels set one word per line**, and every assertion passed on it.
   The statement was inside `.deal-summary-col`, which is 628px once the
   detail disclosure is open, leaving 88px for the label after four money
   columns. Found by opening the screenshot; the statement is now full width
   above the row.
3. **A calibration injection came back SILENT and it was a real gap.**
   Replacing `marginPresentation` with a local `achievedMargin >= 30` passed
   every assertion, because both fixtures carry a target of 30. The test
   proved two states right for one threshold and nothing about whose rule it
   was. Closed by asserting the NOTE and adding a third fixture at a different
   target; the injection then fired.
4. **`targetMargin` cannot simply be lowered to reach `on-target`**, because
   it is what every unpriced line is PRICED at. And the warranty provision
   prices at cost, so it drags the blend under target even with no factoring
   and no Test Bed cost: 29.7753% against 30%.
5. **The `--attention` completeness guard refused the commit** until the two
   new amber sites were listed. Second time this round a completeness guard
   caught an unrecorded addition.

---

## REPORTED, NOT BUILT

1. **The mockup omits the Test Bed cost line.** It is inside
   `totalDealCostAll`, so omitting it would stop MONEY OUT summing to Total
   cost. **Included**, and the mockup read as a design for the shape rather
   than a census of the lines.
2. **Four money columns, not the mockup's three.** The mockup folds
   installation into hardware; the data has four figures and so does the
   existing matrix, and folding would mean computing a sum in the view.
3. **The matrix is not retired.** Eleven assertions are about its own
   presentation - full-width rows, memo rows, group cells - and the statement
   has no such concepts to re-point them onto. That is a decision about what
   the deal sheet IS, and it is C2's. It sits in a **closed disclosure**
   beneath the statement, so the default view is the statement alone.
4. **`COST_ROW_COUNT = 6` against seven actual cost rows**, and both it and
   `COST_ROW_LABELS_FROM` are exported and read by nobody.

---

## Exit gate

| Point | Answered |
|---|---|
| Both preconditions confirmed | **Yes**, remote equal and D3 present |
| Phase 0 (a), (b), (c) reported before building | **Yes**, and two contradictions with the design reported first |
| Read-only | **Yes.** Zero inputs, selects or textareas in the statement, asserted live and calibrated |
| Statement totals equal the derivation layer | **Yes**, figure by figure against `buildDealRows` on a driven fixture |
| The strip tracks a change made in the old panels | **Yes**, live: 27.9% to 34.5% from a margin box in the detail panel |
| Red-first | The equality suite was green on first run and is **injected against** instead; the live read-only and alignment checks were both watched firing |
| Calibrated both directions | **Yes. 5/5**, and the one silence was a real gap that is now closed |
| Live proof at 1440 and 1240 | **Yes. 21/21** |
| Screenshots opened and read | **Yes**, and one changed the work: the one-word-per-line labels |
| Existing panels unchanged | **Yes** |
| Fixtures torn down, re-queried | **Yes.** 132 live, none created in the last 6 hours, 80 counters intact |
| `CURRENT_STATE.md` regenerated | **Yes**, on a clean tree |
| Merged or pushed | **No push from the session** |

**C2 does not begin without John's verdict on this page.**
