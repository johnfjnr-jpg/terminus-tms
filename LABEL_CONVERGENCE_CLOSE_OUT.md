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
Census reconciled **by count: 58 before, 21 after, 37 converted**, classified in
G4 below with ZERO unexplained lines. A separate 7 use "issue" in its other
sense entirely.

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

## G1 TO G5, BEFORE THE GATE

### G1. The composer guard walks every tree that renders a label

It walked `src/` only, which the first close-out named as its honest limit.
`frontend/app.js` and the React tree both render labels and neither was guarded.
**Both measured CLEAN before the extension**, so no code changed.

**app.js is the more exposed of the two**, not the less: it cannot import, so it
receives the composer as a global, and writing `` `V${x}` `` is one keystroke
shorter than calling it.

**Calibrated by injecting one inline site in EACH newly-walked tree: 2 of 2
fired, each naming its own file**, final reverted run green, byte-identical.

**And the first extension found nothing in the React tree**, because the walk
collected only `.js` and `.mjs`: it reached the directory and could not see a
file in it. The assertion naming each tree by hand is what caught that, which is
why it names them rather than counting files.

**Tests are excluded**, and that is a hole rather than a convenience: a test
asserting `'V2.0'` states an expectation, it does not compose a label.

### G2. What sets `issued_major`, driven

**PROMOTION, measured on a live record: 10 of 10.**

```
a draft alone                         issued_major = null
promotion alone, no approval anywhere issued_major = 1      <- V1.0
the Approved version field            null                  <- names nothing
the Working version field             "V1.0"                <- still names it
the promoted row in the DB            V1.0/issued           <- still there
```

**The field reads nothing for a promoted-but-unsigned major**, and the version
is not hidden: it remains `issued` in the database and named by the Working
Version field. R-L4a stops the HEADLINE claiming approval; it removes no fact.

**The other direction, on the same fixture:** with all three tracks
(Technical, Commercial, Legal) signed through the request that froze the
version, the derivation names **V1.0** with its stored minor. With **2 of 3**
signed it names nothing.

### G3. The 14 empty-rate drafts against `e46aec6` (2026-09-25 10:03 +0800)

```
2026-08-29  V0.96     2026-09-02  V0.99 x8    2026-09-12  V0.98
2026-09-21  V0.100    V0.101    V0.102    V0.103
```

**All 14 predate `e46aec6`. ZERO created after it**, the newest being
2026-09-21, four days before the cut. **No queued defect.** All 14 are DRAFTS,
so no submitted version is retrospectively refused by H2.

### G4. The 21 unconverted issue/issued lines, classified

| count | reason |
|---|---|
| 14 | a DB value comparison (`status === 'issued'`) |
| 3 | a route path or an element id |
| 2 | a log line, not user-facing |
| 1 | an internal variable or handler name |
| 1 | an internal type name |

**Zero unexplained.** Every one is left alone by the ruling.

**AND THE CLASSIFICATION CORRECTED ME TWICE**, which is why it was worth doing
rather than asserting. It found the census figure stale - **58 to 21, 37
converted**, not the 26 and 32 an earlier draft carried - and it found
**`app.js:1410` still reading "the issued version"**, because that edit had
reported `anchor not found` on an indentation mismatch and I had not gone back
to it. Now converted.

### G5. Screenshots

Four images, both changed sites at both widths, copied to the OneDrive test log
at `2026-09-30_label-convergence-screenshots` and **verified by byte count
against the originals**, not by the copy command's exit status.

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
7. **A restated count.** The census figure was quoted from memory after further
   conversions had landed, and it took re-running the classification to find it.
   A number describing a run is emitted by the run.
8. **A failed edit I did not return to.** `app.js:1410` reported `anchor not
   found` on an indentation mismatch and stayed unconverted through two
   documents claiming the sweep was complete. **The tool said so at the time**;
   what failed was me, not it.
9. **I edited the working tree while a commit's suites were running**, so that
   hook run saw files mid-edit. Verification 48's clause is about a gate and
   applies to a commit's suites just as well. Re-verified on a settled tree:
   pure 698, react 1438, typecheck clean.

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
