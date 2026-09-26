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

## THE PHASES, RECONCILED BY COUNTING

Counted from the commits on this branch, not read off this file.

| Phase | Commit |
|---|---|
| The brief, John's supersessions, and Phase 0 measured | `e307636` |
| M1 to M11 built: the rail retires and the two-sided selector returns | `99a9e77` |
| Live proof 342/342 and calibration 13 of 13 | `84830d8` |
| Database read-back on every stored value touched | `ac22c9f` |
| Close-out | this commit |
| `CURRENT_STATE.md` | the next |

**Rulings in force: 3** - the eleven findings, the three supersessions, and the
standing named-findings-only rule. All three were in this file before any work
began, so nothing had to be appended late.

---

## DISPOSITION, ITEM BY ITEM

| | Disposition |
|---|---|
| **M1** | **BUILT.** CAPEX \| toggle \| OPEX, knob and highlight asserted as computed geometry and computed colour in both states |
| **M2** | **BUILT.** 20px at 1920, 1440 and 1240, against 347px at 1920 before |
| **M3** | **BUILT.** Contract Duration, read-only, one store, asserted |
| **M4** | **BUILT.** One row, rings aligned, under the mode control |
| **M5** | **ALREADY HELD; ASSERTED.** Phase 0 found the default already in both readers. The stop condition was not met and nothing was migrated |
| **M6** | **BUILT**, and it is why `structureChosen` exists |
| **M7** | **BUILT.** One placement serves both structures, because the rail's removal makes the fee table and the Hybrid grid siblings |
| **M8** | **BUILT.** Two read-only catalog columns, nothing clipping at either width |
| **M9** | **BUILT.** 76px and 64px, proven by the values not clipping rather than by the numbers |
| **M10** | **BUILT**, stored value unchanged, both directions driven and read back |
| **M11** | **BUILT.** Absent, not hidden |

**What this round does NOT establish.** The rail's retirement is a layout
ruling, not a measurement that the flat card is better; what IS measured is
that the money now starts at one place in both modes by construction rather
than by a rule. And M5 is asserted rather than changed: the eight records are
untouched, and the default remains display-and-save-forward.

---

## THE SUPERSEDED ASSERTIONS, RE-TAKEN

John's ruling asks for these to be re-taken with reasoning left at their sites.
Every one is, and the list is here so the count is checkable:

| Where | What was re-taken |
|---|---|
| `payment-rail.test.tsx` | the whole file: P1 to P6, from the rail to the flat card. P3's "and the content column holds none" is the one claim that GOES, because it was about the rail rather than the screen |
| `opex-layout.test.tsx` | L1a, L1b, L1d - the third writing of this block in four rounds, and the round trip is named at the site |
| `payment-fix.test.tsx` | F1b, F1c, F2a, F4a, F4d |
| `payment-fix-2.test.tsx` | F3c |
| `deal-section5.test.tsx` | P2/P3/P4/P6, P5, P8/P9, P10 |
| `deal-surfaces.test.ts` | the renamed visibility flag, plus a new chosen-versus-defaulted case |
| `deal-panel.test.tsx` | the census, kept at FULL strength rather than shrunk |
| `deal-intake.test.tsx` | I1, plus four new M8 cases |
| `commercials-wiring.test.mjs` | the Units grid: re-pointed at ONE COLUMN, which is what it was always about |
| `adopted-identity.ts` | two classes retired from the list rather than exempted in the ratchet |

---

## CARRIED, NOT BUILT

1. `SwitchButton` writes the toggle treatment itself, a third route to it.
   Carried from two rounds ago; M1 and M10 name the mode, factoring and
   repayment controls only.
2. Two dev servers are running, one holding no port. No `src/` file changed
   this round, so nothing measured was stale.
3. **The default for an absent structure lives in TWO readers** -
   `uiFromPayload` and `deal-inputs.js:619` - which agree. M5a asserts they
   agree; making one a caller of the other is design work this round did not
   ask for.

---

## Standing method

- Measurements on the LIVE surface, never inferred from source.
- Layout claims stated as a RELATIONSHIP between two elements.
- Every screenshot opened and read.
- Every new guard calibrated both directions; a SILENT injection explained.
- Database read-back on every stored value touched.
- Commits at every phase boundary. Nothing pushed.
