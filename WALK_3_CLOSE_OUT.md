# Walk 3 close-out

Branch `walk-3`, off `main` at `35e6d8e`. **Nothing merged, nothing pushed.**

Fourteen commits. This document reconciles them against the rulings by counting,
not by reading.

---

## 1. The eight walk findings, with a disposition each

| | Finding | Tier | Disposition | Commit |
|---|---|---|---|---|
| **V1** | Leads detail: company, source and created after the status chip | cosmetic | **BUILT.** Header gains the same summary line the list row shows, after the status chip, through one shared `leadSummaryLine` so the two cannot drift | `60a2575` |
| **V2** | Contact: a gap between the summary/notes/follow-up row and personal details | cosmetic | **BUILT.** `.lead-card-body` gains `margin-bottom: 18px` | `60a2575` |
| **V3** | Contact: only the notes panel should extend on ALL | cosmetic | **BUILT.** `.lead-card-body` gains `align-items: start`, so summary and follow-up stop stretching | `60a2575` |
| **V4** | Contact: the note save raising the discard modal | full | **BUILT.** Measured first: the loss the prompt warned about **does not occur**. The prompt is gone | `9722d87` |
| **V5** | Commercials: ArrowDown does not reach the next field | stopped, then ruled | **BUILT as R-K** | `5aedbf6` |
| **V6** | Commercials: Enter does not navigate to the next field | stopped, then ruled | **BUILT as R-K**, same mechanism | `5aedbf6` |
| **V7** | Test Bed: the Cost Summary's unsaved green treatment | stopped, then ruled | **BUILT as R-V7.** Closes `DESIGN_PRINCIPLES.md` open item 37 | `202c113`, `a4192f8` |
| **V8** | Test Bed: the reason line reserving space it is not using | specified | **ALREADY SATISFIED**, measured. The deliverable became the calibrated guard that keeps it so | `e6c6216` |

**Eight findings, eight dispositions, no carried item.** V5, V6 and V7 were
correctly stopped rather than built on a guess: each needed a ruling that was
John's to give, and each got one.

---

## 2. The rulings, all of them

Build discipline 7's own remedy is that a ruling given in conversation is
appended to the brief **at the phase it launches**. Every ruling below is in
`WALK_3_BRIEF.md`, and the count here is against that file rather than against
memory.

### Method (M1 to M6)

| | Ruling | Where it lives |
|---|---|---|
| **M1** | A markdown-only commit runs the cheap stages only | `CLAUDE.md` build discipline 17; **built into `scripts/pre-commit-suites.mjs`**, fails closed |
| **M2** | The cosmetic tier is enforced as written; live injection harnesses only where a handler or a write is touched | build discipline 17 |
| **M3** | Walk findings batch into one findings phase per walk | build discipline 17 |
| **M4** | A phase extending a mechanism calibrated this round adds injections only for its new claims | build discipline 17 |
| **M6** | Every report also lands in OneDrive as a dated file, and **the directory is looked up, never typed** | `CLAUDE.md` output style |

M1 was **measured before it was accepted**, because the obvious objection is
that a suite might read a document. Five do; all five run under the pure stage
M1 keeps. The stages it drops are exactly the two a prose change cannot reach.

M6 earned its "look it up" clause twice in one hour: once on the account name
(`OneDrive-Personal`, not `OneDrive`) and once on the folder, which is
`TMS Testng notes` and not the `TMS Testing Notes` it was called in conversation.
Spelled as it was said, `mkdir -p` would have made a correctly-spelled twin and
every later report would have gone to the empty one.

### Build (R-K, R-V7, R-P, P1 to P4)

| | Ruling | Status |
|---|---|---|
| **R-K** | Enter and the vertical arrows commit and move inside a field panel | **BUILT**, `5aedbf6` |
| **P1** | A move with no target commits and closes | **BUILT**, ruling of record |
| **P2** | The order is the panel's DOM order | **BUILT**, ruling of record |
| **P3** | A panel declares itself with `data-field-panel` | **BUILT**, ruling of record |
| **P4** | A key the editor itself uses is not taken from it | **BUILT**, ruling of record |
| **R-V7** | One attention token, derived for contrast | **BUILT**, `202c113` |
| **the ten** | The `--amber` sites adopt `--attention` | **BUILT**, `a4192f8` |
| **second surface** | One live keyboard pass beyond Commercials | **BUILT**, with a scope finding (section 4) |
| **R-P** | The two unmeasured prompts measured and classified | **BUILT**, both false premises, both removed |

---

## 3. The Section 2 supersession

**Recorded in `INTERACTION_STANDARDS.md` Section 2 itself**, not only in the
brief, which is what the ruling asked for. It carries the key table, the
form-versus-panel boundary, the sentence that **commits means the DRAFT and not
the record**, and the note that arrows navigate between fields and still never
seed text.

Verification 23 is cited at the site: two correct decisions about one question
produce a conflict nothing detects, and the fix is one governing each context
rather than both existing silently.

---

## 4. Open item 37, closed; and the Verification 23 conflict, closed with it

**Item 37 asked for a palette decision reserved for the business, and got one.**
`--attention: #EDB45A`, hsl(37 80% 64%), 9.21:1 on `--dark` and 9.69:1 on
`--black`. Approved as shown at 1440.

The value is **derived**, and the requirements were written before the number.
R5 is the one that decided it: *at least as prominent as the `--green` it
replaces*. Without that clause the change makes the marker quieter than the
treatment it improves on, which is the opposite of the point - and it is the
requirement the estate's existing amber fails.

**The V23 conflict was reported when the token was minted and closed in the same
round.** `--amber` already dressed this family at ten sites and was a colour
NAME with no meaning attached. The closure is **deletion, not an alias**, which
is what rule 23 prescribes: an alias leaves a name anybody can reach for.

---

## 5. What was found that nobody was looking for

- **`.cd-dirty` carried a different literal.** The contact panel's own unsaved
  count was `var(--amber, #d9a441)` against the other nine's `#E0A33E` - the
  same MEANING as the unsaved cost badge R-V7 was built for, in a different
  amber.
- **The fallbacks were load-bearing in the wrong direction.** `var(--x, fallback)`
  is deliberately excused by the estate's undefined-property invariant, because
  such a reference is well defined either way. Those ten literals were what kept
  ten declarations outside that check. Removing them put them under it.
- **A comment that had gone false.** `--amber` "is used four times in this file
  and DEFINED nowhere" - true when written, false from Round 40's S5, and the
  count had reached ten.
- **THE CONTACT PANEL HAS ONE FieldRow ROW.** Personal Details and Address
  Details are a different component entirely. R-K is inert there **by its own P4
  ruling**, because that one row is a textarea. The one-row count is now
  asserted, so routing those fields through FieldRow turns the test red and
  earns the surface a real pass.
- **A THIRD amber, not swept.** `.btn-attention` and three neighbours use a
  hardcoded `rgba(224,130,74,0.9)`, which composites to **5.18:1** - passing AA
  for text and failing R5 by a wide margin, on a class whose name is the token's
  own word. `--red` has the same shape at several sites. **Reported, not
  changed:** the ruling named the ten `--amber` sites, and a third colour at four
  more is a ruling rather than a refactor.

---

## 6. Instrument faults, all mine, all caught before they counted

Recorded in full because a close that reports only the ones that found a product
defect misrepresents what verification costs.

| What | How it was caught |
|---|---|
| A live calibration read **SILENT** on a real injection, because the probe died at the wait one line above the check it was meant to fail | reading WHICH assertion ran, not the exit code |
| A screenshot was **overwritten by the injected run**, so for a while it showed the broken screen under a report describing the healthy one | opening the file the report points at |
| An Escape-revert assertion compared `undefined` with `undefined` | asking what the check would do with nothing on either side |
| Two guards passed with the whole feature absent | asserting the move beside the thing it carries |
| A colour was read off a **hidden** element and reported as a pass, because the colour of a hidden element is still the colour | asserting rendered size and the real count first |
| The cause of that: **all seventeen contacts belong to somebody else**, so the door correctly refused and nothing was typed | reading the owner, and adding `freshContact` |
| ArrowUp "failed" on a staff picker, where by P4 the arrows belong to the option list | the product was right and the assertion was wrong |
| A save click failed as "not clickable" while the bar read `1 change`: **two `save-all` in the document**, one in this view | asking what is at the point |
| A **vacuous assertion**: with the prop removed, nothing incremented the discard counter, so "does NOT ask" was true by construction | a SILENT injection, which is the only thing that can tell a satisfied assertion from an empty one |

**Two of these are the same shape as rules this file already promotes**, which
is the limit of promotion measured again: the rules made each one fast to
diagnose and prevented none of them.

---

## 7. Promotions proposed

**One**, and it is proposed rather than taken.

> **A WARNING IS A CLAIM, AND NEEDS THE SAME EVIDENCE AS ONE. Before shipping a
> dialogue that says an action will lose something, DRIVE THE ACTION AND MEASURE
> WHETHER THE LOSS OCCURS.**

**Three instances in this round, all in one family and all false.** The note
save, the link to Account, and save-and-park each raised a discard dialogue, and
in all three the field edits **survived**, because every one of them ends in a
reload of the same record and `useFieldRows` drops drafts only when the subject
changes.

**Why it is not already covered.** Verification 22 is the nearest - a required
field with no reader becomes ceremony - and its remedy is *name what reads it*.
This one's remedy is *drive the action and measure the loss*, which is a
different act, so by this file's own collapse test they stay two rules.

**Why it will be applied rather than merely true.** It fires at a specific
moment, when somebody writes a confirm dialogue, and it prescribes one concrete
step. The cost of not having it was three prompts shipped over three rounds, each
teaching the person that the warning means nothing - which is worse than no
warning, because it spends the one signal the screen has for a real loss.

**Not proposed:** the instrument faults in section 6. Each is an instance of a
rule that already exists, and adding a number for each would grow the reading
cost of every future round while changing nothing.

---

## 8. Exit gate

| Point | Answer |
|---|---|
| Every finding has a disposition | Yes, 8 of 8, section 1 |
| Every ruling is in the brief at the phase it launched | Yes, section 2 |
| The Section 2 supersession is in Section 2 | Yes, section 3 |
| Item 37 closed | Yes, with the derivation recorded |
| Every claim has evidence with the check named | Yes, per commit |
| Every new guard calibrated both directions | Yes: 14/14 R-K, 12/12 attention, 3/3 R-P |
| Screenshots opened and read | Yes: R-K pass, R-V7 at 1440, three amber sites |
| Fixtures torn down | Yes, re-queried by tag, zero remaining on every run |
| `CURRENT_STATE.md` regenerated | See section 9 |
| Full gate | See section 9 |
| Merged or pushed | **No.** Waiting on John's word |
