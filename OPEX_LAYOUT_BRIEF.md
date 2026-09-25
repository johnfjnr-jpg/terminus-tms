# OPEX layout round

Branch `opex-layout`, off `main` at `b8c8994125f24098e3a13597b29edc10bc2ed570`,
confirmed equal to `origin/main` by `git ls-remote`.

Rule 18 and build discipline 19 govern: this round ends "ready for John's push"
and nothing is pushed from the session.

---

## The findings, John's walk 2026-09-25, verbatim

> **L1:** the OPEX/CAPEX control becomes a labelled slider: "OPEX" on one side,
> "CAPEX" on the other, the slider between them, and the ACTIVE side's label
> highlighted in the estate green (--green family token, no literals; label
> contrast >= 4.5:1 in both states, both positions asserted by computed style
> per the cascade lesson, not class). Keyboard reachable per estate standards.
>
> **L2:** under OPEX the recovery radio group does NOT render (absent from the
> DOM, not disabled): no Single phase, no Two-phase, no Hybrid radios. In their
> place one plain text line: "Single phase recovery over full term". Under CAPEX
> the three radios return exactly as today. Guard asserts absence under OPEX and
> presence under CAPEX.
>
> **L3:** the invoiced-fee (yearly) table moves UP beside the monthly per-unit
> table: top-aligned, side by side, the stagger removed. MEASURE first at 1440
> and 1240: if both tables genuinely cannot share the row at 1240, ship
> side-by-side at 1440 and stacked-but-top-aligned at 1240, and photograph both
> widths for John's verdict; do not shrink type or clip figures to force the fit.

## AMENDMENT, John, mid-round, verbatim

> drop the single phase text line

**Appended at the phase it launched**, not discovered at the close. L2's
replacement line is gone: under OPEX the radio group goes and **nothing stands
in its place**. The assertion is kept rather than deleted, because "no radios"
and "no replacement either" are two claims and the second is the one a later
round could quietly undo.

---

## PHASE 0 FOR L3: MEASURED, AND THE ANSWER IS SPLIT

Natural widths, read on the live surface rather than computed from last round's
estimate:

```
                    natural    1440 card inner    1240 card inner
OPEX table            487px          755px             605px
invoiced-fee          272px
sum + 24px gap        783px      does NOT fit      does NOT fit
```

**So the estimate was right about 1240 and WRONG about 1440**: 759px of table
against a 755px content width misses by four pixels before any gap.

**The gap was closed by padding, not by type.** The cell padding came down from
10px to 6px and the first column's from 18px to 12px, taking the OPEX table to
**453px**. Nothing was clipped: every figure still renders in full and the live
probe asserts the card does not overflow at either width.

```
1440   453 + 272 + 24 = 749 in 753   SIDE BY SIDE, tops equal
1240   603px of room                 STACKED, as the ruling allows
```

Both widths are photographed for John's verdict.
