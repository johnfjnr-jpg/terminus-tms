# The LEADS CARD CLEANUP round: close-out

Two phases, both signed off. Four rulings, all four in the brief at the
phase they launched. Nothing pushed.

---

## 1. The gate

**22 of 22 PASS, 0 SKIP, 0 FAIL** on `61f83a2`, the exact committed tree,
with `--round-close`. Door stage **PASS, 81,835ms**. **First run.**
Section 10.

---

## 2. Commit reconciliation, by counting

**8 commits**, `358796b..HEAD`, spanning **two briefs** - and the
accounting differs from last round's, so it is stated rather than
repeated.

| commit | round | phase | signed off |
|---|---|---|---|
| `ee72058` | LEADS - DETAILS CONSOLIDATION | brief | n/a |
| `755f68c` | | Phase 0 | yes |
| `0b9f38a` | **LEADS CARD CLEANUP** | brief | n/a |
| `b397b68` | | Phase 0 | yes |
| `e1ad67b` | | Phase 1, the build | |
| `a0afc12` | | Phase 1, the report | yes |
| `7e83f7d` | | close, promotion | |
| `87e9099` | | close, CURRENT_STATE | |

**Unaccounted: 0. Phantom: 0.**

**Last round's two extra commits were ABSORBED. These two are SPLIT.** The
consolidation round's Phase 0 found that its own R4 premise did not hold -
`#view-contact-detail` serves 10 Qualified contacts the card never shows -
and John split the work: **the card cleanup became this round, and the
consolidation became ROUND B.** Its Phase 0 is not orphaned; **it is Round
B's measurement, already taken.**

---

## 3. Revert rehearsal, and the boundary

| | |
|---|---|
| reverted tree | `0fece9d7…` |
| `358796b` tree | `0fece9d7…` |
| **identical** | **YES** |
| main tree, before and after | unmoved |

### The boundary: CLIENT ONLY, as expected

| | |
|---|---|
| migrations | **0** |
| `supabase/` | **0** |
| **`src/` (the server tree)** | **0** |
| `frontend/` | 1 |
| `frontend-react/` | 8 |
| `scripts/` | 8 |

**No server code, so a revert needs no API server restart.** The bundle is
committed, so source and artefact revert together.

---

## 4. CURRENT_STATE

**Both halves PASS.** Recorded SHA is an ancestor of HEAD; **0** tracked
configuration sources changed since.

### Counts EXACT, and proven so

**Rows walked asserted equal to the exact count**, so a page cap cannot
produce a clean reading.

| | count |
|---|---|
| live records | **119** |
| approvals | **3236** |
| `stage_gate_rules` | **93** |
| **probe-owned live records** | **0** |

**`CURRENT_STATE` says 119 and the database says 119.**

**THE 119 INCLUDES TWO OF JOHN'S OWN LEADS.** Live went 117 to 119 during
this round: **"Road Runner" and "SPIKE DOG", owned by `ae65b6ef`**, created
at 10:47 and 10:50 local. **My probes cannot write as that id**, and one of
them appears as a real card in an earlier capture. **His walk, not residue.
Checked rather than assumed, and left alone.**

---

## 5. Promotions: a REMEDY on Verification 47, and no new number

**The same question as last round, and the same answer.**

This phase's proxy fault is **already forbidden twice**:

| rule | wording |
|---|---|
| **Verification 47** | *"a probe written after the change tests the change"* |
| **build discipline 3** | *"if a check could pass while the claim is false, it is not evidence"* |

**Neither prevented it. So nothing new was minted.**

**What was missing is a REMEDY**, and this round produced one:

> **TAKE THE THRESHOLD FROM THE REQUIREMENT, NEVER FROM THE RESULT.**

The assertion was `inputWidth >= 130` **after the change measured 130** - a
tautology wearing a threshold - and **it passed on a cell that still
cropped**. Asking the requirement instead - does a real 32-character
account name from this estate's own list fit? - **it FAILED**, 208px needed
against 170px given.

> **THE HONEST TEST FAILED WHERE THE PROXY PASSED, ON THE SAME CODE.** That
> is the only demonstration of this that carries weight.

**And the tell is recorded with it: a threshold suspiciously close to what
you just measured.**

---

## 6. THE STANDING TAX, named

**Four instrument faults this phase. THREE were the same shape**: an
assertion that validates the change just made rather than testing the
requirement.

| fault | |
|---|---|
| the 130px threshold | taken from the outcome, **twice** |
| the same-tick `aria-invalid` read | **passed twice on luck** before failing |
| the stale calibration matcher | anchored on a test name **this round renamed**, so it came back SILENT while the gate went red correctly |

**All three were caught before anything was reported as fact. None was
prevented by a rule that names it.**

**This is the second consecutive close to reach that conclusion**, and it
is now written into `CLAUDE.md` beside both the rule and the index task.
**It is the standing tax on this estate's method, and it is what will slow
the Sections 6 to 11 walk** - a surface-by-surface comparison against a
document is exactly the work where an assertion shaped to what you just
found passes silently.

---

## 7. What the round proved

| claim | evidence |
|---|---|
| **R4: the gate's polarity inverted** | forbid-absent, not permit-absent; **flagged exactly the two violations before the fix**, green after |
| the shell vocabulary | **derived from `Panel.tsx`**, not retyped |
| the routing kept every hook | **7 testids across 6 probe files survived** |
| **R3: the asterisk** | `SUMMARY *` on the panel's own title, block gone, surface open so not true-by-absence |
| R3 is the shell's | a `PanelHeader` affordance, so **Round B inherits it** |
| **R2** | one row-edge line; the aria-invalid red kept; scrolls at all three widths on a vh cap; resets 31 to 0; save closes on POST 201 |
| R2 readability | a real 32-char name fits at **213/213** |
| **R1** | the rule uses the **inset box-shadow Chrome honours** and covers every card input class; **no non-autofilled field moved** |
| calibration | **12 of 12**, reverted tree byte-identical |

---

## 8. FOR JOHN'S EYE: a trade, not a fix

**The grid now scrolls HORIZONTALLY**, at 3500px of table min-width.

**That is the price of fifteen readable columns.** A sensible default for
data entry - a readable cell with a scrollbar beats an unreadable one
without - **but it is a trade, and it is flagged rather than presented as a
free win.** If the answer is fewer columns, or per-column widths instead of
a uniform 230px, that is a decision rather than a defect.

---

## 9. Carried forward, in order

1. **THE PROXY-FAULT PATTERN.** Section 6. Not a defect to fix; the tax to
   budget for, especially on the Sections 6 to 11 walk.
2. **ROUND B, THE RECORD-SURFACE CONSOLIDATION - NEXT.** The account
   section, wiring the Contacts list, retiring the messy `contact-detail`.
   **Its Phase 0 is already taken** and says the screen serves 10 Qualified
   contacts the card never shows.
3. **The region drift**, six copies, **a fifth entry**.
4. **The F5 ceiling derivation review.**
5. **F8**, unbuilt at three failures, **plus the concurrent-write
   environment timeout** - distinct, and it refused two commits last round.
6. **The follow-up-entity round**, carrying three items.
7. **The migration-conformance walk of Sections 6 to 11.**
8. **Batch Edit.**
9. **The declared duplications**, `NurtureDialog` and the address popup.

---

## 10. Gate result

**22 of 22 PASS, 0 SKIP, 0 FAIL** on `61f83a2` with `--round-close`,
**first run**.

| | |
|---|---|
| pure / react / database | **539/539**, **975/975**, **100/100** |
| **door stage** | **PASS**, 81,835ms |
| **F6** | did not need to fire; the browser was available |
| **F8** | did not fire |
| **the concurrent-write timeout** | **did not fire**, having refused two commits in the previous round |

**The pure suite is 539** and carries **ten** conformance checks plus three
staleness checks, all calibrated to fail.

**Residue after the gate: 119 live, 0 probe-owned, 93 `stage_gate_rules`** -
unchanged, so the run tore down what it created, and the 119 is still the
117 plus John's two walk leads.
