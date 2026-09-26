# The adjacency round: build brief

Branch `adjacency`, off `main` at `d0adb7c`, confirmed equal to `origin/main`
by `ls-remote` before branching.

Findings from John's screenshots of 2026-09-26, plus one permanent standard.
Rule 18, build discipline 19 and named-findings-only govern. The round ends
"ready for John's push".

---

## A1, THE STANDARD (permanent, into `DESIGN_PRINCIPLES.md`)

> In any row that pairs a label with figures, the horizontal gap between the
> label and the row's first figure stays within a stated bound.

**THE BOUND IS DERIVED FROM THE ESTATE'S OWN ROWS, AND THE MEASUREMENT CHANGED
ITS SHAPE. This is a documented position and John's to overrule.**

Measured before anything moved, at 1920, 1440 and 1240, across four
mode/structure/responsibility states, walking every label+figures table and grid
in the opportunity view by STRUCTURE rather than by name:

```
container                     worst gap   behaviour across the three widths
deal-product-grid              1157px     42 -> 171 -> 651, and 477 -> 677 -> 1157
                                          under Lump Sum. GROWS WITH THE PANEL
stmt-row-line (the C2 statement) 570px    constant
ds-row                          191px     constant
ys-line                         189px     constant
cf-row head                     175px     constant
cm-grid-row cm-grid-total       169px     constant
pg-row pg-total                 145px     constant
cf-row                          140px     constant
pg-row                           84px     constant
deal-opex-table (the fee table)  42px     constant
```

**AN ABSOLUTE CEILING ALONE CANNOT SEPARATE THE GOOD ROWS FROM THE DEFECT.**
The two structures the brief names as good disagree with each other: the fee
table's worst gap is 42px and the C2 statement's is 570px, on its "Achieved
margin / against target" line. Any ceiling tight enough to mean something
against 42px would fail most of the deal screen, none of which is a named
finding.

**WHAT DOES SEPARATE THEM IS MEASURED AND UNAMBIGUOUS: every row the estate
ships today is CONTENT-SIZED and its gap is CONSTANT across the three widths.
Only the merged product grid scales with the panel**, from 42px at 1240 to
1157px at 1920. That is A2's own sentence, "sizes to its CONTENT, not the
panel", stated as something a guard can measure.

So A1 is stated as two clauses:

1. **THE GAP DOES NOT GROW WITH THE PANEL, the operative rule.** A row's
   label-to-first-figure gap at 1920 exceeds its gap at 1240 by no more than
   **100px**.

   **SUPERSEDED WITHIN THE HOUR, AND THE FIRST VERSION IS QUOTED RATHER THAN
   DELETED.** It read: *"WIDTH INVARIANCE. A row's gap measured at 1920, 1440
   and 1240 agrees within 8px."* That rested on a premise the red-first run
   falsified: the estate's rows are NOT constant across widths. `pg-row` reads
   84/84/284, `pg-row pg-total` 145/145/345, `ds-row` 191/191/119 and
   `stmt-row-line` 570/570/510, because labels wrap at 1240 and the rows
   reflow. A spread rule flags most of the deal screen, none of it a named
   finding.

   **The premise failed, so the rule is re-taken rather than re-weighed**
   (Verification 29). What separates the good rows from the defect is
   DIRECTION: the defect grows with the PANEL, 42 to 171 to 651 and 477 to 677
   to 1157, while the estate's rows grow at the NARROW end where a label wraps.
   Positive growth across the full 680px of width range tops out at **+72px**
   on `ds-row`; the product grid grows **+609px** and **+680px**. 100px passes
   every shipped row and fails the defect by six times.
2. **AN ABSOLUTE BACKSTOP of 600px**, which sits above the estate's worst
   shipped row and below the defect at every width it appears. It is a
   backstop rather than the standard, and it is stated because A1 asks for a
   number.

**THE GAP IS MEASURED FROM THE LABEL'S TEXT, NOT FROM ITS CELL**, and the first
version of the guard got this wrong. Measured cell to cell, the product grid
reads **16px** at every width: a stretched label cell runs right up to the
figure and the text stops far short, so the cell measure is blind to exactly the
fault A1 exists for. The text's own right edge is where the reader's eye leaves
the label.

**Recorded as a finding for John rather than fixed here:** the C2 statement's
"Achieved margin" line sits 570px from its figure, constant at every width. It
passes clause 1 and clause 2 and is not a named finding, so it is reported and
queued, not built.

**ESTATE-WIDE GUARD**, red-first, walking every label+figures table and grid at
all three widths, naming each offender with its measured gap. Calibrated by
stretching one good row.

---

## THE FINDINGS

**A2.** The merged units/installation grid sizes to its CONTENT, not the panel.
The numeric columns sit adjacent to the product labels per A1 at all widths.
Measured before and after at 1920, 1440 and 1240. The full-width stretch dies at
its named mechanism.

**A3.** When the installation half hides (Lump Sum), its column tracks COLLAPSE.
The visible columns still satisfy A1. Hidden-not-absent stays, because the
census control guard depends on those inputs being in the document. Both
responsibility states measured.

**A4.** "Lump sum cost" label and value render with standard separation, never
concatenated. The same for any touching label+value pair the census finds.

**A5, John's ruling, a permanent principle alongside A1.** A control group sits
WITH the content it affects, immediately above the panel whose numbers it
changes. The INVOICING radios move to sit directly ABOVE the invoiced-fee
schedule in every structure that shows them: OPEX and Two-phase above the fee
schedule, Hybrid above the hosting schedule. **NOTHING ELSE on the OPEX panel
changes**, John's verdict being that the rest reads right. Asserted as geometry,
the radio row's box immediately above the schedule's box, plus driven proof that
toggling Monthly changes the schedule it sits on.

**A6, John's finding, the PO Factoring card.** The rate field, the term field
and the repayment slider right-align to one shared edge, labels left, in the
estate's card shape. The rate input's right edge, the term input's right edge
and the repayment control's right edge are equal, asserted as computed geometry
at both widths and in both factoring states. The repayment control's flanking
labels ride with it, STRAIGHT-LINE left of the slider and DECLINING BALANCE
right, per the ruled layout. Field sizes stay per the S1 formats.

---

## STEP 0 RIDERS

1. **The N2-numbered assertion.** Row pairing and dress equality, carrying N2,
   which the sizing round recorded as unrecovered and did not claim.
2. **The placeholder-format rule.** A placeholder carries a value fitting the
   field's format, never prose. The sizing round's carried finding: the Rate and
   Margin placeholders render clipped as `catalog: 2,0(` and `no ov`, because
   S1 sizes a box to its FORMAT and those placeholders are prose longer than the
   format they sit in.
3. **The `.ys-row` phantom purge.** Three rules at `style.css:2124` that no
   markup renders, carried from the sizing round. `.opex-row` never existed and
   needs no removal.

---

## THE CLOSE

Red-first throughout. Calibration in both directions. Live proof at 1920, 1440
and 1240 across both responsibility states, both factoring states and all
mode/structure combinations, with screenshots opened and read. Close-out.
`CURRENT_STATE`. The `ls-remote` equality re-check at merge time. Branch gate
`--round-close`, merge `--no-ff`, merged-tree gate, then "ready for John's
push".

**Any red: STOP.** Reports per M6.
