# LABEL CONVERGENCE: CLOSE-OUT

Branch `label-convergence` off `main` at `6550b09`. Seven scope items, two
Phase 0 STOPs answered by ruling, and the round built only what was named.

---

## THE EXIT GATE, POINT BY POINT

**E1. Golden deals green and UNCHANGED.** `scripts/golden-deals-check` reports
**3651 figures exact** on every run of this round. No pricing figure moved,
which is what a labels-and-copy round should do to pricing.

**E2. Zero label sites outside the composer.**
`version-label-composer.test.mjs` walks every file under `src/` with no list and
reports zero. It was calibrated **RED against the three route copies before they
were removed: 11 sites, 3 files.** One format on screen for one version, read
off the live ladder: `V1.1`, `V1.0`, `V0.1`.

**E3. L2 and L3 measured.** L2 driven through the real routes, **9 of 9
conforming**. L3 measured ABSENT at Phase 0, ruled in by John, landed red-first
and green after.

**E4. H1 to H3 proved from the click, both ways.**

| | |
|---|---|
| H1 | model 4 of 4 and render 2 of 2, fires and is silent, asserting the attention token |
| H2 | **7 of 7 over HTTP**, healthy direction first, plus the non-owner identity |
| H3 | the frozen basis, with the suite catching the fix's own first draft |

**E5. Decisions doc carries L4**, with R-VL4, R-L4a, R-AV and R-L3 beside it.
Census reconciled **by count: 58 user-facing lines before, 26 after, 32
converted**; the 26 are DB comparisons, route paths, type names and log lines,
each left alone by the ruling, and a separate 7 use "issue" in its other sense.

**E6. Revert rehearsed, CURRENT_STATE regenerated.** Below. Gate pending, and it
waits for NordVPN to be off.

**E7.** `ls-remote` re-check at merge, then "ready for John's push".

---

## THE REVERT REHEARSAL

```
tree before            a9e1740
full revert tree       388f2db   =  main's tree 388f2db   EXACTLY
restored tree          a9e1740   BYTE-IDENTICAL
working tree           clean
```

**A REVERT MUST DELETE, NOT ONLY RESTORE.** This branch ADDS six files, and
Verification 44 records that `git checkout <ref> -- .` does not remove a file
added since that ref. A first rehearsal proved only the restore; the full revert
needed those six named and deleted.

**AND MY OWN INSTRUMENT WAS WRONG BEFORE IT WAS RIGHT.** The first full
rehearsal reported the revert NOT reaching main, because `git write-tree` reads
the INDEX and `rm` had never touched it. Redone with `git rm`, the trees match
exactly. A tree hash is the right instrument and it still has to be pointed at
the right thing.

---

## CURRENT_STATE

Regenerated at `ec1f969`, **staleness PASSES, 5 sources watched**. The diff is
count drift: revisions, soft-deleted rows, the two tags' commit distances.
**Live records unchanged at 133**, so every fixture this round created was torn
down.

---

## WHAT I GOT WRONG, AND WHAT CAUGHT IT

Recorded because the round's own controls caught all of it, and because two of
these are the same fault twice.

1. **A commit I reported as landed had not landed.** I read exit 0 from a pipe,
   which was `tail`'s status, not git's. The hook had refused it. Every commit
   after that captures git's own exit code.
2. **The typecheck the hook refused on.** Giving the composer an honest
   `string|null` return made TypeScript see a null the old JSDoc hid. Pure,
   react and database were green and I had run two of those by hand; the hook
   refused on the one I had not. That is the argument written into the hook.
3. **I corrupted a line of `app.js`** by using a string copied from grep output
   as an edit anchor. Grep had truncated it at 88 characters, so it matched a
   prefix and replaced the middle of the line. Repaired from git's copy.
4. **A probe selector guessed rather than read**, returning null for every
   headline field. A failing selector reads exactly like a missing figure.
5. **A screenshot that did not contain its subject**, taken after a tab change
   scrolled the strip away. The values had been measured; the picture showed
   somewhere else.
6. **A hand-derived expectation**, twice: that a refused draft would be V0.x,
   and that a fixture version carried a snapshot. Both were wrong about the
   fixture, not the product.

---

## WHAT THIS ROUND DOES NOT ESTABLISH

- **The gate has not run.** E6 is incomplete until it does, with the VPN off.
- **The composer guard covers `src/`.** `frontend/app.js` and the React tree are
  not walked by it; `app.js` now receives the composer through the module bridge
  and the React tree imports it, but neither is guarded against a new inline
  label the way `src/` is. Named rather than claimed.
- **26 issue/issued lines remain by ruling**, not by oversight. If any of them
  is user-facing in a surface this round did not open, the walk is what finds it.
- **H2's fixture is built by admin write.** The create route refuses to mint an
  empty-rate version, so the state cannot be reached through the product; the
  shape written is one 14 real rows carry.
