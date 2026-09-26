# The side-by-side round: close-out

Branch `units-layout`, off `main` at `2e07b97` with `origin/main` confirmed
equal by `ls-remote` before branching. First commit was the brief.

---

## WHAT IS NOT BUILT

**Nothing in the brief is unbuilt.** W1 and W2 are both built and proven, and
W2's no-intersection check reaches every site a control group sits on a panel
rather than only the one where the overprint was found.

**One thing is carried:** below 1360 the repayment control is wider than the
card and overflows to the right, into empty space. That is the behaviour
R-ADJ1 preserved last round, and this round asserts WHICH WAY it overflows
rather than removing it.

---

## PHASES, COUNTED AGAINST SIGN-OFFS

```
54954a1  the brief, with W1's stop condition tested
902075b  W1 side by side, W2 the overprint, and the guard that could not see it
50322e1  calibration 8 of 8, and A2's second lock
ef021d0  W2's second site: the overprint I shipped last round, found by looking
```

---

## W1: THE STOP CONDITION WAS TESTED AND DID NOT FIRE

```
                         1920            1240
intake panel inner      1556px           876px
product grid (Lump Sum)  442px           442px
milestone grid content   359px           359px    44 + 195 + 44 + 64 plus 3 gaps
side by side needs       825px           825px    with a 24px gap
```

**THE MEASUREMENT THAT MATTERED WAS THE CONTENT, NOT THE CONTAINER.** The
milestone grid renders at the panel's full width because it is a block, and a
first measurement of every descendant read **1342px of 876** and would have
stopped the round. Its columns are FIXED, so the extra width is empty space to
its right, and the widest descendant is a prose warning that wraps to whatever
it is given.

**The first figure rows are level by one declared head height**, which is N7's
construction for a pair that cannot share a row track because each half is its
own grid, exactly as the OPEX pair. `.cm-grid-head`'s own 6px bottom margin went
with it: the band is the whole head on both sides, and that margin was starting
the milestone rows 5px low.

---

## W2: THE FINDING WAS ABOUT A GUARD I WROTE, AND THEN ABOUT A SECOND ONE

**The named defect.** A5 added a row above the head track for the radios and
moved the fee table and the year slot down to suit, AND LEFT THE HEADING IN ROW
1. The radios and the heading occupied the same grid cell: 322 x 22px of overlap
at 1920, 289 x 22px at 1240.

**A5's own assertion could not see it.** It compared the radios with the
schedule's BODY, which is in row 3 and never overlapped anything, so the check
passed on every run while the screen was wrong. **Being above the body says
nothing about what is in between.**

**AND READING THE 1920 SCREENSHOT FOUND A SECOND OVERPRINT, WHICH I HAD
SHIPPED.** A6 gave all three factoring rows the card's two-column shape; the
292px repayment control took the card and left its label about 4px. The label
did not shrink, it OVERFLOWED: "REPAYMENT METHOD" printed through
"STRAIGHT-LINE", 52 x 24px of ink. **It shipped because I read the STACKED 1240
card last round and never the 1920 one**, which is the only width that row is
side by side.

**THE BOX CHECK COULD NOT SEE THAT EITHER.** Box against box the card reads
clean, because the label's box IS its 4px column and the text overflows it. An
element's box is where the layout put it; the ink is what a reader sees, and
overprint is a claim about the ink. Each part's extent is now its box UNION its
own text rects.

**AND THE FIX REVEALED THE OTHER DIRECTION.** Right-aligning the control sent
its overflow LEFT across the gap and over the schedule, 53px, at the widths
where the card is too small for it. Which way a thing overflows is a property
worth asserting, and now is.

---

## CALIBRATION, AND THE HARNESS REFUSED TWICE BEFORE IT PASSED

**9 of 9 fired on their own named assertion**, reverted run GREEN, snapshots
verified and restores compared byte for byte.

**Both refusals were the harness working.** A6's anchor stopped matching when W2
split `.deal-field` and `.po-row` into separate rules, and the W2 second-site
anchor never matched at all because I wrote `\\n` in a quoted heredoc, so the
file carried a literal backslash-n rather than a newline. **In each case the
harness refused the run rather than scoring a sweep against a fault it never
applied**, restored, and cleared its marker.

**And A2 went SILENT once**, which was neither the guard nor a bad anchor: W1
wraps the product grid in a `max-content` track, so the grid is content-sized by
its PARENT as well as by itself and removing one lock no longer stretches it. An
injection may now carry several edits, each anchored exactly once, and A2
defeats all three.

---

## EVIDENCE

Live **293 of 293 over fifteen states**, three widths against both
responsibility states, both factoring states and every mode and structure
combination. Pure 670, react 1431, typecheck clean, database 105/105.

**Screenshots opened and read:** the side-by-side layout at 1240 with the
milestone table beside the grid and their first rows level, and the 1920
factoring card with the repayment row stacked and no overprint.

---

## WHAT THIS DOES NOT ESTABLISH

The no-intersection check covers the sites it names: the schedule stack and the
factoring card. It is an enumeration, and Verification 19 is explicit that an
enumeration fails on the unrecorded instance. A control group added to a third
panel would not be watched until it is added to that list.

And the ink measurement sees TEXT. An element whose overflowing content is an
image or a border would still read clean.
