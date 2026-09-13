# The UI STANDARDS - LEADS round: close-out

Two phases, both signed off, absorbing the UI STANDARDS round's brief and
Phase 0. Three rulings, all three in the brief at the phase they
launched. Nothing pushed.

---

## 1. The gate

**22 of 22 PASS, 0 SKIP, 0 FAIL** on `3e35c70`, the exact committed tree,
with `--round-close`. Door stage **PASS, 79,569ms**. First run. Section 10.

---

## 2. Commit reconciliation, by counting

**11 commits**, `a566184..HEAD`, spanning **two briefs**, and the
accounting says so rather than presenting them as one round.

| commit | round | phase | signed off |
|---|---|---|---|
| `5927037` | UI STANDARDS | brief | n/a |
| `02595f4` | UI STANDARDS | Phase 0 | yes |
| `e77e3ce` | **UI STANDARDS - LEADS** | brief | n/a |
| `71cdab4` | | Phase 0 | yes |
| `3645126` | | Phase 1 launch, R1-R3 | |
| `3102435` | | Phase 1a, the shell | |
| `0303004` | | Phase 1b, the gates and the document | |
| `16c0a37` | | Phase 1c, the retrofit measured | |
| `d42badd` | | Phase 1, the report | yes |
| `57f1a4c` | | close, promotion | |
| `6f622be` | | close, CURRENT_STATE | |

**Unaccounted: 0. Phantom: 0.**

**The UI STANDARDS round was not abandoned - it was absorbed.** Its Phase
0 measured the inconsistency inventory this round's Phase 0 built on, and
its scope was superseded by a brief that continues
`INTERACTION_STANDARDS` rather than standing alone. **Recorded because two
briefs in one commit range looks like a miscount, and is not.**

---

## 3. Revert rehearsal, and the boundary

Rehearsed on a **detached worktree**, restoring from an **explicit ref**,
removing files added since it, comparing **tree hashes**.

| | |
|---|---|
| reverted tree | `274bb901…` |
| `a566184` tree | `274bb901…` |
| **identical** | **YES** |
| main tree, before and after | `995961b0…`, unmoved |

### The boundary: CLIENT ONLY

| | |
|---|---|
| migrations | **0** |
| `supabase/` | **0** |
| **`src/` (the server tree)** | **0** |
| `frontend/` | 1 |
| `frontend-react/` | 13 |
| `scripts/` | 10 |

**No server code changed, so unlike the previous round a revert needs no
API server restart.** The dev server serves the frontend from disk; a
revert plus a rebuild is the whole procedure.

**And the bundle is committed**, so a revert restores the built artefact
with its source rather than leaving them disagreeing.

---

## 4. CURRENT_STATE

Regenerated and committed. **Both halves PASS.**

| half | result |
|---|---|
| recorded SHA is an ancestor of HEAD | **PASS** |
| tracked config sources changed since | **0** |

### Counts EXACT, and proven exact

Not "the query returned a number" - **the rows walked were asserted equal
to the exact count**, so a page cap cannot produce a clean reading.

| | count | scan |
|---|---|---|
| live records | **117** | walked == exact |
| approvals | **3223** | walked == exact |
| `stage_gate_rules` | **93** | walked == exact |

**`CURRENT_STATE` says 117 live and the database says 117.**

**Residue: 0 live records owned by either probe identity.**

---

## 5. Promotions: ONE extension, and a deliberate refusal to mint a second

### Verification 7 gains the third axis: BEHAVIOUR

Its existing clauses cover what **surrounds** new markup and the
**treatment** a replacement wears. This is what the old element **did**,
in a line with no comment on it.

A hand-rolled backdrop carried `onClick={(e) => e.stopPropagation()}`. The
shared `Modal` that replaced it did not. **The lead card is itself a click
target that navigates**, so a backdrop click bubbled to the card.

**The new component's logic was perfect, and that is what made it hard**:
the dirty check ran, the refusal held, the nudge was revealed - into a
view that had just been set to `display: none` underneath it. **It
presented as the refusal failing.** No unit test could see it.

**The check: before replacing a component, list what the old one DID that
is not in its props.** A one-line `stopPropagation` with no comment is the
shape, because a line nobody explained is a line nobody will miss.

### And NOTHING ELSE, on the business's own reasoning

> *"Weigh whether ANOTHER promotion helps given the ones above recurred
> anyway - a promotion that won't be applied is not worth minting."*

**Checked, and the observation is already in the file twice**: *"knowing a
rule confers no ability to spot its instances"*, at Verification 16 and in
the index task. **What was missing was evidence, not a rule.**

**So the existing statement got this round's count, and no new number was
minted.** Seven self-caught faults; at least three were shapes already
promoted:

| fault | the rule it was already covered by |
|---|---|
| read the suite's COUNT, not its EXIT CODE | Verification 16's corollary |
| asserted an ATTRIBUTE where visibility was the claim | Verification 4's clause |
| the harness's own source satisfied the scan | Verification 39's Round 8 remedy |

> **The rules did not prevent any of them. They made every one fast to
> diagnose.** That is what promotion buys, it is worth having, and it is
> not immunity. **A close reporting a promoted rule as a control is
> overstating it.**

**The consequence recorded in the file: prefer a rule that will be
APPLIED over one that is merely true**, because this file is now long
enough that its reading cost is real.

---

## 6. The seven faults, listed plainly

**Four build:**

1. A **JSX comment between attributes** that `tsc --noEmit` ACCEPTS and
   the bundler rejects - the typecheck passed and 33 tests failed on a
   parse error in an unrelated file.
2. A **`className` beside a spread** that would have overwritten
   `.field-blocked`, the qualification gate's own highlight. Caught by
   TypeScript.
3. A **focus trap depending on `offsetParent`**, which jsdom has no layout
   to provide.
4. An **unguarded `scrollIntoView`** that threw outside any assertion, so
   the suite printed **975 passed and exited 1**.

**Three harness:**

5. A **visibility helper passed as a STRING**, reporting a 1920x1200
   element as invisible.
6. **The harness's own source satisfying the staleness scan** with the
   name it injects.
7. A **non-unique anchor**, which the harness refused to guess at.

**Plus two environment refusals**: the database suite refused two commits
on concurrent writes, at **10s connect timeouts** and then **60s statement
timeouts**, both clearing after a pause.

---

## 7. What the round proved

| claim | evidence |
|---|---|
| **Section 4** | **0 of 6 to 8 of 8** |
| **Section 5** | **1 of 3 to 4 of 4**, proven by attempted data loss |
| S1 and S3 | **0px at 1240, 1920 and 3440** |
| the conformance gate | **calibrated 8 of 8**, reverted tree byte-identical |
| unclassed controls | **10 to 3**, all three the frozen panel |
| undefined CSS vars | **2 to 0** |

**And the premise correction is the finding.** This was **not migration
rot**: Park and New Lead survived intact. **The standard was never APPLIED
to surfaces built after it, for want of enforcement.** Drift, not rot -
which is precisely what the gate now prevents.

---

## 8. Carried forward, in order

1. **THE RECURRING-INSTRUMENT-FAULT PATTERN ITSELF.** Three of this
   round's seven were already-promoted shapes. **Not a defect to fix - a
   property to watch**, and the reason the next round should reach for an
   existing rule's remedy before writing a new instrument.
2. **F8's retry-with-recorded-cause**, unbuilt, three failures.
3. **THE NEW CONCURRENT-WRITE ENVIRONMENT TIMEOUT**, distinct from F8:
   3-4 of 40 writes failing at a pinned 10s or 60s, clearing after a
   pause. Two commit refusals this round.
4. **The region drift**, six copies, unchanged for a fourth entry.
5. **The F5 ceiling derivation review**, not a third step-down.
6. **The follow-up-tasks entity round is NEXT**, and it now carries three
   things: rebuilding the frozen panel, **`lead-followup-btn`'s placement
   (R2)**, and **`FollowUpTask`'s three unclassed controls (S5)**.
7. **The migration-conformance walk of Sections 6 to 11.**
   `deal/section4.tsx`'s broken `aria-controls` is the first measured
   evidence the rot reaches those surfaces.
8. **Batch Edit.**
9. **Lead Detail is FROZEN** pending John's parity walk.
10. **The declared duplications**, `NurtureDialog` and the address popup.

---

## 9. What this round did NOT do

- **No walk.** Every claim is a probe or a screenshot.
- **The conformance gate is STRUCTURAL only.** S1's right-alignment and
  S3's alignment are verified by probe at three widths but are **not yet a
  gate stage**.
- **`NotesHistory`'s frozen consumers were not exercised live**; their
  evidence is the unit test asserting nothing changes without `title`.
- **Sections 1, 2 and 3 remain unmeasured** against the card.

---

## 10. Gate result

**22 of 22 PASS, 0 SKIP, 0 FAIL** on `3e35c70` with `--round-close`,
**first run**.

| | |
|---|---|
| pure / react / database | **537/537**, **975/975**, **100/100** |
| **door stage** | **PASS**, 79,569ms |
| **F6** | did not need to fire; the browser was available |
| **F8** | did not fire |
| **the concurrent-write timeout** | **did not fire on the gate**, having refused two commits earlier in the round |

**Residue after the gate: 117 live, 0 probe-owned, 93
`stage_gate_rules`** - unchanged, so the run tore down what it created.

**The pure suite is 537 and carries the two new gates**: seven
conformance checks and three staleness checks, both calibrated to fail.
