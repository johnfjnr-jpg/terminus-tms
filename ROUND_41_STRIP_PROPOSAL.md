# Round 41 item 3: the top strip, measured and proposed

**Measured 2026-08-30 against the finished screen at 1920 and 1240, on
TT-SGP-SMARTC-003, the only live opportunity carrying any units.** Three
candidate layouts were injected into the real page rather than mocked, because a
standalone mock would measure a page that does not exist: no sidebar, no scroll
container, and none of the content the strip's height is paid out of.

**The ruling is the business's. Nothing here is built.**

---

## Before it is proposed, a premise that did not survive measurement

The brief says:

> Closing cash position joins the top strip beside achieved margin. **Finance
> cost reads `$0` and earns its place less.** Finance cost stays in the strip.
> The demotion is in weight, not membership.

**Finance cost reads `$252,794` on the only deal that has anything in it.** That
is 21.9% of contract net and the second-largest number on the strip.

Measured across all four live opportunities, with the real catalog:

| reference | contract net | margin | total cost | finance | closing cash |
|---|---|---|---|---|---|
| TT-SGP-MANUFI-002 | $0 | 0.0% | $0 | $0 | $0 |
| TT-SGP-SMARTC-002 | $0 | 0.0% | $0 | $0 | n/a |
| **TT-SGP-SMARTC-003** | **$1,155,066** | **8.1%** | **$1,061,348** | **$252,794** | **$117,341** |
| TT-SGP-SMARTC-001 | $0 | 0.0% | $0 | $0 | $0 |

**The three `$0` readings are deals with no units.** Their contract net is `$0`
too. So "finance cost reads $0" was measured on deals where every figure reads
zero, and it does not distinguish finance cost from anything else on the strip.

`CLAUDE.md` Verification 26: a measurement became an instruction, and the
measurement is about the deal rather than the field. Verification 29: **the
decision is re-taken, not re-weighed**, and it is the business's to take.

**Both readings are proposed below.** The layouts are identical either way; only
which of the two promoted figures finance cost sits beside changes.

---

## What the strip does today

| | 1240 | 1920 |
|---|---|---|
| grid | 4 equal columns, 195px | 4 equal columns, 365px |
| height | 42px | 42px |
| on screen at zero scroll | yes | yes |
| every figure's type | 15px, weight 300, `rgb(242,242,240)` | same |
| span from first ink to last | 753px | 1263px |

**All four figures are typographically identical.** Achieved margin, which is
what the screen exists to produce, is set in exactly the weight, size and colour
of Finance cost. It is also the shortest string on the row, four characters
between two seven-figure amounts, so it reads as the least of the four.

**And the strip's achieved margin is the WEAKER of the two renderings on the
tab.** Measured: `#deal-achieved-margin` is 15px; `#deal-terms-achieved-margin`
lower down is 20px. The business reported this as screen-read finding 6 and the
measurement agrees.

**The two renderings also obey different colour rules.** The lower one carries
Round 39's decision, green means at or above target and nothing under target is
accented. The strip carries no rule at all. That is one value with two readers,
`CLAUDE.md` Verification 20, and the fix is that the strip adopts the same class
rather than growing a second rule.

---

## The measure

**How far the eye travels between the two figures the business wants read
together**, glyph edge to glyph edge, rather than a cell width. A 15px number in
a 365px cell leaves 275px of nothing, so a column measurement describes the
document and not the reading. `CLAUDE.md` Verification 27.

---

## The three candidates

### A. Five equal columns

Margin and closing cash promoted to 20px, the other three muted to 13px, order
unchanged.

| | 1240 | 1920 |
|---|---|---|
| eye travel, margin to cash | 496px | **904px** |
| height | **66px** | 50px |
| rows | 1 | 1 |

**Rejected on measurement, at 1240.** `CLOSING CASH POSITION` wraps to two lines
in a 150px column and drops its value 16px below the other four, so the row is
ragged and the promoted figure sits lowest. Visible in
`.verify/strip/strip-A-1240.png`.

**And at 1920 it is the worst of the three at the thing it is for**: the two
promoted figures are second and fifth, with two muted figures between them, 904px
apart. The layout promotes them and then separates them.

### B. Asymmetric, one row: the promoted pair leads

`grid-template-columns: 1.6fr 1.6fr 1fr 1fr 1fr`, gap 28px. Achieved margin and
Closing cash position first at 24px; contract net, total deal cost and finance
cost after them at 13px muted.

| | 1240 | 1920 |
|---|---|---|
| eye travel, margin to cash | **167px** | **343px** |
| height | 56px | 56px |
| rows | 1 | 1 |
| wrap or overflow | none | none |

**Stressed with the longest strings that can actually occur**, rather than the
ones this deal happens to have: a negative seven-figure closing cash
(`-$1,275,556`, the business's own example was negative), a negative margin
(`-142.7%`), eight-figure net and cost, and the `not recorded` finance cost that
ruling 5 introduced. **Height stays 56px, one row, no wrap, no overflow, at both
widths**, and the eye travel falls to 124px at 1240 because the glyphs are wider.
`.verify/strip/strip-Bstress-1240.png`.

### C. Two tiers

The promoted pair on a first row at 26px, the supporting three on a second row at
13px muted.

| | 1240 | 1920 |
|---|---|---|
| eye travel, margin to cash | 392px | 732px |
| height | **118px** | **118px** |
| rows | 2 | 2 |

**The most emphatic and the most expensive.** 76px more than today, paid by
everything below it on a screen whose whole point is one scroll. And at 1920 the
pair spreads across 762px cells, so the two figures it exists to pair are 732px
apart, which is the current layout's problem reappearing inside the fix.

---

## Recommendation

**B.** It is the best on the measure at both widths by a factor of two to three,
it holds under the worst strings that can occur, and it costs 14px of height
rather than 76px.

```
ACHIEVED MARGIN        CLOSING CASH POSITION      CONTRACT NET   TOTAL DEAL COST   FINANCE COST
8.1%                   $117,341                   $1,155,066     $1,061,348        $252,794
   24px                    24px                       13px muted    13px muted        13px muted
```

Two things travel with it, and both are corrections rather than additions:

1. **The strip's achieved margin adopts the same green-at-or-above-target class
   as the rendering lower down**, so one rule governs both and the strip stops
   being the weaker of two readings of the same number. No red is introduced;
   that decision stands.
2. **A negative closing cash position needs a treatment and it must not be red.**
   Proposed: none at all. The minus sign and the size carry it, exactly as a
   below-target margin is carried by the ABSENCE of green. Flagged rather than
   built.

---

## The two rulings this needs

1. **A, B or C**, or a fourth shape.
2. **Does finance cost still earn a demotion**, now that its `$0` was measured on
   deals where every figure was `$0` and it reads $252,794 on the only populated
   one? Under B the demotion costs nothing to reverse: finance cost moves from
   the muted trio into the promoted pair, or a third promoted figure joins them,
   and the same measurement can be re-run in a minute.

## Where the evidence is

`.verify/strip/` holds the captures at both widths for before, A, B, C and the
stressed B, and `before.json`, `A.json`, `B.json`, `C.json`, `Bstress.json`
carry every number above. `scripts/probe-strip-layout.mjs` reproduces them:

```bash
PUPPETEER_PATH=/tmp/tms-probe/node_modules/puppeteer/lib/puppeteer/puppeteer.js LABEL=B node scripts/probe-strip-layout.mjs
```

**The captures are also copied to `screenshots/` as `r41-strip-*.png`**, which is
where this project's captures have always gone. **Both directories are
gitignored**, so neither survives a clone and neither reaches anybody who was not
at this machine. That is the Round 40 close's "the captures are not in .verify/"
arriving again, and it is a property of the convention rather than of this round.
The seven files were sent to the business directly. **Whether they arrived is not
something this document can claim**: `SendUserFile` reported success on two files
that never appeared, at the Round 40 close, and the person who quoted that
success line as confirmation was the author of the rule against doing so
(`CLAUDE.md` Verification 9).
