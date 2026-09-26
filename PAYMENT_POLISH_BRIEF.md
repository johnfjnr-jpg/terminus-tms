# Payment polish round: the brief

Branch `payment-polish`, off `main` at `20056eb`, confirmed equal to
`origin/main` by `git ls-remote` against the real remote rather than the local
tracking ref.

Rule 18, build discipline 19 and the standing named-findings-only rule govern:
**this round ends "ready for John's push"** and nothing is pushed.

**A NUMBERING COLLISION, NAMED BEFORE IT CAUSES ONE.** This round's findings are
M1 to M11. `CLAUDE.md` already carries **M1 to M4 as method rulings** (the
markdown-only commit tier, the cosmetic tier, walk batching, injections for new
claims) and **M6 as the report-transfer rule**. The round's closing line
"Reports per M6" means the REPORT-TRANSFER rule, not this round's finding M6.
Where this file says M1 to M11 unqualified it means THIS ROUND'S FINDINGS; the
method rulings are written "method M1" and so on. The round method warns that
two numbering schemes sharing a range produced a false coverage claim once
already.

---

## SUPERSESSIONS OF RECORD, John, 2026-09-26, verbatim

> the vertical rail (R-PT2/F4) retires; recovery radios return to HORIZONTAL;
> the mode toggle regains flanking labels in the order CAPEX left, OPEX right.
> Superseded assertions re-taken with reasoning left at their sites.

**This is the third ruling on the mode control in four rounds and the second on
the rail**, so the history is recorded here rather than left implicit:

| Round | What it ruled | Now |
|---|---|---|
| R-OX1 | the mode switch takes the factoring toggle's dress | stands |
| L1 | flanking OPEX / CAPEX labels, active side green | **restored, order reversed** |
| slider direction | the knob sits on the side of the ACTIVE mode | **restored** |
| F1 | one shared component, labels INSIDE, flanking labels removed | **component stands, labels superseded** |
| R-PT2 / F4 | a vertical control rail | **retires** |

**F1's reasoning was that flanking labels are what made the two controls
different sizes.** That is still true and is no longer decisive: John's ruling
separates the two kinds of control. A TWO-STATE SELECTOR takes the flanking
variant; an ON/OFF SWITCH keeps the label inside. They are different questions
wearing one component, which is what the previous rounds did not distinguish.

---

## PHASE 0, MEASURED BEFORE ANYTHING MOVED

### M5's stop condition is NOT met, and the reason is that M5 ALREADY HOLDS

The finding says 8 live records are capex with no structure key. **Measured:
exactly 8**, over 18 of 18 live opportunities with coverage asserted.

```
records whose DERIVED FIGURES would move under a Two-phase default:   0
records in that set carrying ISSUED versions:                         0
```

**Why nothing moves: the default already exists, in both readers.**

| Reader | What it does with an absent structure |
|---|---|
| `frontend-react/src/deal/payload.ts` `uiFromPayload` | `(p.structure as string) \|\| 'twoPhase'` |
| `src/lib/deal-inputs.js:619` | `structure: payload.structure ?? 'twoPhase'` |

So a CAPEX record with no structure key **already renders Two-phase selected
and already prices as Two-phase**, on the client and on the server. Measured
live on a record built in that shape:

```
mode control      CAPEX
structure radios  [{"twoPhase": ACTIVE}, {"hybrid": false}]
schedule heading  "Invoiced fee, annual in advance (USD)"      <- two-phase's
recovery input    shown
SELECTED: twoPhase
```

And derived both ways, with a recovery period set and unset, the stored shape
and the screen's shape produce **0 differing values** out of 49.

**THE EIGHT RECORDS ALL PRICE AT contractNet 0**, because none has units
entered. On its own that makes "0 moved" a comparison with nothing on either
side (Verification 14). The calibration answers it: `ssExisting +10` moves 21
to 29 of 49 values **on those same records**, so the comparator discriminates
on this population.

**What M5 therefore needs is the ASSERTIONS, not the behaviour**, plus the fact
that the default now lives in two places that agree by coincidence of writing
rather than by construction (Verification 20).

### M2: the gap is already correct at 1440 and 1240, and wrong at 1920

```
            payment card        factoring card      GAP
1920        302-1122 (820px)    1469-1858 (389)     347px
1440        302-1089 (787px)    1109-1378 (269)      20px
1240        302- 939 (637px)     959-1178 (219)      20px

.deal-payment-region   display: grid   gap: 20px
  columns at 1920      1147px 389px        <- the card is 820 in a 1147 column
```

**The estate's standard gap in this region is 20px**, read from the region
itself rather than chosen. The defect is at wide viewports only: the first
grid column is 1147px while the card inside it is 820px, so 327px of dead space
pushes the factoring card away.

### M9 and M10: the before state

```
factoring rate input    355px at 1920, 235 at 1440, 185 at 1240
factoring term input    the same
repayment method        two STACKED full-width buttons, 355 / 235 / 185px
```

Every one is the column width. M9 asks for content sizing (`xx.x%`, `XXX`) and
M10 for the two-sided control.

### M8: what the two columns have to fit into

```
.deal-section--intake   grid-template-columns: minmax(0, 340px) minmax(0, 1fr)
.unit-cards             grid-template-columns: minmax(0, 320px)
.unit-cards .unit-card  minmax(0, 1fr) 72px        label | count
```

The Units column is capped at 340px today and the count box is 72px. Two added
read-only columns must fit at 1440 and 1240 without clipping, which is measured
rather than assumed before the cap moves.

---

## Standing method

- Measurements on the LIVE surface, never inferred from source.
- Layout claims stated as a RELATIONSHIP between two elements.
- Every screenshot opened and read.
- Every new guard calibrated both directions; a SILENT injection explained.
- Database read-back on every stored value touched.
- Commits at every phase boundary. Nothing pushed.
