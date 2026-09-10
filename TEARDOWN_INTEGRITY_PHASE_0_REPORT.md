# Teardown integrity, Phase 0: report

A1 landed. Three measurements follow. **Nothing pushed, no conversions, no
retirements.**

---

## A1: the blind tag query. FIXED, CALIBRATED, AND THE ASTERISK LIFTS

**R3 is answered first because everything else in this repository's evidence
depends on it: the 96%-blind asterisk LIFTS from teardown claims as of
`d4a301f`.** A teardown that reports zero residue is now reporting on its whole
population.

### The defect, measured exactly

Every count below is `head: true, count: 'exact'`. A plain select's length IS
the cap and is not a count - R2's clause, and the reason it is a clause is that
the Test Bed close-out's own sweep script hit it one screen under its
documentation.

| | |
|---|---|
| tagged revision rows matching the sweep | **23,210** |
| rows the unranged query returned | **1,000** |
| distinct records the full population covers | **7,938** |
| distinct records the query covered | **414** = **5.2%** |

### It was seven selects, not one

The reported fault was the tag branch. Reading the function, **every select in
it had the same shape**, and two would have bitten on their own:

- `revs` pages over revisions **of** candidates, so a few hundred fixtures with
  a handful of revisions each already exceeds the cap;
- the candidate scan itself is unbounded.

All seven now go through `pagedSelect` / `pagedSelectIn` / `chunkedWrite`.

### And the cap was hiding a correctness fault

**Range paging without a stable `ORDER BY` may return a row twice or skip it**,
because an unordered query has no obligation to be consistent between requests.
Every helper orders by `id`, unique on all four tables teardown touches.
**Paging without that is the same bug with more round trips**, so it is
recorded as part of the fix rather than as a refinement of it.

Two more found while reading: `.data ?? []` on two calls - the idiom
Verification 8 names, though here there was **no error to silence**, which is
worse, because the query succeeded and answered truthfully about a page nobody
asked for. And an `.in()` list travels in the URL, so a long one fails on
length rather than on the cap: different limit, same class, now chunked.

### Calibration: 7/7 fired, 0 silent

```
FIRED  THE 66-RECORD DEFECT: sweep by owner again
FIRED  the sweep stops matching its own tag
FIRED  the no-tag refusal is removed
FIRED  the unnamed-child rule is removed
FIRED  the re-query goes back to owner-wide
FIRED  the handed-away discovery is removed
FIRED  the paged select goes back to one unranged request
PASS   the reverted tree passes        scripts/fixtures.mjs byte-identical
```

**The seventh went SILENT first, and the silence was the finding**
(Verification 51). The new test left its fixtures **owned by the test account**,
and a record the test account owns is found by the owner-scoped candidate
branch and never needs the tag query at all.

> **The tag branch only decides the fate of records that have LEFT that set.**

Which is exactly the population it exists for, and exactly the 25 handed-away
opportunities the previous round found sitting live. The fixtures are now
handed away by **raw** update, deliberately: the ledger is the other way such a
record is reached, and using it would mask the branch under test.

### R2's clauses, each answered

**Population larger than the cap** - and **constructed** to exceed it rather
than hoped to. Two earlier drafts failed here, and both failures are why:

- probing the ledger's first 25 tags **missed the fixture's own tag**, which
  returned index `-1` and READS as "inside the first page";
- probing the chunk the tag falls in gave a population of **29**, because a tag
  appended seconds ago sits among other recent small ones while the mass is in
  the old tags.

**A record beyond row 1,000, both directions.** Emitted by the run:

```
population: 5033 rows (exact count) over 2 tags, cap 1000
fixture at index 4375 of 5033 (paged, full enumeration)
unranged query returns 1000 rows and does NOT contain the fixture
```

Swept when tagged; the control untouched when its tag is excluded, **then swept
when named** - which is what separates *spared* from *unreachable*.

**Every count exact**, stated at each site. **Harness discipline**: two anchors
had moved under the rewrite and the harness **stopped dead** rather than
scoring a missing anchor as a pass. Both re-pointed.

**One correction, recorded rather than tidied.** `d4a301f`'s message quoted a
population of "1,829 rows exact" and **the run never printed that number**.
Verification 20's own clause, inside the commit claiming to honour it, in a
round about a query answering for less than it was asked. The test now emits
its figures; `f0dfe39` carries the correction and the wrong number stands.

**Residue:** 114 records created across the calibration runs, **0 live**
afterwards (paged enumeration, all owners). The fixed teardown swept every one,
handed-away included.

---

## Item 1: the raw-handover sites. **A1 HAS LARGELY DISSOLVED THIS ITEM**

16 sites carry a raw `owner_id` update, comment-stripped across `scripts/`.

| verdict | n | |
|---|---|---|
| **LIVE, named by a suite** | **1** | `scripts/tests/teardown-scoping.test.mjs` |
| **HISTORICAL**, round-scoped | **14** | `create-from/` 2, `write-auth/` 3, `sibling-surfaces/` 2, `round5,7,7,8/` 4, `ui-hygiene/` 2, `testbed-header/` 1 |
| the helper itself | 1 | `scripts/fixtures.mjs` (`handOver`'s own implementation) |

**Zero are gate stages.** The one live site is the A1 test written this phase,
and its raw update is **deliberate**: it is what puts the fixture under the tag
branch.

**THE DISPOSITION QUESTION HAS CHANGED SHAPE, and this is the item's real
finding.** The 25 residue records existed because the tag query was blind, **not
because the handover was raw**. With paging, a raw-handed record is reached by
tag across owners - which is what the A1 test now proves on every run.

**All 16 hand away records that carry a tag prefix**, so all 16 are reachable.
The remaining exposure is a handover of a record with **no tag at all**, and
there are **zero** such sites.

> **A first pass reported seven of them as untagged.** Every one has its OWN
> local fixture helper writing a `${TAG}-` name, so the scan was measuring
> which helper a file imports rather than whether its records carry a tag.
> Verification 19: the category name needed the same evidence as a finding.

---

## Item 2: the page-cap audit

Comment-stripped, per Verification 39 - this estate writes a great deal of prose
about queries, and a raw scan would match the documentation of the bug it hunts.
A select counts as **bounded** if its chain carries `.range(`, `.limit(`,
`.single(`, `.maybeSingle(` or `head: true`.

| | |
|---|---|
| select chains found | **226** |
| **unbounded** | **112** |
| in code the gate runs | **41**, across 13 files |
| in historical scripts | 71, across 35 files |

Crossed against live table sizes (exact counts):

| | |
|---|---|
| live unbounded selects on a table **over** the cap | **21** |
| of those, with **no filter at all** | **0** |
| live unbounded selects on a table under the cap | 20 |

Tables over the cap today: `records` 46,031, `record_revisions` 74,161,
`audit_log` 39,139, `deal_sheet_versions` 3,361, `approvals` 3,027,
`transition_requests` 2,370, `record_contacts` 4,703, `opportunity_details`
4,561, `reference_number_counters` 3,735.

**AND THE REASSURING NUMBER IS THE ONE NOT TO TRUST.** "All 21 carry a filter"
is exactly the shape that hid the original: **teardown's blind query was
filtered too** - a `.or()` across 30 tags - and it matched 23,210 rows. A
filter bounds the result set only if the filter is narrow, and narrowness is
not a static property.

**So this audit bounds the search, it does not clear it.** The 21 need their
real result sets measured, which is execution rather than scanning, and is
Phase 1 work. The 20 on small config tables are harmless today and will rot
silently if those tables ever grow.

---

## Item 3: the vanilla retirement. **BIGGER THAN DELETING THREE BLOCKS**

Enumerated by the `-vanilla` **suffix**, never from a named list, so a fourth
block would appear here (Verification 19's enumeration clause). There are three.

| block | size | native controls | ids inside |
|---|---|---|---|
| `deal-form-vanilla` | 786 lines | 48 | 143 |
| `ref-vanilla` | 118 lines | 1 | 16 |
| `deal-version-vanilla` | 60 lines | 8 | 11 |

**What breaks on removal is not the React tree.** The React components
recreate the same ids on the live surface, so a hit in `section4.tsx` is not a
dependency on the dead markup. **The code that depends on it is the code that
reads `frontend/index.html` AS A FILE**, and there are 17 such files, **13 of
them run by the gate**.

### The finding

> **58 id-assertions across 10 gate suites test markup that renders nothing.**

| gate suite | assertions on ids that exist ONLY in a dead block |
|---|---|
| `commercials-wiring.test.mjs` | **26** |
| `class-rules.test.mjs` | 8 |
| `latches.test.mjs` | 7 |
| `adopted-identity.test.mjs` | 6 |
| `live-form.test.mjs` | 3 (tripwire, by design) |
| `vanilla-duplicates-frozen.test.mjs` | 3 (tripwire, by design) |
| `no-duplicate-ids.test.mjs` | 2 |
| `transition-requests.test.mjs` | 2 |
| `strip-comments.test.mjs` | 1 |

Six of those 58 are the **tripwires themselves**, which name the blocks on
purpose and are correct. The other **52 are assertions about a live screen,
made against a corpse.**

**This explains last round's trap rather than merely resembling it.** An edit
converting eight note rows landed in `#deal-form-vanilla`, the served HTML
changed, **source verification passed**, and the screen did not move. Source
verification passed *because the gate suites assert against that markup*.

**Two consequences, and the second is the one that matters beyond the
retirement:**

1. Retiring the three blocks requires re-pointing or retiring **52
   assertions across 8 suites** - it is not a deletion.
2. **Until then, those suites' green is not evidence about the live screen.**
   That is a standing qualification on the gate, in the same shape as the
   asterisk A1 just lifted.

**`frontend/app.js` still writes into `ref-vanilla`** (`detail-probability`,
`detail-close-date`, `detail-testbed-cost`, `detail-age`) - the Opportunity
stat strip the last round found never renders. Those are dead writes and go
with the block.

---

## Carried items 4 and 5: NOT forced in

Per R5, checked rather than assumed. **Neither is forced in by these findings.**
The page-cap audit touches probes that exercise routes, but it measures query
shape, not route coverage; nothing here reaches the `complete-document`
disagreement. **No flag.**

---

## Decisions Phase 1 needs from John

1. **Item 1's disposition.** A1 dissolved the residue risk: 14 historical, all
   tagged, all reachable. **Recommend: confirm the 14 HISTORICAL and close
   carried item 2 by measurement**, rather than converting scripts that will
   never run. The one live site is deliberate and stays.
2. **Item 2's scope.** The audit bounds the search at **21**. Options: (a)
   execute those 21 and measure real result sets; (b) add a structural guard
   that fails any unbounded select in code the gate runs, which is cheaper and
   catches the next one rather than today's; (c) both. **Recommend (b) then
   (a)**, because the guard stops the class and the measurement clears the
   instances.
3. **Item 3's shape.** 52 assertions across 8 suites must move before three
   blocks can be deleted. **Recommend the retirement stays its own round** as
   already carried, and that **this round records the standing qualification**
   on those suites so nobody reads their green as evidence about the screen in
   the meantime.

## What this phase does NOT establish

- **Whether any of the 21 live unbounded selects is actually truncating.** That
  needs execution; the audit is static.
- **Whether the 52 assertions have live equivalents in the React suites.** Some
  will, some will not, and the difference is the retirement's real cost.
- **Nothing about carried items 4 and 5.**
- A1 is proven on `record_revisions` and `records`. The other five tables
  teardown touches are paged by the same helper but were not separately
  exercised at supra-cap volume.
