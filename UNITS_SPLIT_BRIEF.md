# The panel separation round: build brief

Branch `units-split`, off `main` at `6656470`, confirmed equal to `origin/main`
by `ls-remote` before branching.

John's ruling of 2026-09-27, screenshot on record. Rule 18, build discipline 19
and named-findings-only govern. The round ends "ready for John's push".

---

## R-US1: TWO PANELS, NOT ONE

**Supersedes the option-A merge AT THE PANEL LEVEL.** Units Required and
Installation are two separate panels: distinct pricing functions, distinct
cards, each in estate card dress with its own title.

- **Units panel**: the product grid (product, units, unit cost, hosting
  cost/mth) with its catalog note.
- **Installation panel**: everything installation. The responsibility, the lump
  sum fields, and either the milestone table with contractor price or the
  per-unit table, according to responsibility.

**THE OPTION-A RATIONALE IS QUOTED, NOT DELETED.** R-SZ2 merged them because
their ROWS would not line up, and the measurement that settled it stands: the
offsets converged, 64/49/33/34 at 1920 and 127/128/129/145 at 1240, so the row
HEIGHTS differed and no work above the rows could have levelled row 2 onwards.
**What is superseded is the conclusion that one GRID was the only way to share
row tracks, not the requirement that they share them.** R-US3 keeps the
alignment and moves it across two cards.

## R-US2: THE RESPONSIBILITY SITS OVER WHAT IT CONTROLS

A5's principle. The Installation responsibility label and dropdown move to the
TOP of the Installation panel, over the thing they change, rather than over both
panels.

## R-US3: THE ROW ALIGNMENT SURVIVES THE SPLIT

Under Per Unit, each product's install row sits level with its units row, row
pairs asserted at 1920, 1440 and 1240. Under Lump Sum no row correspondence is
required, because milestones are not products. The panels top-align side by
side.

---

## THE STOP CONDITION FIRES, AND THE MEASUREMENT IS WHY

Measured before anything moved, from the grid's own used track widths:

```
                      track widths                         total
units half     product 142  units 37  unit cost 72         416px
               hosting 118, plus three 16px gaps
install half   rate 228  cost 74  margin 59  price 81      489px
               plus three 16px gaps
two cards      416 + 34 of card chrome + 489 + 34 + 24     997px
panel at 1240                                              876px
panel at 1920                                             1556px
```

**997px of 876px at 1240. The split does not fit, and the round STOPS there**
per the standing rule, with the options photographed rather than chosen.

**AND THE PANEL ALREADY OVERFLOWS AT 1240 TODAY, WHICH IS A DEFECT I SHIPPED
LAST ROUND.** The merged grid measures **947px of content in an 876px box**
under Per Unit, and on screen it runs past the right edge of every panel beneath
it. W1 wrapped the grid in `.units-row`, whose track is `max-content`, so the
grid's own `max-width: 100%` now resolves against that 945px track instead of
the 876px panel and stopped compressing. Figures are not clipped; the page's
right margin is broken.

**THE RATE COLUMN IS THE LARGEST SINGLE TERM AND IT IS SIZED BY ITS HEADING.**
228px for a box holding a `xxx,xxx.xx` figure: the column is as wide as
"RATE (USD, FROM BASE COST DATA)" set on one line.

---

## WHAT THE ROUND WILL BUILD ONCE THE SHAPE IS RULED

R-US1, R-US2 and R-US3 as written, with all estate guards holding on both
panels: A1 adjacency, S1 sizing, S2 typography, and W2 no-intersection with both
panels added to its site list. The merge-era assertions re-point with reasoning
at each site.

Red-first. Calibration in both directions: unpair one row, stack the panels.
Live proof at 1920, 1440 and 1240 across both responsibility states and the mode
and structure states, with screenshots opened and read. Close-out.
`CURRENT_STATE`. The `ls-remote` equality re-check at merge. Branch gate
`--round-close`, merge `--no-ff`, merged-tree gate, then "ready for John's
push".

**Any red: STOP.** Reports per M6.
