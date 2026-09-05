# Migration Round 3, Session D2b: the seam as ruled. Items 1 and 2 only.

**2026-09-06.** Gate green at **21 stages**, React suite **364/364**. Nothing
pushed.

**Items 3 to 8 did not happen: the split, the swap, identity adoption, the
38-block verdict and the visual comparison.** Section 5 says why, and it is a
scope statement rather than a refusal this time - the seam took the session.

---

## 1. The `num` measurement, first

The ruling said measure `num`'s read target before deciding where it goes.

**Exactly one `num()` call exists anywhere in the version machinery**, in
`saveVersion`:

```js
scheduleReconciliation(readContractorMilestones(), num('deal-lumpCost'))
```

**`deal-lumpCost` is a FORM input** - census section `installation`, markup
`#deal-lumpCost-group`. So per the ruling it folds into `freezeCurrentState`'s
return.

**And it needs no member of its own**, which the ruling left open:
`lumpSumCost` is already a payload key, so the version file reads
`frozen.payload.lumpSumCost`. Asserted, including that `num` is not a seam
member.

One difference recorded rather than glossed: `num('deal-lumpCost')` yields `0`
for an empty box and `payload.lumpSumCost` yields `null`. `scheduleReconciliation`
tests `Number(base) > 0`, and `Number(null)` is `0`, so the two are equivalent
at the only place it is read.

## 2. The seam, as ruled

```ts
freezeCurrentState(): Promise<FrozenState>   // saves if dirty, THEN returns
hasUnsavedChanges(): boolean
readContractorMilestones()
populateForm(payload)
recompute()
oppCurrentVersionRejection()                 // the two outward feeds
oppRefreshVersionActions()
```

**The exact-set test is amended in the same commit**, and the amendment is the
claim changing by ruling rather than a test bent to fit code. **The exactness is
kept** - still a set equality - and two absences are now asserted positively:
`opportunityId` and `wired` are **not** members, so a later session cannot
reintroduce module state through the interface.

**Why `freezeCurrentState` folds the save in.** There is no way to obtain the
payload except through the call that saves it, so the version machinery cannot
get the order wrong and cannot forget the save. It **throws** the refusal rather
than returning a flag, because a version taken from a form whose save was
refused would freeze a payload the record does not hold.

**`updateDirtyState` has no successor, by construction.** In the vanilla, dirty
was pushed, so restore had to tell the form. Here it is computed against the
baseline, so moving the baseline with the values *is* the whole of what the
vanilla pushed. Asserted directly, and asserted as an absence from the key set.

## 3. Item 2: the React form implements it

The seam is built from **live readers** - every source is a function, so the
version machinery holding the object cannot hold a stale form. That mattered: an
injection replacing one reader with a captured value **failed 5 of 11 tests**.

**Order asserted, and the first assertion of it was a tautology.** The original
pushed `'save'` inside the mock and `'read'` after the `await`, then asserted
`['save','read']` - which cannot fail, because a push after an await always
follows whatever the awaited call did. Replaced with a trace of the SOURCE
calls, and calibrated: reversing the implementation's order now fails it.

## 4. Calibration: eight injections across two suites, all fired

| injection | result |
|---|---|
| **the order reversed: read then save** | **1 failed** |
| a refused save is swallowed | 1 failed |
| a clean form is saved anyway | 2 failed |
| the save does not re-baseline | 1 failed |
| **the seam captures a STALE form** | **5 failed** |
| a refused save re-baselines | 1 failed |
| **a restored NULL is skipped** | **1 failed, after a gap was closed** |
| reverted | 12/12 and 20/20 |

**The restored-null injection did not fire at first**, and the gap was real:
nothing restored a payload containing `null`. A version can freeze a key as "not
recorded", and restoring it must **empty** the field rather than leave the
current value - otherwise a restore silently keeps a value the version does not
have and the next save writes it back. Test added, injection then fired.

## 5. What was not done, and why

**Items 3 to 8.** The session's budget went on items 1 and 2, and they are the
ones the split depends on: item 3 rewrites the version machinery against this
seam, and rewriting it against a seam that had not yet been proved against a
real form would have been the same mistake D2 found, one layer along.

**Item 3 is also the largest single piece of the round**: a rewrite of roughly
600 lines of version machinery, verified by the version workflow operating
unchanged **against the vanilla form** before any swap. That verification is the
whole value of doing it separately, and it needs its own pass.

## 6. What surprised

**The typecheck stage caught a third real defect**, this time a `declare global`
conflict: I declared `window.api` with a narrower signature than the other test
files. `declare global` merges across the project, so a narrower local
declaration is a conflict rather than a convenience. **`vitest` ran all 364 tests
green through it.**

**A hooks-order violation, and the tests said so precisely.** I placed the seam's
`useRef`/`useEffect` below the catalog's early returns, so the pending branch
skipped them. React reported "a change in the order of Hooks", 41 tests failed at
once, and the fix was to move them above - hooks run unconditionally or not at
all.

**My own order assertion was a tautology and I nearly shipped it.** It read
convincingly, it passed, and it could not have failed. What caught it was asking
the calibration question of the test itself rather than of the code: what would
this do if the thing it describes were wrong?

## 7. Gate

```
MERGE GATE  21 stages
  PASS  pure suite                 440/440 pass, 0 fail
  PASS  database suite              92/92 pass, 0 fail
  PASS  react typecheck
  PASS  react suite                364/364 pass, 0 fail   (344 + 20)
  PASS  react bundle freshness
  PASS  14 HTTP probes
All 21 stages passed.
```

---

## Standing at the close

Not pushed. `frontend/opportunity-deal.js` is untouched and still the panel a
person sees. **The seam is ruled, implemented and proved against the real form;
the split that consumes it has not started.**
