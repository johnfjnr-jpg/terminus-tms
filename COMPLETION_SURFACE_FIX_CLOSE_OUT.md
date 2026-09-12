# The LEADS COMPLETION SURFACE FIX round: close-out

Two phases, both signed off. Nothing pushed. The word is John's.

**One item is flagged for the next round's opening: F8 has now fired
three times.** Section 7.

---

## 1. The gate

**22 of 22 PASS, 0 SKIP, 0 FAIL on `578b96b`**, first run, with
`--round-close`. Door stage `PASS  HTTP readonly-view probe  exit 0
83786ms`. Database suite `100/100`. Section 9.

---

## 2. Commit reconciliation

`git rev-list --count 59354f1..HEAD` is the authority.

| # | commit | maps to |
|---|---|---|
| 1 | `89b640d` | the round instruction: write the brief, execute Phase 0 |
| 2 | `0a5f366` | Phase 0, measurement only |
| 3 | `c5a3cc8` | Phase 1: R1, R2, R3, R4, R5 |
| 4 | `5e3b781` | Phase 1, the report |
| 5 | `22b1d82` | close: one promotion |
| 6 | `8414fed` | close: CURRENT_STATE |
| 7 | this | close: the close-out |

**Unaccounted 0. Phantom 0.** Excess over row 6 is this close's
bookkeeping, markdown only - the terminator earlier rounds recorded.

**Rulings: R1 to R5, all in the brief at the phase that launched them** -
R1 and R2 with the round instruction, R3, R4 and R5 appended at the Phase
0 sign-off. Checked by counting.

---

## 3. Revert rehearsal, and the boundary is the narrowest yet

| | |
|---|---|
| main tree before | `67156d8c1dc1b19a8e04f9271b1af6601df1772f` |
| main tree after | `67156d8c1dc1b19a8e04f9271b1af6601df1772f` |
| `git revert --no-commit 59354f1..HEAD` | exit 0, no conflicts |
| resulting tree | `cf79a329e0a7583b60382a73434387913e89d5ad` |
| pre-round tree | `cf79a329e0a7583b60382a73434387913e89d5ad` |

**Identical**, by tree hash.

### The boundary, measured

| | |
|---|---|
| migrations added | **0** |
| files touched under `supabase/` | **0** |
| files touched under `src/` | **0** |

**Not merely no migration - no server code at all.** This round is
`frontend-react/` and probes. **It reverts completely**, and there is no
applied state of any kind whose effect outlives its files.

---

## 4. CURRENT_STATE

Regenerated at `22b1d82`, committed at `8414fed`.

| staleness half | result |
|---|---|
| recorded SHA is an ancestor of HEAD | **PASS** |
| no tracked configuration source changed since | **PASS** |

**Counts exact:** `approvals` reads **3170** in the file and **3170** from
an exact head-count, three times the page cap.

**The configuration sections are byte-identical.** The whole diff is
record growth from probe traffic torn down correctly: soft-deleted 53,023
to 54,036, live unchanged at 116.

---

## 5. Promotions

**One, extending Verification 44.**

V44's existing clause is **two files colliding in one tree** - a basename
unique in a directory but not across `src/lib` and `src/routes`. **The
extension is the other axis: one name colliding with ITSELF across two
runs**, because a probe copied from another inherits its artefact names.

**The loss is worse than a backup collision**, because what it destroys is
the record of a **defect that has since been fixed** - which cannot be
regenerated without reverting the fix.

**Copying a probe is the normal way to write one**, which is what makes
this reliable rather than unlucky: the new probe measures the same
surface, wants the same screenshots, writes the same names. **The
inheritance is by construction.**

### The overwrite, and the record is clean

**Resolved.** The Phase 1 probe's outputs are renamed `p1-*`, and **both
states now exist on disk side by side**.

**The images John reviewed pre-dated the overwrite and showed the defect
correctly.** What diverged was the file, not the report and not what was
sent. Stated here so the record needs no caveat later.

### Checked and NOT promoted, already covered

| candidate | covered by |
|---|---|
| three vintages of truth on one panel | **Verification 20** - a second reader of the same value always drifts. This is a third and fourth reader, not a new rule |
| a fresh answer fetched and used only for its length | **Verification 20** again, from the other side |
| a triple-click selection dropped by a re-render | **Verification 6's** framework clause - never assert inside the same synchronous evaluation as the interaction |

---

## 6. The promotion queue

- **name-collision-by-copy** - landed this round, inside V44.
- **F3, the unclassed-control class** - **still open**, four instances, no
  instrument. Add note and Save task remain white browser defaults.
- **F8's retry-with-recorded-cause** - **unbuilt**, and see section 7.

---

## 7. FLAGGED: F8 has fired three times, across closes

| when | duration | outcome |
|---|---|---|
| polish 1, pre-commit hook | 3,551ms | **failed**, 1 of 40 |
| polish 1, immediate re-run | 2,976ms | passed |
| **polish 1 close gate, run 1** | 5,595ms | **failed**, 1 of 40 |
| **polish 2 log-close commit** | 2,523ms | **failed**, 1 of 40 |

**Three failures, and the durations are unrelated** - 3,551, 5,595,
2,523. That is the whole distinction the split ruling rests on: **F5's
diagnostic was duration and it climbed; F8's is FREQUENCY**, and it does
not run out of time, it loses one connection of forty.

**Two of the three interrupted a CLOSE** - a close gate and a log commit -
which is the worst moment for an ambiguous red, because at that moment
nobody can tell it from a real regression without re-running.

**It is the best-evidenced unbuilt item on the queue.** Recommended: **an
opening act of the follow-up-entity round, or its own small fix round.**
The treatment is already ruled - retry with a recorded cause, so a flake
stays visible rather than becoming invisible.

---

## 8. Carried forward, in order

1. **F8's retry-with-recorded-cause** - section 7.
2. **THE REGION DRIFT IS NOT CLOSED.** One server source and one reader.
   **Six copies unre-pointed**, including frozen Lead Detail's and three
   hardcoded `<option>` blocks in `index.html`. Re-point each as its
   surface is next touched. **It is not one source yet.**
3. **THE F5 CEILING HAS BEEN TIGHTENED TWICE REACTIVELY**, 25 to 6 to 3,
   the second time on variance rather than growth. When F5 is next in
   scope, **review the DERIVATION** - a proper margin over observed
   variance - **rather than a third step-down.**
4. **The follow-up-tasks entity round is next**, rebuilding the frozen
   218px panel and reclaiming the card-height remainder.
5. **Batch Edit** after that.
6. **Lead Detail is still FROZEN** pending John's parity walk.
7. **F3**, four instances, no instrument.
8. **`NurtureDialog` and the address popup** remain declared duplications
   until Lead Detail retires.

---

## 9. Gate result

**22 of 22 PASS, 0 SKIP, 0 FAIL**, first run, on `578b96b` with
`--round-close`.

| | |
|---|---|
| database suite | 100/100, 41,408ms |
| **door stage** | **PASS**, 83,786ms |
| pure / react | 519/519, 939/939 |

**F8 did not fire on this gate**, and that is one sample rather than a
change. **The last round's close made exactly that point and was proved
right within the hour** when F8 failed the log-close commit. Section 7's
three-failure record stands, and the clean run does not reduce it.

**F5 did not fire either.** It was hardened last round and its guard
watches the heaviest chunk; this gate's database suite ran in 41,408ms.
