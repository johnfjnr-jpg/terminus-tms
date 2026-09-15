# Standard rollout (white fields): close-out

**CLOSED** on the gate at `11b7ed4`: **24 of 24, exit 0, ONE run for the
batch**, light path. **PUSHED** - `ls-remote` confirms `origin/main` = local
HEAD = `11b7ed462bdd51bae7bf230efeb1b2db7106a38d`. **John's walk confirms the
screens.**

**NO SERVER RESTART**: `src/` unchanged across all three commits. The change is
`frontend/style.css`, served from disk - a browser reload is all it needs.

---

## TWO CORRECTIONS TO THE CLOSING INSTRUCTION, recorded because the log must
## describe what shipped

The instruction closes this round as *"one CSS rule ... across all 5 FieldRow
surfaces + the 22 static commercial inputs classed to match"*. **Neither half
of that is what was built**, and the difference is measurable:

1. **THE 22 COMMERCIAL INPUTS WERE NOT CLASSED. Nothing was folded in.**
   Sized in Phase 1: they are `type="text"`, so the estate's existing global
   rule - `input[type="text"], input[type="date"], select, textarea` - already
   gives them the dark treatment. **They were never white.** `git diff` on
   `frontend/index.html` across this round is **0 files changed**.
2. **THE RADIUS IS FOUR SURFACES, NOT FIVE.** `FollowUpTask` is **explicitly
   not a `FieldRow`** - its own comment says so - and its inputs carry
   `type="date"` and `type="text"`. **Never white, untouched.**

**The code is green and correct either way; it is the description that would
have been wrong.** A close-out that records a change the commit does not
contain is the exact fault this estate has a pre-commit hook for.

## What actually shipped

**ONE CSS RULE.** `FieldRow`'s TEXT editor renders `<input>` with **no `type`
attribute** (`editors.tsx:71`), and `input[type="text"]` does not match an
input without the attribute - an attribute selector matches the attribute, not
the computed default. That one editor fell through to the browser default and
rendered white. The `date`, `select` and `textarea` editors were always
matched.

Fixed by **extending `.lead-field-input`'s selector list** rather than writing
a second block with the same declarations (Verification 20), plus the contact
panel's scoped 12px rule gaining the edit half so a row no longer jumps size on
click. **It also revived an inert marker**: `[data-dirty="true"]` colours a
border these inputs did not have.

**Proven with editors OPENED on all four surfaces - 8 of 8** - because the
defect exists only in the open state. Measured at rest: **26 display rows, 3
inputs.** That is why every earlier probe found nothing.

## PROPORTIONATE TESTING'S FIRST REAL TEST OF ITS OWN LIMIT: PASSED

The principle says **if you have to argue a change is cosmetic, it is not**.

**R2 was the case that tested it.** The 22 commercial inputs were **SIZED in
Phase 1 rather than committed blind** - and sizing them found they needed no
change at all. **The line held**: nothing was waved through, and nothing was
scoped up unnecessarily either.

**And the blast radius was handled as FORETHOUGHT**, which is the Create-bug
lesson applied rather than quoted: the contact Summary row shares the rule and
was **verified, not discovered afterwards**.

## Recorded plainly: four probe faults of my own

A fixed delay photographed **"Loading the record…"** · a **non-owner** record
measured for editable inputs it cannot have · a font-size compared against the
**wrong row** · a selector keyed on a **testid the Account's first editable row
does not carry**. Each cost a cycle; none reached the business as a finding.

**And one inference that was simply wrong**: my Group B Phase 0 named the 22
commercial inputs as the likely cause of the white. It was wrong because I read
the markup ("no class") instead of the stylesheet.

## Carried

1. `StageActions` outside the conformance gate.
2. The two unstyled buttons (`Link to Account`, `Save task`).
3. **(d)** full `ContactHost` retirement - unscoped.
4. The **ENFORCEMENT GAPS** carrieds.
5. **Navigation state survival** - component state persists across navigation,
   because the shell re-renders its root rather than remounting.
6. **Item 5** - teardown-scoping's population dependency on accumulated history.
7. **The Commercials tab does not switch under a probe** - unexplained,
   unrelated to this fix, and the reason R2 was settled from the stylesheet
   rather than live.

## NEXT, on John's go: TEST BED LAYOUT

Summary / Notes / Follow-up into the **shared header panel** (Test Bed becomes
its third consumer, follow-up comes with it, **blast radius checked against
leads and contacts**) · **Key Dates** beside Site Details · **Sensor Counts and
Costs** to the Commercials tab · **the missing contacts dropdown - FULL PATH**,
and worth asking whether it shares a root with the industry and contact-dropdown
bugs.

**Medium, mostly reuse and rearrangement.**
