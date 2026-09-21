# N1 is STOPPED, and the reason is worse than N1 anticipated

N1 asked for a total on the customer milestone USD column, and stopped the
round on that finding if the carried two-readers defect made the total
ambiguous.

**It does, and the defect is not confined to a total.**

---

## What was measured

A hybrid opportunity, 40 SafeSight units. A milestone typed at month 3, 50%.
Then the unit count changed to 80, which doubles the one-off price. Driven
with real keyboard events, and every write confirmed to have landed before
anything was measured.

```
=== 1. type a percentage at the FIRST price ===
   units=40  pct=50  DISPLAYED usd=233571.50
   save: ok       STORED milestone: {"pct":50,"usd":233571.5,"month":3}

=== 2. change the UNITS, which changes the one-off price ===
   units=80  pct=50  DISPLAYED usd=467143.00

=== 3. save again, and read what the RECORD received ===
   save: ok       STORED milestone: {"pct":50,"usd":233571.5,"month":3}

   DISPLAYED on screen after the price change : 467143
   STORED in the record after saving that     : 233571.5
   they DISAGREE by 233571.5
```

**The screen shows one figure and the save writes another, at 100% error, and
the save is accepted with no indication.**

---

## THREE READERS, TWO FIGURES, ONE SCREEN

The measurement that changes the shape of this finding. At the same moment,
with nothing touched in between:

```
the grid cell (derived) : 467143.00
the schedule warning    : "Customer milestones total $233,572 against a
                           hardware and installation price of $934,286.
                           Under by $700,714.5, 75.00 points."
the cash flow row       : "Milestone hardware payment  ...  233,572  ..."
```

- **The grid cell** derives from `pct x oneOffPrice` and tracks the price.
- **The schedule warning** reads the STORED figure.
- **The cash flow** reads the STORED figure.

So the payment terms panel states **$467,143** on one line and **$233,572**
three lines below it, and the deal's cash position is computed from the
second.

---

## Why the total was the right thing to stop on

A total is a claim that a column adds up. This column has two readings that
differ by a factor of two after an ordinary edit, so a total would be right
about one of them and wrong about the other **with nothing on screen saying
which** - which is what N1's stop condition was written to prevent.

But the measurement found the disagreement is **already on the screen and
already in the cash flow**, so this is not a question about whether to add a
row. It is a live correctness defect that a total would have made harder to
see rather than easier.

---

## The mechanism, exactly

| | |
|---|---|
| **DISPLAYED** | `usdFor(i)` = `milestoneUsdFor(values['deal-ms-i-pct'], oneOffPrice)`, recomputed on every render, so it tracks the price |
| **STORED** | `values['deal-ms-i-usd']`, written by `onMilestoneTyped` **only when a percentage is typed**, and read by `readMilestones` into the payload |
| **THE GAP** | any change to the PRICE - units, costs, margins, installation - moves the displayed figure and leaves the stored one where it was |

**And the site carries a comment claiming the opposite**, in
`panelParts.tsx`:

> "THE USD IS COMPUTED and shown read-only, so the two readings of this
> schedule cannot disagree about what it is a percentage of."

That is the claim this measurement falsifies. It is true of what it describes
- the cell cannot disagree with ITSELF about the percentage - and false about
the thing that matters, which is the figure the record receives.

---

## What this needs, and why it is not this round's to decide

**Which reading is authoritative is a pricing decision, not a layout one.**
The two candidate fixes lead to different behaviour:

1. **Derive at save time.** `readMilestones` computes the USD from the
   percentage and the current price, so the record always matches the screen.
   A schedule then silently re-prices whenever the deal does, which may be
   exactly right or exactly wrong depending on whether a milestone schedule is
   a percentage agreement or a fixed-dollar agreement.
2. **Keep the stored figure and stop deriving the display.** The cell shows
   what was agreed, the price moves underneath it, and the warning's
   "under by" line becomes the thing that tells somebody to revisit it.

**The first is a behaviour change to what a milestone MEANS.** It is John's to
rule, and it wants its own round with the cash-flow consequences measured.

---

## Disposition

- **N1 is NOT BUILT.** No total was added.
- The defect is recorded here, measured rather than reasoned, with the probe
  committed so the measurement can be re-run in one command:
  `scripts/walk6/probe-n1-ambiguity.mjs`.
- **N2, N3 and N4 are unaffected** and proceed: none of them touches this
  column or this calculation.
