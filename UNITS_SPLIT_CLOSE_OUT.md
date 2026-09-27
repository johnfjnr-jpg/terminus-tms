# PANEL SEPARATION ROUND: CLOSE-OUT

Branch `units-split`, branched from `main` at `6656470`.

The round built R-US1 through R-US4 as briefed, then two rulings extended it:
R-A1P gave A1 an accountable population, and R-TC made the statement's sum row
foot its columns. This document reconciles what was ruled against what landed.

---

## 1. THE RULINGS, POINT BY POINT

| ruling | what it asked | state |
|---|---|---|
| R-US1 | Units Required and Installation as TWO panels in estate card dress | built |
| R-US2 | the responsibility control atop the Installation panel (A5 principle) | built |
| R-US3 | row pairing survives the split, by shared-track construction | built, N2 asserts it |
| R-US4 | heading-capped columns as a permanent S1 line, plus a containment check | built, in the guard family |
| R-A1P | A1's walk runs against a DECLARED roster, both directions | built, `src/lib/a1-roster.js` |
| R-TC | the Total cost row's group columns carry their REAL figures | built, with one measured departure |

No ruling was demoted and no guard was weakened. One clause of R-TC could not
hold as written and is recorded in section 3.

---

## 2. THE COVERAGE FAULT, WHICH IS THE ROUND'S REAL FINDING

**Two containers left A1's walk silently, and the second was hiding a live
defect.**

`#deal-product-grid` went out when R-US1 made the cards `<section>` elements
the walk did not enumerate, and because `rowsOf` chunked a grid's children in
runs of `cols`, which spanning cells and explicit `grid-row` break. The
estate's main pricing surface was measured ZERO times while A1 reported nine
healthy containers.

`.stmt-row-line` went out because the walk grouped cells by an exact rounded
`top`, and those rows are `align-items: baseline`. One row's six cells sat at
tops 3134, 3135 and 3136 and split into three groups; it survived while some
group still held two cells, and widening the statement grew the spread until
none did.

**Both were found by an injection coming back SILENT, not by reading the
guard.** A list of containers says nothing about the one it never looked at.

**AND REPAIRING THE PARSE TURNED THE HEALTHY STATE RED IMMEDIATELY.** The
statement's Total cost row measured 703px from label to figure at 1920 and
643px at 1240, against a 600px backstop. It had shipped with three empty group
cells since 2026-09-24, and the guard had read 142 of 142 for as long as the
container had been unparseable.

The green was not wrong about what it measured. It was measuring a smaller
estate than anybody thought, and that is what R-A1P now makes impossible.

---

## 3. R-TC, AND THE ONE DEPARTURE

**Built as ruled.** The group columns carry the hardware, hosting and
installation cost subtotals, read from the same three expressions the cost
rows above already use, so `statement.ts`'s one rule - no new arithmetic -
holds. Measured, label to figure: **703px to 223px at 1920**, **643px to 289px
at 1240**. Screenshots opened and read at both widths.

**Every column foots down to the row**: hardware 564,000 plus warranty 10,000
makes 574,000; hosting 498,000; installation 297,000.

**THE DEPARTURE.** The ruling asked that the three group figures sum to the
Total cost figure. **They cannot.** `src/lib/deal-calculator.js:640`:

```js
const totalDealCostAll = totals.totalDealCost + (financeCost ?? 0)
  + tax.whtBorne + testBedCostAmount;
```

Factoring interest, Test Bed cost and absorbed WHT are full-width rows
belonging to no group, so the three group columns sum to `totals.totalDealCost`
and the total column carries `totalDealCostAll`. On the suite's own driven
fixture that is **885,500 against 934,587**, a shortfall of 49,087 which is
exactly finance cost plus the Test Bed cost. On the live deal it is **1,369,000
against 1,983,983**.

So the reconciliation is asserted in the only form that can hold, **with the
three unattributed rows named**, and one of the four injections is aimed at
exactly that error, so the departure is itself calibrated rather than merely
explained.

**The row is the foot of each COLUMN, not a horizontal sum.** That is worth
stating because it looks like an arithmetic error to a reader who expects the
row to add across, and the comment at the site says so.

**The census the ruling asked for: Total cost was the ONLY row of this shape.**
Every `moneyOut` sibling uses the dash constant, the RESULT rows are a separate
one-figure shape already capped by the C2 cap family, and the other
presentation (`DealPanel` via `rows.ts`) renders a full-width row as a single
SPANNING cell, so it has no blank group columns at all. `rows.ts` was
deliberately not changed: the unfold ruling's design for that surface is the
spanning cell, and that surface sits inside a collapsed disclosure.

---

## 4. CALIBRATION, BOTH DIRECTIONS

Nineteen injections. **Every one fired on its own named assertion**, and every
reverted run came back GREEN with the tree byte-identical.

| injection | verdict |
|---|---|
| A1 a good row stretched | FIRED, 6 failing |
| A2 the panel-sized stretch regrown | FIRED, 6 failing, after re-pointing |
| A4, A5, A6, W1, W2 x2 | FIRED |
| R-US3, R-US4 x2, R-ADJ1, dead selector | FIRED |
| R-TC group cells blank again | FIRED |
| R-TC a column that no longer foots | FIRED |
| R-TC the total that forgets the unattributed rows | FIRED |
| R-TC a hosting figure the term does not support | FIRED |
| R-A1P a rostered container leaves the walk | FIRED |
| R-A1P a shipped container nobody rostered | FIRED |

**A1 was SILENT before this round's parser fix and FIRES now**, which was the
ruling's own test of the fix.

**A2 was re-pointed, and the premise failed rather than being re-weighed.** Its
comment claimed A1 caught the fault second and the containment check first.
Measured, A1 was not catching it at all: R-US1 had taken the product grid out
of the walk, so containment was the only guard left, and the ordering story
looked sensible while it was a hole. With the parse repaired the injection
falsifies A1's own growth clause, which is the assertion that NAMES A2's claim.

### The three injections that cost the most, and each found a real fault

- **Hiding `#deal-product-grid`** made the probe throw at `states completed:
  0 of 6`, so the roster assertion never ran. Verification 9's clause: an
  injection can fire without reaching the check it was written for. It exposed
  **two defects in the new work**: the roster check was gated on the run
  COMPLETING, so it skipped itself on exactly the fault it exists to catch;
  and the R-US4 ratchet returned a shrink verdict from a run that had measured
  nothing. Both fixed.
- **Hiding `.ys-line--total`** came back SILENT on a full-length run. The
  injection had never applied: it lands at line 1718 and `.ys-line { display:
  flex }` sits at 6956 with equal specificity, so source order won.
  Verification 51: confirm the injection fired before reading its silence.
  Re-anchored at `.ys-line.ys-line--total`, 0,2,0, it FIRES.
- **The full 15-state matrix** failed the roster in both directions on its
  first run, correctly: hybrid ships `ds-row` and the milestone grid total and
  does NOT ship the yearly stack. The roster now models that swap.

---

## 5. LIVE PROOF

```
341 of 341 checks passed
states completed: 15 of 15
```

1920, 1440 and 1240, across capex and opex, twoPhase and hybrid, Per Unit and
Lump Sum, fx on and off. The roster reports **13 of 13 rostered containers
found and measured over 15 states**, and **13 found, all rostered**.

On the six-state FAST matrix the run is 144 of 144, and the two hybrid-only
entries are NAMED as untested by that run rather than silently counted as
satisfied.

**Screenshots opened and read**, before and after, at 1920 and 1240. The
before shots are kept as `stmt-before-*.png` because they are the only
evidence of a defect the fix has removed.

---

## 6. WHAT THIS DOES NOT ESTABLISH

- **A1 counts a hyphen and a U+2014 dash as a figure.** A leader dash in a
  nearer column can satisfy the backstop for a row whose real figure is much
  further away. On this statement it changes no verdict, because the worst
  real-figure gap among the other rows is 511px, inside the bound. **QUEUED by
  John as a named detector weakness for a future round, not built.**
- **The roster covers the opportunity detail view only**, which is what A1
  walks. No other screen has a declared population.
- **The roster's predicates were derived from the 15 states this matrix walks.**
  A state combination outside it could carry a container nobody has registered,
  and the stranger check would report it on the run that first walks it.
- **`rows.ts` and `statement.ts` remain two presentations of one derivation.**
  That is deliberate and bound by an equality test; this round did not narrow
  it.

---

## 7. WHAT SURPRISED

That the coverage lesson proved itself within minutes of being built. The
argument for R-A1P was that a container leaving the walk leaves the estate's
protection silently. The first thing the repaired walk did was find a real
defect sitting on the estate's most-read financial surface, behind a green
gate, for three days.

And that a guard reading 142 of 142 an hour earlier was measuring a smaller
estate than its own report implied. The number was never wrong. It was just
not an answer to the question anybody was asking it.
