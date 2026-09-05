# Migration Round 2: close-out

**2026-09-05.** Four phases, all signed off. Nothing pushed: the round closes on
John's word, and the push happens then.

---

## The exit gate for Round 3, answered

### 1. The seventeen-element walk, and the rehearsed revert

**The walk. 18 of 18 live checks** on a fixture Account through the real server:
14 click-to-edit rows, 2 read-only (the parent account among them), the
name-header editor, the recipe per element type, the batched save round-trip
reaching the server, the immediate parent link, and **no row refusing** - the
door acting as ruled.

**The visual comparison, which the Phase 1/2 report explicitly did not claim.**
Vanilla and React captured from the same record at three widths:

| width | vanilla | react | pixel diff |
|---|---|---|---|
| 380 | 140x1693 | 140x1693 | 0.012% (29 px) |
| 1280 | 1040x1126 | 1040x1126 | 0.005% (55 px) |
| 1680 | 1440x834 | 1440x834 | **0% (0 px)** |

**And the geometry census is IDENTICAL at all three widths** - every element
box, computed style, card title, row height, `innerText` and `scrollHeight`.

**THE REMAINING PIXELS ARE A CLOCK, PROVEN NOT ASSUMED.** The differing band is
8 rows at y=978, inside the linked-contacts region, and it reads `17:09:02`
against `17:08:32`. `app.js:7444` runs `setInterval(renderAppClock, 1000)`.

**The control settles it: the SAME vanilla state captured twice, 30 seconds
apart, differs in the SAME band by MORE pixels - 120 and 111 against the
migration's 29 and 55.** The difference between the two implementations is
below the noise floor of the instrument measuring it. At 1680 the band falls
outside the captured element and both diffs are zero.

**Verdict: pixel-identical, with the exception named and its cause proven.**

**The revert, rehearsed on a branch and then discarded.** Tree verified
**byte-identical** afterwards, `7b0aab8e…` both sides.

- 14 click-to-edit and 2 read-only vanilla rows render; **zero React markers**;
  the restored inline `onclick` is live; a row opens, takes a value, and the
  **save round-trip reaches the server**; the parent link is intact.
- **The approval view is still React**, so this reverted ONE surface.
- **Gate on the reverted state: 1 of 20 stages fails, and it is exactly entry
  4's unloaded-file clause** at `opportunity-headline.test.mjs:158`. That
  assertion exists to catch a live tag on the migrated-away file, and a revert
  is a live tag on that file, on purpose. **Recorded, not softened.**
- Entry 5 did **not** fail, which is that finding's whole point: documentation
  inside a data structure cannot fail.

**AND THE REHEARSAL FOUND THAT THE REVERT DID NOT REVERT.** See section 4.

### 2. The eleven findings, written verdicts, now in the contract

Nine **confirmed**, one confirmed **with a carve-out** (11, the name header
keeps four vanilla class names because it is a rebuild of a specific element,
not a `FieldRow`), one **amended** (6).

Two new entries: **4b**, whether a seed reaches an editor is the editor's
property, measured from `revealFieldControl`; and the **finding 6 split** - a
seed the field's GUARD rejects does not open the row, a seed the EDITOR cannot
hold opens without it. Applied literally, the original would have made three
Account rows keyboard-inaccessible.

**Finding 2 turned out to be load-bearing rather than merely correct.** Phase 0
measured that the name header ALREADY shared `acctEdits` in the vanilla; a
row-owned draft store could never have expressed that.

All folded into `MIGRATION_FIELD_ROW_CONTRACT.md` as a dated third addendum.

### 3. The coupled-assertion count, and an honest limit on it

**This round's re-points are exact:** 2 coupled assertions rewritten
(`opportunity-headline` with the three-part template, `class-rules`'s
`STATE_CLASSES` corrected), and 3 markup couplings removed from `index.html`.

**The estate total cannot be compared like-for-like with Round 0's 106, and
saying so is the finding.** `MIGRATION_ROUND_0.md` records the number and not
the instrument that produced it. Measured now, two ways:

| instrument | count |
|---|---|
| test blocks naming a `frontend/…` path **inside the block** | **74**, across 9 files |
| all test blocks in any file that reads frontend source | **196**, across 11 files |

**Both are lower bounds with a known blind spot**, and the blind spot is
concrete: `class-rules.test.mjs` builds its paths from a `ROOT` constant
(`../../frontend/`) and concatenates, so a regex for a literal path never sees
it. Round 0 named that file as one of the 106; my scan does not find it.

**The tail is therefore measured as a range with its instrument stated, not as
a single number with false precision.** Round 3 should record the instrument
alongside the count so the next delta is computable.

---

## 4. The finding that mattered most: the revert did not revert

Found by rehearsing, and it would not have been found by reading.

**The enumerated revert was applied - script tag restored, both `onclick`
attributes restored - and React still rendered.** Measured on the branch: **69
React markers, 16 React rows, ZERO vanilla `.ref-field` elements**, on a tree
whose revert had supposedly been done.

**The cause is load order.** The bundle registers `window.loadAccountDetail`; the
vanilla file declares the same name at classic-script top level, which also
writes it to `window`. The bundle sat at line 3217 and the vanilla tag at 3186,
so **the bundle ran last and won**.

**Round 1's revert worked for a reason that stopped being true.** Its bundle
served ONE surface, so removing the bundle tag was a safe revert. It now serves
two, and removing it would revert the approval view as well - over-reverting a
surface nobody asked about.

**The fix is one line of ordering, not a mechanism.** The bundle now loads
**before** the vanilla view scripts, so a restored vanilla tag wins by running
last. Verified both directions: migrated state unchanged (69 React markers,
vanilla never fetched); reverted state genuinely vanilla (0 React markers, 16
vanilla rows, the loader is the vanilla `async function`), with the approval
view still React.

**This is Verification 29's shape**: a decision whose stated advantage rested on
a premise - "the bundle serves one surface" - that the next round quietly
falsified. Nobody re-checked it because the procedure had been rehearsed once
and passed.

---

## 5. Rules promoted, all extending existing ones

Checked against the set first; **none needed a new number**.

- **Verification 41** gains the STRINGS clause. A claim inside a test's data
  structure has the failure mode of a comment and the authority of code: it
  cannot fail, cannot be re-pointed, and a scan for callers steps over it.
- **Verification 6** gains the FRAMEWORK-RENDER clause. A probe asserted inside
  the same synchronous `page.evaluate` as its clicks and reported 12 of 14 rows
  refusing to open. The door was open; the probe was reading the previous frame.
  No delay would have helped, because the loop never yielded - a direction the
  fixed-delay wording does not cover.
- **Verification 20** gains the SHELL-GLOBAL INVENTORY, queued for the `app.js`
  round. `function`/`var` reach `window` and break at modularisation;
  `let`/`const` never reach it at all. Different plans, one keyword apart.

---

## 6. `CURRENT_STATE.md`

**Regenerated**, and it now carries a React section, both facts run-emitted:

```
## React workspace
- Committed bundle: frontend-react/dist/terminus-react.js, 247,261 bytes
- sha256: ac148f9584278222be1058263125b3efbf3be7962cfde99a9fcfae13a73960e6
- React suite: 133/133 pass, 0 fail
```

**Staleness check run:** `PASS  CURRENT_STATE.md is current at b69c830, 5
sources watched`. The watcher now covers the generator's own five inputs -
`supabase/migrations`, `supabase/seeds`, `src/routes`, `src/server.js`,
`OPEN_SECURITY_STEPS.json` - the last two having been missing since before the
React tree existed.

**`frontend-react/` is deliberately not watched**, per the Phase 0 ruling: the
generator does not read it, so watching it would report false staleness. The
React section is how the document stops being silent about it instead.

**One limit, named:** the watch list covers the generator's INPUTS, not the
generator itself. A change to `scripts/state-dump.mjs` does not mark the output
stale. It was regenerated this round anyway; a future round may want that on the
list.

---

## Carried items

1. **`POST /accounts` silently ignores address fields.** Measured: every address
   key comes back `null` on create even when supplied. `fixtures.mjs` passes
   `billingCountry` and it is ignored there too. Pre-existing, unrelated to the
   migration, not fixed.
2. **The bridge tolerance cannot fail.** `reconciles` is false only when
   telescoping fails, and every priced key is claimed by a step. 810 payload
   pairs: 273 rounding lines, zero non-reconciliations. A correct fail-safe for a
   future change, and not evidence about the present one. What the tolerance
   means is a pricing decision.
3. **Three unread endpoint fields.** `ask.staleBasisWarning`,
   `ask.ageingBasisNote`, `frozenTerms` - the last carrying a comment reading
   "this is what reads it" when there is no reader. `ask.unpricedWarning` is the
   fourth and least serious: block 4 renders the same fact.
4. **`window.api`, and now the lexical-globals distinction**, for the `app.js`
   round's Phase 0. `api` and six others are `function` declarations: reachable
   today, silently broken at modularisation. `terminusStaffCache` and
   `accountsCache` are `let`: **already unreachable** from a bundle, and the
   answer is that the React tree fetches the data itself, as the Account surface
   now does.
5. **The estate instrument.** Round 3 records the instrument beside the coupled
   count, so the tail becomes a computable delta rather than two incomparable
   numbers.

---

## 7. Gate, and one transient recorded rather than hidden

**All 20 stages passed on the exact closing tree `d3718b4`**, working tree
clean: pure 440/440, database 92/92, react 133/133, bundle freshness, 14 HTTP
probes.

**The first run of that same tree failed 1 of 20**, and it is recorded because a
green re-run is not a reason to delete the red one. `reference-number.test.mjs`
lost **one of 50 genuinely concurrent connections** to `TypeError: fetch
failed`, in 34ms. Not a uniform stage failure and not a stage that never ran, so
Verification 48's timing tell does not apply; it is a single dropped connection
inside an otherwise healthy run, on the same VPN resolver that produced this
session's earlier outage.

**Re-run on the identical tree: 92/92.** Reported as transient with its
evidence, not as an absence.

## Standing at the close

Not pushed. `frontend/account-detail.js` is in tree and unloaded. **The revert
is three `index.html` edits plus one expected test failure, and it is now a
rehearsed fact rather than a written claim** - including the correction that the
first rehearsal found.
