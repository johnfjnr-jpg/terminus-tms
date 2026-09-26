# The side-by-side round: build brief

Branch `units-layout`, off `main` at `2e07b97`, confirmed equal to `origin/main`
by `ls-remote` before branching.

Two findings from John's screenshots of 2026-09-26. Rule 18, build discipline 19
and named-findings-only govern. The round ends "ready for John's push".

---

## W1: THE PRODUCT GRID AND THE MILESTONE TABLE SIT SIDE BY SIDE

Grid left, milestone table right, first figure rows top-aligned per the N7
shared-track construction. The A1 adjacency guard and the S1 sizing hold on both
halves.

**THE STOP CONDITION IS TESTED AND DOES NOT FIRE. Measured before anything
moved:**

```
                         1920            1240
intake panel inner      1556px           876px
product grid (Lump Sum)  442px           442px
milestone grid content   359px           359px     44 + 195 + 44 + 64 plus 3 gaps
side by side needs       825px           825px     with a 24px gap
```

**825px of 876px at the narrowest width**, so both halves fit without clipping a
figure and the standing rule's photograph-the-options path is not reached.

**THE MILESTONE GRID ONLY LOOKS WIDE.** It renders 876px because it is a block
filling the panel; its columns are FIXED at `44px 195px 44px 64px`, so the extra
width is empty space to its right. Measuring the container rather than the
content would have said the layout needs 1342px of 876 and stopped the round on
a number about the wrong thing.

**WHERE THE LUMP SUM FIELDS ARE, AND IT IS A POSITION TAKEN.** The brief names
the milestone table "with its lump sum fields and contractor price total", and
`#deal-contractor-group` ALREADY holds the lump sum contractor price and the
total beneath its rows. So the parenthetical describes what that group already
contains and nothing moves out of the head block. The `deal-lumpCost` INPUT
stays with the responsibility select above both columns, because it is a
per-deal input like its neighbour and because putting it above the milestone
table would push that table's rows down and break the very alignment W1 asks
for. Revisitable.

**The side-by-side applies where the contractor group renders**, which is Lump
Sum: under Per Unit there is no right-hand half and the grid keeps its own
width.

---

## W2: THE INVOICING RADIOS GET THEIR OWN LINE, AND NOTHING OVERPRINTS

The radios render on their own line or lines above the schedule, wrapping to TWO
lines when width demands, and **no element box intersects another**: not the
radios, the schedule heading, or the rows. The schedule's heading and first
figure row keep their current position, which John reports reads well.

**THE FINDING, AND IT IS ABOUT A GUARD I WROTE LAST ROUND.** A5 asserted that
the radios' box sits ABOVE the schedule, and it passed while the text
overprinted. Measured now:

```
1920  opex/twoPhase   radios x heading   322 x 22 overlap
1240  opex/twoPhase   radios x heading   289 x 22 overlap
```

**The assertion was true and the screen was wrong.** A5 measured the radios
against the schedule's BODY, and the HEADING sits between them, so the one
element the radios actually collided with was the one nothing compared them to.
Being above the body says nothing about what is in between.

**So A5 is STRENGTHENED, not replaced:** placement above AND zero box
intersection, both asserted as computed geometry in every structure that shows
the radios.

**AND THE NO-INTERSECTION CHECK JOINS THE ESTATE GUARD FAMILY**, at every A5
site where a control group sits on a panel, so an overprint is red everywhere
rather than only here.

---

## THE CLOSE

Red-first. Calibration in both directions: force an overlap and the guard fires,
stack the halves and W1 fires. Live proof at 1920, 1440 and 1240 across the
responsibility, mode and structure states, with screenshots opened and read.
Close-out. `CURRENT_STATE`. The `ls-remote` equality re-check at merge time.
Branch gate `--round-close`, merge `--no-ff`, merged-tree gate, then "ready for
John's push".

**Any red: STOP.** Reports per M6.
