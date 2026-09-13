# LEADS CARD CLEANUP, Phase 1: the build

Committed at `e1ad67b`. Suites by **exit code**: **pure 539/539, react
975/975, database 100/100.** Conformance gate **calibrated 12 of 12**,
reverted tree byte-identical. Live proofs at **1240 / 1920 / 3440**.

---

## What is NOT in this phase

**Nothing.** R1, R2, R3 and R4 all landed. `contact-detail` and the
Contacts list were **not touched** - that is Round B.

---

## 1. R4: the gate, widened structurally

**Built first, so the gate verified the routing rather than the reverse.**

**The old test was a list of three class names.** `QualifyCompletion` used
none of them and passed while hand-rolling a panel header.

**The new test inverts the polarity:**

> Any class on a Leads surface matching `-(title|head|header|actions)` is
> an offender **UNLESS** it is one the shell emits - **derived from
> `Panel.tsx`, not retyped** - or **declared by a CALL** with its reason.

**A list permits everything absent from it. This forbids everything absent
from it.** A future `foo-header` goes red until somebody says in a diff why
it is not a panel. That is Verification 19's actual remedy: **fail on the
unrecorded instance.**

**Four declared non-panels, each with its reason in code**: the record
action bar and the card head (Section 6's shape), the list group heading,
and a modal's own header line.

**Proven before the fix**: the widened test flagged **exactly the two
violations and nothing else**, then went green once the surface was routed.

### The routing kept every hook

**Seven testids across six probe files survived**, because `Panel` already
takes `testid` and `headerTestid`. Last round measured what a silent rename
costs: six timeouts that read like product defects.

**And `lead-card-col-title` stays in the stylesheet** - `NotesHistory`'s
non-title path still renders it for `ContactHost` and `TestBedHost`. **The
three-consumer constraint held.**

**`lead-complete-actions` became `form-actions`** - the estate's own footer
row, already declared - rather than minting a class the widened gate would
correctly flag.

---

## 2. R3: the asterisk, owned by the shell

**`PanelHeader` gained a `required` affordance.** Not an asterisk placed in
`InlineSummary`: **any panel that must be completed now says so the same
way, and Round B's account section inherits it without deciding again** -
which is what "surface-owned, not a card-only patch" has to mean.

| claim | evidence |
|---|---|
| the block is gone | `lead-summary-pointer` absent |
| **and the surface is open** | so the claim is not true by absence |
| the asterisk exists and is in the panel's own title | title reads **`Summary *`** |
| on the panel header line | inside `[data-panel-header]` |

**The mark is fed from the blocking list the actions component already
owns**, published by a callback. **One writer, one value** - not a second
fetch, and not a lifted state that would re-open last round's ruling.

---

## 3. R2: the grid

| claim | measured |
|---|---|
| the input has no underline of its own in a cell | `0px` |
| header and cell share ONE row-edge treatment | `1px rgba(242,242,240,0.12)` |
| **the aria-invalid red SURVIVES** | `1px rgb(224,108,108)` |
| the body scrolls vertically | `scrollHeight 655 > clientHeight 624` |
| **a realistic value is fully visible** | `"Singapore Instutue of Technology"` needs 213px, cell gives **213px** |
| the scroll could be moved | `scrollTop 31` - so the reset claim is not vacuous |
| **scroll RESETS on reopen** | 31 to **0** |
| a COMPLETE row enables Save | per John's note; name alone leaves it disabled |
| **on SAVE the modal CLOSES** | POST `201`, `"1 lead created."`, modal hidden, list showing |

**At three widths**: scrolls at 1240, 1920 and 3440, cap `520px`, input
`213px` at each - **the vh cap holds rather than being tuned to one
viewport.**

**Closing is conditional on the count.** A save where every row is refused
leaves the grid open with those rows in it, which is the partial-failure
behaviour it was built for.

---

## 4. R1: the autofill override, and what is NOT proven

**The rule**: an inset `-webkit-box-shadow` plus `-webkit-text-fill-color`
on `.lead-field-input`, `.lead-summary-input`, `.cd-note-input` and
`.acct-picker-input`.

**What the static test asserts**, and it is deliberately more than
existence: the rule exists, **it uses the inset box-shadow Chrome actually
honours** - `background-color` is ignored on that pseudo-class, so a rule
setting it would pass a does-it-exist check and do nothing - and it
**covers every input class the card renders**.

**What the live probe asserts**: **no non-autofilled field moved.** All 17
card inputs still on `rgb(21,22,28)`, the value the prior Phase 0 recorded.

> ### THE LIMIT, restated
>
> **Headless Chrome cannot trigger autofill. This round has NOT shown
> white-before and normal-after, and does not claim to.**
>
> **The visual confirmation is John's, next time autofill fires.** The
> probe prints this limit in its own output, not only here.

---

## 5. Four faults I caught, and three are the same shape

**A THRESHOLD I SET AFTER THE CHANGE, TWICE.** The readability check began
as `inputWidth >= 130` - a number chosen once the change was made, which
passed on a cell that still cropped. Rewritten to assert that a **real
32-character account name from this estate's own list fits**, it **failed**,
at 208px needed against 170px given. **Sized from the measurement, it
passes at 213/213.**

> **A pixel threshold picked after the fact is a proxy for the claim, and
> build discipline 3 is explicit that a check which can pass while the
> claim is false is not evidence.** It took two iterations to stop doing
> it.

**A SAME-TICK READ THAT PASSED TWICE ON LUCK.** The `aria-invalid` line
measurement ran immediately after typing, so it read the frame before
React's re-render. Two runs passed; the third failed. Fixed with a
`waitForFunction` on the state itself - Verification 6's framework clause.

**A CALIBRATION MATCHER LEFT STALE BY MY OWN RENAME.** Last round's
injection anchored on a test name this round changed, so it came back
**SILENT while the gate was going red exactly as it should.** Verification
51's caveat: before a silence names an unasserted claim, confirm the matcher
saw the failure.

---

## 6. Two records that are NOT residue

Live records went **117 to 119**, and probe-owned residue is **0**.

The two are **"Road Runner"** and **"SPIKE DOG"**, owned by `ae65b6ef` -
**John's own account** - created at 10:47 and 10:50 local. **My probes
cannot write as that id**, and "SPIKE DOG" appears as a real card in an
earlier capture.

**John's own leads from his walk. Checked rather than assumed, and left
alone.**

---

## 7. What this does NOT establish

- **R1's visual**, for the reason ruled.
- **No walk.** Every claim is a probe or a screenshot.
- **The grid now scrolls HORIZONTALLY** at 3500px of min-width. That is the
  price of fifteen readable columns and it is a real trade - **worth your
  eye before it is called finished.**
- **Nothing about Round B.** `contact-detail` and the Contacts list were
  neither touched nor measured.
