# Migration Round 3, Session B: partial

**2026-09-05.** Gate green at **21 stages**, React suite **279/279**. Nothing
pushed. Phase 3 not started.

**THE SWAP DID NOT HAPPEN, AND THAT IS A DELIBERATE REFUSAL RATHER THAN AN
OMISSION.** Section 5 gives the reason before anything else does.

---

## 1. Item 0: the typecheck gate stage, and it caught something on its first run

`react typecheck` (`tsc --noEmit`) is stage 5 of 21, and a step in CI ahead of
the React suite.

**Calibrated three ways on one injected type error** in `rows.ts` - a module
outside the bundle entry graph, which is the exact condition the gap lived in:

| stage | verdict on the injected error |
|---|---|
| `vite build` | **PASSED**, 247.26 kB, no error - `rows.ts` is not in the entry graph |
| `vitest` | **PASSED**, 23/23 - it transpiles without typechecking |
| **`tsc --noEmit`** | **FAILED**, `error TS2322: Type 'string' is not assignable to type 'number'` |
| reverted | clean |

**The migration's own working method is what creates the gap.** Building a
surface before wiring it means nothing imports it, and both existing stages only
see what is imported or executed.

**AND IT FAILED ON ITS FIRST REAL GATE RUN, on code written this session.**
`vi.fn(async () => ({ ok: true }))` infers a zero-length parameter tuple, so
`patch.mock.calls[0][1]` was a type error in four places. The tests passed at
runtime the whole time. Fixed by typing the mocks.

## 2. Item 2: the dirty model, B1 to B7

`frontend-react/src/deal/dirty.ts`, and it is **reproduced, not unified** with
the field-row draft model, per the brief.

- **B1** `dealDirtyKeys` = `changedKeys(pickSalespersonWritable(payload), baseline)`.
- **B2** **no cached flag.** `isDealFormDirty` is a plain function of its two
  arguments; a memo keyed on less than the whole payload would be the same
  defect wearing a hook.
- **B3** the baseline is the **salesperson-writable projection**, so a catalog
  rate moving cannot dirty the form.
- **B4** id convention with the **prefix fallback**, built from the census
  rather than from the DOM.
- **B5/B6** section saves by need; a section save saves the **whole sheet** -
  rendering facts, carried with the component.
- **B7** `captureSavedBaseline` is the only clearer.

**14 tests.** One of them records a measurement that corrected my own
expectation: with **no** baseline only **14 of 26** owned keys read dirty,
because `changedKeys` treats a `null` value as not differing from an absent one.
The other twelve are unset and stay quiet - which is why a fresh form does not
present itself as twenty-six pending changes. I had asserted "> 20" and was
wrong.

**Five injections, all fired**, including the one the instruction names:

| injection | result |
|---|---|
| **B2: a cached flag returns** | **3 failed** |
| B3: baseline becomes the raw payload | 7 failed |
| B4: prefix fallback removed | 1 failed |
| B4: fallback matches anything | 2 failed |
| B7: baseline becomes raw | 8 failed |

## 3. Item 3: the seam and the save

`frontend-react/src/deal/seam.ts`.

**Exactly the five members Phase 0 measured crossing**, plus the two outward
feeds, and a test asserts the key set is **exactly** those seven - so an eighth
cannot be added quietly.

**The reason box is deliberately NOT proxied**, and a test enforces it: it is
version machinery that happens to live in the form's DOM, and Round 4 should
take it rather than this seam pretend to own it.

**Reads go through the PROVED reader**, so the version machinery freezes exactly
the payload the parity proof covers. A separate gathering path would be a second
reader of the form on the one surface where the two must agree.

**The outward feeds are asked afresh on every call**, never cached at build -
because `app.js` reads the rejection at render time precisely because the answer
changes when the versions arrive.

**`saveDeal` sends the projection through `window.oppPatch`**, which keeps
owning the route, the `expected_revision`, the 409 retry and the revision
adoption. Tests assert the body is `{ payload }` and **nothing else**, and that
no catalog rate reaches the record.

**12 tests, five injections, all fired.**

## 4. The re-point ledger: UNCHANGED

| class | blocks | status |
|---|---|---|
| behaviour | 38 | untouched, still passing against vanilla |
| source-shape | 17 | **not re-pointed** |
| stylesheet | 8 | **not re-pointed** |

Nothing reads dead code, because nothing is dead: no swap happened.

## 5. WHY THE SWAP DID NOT HAPPEN

**Item 4 was not executed, and executing it would have been wrong.**

The swap puts the React panel in front of the business. The React panel does not
yet render:

- the **cash-flow grid**
- the **year schedule**
- either **milestone grid** or their reconciliation rendering
- the **installation tab**

Those are item 1, and item 1 is not done. **Swapping now would replace a working
pricing panel with one missing four of its surfaces** - on a live calculator,
which is the one place this project's rules are most insistent that a partial
port is worse than none.

**The instruction's own ordering makes this explicit**: item 4's re-points and
item 5's 38-block verdict both presuppose a panel complete enough to run
behavioural tests against. Running them against a panel with no cash-flow grid
would produce a verdict about the gaps, not about the port.

**So item 1, 4 and 5 remain**, and item 6's render-level per-contract injections
with them - the reader-level ones are done and are in the previous report.

## 6. What surprised

**The typecheck stage justified itself within one gate run.** It was ruled in to
close a gap found in Session A, and the first thing it found was a fresh defect
in Session B's own tests - four type errors that `vitest` and `vite build` both
walked past. A stage added on principle usually waits longer than that for its
first catch.

**`changedKeys` treats null as absent, and that is load-bearing.** It is why a
form with no saved baseline shows 14 dirty keys rather than 26, and I had it
wrong in an assertion before measuring it. A test now records the exact list.

**Two more `src/lib` type-inference accommodations**, both at call sites with
the reasoning written there rather than by editing `src/lib`, which must move
untouched: `buildDealInputs`' options inferred from its `= {}` default, and
`changedKeys` inferred as requiring a non-null baseline when its first line is
`baseline ?? {}`.

## 7. Pixel parity: DEFERRED, and not to Phase 3 either

No panel is swapped in, and four of its surfaces are unbuilt, so there is
nothing meaningful to compare. **The comparison belongs to the session that
completes item 1 and performs the swap**, not to Phase 3, because Phase 3's
walk assumes a migrated surface exists.

## 8. Gate

```
MERGE GATE  21 stages
  PASS  reachability / session precondition
  PASS  pure suite                 440/440 pass, 0 fail
  PASS  database suite              92/92 pass, 0 fail
  PASS  react typecheck                         NEW
  PASS  react suite                279/279 pass, 0 fail   (253 + 26)
  PASS  react bundle freshness
  PASS  14 HTTP probes
All 21 stages passed.
```

---

## Standing at the close

Not pushed. `frontend/opportunity-deal.js` is untouched and still the panel a
person sees. **What remains is item 1 (four unbuilt surfaces), then item 4 (the
swap and its re-points), then item 5 (the 38-block verdict), then the render-level
half of item 6.**
