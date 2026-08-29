# What the Commercials reshape is measured against

> **The Deal Sheet sits on a sub-tab of its own, so the number cannot be seen at
> the same time as any input that changes it.**

**That sentence is the brief.** Everything the reshape does should be traceable
back to it, and anything that is not traceable to it is scope this round did not
ask for.

---

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

### Ceilings, set by the business, recorded the way the staleness bands were

**These are judgement, not data, and they are labelled as such so they do not
harden.** No timing data exists for the current tab and none was invented; the
business will walk the three tasks and time them once the reshape is built.

| Task | Ceiling |
|---|---|
| 1. Price a new deal, numbers to hand | 5 minutes |
| 2. Re-price and take a version | 2 minutes |
| 3. Read someone else's deal and form a view | 2 minutes |

**Set by:** the business, 2026-08-29.
**Basis:** commercial judgement. No measurement of the current tab exists.
**What replaces them:** the business's own timed walk of the three tasks, once
there is something to walk.

**The switch count stays the PRIMARY measure**, because it is countable now and
countable after, and it is falsifiable in a way a stopwatch held by the person
who wanted the change is not.

**And the ceilings are a check ON the switch count, not a decoration.** If the
built thing beats all three ceilings and still takes five sub-tab switches, then
the switch count was the wrong measure, and that is a thing to find out rather
than to defend.

---

## The second measure: how many fields must actually be touched

**Switch count does not capture the other half of the problem.** One screen with
59 fields is not obviously better than five tabs with twelve each, and a reshape
that only removes the tabs could make the tab worse while scoring well.

So the second measure is: **of the 59 inputs, how many must a salesperson touch
to price a typical deal?**

Counted on the three entry sub-tabs as they stand (Hw / Hosting Setup,
Installation, Structural Terms), which carry 20 of the 59:

| | Count | |
|---|---|---|
| **Read-only rate displays** | 10 | `ssUnitCost`, `aqUnitCost`, `hemirUnitCost`, `hoSafesight`, `hoAqm`, `hoHemir`, `inSsExisting`, `inSsNew`, `inAqm`, `inHemir`. Written from the catalog, not typed. These become the reference panel. |
| **Editable** | 10 | `ssExisting`, `ssNew`, `aqm`, `hemir`, `lumpCost`, `targetMargin`, `warrantyPct`, `fxContingency`, `whtPct`, `gstPct` |
| **Of those, defaulted** | 5 | `targetMargin` 30, `warrantyPct` 2, `whtPct` 0, `gstPct` 0, `fxContingency` 0. A typical deal accepts them. |
| **Must be touched for a typical deal** | **4 to 6** | the unit counts that are non-zero, plus the installation type and the term |

**The other 39 inputs are on Payment Terms**, which a typical deal does not open
at all: 28 inputs, 7 selects and 19 buttons behind a structure most deals take
the default of.

**So the shape of the answer is already visible: roughly five fields matter for a
typical deal and fifty do not.** That is a progressive-disclosure problem, not a
layout problem, and it is the hidden-until-asked model already identified at the
Margins card. **A reshape that puts all 59 on one scrolling page has removed the
switches and kept the density.**

**The target, stated so it is checkable:** a typical deal is priced without the
person seeing more than roughly a dozen controls, and everything else is reachable
when asked for rather than present by default.

**Confirm the count before building.** "4 to 6" is derived from which inputs carry
defaults, not from watching anybody price a deal. The business walking task 1 once
and naming what they actually touched replaces it.

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
