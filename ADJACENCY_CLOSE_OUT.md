# The adjacency round: close-out

Branch `adjacency`, off `main` at `d0adb7c` with `origin/main` confirmed equal
by `ls-remote` before branching. First commit was the brief.

---

## WHAT IS NOT BUILT

**Nothing in the brief is unbuilt.** A1, A2, A3, A4, A5, A6, both rulings and
all three riders are built and proven.

**Two things are carried, named rather than absorbed:**

1. **56 pre-existing dead stylesheet tokens**, held by a shrink-only ratchet
   rather than purged. Deleting 56 class families in a round about adjacency is
   the kind of sweep that hides a mistake. The ratchet is the queue, and it is
   mechanical rather than a promise.
2. **At 1240 the repayment control still extends past the factoring card's
   border.** That is the behaviour R-ADJ1 preserved rather than something this
   round introduced: before the round the card was 25% of the region and the
   control overflowed it by the same margin, unmeasured. A6 does not hold at
   that width by ruling.

---

## PHASES, COUNTED AGAINST SIGN-OFFS

```
8b9c381  the brief, with A1's bound derived from measurement
1b40d2a  A1's guard and standard, A2, A3, A4 and A6; the 1240 conflict named
6c258e8  A5, the three riders, the dead-selector gate, calibration 6 of 6
```

Three commits, three instructions. The middle one stopped on a conflict and
reported rather than choosing; the rulings answered it.

---

## THE MEASUREMENTS

```
                          BEFORE                        AFTER
product grid gap    42 / 171 / 651, and             43px max, 16px min,
                    477 / 677 / 1157 under Lump     identical in every state
statement worst     671 and 731 on "Profit"         357 and 381 on a normal row
ds-row              191 / 191 / 10 after A6         back inside the bound
factoring edges     rate, term, control all differ  equal above 1360, stacked below
lump sum cost       "LUMP SUM COST250000"           label above value
placeholders        "catalog: 2,0(", "no ov"        the figure, and an em dash
```

---

## A1's BOUND CHANGED SHAPE TWICE, AND THE BRIEF CARRIES BOTH VERSIONS

The brief first stated **width invariance within 8px**. The red-first run
falsified its premise: the estate's rows are not constant across widths, because
labels wrap at 1240 and rows reflow. `pg-row` reads 84/84/284, `ds-row`
191/191/119, `stmt-row-line` 570/570/510. A spread rule flags most of the deal
screen, none of it a named finding.

**The premise failed, so the rule was re-taken rather than re-weighed**
(Verification 29). What separates the good rows from the defect is DIRECTION:
the defect grows with the PANEL while the estate's rows grow at the NARROW end
where a label wraps. Positive growth across the full width range tops out at
+72px on `ds-row`; the product grid grew +609px and +680px. The rule is 100px of
growth, plus the 600px backstop A1 asked for as a number.

---

## THE GUARD WAS WRONG THREE TIMES BEFORE IT WAS RIGHT

1. **Measured cell to cell, the product grid read 16px at every width.** A
   stretched label cell runs right up to the figure and the text stops far
   short, so the cell measure is blind to exactly the fault A1 exists for.
2. **It reported an 808px offender that was a grid of CARDS.** Checked before
   excluding rather than assumed to be another screen: the opportunity band is
   genuinely inside the view, and what disqualifies it is that its cells are
   containers. A cell is a leaf.
3. **It rejected all fourteen visible C2 statement rows**, one of the two
   structures the bound is derived from, because it took `cells[0]` as the label
   and `.stmt-row-line` leads with an expander holding a chevron.

Each was found by reading the output, which is the argument for measuring before
writing the brief: a bound stated from the first version would have been a
number about the wrong thing.

---

## FOUR DEFECTS THIS ROUND'S OWN WORK CREATED, EACH NAMED

1. **A6 starved the hybrid schedule.** Making the card content-sized took
   `ds-row` to 191/191/10, a 181px growth. Reported rather than absorbed, and
   R-ADJ1 answered it.
2. **R-ADJ1's first fix was not in force while looking as though it was.** The
   media query sat thousands of lines earlier than `.deal-payment-region`, and a
   media query adds no specificity, so the base rule won on source order.
3. **The `.ys-row` purge took a live claim with it.** Round 41's finding 3 was
   protected on `.ys-cell`, which no markup renders, while `.ys-line` renders
   and had no protection at all. The rule was dead and the claim was not.
4. **A4 was a defect the SIZING round created**, found here. `#deal-section-2
   .deal-field` stacked the label above its control and R-SZ2 retired that id,
   so the selector matched nothing. An orphaned fix is worse than no fix.

---

## THE METHOD FIX IS NARROWER THAN THE RULING ASKED, AND THE REASON IS MEASURED

`probe-dead-selectors` names **507** selectors as matching nothing, including
`#deal-factoring-fields .deal-field` and `#deal-opex-table`, both live and merely
unvisited. Its own header says so: a rule for a state the run never visited is
alive and unreached. **A gate on it would be red on hundreds of false positives,
or would need an exemption list, and an exemption list rots.**

So the gate stage is a SOURCE check, sound in the other direction: **a class or
id in the stylesheet and in NO markup anywhere cannot match in any state.** It
runs in the pure suite, needs no browser and no state walk, and everything it
names is genuinely dead. It catches A4's root cause exactly.

It names 56 pre-existing dead tokens, held by a shrink-only ratchet with two
tests that stop the list rotting: one refuses a token that has come back to life,
one refuses a token the stylesheet no longer names.

---

## CALIBRATION, AND FOUR OF SIX WERE SILENT FIRST

**6 of 6 fired on their own named assertion**, reverted run GREEN, snapshots
verified before injecting and restores compared byte for byte.

**Every silence was my injection rather than a missing detector**, and each is
recorded at its site:

- FAST walked ONE combo where the lump-sum field is hidden and the OPEX
  placement never renders, so A4 and A5 injected into checks that could not run.
- A2 restored the `1fr` on a template the state under test does not use, so the
  slack split eight ways and the gap grew 76px, inside the 100px allowance.
- A4 left `gap: 6px` in force, which is the tightest layout the guard still
  calls acceptable.
- A1 removed the result tier's cap, worth 570px against a 600px backstop; the
  cap FAMILY's primary member is `.stmt`'s own 980px.

---

## EVIDENCE

Live **254 of 254 over fifteen states**, three widths against both
responsibility states, both factoring states and every mode and structure
combination. Pure 670, react 1431, typecheck clean, database 105/105.

**Screenshots opened and read**, including the two the ruling names: the stacked
1240 factoring card, and the Profit row after its fix sitting in a capped block
with its figure beside its label.

---

## WHAT THIS DOES NOT ESTABLISH

The dead-selector gate is sound but not complete: it finds tokens no markup
mentions, and cannot find a selector whose parts all exist but never co-occur,
which is the `.pg-margin` shape the runtime probe was built for. That probe
stays advisory and its 507 candidates are unreviewed.

A1's bound is derived from what the estate ships today. It says nothing about
whether 100px of growth is the right allowance for a row nobody has built yet.
