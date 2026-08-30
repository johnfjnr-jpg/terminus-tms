# Round 41 item 4: the merge, shipped

**Gate green at all five stages: 302/302 pure, 91/91 database, three HTTP
probes.** The census's both-lists discipline applied to the built result is
below: the census's merged-panel list against the shipped panel's facts,
observed on the screen rather than read off the source.

---

## Both lists

**The shipped panel renders 18 rows and 4 column names.** Read from the screen
across the census's 18 conditions: **33 distinct row labels**, the multiplier
being the label variants a rate state produces.

| # | census said the merged panel would display | shipped | group split |
|---|---|---|---|
| 0 | heading with the unit count | `Deal Sheet (USD) · 26 units` | – |
| 0 | four column names | Hardware / Hosting / Installation / Total (USD) | – |
| 1 | One-off price, hardware, warranty and installation | same | **H, I** |
| 2 | Hosting price over N months *(or not recorded)* | same | **Ho** |
| 3 | Revenue, contract value net | same | **H, Ho, I** |
| 4 | Hardware and warranty cost | same | **H** |
| 5 | Installation cost | same | **I** |
| 6 | Hosting cost over N months *(or not recorded)* | same | **Ho** |
| 7 | PO factoring interest *(figure / `-` / `not recorded`)* | same | full width |
| 8 | Test Bed cost, carried from conversion | same | full width |
| 9 | Withholding tax absorbed *(or grossed up and recovered)* | same | full width |
| 10 | Total cost | same | full width, **the visible sum of rows 4-9** |
| 11 | Gross margin | same | full width |
| 12 | *(the relabelled per-column margin)* | **Margin before financing, test bed and withholding** | **H, Ho, I** |
| 13 | Invoice reconciliation, from revenue | same | full width |
| 14 | Grossed up for WHT *(three labels)* | same | full width |
| 15 | GST *(three states)* | same | full width |
| 16 | Price to customer *(four labels)* | same | full width |
| 17 | Withholding tax deducted *(three states)* | same | **H, Ho, I** when recorded |
| 18 | Net receipt after WHT | same | full width |
| – | the GST field-note | unchanged | – |
| – | the three message lines | unchanged conditions | – |

**Nothing in the census's list is missing from the shipped panel, and the panel
renders nothing the census did not list.**

### The three folded facts, gone as ruled

| what ended | confirmed |
|---|---|
| the WHT-absorbed apportionment across the three groups | absorbed WHT is one full-width row; no `of which` label remains in the panel, asserted |
| finance and test bed inside the Hardware column | both are full-width rows; `computeDealMatrixCols` is deleted |
| the per-column Margin under its old name | relabelled; a test fails on the bare label |

### The dead cells, gone as ruled

The old financing row hardcoded `-` in its Hosting and Installation columns
under every condition. **PO factoring interest is a full-width row, so those
cells do not exist**, and a full-width row emits **one spanning cell** rather
than three dashes and a figure.

---

## Total cost is the visible sum, verified arithmetically

The panel's central claim, and the one a reader will actually test by adding a
column up. Asserted on the arithmetic rather than on the markup, because a panel
that **looks** additive and is not is worse than the fold it replaced.

```
  Hardware and warranty cost          382,154
  Installation cost                   232,000
  Hosting cost over 36 months         194,400
  PO factoring interest                82,736
  Test Bed cost, carried                    0
  Withholding tax absorbed                  0
  ─────────────────────────────────────────────
  Total cost                          891,290   <- the panel's figure, to the dollar
  Gross margin                        263,776   = 1,155,066 - 891,290
```

On a deal where all six carry a figure the identity also holds exactly
(`sixRows.every(v => v > 0)` is asserted, so the test cannot pass on zeros).
Revenue is likewise the sum of its own three group columns.

---

## The three other rulings, built

**The signpost.** `The four installation lines are priced in the Installation
section above.` A `.field-note`, hidden, toggled at the **same site** that
toggles the four rows, so there is one condition rather than two that could
drift. No button, no anchor, no handler: the sections are one scrolling screen
and a control would be a second way to do what scrolling already does.

**The hosting period, one rule on both surfaces.** `perMonthFigure()` in
`deal-inputs.js` carries the per-month suffix on the **figure**; the
over-the-term side keeps `durationPresentation`'s labels. Five figures took it,
three hosting lines and two card totals, and the hardware card is asserted NOT
to. `$5,400 / mo` and `$194,400` are now distinguishable one scroll apart.

**Section-2 consolidation is on the deferred list** with its gate, its method
and its precondition, in `DESIGN_PRINCIPLES.md`.

---

## Two things the assertions could not have caught, found by looking

**1. The label was truncated.** `.dm-label` is `nowrap` with an ellipsis, which
was right for the old matrix's one-word labels and wrong the moment the merge
brought the Result list's sentences into the same grid. At 1240 the relabelled
margin row rendered as `Margin by product group, before financing, test bed
and…`.

**No assertion in the suite could have seen it**, because every label assertion
reads the SOURCE label rather than the rendered box. `CLAUDE.md` Verification 4,
and the label is now shortened AND the panel's labels wrap rather than clip, so
no future label can be silently cut.

**2. The panel is capped at 940px, which is `.deal-sheet-cards`' reasoning
surviving its deletion.** Those cards existed because the label-to-amount travel
on an uncapped `minmax(150px,1fr)` grid was measured at 628px at 1240, 1308px at
1920 and 2828px at 3440: **it grows with every pixel of viewport.** Deleting the
cards without carrying the cap across would have shipped their defect back into
the panel that replaced them. It also settles screen-read finding 2, the summary
going full-bleed when the detail panel is closed: the panel no longer stretches
whether the detail is open or not.

---

## Where the evidence is

`.verify/census/panel-1920.png` and `panel-1240.png` are the shipped panel;
`census.json` holds every observed label and value per condition.
`scripts/probe-fact-census.mjs` reproduces both, and now also takes the captures.

**Report-only discipline on the census probe verified rather than asserted:** it
drives real controls on a real deal, and the four live opportunities are on the
same revision numbers before and after (22, 36, 23, 12).
