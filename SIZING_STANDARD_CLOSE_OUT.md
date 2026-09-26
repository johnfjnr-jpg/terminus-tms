# The sizing standard round: close-out

Branch `sizing-standard`. Ready for John's push once the merge lands.

---

## WHAT IS NOT BUILT, FIRST

**N2 is not built and is not claimed.** Its wording is in no file in the
estate: it is named once, in `probe-live.mjs`'s header, beside N1. No
assertion in this round bears its number. It needs John's wording before
anything is built for it, and inventing a plausible sentence for it would have
been worse than the gap, because a fabricated scope reads exactly like a
recorded one.

Everything else in the brief's list is built: S1, S2, N1, N3, N5, N6, N7, N8.

---

## PHASES, COUNTED AGAINST SIGN-OFFS

Five commits, four phases, each with a matching instruction. Counted, not read.

```
18d977f  S1, S2, N3, N5, N6                      before this session
75aa5fc  the instrument: results file, selectors, N1/N7 asserted
10be74b  the brief and the method rule
9da6d12  R-SZ2: the merged per-product grid
a610c8b  calibration 10 of 10
```

Nothing unaccounted.

---

## R-SZ2, AND WHY THE SHAPE WAS NOT A CHOICE

```
N1 offsets, install minus unit, per row       AFTER
  1920    64, 49, 33, 34                      0, 0, 0, 0
  1440    80, 81, 66, 82                      0, 0, 0, 0
  1240   127, 128, 129, 145                   0, 0, 0, 0
N7 Hybrid    67px at all three widths          0px
N7 OPEX     -12px at all three widths          0px
```

**THE OFFSETS CONVERGED, AND THAT IS WHAT SETTLED IT.** A constant offset is a
spacing fault, fixable above the rows. Converging offsets mean the ROW HEIGHTS
differ, so no work on the preambles could have levelled row 2 onwards. Two
lists can only stay level by sharing row tracks, and sharing row tracks means
being one grid.

**So a product is a row and the alignment is not a measurement that has to keep
holding.** The heads share the grid's first row for the same reason. The
responsibility block moved above the merged columns, where it pushes both
halves equally instead of pushing one.

**N7's TWO HALVES NEEDED TWO CONSTRUCTIONS, because a real `<table>` cannot put
its `thead` in a parent's row track.** The Hybrid columns share a row track.
The OPEX pair consumes one declared head height derived from the type scale,
read by the table's `th` and by the yearly head: one token, two consumers.

**The schedule's head moved out of `YearScheduleView` into its slot**, because
a head track can only be shared by grid items. The testids keep a box, which is
required: N6 measures the schedule against the invoicing group and an element
with no box measures as zero, so `display: contents` was not available.

---

## EVIDENCE

**Live, on the committed tree, 9 of 9 states, from the file the run writes:**

```
widths 1920, 1440, 1240   combos capex/twoPhase, capex/hybrid, opex/twoPhase
states completed: 9 of 9
123 of 123 checks passed
RUN COMPLETE
```

**Calibration, both directions, 10 of 10 on their OWN named assertion**, with
the reverted run GREEN, snapshots verified before injecting, restores compared
byte for byte after every injection, and the in-flight marker cleared only
after the final comparison.

**Suites:** pure 666, react 1431, typecheck clean, database green, all four run
by the pre-commit hook on each commit.

**Screenshots opened and read**, not merely written: the merged grid at 1440
and at 1240, and the OPEX pair at 1920. At 1240, the tightest width, all eight
columns fit with no horizontal overflow and the product labels wrap to three
lines while the row stays one shared track.

---

## THE RE-POINT CENSUS, COUNTED

```
deal-intake.test.tsx        -11 +14
commercials-wiring.test.mjs -10 +14
deal-render.test.tsx         -3  +3
probe-live.mjs               -2  +2
label-contrast.test.mjs      -1  +1
adopted-identity.ts          3 list entries retired
```

**27 assertions removed, 34 added, across six guard files, plus three identity
entries.** The ruling estimated 28 across seven files; the counted figure is
what is reported. Every re-point carries its reasoning at the site and every
superseded anchor is quoted rather than deleted.

**W13's hybrid COLUMN numbers are untouched and explicitly NOT superseded.**
They say which column is how wide and there are still two columns. What changed
is the row structure, which W13 never spoke about. Recorded because the ruling
anticipated retiring them and the honest answer is that none had to go.

---

## FOUR GUARDS CAUGHT THIS ROUND'S OWN WORK, AND NONE WAS WEAKENED

1. **The census control guard and M11 went red together.** The first version
   rendered the install half only when the responsibility is Per Unit, removing
   EIGHT CENSUS INPUTS from the document, 72 to 64. The retired table carried
   `hidden` and KEPT its inputs. The half is hidden, not absent.
2. **`label-contrast`'s own self-check fired** - "the label role has no rule to
   check" - when `.unit-card label` disappeared. The role moved to the cell that
   names the row and the assertion moved with it.
3. **An assertion had already gone vacuous and was caught being re-pointed.**
   `assert.ok(!/\.unit-cards \.unit-card input \{[^}]*width:/)` is a NEGATIVE
   over a selector the merge retires: it matches nothing and passes forever,
   reporting that S1 holds while checking nothing. Verification 14's "true by
   absence" wearing a guard.
4. **A calibration injection came back SILENT with zero failures, and it was my
   injection rather than a missing detector.** It moved the hosting HEAD out of
   the shared track; the hosting BODY is explicitly placed in row 4, so moving
   its head cannot move it. What the silence taught is the better half: the
   levelness comes from both bodies being in row 4, and the shared head track is
   what makes row 4 begin after the taller head. Re-aimed at a body LEAVING the
   track, it fires.

---

## FINDINGS CARRIED, NOT BUILT

1. **N2's wording is unrecovered.** Named above.
2. **`.ys-row` is still a phantom in the stylesheet**, three rules at
   `style.css:2124` that no markup renders. It is the reason the wrong row class
   looked plausible and cost this round a silent skip. It predates this round,
   so under build discipline 10 it is recorded and queued rather than folded in.
   `.opex-row` never existed at all and needed no removal.
3. **The Rate and Margin placeholders render clipped**, `catalog: 2,0(` and
   `no ov`. Checked against the pre-merge screenshots: they were clipped
   identically before the merge, so this is pre-existing and not the merge's
   doing. S1 sizes a box to its FORMAT, and these placeholders are prose longer
   than the format they sit in, which is a question about placeholders rather
   than about the standard.
4. **The merged row shows a product's unit count once**, where the retired table
   also displayed it. `deal-install-units-*` is retired with its assertion
   re-pointed to the input that holds the value.

---

## A NUMBER IN TWO COMMIT MESSAGES IS WRONG, INCLUDING ONE OF MINE

`18d977f` and `9da6d12` both say **"Pure 670"**. Every run of the pure suite in
this session emitted **666**, before and after the merge, so no test was lost
and the count never moved. The 670 is not reproducible from any run here.

**I carried it forward from the previous phase's message instead of reading it
off the runner**, which is precisely the rule this estate already holds: any
number describing a run is emitted by the run, never typed. It cost nothing
this time because the real number is higher-quality news than the claimed one,
and it is recorded because the next person reading those messages would have no
way to know.

---

## WHAT THIS DOES NOT ESTABLISH

The live probe measures NINE states, which is three widths against three of the
mode and structure combinations, not all of them. It does not measure the
responsibility states other than Per Unit at every width: the install half's
hidden case is asserted in the component suite and photographed at none of the
three widths.

N1 being structural means the probe now measures a construction rather than a
coincidence, and the calibration is what makes that a claim rather than a
tautology. It says nothing about whether the merged grid READS better than two
panels, which is a layout ruling and was John's to make.
