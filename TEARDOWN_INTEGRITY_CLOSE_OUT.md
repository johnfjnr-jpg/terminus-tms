# Teardown integrity: close-out

**Gate: 22/22 PASS on `85c2784`**, exit 0, door stage PASS not SKIP, working
tree clean, no dirty warning in the transcript. **Nothing pushed.** 9 commits
await the word.

---

## 1. The round's point, in one line

> **`tearDown` was deciding what to sweep from 5.2% of the records it was
> asking about, and the 96%-blind asterisk on every teardown claim in this
> estate is now lifted.**

---

## 2. A1: the blind tag query

Exact counts, `head: true, count: 'exact'` - a plain select's length **is** the
cap and is not a count.

| | |
|---|---|
| tagged revision rows matching the sweep | **23,210** |
| rows the unranged query returned | **1,000** |
| distinct records the full population covers | **7,938** |
| distinct records the query covered | **414** = **5.2%** |

**Seven selects, not one.** Two would have bitten independently: `revs` pages
over revisions *of* candidates, and the candidate scan was itself unbounded.

**And the cap was hiding a correctness fault.** Range paging without a stable
`ORDER BY` may return a row twice or skip it. **Paging without one is the same
bug with more round trips**, so it is part of the fix rather than a refinement.

**Calibration 7/7 fired, 0 silent, reverted tree green, `fixtures.mjs`
byte-identical.** The seventh went **silent first, and the silence was the
finding** (Verification 51): the fixtures were still *owned* by the test
account, so the owner branch swept them and the tag branch never decided. **The
tag branch only governs records that have LEFT that set** - exactly the 25
handed-away opportunities the previous round found live.

**R3 answered: the asterisk lifts.**

---

## 3. R7: the guard, then the 21

**The guard is about the class.** The page cap has produced four findings here
now. Measuring instances one at a time has not stopped the next arriving; what
this buys is that **number 42 is a red test**, not a discovery in six months.

**Shrink-only mechanically.** A new unbounded select fails (its key is absent);
adding the key breaks `CEILING`; a **stale** key fails too, so the list cannot
drift in either direction. **One definition, imported** by both the guard and
the audit - it reproduces Phase 0's 41 exactly.

**Calibration 5/5, reverted green, files byte-identical.** The two that matter:
the **vacuous-green** injection (if the walk stops finding files every other
assertion passes for nothing), and the **exemption over-reach** injection, since
an exemption that swallows a real defect is worse than no guard.

### The 21 executed, and one was truncating

| count | verdict | instance |
|---|---|---|
| **3,027** | **OVER** | `gates::approvals::0` - approvals carrying a stage |
| 460 | under | `config-invariants::record_revisions::0` |
| 111 | under | `config-invariants::records::1` |
| 62 | under | `config-invariants::records::0` |
| 18 | under | `probe-stage-probability::records::2` |
| 1 | under | `version-atomicity::deal_sheet_versions::0` |

`gates.test.mjs` hunts orphaned `approvals.stage` values across the whole table
and was examining **1,000 of 3,027**. **2,027 rows were never looked at while
the assertion reported clean.** Fixed by paging, and **the coverage claim is now
part of the test**: it emits `examined 3027 of 3027 (exact count)` and asserts
it. Allowlist **41 -> 40**.

**The guard caught its own author within the hour, and was half right** - one
false positive where the **definition** was wrong (`pagedSelect(() => ...)` is
bounded by the helper) and one true positive that must not be silenced (the
counterfactual must stay unranged, because it is what proves the cap is real).

---

## 4. R6 and R8

**R6, carried item 2 CLOSED BY MEASUREMENT.** 16 raw-handover sites: 14
historical, 1 live and deliberate, 1 the helper. **Zero gate stages.** All 16
hand away *tagged* records, so all 16 are reachable now the query pages. **A
first pass called seven of them untagged and was wrong** - each has its own
local fixture helper writing a tagged name, so the scan measured which helper a
file imports. Verification 19.

**R8, the standing qualification, recorded in `CLAUDE.md`** as an extension to
Verification 41's retired-surface clause. **58 id-assertions across 10 gate
suites read ids that exist only inside a dead block**; six are the tripwires,
**the other 52 are assertions about a live screen made against a corpse.** That
is *why* "source verification PASSED" on last round's note-row edit.

---

## 5. The A1 residual

`transition_requests` - the only *other* teardown table over the cap, 2,370
against `track_approvers`' 5.

```
pagedSelect:   2370 of 2370 (exact count), cap 1000
pagedSelectIn: 400 rows over 400 ids in chunks of 150
```

Both assert **no row came back twice**. The helper is now proven on three
tables.

---

## 6. Commits reconciled by counting

Enumerated by **instruction and ruling**, since the brief carries one `## Phase`
heading and build discipline 7 says not to trust that.

| launched by | n | |
|---|---|---|
| Round instruction (brief) | 1 | `0a22bec` |
| Opening act A1 (R1-R3) | 2 | `d4a301f` `f0dfe39` |
| Phase 0 instruction (items 1-3) | 1 | `452b16c` |
| Phase 1 = R7 in order + the residual, plus R6/R8 landed with it | 4 | `3070e6f` `3b213e7` `1f04171` `04f8ee9` |
| Close instruction | 1 | `85c2784` |
| **Total** | **9** | matches `git rev-list --count` |

Two of the nine are **corrections to the commit before them**, and both stand
with the wrong figure left visible.

---

## 7. Revert rehearsal, and its boundary

On a **worktree at `origin/main`**, so `main`'s tree was never touched.

| check | result |
|---|---|
| reverted tree vs `origin/main` | **0 diff lines** |
| reverted pure suite | exit 0, **508** (512 now: +4, the guard) |
| reverted database suite | exit 0, **98** (100 now: +2, the A1 tests) |
| `main` tree hash before / after | **identical** |

**THE BOUNDARY:**

- **Reverts cleanly:** all 9 commits. **No migration was written**, so there is
  no schema to unwind and no ledger row to reconcile.
- **Does NOT revert: the teardown behaviour of past runs.** Reverting restores
  the blind query, and every teardown run under it would again read 4% of its
  population. Nothing undoes the sweeps already performed correctly.
- **Does NOT revert:** the ~182 fixture records created across calibration
  runs, all soft-deleted, 0 live.
- **Reverting re-introduces the flake.** The A1 depth test goes back to failing
  about one run in five, and the `gates.test.mjs` scan goes back to examining
  1,000 of 3,027.

---

## 8. `CURRENT_STATE.md`, and a fault found in the generator

**Staleness, both halves, half 2's empty calibrated:**

| half | result |
|---|---|
| recorded sha `04f8ee9` is an ancestor of `HEAD` | **PASS** |
| no tracked configuration source changed since | **PASS** (empty) |
| *calibration*: the same query over `4e7460b~1..HEAD` | returns 3 files |

**John's ruling asked for its counts exact rather than paged, and that question
found something.** `state-dump.mjs` carries **zero** unbounded selects and
already pages - **and paged with no `ORDER BY`**, which is the other half of
this round's own fault, in the generator producing the document this close
publishes.

Not every table has `id` (`approval_tracks` does not), and ordering only
**matters** once paging happens - so the fallback **proves** the result fits one
page rather than assuming it, and refuses if such a table ever grows past the
cap.

**Measured, ordered against unordered on the same data: NO PUBLISHED COUNT
MOVED.** The only differences are row **order** in a config table well under the
cap. **That one-time reordering is named here** because CURRENT_STATE's value is
that its diff between rounds is the configuration changelog, and a reader seeing
reordered rows would otherwise read it as configuration having changed. Nothing
changed. Three consecutive runs now compare identical, and the totals
cross-check against independent exact counts: **111 live, 46,310 rows, 3,027
approvals**.

---

## 9. Promotions

All three **extend** an existing rule. **Count unchanged at 84**, nothing
renumbered, placement walked back under `## Verification`.

- **Verification 17** gains the **coverage-claim** clause: the rule already says
  to confirm a query covers its whole population, which is a habit. Take the
  exact count first and **assert** the rows walked equal it. *A habit protects
  the query somebody is looking at; an assertion protects the one nobody is.*
- **Verification 19** gains the **exemption-is-a-call** clause: where a guard
  strips comments, prose can neither satisfy **nor exempt** - the two follow
  from one property - so the exemption is a function defined in the guard's own
  module, and it is itself calibrated against over-reach.
- **Verification 20** gains the **suite-attribution** variant, the one that
  survives the rule as written: not a number pulled from the air, but arithmetic
  from a true premise about the **wrong runner**.

---

## 10. Carried items, restated

1. **The vanilla retirement.** 52 assertions across 8 suites must move before
   three dead blocks can be deleted. **The qualification stands and is now in
   `CLAUDE.md`:** those suites' green is not evidence about the live deal form,
   reference tab or version panel; changes there verify by screenshot or live
   DOM. **The Phase 0 measurement is that round's brief foundation.**
2. **The 20 under-cap unbounded selects**, held by the allowlist. Harmless
   today, and they will rot silently if those tables grow. They cannot be
   forgotten, but nothing measures them.
3. **The 19 routes unexercised as a non-owner, and concurrency.**
4. **The `complete-document` disagreement, recorded not resolved.**

---

## 11. My own faults this round

Four, all found by instruments rather than by review, and all recorded where
they happened.

1. **An invented population figure** (`d4a301f` said 1,829; the run never
   printed it). Corrected in `f0dfe39`; the test now emits its numbers.
2. **A suite total attributed to the wrong runner** (`3b213e7` said pure
   512 -> 514; the tests were in `test:db`). Corrected in `1f04171`, and
   promoted.
3. **A flaky gate test.** The A1 depth assertion failed at `index 997 of 5045` -
   a uuid lands in the first page about one run in five. It refused to prove
   anything from a shallow draw, which is correct, **and a test that reds the
   gate one run in five is a coin toss with a good error message.** Now it
   *chooses* the depth and emits the draw count.
4. **A gate run I did not score.** The first background attempt returned "exit
   code 0" within seconds - that was the *launcher* exiting, having orphaned
   the real run behind an `&`. Its output was four lines. **Verification 48: a
   run that produced no parseable result has not run**, so it was discarded and
   re-run as a tracked process.

---

## 12. What this close does NOT cover

- **The 71 unbounded selects in historical scripts** are outside the guard's
  scope by design: it watches code the gate runs.
- **`track_approvers` cannot be proven at supra-cap volume** - it holds five
  rows - so the helper's claim rests on three tables, not four.
- **Nothing here touches carried items 3 and 4.**
- **No walk was run.** The estate's stopping condition is a walk, and this
  round changed no screen.
- **The allowlist key is positional**, so clearing one instance renumbers its
  siblings and produces a multi-line diff. Recorded at the file.
