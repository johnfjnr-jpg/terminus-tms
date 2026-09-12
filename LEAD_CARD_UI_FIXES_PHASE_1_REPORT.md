# LEAD CARD UI FIXES, Phase 1: the build

Committed at `89a331e`. Suites run alone: **pure 527/527, react 957/957,
database 100/100**. Calibration **13/13 fired**, reverted tree
byte-identical. Live measurement at **1240 / 1920 / 3440**, every capture
taken **through the element**. The API server was **restarted** after the
`src/lib` change, before any probe.

---

## What is NOT in this phase

**Nothing.** R7, R1, R3+R8, R4 and R6 all landed. R9 required no work by
its own ruling, and the measurement backing that is in section 5.

---

## 1. R7: the timestamp module

`src/lib/format-dates.js`. `formatTimestamp` gives `DD/MM/YY HH:MM:SS`,
`formatDate` gives `DD/MM/YY`.

**`app.js` DELEGATES rather than re-implementing.** It is a classic script
and cannot import, and `index.html` loads the bundle first, so `main.tsx`
publishes both onto `window` and `app.js`'s two formatters became one-line
delegates feeding their **19 existing call sites**.

**That is a transport, not a second implementation**, and it is the direct
answer to Phase 0's finding: the estate's rule that *the seam is for
services, not helpers* is what produced three copies and one drift. **A
helper that must not have two versions belongs on the seam.**

### The census, and R7's proof

**39 routed, 0 raw.** Calibration: 4 scan anchors and **8 classifier
cases**, all green.

| claim | evidence |
|---|---|
| no raw ISO renders | census `0 RAW`, and the browser reads `12/09/26 14:14:09` where Phase 0 photographed `2026-09-12T06:14:09.321Z` |
| the card's own date line | `12/09/26`, was `2026-09-12` |
| a date does not shift a day west of UTC | asserted in a **forced `America/New_York` child process** |
| an unparseable value survives | returned as it stands, never `Invalid Date` |

### Three decisions taken, each recorded at the site

**GRAIN IS PRESERVED, SHAPE IS UNIFIED.** A timestamp shown at date grain
on an approval chip stays a date. R7 is about the shape a person reads and
about raw ISO; **adding seconds to "Approved 12/09/26" is a scope expansion
nobody asked for.**

**ABSENCE IS THE CALLER'S.** The sites disagreed - `--` in four, `''` in
two. The module returns empty and each site keeps its own fallback.
**Unifying the shape must not quietly unify the absence** (Verification
20's addendum).

**A DATE-ONLY VALUE NEVER BECOMES A `Date`.** `new Date('2026-09-12')` is
UTC midnight, so **west of UTC every formatter this replaces renders the
day before the one stored.** The module splits the string instead.

### And one branch this introduced and removed

`formatDealDateTime` was first routed as `formatTimestamp(new
Date(d).toISOString())`, which **throws a RangeError** on an unparseable
value where the `toLocaleDateString` it replaced returned harmlessly.
**Architecture 8 in one line**: a failure branch the old path did not have.
The string now goes straight in.

---

## 2. R1: the account picker

**Card-local, as `frontend-react/src/leads/AccountPicker.tsx`.
`LinkAccountPanel` is untouched, so frozen Lead Detail and its test file
are untouched.**

**What is shared is `findAccountMatches`, not a component**, so the card
and Detail cannot disagree about what a match is - Verification 20's
remedy, one definition imported - without the generalisation R1 forbids.

**A fourth optional prop was the alternative and was refused.** The three
`LinkAccountPanel` already carries switch **behaviour**; a prop switching
the whole **render** is two components sharing a file, and the frozen
surface would then depend on that file being rewritten for the card.

### Measured live, at three widths

| claim | 1240 | 1920 | 3440 |
|---|---|---|---|
| matches in ONE listbox | 6 | 6 | 6 |
| Create on the input's line | PASS | PASS | PASS |
| Create to the RIGHT of the input | PASS | PASS | PASS |
| the list opens directly under the input | PASS | PASS | PASS |
| **the step does not grow when 6 matches appear** | **124px to 124px** | 124 to 124 | 124 to 124 |

The last row is C4's point: **the picker's height is no longer a function
of how much data exists.**

### The door, measured before building and proven both ways

`NON_ACTION_SELECTOR` exempts `[aria-expanded]` and `[aria-controls]` and
skips anything that `closest()`-matches an exemption. **A combobox wrapper
carrying those would have left every option and the Create button live on
a lead somebody else owns.** The aria is on the **input alone**; the
listbox carries none.

| | |
|---|---|
| unowned lead | not-mine, Qualify **disabled**, Add note **disabled** - the picker is unreachable |
| owned lead | Qualify live, Add note live, **the expand rungs stay live** because they are read affordances |
| the sweep run over the picker's real markup | **6 options, 0 still live**; Create dead; input dead |

The third row exists because the picker cannot be *reached* on an unowned
lead, so the claim was measured by running the door directly against it.
**And it asserts there were options to neutralise**, so the result is not
true by absence.

---

## 3. R3 + R8: the notes header

**36px to ZERO**, measured at 1920 and reproduced.

| | Phase 0 | now |
|---|---|---|
| note input vs Summary input | **36px** | **0px** |
| the title | its own line above | **on the header row** |
| Add note / Discard | white browser defaults | **`btn-sm`** |

### The last 9px, which is the finding worth keeping

Moving the title removed 24px as predicted. The residual **9px** was not
where either of us expected: **`min-height` grows to its tallest child**,
so classing the buttons made the Notes header **39px against Summary's
30px**. Every other box matched exactly - both wraps sat 6px below their
head.

**The line now owns its height and the controls fit inside it.** That is
C2's "equal by construction"; raising the minimum to 39 would have been
the tuned margin C2 was written against, and it would break again the next
time a control changes.

### One optional prop, three consumers

`title?: string`. Given, the title renders first on the header row and the
row carries `card-col-head`. Omitted, **nothing changes** - asserted
directly, so frozen Lead Detail and the **Test Bed** are untouched.

**The Test Bed is the consumer no ruling in this round names.** Phase 0
found it; the optional-prop mechanism is what makes it a non-event.

---

## 4. R4 and 5. R5

**"No notes yet." removed**, and R5 follows from it exactly as Phase 0
measured:

| width | Phase 0 | now | delta | driver |
|---|---|---|---|---|
| 1240 | 335px | **335px** | 0 | **the frozen follow-up panel, left alone as ruled** |
| 1920 | 257px | **200px** | **-57px** | |
| 3440 | 257px | **200px** | **-57px** | |

**R5 needed no separate work, and the 1240 row is the evidence for the
half of R9 that says leave it.**

---

## 6. R6: the conventions

Six, written into `DESIGN_PRINCIPLES.md` as a contract: the column header
line; the field aligning across columns; create to the right of its input;
a filtered selection is a dropdown; an empty region says nothing; one
timestamp formatter and one date formatter in one module.

**Each carries the measurement that produced it**, so a Contacts builder
reading them gets the reason rather than the rule alone.

---

## Judgments taken, for overturning

1. **Classing reaches all three NotesHistory consumers.** `btn-sm` on Add
   note, Discard and the three expand rungs changes Lead Detail and the
   Test Bed too. It is a treatment fix, not structural, and the same
   family R8 ruled in. **A card-only class would have left the frozen
   surfaces carrying the defect and put two treatments on one control.**
2. **The note textarea is classed too, and this one is closest to the
   line.** It had **no rule anywhere in the stylesheet** and rendered as a
   white browser default on all three surfaces - pre-existing, visible in
   Phase 0's capture. **R3 brings it to exactly the same y as the Summary
   field beside it**, so the two are now read together: one styled, one a
   browser default. That is the bright-zero-beside-a-dim-zero shape, worse
   **because** of what the round did. Taken under build-discipline 10's
   limit; say the word and it comes out.
3. **`app.js` delegates rather than the module being duplicated**, which
   adds two globals. The shell guard that asserts nothing else is
   registered was updated deliberately and carries its reason.

---

## What surprised

**TWICE, EVERY ASSERTION PASSED ON A BROKEN SCREEN, AND THE SCREENSHOT
FOUND IT BOTH TIMES.**

The dropdown was rendered as a **sibling** of the positioned row, so it
had no positioned ancestor and laid itself out against the **viewport**:
`top: 1106` on a 1100px viewport, **730px below the card**. Meanwhile
`position === 'absolute'` read PASS and "the step does not grow" read
PASS - **both are true of a list parked anywhere at all.** Adjacency is
now asserted, because adjacency is the claim.

Before that, anchoring the list on the whole picker opened it **below the
Cancel button**, with the card showing through the gap. Same shape, same
instrument blindness, same remedy.

**THE CENSUS WAS CORRECTED THREE TIMES, AND TWICE BY A GREP RUN FOR
SOMETHING ELSE.**

- Its **calibration anchors were the defects the fix removed**, so it
  refused to report on the tree that proves it - Verification 9's clause
  arriving on schedule. Re-cut onto synthetic anchors assembled from
  parts, so they cannot rot and the file cannot satisfy its own scan.
- Its **name vocabulary had no `asOf`**, so `ApprovalBlocks` rendering
  `{c.asOf}` raw was invisible to it. Found by a grep checking a false
  positive. Then **no `since`**, so `provenance.since` was invisible too -
  found by an approval-page test failing for a different reason.
- Its verdict **"routed" meant "contains a call"**, so
  `${String(x.effectiveFrom).slice(0, 10)}` scored as routed when it is a
  second implementation. It would have reported `0 raw` over the top of
  it.

**THE LIMIT IS STATED RATHER THAN CLAIMED CLOSED.** The name-based half of
the census is Verification 19's exact shape and has now failed twice.
**The defence is the module, not the scan**: a field routed through it
cannot render raw whatever it is called. The census proves the sweep
happened; it cannot prove a field nobody has named.

**AND THE HARNESS WAS KILLED MID-SWEEP BY A TWO-MINUTE WALL**, which is
the case its in-flight marker exists for. All three files were verified
byte-identical before the marker was cleared by hand.

**AND I RAN THE PURE SUITE CONCURRENTLY WITH THE CALIBRATION**, which
mutates source. It reported 1 failure. Re-run alone it was 527/527.
Recorded because it is the breach the gate rule names, committed by the
person who knows it.

---

## What this does NOT establish

- **No walk.** Lead Detail and the Test Bed both changed appearance
  (formatters, classed controls, no empty sentence) and neither has been
  walked. The evidence for them is unit tests, not eyes.
- **The 6-account denominator is today's data.** R1's case is the shape.
- **`--red` and `--amber` are used and never defined** in `style.css`,
  always with fallbacks so they render. Pre-existing, unrelated to this
  round, recorded for the queue.
- The census's name vocabulary, per the limit above.
