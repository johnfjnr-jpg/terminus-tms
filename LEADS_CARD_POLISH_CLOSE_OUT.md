# The LEADS CARD POLISH round: close-out

Two phases, both signed off. Nothing pushed. The word is John's.

**One proposal needs a ruling: F5 is no longer a carry.** Section 6.

---

## 1. The gate

**Stated after this commit**, on the exact tree, run with `--round-close`
so F6 refuses a skipped required stage rather than summarising it as a
pass. See section 9.

**And this gate covers more than this round.** The last full gate was the
LEADS round's close at `6f1cd97`; **18 commits have landed since, across
two rounds.** The LEADS CARD round - the qualify conversion, the atomic
function, the card itself - **never executed a close and was never
gated as a round.** Every commit passed the pre-commit hook's three
suites, but the 22-stage gate with its HTTP probes and the door stage has
not run over that work until now. Stated because it is a fact about what
this gate is answering for.

---

## 2. Commit reconciliation

`git rev-list --count a1075f4..HEAD` is the authority.

| # | commit | maps to |
|---|---|---|
| 1 | `95f4f92` | the round instruction: write the brief, execute Phase 0 |
| 2 | `743d7ca` | Phase 0, measurement only |
| 3 | `132eab2` | Phase 1: R1, R2, R4, R5, R6, R3-in-part |
| 4 | `a688d57` | Phase 1 report, and F8 recorded |
| 5 | `12dfc50` | **R5 ruled (a)**, and `flaky-gate-tests` named as a class |
| 6 | `b6da38a` | close: three promotions |
| 7 | `aad2a45` | close: CURRENT_STATE |
| 8 | this | close: the close-out |

**Unaccounted 0. Phantom 0.** The count is stated against `rev-list` in
section 9, on the final tree; the commits after row 5 are this close's
bookkeeping, and the terminator is the same one the LEADS round recorded:
a table cannot name its own commit.

### Rulings, all in the brief at the phase that launched them

**R1 to R8 numbered, plus four sign-off rulings appended in place** - R1
reframed and merged with R6, R3 deferred in part, R2 confirmed card-local
and flipping R11, and **R5 ruled (a)**. Plus the promotion queue.

**Checked by counting, not by reading**, because three consecutive rounds
were caught that way. **8 of 8 numbered, 4 of 4 sign-off rulings, nothing
discovered at the close.**

---

## 3. Revert rehearsal

Run on a detached worktree; the main tree was never touched.

| | |
|---|---|
| main tree before | `aad2a455430e5e7939195a0b07e3cf866e88b2fe` |
| main tree after | `aad2a455430e5e7939195a0b07e3cf866e88b2fe` |
| `git revert --no-commit a1075f4..HEAD` | exit 0, no conflicts |
| resulting tree | `02185d4ea790f6a48467698cd63b035fda377b79` |
| pre-round tree | `02185d4ea790f6a48467698cd63b035fda377b79` |

**Identical**, verified by tree hash rather than by reading `git status`.

### The boundary, and this round's is unusually clean

**Zero migrations.** R2 and R4 are route-and-client changes, so **this
round reverts completely** - there is no applied SQL whose effect
survives the file's removal.

**That is not true of the round before it**, and the distinction matters
if both are ever unwound: the LEADS CARD round applied two migrations,
and reverting its files would leave `qualify_contact` in the database and
`parent_record_id` gone from the Qualify gate. Unwinding those needs new
migrations, written deliberately.

Soft-deleted fixtures do not return, correctly.

---

## 4. CURRENT_STATE

Regenerated at `b6da38a`, committed at `aad2a45`.

| staleness half | result |
|---|---|
| recorded SHA is an ancestor of HEAD | **PASS** |
| no tracked configuration source changed since | **PASS** |

**Counts exact:** `approvals` reads **3118** in the file and **3118** from
an exact head-count - three times the 1000-row page cap, so a paged read
could not have agreed by luck.

**The diff spans two rounds, and that is stated rather than left to be
noticed.** `parent_record_id` leaving the Qualify gate (16 contact rules
to 15, the table 94 to 93) is the **LEADS CARD round's** R1 migration.
CURRENT_STATE was last regenerated at the LEADS round's close, and the
LEADS CARD round never executed one. Everything else is record growth.

---

## 5. Promotions

Three, each extending an existing rule, each placed inside it, numbering
untouched.

**Verification 48 gains the ACROSS-RUNS reading.** Rule 48 reads a
duration against the stage's own normal to answer *did this run at all*.
The same number read across runs answers a different question: **is this
a flake, or a defect on a clock?** Four readings of one gate test -
passing 6,016 then 6,339 (flat), failing 15,957 then 19,887 (+25%) -
while the table it pages grew 3,479 rows in a day. **Any retry policy
collapses those four readings into "passed on attempt 2"**, destroying
the evidence that separates a flake from a deadline.

**Verification 14 gains `elementFromPoint`.** Its clause says a failed
EFFECT assertion must carry the CAUSE's own answer; in a browser there is
a third possibility an HTTP status cannot see - **the click landed on
something else.** Present, enabled and in view are three properties of the
element; **what is on top of it is a fourth**, and no assertion about the
element can see it.

**Verification 43 gains the door's own SCOPE: a door must never kill the
way out.** A control whose job is to LEAVE is a read affordance, and the
exemption is a declared property the door already reads, never a class
name.

### Checked and NOT promoted, because already covered

| candidate | covered by |
|---|---|
| a CSS rule targeting a class that exists nowhere (`.notes-list`) | Architecture 9's fourth variant, a literal that cannot be falsified |
| my own class-existence scan satisfied by its own comment | Verification 39, strip comments before matching - and it fired on me within the minute of writing the comment |
| a grid item's stretched height read as its content height | Verification 33, a count is not a structure |
| a probe waiting on a DOM state the reload was replacing | Verification 6's framework clause |

---

## 6. F5, ELEVATED: A PROPOSAL NEEDING A RULING

**F5 is no longer a flaky test to carry.** The failing case is climbing
while the passing case is flat, and `record_revisions` grows daily:

| | duration |
|---|---|
| passing, LEADS round | 6,016ms |
| passing, this round | 6,339ms |
| failing, LEADS round | 15,957ms |
| **failing, this round** | **19,887ms** |

`record_revisions`: **78,395 to 81,874 rows today alone.**

**It is a defect on a clock.** Bimodal, and the bad case gets worse, so it
crosses the statement timeout more often rather than less. **It fired in
the very commit that named it as a class.**

**THE PROPOSAL: harden F5 - bound the scan so it cannot outgrow the
statement timeout - as either THIS close's act or the NEXT round's first
act. John rules which. Not indefinite carry.**

**Retry is the fallback only for what cannot be hardened**, and F5 can
be: the scan pages a growing table to prove it examined every row
(Verification 17's own requirement), so the fix is to bound the work
rather than to weaken the coverage claim.

**F8** (`atomicity: 40 concurrent appends`, one dropped connection of
forty) is the transport rather than a deadline, and is the case where
retry may genuinely be the right answer. Both stay on the queue as the
class `flaky-gate-tests`.

---

## 7. The promotion queue as it stands

- **F3, the unclassed-control class** - four instances across three
  phases. Presence, position, state and behaviour all read green on a
  white browser default; every instance was found by opening a
  screenshot.
- **`flaky-gate-tests`** - F5 with its trend (section 6) and F8.

---

## 8. Carried forward

1. **The follow-up-entity round is next.** It rebuilds the frozen 218px
   panel and **reclaims R3's remainder**, which is why R3 was deferred
   rather than forced.
2. **Batch Edit**, after that.
3. **`NurtureDialog` and the address popup are declared duplications.**
   Both become the only copy when Lead Detail retires; until then a
   change to either flow lands in two places.
4. **Lead Detail is still frozen**, pending John's parity walk.
5. **F4**, `reference_code` null on the contacts list, from the LEADS
   round. Untouched.
6. **The server-side reverse transitions** - `Qualified -> Unqualified`
   answers 200, `DELETE /contacts` untouched - still UI-only-enforced. A
   governance round.

---

## 9. Gate result

To be stated on the tree this commit creates.
