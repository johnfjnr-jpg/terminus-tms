# Migration Round 3, Session D1: the render components

**2026-09-05.** Gate green at **21 stages**, React suite **344/344**. Nothing
pushed. Session D2 not started.

**Nothing is live.** No swap, no re-points, no registration.
`frontend/opportunity-deal.js` is untouched and still the panel a person sees.

---

## 1. Composition

`panelParts.tsx` holds the render halves of the Session C models; `DealPanel.tsx`
composes them with the Session A core.

| part | draws |
|---|---|
| `CashFlowGrid` | months across, categories down, with the scroll container |
| `YearScheduleView` | the down-reading year lines, or the hybrid list |
| `MilestoneGrid` | the customer grid, USD read-only and computed |
| `ContractorGrid` | both sides writable, the round trip, reconciliation |
| `InstallationTab` | visibility per responsibility |
| `SwitchButton` | the two toggles, which are the same control |
| `StructureVisibilityRegions` | the five hybrid/single/two-phase regions |

**Each part draws a model and decides nothing.** The rulings live in the models -
which is why they were testable before any JSX existed - and what is left here is
the visual half of the same facts.

**`markCashFlowScrollable` is ported as an effect with a `ResizeObserver`.** The
class says whether the grid actually overflows, and the observer is what keeps
the answer current: the element gets its width when it is revealed, when the
window resizes, and when the detail panel opens beside it. Measuring once at
render would be right only for the first.

**Section saves are wired per B5/B6**: created and destroyed by need, and each
saves the whole sheet through one handler.

## 2. Tests: 27 new, 344 total

The render facts Session C could only assert at model level:

- **a zero cell renders as a dash** - and the fixture is the hosting FEE row,
  because measured under annual invoicing 22 of 24 months are zero there, while
  `Hosting cost` has none and could not have tested it;
- **cash out carries a leading minus and cash in does not**, asserted as a
  contrast on the same grid;
- **a negative cumulative is coloured and a positive one is not**, on a fixture
  measured to have **12 of each**;
- **the signpost is never out of step with its rows**, across every
  responsibility;
- **section saves appear, appear only for their own section, and disappear
  again** when the value is typed back;
- **the four empty-state contracts each show their own placeholder**, and the
  catalog figure is a placeholder rather than a value.

## 3. Calibration: twelve injections, all fired

| injection | result |
|---|---|
| `numOrUndefined` placeholder lost | 1 failed |
| `num` placeholder says "not recorded" | 1 failed |
| `numOrNull` placeholder becomes "0" | 1 failed |
| **`emptyToNull` loses its inputMode rule** | **26 passed at first - see below** |
| **the catalog becomes the VALUE** | **4 failed** |
| a section save is always shown | 3 failed |
| a section save is never shown | 3 failed |
| the cash-out sign is dropped | 1 failed |
| a negative cumulative is not coloured | 1 failed |
| the signpost drifts at render | 2 failed |
| the customer USD becomes writable | 1 failed |
| reverted | 27/27 |

**The one that did not fire found a real gap**, not a bad injection: nothing
asserted that the two `emptyToNull` currency fields get **no** `inputMode`. They
hold codes, not numbers, and a decimal keypad on them is wrong on a phone and
wrong about what the field is. A test was added - with the contrast against a
numeric field on the same panel, so it is not asserting a property nothing has -
and the injection then fired.

## 4. What surprised

**The tests found an omission in my own render immediately.** Three
section-save tests failed because I had wired `sectionSave` into the milestone
and contractor sections and **not** into the five census sections' latch rows.
The dirty model was correct; the render only used it in two places out of seven.

**Three of the six first-run failures were my own guards working.** "no zero
month in this fixture, so the dash is untested" and "every cumulative cell is
the same colour, so the rule is untested" are the messages the non-zero rule was
written to produce, and both were true. Rather than weaken the assertions, I
measured four deal shapes and picked fixtures that exhibit each fault - which
turned up that **`contractorStaged` is false on every shape measured**, so the
staged cash-out row is only reachable at model level.

**The failure diagnostic paid for itself.** `cfRow` throws with the full list of
rows actually present, so "no cash-flow row 'Hardware and warranty'" arrived
with the answer attached rather than as a bare undefined.

## 5. Gate

```
MERGE GATE  21 stages
  PASS  pure suite                 440/440 pass, 0 fail
  PASS  database suite              92/92 pass, 0 fail
  PASS  react typecheck
  PASS  react suite                344/344 pass, 0 fail   (317 + 27)
  PASS  react bundle freshness
  PASS  14 HTTP probes
All 21 stages passed.
```

`dist` unchanged: nothing imports the panel, because nothing registers it.

---

## Standing at the close

Not pushed. **Session D2 not started**: the swap, the re-points, the 38-block
verdict and the visual comparison.

**One thing D2 should know.** The panel renders every model, but it is composed
for TESTS rather than for the vanilla's markup: the sections carry
`data-testid` and neutral class names, not the vanilla's ids and layout classes.
**Pixel parity is therefore not expected to hold on the first swap**, and D2's
visual comparison is where that gets measured and closed rather than assumed.
