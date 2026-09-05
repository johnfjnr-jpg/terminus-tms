# Migration Round 3, Phases 1 and 2: partial

**2026-09-05.** Gate green at **20 stages**, React suite **230/230**. Nothing
pushed. Phase 3 not started.

**THIS REPORT IS A PARTIAL DELIVERY AND SAYS SO UP FRONT.** The round's central
proof is built and verified. Most of the panel is not. Section 5 is the
line-by-line statement of what is not done, and it is longer than the statement
of what is.

---

## 1. What was built: the payload reader and the parity proof

The brief names the round's central claim as a reduction:

> The React panel imports `resolveRates`, `buildDealInputs` and `calculateDeal`
> from `src/lib` untouched. Therefore the whole computational claim reduces to:
> **for identical visible inputs, the React payload reader produces a payload
> deep-equal to `readPayload()`'s.**

**That reduction is now proved.**

`frontend-react/src/deal/payload.ts` is the React reader: the four numeric
helpers, both milestone readers, `readDealPayload`, `pickSalespersonWritable`,
`MARGIN_KEYS`, `COMMERCIALS_OWNED_KEYS`.

**It takes VALUES, not a DOM** - `id -> string`, which is the visible input space
itself. The vanilla reads `document.getElementById(id).value` because the DOM is
its state; React's state is not the DOM, and a reader that went looking for
elements would be testing the render rather than the read.

### The vanilla reader is EXECUTED, not reimplemented

This is the load-bearing decision in the whole proof. `deal-payload-parity.test.ts`
extracts `num`, `emptyToNull`, `numOrNull`, `numOrUndefined`, `readMilestones`,
`readContractorMilestones`, `readPayload` and `pickSalespersonWritable`
**verbatim from `frontend/opportunity-deal.js` by brace-balancing**, and runs
them in a `new Function` against a jsdom document built from the same corpus
entry.

**Writing a second copy of the vanilla reader here would have proved that the two
copies agree and nothing else** - Verification 20, and the exact fault the proof
exists to rule out.

The input id list is likewise **derived from the vanilla source**, not typed: a
corpus built from a hand-written list stops covering the reader the moment
somebody adds an input.

### The corpus crosses the four contracts

| entries | what they exercise |
|---|---|
| filled / empty / **every element absent** | the three global states |
| **11**, one per margin key emptied | `numOrUndefined`: the key is DROPPED |
| 3, margin element absent entirely | absent element vs empty string |
| 4 | `numOrNull` incl. non-numeric text |
| 2 | `emptyToNull` |
| 2 | `num`: empty is a VALUE, zero |
| 4 | milestone/contractor filter asymmetries |
| 2 | decimals, negatives |
| x **3 uiState variants** | structure, invoicing, grossUp, factoring, installResp |

**97 tests, all passing.** Every corpus entry asserts `toEqual` **and** the
`marginOverrides` key set, because `toEqual` treats an undefined-valued key as
absent and the deletion contract lives exactly there.

## 2. Per-contract injection evidence

Verified-snapshot harness, final reverted run included.

| injection | result |
|---|---|
| `num`: empty -> `null` not `0` | **13 failed** |
| `emptyToNull`: keeps `''` | **7 failed** |
| `numOrNull`: empty -> `0` | **19 failed** |
| `numOrUndefined`: -> `0` (the deletion contract) | **49 failed** |
| contractor `pct` defaults to 0 | **4 failed** |
| milestone filter loosened to amount-only | **4 failed** |
| **`pickSalespersonWritable`: keep `undefined`** | **97 passed - DID NOT FIRE** |
| reverted | **97 passed** |

### The injection that did not fire, and why it is a finding rather than a gap

Removing the `undefined ? null` coercion changed nothing. **Twice** - the second
time after adding an assertion specifically able to see it, since `toEqual`
ignores undefined-valued keys and `Object.keys` counts them as present.

**The branch is unreachable from this reader.** `readDealPayload` assigns every
one of the 26 owned keys unconditionally - `marginOverrides` is always an object,
both milestone readers always return arrays - so `payload[key]` is never
`undefined`.

**The vanilla shares the identical unreachable branch**, so parity holds either
way. The coercion is correct defensive code and stays: it is the projection's
guarantee to the save path, not this reader's. But it is not evidence about this
reader, and a calibration that passes while proving nothing is worse than none.

**Two tests were added rather than the calibration being written off:** one
asserting no owned key is ever `undefined`, and one asserting the branch is
unreachable - which will FAIL the day a reader makes it reachable, at which point
it needs its own corpus entry.

## 3. The re-point ledger

**Nothing re-pointed.** No swap has happened, so nothing is reading dead code
yet. The ledger from Phase 0 item 6 stands as the work list:

| class | blocks | status |
|---|---|---|
| behaviour (jsdom) | 38 | untouched, still passing against vanilla |
| source-shape | 17 | **not re-pointed** |
| stylesheet liveness | 8 | **not re-pointed** |

## 4. Pixel parity: DEFERRED to Phase 3, explicitly

No panel is rendered in React, so there is nothing to compare. The deferral is
not a choice about method; it is a consequence of section 5.

## 5. WHAT IS NOT BUILT

Stated in full, because a partial delivery reported as a whole one is worse than
a small one reported honestly.

**Phase 1, items 1 to 7 - none are built:**

1. **The mount seam.** The bundle does not register
   `initOpportunityDealPanel`, and neither outward feed
   (`oppCurrentVersionRejection`, `oppRefreshVersionActions`) is supplied.
2. **The interim form/version interface** is measured (Phase 0 item 2) and not
   implemented.
3. **The 39+ controls are not rendered.** The empty-state contracts are
   preserved in the READER; no input renders them.
4. **`recompute` is not wired.** No results, cash-flow grid, year schedule,
   milestones, contractor milestones or installation tab.
5. **Dirty tracking B1-B7 is not implemented.**
6. **`saveDeal` is not wired.**
7. **No load-order revert, no `index.html` swap**, and `frontend/opportunity-deal.js`
   is untouched and still loaded.

**Phase 2, items 2 to 4:** the B1-B7 behaviour tests are not written; the 38
behavioural blocks have not been run against a React panel because there is not
one; source-shape and stylesheet blocks are not re-pointed.

**Why.** The panel is **2,797 lines** - the largest surface the migration has
attempted, and larger than the approval view and the Account surface combined.
Porting the render, the five sections, the two milestone grids, the cash-flow
and year schedules, the latch interplay and the sectioned dirty model faithfully
is not work that fits alongside the parity proof in one pass, and this is a live
pricing calculator where a half-ported render is worse than none.

**What was chosen instead, and it is the brief's own priority:** the proof the
brief names as central, built so that the render can be added against a reader
already known to be exact.

## 6. What surprised

**The vanilla reader is extractable and executable.** The eight functions are
pure over `document`, `uiState` and `catalogRates`, with no other module state,
so brace-balancing them out of the source and running them in a `new Function`
works. **That is what makes the proof a proof rather than two copies agreeing**,
and it was not obvious in advance that the file was factored well enough to
allow it.

**The `numOrUndefined` contract is the one that matters most, by a factor of
four.** Breaking it fails 49 of 97 tests - more than the other three contracts
combined. That is the contract whose empty state means DELETION, and the corpus
finds it in the entries where a single margin box is emptied one at a time.

**A calibration that passes is not automatically good news.** The seventh
injection passing sent me looking for a blind assertion; what was actually there
was an unreachable branch shared by both implementations. The distinction matters
because the remedies are opposite - one is a better assertion, the other is a
test that the branch stays unreachable.

## 7. Gate

```
MERGE GATE  20 stages
  PASS  reachability / session precondition
  PASS  pure suite                 440/440 pass, 0 fail
  PASS  database suite              92/92 pass, 0 fail
  PASS  react suite                230/230 pass, 0 fail   (133 + 97 parity)
  PASS  react bundle freshness
  PASS  14 HTTP probes
All 20 stages passed.
```

`dist` is unchanged and still matches its source: nothing in the bundle's entry
graph was touched, because the reader has no consumer yet.

---

## Standing at the close

Not pushed. Phase 3 not started. **The computational core is proved exact against
the implementation it replaces; the panel around it is not built.** The next
session's Phase 1 has a reader it does not have to re-verify.
