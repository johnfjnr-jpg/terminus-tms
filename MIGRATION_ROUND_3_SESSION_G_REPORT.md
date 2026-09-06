# Migration Round 3, Session G: the carried items

**Gate: 5 of 21 stages green, 16 NOT RUN.** The dev session's refresh token
expired mid-session and its recovery path needs a password I do not have. This
is an environment condition, not a finding, and section 6 says exactly what it
blocks. Not pushed.

---

## 1. The 38 behavioural blocks

**The classification reconciles**: 38 behaviour / 17 source-shape / 8 stylesheet,
exactly Phase 0's numbers, using Phase 0's own rule.

**The 38 split 12 / 26, and the split is the answer to "run each against the
React panel".**

| disposition | count | which, and why |
|---|---|---|
| **runs unchanged** | **12** | they assert `src/lib` directly - the presenters, the calculator, the rate reader. Both forms call those, so they are the shipped logic under either. Nothing to re-point |
| **models a superseded implementation** | **26** | they run against a LOCAL HARNESS: a cut-down panel and a re-implementation of "the wiring, assembled the way opportunity-deal.js assembles it". They never loaded the vanilla and they do not load React, so they pass whatever the live panel does |

**None is non-runnable.** All 38 run and pass. The 26 simply do not measure the
live screen, which is a different problem from failing.

**What running their claims against React found:**

- **A defect.** `buildBasis` computes `ageBand` and section 4 dropped it, so an
  **ageing, stale or undated cost basis rendered in exactly the treatment of a
  current one**. `style.css` carries three rules keyed on that class and none
  could apply. The identity ratchet could not see it: those classes are applied
  by JS and the census fixture's batch is current.
- **Two coverage holes.** The two achieved-margin renderings were asserted equal
  at ONE state, which cannot catch Round 39's actual fault - both start equal,
  and the rule was toggled on one of them - so the deal now MOVES and both are
  re-read. And the staleness bands had no React assertion at all.

**The two sets are disjoint.** The instruction offers the 24-entry coupling
ledger as this item's work list. A behavioural block is defined as reading no
frontend source and a coupled block as reading it, so no block is in both. The
ledger is the work list for the source-shape and stylesheet halves.

---

## 2. The visual comparison: **exact parity**

Both forms are capturable because the swap HID the vanilla rather than deleting
it. A harness restores the script tag, runs the probe as the vanilla, and puts
`index.html` back - **verified byte for byte**, because a harness that leaves the
tag in has silently un-swapped the application.

**Final state, at 1920, after the fixes below:**

| measure | React | vanilla | difference |
|---|---|---|---|
| visible controls | 26 | 26 | **none** |
| rendered text lines | 505 | 505 | **none, either direction** |

**THE INSTRUMENT WAS WRONG THREE TIMES FIRST, and each failure is the same
family.**

1. **17 captures of pure background.** An element screenshot taken while the
   panel was mid-render. Every hash compared cleanly, because a blank image is
   not a failed check, it is no check. Verification 4's refinement exactly. Each
   shot now carries the panel's text length and control count, and a shot of
   nothing is a failure rather than a hash.
2. **The wait was satisfied by the wrong form.** "More than 20 controls" was
   true of the HIDDEN vanilla's 56 inputs, which are still in the DOM, so the
   probe shot before React had mounted anything. It now waits on RENDERED TEXT,
   which is what a screenshot photographs.
3. **Two states with different text produced an identical hash at 1920.** An
   element screenshot of a 3179px-tall panel captures beyond the viewport and
   went stale. The capture is now the VIEWPORT, which is also what a person
   sees.

**The clock band did its job**: two captures of `#app-clock` a second apart
differ every run, which is what proves the comparison can see a difference at
all.

### The seven differences it found, all fixed

| difference | what it was |
|---|---|
| **six catalog readouts visible** | the vanilla holds `deal-ssUnitCost` and its five siblings `hidden`. React rendered six extra boxes on screen |
| **a leftover structure select** | the D1 scaffold's `ui-structure` select survived beside the ring radios: two controls for one choice |
| **currencies were free text** | the vanilla's bid and proposal currency are a fixed list. React let a deal record a currency the shell does not know |
| **nine renamed labels** | "Air Quality units" for "AQ Sensor", "FX contingency %" for "% Currency Contingency", "Recovery months" for "Recovery period (months)" and six more. **A display rename is a decision and this round was not making one** |
| **three sub-headings missing** | Margin and Warranty, Currency, Tax Adjustments |
| **eight field notes missing** | the controls were there and the explanation of what they do was not |
| **the gross-up switch lost two classes** | `SwitchButton` never carried `btn-ghost deal-toggle`. **The identity ratchet passed anyway**, because the factoring toggle in section 5 carries them: a class present on one control is not that class present on the control that needs it |

`CURRENCY_CODES` is a `const` in `app.js`, which no bundle can reach - the Round 2
trap. The React tree carries its own copy and
`scripts/tests/currency-codes.test.mjs` **proves the two equal** by extracting
the array from `app.js`'s source, rather than asserting it in a comment.

---

## 3. Injections

Verified-snapshot harness, restore checked after each, final reverted run green.

| injection | verdict |
|---|---|
| the age band dropped from the render again | FIRED |
| the accent painted on one rendering only | FIRED |
| the local figure reading something other than the shared presenter | FIRED |

Session F's eight and Session E's earlier sets stand. **The render-level
injections item is partly done**: these three cover what this session built, and
a sweep of what D1 and E did not cover is carried.

---

## 4. The closing strings scan

Verification 41's STRINGS clause, across the React tree and the split files.
Three results, all acted on:

- **`ui-structure`, `ui-invoicing`, `ui-installResp`: zero hits.** The scaffold
  selects are gone.
- **`InstallationTab` and `StructureVisibilityRegions` were still in the tree**,
  and `StructureVisibilityRegions` was still RENDERING five empty placeholder
  divs into the live DOM. Both removed; `intake.tsx` and `section5.tsx` own
  what they used to stand in for.
- **`deal-matrix`** survives only in a comment recording that it was a React
  invention with no rule, and in two negative assertions that it is gone. Both
  correct.

---

## 5. The ledger

| class | blocks | disposition |
|---|---|---|
| **behaviour** | 38 | 12 run unchanged as `src/lib` tests; 26 model a superseded implementation, their claims now covered against the live panel, with two holes closed and one defect fixed |
| **source-shape** | 17 | 3 re-pointed (D2c, F); 14 outstanding, enumerated and enforced by `vanilla-coupling.test.mjs` |
| **stylesheet** | 8 | outstanding |
| **updated, claim changed by adoption** | 5 | the two behind-the-line assertions and the exact-global-surface test (F); the factoring switch wording and the shared catalog fixture (E) |

**Claim changed by adoption, added this session:** the nine census labels. They
were written for the migration rather than taken from the screen, and the
comparison is what found them.

---

## 6. What the expired session blocks

**Ran, and green:** pure suite 448/448 · database suite 92/92 · react typecheck ·
react suite 429/429 · react bundle freshness.

**Not run:** the 16 HTTP stages, including the version-workflow and
`is-scrollable` probes this round's earlier sessions passed. They need a live
`session-ref.json`; the refresh token is spent and `scripts/sign-in.js` needs a
password I do not have.

**This is Verification 25's corollary, exercised for real**: the recovery path's
own prerequisite is the thing that has expired. Nothing in this session's work is
known to have broken them - they were green at Session F on the same probes -
but I have not re-run them and am not claiming they pass.

**To clear it:**

```bash
node --env-file=.env scripts/sign-in.js <email> <password>
```

then `npm run verify`.
