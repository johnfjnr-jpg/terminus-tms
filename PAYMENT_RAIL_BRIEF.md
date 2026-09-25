# Payment Terms rail round

Branch `payment-rail`, off `main` at `967608f4745ca393312aef3a51271d9f6655b44c`,
confirmed equal to `origin/main` by `git ls-remote`.

Rule 18 and build discipline 19 govern: this round ends "ready for John's push".

## R-PT2, John 2026-09-25, verbatim

> the Payment Terms panel gains a left-hand control rail; the money content
> (CAPEX fee tables, OPEX per-unit and yearly tables) starts at the SAME height
> at the top of the panel in BOTH modes, top alignment asserted. Under CAPEX the
> rail holds the recovery radios as a VERTICAL column: labels "Single phase",
> "Two-phase", "Hybrid", each with its existing explanatory text as a small
> secondary line beneath (--muted, >= 4.5:1 asserted as computed style). Under
> OPEX the rail holds no radios (absence stands per L2). The slider: MEASURE
> whether it reads best at the top of the rail or above the panel as now; take
> the rail-top position if both work [...] Invoicing and Recovery period
> controls stay where they are this round.

## PHASE 0, MEASURED

The three labels and their secondary lines were built offscreen with the real
fonts and measured:

```
                        1440        1240
card inner width        753px       603px
RAIL, text natural      178px       178px
CAPEX content (yearly)  272px       272px     rail + yearly = 474, FITS both
OPEX content            749px       749px     rail + both   = 951, FITS NEITHER
```

**Three things follow, and the first is a supersession.**

1. **L3's side-by-side at 1440 is superseded.** The two OPEX tables need 749px
   and the content column has 529px at 1440. They stack beside the rail at both
   widths now. R-PT2 is the later ruling and it re-lays this panel.
2. **At 1240 the rail narrows to 126px and the secondary lines wrap.** A 178px
   rail would leave 401px against a 453px table, which would clip money. 126px
   leaves exactly the 453px the table needs. Wrapping an explanation shrinks no
   type and clips no figure.
3. **The rail is 200px at 1440, not 178.** 178 was the width of the label and
   its line; the row also carries a 14px ring and an 8px gap, and at 178 the
   longest explanation wrapped. 200px gives it one line and still leaves 529px.

## The slider

**Taken at the rail top**, per the ruling's "take the rail-top position if both
work". It works: the direction round's assertions - knob at the track end, the
green highlight, the aria state - are re-run in the new position and hold
unchanged, which is the point of re-running them rather than assuming.
