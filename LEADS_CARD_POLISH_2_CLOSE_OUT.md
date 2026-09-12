# The LEADS CARD POLISH 2 round: close-out

Two phases, both signed off. Nothing pushed. The word is John's.

---

## 1. The gate

Stated after this commit, on the exact tree, with `--round-close` so F6
refuses a skipped required stage. Section 8.

---

## 2. Commit reconciliation

`git rev-list --count 37364ce..HEAD` is the authority.

| # | commit | maps to |
|---|---|---|
| 1 | `7a3f905` | **F5 first act**, carried and ruled next-round-first |
| 2 | `619963d` | the round instruction: write the brief, execute Phase 0 |
| 3 | `80a8c7c` | Phase 0, measurement only |
| 4 | `29ebf22` | Phase 1: R2+R1, R3, R4, R5 |
| 5 | `05dc49e` | named correction: the surface spans the card |
| 6 | `5c183ad` | Phase 1, the report |
| 7 | `c4b3fa9` | close: one promotion |
| 8 | `3af7cd2` | close: CURRENT_STATE |
| 9 | this | close: the close-out |

**Unaccounted 0. Phantom 0.** The terminator is the one earlier rounds
recorded: a table cannot name its own commit, so any excess over row 8 is
this close's bookkeeping, markdown only.

**Rulings: R1 to R6 numbered, plus the four sign-off rulings** (R3 ruled
(a), the R4/R5 mechanism, R1 folding into R2), all appended to the brief
**at the phase that launched them**. Checked by counting.

---

## 3. Revert rehearsal, and R3's boundary answered

Run on a detached worktree; the main tree was never touched.

| | |
|---|---|
| main tree before | `c562afc3dccc1ca1514815b6cd752376ce6e79de` |
| main tree after | `c562afc3dccc1ca1514815b6cd752376ce6e79de` |
| `git revert --no-commit 37364ce..HEAD` | exit 0, no conflicts |
| resulting tree | `a00910795e9540ab56ddcc4657399a982cf805e0` |
| pre-round tree | `a00910795e9540ab56ddcc4657399a982cf805e0` |

**Identical**, by tree hash.

### R3 adds a ROUTE, not a migration, so it reverts completely

The question was asked and the answer is measured: **zero migrations,
zero files touched under `supabase/`**. R3 is `src/lib/regions.js` plus
one key on an existing route handler. **Reverting the files removes the
capability entirely** - there is no applied SQL whose effect outlives its
file.

**So this round is fully revertible**, like the last one and unlike the
LEADS CARD round, whose two applied migrations would survive.

---

## 4. CURRENT_STATE

Regenerated at `c4b3fa9`, committed at `3af7cd2`.

| staleness half | result |
|---|---|
| recorded SHA is an ancestor of HEAD | **PASS** |
| no tracked configuration source changed since | **PASS** |

**Counts exact:** `approvals` reads **3157** in the file and **3157** from
an exact head-count, three times the page cap.

**The configuration sections are byte-identical** - no schema changed -
and the whole diff is record growth: soft-deleted 51,423 to 53,023 from
probe traffic torn down correctly, live unchanged at 116. **That absence
is itself the finding: R3 added a source in code, not a schema row.**

---

## 5. Promotions

**One, extending Verification 7.**

Rule 7 is a condition the OLD state already satisfies, so a probe passes
wrongly. **The inverse is a condition that can NEVER become true because
the product correctly moved on**, so the probe FAILS wrongly - as a
selector timeout, which reads exactly like a feature that stopped
working.

Three instances this round and two in the round before, all one shape:
**a fixture consumed by an earlier claim.** A probe qualified a lead and
then waited for that lead's card on the pipeline, when qualified leads
correctly leave it - which the same probe asserts two checks earlier.

**The counterfactual gives no help**, which is why it is a separate
clause: the counterfactual for *"wait for lead X's card"* is *"the card is
absent"*, and absent is the correct outcome. The two readings are
identical.

### Checked and NOT promoted, already covered

| candidate | covered by |
|---|---|
| the address-blanking write | **Verification 20's addendum** - a control that supplies a value on save turns unchanged into empty. This round is a fourth instance, not a new rule |
| an input-only census missing a `select` | **Verification 19** - enumerate by declared property, never by a shape you assumed |
| a surface crushed by a layout change while every assertion passed | **Verification 4** and **33** - presence is not legibility; a measure cannot see what it does not count |
| an equality assertion outliving its claim | **Architecture 9's** validation variant - a rule whose answer has become constant |

---

## 6. The promotion queue

- **F3, the unclassed-control class.** **Still open, still four
  instances, still no instrument.** Add note and Save task remain white
  browser defaults on the cards; this round's new controls carry the
  estate treatment but the carried instances were not fixed.
- **`flaky-gate-tests`**: F5 hardened (below), F8 retry-with-recorded-cause
  still to build.

---

## 7. Carried forward, in order

1. **THE REGION DRIFT IS NOT CLOSED.** R3 added **one server source and
   one reader**. The **six existing copies are NOT re-pointed** -
   `contact/descriptors.ts` (frozen Lead Detail's), `testbed/`,
   `account/`, `reference/`, `app.js`'s `TB_MATRIX_REGIONS`, and three
   hardcoded `<option>` blocks in `index.html`. **Re-point each as its
   surface is next touched**, and recorded here so a future "just change
   the regions" does not assume one source. **It is not one source yet.**
2. **THE F5 CEILING HAS BEEN TIGHTENED TWICE REACTIVELY**, 25 to 6 to 3,
   the second time on **variance rather than growth**. When F5 is next in
   scope, **review the DERIVATION** - a proper margin over observed
   variance - **rather than taking another step down.** A third reactive
   step would be fitting the instrument to the readings.
3. **The follow-up-tasks entity round is next**, rebuilding the frozen
   218px panel and reclaiming the card-height remainder.
4. **Batch Edit** after that.
5. **Lead Detail is still FROZEN** pending John's parity walk of the
   polished card.
6. **F8's retry treatment**, and **F3**.
7. **`NurtureDialog` and the address popup** remain declared
   duplications until Lead Detail retires.

---

## 8. Gate result

To be stated on the tree this commit creates.
