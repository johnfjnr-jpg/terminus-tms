# What the Commercials reshape is measured against

Written 2026-08-29, **before the reshape round opens**, deliberately. Every round
in this sequence has gone well because something was measured rather than
asserted, and a reshape is the easiest place in the build to slip back into
judgement: a layout can look better and be slower to use, and nobody notices for
months.

**The reshape is judged on whether three tasks got shorter and clearer. Not on
whether it looks better.**

---

## The three tasks the tab exists to support

1. **Price a new deal from scratch.** Nothing entered. The salesperson has unit
   counts, an installation arrangement and a term, and needs a number they trust.
2. **Re-price an existing deal and take a version.** Something changed. Find the
   inputs that moved, change them, satisfy yourself the new number is right, and
   record why.
3. **Check a deal somebody else priced.** Not editing. Understand what was
   assumed and whether the number is defensible.

Task 3 is the one the current tab supports worst and the one the approval page
already answers for an approver. It is on this list because a salesperson doing
it is not an approver, and has no reason to open that page.

---

## The baseline, measured on the tab as it stands

Counted from `frontend/index.html`, not estimated.

| Sub-tab | Inputs | Selects | Textareas | Buttons |
|---|---|---|---|---|
| Hw / Hosting Setup | 17 | 0 | 0 | 0 |
| Installation | 9 | 1 | 0 | 0 |
| Structural Terms | 5 | 2 | 0 | 1 |
| Deal Sheet | 0 | 0 | 1 | 3 |
| Payment Terms | 28 | 7 | 2 | 19 |

**Five sub-tabs. 59 inputs, 10 selects, 23 buttons.** The Deal Sheet, which is
the answer, is on a sub-tab of its own: **the number cannot be seen at the same
time as any input that changes it.**

### What each task costs today, in sub-tab switches

The switch count is the honest unit here: it is the thing the reshape removes,
and it is countable now and countable after.

| Task | Sub-tab switches today | Why |
|---|---|---|
| 1. Price a new deal | **at least 4** | Hw, Installation, Structural Terms, then Deal Sheet to see the answer. Payment Terms if the structure is not the default. |
| 2. Re-price and version | **at least 2, and 2 more per check** | Find the input on its sub-tab, change it, switch to Deal Sheet to see the effect, switch back if it is wrong. Every verification is a round trip. |
| 3. Check somebody else's | **all 5** | The assumptions are spread across four input sub-tabs and the answer is on the fifth. Nothing shows them together. |

**Task 2 is the sharpest measurement**, because the round trip repeats. Changing
three things and checking each costs six switches on top of the three edits.

---

## What "shorter and clearer" has to mean, so it is checkable

**Shorter, and this is the falsifiable part:**

- Task 1 completes with **zero sub-tab switches**. One flow, the Deal Sheet
  live beneath it.
- Task 2's verification loop costs **zero switches per check**. Change an input,
  the number moves in view.
- Task 3 shows the assumptions and the answer **on one screen**, without editing
  anything.

**Clearer, and this is the part that needs looking rather than counting:**

- A person who did not price the deal can say what the margin is and name the
  two largest things driving it, from the screen, without opening another tab.
- The rates being priced against are visible during entry, with their dates -
  the reference panel decided in `ROUND_38_PHASE_2_BOUNDARY.md` section 7.

**Rough times, proposed rather than measured, for the business to correct.** No
timing data exists for the current tab, so these are targets to check against,
not findings:

| Task | Target |
|---|---|
| 1. Price a new deal | under 3 minutes |
| 2. Re-price and version | under 90 seconds |
| 3. Check somebody else's | under 60 seconds, reading only |

---

## How it gets measured

**Before the reshape starts**, walk all three tasks on the current tab and record
the real numbers: switches, scroll distance at 1240, and elapsed time. That is
the before half of a before-and-after, and Verification 6 applies - capture the
same unchanged tree twice and confirm the two agree before comparing anything.

**After**, the same three walks. A reshape that improves the layout and leaves the
switch counts where they are has not done the job it was scoped for.

**What this does NOT measure**, said so it is not claimed later: whether the
business likes it. That is a judgement, it is theirs, and it is a separate
question from whether the tasks got shorter.
