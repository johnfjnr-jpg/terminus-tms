# Migration Round 3, Session C: the four remaining surfaces

**2026-09-05.** Gate green at **21 stages**, React suite **317/317**. Nothing
pushed. Session D not started.

**Nothing is live.** No swap, no re-points, no registration. `frontend/opportunity-deal.js`
is untouched and still the panel a person sees.

---

## 1. What was built

Four modules, each a **pure model** rather than a render, which is what makes
the vanilla's stated rulings assertable without a DOM.

| module | surface |
|---|---|
| `cashflow.ts` | the month-by-month grid, plus closing cash through the shared presenter |
| `schedule.ts` | `computeYearBuckets` and the year schedule |
| `milestones.ts` | both grids, the pct/usd round trip, reconciliation rendering |
| `installation.ts` | the tab's visibility and the button-state machinery |

### The cash-flow grid

**The row SET is conditional and that is the part worth testing.** Factoring,
contractor staging and the missing-term state each change which rows exist:

- factoring off omits three rows; on adds three;
- contractor staging splits `Hardware, warranty and installation` into
  `Hardware and warranty` plus its own `Contractor milestone payment`;
- **factoring on with no term prints ONE row that says so** rather than two
  full runs of zeros for a facility that is switched on.

Zero renders as a dash; cash-out is stored positive and displayed with a leading
minus; a negative cumulative position is coloured.

**Closing cash reads through `closingCashPresentation`**, the shared presenter -
the four disagreements Round 41 W5 measured (no symbol, bare minus, `"0"`,
`"--"`) cannot recur because there is no second reader.

### The year schedule

**A re-grouping of already-computed monthly rows, never a fresh accrual.** The
prototype re-derived it through a second helper duplicating the finance model's
logic; that drift risk is deliberately not inherited, and a test asserts the
buckets sum to the monthly rows.

Hybrid schedules **hosting only**, because hardware is milestone-driven and
would double-count. Single shows a recovery **readout**, and an unset duration
**says so**.

### The two milestone grids

They are the **same component with different bases**. Both read
`Month | Milestone | % | USD` and in both the **USD is computed from the
percentage**, to two decimals, because a percentage of a six-figure total lands
on cents and rounding it away would make the column not sum.

**An unrecognised stored milestone keeps its own option**, labelled
`(not in the list)` - existing deals hold free text and a dropdown that
discarded it would lose what somebody entered.

**Reconciliation:** the total percentage may not round itself into agreement
(`.toFixed(1)` once printed 100.008% as "100.0%"); a **dateless row counts
toward the total and blocks a version**; and the two refusals are **separate**,
incomplete leading, because they are fixed differently.

### The installation tab

Visibility and button state are pure functions of `uiState` - as they are in the
vanilla, which only differs in writing classes instead of returning a shape.

**The signpost appears exactly when the rows it points at do**, asserted across
all four installation responsibilities so the two can never drift.

## 2. Tests: 38 new, 317 total

Derived from the vanilla's stated behaviours and the census, not its markup.

**The non-zero rule from Session A is applied throughout**: every assertion
about a difference uses a fixture where the difference is non-zero and asserts
it. Examples - the monthly and annual readings of a year bucket are asserted to
**differ**; the hybrid schedule is asserted **smaller** than the non-hybrid; the
$16 overrun's total is asserted as `$200,016`.

## 3. Calibration: eleven injections, all fired

| injection | result |
|---|---|
| zero prints as `0` not a dash | 1 failed |
| missing factoring term prints zeros | 1 failed |
| year buckets over-count | 2 failed |
| hybrid schedule includes hardware | 1 failed |
| **the total percentage rounds itself into agreement** | **1 failed** |
| **the pct/usd round trip loses its usd side** | **1 failed** |
| trailing zeros not trimmed | 2 failed |
| an unknown milestone option is discarded | 1 failed |
| milestone USD to 0 decimal places | 1 failed |
| the signpost drifts from the table | 1 failed |
| single shows the recovery INPUT | 1 failed |
| reverted | 38/38 |

**Two were SKIPPED on the first run, not passed**, and the harness said so:
`ANCHOR NOT UNIQUE - injection skipped`. The shell had expanded the `${...}`
template literals in my injection text. Re-authored through a file so the
literals survived, and both then fired. **A harness that reported them as
passing would have left two of the round's most important behaviours
uncalibrated** - the reconciliation rounding and the round trip.

## 4. What surprised

**Two of my test expectations were wrong, and both were hand-computed.** A
selector reading `includes('Hardware')` matched `Hardware recovery, annual` - a
cash-IN row - before the cash-out row it meant. And I asserted
`milestoneUsdFor('33.33', 123456)` as `41147.29` from mental arithmetic; it is
`41147.8848`. **That is Verification 20's hand-typed-number shape arriving in a
fixture**, and it is the third time this round. The test now asserts against
`((33.33 / 100) * 123456).toFixed(2)` as well as the literal, so the two must
agree.

**The `-500` failure looked like a product defect for a moment.** A cash-out row
displaying `1,000` is exactly what a broken sign convention would produce. It
was an ambiguous selector, and the tell was that the value was a cash-IN figure
rather than a wrongly-signed cash-out one.

**Three `src/lib` boundaries needed no accommodation this session** -
`scheduleReconciliation`, `closingCashPresentation` and `toNumberOrNull` all
typed cleanly through the boundary, which is worth recording after two sessions
where every import needed a cast.

## 5. Gate

```
MERGE GATE  21 stages
  PASS  pure suite                 440/440 pass, 0 fail
  PASS  database suite              92/92 pass, 0 fail
  PASS  react typecheck
  PASS  react suite                317/317 pass, 0 fail   (279 + 38)
  PASS  react bundle freshness
  PASS  14 HTTP probes
All 21 stages passed.
```

`dist` unchanged: nothing imports these modules, because nothing registers the
panel.

---

## Standing at the close

Not pushed. **Session D not started.** The four surfaces exist as tested models;
what Session D adds is the swap, the re-points, the 38-block verdict, the
render-level injections and the visual comparison.

**One thing Session D will need that this session did not build: the React
components that render these models.** The models are complete and proved; the
JSX that draws them is part of the swap, because a component nothing mounts is
untestable in the way that matters.
