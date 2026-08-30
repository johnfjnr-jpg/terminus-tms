# Round 41 items 5 and 6

**Gate green at all five stages: 307/307 pure, 91/91 database, three HTTP
probes.** Two of item 5's three bullets are **held, not built**, because they
reverse a decided layout. Everything else is built and measured at 1240 and 1920.

---

## HELD: two of item 5's bullets contradict the decided layout

`COMMERCIALS_RESHAPE_PHASE_0_BRIEF.md`, under **"Decided with the business"**,
numbers the sections and names exactly one side-by-side:

> 1. **Units Required**
> 2. **Installation**
> 3. **Structural Terms**
> 4. **Deal Sheet Summary**, live, with detail expandable horizontally beside it
> 5. **Payment Terms and Cash Flow, side by side**

`ROUND_41_BRIEF.md` item 5 asks for **Units Required on the left, Installation on
the right** (a second side-by-side, pairing sections 1 and 2) and **cash flow
below, on the left** (dissolving the one side-by-side the decided layout asks
for).

**Both are held and reported rather than built.** `CLAUDE.md` Verification 23:
two correct decisions about the same behaviour, taken in different rounds,
produce a conflict nothing detects, and the fix is a ruling rather than a
reconciliation. Round 39 lost its structural half to reading a prototype instead
of the decisions (`CLAUDE.md` rule 31), and this is the same document.

**What is NOT in conflict, and is built:** the SHAPE of the Units Required box,
the field widths, and the factoring selection's placement. None of those changes
the order of sections or the number of side-by-sides.

**If the brief supersedes the decided layout, that is the business's to say**,
and it wants recording as a supersession rather than absorbed. Both bullets are
then an hour of work.

---

## Item 5, built

### Units Required is one box of four rows

Four bordered cards spread across the width gave each of them a full-width input
for a two-digit number and put the four labels a long way apart, when the whole
point is reading them as a set. **One box, four rows, 320px, left-aligned**, with
the label on the left and the count on the right.

**Integer fields narrowed to four figures**, 72px and right-aligned. An input
sized for a paragraph invites one.

### The factoring selection is on the Payment Terms line

It sat in a block of its own below the milestone grid, a long way from the
structure and invoicing choices it belongs with. **Factoring is a payment term
and choosing it is the same kind of decision as choosing the structure.**

**The FIELDS did not move.** Rate, term and repayment method are three paragraphs
of explanation rather than a choice, and they open below when factoring is on.
Asserted in both directions: the toggle is inside the line, the fields are after
it.

---

## Item 6: the census against the brief

| # | finding | verdict | evidence |
|---|---|---|---|
| 2 | the summary goes full-bleed when the detail panel is closed | **SETTLED by item 4** | the merged panel is capped at 940px, so it does not stretch whether the detail is open or not. `.deal-sheet-cards`' reasoning carried across its deletion. |
| 3 | the 1240 invoiced-fee collision, three year figures overlapping | **LIVE, now fixed** | below |
| 4 | the 1240 cash flow clipping, cumulative cash position cut mid-number | **LIVE, now fixed** | below |
| 5 | SAVE VERSION sits above SAVE CHANGES | **LIVE, and mis-characterised. Fixed as a labelling gap** | below |
| 6 | achieved margin rendered twice, the weaker rendering on the more important instance | **ABSORBED by item 3's one-rule work** | measured below |

### Finding 6, measured rather than assumed

Both renderings, at both widths, after the strip work:

| | strip | Margin and Warranty card |
|---|---|---|
| size | **20px** | **20px** |
| weight | 300 | 300 |
| colour | `rgb(242, 242, 240)` | `rgb(242, 242, 240)` |
| class | `stat-value--lead under-target` | `under-target` |

**The asymmetry is gone.** The finding was not that the number appears twice, it
was that *the weaker rendering was on the more important instance*. Both are now
20px and both take their colour from `marginPresentation`, one rule.

**The double render itself remains and is deliberate**, recorded in the code: the
strip is the always-visible read, and the card figure is the prototype's line
1489 restored so the loop reads the number where the hand already is. **Not a
defect, and it is not silently left: it is one value with one reader and two
instances, which is the shape the business ruled for.**

### Finding 3, fixed

**Measured at 1240 before:** the year schedule was `flex: 1 1 0; min-width: 0`
sharing a line with a 150px control inside a ~390px card, so four nowrap numeric
columns were given **216px** between them.

```
  head:  ink 493-529  528-564  564-599   ->  "YEAR 1YEAR 2YEAR 3"
  data:  ink 493-555  528-591  564-626   ->  three figures overlapping by 27px each
```

**After:** `flex: 1 1 340px; min-width: 340px` on the container so it wraps to
its own line, and `flex-shrink: 0` on the cells so **a cell can never be given
less room than its own glyphs**.

```
  1240   head 369-404  462-498  555-591  642-707    collisions: none
  1240   data 342-404  435-498  529-591  629-707    collisions: none
  1920   unchanged, no collisions before or after
```

### Finding 4, fixed

**Measured at 1240:** 3,244px of grid in a 422px column, and the Cumulative cash
position row ended `379,622  350,127  3`. **A figure sliced mid-glyph at a hard
edge does not read as "there is more to the right"; it reads as 350,127 and then
a three.**

The boundary now announces itself with a fade over the last 28px, applied **only
when the content actually overflows** so a grid that fits is not dimmed for
nothing. It introduces no colour: it is the page ground taking the last few
pixels, which is the one thing on the page that cannot be mistaken for data.

**A ResizeObserver, not a check at render time.** The first version toggled the
class immediately after the grid was built and **never fired**: `recompute()`
runs while the Commercials panel is still hidden, where `clientWidth` and
`scrollWidth` are both 0, and nothing re-renders when the tab is shown.

### Finding 5, fixed as a labelling gap

**The finding said the screen contradicts the decided save-then-version order.
Measured, the order is already enforced in behaviour.** `saveVersion()` calls
`saveDeal()` first when the form is dirty, and refuses the version if that save
fails, because a version citing figures the record never held cannot be checked
against anything.

**So the gap was never the button positions. Nothing SAID so.** Reordering would
have moved the tab's one primary save out of `.form-actions`, where every other
detail page in this application keeps it, to express a sequence the user does not
have to follow.

> Taking a version saves the pricing first, so a version and the record can never
> disagree.

**The note and the behaviour are asserted together**, so a note that outlives the
code it reports fails the suite: the test checks the sentence, that
`isDealFormDirty()` gates a `saveDeal()`, that a failed save refuses the version,
and that the save happens **before** the version request.

---

## Three probe faults recorded, because two of them read as clean results

**1. `clipped past the visible edge` was not a measure of finding 4.** It is true
of every horizontal scroller by definition, and it read `true` before and after
the fix. `CLAUDE.md` Verification 18's signature exactly: a calibration that does
not move has failed to run rather than passed. Replaced with whether the boundary
announces itself.

**2. Waiting for the panel to be unhidden did not mean the grid had a width.**
Verification 7: a condition the old state already satisfies.

**3. Having a width did not mean the ResizeObserver had RUN.** The same fault a
second time on the same probe. The observer's callback is queued for the frame
after the resize, so the wait is now two animation frames after layout, which is
a settling step rather than a fixed delay. **Both intermediate readings were a
clean `false` for a class that was applied a frame later.**

---

## Where the evidence is

`.verify/findings/` holds `section1-{1240,1920}.png` and
`section5-{1240,1920}.png`. `scripts/probe-screen-findings.mjs` reproduces every
number above at both widths.
