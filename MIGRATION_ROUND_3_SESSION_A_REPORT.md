# Migration Round 3, Session A: the calculator core, behind the line

**2026-09-05.** Gate green at **20 stages**, React suite **253/253**. Nothing
pushed. Session B not started.

**Nothing is live.** The bundle does not register `initOpportunityDealPanel`, no
script tag moved, and `frontend/opportunity-deal.js` is untouched and still the
panel a person sees. Asserted, not assumed - a test imports `main` and checks
the global is `undefined`.

---

## 1. What renders

`frontend-react/src/deal/`:

| module | what it is |
|---|---|
| `payload.ts` | the reader, proved exact in the previous session |
| `census.ts` | the 39+ inputs as DATA, each carrying its empty-state contract |
| `rows.ts` | the unfold ruling, pure: result + payload in, rows out |
| `useDealForm.ts` | form state and `recompute` |
| `DealPanel.tsx` | the panel |

**The values map IS the state**, `id -> string`, deliberately: it is exactly
what the proved reader takes, so the thing under test and the thing the screen
holds are the same object. A richer shape would need converting before every
read, and that conversion would be a second reader of the form sitting between
the screen and a payload already proved exact.

**The four empty-state contracts are render-level facts, per input, with no
normalisation.** An input writes the string typed, `''` included; nothing
between the box and the reader coerces anything. Each control carries
`data-contract`, so a render that flattened two contracts into one treatment is
visible in the DOM.

**The catalog is self-fetched** through the query layer (`GET /api/base-costs`)
and the six rate readouts render from it, `readOnly`. **A readonly input here is
a display of a rate, not a record of one** - and the four installation overrides
show the catalog figure as a **placeholder**, never as a value, because an empty
box there means "no override, use the catalog" and putting the number in the box
would record a per-deal override of the catalog on every deal.

## 2. What computes

`recompute` is the vanilla's, function for function: `readDealPayload` ->
`resolveRates` -> `buildDealInputs` -> `calculateDeal`, all three imported from
`src/lib` untouched. A compute failure is **rendered**, never swallowed: the
vanilla would throw into the console and leave the last figures on screen, which
on a pricing surface is the worst outcome - stale numbers that look live.

**The unfold ruling is ported as a pure model**, which is what makes it
assertable: the vanilla expresses it in string concatenation, and the ruling is a
statement about what an approver can follow rather than about markup.

## 3. Tests: 23 new, 253 total

Derived from the census and the unfold ruling, not from the vanilla render.

The load-bearing one: **Total cost is the visible sum of the six cost rows
directly above it**, parsed off the rendered column and added up - the ruling's
own sentence, asserted the way an approver would check it.

Plus: full-width rows carry exactly one cell at both model and render level; the
memo margin sits **after** the total and is not called "Margin"; gross-up changes
the WHT row's **label**, not only its figure; and the panel is behind the line.

## 4. Calibration: eight injections, and four of them did not fire at first

The four that passed are the useful part of this report.

| injection | first run | after fixes |
|---|---|---|
| the memo row moves above the total | fired | fired |
| gross-up label frozen | fired | fired |
| a margin input lost from the census | fired | fired |
| rate readout made writable | fired | fired |
| **THE FOLD RETURNS** | **passed** | **fired** |
| **dead cells return to the model** | **passed** | **fired** |
| **contracts flattened** | **passed** | **fired** |
| catalog figure becomes the value | passed (ill-aimed) | fired |
| reverted | 23/23 | 23/23 |

### a. The fold injection passed because the fixture had nothing to fold

Folding `financeCost` back into Total cost changed nothing, because the fixture
had **factoring off and `financeCost === 0`**. Measured directly: factoring off
-> 0; factoring on at 8% over 6 months -> 3,960.

**The round's most important assertion was passing on a deal where the folded
quantity could not vary.** Verification 25: the right measurement on a
population that cannot exhibit the fault.

Fixed with a fixture where **all three folded quantities are non-zero**, and a
test that asserts they are - so the sum test can never again silently measure a
deal with nothing to unfold.

### b. The contract test was a tautology

It read the census's declared contract and compared it to the census's declared
contract. Changing a census entry changed both sides. **Verification 17: a probe
that runs cleanly and cannot tell the two states apart.**

Replaced with one that asks the **reader** what an empty box does to that key,
which is what the declaration is a claim about.

### c. And its replacement had a skip that read as a pass

The rewrite still passed the flattening injection, because an id absent from its
key map hit a `continue`. **A skip is not a pass**, so an unmapped census entry
now fails with a message naming it, and the map covers all eighteen.

### d. The dead-cells injection targeted the model, which the render ignores

The render emits group cells only when a row is not full-width, so a model
carrying dead cells was invisible to a render-level assertion. The model is now
asserted directly too.

## 5. What surprised

**Three of the four non-firing injections were faults in my own tests, and the
fourth was a badly aimed injection.** The suite read as thorough and had a
tautology, a skip-as-pass, and a fixture that could not exhibit the very fault
the round exists to prevent.

**`tsc --noEmit` is not a gate stage.** The parity test's use of `node:fs` and
`jsdom` produced four type errors that the gate could not see, because the gate
runs `vitest` (which transpiles without typechecking) and `vite build` (which
only compiles the entry graph - and nothing imports these modules yet). Fixed by
adding `@types/node` and `@types/jsdom`. **Named as a gap: a type error in the
React tree can land green today.**

**`buildDealInputs`' options type is inferred from its `= {}` default**, so TS
sees only `testBedCost` and rejects `rates` - which the function requires and
throws without. Accommodated at the call site with the reasoning written there,
because `src/lib` moves untouched.

## 6. Gate

```
MERGE GATE  20 stages
  PASS  pure suite                 440/440 pass, 0 fail
  PASS  database suite              92/92 pass, 0 fail
  PASS  react suite                253/253 pass, 0 fail   (230 + 23)
  PASS  react bundle freshness
  PASS  14 HTTP probes
All 20 stages passed.
```

`dist` is unchanged: nothing in the bundle's entry graph imports these modules,
because nothing registers the panel.

---

## Standing at the close

Not pushed. **Session B not started**, and its scope is unchanged: the grids and
schedules, dirty tracking B1-B7, `saveDeal`, the version interface, the swap,
the re-points, and the 38-block verdict.
