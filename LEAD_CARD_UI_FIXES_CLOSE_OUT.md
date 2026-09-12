# The LEAD CARD UI FIXES round: close-out

Two phases, both signed off. Eleven rulings, **all eleven in the brief**,
each appended at the phase it launched. Nothing pushed.

---

## 1. The gate

**22 of 22 PASS, 0 SKIP, 0 FAIL** on `74c3510`, the exact committed tree,
with `--round-close`. Door stage **PASS, 85,204ms**. Section 9, **and it
took two runs: F6 caught the first and refused to call it green.**

---

## 2. Commit reconciliation, by counting

**7 commits**, `286c997..HEAD`.

| commit | phase | signed off |
|---|---|---|
| `a1529eb` | the brief | n/a |
| `bbf1d4a` | Phase 0 | yes |
| `93b9a2f` | Phase 1, R7 | |
| `89a331e` | Phase 1, the build | |
| `928da4e` | Phase 1, the report | yes |
| `6cf2197` | close, promotions | |
| `7be4044` | close, CURRENT_STATE | |

**Unaccounted: 0. Phantom: 0.** Two sign-offs, two phases, and every
commit belongs to a phase or to the close.

**The phase count was not taken from a heading grep.** This brief carries
its phases as prose sections and would have returned a plausible wrong
number, which is the dangerous result build-discipline 7 names.

---

## 3. Revert rehearsal, and the boundary

Rehearsed on a **detached worktree**, restoring from an **explicit ref**
and removing files added since it, then comparing **tree hashes** rather
than reading `git status`.

| | |
|---|---|
| reverted tree | `ca30e99f…` |
| `286c997` tree | `ca30e99f…` |
| **identical** | **YES** |
| main tree, before and after | `9194982f…`, unmoved |

### The boundary, measured

| | |
|---|---|
| migrations | **0** |
| `supabase/` files | **0** |
| **`src/` files** | **2** |
| `frontend/` | 2 |
| `frontend-react/` | 24 |

**THIS ROUND TOUCHES `src/`, AND LAST ROUND DID NOT.** `src/lib/format-dates.js`
is new and `src/lib/approval-page.js` reads it.

**It still reverts completely**, and the reason is worth stating rather
than assuming: **both are pure functions with no schema, no migration and
no stored data.** Nothing was written in the new format that a revert
would leave unreadable - the change is entirely in how an existing stored
value is rendered.

**THE ONE OPERATIONAL NOTE: a revert needs the API server restarted.**
`approval-page.js` is server-rendered and the dev server runs without
`--watch`. That is the stale-server clause, and it applies to the revert
exactly as it applied to the build - where it was honoured: the server was
restarted after the `src/lib` change and before any probe.

---

## 4. CURRENT_STATE

Regenerated and committed. **Both halves PASS.**

| half | result |
|---|---|
| recorded SHA is an ancestor of HEAD | **PASS** |
| tracked config sources changed since | **0** |

**Counts checked against the live database, not restated.** 117 live
records; the only movement since the previous close is in **revision**
counts, which the gate's own database fixtures produce, and the live
figures are identical across two consecutive generations.

**AND THE FIRST REGENERATION WAS WRONG, caught by reading the diff.** The
generator writes the file itself; redirecting its stdout into that same
file put two progress lines inside the document and displaced the header.
**The diff is reconciled rather than glanced at, which is what found it.**

---

## 5. F6 FIRED, ON THE FIRST CLOSING GATE

**The first run of the closing gate was launched without
`PUPPETEER_PATH`, so the door stage did not run.** The runner reported:

> 21 of 22 stages passed, 1 NOT RUN. **1 REQUIRED stage did not run, so
> this gate is UNANSWERED, not green. A ROUND CLOSE MAY NOT REST ON THIS
> RUN. Do not close.**

**That is exactly the failure F6 was built for**, at the start of this
sequence of rounds, after the LEADS close printed "All 22 stages passed"
over a silently skipped door. **It has now fired on the round that built
it**, which is the only kind of evidence Verification 9 accepts: a
detector that has never fired is an assertion, not a control.

**Twenty-one green stages and a wrong answer is precisely the shape that
is hardest to catch by reading.** The re-run with the browser available
is the gate in section 9.

---

## 6. Residue: a cleanup this close had to do

**Two gate runs were killed** - one by a ten-minute command wall, one
because a second was launched on top of the first, which is itself the
breach of the run-nothing-else rule and is recorded as mine.

**They left 33 live records**, created in a 63-second window, owned by the
two probe identities that had owned **zero** before. Build-discipline 8
says enumerate what the ACTOR writes rather than what the first check
names, so the harness's own source was read: it writes `records`,
`stage_gate_rules`, `approvals` and `record_contacts`.

| | before | after |
|---|---|---|
| live records owned by a probe identity | **33** | **0** |
| live `harness_*` records | 4 | **0** |
| `stage_gate_rules` for a `harness_*` type | **3** | **0** |
| live records, total | 150 | **117**, the figure `CURRENT_STATE` records |

**Records were SOFT deleted** per Verification 11, re-queried rather than
trusted, and **no `reference_number_counters` row was touched**. The three
`stage_gate_rules` rows were deleted outright: they are configuration for
a synthetic type whose records are gone, and they are the literal instance
build-discipline 8 was written from. **`approvals` and `record_contacts`
were left in place**, hanging off soft-deleted records, because that is
how this estate keeps history rather than orphaning it.

**Verified again after the successful gate: 117 live, 0 probe-owned, 0
`harness_*`, 93 `stage_gate_rules`.**

### And a number I nearly reported as a finding

A first pass read **989 approvals pointing at a non-existent record.** It
was a **capped scan**: the record-id set was fetched with a `.limit()`
against a table PostgREST caps far lower, so every approval whose record
fell outside the page read as orphaned.

**Re-measured by paging both tables and asserting the rows walked equal
the exact count** - 55,319 records and 3,197 approvals, both complete -
the answer is **0**. Verification 17's paged-API species, caught by its
own remedy before it reached this document.

---

## 7. Residue attributable to the ROUND itself: none

**Neither probe identity owns a single live record.**

| identity | live records owned |
|---|---|
| `266a2812` (`john+test`) | **0** |
| `23216963` (`john+test2`) | **0** |

All 117 live records belong to two other accounts. The account created
today, `walt disney Studios Ltd`, is owned by `ae65b6ef` - **an id this
session cannot write as**, since every fixture and every browser action
ran as `266a2812`.

**Stated as a fact about ids rather than as a tag sweep**, per
Verification 11's clause that residue is every live record no person owns.
**Which of those two owners are real people is John's to confirm**; it is
not this round's residue either way.

---

## 8. Promotions: two, both EXTENSIONS

### Verification 4 gains the layout clause

> **A CSS mechanism is not a layout outcome. Assert the RELATIONSHIP
> between two elements, never a property of one.**

**Twice in one phase, both found by opening the screenshot.** A dropdown
was `position: absolute` so it would not reflow the card. Two checks -
`getComputedStyle(list).position === 'absolute'`, and the step's height
unchanged with six matches showing - **both PASSED while the list rendered
730px BELOW the card**, at `top: 1106` on a 1100px viewport, because it
was a sibling of the positioned row and had no positioned ancestor at all.

**Every property asserted was true of a list parked anywhere in the
document.** "The step did not grow" was *more* true, since the list had
left the step entirely.

**The tell is an assertion naming a CSS property the fix happens to use.**
Verification 37's shape arriving inside a test assertion.

### Build discipline 3 gains the binary clause

> **Where a detector reports a binary, both verdicts need defining. The
> reassuring one is the one that gets a proxy.**

The census defined **RAW** with care and calibrated it eight ways, and
defined **ROUTED** as "the expression contains a call" - uncalibrated,
because it is the verdict that means everything is fine.
`${String(x.effectiveFrom).slice(0, 10)}` contains a call, is a second
implementation, and **the census would have printed `0 RAW` over the top
of it.**

**Write the injection that makes something wrongly PASS**, not only the
one that makes it fire.

### Checked and NOT promoted

| candidate | already covered by |
|---|---|
| the census vocabulary missing `asOf`, then `since` | **Verification 19** - a name used as an enumeration fails by silent omission. Fired twice; the defence is the module, not the scan |
| the calibration anchored on the defect its own fix removed | **Verification 9's** clause, cited in the code at the time it happened |
| the probe's fixture consumed by an earlier claim, in a loop | **Verification 7**, promoted last round |

---

## 9. What this round did NOT do

- **No walk.** Lead Detail and the Test Bed both changed appearance -
  formatters, classed controls, no empty sentence - and neither has been
  seen by a person. Their evidence is unit tests.
- **The census's name vocabulary remains its limit**, stated rather than
  claimed closed.
- **`--red` and `--amber`** are carried, not fixed (R11).

---

## 10. Carried forward, in order

1. **F8's retry-with-recorded-cause** - **unbuilt, three failures**, two of
   which interrupted a close. Still the best-evidenced item on the queue.
   **It did not fire in this round**, on any of seven hook runs plus the
   gate; that is seven samples of a frequency defect and not a change.
2. **THE REGION DRIFT IS STILL NOT CLOSED.** Six copies unre-pointed. **It
   is not one source yet.**
3. **The F5 ceiling derivation review** - two reactive step-downs, no third.
4. **The follow-up-tasks entity round is NEXT**, rebuilding the frozen
   218px panel. **It is also what unblocks R5 at 1240**, where this round
   correctly left the band alone.
5. **Batch Edit** after that.
6. **Lead Detail is FROZEN** pending John's parity walk - **and it now has
   more to walk**: new date formats and classed note controls.
7. **F3.** Four instances before this round; **R8 retired the notes header
   controls and R10 kept the textarea classed**, and **`--red`/`--amber`
   joins the family** as two tokens used and never defined.
8. **`NurtureDialog` and the address popup** remain declared duplications.

---

## 11. Gate result

**22 of 22 PASS, 0 SKIP, 0 FAIL**, on `74c3510` with `--round-close`.

| | |
|---|---|
| pure / react / database | 527/527, 957/957, 100/100 |
| **door stage** | **PASS**, 85,204ms |
| **F6** | **fired on the first run** and refused it; section 5 |
| **F8** | **did not fire**, on either gate run or any hook run this round |
| F5 | did not fire; database suite 42,078ms |

**F8's silence is eight samples of a frequency defect, not a change.** Two
consecutive closes have now said so, and the previous one was proved right
within the hour.
