# Walk 3, Step 1: the archaeology

Model: Claude Opus 5 (1M context). Branch `walk-3` off `main` at `35e6d8e`.
Read-only. No fix is built.

---

## 0. The precondition, checked

`main` and `origin/main` are both **`35e6d8e`** and the tree was clean. You
pushed. Branch created.

---

## 1. The keyboard standard: NEVER RULED, and the proposal CONFLICTS with what is

### What is a standard of record

**`INTERACTION_STANDARDS.md` Section 2**, and it is explicit:

> **Enter submits the form, except in a `<textarea>`.** Pressing Enter inside
> any single-line field (`<input type="text">`, `email`, `date`, `<select>`)
> **submits the form**, the same action as clicking its primary submit button.

**Section 1** rules Tab: it follows DOM and visual order, no manual `tabindex`
unless CSS reorders things.

### What is built

| gesture | where | what it does |
|---|---|---|
| Enter on a CLOSED row | `FieldRow.tsx:73` | **opens** the editor ("Enter and Space open WITHOUT a seed") |
| Enter INSIDE an open editor | `editors.tsx` | **nothing.** No editor handles Enter |
| ArrowDown / ArrowUp on a row | `field-row.test.tsx:405` | asserted to do **nothing** - a navigation key "is not a seed" |
| ArrowUp / ArrowDown elsewhere | `app.js:2674` | a global handler for its own `isArrowNavField` set, not the React field row |

### The answer

**Enter-or-down-arrow-to-the-next-field is NEVER RULED and NOT BUILT.** There is
no ruling to restore.

**And the proposed standard conflicts with the one that exists.** The rider
proposes *"Enter commits and moves to the next field"*; Section 2 says Enter
**submits the form**. Those are different actions on the same key, and Section 2
is a standard of record with an APG citation behind it.

**There is also a deliberate decision against arrows in the row**: a test asserts
ArrowDown must NOT open an editor, so arrows were considered and given a
meaning - "navigate, do not edit". Building down-arrow-moves-between-fields is
compatible with that, but it is new behaviour on a key somebody already reasoned
about.

**This is the scope change the rider's stop is for.** Verification 23: two
correct decisions about one question, taken in different rounds, produce a
conflict nothing detects. **I have not built it, and the fix is one of them
superseding the other rather than both existing.**

### Escape on the Commercials count fields: ALREADY COVERED

- The **editable** count rows are `FieldRow` instances, so **ruling A3 covers
  them**: Escape reverts the field to its last saved value. Nothing to restore.
- The **locked** count rows have no editor at all since W3, so Escape has
  nothing to revert there, correctly.

If V6 is "Escape does not work on the Commercials counts", **that needs
reproducing before it is built**, because the mechanism is present.

---

## 2. V7's green highlight: WORKING AS DESIGNED, AND ALREADY LOGGED

**Not a regression, and not a different mechanism with the same look.**

The treatment is `.tb-cost-card-unsaved { border-color: var(--green) }` plus an
`unsaved` badge on the Cost Summary card
(`CostBreakdownCards.tsx:56-72`, `style.css:3170`). It has been there since it
was built.

**It is already recorded as reading wrong, by the round that built it.**
`DESIGN_PRINCIPLES.md` **open item 37**, Round 17A Phase 6, 2026-08-21:

> `--green` is the only accent, and it is already the colour of every card
> title, every active tab and the brand mark. So a state that needs to say
> "look at this, it is not normal" has nothing to say it with. **Phase 6's
> unsaved cost preview marks itself with a `--green` badge and card outline
> ... the colour reads as emphasis rather than as warning and the word UNSAVED
> is carrying the meaning on its own.**

It also rules out the obvious borrow - `.msg-error` is the wrong colour because
an unsaved preview is not an error and spending the error signal on a normal
state is worse - and ends:

> Adding one is a **palette decision and belongs with the business** alongside
> the brand colours in Section 9 of this document, **not inside a fix round**.

**So V7 is the second scope change.** What you saw is the design behaving as
specified, on a treatment whose own author flagged it as reading wrong and
reserved the remedy for you. **A fix round cannot take this one**: it needs an
attention token in the palette, which is your decision and affects pending
states, stale data and the permissions refusal too.

---

## 3. What I do not have

**V1, V2, V3, V5 and V6 are named in the instruction but not stated.** The rider
describes V4, V7 and V8 and gives dispositions for the rest, but the findings
themselves are not in it. I can triage and tier them the moment I have them; I
cannot build a finding whose content I do not hold, and guessing from a label is
exactly what the archaeology above exists to prevent.

---

## 4. The stop, and what it needs

Two of the three archaeology answers change scope, which is the condition the
rider names, so I have stopped.

1. **The keyboard standard.** It is unruled AND the proposal conflicts with
   `INTERACTION_STANDARDS.md` Section 2. Your ruling, and whether Section 2 is
   superseded for panel fields or the new behaviour is scoped to not touch it.
2. **V7.** Working as designed; the remedy is the palette decision in open item
   37, reserved for you. Do you want to take it now, or does V7 go on the list?
3. **V1, V2, V3, V5, V6**: the findings themselves.

**What is ready to run the moment those land:** V4 (the note save raising the
discard modal) and V8 (the reason line reserving space) are both fully specified
and need no ruling. Say the word and they go first.

---

## 5. Step 0 landed

| commit | what |
|---|---|
| `deb21d3` | build discipline 17: M1 to M4, under their own labels |
| `3af0311` | M1 built into the pre-commit hook |

**M1's premise was measured, not assumed.** Five suites read markdown -
`commercials-wiring`, `edit-guard`, `create-from-ownership`, `strip-comments`,
`standards-staleness` - and **all five run under the PURE stage M1 keeps**. No
React test reads a document. The two stages M1 drops are exactly the two a prose
change cannot reach.

**M1 is built rather than written**, because the hook decides which suites run:
as prose it could only be obeyed by bypassing the hook, which is the fault the
hook exists for. It fails closed, and it reports which stages did not run and
why. Calibrated three ways: markdown alone narrows; markdown plus a `.mjs` runs
all four; nothing staged runs all four.

**And the calibration cost what the rule saves**, which is worth one line: three
extra database runs in ten minutes, after which a commit attempt failed with SIX
unrelated invariants red in a stage taking **282.7s against a normal of 110-130s**.
Re-run alone: **104/104**. A stage failing SLOWER than normal across unrelated
surfaces is contention, not a finding (Verification 48), and the durations are
recorded rather than the run retried into silence.
