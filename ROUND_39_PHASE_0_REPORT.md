# Round 39 Phase 0: report

2026-08-29. Measured, not read. **The brief's central sentence is wrong, and the
prototype already contains the fix.**

---

## The headline, before anything else

**Four disagreements between this brief and what is actually there.** Output item
2 asked for the count before any plan, and the count is the finding.

| # | The brief says | Measured |
|---|---|---|
| 1 | "The Deal Sheet sits on a sub-tab of its own, so **the number cannot be seen at the same time as any input that changes it**" | **False.** Achieved margin is in a four-figure strip ABOVE the sub-tab row, visible on all five sub-tabs. At minimum scroll it is on screen while `targetMargin` is being typed, at 1240x700, 1240x900 and 1920x900. |
| 2 | The cause is the Deal Sheet being on its own sub-tab | **The cause is 578px of vertical separation**, constant at every width. You adjust at the bottom of the screen and read at the top. |
| 3 | (implicit) the built layout follows the prototype | **The prototype has FOUR Commercials sub-tabs and no Deal Sheet tab.** The built system added a fifth. |
| 4 | "Payment Terms is a section somebody goes to deliberately, never one they scroll past" | **`deal-duration` - the contract term, a step-3 entry field AND a loop control - lives on Payment Terms.** |

---

## I1. The prototype, read first, with lines

`Terminus Ops.dc.html`, 11,391 lines. Search calibrated both directions before
relying on it: `targetMargin` returns 7, a string known absent returns 0, and
`file` reports UTF-8 text, so Verification 12 does not apply here.

**The Commercials tab's structure, by line:**

```
1317  <sc-if isOppTabCommercial>
1325      dealMatrix          the deal figures, ABOVE the sub-tabs, always visible
1336      oppCommTabs         FOUR buttons: hw, install, terms, payment
1340      <sc-if isCommHw>
1381      <sc-if isCommInstall>
1476      <sc-if isCommTerms>
1489          "Achieved margin {{...}} · target {{...}}"   INSIDE the margin card
1544      <sc-if isCommPayment>
```

**Line 1489 is the whole answer.** In the prototype, achieved margin is printed
**inside the Structural Terms margin card, directly beneath the margin input
rows** (`structural.rows`, 1480-1487). The control that moves margin and the
margin itself are a few pixels apart, in the same card.

**The prototype already has the adjust-and-see loop.** The built system did not
copy that line, and put the figure 578px away in a strip instead.

**Sub-tab list confirmed at 11353-11355:** `hw`, `install`, `terms`, `payment`.
**No `sheet`.** The Deal Sheet sub-tab is an invention of the build.

---

## Falsification test 1: THE LOOP IS ALREADY CHEAPER THAN THE BRIEF ASSUMES

**Fires, partly, and it changes the design.**

Measured at 1240x900, Structural Terms open, at the MINIMUM scroll that makes
`deal-targetMargin` usable:

| | |
|---|---|
| Minimum scroll to reach `targetMargin` | 247px |
| `targetMargin` in view | yes |
| **Achieved margin in view** | **yes**, at top 258 |
| Gap between them | **578px** |

Repeated at 1240x700 (min scroll 447, achieved margin at top 58, still on) and
1920x900 (min scroll 210, achieved at 258). **The gap is 578px at every width.**

**An instrument fault worth recording.** The first attempt used
`scrollIntoView({block:'center'})` and reported the strip off screen at top -167,
`BOTH_VISIBLE_TOGETHER: false`. That is my instrument choosing a scroll position
a person need not choose. Before that, an earlier run returned every rect at
`top: 0, height: 0` with `bothVisibleTogether: true` - the Commercials panel had
never opened, and the "true" was computed from zeros. Verification 18: fixing the
first blindness revealed the second, and only the third reading measured anything.

**So the honest statement is:** the number is reachable during adjustment, and it
is half a screen away. **The cost is a saccade across the whole viewport on every
iteration, not a tab switch.** At 1240x700 the margin sits 58px from the top edge,
one notch of scroll from gone.

---

## The loop's real anatomy, which nobody had measured

The business's step 5 is "almost always discount, occasionally term". Those
controls live in three different places:

| Loop control | Sub-tab | Cost per iteration |
|---|---|---|
| `targetMargin` | **terms** | 0 switches. Margin visible above. |
| per-line `marginOverrides` | **hw** and **install** | 1 switch each way |
| `duration` (term) | **payment** | 1 switch each way |

**So the common path is already switch-free and the term path is not**, and the
term path goes to Payment Terms, the one section the business said they never
scroll past.

---

## I3. Recompute cost

12 consecutive `input` events on `targetMargin`, timed:

| best | median | worst |
|---|---|---|
| 4.9ms | **6.9ms** | 15.1ms |

**A live loop is affordable and nothing needs debouncing.** The margin moved
17.5% to 14.4% across the twelve, so the loop was really running.

---

## Falsification test 2: ENTRY DOMINATES FOR SOMEONE NEW

**Fires, and it is the sharper of the two.**

Explanatory notes per sub-tab, counted:

| Sub-tab | Controls | Explanatory notes |
|---|---|---|
| Hw / Hosting Setup | 17 | 7 |
| **Installation** | **25** | **0** |
| Structural Terms | 7 | 7 |
| **Payment Terms** | **19** | **0** |

**`installResp` has no explanation at all.** That is the business's own step 2 -
*"mounting: existing infrastructure or new. A choice, not a number, and it drives
install cost"* - and the control offers four options with nothing on screen
saying what any of them does to the number.

**Installation is the largest panel in the tab (25 controls) and the least
explained (0).** For somebody who has not priced one before, that is where the
time goes, exactly as predicted.

---

## I4, I5, I7

**I4. Payment Terms** carries 19 controls including `duration` and
`recoveryMonths`. Its own labels are sparse (`Invoicing`, `Recovery period`,
`Closing position over contract`), and it has zero explanatory notes.

**I5. The sub-tab machinery is 13 lines in one place**
(`opportunity-deal.js:1458-1465`): a toggle listener and a panel-hiding loop.
**One fragile reader**: the recompute listener at 1467-1471 enumerates panels by
id, so removing a panel silently removes its live recompute. That is the
Architecture rule 9 shape and it is the thing to be careful of.

**I7. Nothing outside Commercials reads the sub-tab ids.** Confirmed by grep
across `app.js`, `opportunity-reference.js`, `opportunity-approval.js` and
`test-bed-detail.js`: zero matches.

**I6 (three-width baseline) is NOT complete.** The gap and viewport measurements
above are taken; the full task-1 and task-3 walks at three widths are not, and
should be captured before Phase 1 changes anything.

---

## What this means for the plan, stated but not proposed as one

The brief said "entry that reaches a number quickly, then a tight
adjust-and-see loop". **Both halves survive, for different reasons than the brief
gave:**

- **The loop's problem is distance, not switching.** 578px. The prototype solved
  it by printing achieved margin inside the margin card (line 1489). That is a
  small change and it is the highest-value one in the round.
- **`duration` is in the wrong place.** It is entry AND a loop control, and it
  sits in the section nobody opens.
- **Entry's problem is explanation, not layout.** 25 controls and 0 notes on
  Installation, and no explanation on the one choice the business names as
  driving install cost.
- **Removing the sub-tabs is cheap** (13 lines, no outside readers) **and is not
  the fix on its own.** It would not shorten the loop, which is already
  switch-free on its common path.

**A plan is not proposed here.** Output item 3 says a plan comes after the
disagreement count, and the count above changes what the round is for.
