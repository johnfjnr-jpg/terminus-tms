# Group A: the report

**Gate GREEN, 24 of 24, exit 0**, on the committed tree `e229c8b` - **one run
for the batch**, as the light path prescribes. React **1009**, pure **543**,
database **102**, conformance **9/9**, and **20 of 20 live checks at 1440
across both modes**. **Nothing pushed.**

---

## The six, and what each turned out to be

| | what shipped |
|---|---|
| **A1** | the `Latest 2 / Last 10 / All` rungs and `Add note` on the NOTES header line |
| **A2** | that control reads **"Save"** once the field is open |
| **A3** | the contact adopts the lead's **one-row** Summary / Notes / Follow-up |
| **A4** | the completion sheet opens **below** the card body |
| **A5** | the Contacts list opens Create on **click**, with Escape and click-outside |
| **A6** | the Summary row stops repeating its panel title; the first field card becomes **"Personal Details"** |

## A2 WAS FLAGGED AS A BEHAVIOUR SUSPECT, AND MEASURED BEFORE IT WAS CHANGED

The brief named it up front: *if it touches the note save path, that part gets
the full path.* **Measured first:**

```js
const onClick = () => {
  if (!open) { setOpen(true); return }
  ...
  void submit()
}
```

**The control already opened when closed and COMMITTED when open.** One
control, two actions, for rounds - only the label never said so. **So A2 is a
label, the save path did not move, and it stays light on evidence rather than
on assumption.** The note was still proven to save live, which is the light
path's own requirement for an interaction.

**A5 likewise**: the hover handlers became click handlers and the dialogue
behind them is untouched. Confirmed live - hover no longer opens it, click
opens exactly one menu, Escape closes it, **and it still creates**.

---

## THREE LAYOUT DEFECTS THIS BATCH CREATED, all fixed here

**None was found by an assertion. All three came from the screenshot**, which
is the instrument the light path names.

1. **The notes header sat ON TOP of the follow-up card.** `.panel-head` is a
   fixed-height flex row with no wrap, so the added rungs overflowed its third
   of the card; and `.lead-card-body`'s base rule lacked the `minmax(0, ...)`
   the wider breakpoints already had, so a grid column refused to shrink and
   **overlapped its neighbour instead of clipping**. Measured rather than
   guessed: `elementFromPoint` over Add note returned `SPAN.cd-card-title` -
   the follow-up card's title. The count moved off the header line, and the
   columns can no longer overlap.
2. **"Latest first" then wrapped to two lines and Add note was clipped at the
   column edge.** The secondary now gives way to the rungs when there are
   rungs - they say "Latest 2" and "Last 10", so the ordering is stated by the
   controls rather than beside them - and it returns when there are none.
3. **A blank Summary label still reserved its 170px column**, squeezing the
   text to about 88px against the right edge of a third-width card.

**Each is now asserted, not just looked at**: the header items share one row by
equal `top`, Add note's right edge is inside the header's, and the empty label
reserves zero width. **A membership check cannot see a wrap** - CLAUDE.md's
stats-grid clause - which is exactly how the first version passed while the
header was broken.

## THE LIGHT PATH, ASSESSED HONESTLY ON ITS FIRST USE

**It worked, and the reason is worth recording: the screenshot did the work.**
Three real defects, all visual, all caught by the instrument the light path
names and none by the suite. A full-path treatment - Phase 0 forensics,
both-mode injection calibration - would have cost hours and found **none of
them**, because none was a logic fault.

**What it did NOT do, which is the point rather than a gap:** no Phase 0
census, no injection sweep, no per-item gate. **What that means we do not
know**: whether any of these six could be silently reverted without a test
going red. For a label and a grid column that is an acceptable trade and it is
the trade the principle names.

**One item strained the boundary and is recorded**: A4 moved the completion
sheet with a **React portal**, which is a structural change rather than CSS.
It carries no logic, no data and no auth, so it stayed light - but it is the
kind of item where "cosmetic" is an argument rather than a fact, and the
principle says if you have to argue it, take the full path. **It is flagged
here so the judgement is visible rather than implied.**

---

## Recorded plainly: my own faults this round

- **A document-wide selector read the HIDDEN leads view** and reported the
  contact's one-row layout broken - tops `[135,135,0]`. The app keeps every
  view in the DOM. V25's population clause, in my own probe.
- **`querySelector('.panel-head')` returned the SUMMARY panel's head**, so the
  A1 check asked whether the wrong header contained the note control.
- **An assertion that could not fire**: the rungs render only above two notes
  and the fixture had one, so a green would have meant nothing. The fixture is
  now seeded with four.
- **`mkdir` after the heredoc, twice**, so the probe file was never written.
- **A JSX comment placed directly inside `return (`**, which is not valid
  there and broke the build.

## Carried, unchanged

`StageActions` outside the conformance gate · the two unstyled buttons
(`Link to Account`, `Save task`) · (d) full retirement unscoped · the
ENFORCEMENT GAPS carrieds.

**Next: John walks the batch once. Nothing pushes.**
